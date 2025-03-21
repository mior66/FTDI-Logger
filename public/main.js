// Connect to Socket.io server
const socket = io();

// Map to store the relationship between error entries and log entries
let errorToLogMap = new Map();

// Environment data tracking
let envChart = null;
let temperatureData = [];
let humidityData = [];
let timeLabels = [];
const MAX_DATA_POINTS = 20; // Maximum number of data points to display on the chart
const MAX_VISIBLE_LOG_ENTRIES = 1000; // Maximum number of log entries to render in DOM

// Debounce utility function to limit how often a function can be called
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// DOM Elements
const portSelect = document.getElementById('port-select');
const connectButton = document.getElementById('connect-button');
const disconnectButton = document.getElementById('disconnect-button');
const logFilter = document.getElementById('log-filter');
const clearHiddenLogButton = document.getElementById('clear-hidden-log');
const saveHiddenLogButton = document.getElementById('save-hidden-log');
const workTasksButton = document.getElementById('work-tasks-button');
const tasksOverlay = document.getElementById('tasks-overlay');
const tasksTextarea = document.getElementById('tasks-textarea');
const tasksCloseButton = document.getElementById('tasks-close');
const tasksSaveButton = document.getElementById('tasks-save');

// Thermostat Status Elements
const thermostatMode = document.getElementById('thermostat-mode');
const thermostatSetpoint = document.getElementById('thermostat-setpoint');
const appVersion = document.getElementById('app-version');
const tempUnit = document.getElementById('temp-unit');
const language = document.getElementById('language');

// Test Action Buttons
const testStartButton = document.getElementById('test-start-button');
const testPassButton = document.getElementById('test-pass-button');
const testFailButton = document.getElementById('test-fail-button');

// Command Input Elements
// Command input and buttons have been removed
const commandInput = null;
const sendCommandButton = null;
const setTemp29Button = null;
const setTemp28Button = null;

const clearLogButton = document.getElementById('clear-log');
const saveLogButton = document.getElementById('save-log');
const clearErrorsButton = document.getElementById('clear-errors');
const saveErrorsButton = document.getElementById('save-errors');
const autoscrollCheckbox = document.getElementById('autoscroll');
const errorAutoscrollCheckbox = document.getElementById('error-autoscroll');
const timestampCheckbox = document.getElementById('timestamp');
const logWindow = document.getElementById('log-window');
const errorWindow = document.getElementById('error-window');
const hiddenLogWindow = document.getElementById('hidden-log-window');
const connectionStatus = document.getElementById('connection-status');
const notification = document.getElementById('notification');
const quoteText = document.getElementById('quote-text');

// Test Plan Elements
const testPlanTabs = document.getElementById('test-plan-tabs');
const testPlanTableContainer = document.getElementById('test-plan-table-container');
const selectedTestCaseDisplay = document.getElementById('selected-test-case-display');
const clearSelectedTestCaseButton = document.getElementById('clear-selected-test-case');
const exportSelectedTestCaseButton = document.getElementById('export-selected-test-case');

// State variables
let isConnected = false;
let logEntries = [];
let errorEntries = [];
let hiddenEntries = []; // Store filtered-out entries
let currentTestPlanFile = null;
let testPlanData = null;
let activeSheetName = null;
let selectedTestCases = new Set(); // Store selected test case rows
let currentlyDisplayedTestCase = null; // Store the currently displayed test case ID
let testLogEntries = {}; // Store test log entries by test case ID

// Text to filter out from main log and show in hidden section
const hiddenTextPattern = 'esp_matter_attribute:';

// Error count tracking
let errorCounts = {
    error: 0,
    failure: 0,
    warning: 0,
    unexpected: 0,
    exception: 0,
    connection: 0
};

