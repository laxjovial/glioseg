import os
import uuid
import zipfile
import io
import logging
import re
import json
import aiosmtplib
import numpy as np
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, validator
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from jinja2 import Template
import aiofiles
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors

from segmentation import run_inference, save_slice_images, save_segmentation_mask

# --- App Configuration ---
app = FastAPI(title="Glioma AI Workstation", version="1.0.0")

# --- Logging Configuration ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Database Configuration ---
MONGO_DETAILS = "mongodb://localhost:27017"
client = AsyncIOMotorClient(MONGO_DETAILS)
database = client.glioseg
patient_collection = database.get_collection("patients")

# --- Email Configuration ---
EMAIL_CONFIG = {
    "smtp_server": "smtp.gmail.com",  # Change as needed
    "smtp_port": 587,
    "smtp_user": os.getenv("EMAIL_USER", "your-email@gmail.com"),
    "smtp_password": os.getenv("EMAIL_PASSWORD", "your-app-password"),
    "use_tls": True
}

# --- Pydantic Models ---
class PatientCreate(BaseModel):
    patient_id: str
    name: str
    age: Optional[int] = None
    sex: Optional[str] = Field(None, pattern="^(M|F|Male|Female|Other)$")
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    medical_record_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    attending_physician: Optional[str] = None
    notes: Optional[str] = None

class PatientUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = Field(None, pattern="^(M|F|Male|Female|Other)$")
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    medical_record_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    attending_physician: Optional[str] = None
    notes: Optional[str] = None

class Scan(BaseModel):
    scan_id: str
    t1c: str
    t1n: str
    t2f: str
    t2w: str
    upload_timestamp: datetime = Field(default_factory=datetime.now)
    radiologist_notes: Optional[str] = None

class SegmentationResult(BaseModel):
    scan_id: str
    result_id: str
    mask_path: str
    mri_slice_paths: List[str]
    overlay_slice_paths: List[str]
    tumor_volume: Optional[float] = None
    confidence_score: Optional[float] = None
    processing_timestamp: datetime = Field(default_factory=datetime.now)
    radiologist_notes: Optional[str] = None

class Patient(BaseModel):
    id: str = Field(..., alias="_id")
    patient_id: str
    name: str
    age: Optional[int] = None
    sex: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    medical_record_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    attending_physician: Optional[str] = None
    notes: Optional[str] = None
    created_timestamp: datetime = Field(default_factory=datetime.now)
    last_updated: datetime = Field(default_factory=datetime.now)
    scans: List[Scan] = []
    segmentation_results: List[SegmentationResult] = []

class EmailRequest(BaseModel):
    recipient_email: Optional[str] = None
    include_report: bool = True
    include_mask: bool = True
    custom_message: Optional[str] = None

class SearchRequest(BaseModel):
    query: str
    search_type: str = "all"  # "all", "patient_id", "name", "email", "mrn"

# --- Static Files ---
app.mount("/static", StaticFiles(directory="static"), name="static")

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "static/outputs"
REPORTS_DIR = "static/reports"
TEMPLATES_DIR = "templates"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)
os.makedirs(TEMPLATES_DIR, exist_ok=True)

@app.get("/")
async def read_index():
    return FileResponse('index.html')

# --- Helper Functions ---
def sanitize_patient_id(patient_id: str) -> str:
    """Sanitizes the patient ID to prevent path traversal."""
    return re.sub(r'[^a-zA-Z0-9_-]', '', patient_id)

async def get_patient(patient_id: str):
    """Get patient by patient_id"""
    return await patient_collection.find_one({"patient_id": patient_id})

async def get_patient_by_id(id: str):
    """Get patient by MongoDB _id"""
    return await patient_collection.find_one({"_id": id})

async def search_patients(query: str, search_type: str = "all"):
    """Search patients based on query and search type"""
    if search_type == "patient_id":
        return await patient_collection.find({"patient_id": {"$regex": query, "$options": "i"}}).to_list(100)
    elif search_type == "name":
        return await patient_collection.find({"name": {"$regex": query, "$options": "i"}}).to_list(100)
    elif search_type == "email":
        return await patient_collection.find({"email": {"$regex": query, "$options": "i"}}).to_list(100)
    elif search_type == "mrn":
        return await patient_collection.find({"medical_record_number": {"$regex": query, "$options": "i"}}).to_list(100)
    else:  # search_type == "all"
        return await patient_collection.find({
            "$or": [
                {"patient_id": {"$regex": query, "$options": "i"}},
                {"name": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query, "$options": "i"}},
                {"medical_record_number": {"$regex": query, "$options": "i"}}
            ]
        }).to_list(100)

