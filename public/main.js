// Connect to Socket.io server
const socket = io();

// Map to store the relationship between error entries and log entries
let errorToLogMap = new Map();

// DOM Elements
const portSelect = document.getElementById('port-select');
const connectButton = document.getElementById('connect-button');
const disconnectButton = document.getElementById('disconnect-button');

const clearLogButton = document.getElementById('clear-log');
const saveLogButton = document.getElementById('save-log');
const clearErrorsButton = document.getElementById('clear-errors');
const saveErrorsButton = document.getElementById('save-errors');
const autoscrollCheckbox = document.getElementById('autoscroll');
const errorAutoscrollCheckbox = document.getElementById('error-autoscroll');
const timestampCheckbox = document.getElementById('timestamp');
const logWindow = document.getElementById('log-window');
const errorWindow = document.getElementById('error-window');
const connectionStatus = document.getElementById('connection-status');
const notification = document.getElementById('notification');
const quoteText = document.getElementById('quote-text');

// Test Plan Elements
const testPlanTabs = document.getElementById('test-plan-tabs');
const testPlanTableContainer = document.getElementById('test-plan-table-container');
const selectedTestCaseDisplay = document.getElementById('selected-test-case-display');
const clearSelectedTestCaseButton = document.getElementById('clear-selected-test-case');

// State variables
let isConnected = false;
let logEntries = [];
let errorEntries = [];
let currentTestPlanFile = null;
let testPlanData = null;
let activeSheetName = null;
let selectedTestCases = new Set(); // Store selected test case rows
let currentlyDisplayedTestCase = null; // Store the currently displayed test case ID

// Initialize the application
function init() {
    // Fetch available ports when the page loads
    refreshPorts();
    
    // Load default settings
    loadDefaultSettings();
    
    // Load the test plan data automatically
    loadTestPlanData();
    
    // Display a random inspirational quote
    displayRandomQuote();
    
    // Set up event listeners
    connectButton.addEventListener('click', connectToPort);
    disconnectButton.addEventListener('click', disconnectFromPort);

    clearLogButton.addEventListener('click', clearLog);
    saveLogButton.addEventListener('click', saveLog);
    clearErrorsButton.addEventListener('click', clearErrors);
    saveErrorsButton.addEventListener('click', saveErrors);
    clearSelectedTestCaseButton.addEventListener('click', clearSelectedTestCase);
    
    // Test plan data is loaded automatically
    
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
            
            // Using fixed baud rate of 115200 as per requirements
            
            // Using fixed serial port settings as per requirements
        })
        .catch(error => {
            console.error('Error loading default settings:', error);
        });
}