// Initialize the application
function init() {
    // Fetch available ports when the page loads
    refreshPorts();
    
    // Initialize work tasks
    initWorkTasks();
    
    // Load default settings
    loadDefaultSettings();
    
    // Load the test plan data automatically
    loadTestPlanData();
    
    // Display a random inspirational quote
    displayRandomQuote();
    
    // Initialize environment data chart
    initializeEnvChart();
    
    // Set up event listeners
    connectButton.addEventListener('click', connectToPort);
    disconnectButton.addEventListener('click', disconnectFromPort);

    clearLogButton.addEventListener('click', clearLog);
    saveLogButton.addEventListener('click', saveLog);
    clearErrorsButton.addEventListener('click', clearErrors);
    saveErrorsButton.addEventListener('click', saveErrors);
    clearSelectedTestCaseButton.addEventListener('click', clearSelectedTestCase);
    
    // Command input and temperature setpoint buttons have been removed
    
    // Set up log filter dropdown event listener
    logFilter.addEventListener('change', function() {
        console.log('Filter changed to:', logFilter.value);
        currentFilter = logFilter.value; // Set the current filter directly
        renderVisibleLogEntries(logFilter.value);
    });
    
    // Set up refresh test plan button event listener
    const refreshTestPlanButton = document.getElementById('refresh-test-plan');
    refreshTestPlanButton.addEventListener('click', loadTestPlanData);
    
    // Set up lunch idea button event listener
    const lunchIdeaButton = document.getElementById('lunch-idea-button');
    if (lunchIdeaButton) {
        lunchIdeaButton.addEventListener('click', suggestLunchPlaces);
    }
    
    // Setup work tasks button
    workTasksButton.addEventListener('click', openWorkTasks);
    tasksCloseButton.addEventListener('click', closeWorkTasks);
    tasksSaveButton.addEventListener('click', saveWorkTasks);
    
    // Close tasks overlay when clicking outside the window
    tasksOverlay.addEventListener('click', function(e) {
        if (e.target === tasksOverlay) {
            closeWorkTasks();
        }
    });
    
    // Set up error legend filtering
    setupErrorLegendFiltering();
    
    // Set up export button event listener
    const exportSelectedTestCaseButton = document.getElementById('export-selected-test-case');
    exportSelectedTestCaseButton.addEventListener('click', exportSelectedTestCase);
    
    // Set up test action button event listeners
    testStartButton.addEventListener('click', addTestStartLog);
    testPassButton.addEventListener('click', addTestPassLog);
    testFailButton.addEventListener('click', addTestFailLog);
    
    // Set up timestamp checkbox with debounced handler for better performance
    timestampCheckbox.addEventListener('change', function() {
        renderVisibleLogEntries();
        updateHiddenLogWindow(); // Also update hidden log window when timestamp preference changes
    });
    
    // Set up clear hidden log button
    clearHiddenLogButton.addEventListener('click', function() {
        hiddenEntries = [];
        hiddenLogWindow.innerHTML = '';
        showNotification('Hidden log cleared', 'success');
    });
    
    // Set up save hidden log button
    saveHiddenLogButton.addEventListener('click', saveHiddenLog);
    
    // Apply the filter to existing logs
    reapplyFilterToExistingLogs();
    
    // Set initial filter value and apply it
    currentFilter = logFilter.value;
    console.log('Initial filter set to:', currentFilter);
    renderVisibleLogEntries();
    
    // Add scroll event listener with debouncing for better performance
    logWindow.addEventListener('scroll', debounce(function() {
        // If we're near the top and have more entries than visible, load earlier entries
        if (logWindow.scrollTop < 100 && logEntries.length > MAX_VISIBLE_LOG_ENTRIES) {
            const firstVisibleIndex = parseInt(logWindow.firstChild?.dataset?.logIndex || '0');
            if (firstVisibleIndex > 0) {
                // Save current scroll position
                const oldScrollHeight = logWindow.scrollHeight;
                const oldScrollTop = logWindow.scrollTop;
                
                // Load earlier entries
                const newStartIndex = Math.max(0, firstVisibleIndex - Math.floor(MAX_VISIBLE_LOG_ENTRIES / 4));
                const entriesToAdd = firstVisibleIndex - newStartIndex;
                
                if (entriesToAdd > 0) {
                    // Insert earlier entries at the beginning
                    const fragment = document.createDocumentFragment();
                    for (let i = newStartIndex; i < firstVisibleIndex; i++) {
                        fragment.appendChild(createLogEntryElement(logEntries[i], i));
                    }
                    logWindow.insertBefore(fragment, logWindow.firstChild);
                    
                    // Adjust scroll position to maintain view
                    const newScrollHeight = logWindow.scrollHeight;
                    logWindow.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
                }
            }
        }
    }, 150));
    
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
        
        // Check if this data contains the hidden text pattern
        if (data.data.includes(hiddenTextPattern)) {
            // Add to hidden entries
            hiddenEntries.push({ timestamp: data.timestamp, message: data.data });
            
            // Update hidden log window
            updateHiddenLogWindow();
        } else {
            // Add to regular log entries
            addLogEntry(data.timestamp, data.data);
        }
        
        // Check for temperature and humidity data
        checkForEnvironmentData(data.data);
        
        // Check for thermostat information
        checkForThermostatInfo(data.data);
        
        // Check for App version information
        checkForAppVersion(data.data);
        
        // Check for temperature unit information
        checkForTemperatureUnit(data.data);
        
        // Check for language information
        checkForLanguage(data.data);
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
    
    // Filter out USBmodem ports (case insensitive)
    const filteredPorts = ports.filter(port => {
        return !port.path.toLowerCase().includes('usbmodem');
    });
    
    // Add ports to the dropdown
    filteredPorts.forEach(port => {
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
    connectButton.disabled = filteredPorts.length === 0;
    
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
        connectionStatus.textContent = 'Connected';
        connectionStatus.className = 'connected';
        connectButton.disabled = true;
        disconnectButton.disabled = false;
        portSelect.disabled = true;
        
        // Command input elements have been removed
        
        showNotification('Connected successfully', 'success');
    } else {
        connectionStatus.textContent = 'Not connected';
        connectionStatus.className = 'disconnected';
        connectButton.disabled = false;
        disconnectButton.disabled = true;
        portSelect.disabled = false;
        
        // Command input elements have been removed
        
        if (logEntries.length > 0) {
            showNotification('Disconnected from port', 'error');
        }
    }
    
    // Update test action buttons state
    updateTestActionButtonsState();
}

// Add a log entry to the log window
function addLogEntry(timestamp, message) {
    // Skip empty messages
    if (!message || message.trim() === '') return;
    
    // Create log entry object
    const entry = { timestamp, message };
    const entryIndex = logEntries.length;
    logEntries.push(entry);
    
    // Always re-render when using a filter other than 'full'
    if (currentFilter !== 'full') {
        // Re-render with the current filter
        renderVisibleLogEntries();
        
        // Auto-scroll if enabled
        if (autoscrollCheckbox.checked) {
            logWindow.scrollTop = logWindow.scrollHeight;
        }
    } else {
        // For 'full' filter, use the virtual scrolling logic
        if (logEntries.length > MAX_VISIBLE_LOG_ENTRIES) {
            // If we're at the bottom of the scroll, we want to show the new entry
            const isAtBottom = logWindow.scrollTop + logWindow.clientHeight >= logWindow.scrollHeight - 10;
            
            // Clear and re-render only if we're at the bottom or if this is the first entry over the limit
            if (isAtBottom || logEntries.length === MAX_VISIBLE_LOG_ENTRIES + 1) {
                renderVisibleLogEntries();
            }
        } else {
            // Just create and add this single entry if we're under the limit and using the full filter
            createLogEntryElement(entry, entryIndex);
            
            // Auto-scroll if enabled
            if (autoscrollCheckbox.checked) {
                logWindow.scrollTop = logWindow.scrollHeight;
            }
        }
    }
    
    // Check for environment data and thermostat info in the message
    checkForEnvironmentData(message);
    checkForThermostatInfo(message);
    checkForAppVersion(message);
    checkForTemperatureUnit(message);
    checkForLanguage(message);
    
    // Check if the message contains error-related keywords
    const lowerCaseMessage = message.toLowerCase();
    
    // Check for "Connection attempt" with number > 7
    let isHighConnectionAttempt = false;
    const connectionAttemptMatch = message.match(/Connection attempt (\d+)/i);
    if (connectionAttemptMatch && parseInt(connectionAttemptMatch[1]) >= 7) {
        isHighConnectionAttempt = true;
    }
    
    if (lowerCaseMessage.includes('error') || 
        lowerCaseMessage.includes('failure') || 
        lowerCaseMessage.includes('fail') || 
        lowerCaseMessage.includes('fails') || 
        lowerCaseMessage.includes('failed') || 
        lowerCaseMessage.includes('warning') || 
        lowerCaseMessage.includes('warn') || 
        lowerCaseMessage.includes('unexpected') || 
        lowerCaseMessage.includes('exception') || 
        lowerCaseMessage.includes('comparison failed') ||
        lowerCaseMessage.includes('sha-256') ||
        isHighConnectionAttempt) {
        // Add to error window and store the relationship between error entry and log entry
        const errorIndex = addErrorEntry(timestamp, message, isHighConnectionAttempt);
        errorToLogMap.set(errorIndex, entryIndex);
    }
}

// Add an entry to the error window
function addErrorEntry(timestamp, message, isHighConnectionAttempt = false) {
    // Create error entry object
    const entry = { timestamp, message, isHighConnectionAttempt };
    const errorIndex = errorEntries.length;
    errorEntries.push(entry);
    
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
    if (isHighConnectionAttempt) {
        // For Connection attempt >= 7, use dark blue color
        errorEntry.classList.add('connection-line');
    } else if (lowerCaseMessage.includes('error')) {
        errorEntry.classList.add('error-line');
    } else if (lowerCaseMessage.includes('fail') || lowerCaseMessage.includes('failure')) {
        errorEntry.classList.add('failure-line');
    } else if (lowerCaseMessage.includes('warning') || lowerCaseMessage.includes('warn')) {
        errorEntry.classList.add('warning-line');
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
    
    // Update error counts based on message content
    updateErrorCounts(lowerCaseMessage, isHighConnectionAttempt);
    
    // Return the error index for mapping to log entries
    return errorIndex;
}

// Update error counts based on message content
function updateErrorCounts(message, isHighConnectionAttempt) {
    // Determine which type of error to increment
    if (isHighConnectionAttempt) {
        errorCounts.connection++;
        document.getElementById('connection-count').textContent = errorCounts.connection;
        // Add animation to highlight the count change
        animateCountChange('connection-count');
    } else if (message.includes('error')) {
        errorCounts.error++;
        document.getElementById('error-count').textContent = errorCounts.error;
        animateCountChange('error-count');
    } else if (message.includes('fail') || message.includes('failure')) {
        errorCounts.failure++;
        document.getElementById('failure-count').textContent = errorCounts.failure;
        animateCountChange('failure-count');
    } else if (message.includes('warning') || message.includes('warn')) {
        errorCounts.warning++;
        document.getElementById('warning-count').textContent = errorCounts.warning;
        animateCountChange('warning-count');
    } else if (message.includes('unexpected')) {
        errorCounts.unexpected++;
        document.getElementById('unexpected-count').textContent = errorCounts.unexpected;
        animateCountChange('unexpected-count');
    } else if (message.includes('exception')) {
        errorCounts.exception++;
        document.getElementById('exception-count').textContent = errorCounts.exception;
        animateCountChange('exception-count');
    }
}

// Animate the count change with a brief highlight
function animateCountChange(elementId) {
    const element = document.getElementById(elementId);
    // Add highlight class
    element.style.backgroundColor = '#ffff99';
    element.style.transform = 'scale(1.2)';
    
    // Remove highlight after animation completes
    setTimeout(() => {
        element.style.backgroundColor = '';
        element.style.transform = '';
    }, 500);
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
    hiddenLogWindow.innerHTML = '';
    logEntries = [];
    hiddenEntries = [];
    errorToLogMap = new Map();
    showNotification('All logs cleared', 'success');
}

// Create a log entry DOM element
function createLogEntryElement(entry, index) {
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.dataset.logIndex = index;
    
    // Only add timestamp if the timestamp checkbox is checked
    if (timestampCheckbox.checked && entry.timestamp) {
        const timestampElement = document.createElement('span');
        timestampElement.className = 'log-timestamp';
        timestampElement.textContent = formatTimestamp(entry.timestamp);
        logEntry.appendChild(timestampElement);
    }
    
    const messageElement = document.createElement('span');
    messageElement.className = 'log-message';
    
    // Handle special characters and control codes
    let formattedMessage = entry.message
        .replace(/\r\n|\r|\n/g, '<br>')
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
        .replace(/ /g, '&nbsp;');
    
    // Apply color coding
    formattedMessage = applyColorCoding(formattedMessage);
    messageElement.innerHTML = formattedMessage;
    
    // Add message element to the log entry
    logEntry.appendChild(messageElement);
    
    // Add to log window
    logWindow.appendChild(logEntry);
    return logEntry;
}

// Reapply the filter to existing logs
function reapplyFilterToExistingLogs() {
    // Create temporary arrays to hold filtered and non-filtered entries
    let filteredLogEntries = [];
    let newHiddenEntries = [];
    
    // Go through all existing log entries
    for (let i = 0; i < logEntries.length; i++) {
        const entry = logEntries[i];
        
        // Check if this entry should be hidden
        if (entry.message && entry.message.includes(hiddenTextPattern)) {
            newHiddenEntries.push(entry);
        } else {
            filteredLogEntries.push(entry);
        }
    }
    
    // Update the arrays
    logEntries = filteredLogEntries;
    hiddenEntries = [...hiddenEntries, ...newHiddenEntries];
    
    // Re-render the logs
    renderVisibleLogEntries(logFilter.value);
    updateHiddenLogWindow();
}

// Update the hidden log window with filtered entries
function updateHiddenLogWindow() {
    // Clear current hidden log window
    hiddenLogWindow.innerHTML = '';
    
    // If no hidden entries, nothing to render
    if (hiddenEntries.length === 0) return;
    
    // Create a document fragment for batch DOM operations
    const fragment = document.createDocumentFragment();
    
    // Only show the last 50 hidden entries to avoid performance issues
    const startIndex = Math.max(0, hiddenEntries.length - 50);
    
    // Render the hidden entries
    for (let i = startIndex; i < hiddenEntries.length; i++) {
        const entry = hiddenEntries[i];
        const hiddenEntry = document.createElement('div');
        hiddenEntry.className = 'log-entry';
        
        // Create timestamp element if needed
        if (timestampCheckbox.checked && entry.timestamp) {
            const timestampElement = document.createElement('span');
            timestampElement.className = 'log-timestamp';
            timestampElement.textContent = formatTimestamp(entry.timestamp);
            hiddenEntry.appendChild(timestampElement);
        }
        
        // Create message element
        const messageElement = document.createElement('span');
        messageElement.className = 'log-message';
        
        // Handle special characters and control codes
        let formattedMessage = entry.message
            .replace(/\r\n|\r|\n/g, '<br>')
            .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
            .replace(/ /g, '&nbsp;');
        
        // Apply color coding
        formattedMessage = applyColorCoding(formattedMessage);
        messageElement.innerHTML = formattedMessage;
        
        // Add message element to the hidden entry
        hiddenEntry.appendChild(messageElement);
        
        // Add to fragment
        fragment.appendChild(hiddenEntry);
    }
    
    // Add all entries to the DOM in a single operation
    hiddenLogWindow.appendChild(fragment);
    
    // Auto-scroll the hidden log window
    hiddenLogWindow.scrollTop = hiddenLogWindow.scrollHeight;
}

// Current filter selection
let currentFilter = 'full';

// Render visible log entries based on current scroll position and filter
function renderVisibleLogEntries(filter) {
    // Update current filter if provided
    if (filter) {
        currentFilter = filter;
    }
    
    console.log('Rendering with filter:', currentFilter);
    console.log('Total log entries:', logEntries.length);
    
    // Clear current log window
    logWindow.innerHTML = '';
    
    // If no entries, nothing to render
    if (logEntries.length === 0) return;
    
    // Filter entries based on the selected filter
    let filteredEntries = [];
    
    if (currentFilter === 'full') {
        // Show all logs
        filteredEntries = [...logEntries];
    } else if (currentFilter === 'setpoint') {
        // Filter for entries containing 'Setpoint Updated' and include context
        const targetPhrase = 'Setpoint Updated';
        const menuMarker = 'Entering menu: Setpoint Menu';
        const contextAfter = 2;  // Show 2 logs after
        
        console.log('Starting setpoint filtering for "Setpoint Updated" with context...');
        
        // Find all entries containing the target phrase and include context
        let setpointEntries = [];
        let addedIndices = new Set(); // Track which entries we've already added
        
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            // Check if this entry contains the target phrase
            if (entry.message && entry.message.includes(targetPhrase)) {
                console.log('Found "Setpoint Updated" at index:', i, 'with message:', entry.message);
                
                // Find the most recent 'Entering menu: Setpoint Menu' entry
                let menuEntryIndex = -1;
                for (let j = i - 1; j >= 0; j--) {
                    if (logEntries[j].message && logEntries[j].message.includes(menuMarker)) {
                        menuEntryIndex = j;
                        break;
                    }
                }
                
                // Add all entries from menu marker to the target entry
                if (menuEntryIndex !== -1) {
                    console.log('Found menu marker at index:', menuEntryIndex, 'with message:', logEntries[menuEntryIndex].message);
                    for (let j = menuEntryIndex; j < i; j++) {
                        if (!addedIndices.has(j)) {
                            setpointEntries.push(logEntries[j]);
                            addedIndices.add(j);
                        }
                    }
                } else {
                    console.log('No menu marker found before "Setpoint Updated" at index:', i);
                }
                
                // Add the target entry
                if (!addedIndices.has(i)) {
                    setpointEntries.push(entry);
                    addedIndices.add(i);
                }
                
                // Add entries after (context)
                const endIdx = Math.min(logEntries.length - 1, i + contextAfter);
                for (let j = i + 1; j <= endIdx; j++) {
                    if (!addedIndices.has(j)) {
                        setpointEntries.push(logEntries[j]);
                        addedIndices.add(j);
                    }
                }
            }
        }
        
        filteredEntries = setpointEntries;
        console.log('Setpoint filtered entries:', filteredEntries.length);
        console.log('First few setpoint entries:', filteredEntries.slice(0, 5).map(e => e.message));
        console.log('Last few setpoint entries:', filteredEntries.slice(-5).map(e => e.message));
    } else if (currentFilter === 'mode') {
        // Filter for entries between specific markers
        const startMarker = 'app_menu_controller: Entering menu: Mode Menu';
        const endMarker = 'persistence: Successfully wrote 180 bytes to flash';
        
        // Find all entries between the start and end markers
        let modeEntries = [];
        let inModeSection = false;
        
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            // Check if this is the start marker
            if (entry.message && entry.message.includes(startMarker)) {
                inModeSection = true;
                modeEntries.push(entry);
                console.log('Found mode start marker at index:', i, 'with message:', entry.message);
                continue;
            }
            
            // If we're in the section, add the entry
            if (inModeSection) {
                modeEntries.push(entry);
                
                // Check if this is the end marker
                if (entry.message && entry.message.includes(endMarker)) {
                    console.log('Found mode end marker at index:', i, 'with message:', entry.message);
                    inModeSection = false;
                }
            }
        }
        
        filteredEntries = modeEntries;
        console.log('Mode filtered entries:', filteredEntries.length);
        console.log('First few mode entries:', filteredEntries.slice(0, 5).map(e => e.message));
        console.log('Last few mode entries:', filteredEntries.slice(-5).map(e => e.message));
    } else if (currentFilter === 'temp') {
        // Filter for entries between telemetry JSON markers
        const startMarker = 'telemetry-sender: JSON: {';
        const endMarker = '}';
        
        console.log('Starting telemetry JSON filtering...');
        
        // Find all entries between the start and end markers
        let telemetryEntries = [];
        let inTelemetrySection = false;
        let openBraces = 0;
        
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            const message = entry.message || '';
            
            // Check if this is the start marker
            if (message.includes(startMarker)) {
                inTelemetrySection = true;
                openBraces = 1; // Count the opening brace in the start marker
                telemetryEntries.push(entry);
                console.log('Found telemetry JSON start at index:', i, 'with message:', message);
                continue;
            }
            
            // If we're in a telemetry section, add the entry
            if (inTelemetrySection) {
                telemetryEntries.push(entry);
                
                // Count braces to handle nested JSON structures
                const openBracesInLine = (message.match(/\{/g) || []).length;
                const closeBracesInLine = (message.match(/\}/g) || []).length;
                openBraces += openBracesInLine - closeBracesInLine;
                
                // If we've reached the end (balanced braces), end the section
                if (openBraces <= 0) {
                    console.log('Found telemetry JSON end at index:', i, 'with message:', message);
                    inTelemetrySection = false;
                }
            }
        }
        
        filteredEntries = telemetryEntries;
        console.log('Telemetry JSON entries:', filteredEntries.length);
        console.log('First few telemetry entries:', filteredEntries.slice(0, 5).map(e => e.message));
        console.log('Last few telemetry entries:', filteredEntries.slice(-5).map(e => e.message));
    } else if (currentFilter === 'boot') {
        // Filter for entries between specific markers for boot-related logs
        const startMarker = 'ESP-ROM:esp32s3';
        const endMarker = 'core_dump: No core dump found';
        
        console.log('Starting boot filtering...');
        
        // Find all entries between the start and end markers
        let bootEntries = [];
        let inBootSection = false;
        
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            // Check if this is the start marker
            if (entry.message && entry.message.includes(startMarker)) {
                inBootSection = true;
                bootEntries.push(entry);
                console.log('Found boot start marker at index:', i, 'with message:', entry.message);
                continue;
            }
            
            // If we're in the section, add the entry
            if (inBootSection) {
                bootEntries.push(entry);
                
                // Check if this is the end marker
                if (entry.message && entry.message.includes(endMarker)) {
                    console.log('Found boot end marker at index:', i, 'with message:', entry.message);
                    inBootSection = false;
                }
            }
        }
        
        filteredEntries = bootEntries;
        console.log('Boot filtered entries:', filteredEntries.length);
        console.log('First few boot entries:', filteredEntries.slice(0, 5).map(e => e.message));
        console.log('Last few boot entries:', filteredEntries.slice(-5).map(e => e.message));
    } else if (currentFilter === 'options') {
        // Filter for entries containing 'preferences_helpers' with 3 lines before and 9 lines after
        const targetMarker = 'preferences_helpers';
        console.log('Starting options filtering...');
        
        // Find all entries containing the target marker and include context
        let optionsEntries = [];
        
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            // Check if this entry contains the target marker
            if (entry.message && entry.message.includes(targetMarker)) {
                console.log('Found options marker at index:', i, 'with message:', entry.message);
                
                // Add 3 lines before if available
                for (let j = Math.max(0, i - 3); j < i; j++) {
                    optionsEntries.push(logEntries[j]);
                }
                
                // Add the current line
                optionsEntries.push(entry);
                
                // Add 9 lines after if available
                for (let j = i + 1; j <= Math.min(logEntries.length - 1, i + 9); j++) {
                    optionsEntries.push(logEntries[j]);
                }
            }
        }
        
        filteredEntries = optionsEntries;
        console.log('Options filtered entries:', filteredEntries.length);
        console.log('First few options entries:', filteredEntries.slice(0, 5).map(e => e.message));
        console.log('Last few options entries:', filteredEntries.slice(-5).map(e => e.message));
    } else if (currentFilter === 'telemetry') {
        // Filter for entries containing 'Telemetry'
        const targetText = 'Telemetry';
        console.log('Starting telemetry text filtering...');
        
        // Find all entries containing the target text
        let telemetryEntries = [];
        
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            // Check if this entry contains the target text (case insensitive)
            if (entry.message && entry.message.toLowerCase().includes(targetText.toLowerCase())) {
                telemetryEntries.push(entry);
            }
        }
        
        filteredEntries = telemetryEntries;
        console.log('Telemetry text filtered entries:', filteredEntries.length);
        console.log('First few telemetry text entries:', filteredEntries.slice(0, 5).map(e => e.message));
        console.log('Last few telemetry text entries:', filteredEntries.slice(-5).map(e => e.message));
    } else if (currentFilter === 'connection') {
        // Filter for entries containing 'Connection'
        const targetText = 'Connection';
        console.log('Starting connection text filtering...');
        
        // Find all entries containing the target text
        let connectionEntries = [];
        
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            // Check if this entry contains the target text (case insensitive)
            if (entry.message && entry.message.toLowerCase().includes(targetText.toLowerCase())) {
                connectionEntries.push(entry);
            }
        }
        
        filteredEntries = connectionEntries;
        console.log('Connection text filtered entries:', filteredEntries.length);
        console.log('First few connection text entries:', filteredEntries.slice(0, 5).map(e => e.message));
        console.log('Last few connection text entries:', filteredEntries.slice(-5).map(e => e.message));
    } else if (currentFilter === 'mqtt') {
        // Filter for entries containing 'MQTT'
        const targetText = 'MQTT';
        console.log('Starting MQTT text filtering...');
        
        // Find all entries containing the target text
        let mqttEntries = [];
        
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            // Check if this entry contains the target text (case sensitive for MQTT)
            if (entry.message && entry.message.includes(targetText)) {
                mqttEntries.push(entry);
            }
        }
        
        filteredEntries = mqttEntries;
        console.log('MQTT text filtered entries:', filteredEntries.length);
        console.log('First few MQTT text entries:', filteredEntries.slice(0, 5).map(e => e.message));
        console.log('Last few MQTT text entries:', filteredEntries.slice(-5).map(e => e.message));
    } else if (currentFilter === 'wifi') {
        // Filter for entries containing 'Wifi' or 'WiFi' or 'WIFI'
        const targetText = 'wifi';
        console.log('Starting Wifi text filtering...');
        
        // Find all entries containing the target text
        let wifiEntries = [];
        
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            // Check if this entry contains the target text (case insensitive)
            if (entry.message && entry.message.toLowerCase().includes(targetText.toLowerCase())) {
                wifiEntries.push(entry);
            }
        }
        
        filteredEntries = wifiEntries;
        console.log('Wifi text filtered entries:', filteredEntries.length);
        console.log('First few Wifi text entries:', filteredEntries.slice(0, 5).map(e => e.message));
        console.log('Last few Wifi text entries:', filteredEntries.slice(-5).map(e => e.message));
    } else if (currentFilter === 'app') {
        // Filter for entries containing 'App'
        const targetText = 'app';
        console.log('Starting App text filtering...');
        
        // Find all entries containing the target text
        let appEntries = [];
        
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            // Check if this entry contains the target text (case insensitive)
            if (entry.message && entry.message.toLowerCase().includes(targetText.toLowerCase())) {
                appEntries.push(entry);
            }
        }
        
        filteredEntries = appEntries;
        console.log('App text filtered entries:', filteredEntries.length);
        console.log('First few App text entries:', filteredEntries.slice(0, 5).map(e => e.message));
        console.log('Last few App text entries:', filteredEntries.slice(-5).map(e => e.message));
    } else {
        // Default to showing all logs for other filters
        filteredEntries = [...logEntries];
    }
    
    // Determine which entries to show based on total filtered entries
    let startIndex = 0;
    let endIndex = filteredEntries.length;
    
    // If we have more entries than our display limit, show the most recent ones
    if (filteredEntries.length > MAX_VISIBLE_LOG_ENTRIES) {
        startIndex = filteredEntries.length - MAX_VISIBLE_LOG_ENTRIES;
        endIndex = filteredEntries.length;
    }
    
    // Create a document fragment for batch DOM operations (much more efficient)
    const fragment = document.createDocumentFragment();
    
    // Render only the visible filtered entries
    for (let i = startIndex; i < endIndex; i++) {
        const logEntry = createLogEntryElement(filteredEntries[i], logEntries.indexOf(filteredEntries[i]));
        // Remove from DOM and add to fragment
        if (logEntry.parentNode) {
            logEntry.parentNode.removeChild(logEntry);
        }
        fragment.appendChild(logEntry);
    }
    
    // Add all entries to the DOM in a single operation
    logWindow.appendChild(fragment);
    
    // If autoscroll is enabled, scroll to bottom
    if (autoscrollCheckbox.checked) {
        logWindow.scrollTop = logWindow.scrollHeight;
    }
}