async def handle_scan_upload(patient_id: str, file_paths: dict):
    """Handles updating the database with new scan information."""
    scan_id = str(uuid.uuid4())
    scan = Scan(scan_id=scan_id, **file_paths)
    patient = await get_patient(patient_id)
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found. Please register patient first.")
    
    await patient_collection.update_one(
        {"patient_id": patient_id}, 
        {
            "$push": {"scans": scan.dict()},
            "$set": {"last_updated": datetime.now()}
        }
    )
    return scan_id

def validate_zip_structure(zip_file):
    """Validate that zip file contains the required NIfTI files"""
    required_files = {"t1c.nii.gz", "t1n.nii.gz", "t2f.nii.gz", "t2w.nii.gz"}
    with zipfile.ZipFile(zip_file, 'r') as z:
        file_list = set(z.namelist())
        if not required_files.issubset(file_list):
            missing = required_files - file_list
            raise HTTPException(
                status_code=400, 
                detail=f"Missing required files in zip: {', '.join(missing)}"
            )

async def send_email(to_email: str, subject: str, body: str, attachments: List[str] = None):
    """Send email with optional attachments"""
    try:
        message = MIMEMultipart()
        message["From"] = EMAIL_CONFIG["smtp_user"]
        message["To"] = to_email
        message["Subject"] = subject
        
        message.attach(MIMEText(body, "html"))
        
        if attachments:
            for file_path in attachments:
                if os.path.exists(file_path):
                    with open(file_path, "rb") as attachment:
                        part = MIMEBase("application", "octet-stream")
                        part.set_payload(attachment.read())
                    encoders.encode_base64(part)
                    part.add_header(
                        "Content-Disposition",
                        f"attachment; filename= {os.path.basename(file_path)}",
                    )
                    message.attach(part)
        
        async with aiosmtplib.SMTP(
            hostname=EMAIL_CONFIG["smtp_server"], 
            port=EMAIL_CONFIG["smtp_port"], 
            use_tls=EMAIL_CONFIG["use_tls"]
        ) as smtp:
            await smtp.login(EMAIL_CONFIG["smtp_user"], EMAIL_CONFIG["smtp_password"])
            await smtp.send_message(message)
        
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return False

def generate_pdf_report(patient: dict, scan_id: str, segmentation_result: dict):
    """Generate PDF report for patient scan results"""
    report_filename = f"{patient['patient_id']}_{scan_id}_report.pdf"
    report_path = os.path.join(REPORTS_DIR, report_filename)
    
    doc = SimpleDocTemplate(report_path, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=30,
        alignment=1  # Center alignment
    )
    story.append(Paragraph("Glioma Segmentation Report", title_style))
    story.append(Spacer(1, 12))
    
    # Patient Information Table
    patient_data = [
        ["Patient Information", ""],
        ["Patient ID", patient.get('patient_id', 'N/A')],
        ["Name", patient.get('name', 'N/A')],
        ["Age", str(patient.get('age', 'N/A'))],
        ["Sex", patient.get('sex', 'N/A')],
        ["Email", patient.get('email', 'N/A')],
        ["Medical Record Number", patient.get('medical_record_number', 'N/A')],
        ["Date of Birth", patient.get('date_of_birth', 'N/A')],
        ["Attending Physician", patient.get('attending_physician', 'N/A')],
    ]
    
    patient_table = Table(patient_data, colWidths=[2*inch, 3*inch])
    patient_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 14),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(patient_table)
    story.append(Spacer(1, 12))
    
    # Segmentation Results
    result_data = [
        ["Segmentation Results", ""],
        ["Scan ID", scan_id],
        ["Processing Date", segmentation_result.get('processing_timestamp', 'N/A')],
        ["Tumor Volume", f"{segmentation_result.get('tumor_volume', 'N/A')} cm³"],
        ["Confidence Score", f"{segmentation_result.get('confidence_score', 'N/A')}%"],
    ]
    
    result_table = Table(result_data, colWidths=[2*inch, 3*inch])
    result_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 14),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(result_table)
    story.append(Spacer(1, 12))
    
    # Notes
    if segmentation_result.get('radiologist_notes'):
        story.append(Paragraph("Radiologist Notes:", styles['Heading2']))
        story.append(Paragraph(segmentation_result['radiologist_notes'], styles['Normal']))
    
    doc.build(story)
    return report_path

