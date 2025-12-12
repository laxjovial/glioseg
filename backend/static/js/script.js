// Enhanced Glioma AI Workstation Frontend
// ===== Global State Management =====
let currentState = {
  currentPatient: null,
  currentScan: null,
  currentResult: null,
  slices: [],
  overlays: [],
  currentSliceIndex: 0,
};

// ===== DOM Element References =====
const elements = {
  // Navigation buttons
  showRegisterBtn: document.getElementById("show-register-btn"),
  showSearchBtn: document.getElementById("show-search-btn"),
  showPatientsBtn: document.getElementById("show-patients-btn"),

  // Patient selection
  currentPatientId: document.getElementById("current-patient-id"),
  loadPatientBtn: document.getElementById("load-patient-btn"),
  patientInfo: document.getElementById("patient-info"),
  patientNameLabel: document.getElementById("patient-name-label"),
  patientAgeLabel: document.getElementById("patient-age-label"),
  patientSexLabel: document.getElementById("patient-sex-label"),
  patientEmailLabel: document.getElementById("patient-email-label"),
  patientScansCount: document.getElementById("patient-scans-count"),

  // Upload controls
  uploadIndividual: document.getElementById("upload-individual"),
  uploadZip: document.getElementById("upload-zip"),
  individualUploadSection: document.getElementById("individual-upload-section"),
  zipUploadSection: document.getElementById("zip-upload-section"),

  // Individual upload
  uploadIndividualForm: document.getElementById("upload-individual-form"),
  t1cFile: document.getElementById("t1c_file"),
  t1nFile: document.getElementById("t1n_file"),
  t2fFile: document.getElementById("t2f_file"),
  t2wFile: document.getElementById("t2w_file"),

  // Zip upload
  uploadZipForm: document.getElementById("upload-zip-form"),
  zipFile: document.getElementById("zip_file"),

  // Scan selection and segmentation
  scanSelectionSection: document.getElementById("scan-selection-section"),
  scanSelect: document.getElementById("scan-select"),
  radiologistNotes: document.getElementById("radiologist-notes"),
  runSegmentationBtn: document.getElementById("run-segmentation-btn"),

  // Status
  statusBadge: document.getElementById("status-badge"),
  statusSpinner: document.getElementById("status-spinner"),

  // Image viewer
  sliceSlider: document.getElementById("slice-slider"),
  sliceLabel: document.getElementById("slice-label"),
  overlayToggle: document.getElementById("toggle-overlay"),
  overlayOpacity: document.getElementById("overlay-opacity"),
  mriImage: document.getElementById("mri-image"),
  segOverlay: document.getElementById("segmentation-overlay"),
  placeholderText: document.getElementById("placeholder-text"),

  // Results panel
  tumorVolumeLabel: document.getElementById("tumor-volume-label"),
  confidenceLabel: document.getElementById("confidence-label"),
  numSlicesLabel: document.getElementById("num-slices-label"),
  currentRadiologistNotes: document.getElementById("current-radiologist-notes"),
  resultsHistory: document.getElementById("results-history"),

  // Action buttons
  downloadMaskBtn: document.getElementById("download-mask-btn"),
  downloadReportBtn: document.getElementById("download-report-btn"),
  emailBtn: document.getElementById("email-btn"),

  // Modals
  registerModal: document.getElementById("registerModal"),
  searchModal: document.getElementById("searchModal"),
  patientsModal: document.getElementById("patientsModal"),
  emailModal: document.getElementById("emailModal"),

  // Modal forms
  registerForm: document.getElementById("register-form"),
  registerSubmitBtn: document.getElementById("register-submit-btn"),
  searchInput: document.getElementById("search-input"),
  searchType: document.getElementById("search-type"),
  searchSubmitBtn: document.getElementById("search-submit-btn"),
  searchResults: document.getElementById("search-results"),
  patientsList: document.getElementById("patients-list"),

  // Email form
  emailForm: document.getElementById("email-form"),
  emailRecipient: document.getElementById("email-recipient"),
  includeReport: document.getElementById("include-report"),
  includeMask: document.getElementById("include-mask"),
  emailMessage: document.getElementById("email-message"),
  sendEmailBtn: document.getElementById("send-email-btn"),
};