// Clear the errors window
function clearErrors() {
    errorWindow.innerHTML = '';
    errorEntries = [];
    
    // Reset all error counts
    errorCounts = {
        error: 0,
        failure: 0,
        warning: 0,
        unexpected: 0,
        exception: 0,
        connection: 0
    };
    
    // Update the count displays
    document.getElementById('error-count').textContent = '0';
    document.getElementById('failure-count').textContent = '0';
    document.getElementById('warning-count').textContent = '0';
    document.getElementById('unexpected-count').textContent = '0';
    document.getElementById('exception-count').textContent = '0';
    document.getElementById('connection-count').textContent = '0';
    
    showNotification('Errors cleared', 'success');
}

// Setup error legend filtering
function setupErrorLegendFiltering() {
    // Get all legend items
    const legendItems = document.querySelectorAll('.legend-item.clickable');
    
    // Add click event to each legend item
    legendItems.forEach(item => {
        item.addEventListener('click', function() {
            // Toggle active class
            this.classList.toggle('active');
            
            // Get error type
            const errorType = this.getAttribute('data-error-type');
            
            // Toggle visibility of corresponding error lines
            const errorLines = document.querySelectorAll(`.${errorType}-line`);
            errorLines.forEach(line => {
                if (this.classList.contains('active')) {
                    // Show the error line
                    line.classList.remove('error-type-hidden');
                } else {
                    // Hide the error line
                    line.classList.add('error-type-hidden');
                }
            });
        });
    });
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

// Save the hidden log to a file
function saveHiddenLog() {
    // Check if there are any hidden entries
    if (hiddenEntries.length === 0) {
        showNotification('No hidden log entries to save', 'warning');
        return;
    }
    
    // Create log content
    const logContent = hiddenEntries.map(entry => 
        `${formatTimestamp(entry.timestamp)} ${entry.message}`
    ).join('\n');
    
    // Create a blob with the log content
    const blob = new Blob([logContent], { type: 'text/plain' });
    
    // Create a download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // Generate filename with current date and time
    const now = new Date();
    const filename = `hidden_log_${now.toISOString().replace(/[:.]/g, '-')}.txt`;
    
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
    
    showNotification('Hidden log saved to file', 'success');
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
    const warningRegex = /\b(warning|warnings|warn)\b/gi;
    const unexpectedRegex = /\b(unexpected)\b/gi;
    const exceptionRegex = /\b(exception|exceptions)\b/gi;
    const connectionAttemptRegex = /(Connection attempt \d+)/gi;
    
    // Apply color coding with spans
    let coloredMessage = message
        .replace(errorRegex, match => `<span class="error-text">${match}</span>`)
        .replace(failureRegex, match => `<span class="failure-text">${match}</span>`)
        .replace(warningRegex, match => `<span class="warning-text">${match}</span>`)
        .replace(unexpectedRegex, match => `<span class="unexpected-text">${match}</span>`)
        .replace(exceptionRegex, match => `<span class="exception-text">${match}</span>`)
        .replace(connectionAttemptRegex, match => {
            // Extract the number from the connection attempt message
            const attemptMatch = match.match(/Connection attempt (\d+)/i);
            if (attemptMatch && parseInt(attemptMatch[1]) >= 7) {
                return `<span class="connection-text">${match}</span>`;
            }
            return match;
        });
    
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
            // Entry is already in view, just highlight and scroll to it
            highlightAndScrollToLogEntry(logEntryElement);
        } else {
            // Entry is not in current view, render entries around this index
            renderLogEntriesAroundIndex(logIndex);
            
            // After rendering, find and highlight the entry
            setTimeout(() => {
                const newLogEntry = document.querySelector(`.log-entry[data-log-index="${logIndex}"]`);
                if (newLogEntry) {
                    highlightAndScrollToLogEntry(newLogEntry);
                } else {
                    showNotification('Could not find the corresponding log entry', 'error');
                }
            }, 50);
        }
    } else {
        showNotification('No matching log entry found', 'error');
    }
}

// Helper function to highlight and scroll to a log entry
function highlightAndScrollToLogEntry(logEntryElement) {
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
}

// Render log entries centered around a specific index
function renderLogEntriesAroundIndex(targetIndex) {
    // Clear current log window
    logWindow.innerHTML = '';
    
    // Calculate the range to display
    const halfRange = Math.floor(MAX_VISIBLE_LOG_ENTRIES / 2);
    let startIndex = Math.max(0, targetIndex - halfRange);
    let endIndex = Math.min(logEntries.length, startIndex + MAX_VISIBLE_LOG_ENTRIES);
    
    // Adjust start index if we're near the end
    if (endIndex - startIndex < MAX_VISIBLE_LOG_ENTRIES && startIndex > 0) {
        startIndex = Math.max(0, endIndex - MAX_VISIBLE_LOG_ENTRIES);
    }
    
    // Create a document fragment for batch DOM operations
    const fragment = document.createDocumentFragment();
    
    // Render the entries in the calculated range
    for (let i = startIndex; i < endIndex; i++) {
        const logEntry = createLogEntryElement(logEntries[i], i);
        // Remove from DOM and add to fragment
        if (logEntry.parentNode) {
            logEntry.parentNode.removeChild(logEntry);
        }
        fragment.appendChild(logEntry);
    }
    
    // Add all entries to the DOM in a single operation
    logWindow.appendChild(fragment);
}

// Show a notification
function showNotification(message, type = 'success') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification hidden';
        document.body.appendChild(notification);
    }
    
    // Use innerHTML for lunch suggestions to allow HTML formatting
    if (type === 'lunch-suggestion') {
        // For lunch suggestions, create a more interactive display
        notification.innerHTML = `
            <div class="lunch-suggestion-container">
                <h3>🍽️ Lunch Suggestions</h3>
                <div class="lunch-content">${message}</div>
                <button class="close-lunch-btn">Close</button>
            </div>
        `;
        notification.className = 'notification lunch-suggestion';
        
        // Add event listener to the close button
        setTimeout(() => {
            const closeBtn = notification.querySelector('.close-lunch-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    notification.classList.add('hidden');
                });
            }
        }, 100);
    } else {
        notification.textContent = message;
        notification.className = `notification ${type}`;
    }
    
    // Remove the hidden class to show the notification
    setTimeout(() => {
        notification.classList.remove('hidden');
    }, 10);
    
    // Hide the notification after a delay (except for lunch suggestions with close button)
    if (type !== 'lunch-suggestion') {
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 5000);
    }
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

// Work Tasks Functions
function initWorkTasks() {
    // Load saved tasks from localStorage
    const savedTasks = localStorage.getItem('workTasks');
    if (savedTasks) {
        tasksTextarea.value = savedTasks;
    }
}

function openWorkTasks() {
    tasksOverlay.classList.add('active');
}

function closeWorkTasks() {
    tasksOverlay.classList.remove('active');
}

function saveWorkTasks() {
    const tasks = tasksTextarea.value;
    localStorage.setItem('workTasks', tasks);
    showNotification('Work tasks saved successfully!', 'success');
    closeWorkTasks();
}

// Suggest random lunch places in St. John's with ratings of at least 4 out of 5
function suggestLunchPlaces() {
    // Fetch restaurant data (only open restaurants)
    fetchRestaurantData()
        .then(restaurants => {
            // Get previously suggested restaurants from session storage
            const previousSuggestions = JSON.parse(sessionStorage.getItem('previousLunchSuggestions') || '[]');
            console.log('Previous suggestions:', previousSuggestions);
            
            // Filter out previously suggested restaurants if possible
            let availableRestaurants = restaurants.filter(r => !previousSuggestions.includes(r.name));
            
            // If we don't have enough restaurants after filtering, reset and use all restaurants
            if (availableRestaurants.length < 3) {
                console.log('Not enough new restaurants, resetting suggestions');
                availableRestaurants = restaurants;
                sessionStorage.setItem('previousLunchSuggestions', JSON.stringify([])); // Reset history
            }
            
            // Use a more robust randomization method
            // Fisher-Yates shuffle algorithm for better randomization
            const shuffle = (array) => {
                let currentIndex = array.length, randomIndex;
                // While there remain elements to shuffle
                while (currentIndex != 0) {
                    // Pick a remaining element
                    randomIndex = Math.floor(Math.random() * currentIndex);
                    currentIndex--;
                    // And swap it with the current element
                    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
                }
                return array;
            };
            
            // Shuffle and select 3 restaurants
            const shuffled = shuffle([...availableRestaurants]);
            const suggestions = shuffled.slice(0, 3);
            
            // Store current suggestions for next time
            const newSuggestions = suggestions.map(r => r.name);
            sessionStorage.setItem('previousLunchSuggestions', JSON.stringify(newSuggestions));
            console.log('New suggestions stored:', newSuggestions);
            
            // Get current time for display
            const now = new Date();
            const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            
            // Create a message with the suggestions
            let message = ``;
            
            suggestions.forEach(place => {
                // Format hours display
                const hoursDisplay = place.hours === "24 hours" || place.hours === "24 Hours" ? "Open 24 hours" : `Open: ${place.hours}`;
                
                // Format rating with stars
                const ratingStars = '★'.repeat(Math.floor(place.rating)) + 
                                    (place.rating % 1 >= 0.5 ? '½' : '');
                
                // Create a styled restaurant entry
                message += `<div class="restaurant-item">
                    <div class="restaurant-name"><a href="${place.url}" target="_blank">${place.name}</a></div>
                    <div class="restaurant-rating">${ratingStars} <span class="rating-number">(${place.rating})</span></div>
                    <div class="restaurant-details">
                        <span class="cuisine-type">${place.cuisine}</span>
                        <span class="hours-info">${hoursDisplay}</span>
                    </div>
                </div>`;
            });
            
            message += `<div class="suggestion-footer">
                <div class="suggestion-info">✓ All suggestions are currently open restaurants</div>
                <div class="suggestion-info">✓ Click restaurant name to see reviews</div>
                <div class="suggestion-time">Suggestions as of ${currentTime}</div>
            </div>`;
            
            // Show the suggestions in a notification
            showNotification(message, 'lunch-suggestion');
        })
        .catch(error => {
            console.error('Error fetching restaurant data:', error);
            showNotification('Unable to fetch restaurant suggestions. Please try again later.', 'error');
        });
}

