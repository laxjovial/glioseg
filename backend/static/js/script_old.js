// Enhanced Glioma AI Workstation Frontend
// ===== Global State Management =====
let currentState = {
    currentPatient: null,
    currentScan: null,
    currentResult: null,
    slices: [],
    overlays: [],
    currentSliceIndex: 0
};

// ===== DOM Element References =====
const elements = {
    // Navigation buttons
    showRegisterBtn: document.getElementById('show-register-btn'),
    showSearchBtn: document.getElementById('show-search-btn'),
    showPatientsBtn: document.getElementById('show-patients-btn'),
    
    // Patient selection
    currentPatientId: document.getElementById('current-patient-id'),
    loadPatientBtn: document.getElementById('load-patient-btn'),
    patientInfo: document.getElementById('patient-info'),
    patientNameLabel: document.getElementById('patient-name-label'),
    patientAgeLabel: document.getElementById('patient-age-label'),
    patientSexLabel: document.getElementById('patient-sex-label'),
    patientEmailLabel: document.getElementById('patient-email-label'),
    patientScansCount: document.getElementById('patient-scans-count'),
    
    // Upload controls
    uploadIndividual: document.getElementById('upload-individual'),
    uploadZip: document.getElementById('upload-zip'),
    individualUploadSection: document.getElementById('individual-upload-section'),
    zipUploadSection: document.getElementById('zip-upload-section'),
    
    // Individual upload
    uploadIndividualForm: document.getElementById('upload-individual-form'),
    t1cFile: document.getElementById('t1c_file'),
    t1nFile: document.getElementById('t1n_file'),
    t2fFile: document.getElementById('t2f_file'),
    t2wFile: document.getElementById('t2w_file'),
    
    // Zip upload
    uploadZipForm: document.getElementById('upload-zip-form'),
    zipFile: document.getElementById('zip_file'),
    
    // Scan selection and segmentation
    scanSelectionSection: document.getElementById('scan-selection-section'),
    scanSelect: document.getElementById('scan-select'),
    radiologistNotes: document.getElementById('radiologist-notes'),
    runSegmentationBtn: document.getElementById('run-segmentation-btn'),
    
    // Status
    statusBadge: document.getElementById('status-badge'),
    statusSpinner: document.getElementById('status-spinner'),
    
    // Image viewer
    sliceSlider: document.getElementById('slice-slider'),
    sliceLabel: document.getElementById('slice-label'),
    overlayToggle: document.getElementById('toggle-overlay'),
    overlayOpacity: document.getElementById('overlay-opacity'),
    mriImage: document.getElementById('mri-image'),
    segOverlay: document.getElementById('segmentation-overlay'),
    placeholderText: document.getElementById('placeholder-text'),
    
    // Results panel
    tumorVolumeLabel: document.getElementById('tumor-volume-label'),
    confidenceLabel: document.getElementById('confidence-label'),
    numSlicesLabel: document.getElementById('num-slices-label'),
    currentRadiologistNotes: document.getElementById('current-radiologist-notes'),
    resultsHistory: document.getElementById('results-history'),
    
    // Action buttons
    downloadMaskBtn: document.getElementById('download-mask-btn'),
    downloadReportBtn: document.getElementById('download-report-btn'),
    emailBtn: document.getElementById('email-btn'),
    
    // Modals
    registerModal: document.getElementById('registerModal'),
    searchModal: document.getElementById('searchModal'),
    patientsModal: document.getElementById('patientsModal'),
    emailModal: document.getElementById('emailModal'),
    
    // Modal forms
    registerForm: document.getElementById('register-form'),
    registerSubmitBtn: document.getElementById('register-submit-btn'),
    searchInput: document.getElementById('search-input'),
    searchType: document.getElementById('search-type'),
    searchSubmitBtn: document.getElementById('search-submit-btn'),
    searchResults: document.getElementById('search-results'),
    patientsList: document.getElementById('patients-list'),
    
    // Email form
    emailForm: document.getElementById('email-form'),
    emailRecipient: document.getElementById('email-recipient'),
    includeReport: document.getElementById('include-report'),
    includeMask: document.getElementById('include-mask'),
    emailMessage: document.getElementById('email-message'),
    sendEmailBtn: document.getElementById('send-email-btn')
};

// ===== Utility Functions =====
function setStatus(text, mode) {
    elements.statusBadge.textContent = text;
    elements.statusBadge.className = "badge border";

    if (mode === "running") {
        elements.statusBadge.classList.add("bg-warning-subtle", "text-warning-emphasis", "border-warning-subtle");
        elements.statusSpinner.classList.remove("d-none");
    } else if (mode === "done") {
        elements.statusBadge.classList.add("bg-success-subtle", "text-success-emphasis", "border-success-subtle");
        elements.statusSpinner.classList.add("d-none");
    } else if (mode === "error") {
        elements.statusBadge.classList.add("bg-danger-subtle", "text-danger-emphasis", "border-danger-subtle");
        elements.statusSpinner.classList.add("d-none");
    } else {
        elements.statusBadge.classList.add("bg-secondary-subtle", "text-secondary-emphasis", "border-secondary-subtle");
        elements.statusSpinner.classList.add("d-none");
    }
}