// Connect to the selected port
function connectToPort() {
    const selectedPort = portSelect.value;
    const fixedBaudRate = 115200; // Fixed baud rate of 115200
    
    if (!selectedPort) {
        showNotification('Please select a port', 'error');
        return;
    }
    
    // Send connection request to the server
    socket.emit('connect-port', {
        path: selectedPort,
        baudRate: fixedBaudRate,
        dataBits: 8,       // Fixed to 8 data bits
        parity: 'none',    // Fixed to no parity
        stopBits: 1        // Fixed to 1 stop bit
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
        
        showNotification('Connected successfully', 'success');
    } else {
        connectionStatus.textContent = 'Not connected';
        connectionStatus.className = 'disconnected';
        connectButton.disabled = false;
        disconnectButton.disabled = true;
        portSelect.disabled = false;
        
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
    const entryIndex = logEntries.length;
    logEntries.push(entry);
    
    // Create DOM elements for the log entry
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.dataset.logIndex = entryIndex;
    
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
    let formattedMessage = message
        .replace(/\r\n|\r|\n/g, '<br>')
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
        .replace(/ /g, '&nbsp;');
    
    // Apply color coding based on message content
    formattedMessage = applyColorCoding(formattedMessage);
    
    messageElement.innerHTML = formattedMessage;
    
    // Add message element to the log entry
    logEntry.appendChild(messageElement);
    
    // Add the log entry to the log window
    logWindow.appendChild(logEntry);
    
    // Auto-scroll if enabled
    if (autoscrollCheckbox.checked) {
        logWindow.scrollTop = logWindow.scrollHeight;
    }
    
    // Check if the message contains error-related keywords
    const lowerCaseMessage = message.toLowerCase();
    if (lowerCaseMessage.includes('error') || 
        lowerCaseMessage.includes('failure') || 
        lowerCaseMessage.includes('fail') || 
        lowerCaseMessage.includes('fails') || 
        lowerCaseMessage.includes('failed') || 
        lowerCaseMessage.includes('unexpected') || 
        lowerCaseMessage.includes('exception') || 
        lowerCaseMessage.includes('comparison failed') ||
        lowerCaseMessage.includes('sha-256')) {
        addErrorEntry(timestamp, message);
    }
    
    // Log to console for debugging
    console.log(`Log entry: ${timestamp} - ${message}`);
}

// Add an entry to the error window
function addErrorEntry(timestamp, message) {
    // Create error entry object
    const entry = { timestamp, message };
    const errorIndex = errorEntries.length;
    errorEntries.push(entry);
    
    // Find the corresponding log entry index
    const logIndex = findLogEntryIndex(timestamp, message);
    if (logIndex !== -1) {
        errorToLogMap.set(errorIndex, logIndex);
    }
    
    // Create DOM elements for the error entry
    const errorEntry = document.createElement('div');
    errorEntry.className = 'log-entry clickable';
    errorEntry.dataset.errorIndex = errorIndex;
    
    // Add click event to navigate to the corresponding log entry
    errorEntry.addEventListener('click', function() {
        navigateToLogEntry(errorIndex);
    });
    
    // Determine the line color based on message content
    const lowerCaseMessage = message.toLowerCase();
    if (lowerCaseMessage.includes('error')) {
        errorEntry.classList.add('error-line');
    } else if (lowerCaseMessage.includes('fail') || lowerCaseMessage.includes('failure')) {
        errorEntry.classList.add('failure-line');
    } else if (lowerCaseMessage.includes('unexpected')) {
        errorEntry.classList.add('unexpected-line');
    } else if (lowerCaseMessage.includes('exception')) {
        errorEntry.classList.add('exception-line');
    }
    
    // Always add timestamp to error entries
    const timestampElement = document.createElement('span');
    timestampElement.className = 'log-timestamp';
    timestampElement.textContent = formatTimestamp(timestamp);
    errorEntry.appendChild(timestampElement);
    
    const messageElement = document.createElement('span');
    messageElement.className = 'log-message';
    
    // Handle special characters and control codes
    let formattedMessage = message
        .replace(/\r\n|\r|\n/g, '<br>')
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
        .replace(/ /g, '&nbsp;');
    
    // In the main log, we still want inline coloring
    // But in the error window, we're using full line coloring via the parent element
    messageElement.innerHTML = formattedMessage;
    
    // Add message element to the error entry
    errorEntry.appendChild(messageElement);
    
    // Add the error entry to the error window
    errorWindow.appendChild(errorEntry);
    
    // Auto-scroll if enabled
    if (errorAutoscrollCheckbox.checked) {
        errorWindow.scrollTop = errorWindow.scrollHeight;
    }
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

// Clear the errors window
function clearErrors() {
    errorWindow.innerHTML = '';
    errorEntries = [];
    showNotification('Errors cleared', 'success');
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

// Save the errors to a file
function saveErrors() {
    // Create error log content
    const errorContent = errorEntries.map(entry => 
        `${formatTimestamp(entry.timestamp)} ${entry.message}`
    ).join('\n');
    
    // If no errors, show notification and return
    if (!errorContent) {
        showNotification('No errors to save', 'error');
        return;
    }
    
    // Create a blob with the error content
    const blob = new Blob([errorContent], { type: 'text/plain' });
    
    // Create a download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // Generate filename with current date and time
    const now = new Date();
    const filename = `error_log_${now.toISOString().replace(/[:.]/g, '-')}.txt`;
    
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
    
    showNotification('Error log saved to file', 'success');
}



// Apply color coding to message based on content
function applyColorCoding(message) {
    // Create a case-insensitive regex for each category
    const errorRegex = /\b(error|errors)\b/gi;
    const failureRegex = /\b(fail|fails|failure|failed)\b/gi;
    const unexpectedRegex = /\b(unexpected)\b/gi;
    const exceptionRegex = /\b(exception|exceptions)\b/gi;
    
    // Apply color coding with spans
    let coloredMessage = message
        .replace(errorRegex, match => `<span class="error-text">${match}</span>`)
        .replace(failureRegex, match => `<span class="failure-text">${match}</span>`)
        .replace(unexpectedRegex, match => `<span class="unexpected-text">${match}</span>`)
        .replace(exceptionRegex, match => `<span class="exception-text">${match}</span>`);
    
    return coloredMessage;
}

// Find the corresponding log entry index for an error entry
function findLogEntryIndex(timestamp, message) {
    // Look for an exact match first
    for (let i = 0; i < logEntries.length; i++) {
        if (logEntries[i].timestamp === timestamp && logEntries[i].message === message) {
            return i;
        }
    }
    
    // If no exact match, look for a message match (timestamps might differ slightly)
    for (let i = 0; i < logEntries.length; i++) {
        if (logEntries[i].message === message) {
            return i;
        }
    }
    
    return -1; // No match found
}

// Navigate to the corresponding log entry when an error entry is clicked
function navigateToLogEntry(errorIndex) {
    const logIndex = errorToLogMap.get(parseInt(errorIndex));
    
    if (logIndex !== undefined) {
        // Find the log entry element
        const logEntryElement = document.querySelector(`.log-entry[data-log-index="${logIndex}"]`);
        
        if (logEntryElement) {
            // Remove highlight from any previously highlighted entry
            const previousHighlight = document.querySelector('.log-entry.highlighted');
            if (previousHighlight) {
                previousHighlight.classList.remove('highlighted');
            }
            
            // Highlight the log entry
            logEntryElement.classList.add('highlighted');
            
            // Scroll to the log entry
            logEntryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Flash the log entry to make it more noticeable
            logEntryElement.classList.add('flash');
            setTimeout(() => {
                logEntryElement.classList.remove('flash');
            }, 1000);
            
            // Show a notification
            showNotification('Navigated to log entry', 'info');
        } else {
            showNotification('Could not find the corresponding log entry', 'error');
        }
    } else {
        showNotification('No matching log entry found', 'error');
    }
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

// Display a random inspirational quote
function displayRandomQuote() {
    if (typeof inspirationalQuotes !== 'undefined' && inspirationalQuotes.length > 0) {
        const randomIndex = Math.floor(Math.random() * inspirationalQuotes.length);
        const quote = inspirationalQuotes[randomIndex];
        quoteText.textContent = quote;
    } else {
        console.error('Inspirational quotes not loaded');
        quoteText.textContent = 'The best way to predict the future is to create it.';
    }
}

// Load test plan data automatically from the server
function loadTestPlanData() {
    // Show loading state
    testPlanTableContainer.innerHTML = '<div class="loading">Loading test plan...</div>';
    
    fetch('/test-plan-data')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load test plan data');
            }
            return response.json();
        })
        .then(data => {
            testPlanData = data;
            renderTestPlanTabs(data.sheetNames);
            // Display the first sheet by default
            if (data.sheetNames.length > 0) {
                displayTestPlanSheet(data.sheetNames[0]);
            }
            console.log('Test plan loaded successfully');
        })
        .catch(error => {
            console.error('Error loading test plan:', error);
            testPlanTableContainer.innerHTML = `
                <div class="error-message">${error.message}</div>
                <div class="error-details">Check the console for more details</div>
            `;
            showNotification('Failed to load test plan', 'error');
        });
}

// Render the tabs for each sheet in the Excel file
function renderTestPlanTabs(sheetNames) {
    testPlanTabs.innerHTML = '';
    
    sheetNames.forEach(sheetName => {
        const tab = document.createElement('div');
        tab.className = 'test-plan-tab';
        tab.textContent = sheetName;
        tab.addEventListener('click', () => displayTestPlanSheet(sheetName));
        testPlanTabs.appendChild(tab);
    });
    
    // Set the first tab as active by default
    if (testPlanTabs.firstChild) {
        testPlanTabs.firstChild.classList.add('active');
    }
}

// Display the selected sheet as a table
function displayTestPlanSheet(sheetName) {
    if (!testPlanData || !testPlanData.sheets || !testPlanData.sheets[sheetName]) {
        return;
    }
    
    // Update active tab
    activeSheetName = sheetName;
    document.querySelectorAll('.test-plan-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent === sheetName) {
            tab.classList.add('active');
        }
    });
    
    // Get the sheet data
    const sheetData = testPlanData.sheets[sheetName];
    
    // Clear the container
    testPlanTableContainer.innerHTML = '';
    
    // Create the table
    const table = document.createElement('table');
    table.className = 'test-plan-table';
    
    // Create header row if there's data
    if (sheetData.length > 0) {
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Use the first row as headers
        const headers = sheetData[0];
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header || '';
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        // Find the index of the column that likely contains test case numbers
        // Usually it's the first column, but we'll look for columns with "Test" or "#" in the header
        let testCaseColumnIndex = 0;
        for (let j = 0; j < headers.length; j++) {
            const headerText = headers[j]?.toString().toLowerCase() || '';
            if (headerText.includes('test') && (headerText.includes('#') || headerText.includes('number') || headerText.includes('case'))) {
                testCaseColumnIndex = j;
                break;
            }
        }
        
        // Create a map to store test case groups
        const testCaseGroups = new Map();
        let currentTestCaseId = null;
        let currentGroupRows = [];
        
        // First pass: identify test case groups
        for (let i = 1; i < sheetData.length; i++) {
            const rowData = sheetData[i];
            const testCaseValue = rowData[testCaseColumnIndex];
            
            // Check if this row starts a new test case
            // We consider it a new test case if the test case column has a value that:
            // 1. Is not empty/undefined
            // 2. Contains numeric characters (likely a test case number)
            // 3. Starts with "Test" or contains "#"
            const isTestCaseRow = testCaseValue && (
                (typeof testCaseValue === 'string' && 
                 (testCaseValue.match(/\d/) || 
                  testCaseValue.toLowerCase().startsWith('test') || 
                  testCaseValue.includes('#'))) ||
                (typeof testCaseValue === 'number')
            );
            
            if (isTestCaseRow) {
                // Start a new test case group
                currentTestCaseId = `${sheetName}-test-${testCaseValue}`;
                currentGroupRows = [];
                testCaseGroups.set(currentTestCaseId, currentGroupRows);
            }
            
            if (currentTestCaseId) {
                // Add this row to the current test case group
                currentGroupRows.push(i);
            }
        }
        
        // Add data rows (skip the header row)
        for (let i = 1; i < sheetData.length; i++) {
            const row = document.createElement('tr');
            const rowData = sheetData[i];
            
            // Create a unique row identifier
            const rowId = `${sheetName}-row-${i}`;
            row.dataset.rowId = rowId;
            
            // Check if this row was previously selected
            if (selectedTestCases.has(rowId)) {
                row.classList.add('selected-test-case');
            }
            
            // Determine if this row is a test case header row
            const testCaseValue = rowData[testCaseColumnIndex];
            const isTestCaseRow = testCaseValue && (
                (typeof testCaseValue === 'string' && 
                 (testCaseValue.match(/\d/) || 
                  testCaseValue.toLowerCase().startsWith('test') || 
                  testCaseValue.includes('#'))) ||
                (typeof testCaseValue === 'number')
            );
            
            if (isTestCaseRow) {
                row.classList.add('test-case-header');
                row.dataset.testCaseId = `${sheetName}-test-${testCaseValue}`;
            }
            
            // Handle rows with fewer cells than the header
            for (let j = 0; j < headers.length; j++) {
                const cell = document.createElement('td');
                cell.textContent = rowData[j] !== undefined ? rowData[j] : '';
                row.appendChild(cell);
            }
            
            // Add click event to make the row selectable
            row.addEventListener('click', function() {
                // Determine which test case group this row belongs to
                let groupToToggle = [];
                let testCaseId = null;
                
                if (this.dataset.testCaseId) {
                    // This is a test case header row
                    testCaseId = this.dataset.testCaseId;
                    groupToToggle = testCaseGroups.get(testCaseId) || [];
                } else {
                    // This is a regular row, find which test case it belongs to
                    for (const [id, rows] of testCaseGroups.entries()) {
                        if (rows.includes(i)) {
                            testCaseId = id;
                            groupToToggle = rows;
                            break;
                        }
                    }
                }
                
                if (!testCaseId || groupToToggle.length === 0) {
                    // If we couldn't find a group, just toggle this single row
                    this.classList.toggle('selected-test-case');
                    if (this.classList.contains('selected-test-case')) {
                        selectedTestCases.add(rowId);
                    } else {
                        selectedTestCases.delete(rowId);
                    }
                    return;
                }
                
                // Determine if we're selecting or deselecting
                const isSelecting = !this.classList.contains('selected-test-case');
                
                // Get all rows in this test case group
                const groupRows = [];
                for (const rowIndex of groupToToggle) {
                    const groupRowId = `${sheetName}-row-${rowIndex}`;
                    const groupRow = tbody.querySelector(`tr[data-row-id="${groupRowId}"]`);
                    if (groupRow) {
                        groupRows.push({ row: groupRow, id: groupRowId });
                    }
                }
                
                // Apply selection/deselection to all rows in the group
                groupRows.forEach(({ row, id }) => {
                    if (isSelecting) {
                        row.classList.add('selected-test-case');
                        selectedTestCases.add(id);
                        
                        // Add animation to each row
                        row.animate([
                            { backgroundColor: 'rgba(0, 114, 255, 0.2)' },
                            { backgroundColor: 'rgba(0, 114, 255, 0.1)' }
                        ], {
                            duration: 300,
                            easing: 'ease-out',
                            delay: 50 * Math.random() // Stagger the animations slightly
                        });
                    } else {
                        row.classList.remove('selected-test-case');
                        selectedTestCases.delete(id);
                    }
                });
                
                // Extract the test case number for the notification
                const testCaseNumber = testCaseId.split('-test-')[1];
                showNotification(`Test case ${testCaseNumber} ${isSelecting ? 'selected' : 'unselected'} with ${groupRows.length} rows`, 'info');
                
                // If selecting, display this test case in the panel
                if (isSelecting) {
                    displaySelectedTestCase(testCaseId, sheetName, groupToToggle);
                } else if (currentlyDisplayedTestCase === testCaseId) {
                    // If deselecting the currently displayed test case, clear the panel
                    clearSelectedTestCase();
                }
            });
            
            tbody.appendChild(row);
        }
        
        table.appendChild(tbody);
    } else {
        // Show a message if the sheet is empty
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'test-plan-placeholder';
        emptyMessage.textContent = 'This sheet is empty';
        testPlanTableContainer.appendChild(emptyMessage);
        return;
    }
    
    testPlanTableContainer.appendChild(table);
}

