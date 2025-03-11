// Connect to Socket.io server
const socket = io();

// DOM Elements
const portSelect = document.getElementById('port-select');
const baudRateSelect = document.getElementById('baud-rate');
const dataBitsSelect = document.getElementById('data-bits');
const paritySelect = document.getElementById('parity');
const stopBitsSelect = document.getElementById('stop-bits');
const connectButton = document.getElementById('connect-button');
const disconnectButton = document.getElementById('disconnect-button');
const refreshPortsButton = document.getElementById('refresh-ports');
const clearLogButton = document.getElementById('clear-log');
const saveLogButton = document.getElementById('save-log');
const autoscrollCheckbox = document.getElementById('autoscroll');
const timestampCheckbox = document.getElementById('timestamp');
const logWindow = document.getElementById('log-window');
const connectionStatus = document.getElementById('connection-status');
const notification = document.getElementById('notification');

// State variables
let isConnected = false;
let logEntries = [];

// Initialize the application
function init() {
    // Fetch available ports when the page loads
    refreshPorts();
    
    // Load default settings
    loadDefaultSettings();
    
    // Set up event listeners
    connectButton.addEventListener('click', connectToPort);
    disconnectButton.addEventListener('click', disconnectFromPort);
    refreshPortsButton.addEventListener('click', refreshPorts);
    clearLogButton.addEventListener('click', clearLog);
    saveLogButton.addEventListener('click', saveLog);
    
    // Set up socket event listeners
    setupSocketListeners();
}

// Set up Socket.io event listeners
function setupSocketListeners() {
    // Listen for available ports
    socket.on('ports', (ports) => {
        updatePortList(ports);
    });
    
    // Listen for serial data
    socket.on('serial-data', (data) => {
        console.log('Received serial data:', data);
        addLogEntry(data.timestamp, data.data);
    });
    
    // Listen for connection status updates
    socket.on('connection-status', (status) => {
        console.log('Connection status update:', status);
        updateConnectionStatus(status);
    });
    
    // Listen for errors
    socket.on('error', (error) => {
        console.error('Error received:', error);
        showNotification(error.message, 'error');
    });
    
    // Log socket connection status
    socket.on('connect', () => {
        console.log('Socket connected to server');
    });
    
    socket.on('disconnect', () => {
        console.log('Socket disconnected from server');
    });
}

// Refresh the list of available ports
function refreshPorts() {
    fetch('/ports')
        .then(response => response.json())
        .then(ports => {
            updatePortList(ports);
        })
        .catch(error => {
            console.error('Error fetching ports:', error);
            showNotification('Failed to fetch ports', 'error');
        });
}

// Update the port selection dropdown
function updatePortList(ports) {
    // Clear existing options except the placeholder
    while (portSelect.options.length > 1) {
        portSelect.remove(1);
    }
    
    // Add ports to the dropdown
    ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port.path;
        
        // Create a descriptive label
        let label = port.path;
        if (port.manufacturer) {
            label += ` (${port.manufacturer}`;
            if (port.serialNumber) {
                label += ` - ${port.serialNumber}`;
            }
            label += ')';
        }
        
        option.textContent = label;
        
        // Highlight FTDI devices
        if (port.manufacturer && port.manufacturer.toLowerCase().includes('ftdi')) {
            option.style.fontWeight = 'bold';
            option.style.color = '#0072ff';
        }
        
        portSelect.appendChild(option);
    });
    
    // Always enable the connect button when ports are available
    connectButton.disabled = false;
    
    // Show notification if no ports found
    if (ports.length === 0) {
        showNotification('No serial ports found', 'error');
    }
}

// Load default settings from server
function loadDefaultSettings() {
    // Ensure the connect button is enabled by default
    connectButton.disabled = false;
    
    fetch('/default-settings')
        .then(response => response.json())
        .then(settings => {
            // Pre-select the default port if it exists in the dropdown
            for (let i = 0; i < portSelect.options.length; i++) {
                if (portSelect.options[i].value === settings.defaultPort) {
                    portSelect.selectedIndex = i;
                    break;
                }
            }
            
            // Set default values for other settings
            for (let i = 0; i < baudRateSelect.options.length; i++) {
                if (parseInt(baudRateSelect.options[i].value) === settings.defaultBaudRate) {
                    baudRateSelect.selectedIndex = i;
                    break;
                }
            }
            
            for (let i = 0; i < dataBitsSelect.options.length; i++) {
                if (parseInt(dataBitsSelect.options[i].value) === settings.defaultDataBits) {
                    dataBitsSelect.selectedIndex = i;
                    break;
                }
            }
            
            for (let i = 0; i < paritySelect.options.length; i++) {
                if (paritySelect.options[i].value === settings.defaultParity) {
                    paritySelect.selectedIndex = i;
                    break;
                }
            }
            
            for (let i = 0; i < stopBitsSelect.options.length; i++) {
                if (parseInt(stopBitsSelect.options[i].value) === settings.defaultStopBits) {
                    stopBitsSelect.selectedIndex = i;
                    break;
                }
            }
        })
        .catch(error => {
            console.error('Error loading default settings:', error);
        });
}