# --- API Endpoints ---

@app.get("/")
async def read_index():
    return FileResponse('index.html')

@app.post("/patients/register")
async def register_patient(patient_data: PatientCreate):
    """Register a new patient"""
    # Check if patient already exists
    existing_patient = await get_patient(patient_data.patient_id)
    if existing_patient:
        raise HTTPException(status_code=400, detail="Patient with this ID already exists")
    
    new_patient = {
        "_id": str(uuid.uuid4()),
        **patient_data.dict(),
        "created_timestamp": datetime.now(),
        "last_updated": datetime.now(),
        "scans": [],
        "segmentation_results": []
    }
    
    await patient_collection.insert_one(new_patient)
    return {"message": "Patient registered successfully", "patient_id": patient_data.patient_id}

@app.put("/patients/{patient_id}")
async def update_patient(patient_id: str, patient_data: PatientUpdate):
    """Update patient information"""
    patient_id = sanitize_patient_id(patient_id)
    patient = await get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    update_data = {k: v for k, v in patient_data.dict().items() if v is not None}
    update_data["last_updated"] = datetime.now()
    
    await patient_collection.update_one(
        {"patient_id": patient_id},
        {"$set": update_data}
    )
    return {"message": "Patient updated successfully"}

@app.get("/patients")
async def list_patients(skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100)):
    """List all patients with pagination"""
    cursor = patient_collection.find().skip(skip).limit(limit)
    patients = await cursor.to_list(length=limit)
    total_count = await patient_collection.count_documents({})
    
    return {
        "patients": patients,
        "total": total_count,
        "skip": skip,
        "limit": limit
    }

@app.post("/patients/search")
async def search_patients_endpoint(search_request: SearchRequest):
    """Search patients by various criteria"""
    patients = await search_patients(search_request.query, search_request.search_type)
    return {"patients": patients, "count": len(patients)}

@app.post("/upload/files/{patient_id}")
async def upload_individual_files(
    patient_id: str,
    t1c: UploadFile = File(...),
    t1n: UploadFile = File(...),
    t2f: UploadFile = File(...),
    t2w: UploadFile = File(...),
):
    """Upload individual MRI files for a patient"""
    patient_id = sanitize_patient_id(patient_id)
    patient_dir = os.path.join(UPLOAD_DIR, patient_id)
    os.makedirs(patient_dir, exist_ok=True)

    # Validate file extensions
    valid_extensions = ['.nii', '.nii.gz']
    files_to_upload = [("t1c", t1c), ("t1n", t1n), ("t2f", t2f), ("t2w", t2w)]
    
    for modality, file in files_to_upload:
        if not any(file.filename.endswith(ext) for ext in valid_extensions):
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file format for {modality}. Expected .nii or .nii.gz"
            )

    file_paths = {}
    for modality, file in files_to_upload:
        file_extension = '.nii.gz' if file.filename.endswith('.nii.gz') else '.nii'
        file_path = os.path.join(patient_dir, f"{modality}{file_extension}")
        
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        file_paths[modality] = file_path

    scan_id = await handle_scan_upload(patient_id, file_paths)
    return {
        "message": "Files uploaded successfully", 
        "patient_id": patient_id, 
        "scan_id": scan_id
    }

@app.post("/upload/zip/{patient_id}")
async def upload_zip_file(patient_id: str, file: UploadFile = File(...)):
    """Upload zipped MRI files for a patient"""
    patient_id = sanitize_patient_id(patient_id)
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a zip file.")

    patient_dir = os.path.join(UPLOAD_DIR, patient_id)
    os.makedirs(patient_dir, exist_ok=True)

    contents = await file.read()
    zip_buffer = io.BytesIO(contents)
    
    # Validate zip structure
    validate_zip_structure(zip_buffer)
    zip_buffer.seek(0)  # Reset buffer position

    with zipfile.ZipFile(zip_buffer) as z:
        z.extractall(patient_dir)

    file_paths = {
        "t1c": os.path.join(patient_dir, "t1c.nii.gz"),
        "t1n": os.path.join(patient_dir, "t1n.nii.gz"),
        "t2f": os.path.join(patient_dir, "t2f.nii.gz"),
        "t2w": os.path.join(patient_dir, "t2w.nii.gz"),
    }
    
    scan_id = await handle_scan_upload(patient_id, file_paths)
    return {
        "message": "Zip file uploaded and extracted successfully", 
        "patient_id": patient_id, 
        "scan_id": scan_id
    }