// Display the selected test case in the panel
function displaySelectedTestCase(testCaseId, sheetName, rowIndices) {
    // Store the currently displayed test case ID
    currentlyDisplayedTestCase = testCaseId;
    
    // Clear the display area
    selectedTestCaseDisplay.innerHTML = '';
    
    if (!testPlanData || !testPlanData.sheets || !testPlanData.sheets[sheetName]) {
        return;
    }
    
    // Get the sheet data
    const sheetData = testPlanData.sheets[sheetName];
    
    // Get the headers (first row)
    const headers = sheetData[0];
    
    // Create a title for the test case
    const testCaseNumber = testCaseId.split('-test-')[1];
    const titleDiv = document.createElement('div');
    titleDiv.className = 'test-case-title';
    titleDiv.textContent = `Test Case ${testCaseNumber} from ${sheetName}`;
    selectedTestCaseDisplay.appendChild(titleDiv);
    
    // Create a table for the test case data
    const table = document.createElement('table');
    
    // Create the header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header || '';
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create the table body
    const tbody = document.createElement('tbody');
    
    // Add the test case rows
    rowIndices.forEach(rowIndex => {
        if (rowIndex < sheetData.length) {
            const rowData = sheetData[rowIndex];
            const row = document.createElement('tr');
            
            // Add cells for each column
            for (let j = 0; j < headers.length; j++) {
                const cell = document.createElement('td');
                cell.textContent = rowData[j] !== undefined ? rowData[j] : '';
                row.appendChild(cell);
            }
            
            tbody.appendChild(row);
        }
    });
    
    table.appendChild(tbody);
    selectedTestCaseDisplay.appendChild(table);
    
    // Add a subtle entrance animation
    selectedTestCaseDisplay.animate([
        { opacity: 0, transform: 'translateY(-10px)' },
        { opacity: 1, transform: 'translateY(0)' }
    ], {
        duration: 300,
        easing: 'ease-out'
    });
}

// Clear the selected test case panel
function clearSelectedTestCase() {
    currentlyDisplayedTestCase = null;
    selectedTestCaseDisplay.innerHTML = '<div class="test-case-placeholder">No test case selected. Select a test case from the Test Plan below.</div>';
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