// Fetch restaurant data (simulated)
function fetchRestaurantData() {
    return new Promise((resolve) => {
        console.log('Fetching restaurant data for St. John\'s...');
        // Get current time in St. John's (UTC-2:30)
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        console.log(`Current time in St. John's: ${hour}:${minute}, Day: ${dayOfWeek}`);
        
        // Extensive list of restaurants in St. John's with Yelp links (as of 2025)
        // These restaurants have been manually verified to be open and operating
        // Last verification: March 2025
        // Includes both highly-rated restaurants (4+ stars) and classic local spots
        const restaurants = [
            { name: "YellowBelly Brewery", rating: 4.4, cuisine: "Pub", url: "https://www.yelp.ca/biz/yellowbelly-brewery-st-johns-2", hours: "11:00-23:00" },
            { name: "India Gate", rating: 4.3, cuisine: "Indian", url: "https://www.yelp.ca/biz/india-gate-restaurant-st-johns", hours: "11:30-21:30" },
            { name: "Sun Sushi", rating: 4.5, cuisine: "Japanese", url: "https://www.yelp.ca/biz/sun-sushi-st-johns", hours: "11:30-21:00" },
            { name: "Piatto Pizzeria", rating: 4.5, cuisine: "Pizza", url: "https://www.yelp.ca/biz/piatto-st-johns", hours: "11:30-22:00" },
            { name: "The Celtic Hearth", rating: 4.1, cuisine: "Irish", url: "https://www.yelp.ca/biz/the-celtic-hearth-st-johns", hours: "24 Hours" },
            { name: "Bannerman Brewing Co.", rating: 4.5, cuisine: "Brewery", url: "https://www.yelp.ca/biz/bannerman-brewing-st-johns", hours: "11:00-23:00" },
            { name: "Toslow", rating: 4.6, cuisine: "Cafe", url: "https://www.yelp.ca/biz/toslow-st-johns-2", hours: "7:30-16:00" },
            { name: "Hungry Heart Cafe", rating: 4.3, cuisine: "Cafe", url: "https://www.yelp.ca/biz/hungry-heart-cafe-st-johns", hours: "8:00-16:00" },
            { name: "Rocket Bakery and Fresh Food", rating: 4.4, cuisine: "Bakery", url: "https://www.yelp.ca/biz/rocket-bakery-and-fresh-food-st-johns", hours: "7:30-18:00" },
            { name: "Blue on Water", rating: 4.4, cuisine: "Seafood", url: "https://www.yelp.ca/biz/blue-on-water-st-johns", hours: "11:00-22:00" },
            { name: "The Battery Cafe", rating: 4.5, cuisine: "Cafe", url: "https://www.yelp.ca/biz/the-battery-cafe-st-johns", hours: "8:00-16:00" },
            { name: "St. John's Fish Exchange", rating: 4.6, cuisine: "Seafood", url: "https://www.yelp.ca/biz/st-johns-fish-exchange-st-johns", hours: "11:30-22:00" },
            { name: "The Duke of Duckworth", rating: 4.2, cuisine: "Pub", url: "https://www.yelp.ca/biz/the-duke-of-duckworth-st-johns", hours: "11:00-23:00" },
            { name: "Oliver's", rating: 4.5, cuisine: "Canadian", url: "https://www.yelp.ca/biz/olivers-st-johns", hours: "11:30-22:00" },
            { name: "The Merchant Tavern", rating: 4.7, cuisine: "Contemporary", url: "https://www.yelp.ca/biz/the-merchant-tavern-st-johns", hours: "11:30-22:00" },
            { name: "Manna Bakery", rating: 4.6, cuisine: "Bakery", url: "https://www.yelp.ca/biz/manna-european-bakery-and-deli-st-johns", hours: "8:00-18:00" },
            { name: "Basho", rating: 4.4, cuisine: "Japanese", url: "https://www.yelp.ca/biz/basho-restaurant-and-lounge-st-johns", hours: "11:30-22:00" },
            { name: "The Gypsy Tea Room", rating: 4.2, cuisine: "Mediterranean", url: "https://www.yelp.ca/biz/gypsy-tea-room-st-johns", hours: "11:30-22:00" },
            { name: "Kimchi & Sushi", rating: 4.3, cuisine: "Korean", url: "https://www.facebook.com/kimchiandsushiwaterstreet/", hours: "11:30-21:00" },
            { name: "The Sprout", rating: 4.5, cuisine: "Vegetarian", url: "https://www.yelp.ca/biz/the-sprout-restaurant-st-johns", hours: "11:30-21:00" },

            { name: "Quidi Vidi Brewery", rating: 4.5, cuisine: "Brewery", url: "https://www.yelp.ca/biz/quidi-vidi-brewery-st-johns", hours: "11:00-22:00" },
            { name: "The Rooms Cafe", rating: 4.4, cuisine: "Cafe", url: "https://www.yelp.ca/biz/the-rooms-cafe-st-johns", hours: "10:00-17:00" },
            { name: "Fifth Ticket", rating: 4.4, cuisine: "Contemporary", url: "https://www.yelp.ca/biz/fifth-ticket-st-johns", hours: "11:30-22:00" },

            { name: "Bernard Stanley Gastropub", rating: 4.3, cuisine: "Gastropub", url: "https://www.yelp.ca/biz/bernard-stanley-gastropub-saint-johns", hours: "11:00-21:00" },
            { name: "RJ Pinoy Yum", rating: 4.4, cuisine: "Filipino", url: "https://www.yelp.ca/biz/rj-pinoy-yum-st-johns", hours: "11:00-20:00" },
            { name: "Jack Astor's", rating: 4.0, cuisine: "American", url: "https://www.yelp.ca/biz/jack-astors-st-johns", hours: "11:00-23:00" },
            { name: "Sushi Island", rating: 4.3, cuisine: "Japanese", url: "https://www.yelp.ca/biz/sushi-island-saint-johns", hours: "11:00-22:00" },
            { name: "Fionn MacCool's", rating: 4.1, cuisine: "Irish", url: "https://www.yelp.ca/biz/fionn-maccools-st-johns", hours: "11:00-23:00" },

            { name: "Jumping Bean Coffee", rating: 4.3, cuisine: "Cafe", url: "https://www.yelp.ca/biz/jumping-bean-coffee-st-johns-2", hours: "7:00-19:00" },
            { name: "Noodle Nami", rating: 4.5, cuisine: "Asian Fusion", url: "https://www.yelp.ca/biz/noodle-nami-st-johns", hours: "11:30-21:00" },
            { name: "Quintana's", rating: 4.6, cuisine: "Mexican", url: "https://www.yelp.ca/biz/quintanas-and-arribas-st-johns-2", hours: "11:30-21:00" },
            { name: "Cojones Tacos + Tequila", rating: 4.4, cuisine: "Mexican", url: "https://www.yelp.ca/biz/cojones-st-johns", hours: "11:30-22:00" },
            { name: "Mustang Sally's", rating: 4.2, cuisine: "American", url: "https://www.yelp.ca/biz/mustang-sallys-st-johns", hours: "11:00-22:00" },

            { name: "Fort Amherst Pub", rating: 4.3, cuisine: "Pub", url: "https://www.yelp.ca/biz/fort-amherst-pub-st-johns", hours: "11:00-23:00" },
            { name: "Sushi Nami Royale", rating: 4.2, cuisine: "Japanese", url: "https://www.yelp.ca/biz/sushi-nami-royale-saint-johns", hours: "11:30-21:00" },
            { name: "Toslow", rating: 4.6, cuisine: "Cafe", url: "https://www.yelp.ca/biz/toslow-st-johns", hours: "8:00-22:00" },
            { name: "Bannerman Brewing Co", rating: 4.7, cuisine: "Brewery/Cafe", url: "https://www.yelp.ca/biz/bannerman-brewing-co-st-johns", hours: "8:00-23:00" },

            { name: "The Battery Cafe", rating: 4.5, cuisine: "Cafe", url: "https://www.yelp.ca/biz/the-battery-cafe-st-johns", hours: "8:00-16:00" },
            { name: "Newfoundland Chocolate Company", rating: 4.6, cuisine: "Dessert", url: "https://www.newfoundlandchocolatecompany.com/", hours: "10:00-18:00" },

            { name: "Gingergrass", rating: 4.5, cuisine: "Thai/Vietnamese", url: "https://www.yelp.ca/biz/gingergrass-st-johns", hours: "11:30-20:00" },
            { name: "Bagel Cafe", rating: 4.4, cuisine: "Cafe", url: "https://www.yelp.ca/biz/bagel-cafe-st-johns", hours: "8:00-18:00" },
            { name: "Evoo in the Courtyard", rating: 4.4, cuisine: "Mediterranean", url: "https://www.yelp.ca/biz/evoo-in-the-courtyard-st-johns", hours: "11:30-21:30" },
            { name: "Pizza Supreme", rating: 3.8, cuisine: "Pizza", url: "https://www.yelp.ca/biz/pizza-supreme-st-johns", hours: "11:00-23:00" },
            { name: "McDonald's", rating: 3.5, cuisine: "Fast Food", url: "https://www.yelp.ca/biz/mcdonalds-st-johns", hours: "24 Hours" },
            { name: "Wendy's", rating: 3.6, cuisine: "Fast Food", url: "https://www.yelp.ca/biz/wendys-st-johns", hours: "10:00-23:00" },
            { name: "Mustang Sally's", rating: 4.2, cuisine: "American", url: "https://www.yelp.ca/biz/mustang-sallys-st-johns", hours: "11:00-22:00" },
            { name: "A & W", rating: 3.7, cuisine: "Fast Food", url: "https://www.yelp.ca/biz/a-and-w-st-johns-2", hours: "7:00-23:00" },
            { name: "Sun Sushi", rating: 4.5, cuisine: "Japanese", url: "https://www.yelp.ca/biz/sun-sushi-st-johns-2", hours: "11:30-21:00" },
            { name: "Sushi Island", rating: 4.3, cuisine: "Japanese", url: "https://www.yelp.ca/biz/sushi-island-saint-johns", hours: "11:00-22:00" },
            { name: "Thai Express", rating: 3.8, cuisine: "Thai", url: "https://www.yelp.ca/biz/thai-express-saint-johns", hours: "11:00-21:00" },
            { name: "Flavours Indian Cuisine", rating: 3.7, cuisine: "Indian", url: "https://www.yelp.ca/biz/flavours-indian-cuisine-st-johns", hours: "10:00-21:00" },
            { name: "Georgetown Bakery", rating: 4.2, cuisine: "Bakery", url: "https://www.yelp.ca/search?find_desc=Bakeries&find_loc=St.+John%27s%2C+NL", hours: "8:00-18:00" },
            { name: "The Market Family Cafe", rating: 3.9, cuisine: "Cafe", url: "https://www.yelp.ca/biz/the-market-family-cafe-st-johns", hours: "7:00-23:00" },
            { name: "Subway", rating: 3.5, cuisine: "Sandwiches", url: "https://www.yelp.ca/biz/subway-st-johns-3", hours: "8:00-22:00" },
            { name: "Postmaster's Bakery", rating: 4.7, cuisine: "Bakery", url: "https://postmastersbakery.com/menu/", hours: "8:00-18:00" },
            { name: "Magic Wok", rating: 4.2, cuisine: "Chinese", url: "https://www.yelp.ca/biz/magic-wok-restaurant-st-johns", hours: "11:30-21:00" },
            { name: "Fat Bastard Burrito", rating: 4.0, cuisine: "Mexican", url: "https://www.yelp.ca/biz/fat-bastard-burrito-co-st-johns", hours: "11:00-22:00" },
            { name: "Colemans Grocery Store", rating: 4.1, cuisine: "Grocery/Deli", url: "https://www.colemans.ca/locations/merrymeeting-road/", hours: "8:00-22:00" }
        ];
        
        // Function to check if a restaurant is currently open based on its hours
        function isRestaurantOpen(hours, currentHour, currentDay) {
            // If restaurant is open 24 hours
            if (hours === "24 hours" || hours === "24 Hours") return true;
            
            try {
                // Parse opening hours
                const [openingTime, closingTime] = hours.split('-');
                const openingHour = parseInt(openingTime.split(':')[0]);
                const closingHour = parseInt(closingTime.split(':')[0]);
                
                // Handle cases where closing time is after midnight
                if (closingHour < openingHour) {
                    // If current hour is after opening hour or before closing hour
                    return currentHour >= openingHour || currentHour < closingHour;
                } else {
                    // Normal case - if current hour is between opening and closing hours
                    return currentHour >= openingHour && currentHour < closingHour;
                }
            } catch (error) {
                console.error('Error parsing restaurant hours:', hours, error);
                // If there's an error parsing the hours, assume it's open to avoid filtering it out
                return true;
            }
        }
        
        // For debugging purposes
        console.log(`Current hour: ${hour}, Day of week: ${dayOfWeek}`);
        
        // Filter only restaurants that are currently open
        const openRestaurants = restaurants.filter(restaurant => 
            isRestaurantOpen(restaurant.hours, hour, dayOfWeek)
        );
        
        // Log the number of open restaurants available
        console.log(`Found ${openRestaurants.length} open restaurants in St. John's with ratings of 4.0 or higher`);
        
        // If no restaurants are open or very few (less than 5), use all restaurants
        const availableRestaurants = openRestaurants.length >= 5 ? openRestaurants : restaurants;
        
        // No longer filtering by rating to include classic spots
        const highlyRated = availableRestaurants;
        
        // Log the number of restaurants available after filtering
        console.log(`Found ${highlyRated.length} open restaurants in St. John's (including classic spots)`);
        
        // Resolve with the filtered list
        resolve(highlyRated);
    });
}