// ===== Utility Functions =====
function setStatus(text, mode) {
  elements.statusBadge.textContent = text;
  elements.statusBadge.className = "badge border";

  if (mode === "running") {
    elements.statusBadge.classList.add(
      "bg-warning-subtle",
      "text-warning-emphasis",
      "border-warning-subtle"
    );
    elements.statusSpinner.classList.remove("d-none");
  } else if (mode === "done") {
    elements.statusBadge.classList.add(
      "bg-success-subtle",
      "text-success-emphasis",
      "border-success-subtle"
    );
    elements.statusSpinner.classList.add("d-none");
  } else if (mode === "error") {
    elements.statusBadge.classList.add(
      "bg-danger-subtle",
      "text-danger-emphasis",
      "border-danger-subtle"
    );
    elements.statusSpinner.classList.add("d-none");
  } else {
    elements.statusBadge.classList.add(
      "bg-secondary-subtle",
      "text-secondary-emphasis",
      "border-secondary-subtle"
    );
    elements.statusSpinner.classList.add("d-none");
  }
}

function showAlert(message, type = "info") {
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

  // Insert at top of main content
  const main = document.querySelector("main");
  main.insertBefore(alertDiv, main.firstChild);

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}

async function apiCall(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "API request failed");
    }

    return data;
  } catch (error) {
    console.error("API call failed:", error);
    throw error;
  }
}

// ===== Patient Management =====
async function loadPatient(patientId) {
  if (!patientId.trim()) {
    showAlert("Please enter a patient ID", "warning");
    return;
  }

  try {
    setStatus("Loading patient...", "running");
    const patient = await apiCall(`/patients/${patientId}`);

    currentState.currentPatient = patient;
    displayPatientInfo(patient);
    loadPatientScans(patient.scans || []);
    loadPatientResults(patient.segmentation_results || []);

    setStatus("Patient loaded", "done");
    showAlert(`Patient ${patient.name} loaded successfully`, "success");
  } catch (error) {
    setStatus("Error", "error");
    showAlert(`Failed to load patient: ${error.message}`, "danger");
    clearPatientInfo();
  }
}

function displayPatientInfo(patient) {
  elements.patientNameLabel.textContent = patient.name || "N/A";
  elements.patientAgeLabel.textContent = patient.age || "-";
  elements.patientSexLabel.textContent = patient.sex || "-";
  elements.patientEmailLabel.textContent = patient.email || "-";
  elements.patientEmailLabel.title = patient.email || "";
  elements.patientScansCount.textContent = (patient.scans || []).length;
  elements.patientInfo.classList.remove("d-none");
}

function clearPatientInfo() {
  elements.patientInfo.classList.add("d-none");
  currentState.currentPatient = null;
  currentState.currentScan = null;
  currentState.currentResult = null;
  elements.scanSelectionSection.classList.add("d-none");
  clearImageViewer();
  clearResultsPanel();
}

function loadPatientScans(scans) {
  elements.scanSelect.innerHTML = '<option value="">Choose a scan...</option>';

  scans.forEach((scan, index) => {
    const option = document.createElement("option");
    option.value = scan.scan_id;
    option.textContent = `Scan ${index + 1} (${scan.scan_id.substring(
      0,
      8
    )}) - ${new Date(scan.upload_timestamp).toLocaleDateString()}`;
    elements.scanSelect.appendChild(option);
  });

  if (scans.length > 0) {
    elements.scanSelectionSection.classList.remove("d-none");
  }
}

function loadPatientResults(results) {
  if (results.length === 0) {
    elements.resultsHistory.innerHTML =
      '<div class="text-muted">No results yet</div>';
    return;
  }

  elements.resultsHistory.innerHTML = "";
  results.forEach((result, index) => {
    const resultDiv = document.createElement("div");
    resultDiv.className = "border rounded p-2 mb-2 cursor-pointer";
    resultDiv.innerHTML = `
            <div class="fw-semibold">Result ${index + 1}</div>
            <div class="small text-muted">
                ${new Date(
                  result.processing_timestamp
                ).toLocaleDateString()}<br>
                Volume: ${result.tumor_volume?.toFixed(2) || "N/A"} cm³
            </div>
        `;
    resultDiv.addEventListener("click", () => loadSegmentationResult(result));
    elements.resultsHistory.appendChild(resultDiv);
  });
}