@app.post("/segment/{patient_id}/{scan_id}")
async def segment_scan(patient_id: str, scan_id: str, radiologist_notes: str = Form(None)):
    """Run segmentation on uploaded scan"""
    patient_id = sanitize_patient_id(patient_id)
    logger.info(f"Starting segmentation for patient {patient_id}, scan {scan_id}")
    
    try:
        patient = await get_patient(patient_id)
        if not patient:
            logger.error(f"Patient not found: {patient_id}")
            raise HTTPException(status_code=404, detail="Patient not found")

        # Find the specific scan
        scan = None
        for s in patient.get("scans", []):
            if s["scan_id"] == scan_id:
                scan = s
                break
        
        if not scan:
            logger.error(f"Scan not found: {scan_id}")
            raise HTTPException(status_code=404, detail="Scan not found")

        scan_files = {
            "t1c": scan["t1c"],
            "t1n": scan["t1n"],
            "t2f": scan["t2f"],
            "t2w": scan["t2w"]
        }
        
        logger.info(f"Running inference with files: {scan_files}")
        subject, pred = run_inference(scan_files)
        logger.info("Inference complete")

        logger.info("Saving slice images")
        mri_slice_paths, overlay_slice_paths = save_slice_images(
            subject, pred, patient_id, scan_id, output_dir=OUTPUT_DIR
        )
        
        logger.info("Saving segmentation mask")
        mask_path = save_segmentation_mask(pred, patient_id, scan_id, output_dir=UPLOAD_DIR)

        # Calculate tumor volume (rough approximation)
        tumor_volume = float(np.sum(pred > 0) * 0.001)  # Convert to cm³
        confidence_score = 85.0  # Placeholder - should be calculated from model

        result_id = str(uuid.uuid4())
        
        def to_static_url(path: str):
            rel_path = os.path.relpath(path, "static")  # path relative to 'static' folder
            return f"/static/{rel_path.replace(os.sep, '/')}"
        
        segmentation_result = {
            "scan_id": scan_id,
            "result_id": result_id,
            "mask_path": mask_path,  # optional: could also convert to URL if needed
            "mri_slice_paths": [to_static_url(p) for p in mri_slice_paths],
            "overlay_slice_paths": [to_static_url(p) for p in overlay_slice_paths],
            "tumor_volume": tumor_volume,
            "confidence_score": confidence_score,
            "processing_timestamp": datetime.now(),
            "radiologist_notes": radiologist_notes
        }

        logger.info("Updating database")
        await patient_collection.update_one(
            {"patient_id": patient_id},
            {
                "$push": {"segmentation_results": segmentation_result},
                "$set": {"last_updated": datetime.now()}
            }
        )

        logger.info("Segmentation complete")
        return {"message": "Segmentation complete", "results": segmentation_result}
        
    except Exception as e:
        logger.exception("An error occurred during segmentation")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/patients/{patient_id}")
async def get_patient_data(patient_id: str):
    """Get complete patient data including scans and results"""
    patient_id = sanitize_patient_id(patient_id)
    patient = await get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@app.get("/patients/{patient_id}/scans")
async def get_patient_scans(patient_id: str):
    """Get all scans for a patient"""
    patient_id = sanitize_patient_id(patient_id)
    patient = await get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"scans": patient.get("scans", [])}

@app.get("/patients/{patient_id}/results")
async def get_patient_results(patient_id: str):
    """Get all segmentation results for a patient"""
    patient_id = sanitize_patient_id(patient_id)
    patient = await get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"results": patient.get("segmentation_results", [])}

@app.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str):
    """Delete a patient and all associated data"""
    patient_id = sanitize_patient_id(patient_id)
    patient = await get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Delete patient files
    patient_dir = os.path.join(UPLOAD_DIR, patient_id)
    if os.path.exists(patient_dir):
        import shutil
        shutil.rmtree(patient_dir)
    
    output_dir = os.path.join(OUTPUT_DIR, patient_id)
    if os.path.exists(output_dir):
        import shutil
        shutil.rmtree(output_dir)
    
    # Delete from database
    await patient_collection.delete_one({"patient_id": patient_id})
    return {"message": "Patient deleted successfully"}