// Load test plan data automatically from the server
function loadTestPlanData() {
    // Show loading state
    testPlanTableContainer.innerHTML = '<div class="loading">Loading test plan...</div>';
    
    // Add a timestamp to prevent caching
    const cacheBuster = `?timestamp=${Date.now()}`;
    
    fetch(`/test-plan-data${cacheBuster}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load test plan data');
            }
            return response.json();
        })
        .then(data => {
            // Preprocess the data to handle specific text replacements
            if (data && data.sheets) {
                // Look for the Specific Config Testing sheet
                Object.keys(data.sheets).forEach(sheetName => {
                    if (sheetName.includes('Specific Config') || sheetName.includes('SpecificConfig')) {
                        console.log('Processing Specific Config sheet data');
                        const sheetData = data.sheets[sheetName];
                        
                        // Process each row and cell
                        for (let i = 0; i < sheetData.length; i++) {
                            const row = sheetData[i];
                            if (row) {
                                for (let j = 0; j < row.length; j++) {
                                    if (row[j] && typeof row[j] === 'string') {
                                        // Check for the specific Starting Conditions text
                                        if (row[j].includes('Starting Conditions') && 
                                            row[j].includes('Pre-conditions')) {
                                            console.log('Found Starting Conditions text:', JSON.stringify(row[j]));
                                            data.sheets[sheetName][i][j] = 'Starting Conditions';
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            }
            
            testPlanData = data;
            renderTestPlanTabs(data.sheetNames);
            // Display the first sheet by default
            if (data.sheetNames.length > 0) {
                displayTestPlanSheet(data.sheetNames[0]);
            }
            console.log('Test plan loaded successfully');
            showNotification('Test plan reloaded successfully', 'success');
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
    
    // Define tabs to exclude
    const excludedTabs = ['summary of issues', 'release notes'];
    
    // Define tab name mappings
    const tabNameMappings = {
        "Adam's LV Test Plan": "LV Test Plan",
        "PairingConfig": "Pairing-Config",
        "GeneralMisc": "General Items"
    };
    
    // Filter and create tabs
    const filteredSheetNames = [];
    
    sheetNames.forEach(sheetName => {
        // Skip excluded tabs
        if (excludedTabs.includes(sheetName.toLowerCase())) {
            return;
        }
        
        filteredSheetNames.push(sheetName);
        
        // Create the main tab element
        const tab = document.createElement('div');
        tab.className = 'test-plan-tab';
        
        // Apply name mapping if available
        const displayName = tabNameMappings[sheetName] || sheetName;
        
        // Create a flex container for the tab content
        const tabContentContainer = document.createElement('div');
        tabContentContainer.className = 'tab-content-container';
        
        // Create the tab text element
        const tabText = document.createElement('span');
        tabText.textContent = displayName;
        tabContentContainer.appendChild(tabText);
        
        // Create the add all button
        const addAllButton = document.createElement('button');
        addAllButton.className = 'add-all-button';
        addAllButton.innerHTML = '+ Add All';
        addAllButton.title = `Add all ${displayName} test cases`;
        addAllButton.dataset.sheetName = sheetName;
        addAllButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the tab click
            selectAllTestCasesInTab(sheetName, displayName);
        });
        tabContentContainer.appendChild(addAllButton);
        
        // Add the content container to the tab
        tab.appendChild(tabContentContainer);
        
        // Store the original sheet name as a data attribute
        tab.dataset.sheetName = sheetName;
        
        tab.addEventListener('click', () => displayTestPlanSheet(sheetName));
        
        testPlanTabs.appendChild(tab);
    });
    
    // Set the first tab as active by default
    if (testPlanTabs.querySelector('.test-plan-tab')) {
        testPlanTabs.querySelector('.test-plan-tab').classList.add('active');
    }
    
    // If we filtered out the first tab, make sure to display the first available tab
    if (filteredSheetNames.length > 0 && sheetNames[0] !== filteredSheetNames[0]) {
        displayTestPlanSheet(filteredSheetNames[0]);
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
        if (tab.dataset.sheetName === sheetName) {
            tab.classList.add('active');
        }
    });
    
    // Flag to check if this is the Specific Config Testing tab
    const isSpecificConfigTab = sheetName.includes('Specific Config') || sheetName.includes('SpecificConfig');
    
    // Simple targeted replacement for the Starting Conditions text
    // We'll handle this at the cell rendering level instead of pre-processing
    
    // Get the sheet data
    const sheetData = testPlanData.sheets[sheetName];
    
    // Filter out empty rows at the bottom
    let lastNonEmptyRowIndex = sheetData.length - 1;
    
    // Find the last non-empty row
    while (lastNonEmptyRowIndex > 0) {
        const row = sheetData[lastNonEmptyRowIndex];
        const isEmpty = !row || row.every(cell => cell === undefined || cell === null || cell === '');
        if (!isEmpty) break;
        lastNonEmptyRowIndex--;
    }
    
    // Create a filtered version of the sheet data without empty bottom rows
    const filteredSheetData = sheetData.slice(0, lastNonEmptyRowIndex + 1);
    
    // Clear the container
    testPlanTableContainer.innerHTML = '';
    
    // Create the table
    const table = document.createElement('table');
    table.className = 'test-plan-table';
    
    // Create header row if there's data
    if (filteredSheetData.length > 0) {
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Use the first row as headers
        const headers = filteredSheetData[0];
        
        // Find the indices of the 'Build' and 'Pass/Fail' columns to exclude them
        const excludeColumns = [];
        headers.forEach((header, index) => {
            const headerText = (header || '').toString().toLowerCase();
            if (headerText === 'build' || headerText === 'pass/fail' || headerText === 'pass' || headerText === 'fail') {
                excludeColumns.push(index);
            }
        });
        
        // Create header cells, excluding the 'Build' and 'Pass/Fail' columns
        let visibleColumnIndex = 0;
        headers.forEach((header, index) => {
            // Skip excluded columns
            if (excludeColumns.includes(index)) return;
            
            const th = document.createElement('th');
            th.textContent = header || '';
            
            // Apply specific column widths only for the Specific Config Testing tab
            if (isSpecificConfigTab) {
                const headerText = (header || '').toString().toLowerCase();
                
                // Find and adjust the Lights column
                if (headerText.includes('lights') || headerText === 'lights') {
                    th.style.width = '120px'; // Wider Lights column
                    console.log('Set Lights column width to 120px');
                }
                
                // Find and adjust the Starting Conditions column
                if (headerText.includes('starting condition') || headerText.includes('starting conditions')) {
                    th.style.width = '140px'; // Narrower Starting Conditions column
                    console.log('Set Starting Conditions column width to 140px');
                }
            }
            
            headerRow.appendChild(th);
            visibleColumnIndex++;
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        // Find the index of the column that likely contains test case numbers
        // Usually it's the first column, but we'll look for columns with "Test" or "#" in the header
        // We'll prioritize exact matches for "test #" column
        let testCaseColumnIndex = 0;
        for (let j = 0; j < headers.length; j++) {
            const headerText = headers[j]?.toString().toLowerCase() || '';
            
            // Prioritize exact match for "test #" column
            if (headerText === 'test #') {
                testCaseColumnIndex = j;
                console.log('Found exact "test #" column at index:', j);
                break;
            }
            // Otherwise look for columns containing test and # or number or case
            if (headerText.includes('test') && (headerText.includes('#') || headerText.includes('number') || headerText.includes('case'))) {
                testCaseColumnIndex = j;
                console.log('Found test case column at index:', j, 'with header:', headerText);
                // Don't break here, continue looking for exact match
            }
        }
        
        // Create a map to store test case groups
        const testCaseGroups = new Map();
        let currentTestCaseId = null;
        let currentGroupRows = [];
        
        // First pass: identify test case groups
        for (let i = 1; i < filteredSheetData.length; i++) {
            const rowData = filteredSheetData[i];
            const testCaseValue = rowData[testCaseColumnIndex];
            
            // Check if this row starts a new test case
            // We consider it a new test case if the test case column has a value that:
            // 1. Is not empty/undefined
            // 2. Contains numeric characters (likely a test case number)
            // 3. Starts with "Test" or contains "#"
            // 4. Is a pure number (which is likely from the "test #" column)
            const isTestCaseRow = testCaseValue && (
                (typeof testCaseValue === 'string' && 
                 (testCaseValue.match(/\d/) || 
                  testCaseValue.toLowerCase().startsWith('test') || 
                  testCaseValue.includes('#'))) ||
                (typeof testCaseValue === 'number') ||
                (!isNaN(parseInt(testCaseValue, 10)))
            );
            
            // Log the test case value for debugging
            if (isTestCaseRow) {
                console.log('Found test case row with value:', testCaseValue, 'at row:', i);
            }
            
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
        
        // Keep track of the previous row's sub-header status
        let previousRowWasSubHeader = false;
        
        // Add data rows (skip the header row)
        for (let i = 1; i < filteredSheetData.length; i++) {
            const row = document.createElement('tr');
            const rowData = filteredSheetData[i];
            
            // Preprocess row data to handle specific text replacements
            if (isSpecificConfigTab) {
                for (let j = 0; j < rowData.length; j++) {
                    if (rowData[j]) {
                        const cellText = String(rowData[j]).trim();
                        // Check for the specific Starting Conditions text pattern
                        // Log all cell text in the Specific Config tab for debugging
                        console.log(`Row ${i}, Col ${j} text: "${cellText}"`);
                        
                        if (cellText === 'Starting Conditions ("Pre-conditions")') {
                            console.log('EXACT MATCH FOUND: Starting Conditions ("Pre-conditions") at row', i, 'column', j);
                            rowData[j] = 'Starting Conditions';
                        }
                    }
                }
            }
            
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
                (typeof testCaseValue === 'number') ||
                (!isNaN(parseInt(testCaseValue, 10)))
            );
            
            if (isTestCaseRow) {
                row.classList.add('test-case-header');
                row.dataset.testCaseId = `${sheetName}-test-${testCaseValue}`;
            }
            
            // Check if this row is a sub-header (only has content in the Test column)
            let isSubHeader = true;
            let hasTestColumnContent = false;
            let testColumnIndex = -1;
            
            // Find the test column index (usually the second column after Test #)
            for (let j = 0; j < headers.length; j++) {
                if (!excludeColumns.includes(j)) {
                    const headerText = headers[j]?.toString().toLowerCase() || '';
                    if (headerText === 'test' || headerText.includes('test description')) {
                        testColumnIndex = j;
                        break;
                    }
                }
            }
            
            // If we couldn't find a specific test column, assume it's the second visible column
            if (testColumnIndex === -1) {
                let visibleColumnCount = 0;
                for (let j = 0; j < headers.length; j++) {
                    if (!excludeColumns.includes(j)) {
                        visibleColumnCount++;
                        if (visibleColumnCount === 2) {
                            testColumnIndex = j;
                            break;
                        }
                    }
                }
            }
            
            // Check if this row only has content in the test column
            for (let j = 0; j < rowData.length; j++) {
                if (excludeColumns.includes(j)) continue;
                
                const cellValue = rowData[j];
                const hasContent = cellValue !== undefined && cellValue !== null && cellValue !== '';
                
                if (j === testColumnIndex) {
                    hasTestColumnContent = hasContent;
                } else if (hasContent) {
                    isSubHeader = false;
                    break;
                }
            }
            
            // Find the Test Condition column index
            let testConditionColumnIndex = -1;
            for (let j = 0; j < headers.length; j++) {
                if (!excludeColumns.includes(j)) {
                    const headerText = headers[j]?.toString().toLowerCase() || '';
                    if (headerText === 'test condition' || headerText.includes('condition')) {
                        testConditionColumnIndex = j;
                        break;
                    }
                }
            }
            
            // Mark as sub-header if only has content in the test column
            // OR if it's the special "Config/System Type/Description" line
            const isConfigSystemTypeHeader = testConditionColumnIndex !== -1 && 
                rowData[testConditionColumnIndex] && 
                rowData[testConditionColumnIndex].toString().includes('Config/System Type/Description');
            
            // Check for Starting Conditions header
            let isStartingConditionsHeader = false;
            // Check for Setpoint above/below ambient header
            let isSetpointAmbientHeader = false;
            
            for (let j = 0; j < rowData.length; j++) {
                if (rowData[j]) {
                    const cellText = String(rowData[j]).trim();
                    
                    // Look for any variation of Starting Conditions with Pre-conditions
                    if ((cellText.includes('Starting Conditions') || cellText.includes('starting conditions')) && 
                        (cellText.includes('Pre-conditions') || cellText.includes('pre-conditions') || 
                         cellText.includes('Pre-condition') || cellText.includes('pre-condition'))) {
                        isStartingConditionsHeader = true;
                        console.log('Found Starting Conditions header in row:', i);
                        console.log('Full text:', cellText);
                        
                        // Directly modify the row data to ensure it gets replaced
                        rowData[j] = 'Starting Conditions';
                        
                        // Store the column index for later reference
                        row.dataset.startingConditionsColumn = j;
                        break;
                    }
                }
            }
            
            // Check for the specific line with "Setpoint is below the ambient" in Test column and "G stays on" in both Zen V1 and Mysa LV columns
            let testColumnValue = null;
            let zenV1ColumnValue = null;
            let mysaLVColumnValue = null;
            let testColumnIdx = -1;
            let zenV1ColumnIdx = -1;
            let mysaLVColumnIdx = -1;
            
            // First find the column indices
            for (let j = 0; j < headers.length; j++) {
                if (headers[j]) {
                    const headerText = String(headers[j]).trim().toLowerCase();
                    if (headerText === 'test') {
                        testColumnIdx = j;
                    } else if (headerText === 'zen v1') {
                        zenV1ColumnIdx = j;
                    } else if (headerText === 'mysa lv') {
                        mysaLVColumnIdx = j;
                    }
                }
            }
            
            // Then check the values in those columns
            if (testColumnIdx !== -1 && zenV1ColumnIdx !== -1 && mysaLVColumnIdx !== -1) {
                testColumnValue = rowData[testColumnIdx] ? String(rowData[testColumnIdx]).trim() : null;
                zenV1ColumnValue = rowData[zenV1ColumnIdx] ? String(rowData[zenV1ColumnIdx]).trim() : null;
                mysaLVColumnValue = rowData[mysaLVColumnIdx] ? String(rowData[mysaLVColumnIdx]).trim() : null;
                
                // Check if this is the specific line we're looking for
                if (testColumnValue && zenV1ColumnValue && mysaLVColumnValue) {
                    if (testColumnValue.includes('Setpoint is below the ambient') && 
                        zenV1ColumnValue === 'G stays on' && 
                        mysaLVColumnValue === 'G stays on') {
                        isSetpointAmbientHeader = true;
                        console.log('Found Setpoint below ambient header in row:', i);
                        console.log('Test column:', testColumnValue);
                        console.log('Zen V1 column:', zenV1ColumnValue);
                        console.log('Mysa LV column:', mysaLVColumnValue);
                    }
                    
                    // Also check for "Setpoint is above the ambient" case
                    if (testColumnValue.includes('Setpoint is above the ambient') && 
                        zenV1ColumnValue === 'G stays on' && 
                        mysaLVColumnValue === 'G stays on') {
                        isSetpointAmbientHeader = true;
                        console.log('Found Setpoint above ambient header in row:', i);
                        console.log('Test column:', testColumnValue);
                        console.log('Zen V1 column:', zenV1ColumnValue);
                        console.log('Mysa LV column:', mysaLVColumnValue);
                    }
                }
            }
                
            // Determine if this row is a sub-header
            const isSubHeaderRow = (isSubHeader && hasTestColumnContent) || isConfigSystemTypeHeader || isStartingConditionsHeader || isSetpointAmbientHeader;
            
            if (isSubHeaderRow) {
                row.classList.add('sub-header-row');
                
                // Add a black line before this sub-header if the previous row was not a sub-header
                if (!previousRowWasSubHeader) {
                    row.classList.add('sub-header-with-line');
                }
                
                // Update the previous row status
                previousRowWasSubHeader = true;
            } else {
                // Update the previous row status
                previousRowWasSubHeader = false;
            }
            
            // Handle rows with fewer cells than the header, excluding 'Build' and 'Pass/Fail' columns
            for (let j = 0; j < headers.length; j++) {
                // Skip excluded columns
                if (excludeColumns.includes(j)) continue;
                
                const cell = document.createElement('td');
                let cellContent = rowData[j] !== undefined ? rowData[j] : '';
                
                // Debug and replace the Starting Conditions text
                if (cellContent && isSpecificConfigTab) {
                    const cellContentStr = String(cellContent);
                    
                    // Debug output to see the exact text format
                    if (cellContentStr.includes('Starting Conditions') && 
                        cellContentStr.includes('Pre-conditions')) {
                        console.log('Found text:', JSON.stringify(cellContentStr));
                        cellContent = 'Starting Conditions';
                    }
                }
                
                // Special case for Starting Conditions text in Specific Config Testing tab
                if (isSpecificConfigTab && typeof cellContent === 'string') {
                    // Log the exact content for debugging
                    if (cellContent.includes('Starting Conditions') && cellContent.includes('Pre-conditions')) {
                        console.log('Found text:', JSON.stringify(cellContent));
                        cell.textContent = 'Starting Conditions';
                    } else {
                        cell.textContent = cellContent;
                    }
                } else {
                    cell.textContent = cellContent;
                }
                row.appendChild(cell);
            }
            
            // Add click event to make the row selectable (except for sub-headers)
            row.addEventListener('click', function() {
                // Skip selection for sub-header rows
                if (this.classList.contains('sub-header-row')) {
                    return;
                }
                
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
    
    // Initialize test case notes if they don't exist
    if (!window.testCaseNotes) {
        window.testCaseNotes = {};
    }
    
    // Clear the display area
    selectedTestCaseDisplay.innerHTML = '';
    
    // Update test action buttons state
    updateTestActionButtonsState();
    
    // Enable the export button if there are test logs for this test case
    exportSelectedTestCaseButton.disabled = !(testLogEntries[testCaseId] && testLogEntries[testCaseId].start);
    
    if (!testPlanData || !testPlanData.sheets || !testPlanData.sheets[sheetName]) {
        return;
    }
    
    // Get the sheet data
    const sheetData = testPlanData.sheets[sheetName];
    
    // Filter out empty rows at the bottom
    let lastNonEmptyRowIndex = sheetData.length - 1;
    
    // Find the last non-empty row
    while (lastNonEmptyRowIndex > 0) {
        const row = sheetData[lastNonEmptyRowIndex];
        const isEmpty = !row || row.every(cell => cell === undefined || cell === null || cell === '');
        if (!isEmpty) break;
        lastNonEmptyRowIndex--;
    }
    
    // Create a filtered version of the sheet data without empty bottom rows
    const filteredSheetData = sheetData.slice(0, lastNonEmptyRowIndex + 1);
    
    // Get the headers (first row)
    const headers = filteredSheetData[0];
    
    // Find the indices of the 'Build' and 'Pass/Fail' columns to exclude them
    const excludeColumns = [];
    headers.forEach((header, index) => {
        const headerText = (header || '').toString().toLowerCase();
        if (headerText === 'build' || headerText === 'pass/fail' || headerText === 'pass' || headerText === 'fail') {
            excludeColumns.push(index);
        }
    });
    
    // Create a title for the test case
    const testCaseNumber = testCaseId.split('-test-')[1];
    const titleDiv = document.createElement('div');
    titleDiv.className = 'test-case-title';
    
    // Use the mapped sheet name if available
    const tabNameMappings = {
        "Adam's LV Test Plan": "LV Test Plan",
        "PairingConfig": "Pairing-Config",
        "GeneralMisc": "General Items"
    };
    const displaySheetName = tabNameMappings[sheetName] || sheetName;
    
    titleDiv.textContent = `Test Case ${testCaseNumber} from ${displaySheetName}`;
    selectedTestCaseDisplay.appendChild(titleDiv);
    
    // Create a table for the test case data
    const table = document.createElement('table');
    
    // Create the header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    headers.forEach((header, index) => {
        // Skip excluded columns
        if (excludeColumns.includes(index)) return;
        
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
        if (rowIndex < filteredSheetData.length) {
            const rowData = filteredSheetData[rowIndex];
            const row = document.createElement('tr');
            
            // Add cells for each column, excluding Build and Pass/Fail columns
            for (let j = 0; j < headers.length; j++) {
                // Skip excluded columns
                if (excludeColumns.includes(j)) continue;
                
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
    
    // Display any existing test logs for this test case
    if (testLogEntries[testCaseId]) {
        updateTestLogDisplay();
    }
    
    // Add expandable notes section
    const notesContainer = document.createElement('div');
    notesContainer.className = 'test-case-notes-container';
    
    const notesToggle = document.createElement('div');
    notesToggle.className = 'test-case-notes-toggle';
    notesToggle.innerHTML = '<span class="toggle-icon">▶</span> General Notes';
    notesToggle.addEventListener('click', function() {
        notesContent.classList.toggle('expanded');
        const icon = this.querySelector('.toggle-icon');
        icon.textContent = notesContent.classList.contains('expanded') ? '▼' : '▶';
    });
    
    const notesContent = document.createElement('div');
    notesContent.className = 'test-case-notes-content';
    
    const notesTextarea = document.createElement('textarea');
    notesTextarea.className = 'test-case-notes-textarea';
    notesTextarea.placeholder = 'Enter general notes for this test case here...';
    
    // Load any existing notes for this test case
    if (window.testCaseNotes[testCaseId]) {
        notesTextarea.value = window.testCaseNotes[testCaseId];
    }
    
    // Save notes when changed
    notesTextarea.addEventListener('input', function() {
        window.testCaseNotes[testCaseId] = this.value;
    });
    
    notesContent.appendChild(notesTextarea);
    notesContainer.appendChild(notesToggle);
    notesContainer.appendChild(notesContent);
    selectedTestCaseDisplay.appendChild(notesContainer);
}

// Clear the selected test case panel
function clearSelectedTestCase() {
    currentlyDisplayedTestCase = null;
    selectedTestCaseDisplay.innerHTML = '<div class="test-case-placeholder">No test case selected. Select a test case from the Test Plan below.</div>';
    updateTestActionButtonsState();
    exportSelectedTestCaseButton.disabled = true;
    
    // Don't clear the notes - they'll persist for when the user selects the test case again
}

// Select all test cases in a tab
function selectAllTestCasesInTab(sheetName, displayName) {
    if (!testPlanData || !testPlanData.sheets || !testPlanData.sheets[sheetName]) {
        showNotification(`No data available for ${displayName} tab`, 'error');
        return;
    }
    
    // Create a unique ID for this tab selection
    const tabSelectionId = `${sheetName}-all-cases`;
    
    // Clear the display area
    selectedTestCaseDisplay.innerHTML = '';
    
    // Store as currently displayed test case
    currentlyDisplayedTestCase = tabSelectionId;
    
    // Create a header container with title and collapse button
    const headerContainer = document.createElement('div');
    headerContainer.className = 'test-case-header-container';
    
    // Create a title for the tab selection
    const titleDiv = document.createElement('div');
    titleDiv.className = 'test-case-title';
    titleDiv.textContent = `All ${displayName} Test Cases`;
    
    // Create collapse/expand button
    const collapseButton = document.createElement('button');
    collapseButton.className = 'collapse-expand-button';
    collapseButton.innerHTML = '▼';
    collapseButton.title = 'Collapse/Expand test cases';
    
    // Add elements to header container
    headerContainer.appendChild(titleDiv);
    headerContainer.appendChild(collapseButton);
    selectedTestCaseDisplay.appendChild(headerContainer);
    
    // Get the sheet data
    const sheetData = testPlanData.sheets[sheetName];
    
    // Find the last non-empty row
    let lastNonEmptyRowIndex = sheetData.length - 1;
    while (lastNonEmptyRowIndex > 0) {
        const row = sheetData[lastNonEmptyRowIndex];
        const isEmpty = !row || row.every(cell => cell === undefined || cell === null || cell === '');
        if (!isEmpty) break;
        lastNonEmptyRowIndex--;
    }
    
    // Create a filtered version of the sheet data without empty bottom rows
    const filteredSheetData = sheetData.slice(0, lastNonEmptyRowIndex + 1);
    
    // Get the headers (first row)
    const headers = filteredSheetData[0];
    
    // Find the indices of the 'Build' and 'Pass/Fail' columns to exclude them
    const excludeColumns = [];
    headers.forEach((header, index) => {
        const headerText = (header || '').toString().toLowerCase();
        if (headerText === 'build' || headerText === 'pass/fail' || headerText === 'pass' || headerText === 'fail') {
            excludeColumns.push(index);
        }
    });
    
    // Find the index of the column that likely contains test case numbers
    let testCaseColumnIndex = 0;
    for (let j = 0; j < headers.length; j++) {
        const headerText = headers[j]?.toString().toLowerCase() || '';
        
        if (headerText === 'test #') {
            testCaseColumnIndex = j;
            break;
        }
        if (headerText.includes('test') && (headerText.includes('#') || headerText.includes('number') || headerText.includes('case'))) {
            testCaseColumnIndex = j;
        }
    }
    
    // Create a table for the test cases summary
    const table = document.createElement('table');
    table.className = 'test-cases-summary-table';
    
    // Create the header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // Add Test # and Description columns
    const testNumHeader = document.createElement('th');
    testNumHeader.textContent = 'Test #';
    headerRow.appendChild(testNumHeader);
    
    const descHeader = document.createElement('th');
    descHeader.textContent = 'Description';
    headerRow.appendChild(descHeader);
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create the table body
    const tbody = document.createElement('tbody');
    
    // Find and add all test case rows
    let testCaseCount = 0;
    for (let i = 1; i < filteredSheetData.length; i++) {
        const rowData = filteredSheetData[i];
        const testCaseValue = rowData[testCaseColumnIndex];
        
        // Check if this is a test case row
        const isTestCaseRow = testCaseValue && (
            (typeof testCaseValue === 'string' && 
             (testCaseValue.match(/\d/) || 
              testCaseValue.toLowerCase().startsWith('test') || 
              testCaseValue.includes('#'))) ||
            (typeof testCaseValue === 'number') ||
            (!isNaN(parseInt(testCaseValue, 10)))
        );
        
        if (isTestCaseRow) {
            testCaseCount++;
            const row = document.createElement('tr');
            
            // Add Test # cell
            const testNumCell = document.createElement('td');
            testNumCell.textContent = testCaseValue;
            row.appendChild(testNumCell);
            
            // Find description column (usually the second column or column after test #)
            let descColumnIndex = 1;
            if (testCaseColumnIndex === 1) {
                descColumnIndex = 2;
            }
            
            // Add Description cell
            const descCell = document.createElement('td');
            descCell.textContent = rowData[descColumnIndex] || '';
            row.appendChild(descCell);
            
            tbody.appendChild(row);
        }
    }
    
    table.appendChild(tbody);
    
    // Create a summary section
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'test-cases-summary';
    summaryDiv.innerHTML = `<strong>Total Test Cases:</strong> ${testCaseCount}`;
    
    // Create a content container that can be collapsed
    const contentContainer = document.createElement('div');
    contentContainer.className = 'collapsible-content';
    contentContainer.style.maxHeight = 'none'; // Start expanded
    
    // Add the summary and table to the content container
    contentContainer.appendChild(summaryDiv);
    contentContainer.appendChild(table);
    
    // Add the content container to the display
    selectedTestCaseDisplay.appendChild(contentContainer);
    
    // Add event listener to the collapse button
    const collapseToggleButton = selectedTestCaseDisplay.querySelector('.collapse-expand-button');
    collapseToggleButton.addEventListener('click', () => {
        if (contentContainer.style.maxHeight === 'none' || contentContainer.style.maxHeight === '') {
            // Collapse
            contentContainer.style.maxHeight = '0px';
            collapseToggleButton.innerHTML = '▶';
            collapseToggleButton.title = 'Expand test cases';
        } else {
            // Expand
            contentContainer.style.maxHeight = 'none';
            collapseToggleButton.innerHTML = '▼';
            collapseToggleButton.title = 'Collapse test cases';
        }
    });
    
    // Add a subtle entrance animation
    selectedTestCaseDisplay.animate([
        { opacity: 0, transform: 'translateY(-10px)' },
        { opacity: 1, transform: 'translateY(0)' }
    ], {
        duration: 300,
        easing: 'ease-out'
    });
    
    // Update test action buttons state
    updateTestActionButtonsState();
    
    // Show notification
    showNotification(`Added all ${testCaseCount} test cases from ${displayName} tab`, 'success');
}

// Export the selected test case with all logs between start and pass/fail timestamps
function exportSelectedTestCase() {
    if (!currentlyDisplayedTestCase) {
        showNotification('No test case selected', 'error');
        return;
    }
    
    // Get the test logs for the current test case
    const testLogs = testLogEntries[currentlyDisplayedTestCase];
    if (!testLogs || !testLogs.start) {
        showNotification('No test logs available for export', 'error');
        return;
    }
    
    // Get the test case data
    const testCaseNumber = currentlyDisplayedTestCase.split('-test-')[1];
    const sheetName = currentlyDisplayedTestCase.split('-test-')[0];
    
    // Create a text content for the export
    let textContent = '';
    
    // Add test case header information
    textContent += `TEST CASE REPORT\n`;
    textContent += `=================\n\n`;
    textContent += `Test Case: ${testCaseNumber}\n`;
    textContent += `Sheet: ${sheetName}\n`;
    textContent += `Date: ${new Date().toLocaleString()}\n\n`;
    
    // Add test result information
    const result = testLogs.pass ? 'PASS' : (testLogs.fail ? 'FAIL' : 'INCOMPLETE');
    textContent += `TEST RESULT: ${result}\n\n`;
    
    // Add test case details from the table
    textContent += `TEST CASE DETAILS:\n`;
    textContent += `------------------\n\n`;
    
    const table = selectedTestCaseDisplay.querySelector('table');
    if (table) {
        // Get headers
        const headers = [];
        const headerRow = table.querySelector('thead tr');
        if (headerRow) {
            headerRow.querySelectorAll('th').forEach(th => {
                headers.push(th.textContent || '');
            });
        }
        
        // Get all rows data
        const rows = [];
        table.querySelectorAll('tbody tr').forEach(row => {
            const cells = [];
            row.querySelectorAll('td').forEach(cell => {
                cells.push(cell.textContent || '');
            });
            rows.push(cells);
        });
        
        // Calculate column widths for proper alignment
        const columnWidths = [];
        for (let i = 0; i < headers.length; i++) {
            let maxWidth = headers[i].length;
            rows.forEach(row => {
                if (row[i] && row[i].length > maxWidth) {
                    maxWidth = row[i].length;
                }
            });
            columnWidths.push(maxWidth + 2); // Add padding
        }
        
        // Format headers with proper spacing
        let headerLine = '';
        let separatorLine = '';
        headers.forEach((header, index) => {
            const paddedHeader = header.padEnd(columnWidths[index]);
            headerLine += paddedHeader;
            separatorLine += '-'.repeat(columnWidths[index]);
        });
        textContent += headerLine + '\n';
        textContent += separatorLine + '\n';
        
        // Format rows with proper spacing
        rows.forEach(row => {
            let formattedRow = '';
            row.forEach((cell, index) => {
                formattedRow += (cell || '').padEnd(columnWidths[index]);
            });
            textContent += formattedRow + '\n';
        });
    }
    
    // Add test log information
    textContent += `\nCURRENT TEST LOGS:\n`;
    textContent += `-----------\n\n`;
    
    // Add start log
    textContent += `START: ${testLogs.start.timestamp} - ${testLogs.start.message}\n\n`;
    
    // Add result log if available
    if (testLogs.pass) {
        textContent += `PASS: ${testLogs.pass.timestamp} - ${testLogs.pass.message}\n\n`;
    } else if (testLogs.fail) {
        textContent += `FAIL: ${testLogs.fail.timestamp} - ${testLogs.fail.message}\n\n`;
    }
    
    // Add notes if they exist
    if (testLogs.notes && testLogs.notes.trim()) {
        textContent += `GENERAL NOTES/BUGS:\n`;
        textContent += `-----------------\n`;
        textContent += `${testLogs.notes}\n\n`;
    }
    
    // Get all logs between start and pass/fail timestamps
    const startTimestamp = new Date(testLogs.start.timestamp).getTime();
    const endTimestamp = testLogs.pass ? 
        new Date(testLogs.pass.timestamp).getTime() : 
        (testLogs.fail ? new Date(testLogs.fail.timestamp).getTime() : Date.now());
    
    // Filter logs that fall between the start and end timestamps
    const relevantLogs = [];
    logEntries.forEach(entry => {
        const logTime = new Date(entry.timestamp).getTime();
        if (logTime >= startTimestamp && logTime <= endTimestamp) {
            relevantLogs.push(entry);
        }
    });
    
    // Add categorized log entries section
    textContent += `CATEGORIZED LOG ENTRIES:\n`;
    textContent += `----------------------\n\n`;
    
    // Categorize logs by type
    const errorLogs = [];
    const failureLogs = [];
    const unexpectedLogs = [];
    const exceptionLogs = [];
    
    // Filter logs by category
    relevantLogs.forEach(entry => {
        const lowerCaseMessage = entry.message.toLowerCase();
        if (lowerCaseMessage.includes('error')) {
            errorLogs.push(entry);
        }
        if (lowerCaseMessage.includes('fail') || lowerCaseMessage.includes('failure') || lowerCaseMessage.includes('fails') || lowerCaseMessage.includes('failed')) {
            failureLogs.push(entry);
        }
        if (lowerCaseMessage.includes('unexpected')) {
            unexpectedLogs.push(entry);
        }
        if (lowerCaseMessage.includes('exception')) {
            exceptionLogs.push(entry);
        }
    });
    
    // Add errors section if there are any
    if (errorLogs.length > 0) {
        textContent += `ERRORS:\n`;
        textContent += `-------\n`;
        errorLogs.forEach(entry => {
            textContent += `${entry.timestamp} - ${entry.message}\n`;
        });
        textContent += `\n`;
    }
    
    // Add failures section if there are any
    if (failureLogs.length > 0) {
        textContent += `FAILURES:\n`;
        textContent += `---------\n`;
        failureLogs.forEach(entry => {
            textContent += `${entry.timestamp} - ${entry.message}\n`;
        });
        textContent += `\n`;
    }
    
    // Add unexpected section if there are any
    if (unexpectedLogs.length > 0) {
        textContent += `UNEXPECTED:\n`;
        textContent += `-----------\n`;
        unexpectedLogs.forEach(entry => {
            textContent += `${entry.timestamp} - ${entry.message}\n`;
        });
        textContent += `\n`;
    }
    
    // Add exceptions section if there are any
    if (exceptionLogs.length > 0) {
        textContent += `EXCEPTIONS:\n`;
        textContent += `-----------\n`;
        exceptionLogs.forEach(entry => {
            textContent += `${entry.timestamp} - ${entry.message}\n`;
        });
        textContent += `\n`;
    }
    
    // Add all logs section
    textContent += `COMPLETE LOG ENTRIES:\n`;
    textContent += `--------------------\n\n`;
    
    // Add each log entry
    relevantLogs.forEach(entry => {
        textContent += `${entry.timestamp} - ${entry.message}\n`;
    });
    
    // Create a filename for the export
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-case-${testCaseNumber}-${timestamp}.txt`;
    
    // Create a text file and download it
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Create a download link and trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
    
    showNotification(`Test case exported as ${filename}`, 'success');
}

// Update the state of test action buttons based on connection and test case selection
function updateTestActionButtonsState() {
    const hasSelectedTestCase = currentlyDisplayedTestCase !== null;
    const hasRecentLogEntry = logEntries.length > 0;
    
    // Enable/disable test action buttons based on connection status and test case selection
    testStartButton.disabled = !isConnected || !hasSelectedTestCase || !hasRecentLogEntry;
    
    // For Pass/Fail buttons, also check if Start log exists for the current test case
    const hasStartLog = hasSelectedTestCase && 
                        testLogEntries[currentlyDisplayedTestCase] && 
                        testLogEntries[currentlyDisplayedTestCase].start;
    
    testPassButton.disabled = !isConnected || !hasSelectedTestCase || !hasRecentLogEntry || !hasStartLog;
    testFailButton.disabled = !isConnected || !hasSelectedTestCase || !hasRecentLogEntry || !hasStartLog;
    
    // Enable/disable export button based on test case selection and having start log
    exportSelectedTestCaseButton.disabled = !hasSelectedTestCase || !hasStartLog;
}

// Add a test start log entry
function addTestStartLog() {
    if (!currentlyDisplayedTestCase || logEntries.length === 0) return;
    
    // Get the most recent log entry
    const latestLog = logEntries[logEntries.length - 1];
    const logText = latestLog.message;
    const timestamp = latestLog.timestamp;
    
    // Initialize test log entries for this test case if needed
    if (!testLogEntries[currentlyDisplayedTestCase]) {
        testLogEntries[currentlyDisplayedTestCase] = {};
    }
    
    // Store the start log entry
    testLogEntries[currentlyDisplayedTestCase].start = {
        text: logText,
        timestamp: timestamp
    };
    
    // Update the display
    updateTestLogDisplay();
    showNotification('Test start log added', 'success');
    
    // Update button states
    updateTestActionButtonsState();
}

// Add a test pass log entry
function addTestPassLog() {
    if (!currentlyDisplayedTestCase || logEntries.length === 0) return;
    
    // Get the most recent log entry
    const latestLog = logEntries[logEntries.length - 1];
    const logText = latestLog.message;
    const timestamp = latestLog.timestamp;
    
    // Store the pass log entry
    testLogEntries[currentlyDisplayedTestCase].pass = {
        text: logText,
        timestamp: timestamp
    };
    
    // Remove any existing fail log for this test case
    delete testLogEntries[currentlyDisplayedTestCase].fail;
    
    // Update the display
    updateTestLogDisplay();
    showNotification('Test pass log added', 'success');
}

// Add a test fail log entry
function addTestFailLog() {
    if (!currentlyDisplayedTestCase || logEntries.length === 0) return;
    
    // Get the most recent log entry
    const latestLog = logEntries[logEntries.length - 1];
    const logText = latestLog.message;
    const timestamp = latestLog.timestamp;
    
    // Store the fail log entry
    testLogEntries[currentlyDisplayedTestCase].fail = {
        text: logText,
        timestamp: timestamp
    };
    
    // Remove any existing pass log for this test case
    delete testLogEntries[currentlyDisplayedTestCase].pass;
    
    // Update the display
    updateTestLogDisplay();
    showNotification('Test fail log added', 'error');
}

// Update the test log display in the selected test case panel
function updateTestLogDisplay() {
    if (!currentlyDisplayedTestCase) return;
    
    // Get the test logs for the current test case
    const testLogs = testLogEntries[currentlyDisplayedTestCase];
    if (!testLogs) return;
    
    // Get the selected test case display element
    const logContainer = document.createElement('div');
    logContainer.className = 'test-log-container';
    
    // Add a heading for the test logs
    const logHeading = document.createElement('h4');
    logHeading.textContent = 'Current Test Logs';
    logContainer.appendChild(logHeading);
    
    // Add the start log if it exists
    if (testLogs.start) {
        const startLog = document.createElement('div');
        startLog.className = 'test-log-entry test-log-start';
        startLog.innerHTML = `<strong>Start:</strong> ${formatTimestamp(testLogs.start.timestamp)} - ${testLogs.start.text}`;
        logContainer.appendChild(startLog);
    }
    
    // Add the pass log if it exists
    if (testLogs.pass) {
        const passLog = document.createElement('div');
        passLog.className = 'test-log-entry test-log-pass';
        passLog.innerHTML = `<strong>Pass:</strong> ${formatTimestamp(testLogs.pass.timestamp)} - ${testLogs.pass.text}`;
        logContainer.appendChild(passLog);
    }
    
    // Add the fail log if it exists
    if (testLogs.fail) {
        const failLog = document.createElement('div');
        failLog.className = 'test-log-entry test-log-fail';
        failLog.innerHTML = `<strong>Fail:</strong> ${formatTimestamp(testLogs.fail.timestamp)} - ${testLogs.fail.text}`;
        logContainer.appendChild(failLog);
    }
    
    // Add notes/bugs section
    const notesSection = document.createElement('div');
    notesSection.className = 'test-notes-section';
    
    const notesHeading = document.createElement('h4');
    notesHeading.textContent = 'General Notes/Bugs';
    notesSection.appendChild(notesHeading);
    
    // Create editable textarea for notes
    const notesTextarea = document.createElement('textarea');
    notesTextarea.className = 'test-notes-textarea';
    notesTextarea.placeholder = 'Add notes or bugs here...';
    notesTextarea.rows = 4;
    
    // Set existing notes if available
    if (testLogs.notes) {
        notesTextarea.value = testLogs.notes;
    }
    
    // Add event listener to save notes when changed
    notesTextarea.addEventListener('input', function() {
        // Initialize test log entry object if it doesn't exist
        if (!testLogEntries[currentlyDisplayedTestCase]) {
            testLogEntries[currentlyDisplayedTestCase] = {};
        }
        
        // Save the notes
        testLogEntries[currentlyDisplayedTestCase].notes = this.value;
    });
    
    notesSection.appendChild(notesTextarea);
    logContainer.appendChild(notesSection);
    
    // Find the existing log container if it exists
    const existingLogContainer = selectedTestCaseDisplay.querySelector('.test-log-container');
    if (existingLogContainer) {
        // Replace the existing log container
        existingLogContainer.replaceWith(logContainer);
    } else {
        // Add the log container to the selected test case display
        selectedTestCaseDisplay.appendChild(logContainer);
    }
}

// Check for temperature and humidity data in log messages
function checkForEnvironmentData(message) {
    // Check for temperature data
    const temperatureMatch = message.match(/"roomTemperature":\s*\[(\d+(?:,\d+)*)\]/i);
    if (temperatureMatch && temperatureMatch[1]) {
        const temperatureValues = temperatureMatch[1].split(',').map(Number);
        if (temperatureValues.length > 0) {
            const avgTemperature = calculateAverage(temperatureValues) / 100; // Convert to degrees (divide by 100)
            updateTemperatureData(avgTemperature);
        }
    }
    
    // Check for humidity data
    const humidityMatch = message.match(/"humidity":\s*\[(\d+(?:,\d+)*)\]/i);
    if (humidityMatch && humidityMatch[1]) {
        const humidityValues = humidityMatch[1].split(',').map(Number);
        if (humidityValues.length > 0) {
            const avgHumidity = calculateAverage(humidityValues);
            updateHumidityData(avgHumidity);
        }
    }
}

// Calculate the average of an array of numbers
function calculateAverage(values) {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return parseFloat((sum / values.length).toFixed(2)); // Round to 2 decimal places
}

// Update temperature data and display
function updateTemperatureData(temperature) {
    // Update the current temperature display
    const currentTemperatureElement = document.getElementById('current-temperature');
    if (currentTemperatureElement) {
        currentTemperatureElement.textContent = `${temperature}°C`;
    }
    
    // Add data to the chart
    addDataPoint('temperature', temperature);
}

// Update humidity data and display
function updateHumidityData(humidity) {
    // Update the current humidity display
    const currentHumidityElement = document.getElementById('current-humidity');
    if (currentHumidityElement) {
        currentHumidityElement.textContent = `${humidity}%`;
    }
    
    // Add data to the chart
    addDataPoint('humidity', humidity);
}

// Add a data point to the chart
function addDataPoint(type, value) {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // If this is a new time point, add it to the labels
    if (timeLabels.length === 0 || timeLabels[timeLabels.length - 1] !== timeLabel) {
        timeLabels.push(timeLabel);
        temperatureData.push(type === 'temperature' ? value : null);
        humidityData.push(type === 'humidity' ? value : null);
        
        // Limit the number of data points
        if (timeLabels.length > MAX_DATA_POINTS) {
            timeLabels.shift();
            temperatureData.shift();
            humidityData.shift();
        }
    } else {
        // Update the latest data point
        if (type === 'temperature') {
            temperatureData[temperatureData.length - 1] = value;
        } else if (type === 'humidity') {
            humidityData[humidityData.length - 1] = value;
        }
    }
    
    // Adjust the chart's Y-axis based on the current data
    if (envChart) {
        // Filter out null values
        const validTempData = temperatureData.filter(val => val !== null);
        const validHumidityData = humidityData.filter(val => val !== null);
        
        // Only adjust if we have data
        if (validTempData.length > 0 || validHumidityData.length > 0) {
            // Find min and max values for both datasets
            const allValues = [...validTempData, ...validHumidityData];
            if (allValues.length > 0) {
                const minValue = Math.floor(Math.min(...allValues) / 5) * 5;
                const maxValue = Math.ceil(Math.max(...allValues) / 5) * 5;
                
                // Update the chart scale if values are outside current range
                const currentMin = envChart.options.scales.y.min;
                const currentMax = envChart.options.scales.y.max;
                
                if (minValue < currentMin || maxValue > currentMax) {
                    // Set new min/max with some padding
                    envChart.options.scales.y.min = Math.max(0, minValue - 5);
                    envChart.options.scales.y.max = maxValue + 5;
                }
            }
        }
        
        // Update the chart
        envChart.update();
    }
}

// Initialize the environment data chart
function initializeEnvChart() {
    const ctx = document.getElementById('env-chart').getContext('2d');
    
    envChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: 'Temp °',
                    data: temperatureData,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 2
                },
                {
                    label: 'Humidity %',
                    data: humidityData,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    min: 0,
                    max: 100,
                    ticks: {
                        stepSize: 5,
                        color: 'rgba(255, 255, 255, 0.7)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 5
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'left',
                    align: 'start',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        boxWidth: 12,
                        padding: 10
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                if (label.includes('Temp')) {
                                    return `Temp = ${parseFloat(context.raw).toFixed(2)} °`;
                                } else if (label.includes('Humidity')) {
                                    return `Humidity = ${context.raw}%`;
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            animation: {
                duration: 500
            }
        }
    });
}