// ===== Upload Management =====
function toggleUploadMethod() {
  if (elements.uploadIndividual.checked) {
    elements.individualUploadSection.classList.remove("d-none");
    elements.zipUploadSection.classList.add("d-none");
  } else {
    elements.individualUploadSection.classList.add("d-none");
    elements.zipUploadSection.classList.remove("d-none");
  }
}

async function uploadIndividualFiles() {
  if (!currentState.currentPatient) {
    showAlert("Please load a patient first", "warning");
    return;
  }

  const files = [
    elements.t1cFile.files[0],
    elements.t1nFile.files[0],
    elements.t2fFile.files[0],
    elements.t2wFile.files[0],
  ];

  if (files.some((f) => !f)) {
    showAlert("Please select all 4 MRI files", "warning");
    return;
  }

  try {
    setStatus("Uploading files...", "running");

    const formData = new FormData();
    formData.append("t1c", files[0]);
    formData.append("t1n", files[1]);
    formData.append("t2f", files[2]);
    formData.append("t2w", files[3]);

    const result = await apiCall(
      `/upload/files/${currentState.currentPatient.patient_id}`,
      {
        method: "POST",
        body: formData,
      }
    );

    setStatus("Files uploaded", "done");
    showAlert("Files uploaded successfully", "success");

    // Reload patient to update scan list
    await loadPatient(currentState.currentPatient.patient_id);

    // Clear form
    elements.uploadIndividualForm.reset();
  } catch (error) {
    setStatus("Upload failed", "error");
    showAlert(`Upload failed: ${error.message}`, "danger");
  }
}

async function uploadZipFile() {
  if (!currentState.currentPatient) {
    showAlert("Please load a patient first", "warning");
    return;
  }

  const zipFile = elements.zipFile.files[0];
  if (!zipFile) {
    showAlert("Please select a ZIP file", "warning");
    return;
  }

  try {
    setStatus("Uploading ZIP file...", "running");

    const formData = new FormData();
    formData.append("file", zipFile);

    const result = await apiCall(
      `/upload/zip/${currentState.currentPatient.patient_id}`,
      {
        method: "POST",
        body: formData,
      }
    );

    setStatus("ZIP uploaded", "done");
    showAlert("ZIP file uploaded successfully", "success");

    // Reload patient to update scan list
    await loadPatient(currentState.currentPatient.patient_id);

    // Clear form
    elements.uploadZipForm.reset();
  } catch (error) {
    setStatus("Upload failed", "error");
    showAlert(`Upload failed: ${error.message}`, "danger");
  }
}

// ===== Segmentation =====
async function runSegmentation() {
  if (!currentState.currentPatient || !elements.scanSelect.value) {
    showAlert("Please select a scan for segmentation", "warning");
    return;
  }

  try {
    setStatus("Running segmentation...", "running");

    const formData = new FormData();
    formData.append("radiologist_notes", elements.radiologistNotes.value || "");

    const result = await apiCall(
      `/segment/${currentState.currentPatient.patient_id}/${elements.scanSelect.value}`,
      {
        method: "POST",
        body: formData,
      }
    );

    setStatus("Segmentation complete", "done");
    showAlert("Segmentation completed successfully", "success");

    // Load the segmentation result
    currentState.currentResult = result.results;
    currentState.currentScan = elements.scanSelect.value;

    // Update UI
    displaySegmentationResults(result.results);
    enableActionButtons();

    // Reload patient to update results history
    await loadPatient(currentState.currentPatient.patient_id);
  } catch (error) {
    setStatus("Segmentation failed", "error");
    showAlert(`Segmentation failed: ${error.message}`, "danger");
  }
}