// Connect to the selected port
function connectToPort() {
    const selectedPort = portSelect.value;
    const baudRate = baudRateSelect.value;
    const dataBits = dataBitsSelect.value;
    const parity = paritySelect.value;
    const stopBits = stopBitsSelect.value;
    
    if (!selectedPort) {
        showNotification('Please select a port', 'error');
        return;
    }
    
    // Send connection request to the server
    socket.emit('connect-port', {
        path: selectedPort,
        baudRate: baudRate,
        dataBits: dataBits,
        parity: parity,
        stopBits: stopBits
    });
    
    // Update UI to show connecting state
    connectionStatus.textContent = 'Connecting...';
    connectionStatus.className = '';
}

// Disconnect from the current port
function disconnectFromPort() {
    socket.emit('disconnect-port');
}

// Update the connection status UI
function updateConnectionStatus(status) {
    isConnected = status.connected;
    
    if (isConnected) {
        connectionStatus.textContent = `Connected to ${status.port} at ${status.baudRate} baud`;
        connectionStatus.className = 'connected';
        connectButton.disabled = true;
        disconnectButton.disabled = false;
        portSelect.disabled = true;
        baudRateSelect.disabled = true;
        dataBitsSelect.disabled = true;
        paritySelect.disabled = true;
        stopBitsSelect.disabled = true;
        refreshPortsButton.disabled = true;
        
        showNotification('Connected successfully', 'success');
    } else {
        connectionStatus.textContent = 'Not connected';
        connectionStatus.className = 'disconnected';
        connectButton.disabled = false;
        disconnectButton.disabled = true;
        portSelect.disabled = false;
        baudRateSelect.disabled = false;
        dataBitsSelect.disabled = false;
        paritySelect.disabled = false;
        stopBitsSelect.disabled = false;
        refreshPortsButton.disabled = false;
        
        if (logEntries.length > 0) {
            showNotification('Disconnected from port', 'error');
        }
    }
}

// Add a log entry to the log window
function addLogEntry(timestamp, message) {
    // Skip empty messages
    if (!message || message.trim() === '') return;
    
    // Create log entry object
    const entry = { timestamp, message };
    logEntries.push(entry);
    
    // Create DOM elements for the log entry
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    // Only add timestamp if the timestamp checkbox is checked
    if (timestampCheckbox.checked) {
        const timestampElement = document.createElement('span');
        timestampElement.className = 'log-timestamp';
        timestampElement.textContent = formatTimestamp(timestamp);
        logEntry.appendChild(timestampElement);
    }
    
    const messageElement = document.createElement('span');
    messageElement.className = 'log-message';
    
    // Handle special characters and control codes
    // This preserves whitespace and line breaks
    const formattedMessage = message
        .replace(/\r\n|\r|\n/g, '<br>')
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
        .replace(/ /g, '&nbsp;');
    
    messageElement.innerHTML = formattedMessage;
    
    // Add message element to the log entry
    logEntry.appendChild(messageElement);
    
    // Add the log entry to the log window
    logWindow.appendChild(logEntry);
    
    // Auto-scroll if enabled
    if (autoscrollCheckbox.checked) {
        logWindow.scrollTop = logWindow.scrollHeight;
    }
    
    // Log to console for debugging
    console.log(`Log entry: ${timestamp} - ${message}`);
}

// Format timestamp for display - matching CoolTerm's Time+Millis format
function formatTimestamp(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
    });
}

// Clear the log window
function clearLog() {
    logWindow.innerHTML = '';
    logEntries = [];
    showNotification('Log cleared', 'success');
}

// Save the log to a file
function saveLog() {
    // Create log content
    const logContent = logEntries.map(entry => 
        `${formatTimestamp(entry.timestamp)} ${entry.message}`
    ).join('\n');
    
    // Create a blob with the log content
    const blob = new Blob([logContent], { type: 'text/plain' });
    
    // Create a download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // Generate filename with current date and time
    const now = new Date();
    const filename = `serial_log_${now.toISOString().replace(/[:.]/g, '-')}.txt`;
    
    a.href = url;
    a.download = filename;
    
    // Trigger the download
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
    
    showNotification('Log saved to file', 'success');
}

// Show a notification
function showNotification(message, type = 'success') {
    notification.textContent = message;
    notification.className = type;
    
    // Remove the hidden class to show the notification
    setTimeout(() => {
        notification.classList.remove('hidden');
    }, 10);
    
    // Hide the notification after a delay
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
