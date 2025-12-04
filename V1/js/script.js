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

// Dummy images for demo (replace with real URLs from your backend)
const demoSlices = [
  "https://dummyimage.com/640x480/ced4da/343a40&text=MRI+Slice+1",
  "https://dummyimage.com/640x480/cfd8dc/263238&text=MRI+Slice+2",
  "https://dummyimage.com/640x480/e9ecef/495057&text=MRI+Slice+3"
];
const demoOverlay = [
  "https://dummyimage.com/640x480/ff6b6b/ffffff&text=Mask+1",
  "https://dummyimage.com/640x480/ff8787/ffffff&text=Mask+2",
  "https://dummyimage.com/640x480/fa5252/ffffff&text=Mask+3"
];

let currentSlices = [];
let currentMasks = [];

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

// Simulate calling backend / segmentation when form submitted
form.addEventListener("submit", function (e) {
  e.preventDefault();

  if (!document.getElementById("image_file").files.length) {
    alert("Please select an MRI file.");
    return;
  }

  setStatus("Running...", "running");
  runBtn.disabled = true;

  // Simulate latency + fake results
  setTimeout(() => {
    // Simulated model outputs
    const fakeTumorVolume = 32.4;
    const fakeConfidence = 0.93;
    const fakeNumSlices = demoSlices.length;
    const fakePatientId = "PAT-00123";

    tumorVolumeLabel.textContent = fakeTumorVolume.toFixed(1) + " cc";
    confidenceLabel.textContent = (fakeConfidence * 100).toFixed(1) + "%";
    numSlicesLabel.textContent = fakeNumSlices;
    patientIdLabel.textContent = fakePatientId;
    patientAgeLabel.textContent = "56";
    patientSexLabel.textContent = "F";

    downloadMaskBtn.disabled = false;
    downloadReportBtn.disabled = false;

    currentSlices = demoSlices.slice();
    currentMasks = demoOverlay.slice();

    sliceSlider.disabled = false;
    sliceSlider.max = currentSlices.length - 1;
    sliceSlider.value = 0;
    updateSlice(0);

    setStatus("Completed", "done");
    runBtn.disabled = false;
  }, 1200);
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

  mriImage.classList.add("d-none");
  segOverlay.classList.add("d-none");
  placeholderText.classList.remove("d-none");

  downloadMaskBtn.disabled = true;
  downloadReportBtn.disabled = true;
});

// Export buttons (stub)
downloadMaskBtn.addEventListener("click", function () {
  alert("This would download the segmentation mask from your backend.");
});

downloadReportBtn.addEventListener("click", function () {
  alert("This would download a PDF/JSON report from your backend.");
});