function displaySegmentationResults(result) {
  // Update summary panel
  elements.tumorVolumeLabel.textContent = result.tumor_volume
    ? `${result.tumor_volume.toFixed(2)} cm³`
    : "-";
  elements.confidenceLabel.textContent = result.confidence_score
    ? `${result.confidence_score.toFixed(1)}%`
    : "-";
  elements.currentRadiologistNotes.value = result.radiologist_notes || "";

  // Load slice images
  loadSliceImages(result.mri_slice_paths, result.overlay_slice_paths);
}

function loadSliceImages(mriPaths, overlayPaths) {
  // Convert absolute paths to relative web paths
  currentState.slices = mriPaths.map((path) => {
    if (path.includes("static/outputs")) {
      return "/" + path.split("static/outputs")[1].replace(/\\/g, "/");
    } else {
      return "/static/outputs/" + path.split("outputs")[1].replace(/\\/g, "/");
    }
  });

  currentState.overlays = overlayPaths.map((path) => {
    if (path.includes("static/outputs")) {
      return "/" + path.split("static/outputs")[1].replace(/\\/g, "/");
    } else {
      return "/static/outputs/" + path.split("outputs")[1].replace(/\\/g, "/");
    }
  });

  currentState.currentSliceIndex = 0;

  if (mriPaths.length > 0) {
    elements.numSlicesLabel.textContent = mriPaths.length;
    elements.sliceSlider.max = mriPaths.length - 1;
    elements.sliceSlider.value = 0;
    elements.sliceSlider.disabled = false;

    updateSliceDisplay();
    elements.placeholderText.classList.add("d-none");
  }
}

function updateSliceDisplay() {
  const sliceIndex = currentState.currentSliceIndex;
  elements.sliceLabel.textContent = `Slice ${sliceIndex + 1} / ${
    currentState.slices.length
  }`;

  if (currentState.slices[sliceIndex]) {
    elements.mriImage.src = currentState.slices[sliceIndex];
    elements.mriImage.classList.remove("d-none");

    if (currentState.overlays[sliceIndex] && elements.overlayToggle.checked) {
      elements.segOverlay.src = currentState.overlays[sliceIndex];
      elements.segOverlay.classList.remove("d-none");
      elements.segOverlay.style.opacity = elements.overlayOpacity.value / 100;
    } else {
      elements.segOverlay.classList.add("d-none");
    }
  }
}

function enableActionButtons() {
  elements.downloadMaskBtn.disabled = false;
  elements.downloadReportBtn.disabled = false;
  elements.emailBtn.disabled = false;
}

function clearImageViewer() {
  elements.mriImage.classList.add("d-none");
  elements.segOverlay.classList.add("d-none");
  elements.placeholderText.classList.remove("d-none");
  elements.sliceSlider.disabled = true;
  elements.sliceSlider.value = 0;
  elements.sliceSlider.max = 0;
  elements.sliceLabel.textContent = "Slice 0 / 0";

  currentState.slices = [];
  currentState.overlays = [];
  currentState.currentSliceIndex = 0;
}

function clearResultsPanel() {
  elements.tumorVolumeLabel.textContent = "-";
  elements.confidenceLabel.textContent = "-";
  elements.numSlicesLabel.textContent = "-";
  elements.currentRadiologistNotes.value = "";
  elements.resultsHistory.innerHTML =
    '<div class="text-muted">No results yet</div>';

  elements.downloadMaskBtn.disabled = true;
  elements.downloadReportBtn.disabled = true;
  elements.emailBtn.disabled = true;
}

// ===== Patient Registration =====
async function registerPatient() {
  const patientData = {
    patient_id: document.getElementById("reg-patient-id").value.trim(),
    name: document.getElementById("reg-name").value.trim(),
    age: document.getElementById("reg-age").value
      ? parseInt(document.getElementById("reg-age").value)
      : null,
    sex: document.getElementById("reg-sex").value || null,
    email: document.getElementById("reg-email").value.trim() || null,
    phone: document.getElementById("reg-phone").value.trim() || null,
    medical_record_number:
      document.getElementById("reg-mrn").value.trim() || null,
    date_of_birth: document.getElementById("reg-dob").value || null,
    attending_physician:
      document.getElementById("reg-physician").value.trim() || null,
    notes: document.getElementById("reg-notes").value.trim() || null,
  };

  if (!patientData.patient_id || !patientData.name) {
    showAlert("Patient ID and Name are required", "warning");
    return;
  }

  try {
    await apiCall("/patients/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patientData),
    });

    showAlert(`Patient ${patientData.name} registered successfully`, "success");

    // Close modal and load the new patient
    bootstrap.Modal.getInstance(elements.registerModal).hide();
    elements.currentPatientId.value = patientData.patient_id;
    await loadPatient(patientData.patient_id);

    // Reset form
    elements.registerForm.reset();
  } catch (error) {
    showAlert(`Registration failed: ${error.message}`, "danger");
  }
}

