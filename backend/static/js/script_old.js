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
    sendEmailBtn: document.getElementById('send-email-btn'),

    // Form elements for generic upload section (if used)
    genericForm: document.getElementById('upload-form'),
    imageFile: document.getElementById('image-file'),
    runBtn: document.getElementById('run-btn'),
    patientIdLabel: document.getElementById('patient-id-label'),
    patientEmail: document.getElementById('patient-email'),
    resetBtn: document.getElementById('reset-btn')
};

// ===== Utility Functions =====
function setStatus(text, mode) {
    const { statusBadge, statusSpinner } = elements;
    statusBadge.textContent = text;
    statusBadge.className = "badge border";

    switch (mode) {
        case "running":
            statusBadge.classList.add("bg-warning-subtle", "text-warning-emphasis", "border-warning-subtle");
            statusSpinner.classList.remove("d-none");
            break;
        case "done":
            statusBadge.classList.add("bg-success-subtle", "text-success-emphasis", "border-success-subtle");
            statusSpinner.classList.add("d-none");
            break;
        case "error":
            statusBadge.classList.add("bg-danger-subtle", "text-danger-emphasis", "border-danger-subtle");
            statusSpinner.classList.add("d-none");
            break;
        default:
            statusBadge.classList.add("bg-secondary-subtle", "text-secondary-emphasis", "border-secondary-subtle");
            statusSpinner.classList.add("d-none");
    }
}

function showAlert(message, type = "info") {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('main').insertBefore(alertDiv, document.querySelector('main').firstChild);

    setTimeout(() => alertDiv.remove(), 5000);
}

async function apiCall(url, options = {}) {
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'API request failed');
        return data;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// ===== Patient Management =====