@app.get("/download/mask/{patient_id}/{scan_id}")
async def download_segmentation_mask(patient_id: str, scan_id: str):
    """Download segmentation mask file"""
    patient_id = sanitize_patient_id(patient_id)
    patient = await get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    segmentation_result = None
    for result in patient.get("segmentation_results", []):
        if result["scan_id"] == scan_id:
            segmentation_result = result
            break
    
    if not segmentation_result:
        raise HTTPException(status_code=404, detail="Segmentation result not found")

    mask_path = segmentation_result["mask_path"]
    if not os.path.exists(mask_path):
        raise HTTPException(status_code=404, detail="Mask file not found")

    return FileResponse(
        mask_path, 
        media_type='application/gzip', 
        filename=f"{patient_id}_scan_{scan_id}_mask.nii.gz"
    )

@app.get("/download/report/{patient_id}/{scan_id}")
async def download_report(patient_id: str, scan_id: str):
    """Generate and download PDF report"""
    patient_id = sanitize_patient_id(patient_id)
    patient = await get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    segmentation_result = None
    for result in patient.get("segmentation_results", []):
        if result["scan_id"] == scan_id:
            segmentation_result = result
            break
    
    if not segmentation_result:
        raise HTTPException(status_code=404, detail="Segmentation result not found")

    report_path = generate_pdf_report(patient, scan_id, segmentation_result)
    return FileResponse(
        report_path,
        media_type='application/pdf',
        filename=f"{patient_id}_scan_{scan_id}_report.pdf"
    )

@app.post("/email/{patient_id}/{scan_id}")
async def email_results(patient_id: str, scan_id: str, email_request: EmailRequest):
    """Send segmentation results via email"""
    patient_id = sanitize_patient_id(patient_id)
    patient = await get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Determine recipient email
    recipient_email = email_request.recipient_email or patient.get("email")
    if not recipient_email:
        raise HTTPException(status_code=400, detail="No email address provided")

    segmentation_result = None
    for result in patient.get("segmentation_results", []):
        if result["scan_id"] == scan_id:
            segmentation_result = result
            break
    
    if not segmentation_result:
        raise HTTPException(status_code=404, detail="Segmentation result not found")

    # Prepare email content
    subject = f"Glioma Segmentation Results - Patient {patient_id}"
    
    email_body = f"""
    <html>
    <body>
        <h2>Glioma Segmentation Results</h2>
        <p>Dear {patient.get('name', 'Patient')},</p>
        
        <p>Your MRI scan analysis has been completed. Please find the results below:</p>
        
        <h3>Patient Information:</h3>
        <ul>
            <li><strong>Patient ID:</strong> {patient_id}</li>
            <li><strong>Scan Date:</strong> {segmentation_result.get('processing_timestamp', 'N/A')}</li>
            <li><strong>Tumor Volume:</strong> {segmentation_result.get('tumor_volume', 'N/A')} cm³</li>
            <li><strong>Confidence Score:</strong> {segmentation_result.get('confidence_score', 'N/A')}%</li>
        </ul>
        
        {f"<h3>Radiologist Notes:</h3><p>{segmentation_result.get('radiologist_notes')}</p>" if segmentation_result.get('radiologist_notes') else ""}
        
        {f"<h3>Custom Message:</h3><p>{email_request.custom_message}</p>" if email_request.custom_message else ""}
        
        <p>Please consult with your healthcare provider regarding these results.</p>
        
        <p>Best regards,<br>Glioma AI Workstation</p>
    </body>
    </html>
    """
    
    # Prepare attachments
    attachments = []
    if email_request.include_mask:
        mask_path = segmentation_result.get("mask_path")
        if mask_path and os.path.exists(mask_path):
            attachments.append(mask_path)
    
    if email_request.include_report:
        report_path = generate_pdf_report(patient, scan_id, segmentation_result)
        attachments.append(report_path)
    
    # Send email
    success = await send_email(recipient_email, subject, email_body, attachments)
    
    if success:
        return {"message": f"Email sent successfully to {recipient_email}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send email")

@app.get("/search/{patient_id}")
async def search_patient_simple(patient_id: str):
    """Simple patient search by ID (for backward compatibility)"""
    patient_id = sanitize_patient_id(patient_id)
    patient = await get_patient(patient_id)
    if not patient:
        return {"found": False}
    return {"found": True, "patient": patient}

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now()}