// ===== Patient Search =====
async function searchPatients() {
  const query = elements.searchInput.value.trim();
  const searchType = elements.searchType.value;

  if (!query) {
    showAlert("Please enter a search term", "warning");
    return;
  }

  try {
    const result = await apiCall("/patients/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, search_type: searchType }),
    });

    displaySearchResults(result.patients);
  } catch (error) {
    showAlert(`Search failed: ${error.message}`, "danger");
  }
}

function displaySearchResults(patients) {
  if (patients.length === 0) {
    elements.searchResults.innerHTML =
      '<div class="alert alert-info">No patients found</div>';
    return;
  }

  elements.searchResults.innerHTML = `
        <h6>Search Results (${patients.length})</h6>
        <div class="list-group">
            ${patients
              .map(
                (patient) => `
                <div class="list-group-item list-group-item-action" onclick="selectPatientFromSearch('${
                  patient.patient_id
                }')">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${patient.name}</h6>
                        <small>ID: ${patient.patient_id}</small>
                    </div>
                    <p class="mb-1">${patient.email || "No email"} | ${
                  patient.age || "Unknown age"
                } | ${patient.sex || "Unknown sex"}</p>
                    <small>${patient.scans?.length || 0} scans, ${
                  patient.segmentation_results?.length || 0
                } results</small>
                </div>
            `
              )
              .join("")}
        </div>
    `;
}

async function selectPatientFromSearch(patientId) {
  bootstrap.Modal.getInstance(elements.searchModal).hide();
  elements.currentPatientId.value = patientId;
  await loadPatient(patientId);
}

// ===== Patient List =====
async function loadAllPatients() {
  try {
    const result = await apiCall("/patients?limit=100");
    displayPatientsList(result.patients, result.total);
  } catch (error) {
    showAlert(`Failed to load patients: ${error.message}`, "danger");
  }
}

function displayPatientsList(patients, total) {
  if (patients.length === 0) {
    elements.patientsList.innerHTML =
      '<div class="alert alert-info">No patients found</div>';
    return;
  }

  elements.patientsList.innerHTML = `
        <div class="mb-3">
            <h6>All Patients (${total} total)</h6>
        </div>
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Patient ID</th>
                        <th>Name</th>
                        <th>Age</th>
                        <th>Sex</th>
                        <th>Email</th>
                        <th>Scans</th>
                        <th>Results</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${patients
                      .map(
                        (patient) => `
                        <tr>
                            <td>${patient.patient_id}</td>
                            <td>${patient.name}</td>
                            <td>${patient.age || "-"}</td>
                            <td>${patient.sex || "-"}</td>
                            <td class="text-truncate" style="max-width: 150px;">${
                              patient.email || "-"
                            }</td>
                            <td>${patient.scans?.length || 0}</td>
                            <td>${
                              patient.segmentation_results?.length || 0
                            }</td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary" onclick="selectPatientFromList('${
                                  patient.patient_id
                                }')">
                                    Select
                                </button>
                            </td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
    `;
}

async function selectPatientFromList(patientId) {
  bootstrap.Modal.getInstance(elements.patientsModal).hide();
  elements.currentPatientId.value = patientId;
  await loadPatient(patientId);
}

// ===== Email Functionality =====
async function sendResultsEmail() {
  if (!currentState.currentPatient || !currentState.currentResult) {
    showAlert("No patient or results selected", "warning");
    return;
  }

  const emailData = {
    recipient_email: elements.emailRecipient.value.trim() || null,
    include_report: elements.includeReport.checked,
    include_mask: elements.includeMask.checked,
    custom_message: elements.emailMessage.value.trim() || null,
  };

  try {
    await apiCall(
      `/email/${currentState.currentPatient.patient_id}/${currentState.currentScan}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailData),
      }
    );

    showAlert("Email sent successfully", "success");
    bootstrap.Modal.getInstance(elements.emailModal).hide();
    elements.emailForm.reset();
  } catch (error) {
    showAlert(`Failed to send email: ${error.message}`, "danger");
  }
}