function showAlert(message, type = "info") {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Insert at top of main content
    const main = document.querySelector('main');
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
            throw new Error(data.detail || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// ===== Patient Management =====
async function loadPatient(patientId) {
    if (!patientId.trim()) {
        showAlert('Please enter a patient ID', 'warning');
        return;
    }
    
    try {
        setStatus('Loading patient...', 'running');
        const patient = await apiCall(`/patients/${patientId}`);
        
        currentState.currentPatient = patient;
        displayPatientInfo(patient);
        loadPatientScans(patient.scans || []);
        loadPatientResults(patient.segmentation_results || []);
        
        setStatus('Patient loaded', 'done');
        showAlert(`Patient ${patient.name} loaded successfully`, 'success');
        
    } catch (error) {
        setStatus('Error', 'error');
        showAlert(`Failed to load patient: ${error.message}`, 'danger');
        clearPatientInfo();
    }
}

function displayPatientInfo(patient) {
    elements.patientNameLabel.textContent = patient.name || 'N/A';
    elements.patientAgeLabel.textContent = patient.age || '-';
    elements.patientSexLabel.textContent = patient.sex || '-';
    elements.patientEmailLabel.textContent = patient.email || '-';
    elements.patientEmailLabel.title = patient.email || '';
    elements.patientScansCount.textContent = (patient.scans || []).length;
    elements.patientInfo.classList.remove('d-none');
}

function clearPatientInfo() {
    elements.patientInfo.classList.add('d-none');
    currentState.currentPatient = null;
    currentState.currentScan = null;
    currentState.currentResult = null;
    elements.scanSelectionSection.classList.add('d-none');
    clearImageViewer();
    clearResultsPanel();
}

function loadPatientScans(scans) {
    elements.scanSelect.innerHTML = '<option value="">Choose a scan...</option>';
    
    scans.forEach((scan, index) => {
        const option = document.createElement('option');
        option.value = scan.scan_id;
        option.textContent = `Scan ${index + 1} (${scan.scan_id.substring(0, 8)}) - ${new Date(scan.upload_timestamp).toLocaleDateString()}`;
        elements.scanSelect.appendChild(option);
    });
    
    if (scans.length > 0) {
        elements.scanSelectionSection.classList.remove('d-none');
    }
}

function loadPatientResults(results) {
    if (results.length === 0) {
        elements.resultsHistory.innerHTML = '<div class="text-muted">No results yet</div>';
        return;
    }
    
    elements.resultsHistory.innerHTML = '';
    results.forEach((result, index) => {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'border rounded p-2 mb-2 cursor-pointer';
        resultDiv.innerHTML = `
            <div class="fw-semibold">Result ${index + 1}</div>
            <div class="small text-muted">
                ${new Date(result.processing_timestamp).toLocaleDateString()}<br>
                Volume: ${result.tumor_volume?.toFixed(2) || 'N/A'} cm³
            </div>
        `;
        resultDiv.addEventListener('click', () => loadSegmentationResult(result));
        elements.resultsHistory.appendChild(resultDiv);
    });
}

// ===== Upload Management =====
function toggleUploadMethod() {
    if (elements.uploadIndividual.checked) {
        elements.individualUploadSection.classList.remove('d-none');
        elements.zipUploadSection.classList.add('d-none');
    } else {
        elements.individualUploadSection.classList.add('d-none');
        elements.zipUploadSection.classList.remove('d-none');
    }
}

async function uploadIndividualFiles() {
    if (!currentState.currentPatient) {
        showAlert('Please load a patient first', 'warning');
        return;
    }
    
    const files = [
        elements.t1cFile.files[0],
        elements.t1nFile.files[0],
        elements.t2fFile.files[0],
        elements.t2wFile.files[0]
    ];
    
    if (files.some(f => !f)) {
        showAlert('Please select all 4 MRI files', 'warning');
        return;
    }
    
    try {
        setStatus('Uploading files...', 'running');
        
        const formData = new FormData();
        formData.append('t1c', files[0]);
        formData.append('t1n', files[1]);
        formData.append('t2f', files[2]);
        formData.append('t2w', files[3]);
        
        const result = await apiCall(`/upload/files/${currentState.currentPatient.patient_id}`, {
            method: 'POST',
            body: formData
        });
        
        setStatus('Files uploaded', 'done');
        showAlert('Files uploaded successfully', 'success');
        
        // Reload patient to update scan list
        await loadPatient(currentState.currentPatient.patient_id);
        
        // Clear form
        elements.uploadIndividualForm.reset();
        
    } catch (error) {
        setStatus('Upload failed', 'error');
        showAlert(`Upload failed: ${error.message}`, 'danger');
    }
}

async function uploadZipFile() {
    if (!currentState.currentPatient) {
        showAlert('Please load a patient first', 'warning');
        return;
    }
    
    const zipFile = elements.zipFile.files[0];
    if (!zipFile) {
        showAlert('Please select a ZIP file', 'warning');
        return;
    }
    
    try {
        setStatus('Uploading ZIP file...', 'running');
        
        const formData = new FormData();
        formData.append('file', zipFile);
        
        const result = await apiCall(`/upload/zip/${currentState.currentPatient.patient_id}`, {
            method: 'POST',
            body: formData
        });
        
        setStatus('ZIP uploaded', 'done');
        showAlert('ZIP file uploaded successfully', 'success');
        
        // Reload patient to update scan list
        await loadPatient(currentState.currentPatient.patient_id);
        
        // Clear form
        elements.uploadZipForm.reset();
        
    } catch (error) {
        setStatus('Upload failed', 'error');
        showAlert(`Upload failed: ${error.message}`, 'danger');
    }
}
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