// Send a command to the device (function kept for compatibility)
function sendCommand(commandText) {
    if (!isConnected) {
        showNotification('Not connected to a device', 'error');
        return;
    }
    
    if (typeof commandText === 'string' && commandText.trim()) {
        // Send the command to the server
        socket.emit('send-command', { command: commandText.trim() });
        
        // Add the command to the log
        const timestamp = new Date().toISOString();
        addLogEntry(timestamp, `> ${commandText.trim()}`);
    }
}

// Send a thermostat command to change temperature (function kept for compatibility)
function sendThermostatCommand(command) {
    if (!isConnected) {
        showNotification('Not connected to a device', 'error');
        return;
    }
    // This function is kept for compatibility but the UI buttons have been removed
    
    if (command === 'set temp 29') {
        showNotification('Setting temperature to 29°C...', 'success');
        
        // Send the command to the server
        socket.emit('send-command', { command: 'set temp 29' });
        
        // Add the command to the log with the exact sequence that will be sent
        const timestamp = new Date().toISOString();
        addLogEntry(timestamp, `> Setting thermostat to 29°C`);
        addLogEntry(timestamp, `> Sending complete command sequence:`);
        addLogEntry(timestamp, `  1. app_menu_controller: Entering menu: Ambient Menu`);
        addLogEntry(timestamp, `  2. persistence_task: Triggering save notification for event: 1`);
        addLogEntry(timestamp, `  3. persistence_task: Processing save notification`);
        addLogEntry(timestamp, `  4. connection_manager: Both WiFi and MQTT credentials are ready`);
        addLogEntry(timestamp, `  5. connection_manager: Requested BLE shutdown through controller`);
        addLogEntry(timestamp, `  6. thermostat_endpoint: Current Occupied Heating Setpoint: 2800`);
        addLogEntry(timestamp, `  7. thermostat_endpoint: Occupied Heating Setpoint: 2900`);
        addLogEntry(timestamp, `  8. Matter app_events: Heating Setpoint Updated: 29.000000`);
        
        return;
    } else if (command === 'set temp 28') {
        showNotification('Setting temperature to 28°C...', 'success');
        
        // Send the command to the server
        socket.emit('send-command', { command: 'set temp 28' });
        
        // Add the command to the log with the exact sequence that will be sent
        const timestamp = new Date().toISOString();
        addLogEntry(timestamp, `> Setting thermostat to 28°C`);
        addLogEntry(timestamp, `> Sending complete command sequence:`);
        addLogEntry(timestamp, `  1. app_menu_controller: Entering menu: Ambient Menu`);
        addLogEntry(timestamp, `  2. persistence_task: Triggering save notification for event: 1`);
        addLogEntry(timestamp, `  3. persistence_task: Processing save notification`);
        addLogEntry(timestamp, `  4. connection_manager: Both WiFi and MQTT credentials are ready`);
        addLogEntry(timestamp, `  5. connection_manager: Requested BLE shutdown through controller`);
        addLogEntry(timestamp, `  6. thermostat_endpoint: Current Occupied Heating Setpoint: 2900`);
        addLogEntry(timestamp, `  7. thermostat_endpoint: Occupied Heating Setpoint: 2800`);
        addLogEntry(timestamp, `  8. Matter app_events: Heating Setpoint Updated: 28.000000`);
        
        return;
    } else {
        // For any other command, send as is
        socket.emit('send-command', { command });
        
        // Add the command to the log
        const timestamp = new Date().toISOString();
        addLogEntry(timestamp, `> ${command}`);
    }
}

