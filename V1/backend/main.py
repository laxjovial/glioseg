import os
import uuid
import zipfile
import io
import logging
import re
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional

from segmentation import run_inference, save_slice_images, save_segmentation_mask

# --- App Configuration ---
app = FastAPI()

# --- Logging Configuration ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Database Configuration ---
MONGO_DETAILS = "mongodb://localhost:27017"
client = AsyncIOMotorClient(MONGO_DETAILS)
database = client.glioseg
patient_collection = database.get_collection("patients")

# --- Pydantic Models ---
class Scan(BaseModel):
    t1c: str
    t1n: str
    t2f: str
    t2w: str

class SegmentationResult(BaseModel):
    scan_id: int
    mask_path: str
    mri_slice_paths: List[str]
    overlay_slice_paths: List[str]

class Patient(BaseModel):
    id: str = Field(..., alias="_id")
    patient_id: str
    age: Optional[int] = None
    sex: Optional[str] = None
    email: Optional[EmailStr] = None
    scans: List[Scan] = []
    segmentation_results: List[SegmentationResult] = []

# --- Static Files ---
app.mount("/static", StaticFiles(directory="static"), name="static")

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "static/outputs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

@app.get("/")
async def read_index():
    return FileResponse('index.html')

# --- Helper Functions ---
def sanitize_patient_id(patient_id: str) -> str:
    """Sanitizes the patient ID to prevent path traversal."""
    return re.sub(r'[^a-zA-Z0-9_-]', '', patient_id)

async def get_patient(patient_id: str):
    return await patient_collection.find_one({"patient_id": patient_id})

async def handle_scan_upload(patient_id: str, file_paths: dict):
    """Handles updating the database with new scan information."""
    scan = Scan(**file_paths)
    patient = await get_patient(patient_id)
    if not patient:
        new_patient = {
            "_id": str(uuid.uuid4()),
            "patient_id": patient_id,
            "scans": [scan.dict()],
            "segmentation_results": [],
        }
        await patient_collection.insert_one(new_patient)
        scan_id = 0
    else:
        await patient_collection.update_one(
            {"patient_id": patient_id}, {"$push": {"scans": scan.dict()}}
        )
        scan_id = len(patient["scans"])
    return scan_id

# --- API Endpoints ---

@app.post("/upload/files/{patient_id}")
async def upload_individual_files(
    patient_id: str,
    t1c: UploadFile = File(...),
    t1n: UploadFile = File(...),
    t2f: UploadFile = File(...),
    t2w: UploadFile = File(...),
):
    patient_id = sanitize_patient_id(patient_id)
    patient_dir = os.path.join(UPLOAD_DIR, patient_id)
    os.makedirs(patient_dir, exist_ok=True)

    file_paths = {}
    for modality, file in [("t1c", t1c), ("t1n", t1n), ("t2f", t2f), ("t2w", t2w)]:
        file_path = os.path.join(patient_dir, f"{modality}.nii.gz")
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        file_paths[modality] = file_path

    scan_id = await handle_scan_upload(patient_id, file_paths)
    return {"message": "Files uploaded successfully", "patient_id": patient_id, "scan_id": scan_id}


@app.post("/upload/zip/{patient_id}")
async def upload_zip_file(patient_id: str, file: UploadFile = File(...)):
    patient_id = sanitize_patient_id(patient_id)
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a zip file.")

    patient_dir = os.path.join(UPLOAD_DIR, patient_id)
    os.makedirs(patient_dir, exist_ok=True)

    contents = await file.read()
    with zipfile.ZipFile(io.BytesIO(contents)) as z:
        z.extractall(patient_dir)

    file_paths = {
        "t1c": os.path.join(patient_dir, "t1c.nii.gz"),
        "t1n": os.path.join(patient_dir, "t1n.nii.gz"),
        "t2f": os.path.join(patient_dir, "t2f.nii.gz"),
        "t2w": os.path.join(patient_dir, "t2w.nii.gz"),
    }
    scan_id = await handle_scan_upload(patient_id, file_paths)
    return {"message": "Zip file uploaded and extracted successfully", "patient_id": patient_id, "scan_id": scan_id}

@app.post("/segment/{patient_id}/{scan_id}")
async def segment_scan(patient_id: str, scan_id: int):
    patient_id = sanitize_patient_id(patient_id)
    logger.info(f"Starting segmentation for patient {patient_id}, scan {scan_id}")
    try:
        patient = await get_patient(patient_id)
        if not patient:
            logger.error(f"Patient not found: {patient_id}")
            raise HTTPException(status_code=404, detail="Patient not found")

        if scan_id >= len(patient["scans"]):
            logger.error(f"Scan not found: {scan_id}")
            raise HTTPException(status_code=404, detail="Scan not found")

        scan_files = patient["scans"][scan_id]
        logger.info(f"Running inference with files: {scan_files}")
        subject, pred = run_inference(scan_files)
        logger.info("Inference complete")

        scan_id_str = str(scan_id)

        logger.info("Saving slice images")
        mri_slice_paths, overlay_slice_paths = save_slice_images(subject, pred, patient_id, scan_id_str, output_dir=OUTPUT_DIR)
        logger.info("Saving segmentation mask")
        mask_path = save_segmentation_mask(pred, patient_id, scan_id_str, output_dir=UPLOAD_DIR)

        segmentation_result = {
            "scan_id": scan_id,
            "mask_path": mask_path,
            "mri_slice_paths": mri_slice_paths,
            "overlay_slice_paths": overlay_slice_paths,
        }

        logger.info("Updating database")
        await patient_collection.update_one(
            {"patient_id": patient_id},
            {"$push": {"segmentation_results": segmentation_result}},
        )

        logger.info("Segmentation complete")
        return {"message": "Segmentation complete", "results": segmentation_result}
    except Exception as e:
        logger.exception("An error occurred during segmentation")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/patients/{patient_id}")
async def get_patient_data(patient_id: str):
    patient_id = sanitize_patient_id(patient_id)
    patient = await get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@app.get("/search/{patient_id}")
async def search_patient(patient_id: str):
    patient_id = sanitize_patient_id(patient_id)
    patient = await get_patient(patient_id)
    if not patient:
        return {"found": False}
    return {"found": True, "patient": patient}


@app.get("/download/mask/{patient_id}/{scan_id}")
async def download_segmentation_mask(patient_id: str, scan_id: int):
    patient_id = sanitize_patient_id(patient_id)
    patient = await get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    segmentation_result = next((r for r in patient.get("segmentation_results", []) if r["scan_id"] == scan_id), None)
    if not segmentation_result:
        raise HTTPException(status_code=404, detail="Segmentation result not found")

    return FileResponse(segmentation_result["mask_path"], media_type='application/gzip', filename=f"{patient_id}_scan_{scan_id}_mask.nii.gz")

@app.post("/email/{patient_id}/{scan_id}")
async def email_results(patient_id: str, scan_id: int):
    patient_id = sanitize_patient_id(patient_id)
    patient = await get_patient(patient_id)
    if not patient or not patient.get("email"):
        raise HTTPException(status_code=404, detail="Patient not found or no email on file.")

    segmentation_result = next((r for r in patient.get("segmentation_results", []) if r["scan_id"] == scan_id), None)
    if not segmentation_result:
        raise HTTPException(status_code=404, detail="Segmentation result not found")

    # Placeholder for email sending logic
    logger.info(f"Sending email to {patient['email']} with results for scan {scan_id}")

    return {"message": "Email sent successfully"}
