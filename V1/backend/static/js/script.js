// app.js

// === Element references ===
const form = document.getElementById("upload-form");
const runBtn = document.getElementById("run-btn");
const resetBtn = document.getElementById("reset-btn");
const statusBadge = document.getElementById("status-badge");
const statusSpinner = document.getElementById("status-spinner");
const sliceSlider = document.getElementById("slice-slider");
const sliceLabel = document.getElementById("slice-label");
const overlayToggle = document.getElementById("toggle-overlay");
const overlayOpacity = document.getElementById("overlay-opacity");
const mriImage = document.getElementById("mri-image");
const segOverlay = document.getElementById("segmentation-overlay");
const placeholderText = document.getElementById("placeholder-text");
const tumorVolumeLabel = document.getElementById("tumor-volume-label");
const confidenceLabel = document.getElementById("confidence-label");
const numSlicesLabel = document.getElementById("num-slices-label");
const patientIdLabel = document.getElementById("patient-id-label");
const patientAgeLabel = document.getElementById("patient-age-label");
const patientSexLabel = document.getElementById("patient-sex-label");
const downloadMaskBtn = document.getElementById("download-mask-btn");
const downloadReportBtn = document.getElementById("download-report-btn");
const emailBtn = document.getElementById("email-btn");
const imageFile = document.getElementById("image_file");
const patientEmail = document.getElementById("patient_email");


let currentSlices = [];
let currentMasks = [];
let currentPatientId = null;
let currentScanId = null;


function setStatus(text, mode) {
  statusBadge.textContent = text;
  statusBadge.className = "badge border";

  if (mode === "running") {
    statusBadge.classList.add(
      "bg-warning-subtle",
      "text-warning-emphasis",
      "border-warning-subtle"
    );
    statusSpinner.classList.remove("d-none");
  } else if (mode === "done") {
    statusBadge.classList.add(
      "bg-success-subtle",
      "text-success-emphasis",
      "border-success-subtle"
    );
    statusSpinner.classList.add("d-none");
  } else if (mode === "error") {
    statusBadge.classList.add(
      "bg-danger-subtle",
      "text-danger-emphasis",
      "border-danger-subtle"
    );
    statusSpinner.classList.add("d-none");
  } else {
    statusBadge.classList.add(
      "bg-secondary-subtle",
      "text-secondary-emphasis",
      "border-secondary-subtle"
    );
    statusSpinner.classList.add("d-none");
  }
}

function updateSlice(index) {
  if (!currentSlices.length) return;

  const total = currentSlices.length;
  const safeIndex = Math.min(Math.max(index, 0), total - 1);

  sliceSlider.value = safeIndex;
  sliceLabel.textContent = `Slice ${safeIndex + 1} / ${total}`;

  mriImage.src = currentSlices[safeIndex];
  segOverlay.src = currentMasks[safeIndex];


  mriImage.classList.remove("d-none");
  segOverlay.classList.remove("d-none");
  placeholderText.classList.add("d-none");
}


form.addEventListener("submit", async function (e) {
  e.preventDefault();

  const patientId = "user-" + Date.now();
  currentPatientId = patientId;
  patientIdLabel.textContent = patientId;

  if (imageFile.files.length === 0) {
    alert("Please select an MRI file.");
    return;
  }

  setStatus("Uploading...", "running");
  runBtn.disabled = true;

  const formData = new FormData();

  formData.append("file", imageFile.files[0]);

  try {
    const uploadResponse = await fetch(`/upload/zip/${patientId}`, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error("Upload failed");
    }

    const uploadResult = await uploadResponse.json();
    currentScanId = uploadResult.scan_id;

    // Update patient email if provided
    if (patientEmail.value) {
        await fetch(`/patients/${patientId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: patientEmail.value }),
        });
    }


    setStatus("Segmenting...", "running");

    const segmentResponse = await fetch(`/segment/${patientId}/${currentScanId}`, {
      method: "POST",
    });

    if (!segmentResponse.ok) {
      throw new Error("Segmentation failed");
    }

    const segmentResult = await segmentResponse.json();

    const patientDataResponse = await fetch(`/patients/${patientId}`);
    const patientData = await patientDataResponse.json();

    // update patient info
    patientAgeLabel.textContent = patientData.age || "-";
    patientSexLabel.textContent = patientData.sex || "-";

    const segmentationData = patientData.segmentation_results.find(r => r.scan_id === currentScanId);

    if (segmentationData) {
        currentSlices = segmentationData.mri_slice_paths.map(p => `/${p}`);
        currentMasks = segmentationData.overlay_slice_paths.map(p => `/${p}`);


        numSlicesLabel.textContent = segmentationData.mri_slice_paths.length;
        sliceSlider.disabled = false;
        sliceSlider.max = segmentationData.mri_slice_paths.length - 1;
        sliceSlider.value = 0;
        updateSlice(0);
    }


    downloadMaskBtn.disabled = false;
    downloadReportBtn.disabled = false; // This is still a stub
    emailBtn.disabled = false;

    setStatus("Completed", "done");

  } catch (error) {
    console.error("Error:", error);
    setStatus("Error", "error");
  } finally {
    runBtn.disabled = false;
  }
});

sliceSlider.addEventListener("input", function () {
  const sliceIndex = parseInt(sliceSlider.value) || 0;
  updateSlice(sliceIndex);
});

overlayToggle.addEventListener("change", function () {
  if (overlayToggle.checked) {
    segOverlay.classList.remove("d-none");
  } else {
    segOverlay.classList.add("d-none");
  }
});

overlayOpacity.addEventListener("input", function () {
  const alpha = overlayOpacity.value / 100;
  segOverlay.style.opacity = alpha;
});

resetBtn.addEventListener("click", function () {
  form.reset();
  setStatus("Idle", "idle");

  tumorVolumeLabel.textContent = "-";
  confidenceLabel.textContent = "-";
  numSlicesLabel.textContent = "-";
  patientIdLabel.textContent = "N/A";
  patientAgeLabel.textContent = "-";
  patientSexLabel.textContent = "-";

  sliceSlider.disabled = true;
  sliceSlider.max = 0;
  sliceSlider.value = 0;
  sliceLabel.textContent = "Slice 0 / 0";

  currentSlices = [];
  currentMasks = [];
  currentPatientId = null;
  currentScanId = null;

  mriImage.classList.add("d-none");
  segOverlay.classList.add("d-none");
  placeholderText.classList.remove("d-none");

  downloadMaskBtn.disabled = true;
  downloadReportBtn.disabled = true;
  emailBtn.disabled = true;
});

// Export buttons
downloadMaskBtn.addEventListener("click", function () {
    if (currentPatientId && currentScanId !== null) {
        window.location.href = `/download/mask/${currentPatientId}/${currentScanId}`;
    } else {
        alert("No segmentation mask available to download.");
    }
});

downloadReportBtn.addEventListener("click", function () {
  alert("Report generation is not yet implemented.");
});

emailBtn.addEventListener("click", async function () {
    if (currentPatientId && currentScanId !== null) {
        try {
            const response = await fetch(`/email/${currentPatientId}/${currentScanId}`, {
                method: "POST",
            });
            if (response.ok) {
                alert("Email sent successfully!");
            } else {
                alert("Failed to send email.");
            }
        } catch (error) {
            console.error("Error sending email:", error);
            alert("An error occurred while sending the email.");
        }
    } else {
        alert("No segmentation results available to email.");
    }
});