// ===== Download Functions =====
async function downloadMask() {
  if (!currentState.currentPatient || !currentState.currentScan) {
    showAlert("No patient or scan selected", "warning");
    return;
  }

  try {
    const url = `/download/mask/${currentState.currentPatient.patient_id}/${currentState.currentScan}`;
    window.open(url, "_blank");
  } catch (error) {
    showAlert(`Download failed: ${error.message}`, "danger");
  }
}

async function downloadReport() {
  if (!currentState.currentPatient || !currentState.currentScan) {
    showAlert("No patient or scan selected", "warning");
    return;
  }

  try {
    const url = `/download/report/${currentState.currentPatient.patient_id}/${currentState.currentScan}`;
    window.open(url, "_blank");
  } catch (error) {
    showAlert(`Download failed: ${error.message}`, "danger");
  }
}

// ===== Load Segmentation Result =====
async function loadSegmentationResult(result) {
  currentState.currentResult = result;
  currentState.currentScan = result.scan_id;

  displaySegmentationResults(result);
  enableActionButtons();
}

// ===== Event Listeners =====
document.addEventListener("DOMContentLoaded", function () {
  // Navigation events
  elements.showRegisterBtn?.addEventListener("click", () => {
    new bootstrap.Modal(elements.registerModal).show();
  });

  elements.showSearchBtn?.addEventListener("click", () => {
    new bootstrap.Modal(elements.searchModal).show();
  });

  elements.showPatientsBtn?.addEventListener("click", () => {
    loadAllPatients();
    new bootstrap.Modal(elements.patientsModal).show();
  });

  // Patient loading
  elements.loadPatientBtn?.addEventListener("click", () => {
    loadPatient(elements.currentPatientId.value);
  });

  elements.currentPatientId?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      loadPatient(elements.currentPatientId.value);
    }
  });

  // Upload method toggle
  elements.uploadIndividual?.addEventListener("change", toggleUploadMethod);
  elements.uploadZip?.addEventListener("change", toggleUploadMethod);

  // Form submissions
  elements.uploadIndividualForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    uploadIndividualFiles();
  });

  elements.uploadZipForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    uploadZipFile();
  });

  elements.runSegmentationBtn?.addEventListener("click", runSegmentation);

  // Modal form submissions
  elements.registerSubmitBtn?.addEventListener("click", registerPatient);
  elements.searchSubmitBtn?.addEventListener("click", searchPatients);
  elements.sendEmailBtn?.addEventListener("click", sendResultsEmail);

  // Image viewer controls
  elements.sliceSlider?.addEventListener("input", (e) => {
    currentState.currentSliceIndex = parseInt(e.target.value);
    updateSliceDisplay();
  });

  elements.overlayToggle?.addEventListener("change", updateSliceDisplay);
  elements.overlayOpacity?.addEventListener("input", updateSliceDisplay);

  // Action buttons
  elements.downloadMaskBtn?.addEventListener("click", downloadMask);
  elements.downloadReportBtn?.addEventListener("click", downloadReport);
  elements.emailBtn?.addEventListener("click", () => {
    if (currentState.currentPatient?.email) {
      elements.emailRecipient.value = currentState.currentPatient.email;
    }
    new bootstrap.Modal(elements.emailModal).show();
  });

  // Search on enter key
  elements.searchInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      searchPatients();
    }
  });

  // Initialize
  setStatus("Ready", "idle");
  console.log("Glioma AI Workstation initialized");
});

// ===== Global Functions (for onclick handlers) =====
window.selectPatientFromSearch = selectPatientFromSearch;
window.selectPatientFromList = selectPatientFromList;