// Check for thermostat mode and setpoint information in log messages
function checkForThermostatInfo(message) {
    // Check for heating setpoint updates
    if (message.includes('Matter app_events: Heating Setpoint Updated:')) {
        try {
            // Extract the setpoint value
            const setpointMatch = message.match(/Heating Setpoint Updated: (\d+\.\d+)/);
            if (setpointMatch && setpointMatch[1]) {
                const setpoint = parseFloat(setpointMatch[1]);
                
                // Only update the mode if it's not currently EMERG
                if (thermostatMode.textContent !== 'ENERG') {
                    thermostatMode.textContent = 'Heat';
                    thermostatMode.className = 'status-value heat';
                }
                
                // Always update the setpoint
                thermostatSetpoint.textContent = `${setpoint}°C`;
                
                console.log(`Detected heating setpoint update: ${setpoint}°C, Mode: ${thermostatMode.textContent}`);
            }
        } catch (error) {
            console.error('Error parsing heating setpoint:', error);
        }
    }
    
    // Check for cooling setpoint updates
    else if (message.includes('Matter app_events: Cooling Setpoint Updated:')) {
        try {
            // Extract the setpoint value
            const setpointMatch = message.match(/Cooling Setpoint Updated: (\d+\.\d+)/);
            if (setpointMatch && setpointMatch[1]) {
                const setpoint = parseFloat(setpointMatch[1]);
                
                // Update the thermostat mode and setpoint display
                thermostatMode.textContent = 'Cool';
                thermostatMode.className = 'status-value cool';
                thermostatSetpoint.textContent = `${setpoint}°C`;
                
                console.log(`Detected cooling mode with setpoint: ${setpoint}°C`);
            }
        } catch (error) {
            console.error('Error parsing cooling setpoint:', error);
        }
    }
    
    // Check for Mode Updated events
    else if (message.includes('Matter app_events: Mode Updated:')) {
        try {
            // Extract the mode value
            const modeMatch = message.match(/Mode Updated: (\d+)/);
            if (modeMatch && modeMatch[1]) {
                const modeValue = parseInt(modeMatch[1]);
                
                // Update the thermostat mode display based on the mode value
                switch (modeValue) {
                    case 0:
                        thermostatMode.textContent = 'Off';
                        thermostatMode.className = 'status-value off';
                        thermostatSetpoint.textContent = '--';
                        break;
                    case 3:
                        thermostatMode.textContent = 'Cool';
                        thermostatMode.className = 'status-value cool';
                        thermostatSetpoint.textContent = '--';
                        break;
                    case 4:
                        thermostatMode.textContent = 'Heat';
                        thermostatMode.className = 'status-value heat';
                        thermostatSetpoint.textContent = '--';
                        break;
                    case 5:
                        thermostatMode.textContent = 'ENERG';
                        thermostatMode.className = 'status-value heat';
                        thermostatSetpoint.textContent = '--';
                        break;
                    case 7:
                        thermostatMode.textContent = 'Fan';
                        thermostatMode.className = 'status-value off';
                        thermostatSetpoint.textContent = '--';
                        break;
                    default:
                        thermostatMode.textContent = `Mode ${modeValue}`;
                        thermostatMode.className = 'status-value';
                        thermostatSetpoint.textContent = '--';
                }
                
                console.log(`Detected system mode: ${thermostatMode.textContent}, setpoint reset to --`);
            }
        } catch (error) {
            console.error('Error parsing mode update:', error);
        }
    }
    
    // Check for system mode from thermostat_endpoint
    else if (message.includes('thermostat_endpoint: System Mode:')) {
        const modeMatch = message.match(/System Mode: (\d+)/);
        if (modeMatch && modeMatch[1]) {
            const modeValue = parseInt(modeMatch[1]);
            
            // Update the thermostat mode display based on the mode value
            switch (modeValue) {
                case 0:
                    thermostatMode.textContent = 'Off';
                    thermostatMode.className = 'status-value off';
                    thermostatSetpoint.textContent = '--';
                    break;
                case 3:
                    thermostatMode.textContent = 'Cool';
                    thermostatMode.className = 'status-value cool';
                    break;
                case 4:
                    thermostatMode.textContent = 'Heat';
                    thermostatMode.className = 'status-value heat';
                    break;
                case 5:
                    thermostatMode.textContent = 'ENERG';
                    thermostatMode.className = 'status-value heat';
                    break;
                case 7:
                    thermostatMode.textContent = 'Fan';
                    thermostatMode.className = 'status-value off';
                    thermostatSetpoint.textContent = '--';
                    break;
                default:
                    thermostatMode.textContent = `Mode ${modeValue}`;
                    thermostatMode.className = 'status-value';
            }
            
            console.log(`Detected system mode: ${thermostatMode.textContent}`);
        }
    }
}

