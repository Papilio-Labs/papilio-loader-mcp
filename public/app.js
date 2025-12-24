// API base URL
const API_BASE = window.location.origin;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    loadPorts();
    setupTabs();
    setupDragAndDrop();
    setupForms();
});

// Tab switching
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const device = tab.dataset.device;

            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show corresponding section
            document.querySelectorAll('.upload-section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(`${device}-section`).classList.add('active');
        });
    });
}

// Load available serial ports
async function loadPorts() {
    try {
        const response = await fetch(`${API_BASE}/api/ports`);
        const data = await response.json();

        if (data.success) {
            const fpgaPort = document.getElementById('fpga-port');
            const esp32Port = document.getElementById('esp32-port');

            // Clear existing options except the first one
            fpgaPort.innerHTML = '<option value="">Select a port...</option>';
            esp32Port.innerHTML = '<option value="">Select a port...</option>';

            // Add port options
            data.ports.forEach(port => {
                const option = document.createElement('option');
                option.value = port.path;
                option.textContent = `${port.path} - ${port.manufacturer}`;
                fpgaPort.appendChild(option.cloneNode(true));
                esp32Port.appendChild(option);
            });

            if (data.ports.length === 0) {
                showAlert('No serial ports found. Please connect your Papilio board.', 'error');
            }
        }
    } catch (error) {
        showAlert('Failed to load serial ports: ' + error.message, 'error');
    }
}

// Setup drag and drop
function setupDragAndDrop() {
    const dropZones = [
        { zone: 'fpga-drop-zone', input: 'fpga-file', info: 'fpga-file-info' },
        { zone: 'esp32-drop-zone', input: 'esp32-file', info: 'esp32-file-info' }
    ];

    dropZones.forEach(({ zone, input, info }) => {
        const dropZone = document.getElementById(zone);
        const fileInput = document.getElementById(input);
        const fileInfo = document.getElementById(info);

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Highlight drop zone when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            }, false);
        });

        // Handle dropped files
        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            fileInput.files = files;
            updateFileInfo(files[0], fileInfo);
        }, false);

        // Handle file selection via click
        fileInput.addEventListener('change', (e) => {
            updateFileInfo(e.target.files[0], fileInfo);
        });
    });
}

// Update file info display
function updateFileInfo(file, infoElement) {
    if (file) {
        const size = (file.size / 1024).toFixed(2);
        infoElement.textContent = `Selected: ${file.name} (${size} KB)`;
    } else {
        infoElement.textContent = '';
    }
}

// Setup form submissions
function setupForms() {
    // FPGA form
    document.getElementById('fpga-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const port = document.getElementById('fpga-port').value;
        const file = document.getElementById('fpga-file').files[0];

        if (!port || !file) {
            showAlert('Please select a port and file', 'error');
            return;
        }

        await uploadFirmware('fpga', port, file);
    });

    // ESP32 form
    document.getElementById('esp32-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const port = document.getElementById('esp32-port').value;
        const file = document.getElementById('esp32-file').files[0];
        const address = document.getElementById('esp32-address').value;

        if (!port || !file) {
            showAlert('Please select a port and file', 'error');
            return;
        }

        await uploadFirmware('esp32', port, file, address);
    });
}

// Upload firmware
async function uploadFirmware(deviceType, port, file, address = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('port', port);

    if (address) {
        formData.append('address', address);
    }

    // Show loading
    showLoading(true);
    hideAlert();

    try {
        const response = await fetch(`${API_BASE}/api/upload/${deviceType}`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showAlert(data.message, 'success');
        } else {
            showAlert('Upload failed: ' + data.error, 'error');
        }
    } catch (error) {
        showAlert('Upload failed: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Show/hide loading indicator
function showLoading(show) {
    const loading = document.getElementById('loading');
    const uploadBtns = document.querySelectorAll('.upload-btn');

    if (show) {
        loading.classList.add('show');
        uploadBtns.forEach(btn => btn.disabled = true);
    } else {
        loading.classList.remove('show');
        uploadBtns.forEach(btn => btn.disabled = false);
    }
}

// Show alert message
function showAlert(message, type) {
    const alert = document.getElementById('alert');
    alert.textContent = message;
    alert.className = `alert ${type} show`;

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            hideAlert();
        }, 5000);
    }
}

// Hide alert
function hideAlert() {
    const alert = document.getElementById('alert');
    alert.classList.remove('show');
}