async function loadPatient(patientId) {
    if (!patientId?.trim()) {
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
    const e = elements;
    e.patientNameLabel.textContent = patient.name || 'N/A';
    e.patientAgeLabel.textContent = patient.age || '-';
    e.patientSexLabel.textContent = patient.sex || '-';
    e.patientEmailLabel.textContent = patient.email || '-';
    e.patientEmailLabel.title = patient.email || '';
    e.patientScansCount.textContent = (patient.scans || []).length;
    e.patientInfo.classList.remove('d-none');
}

function clearPatientInfo() {
    const e = elements;
    e.patientInfo.classList.add('d-none');
    currentState.currentPatient = null;
    currentState.currentScan = null;
    currentState.currentResult = null;
    e.scanSelectionSection.classList.add('d-none');
    clearImageViewer();
    clearResultsPanel();
    currentState.slices = [];
    currentState.overlays = [];
}

function loadPatientScans(scans) {
    const e = elements;
    e.scanSelect.innerHTML = '<option value="">Choose a scan...</option>';
    scans.forEach((scan, index) => {
        const option = document.createElement('option');
        option.value = scan.scan_id;
        option.textContent = `Scan ${index + 1} (${scan.scan_id.substring(0, 8)}) - ${new Date(scan.upload_timestamp).toLocaleDateString()}`;
        e.scanSelect.appendChild(option);
    });
    if (scans.length) e.scanSelectionSection.classList.remove('d-none');
}

function loadPatientResults(results) {
    const e = elements;
    if (!results.length) {
        e.resultsHistory.innerHTML = '<div class="text-muted">No results yet</div>';
        return;
    }

    e.resultsHistory.innerHTML = '';
    results.forEach((result, index) => {
        const div = document.createElement('div');
        div.className = 'border rounded p-2 mb-2 cursor-pointer';
        div.innerHTML = `
            <div class="fw-semibold">Result ${index + 1}</div>
            <div class="small text-muted">
                ${new Date(result.processing_timestamp).toLocaleDateString()}<br>
                Volume: ${result.tumor_volume?.toFixed(2) || 'N/A'} cm³
            </div>
        `;
        div.addEventListener('click', () => loadSegmentationResult(result));
        e.resultsHistory.appendChild(div);
    });
}

// ===== Upload Management =====
function toggleUploadMethod() {
    const e = elements;
    if (e.uploadIndividual.checked) {
        e.individualUploadSection.classList.remove('d-none');
        e.zipUploadSection.classList.add('d-none');
    } else {
        e.individualUploadSection.classList.add('d-none');
        e.zipUploadSection.classList.remove('d-none');
    }
}

async function uploadIndividualFiles() {
    const e = elements;
    if (!currentState.currentPatient) {
        showAlert('Please load a patient first', 'warning');
        return;
    }

    const files = [e.t1cFile.files[0], e.t1nFile.files[0], e.t2fFile.files[0], e.t2wFile.files[0]];
    if (files.some(f => !f)) {
        showAlert('Please select all 4 MRI files', 'warning');
        return;
    }

    try {
        setStatus('Uploading files...', 'running');
        const formData = new FormData();
        ['t1c', 't1n', 't2f', 't2w'].forEach((name, i) => formData.append(name, files[i]));

        await apiCall(`/upload/files/${currentState.currentPatient.patient_id}`, { method: 'POST', body: formData });

        setStatus('Files uploaded', 'done');
        showAlert('Files uploaded successfully', 'success');
        await loadPatient(currentState.currentPatient.patient_id);
        e.uploadIndividualForm.reset();
    } catch (error) {
        setStatus('Upload failed', 'error');
        showAlert(`Upload failed: ${error.message}`, 'danger');
    }
}

async function uploadZipFile() {
    const e = elements;
    if (!currentState.currentPatient) {
        showAlert('Please load a patient first', 'warning');
        return;
    }

    const zipFile = e.zipFile.files[0];
    if (!zipFile) {
        showAlert('Please select a ZIP file', 'warning');
        return;
    }

    try {
        setStatus('Uploading ZIP file...', 'running');
        const formData = new FormData();
        formData.append('file', zipFile);

        await apiCall(`/upload/zip/${currentState.currentPatient.patient_id}`, { method: 'POST', body: formData });

        setStatus('ZIP uploaded', 'done');
        showAlert('ZIP file uploaded successfully', 'success');
        await loadPatient(currentState.currentPatient.patient_id);
        e.uploadZipForm.reset();
    } catch (error) {
        setStatus('Upload failed', 'error');
        showAlert(`Upload failed: ${error.message}`, 'danger');
    }
}

// ===== Slice Viewer =====
function updateSlice(index) {
    if (!currentState.slices.length) return;

    const total = currentState.slices.length;
    const safeIndex = Math.min(Math.max(index, 0), total - 1);
    currentState.currentSliceIndex = safeIndex;

    const e = elements;
    e.sliceSlider.value = safeIndex;
    e.sliceLabel.textContent = `Slice ${safeIndex + 1} / ${total}`;
    e.mriImage.src = currentState.slices[safeIndex];
    e.segOverlay.src = currentState.overlays[safeIndex];

    e.mriImage.classList.remove('d-none');
    e.segOverlay.classList.remove('d-none');
    e.placeholderText.classList.add('d-none');
}

// ===== Image Viewer Controls =====
elements.sliceSlider.addEventListener('input', () => updateSlice(parseInt(elements.sliceSlider.value) || 0));

elements.overlayToggle.addEventListener('change', () => {
    if (elements.overlayToggle.checked) elements.segOverlay.classList.remove('d-none');
    else elements.segOverlay.classList.add('d-none');
});

elements.overlayOpacity.addEventListener('input', () => {
    elements.segOverlay.style.opacity = elements.overlayOpacity.value / 100;
});

// ===== Reset Patient State =====
function resetPatientState() {
    const e = elements;
    e.genericForm?.reset();
    setStatus("Idle", "idle");

    ['tumorVolumeLabel','confidenceLabel','numSlicesLabel','patientIdLabel','patientAgeLabel','patientSexLabel']
        .forEach(id => e[id].textContent = id.includes('Label') ? '-' : 'N/A');

    e.sliceSlider.disabled = true;
    e.sliceSlider.max = 0;
    e.sliceSlider.value = 0;
    e.sliceLabel.textContent = "Slice 0 / 0";

    currentState.slices = [];
    currentState.overlays = [];
    currentState.currentPatient = null;
    currentState.currentScan = null;
    currentState.currentResult = null;
    currentState.currentSliceIndex = 0;

    e.mriImage.classList.add('d-none');
    e.segOverlay.classList.add('d-none');
    e.placeholderText.classList.remove('d-none');

    ['downloadMaskBtn','downloadReportBtn','emailBtn'].forEach(btn => e[btn].disabled = true);
}
elements.resetBtn.addEventListener('click', resetPatientState);

// ===== Download & Email Buttons =====
elements.downloadMaskBtn.addEventListener('click', () => {
    if (currentState.currentPatient?.patient_id && currentState.currentScan) {
        window.location.href = `/download/mask/${currentState.currentPatient.patient_id}/${currentState.currentScan}`;
    } else showAlert("No segmentation mask available to download.", "warning");
});

elements.downloadReportBtn.addEventListener('click', () => showAlert("Report generation is not yet implemented.", "info"));

elements.emailBtn.addEventListener('click', async () => {
    if (!currentState.currentPatient?.patient_id || currentState.currentScan == null) {
        showAlert("No segmentation results available to email.", "warning");
        return;
    }
    try {
        const res = await fetch(`/email/${currentState.currentPatient.patient_id}/${currentState.currentScan}`, { method: "POST" });
        if (res.ok) showAlert("Email sent successfully!", "success");
        else showAlert("Failed to send email.", "danger");
    } catch (err) {
        console.error(err);
        showAlert("An error occurred while sending the email.", "danger");
    }
});