// Check for App version information in log messages
function checkForAppVersion(message) {
    // Check for App version information
    if (message.includes('cpu_start: App version:')) {
        try {
            // Extract the version value
            const versionMatch = message.match(/cpu_start: App version:\s+(\d+\.\d+)/);
            if (versionMatch && versionMatch[1]) {
                const version = versionMatch[1];
                
                // Update the App version display
                appVersion.textContent = version;
                
                console.log(`Detected App version: ${version}`);
            }
        } catch (error) {
            console.error('Error parsing App version:', error);
        }
    }
}

// Check for temperature unit information in log messages
function checkForTemperatureUnit(message) {
    // Check for temperature unit information
    if (message.includes('preferences_helpers: set_preferences_temperature_unit:')) {
        try {
            // Extract the temperature unit value
            const unitMatch = message.match(/preferences_helpers: set_preferences_temperature_unit:\s+(\d+)/);
            if (unitMatch && unitMatch[1]) {
                const unitValue = parseInt(unitMatch[1]);
                
                // Update the temperature unit display (1 = Fahrenheit, 0 = Celsius)
                if (unitValue === 1) {
                    tempUnit.textContent = 'F';
                    console.log('Temperature unit set to Fahrenheit');
                } else if (unitValue === 0) {
                    tempUnit.textContent = 'C';
                    console.log('Temperature unit set to Celsius');
                }
            }
        } catch (error) {
            console.error('Error parsing temperature unit:', error);
        }
    }
}

// Check for language information in log messages
function checkForLanguage(message) {
    // Check for language information
    if (message.includes('preferences_helpers: set_preferences_language:')) {
        try {
            // Extract the language value
            const langMatch = message.match(/preferences_helpers: set_preferences_language:\s+(\d+)/);
            if (langMatch && langMatch[1]) {
                const langValue = parseInt(langMatch[1]);
                
                // Update the language display (1 = French, 0 = English)
                if (langValue === 1) {
                    language.textContent = 'F';
                    console.log('Language set to French');
                } else if (langValue === 0) {
                    language.textContent = 'E';
                    console.log('Language set to English');
                }
            }
        } catch (error) {
            console.error('Error parsing language setting:', error);
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
