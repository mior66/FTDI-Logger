// Test Tracker Integration for FTDI Logger
document.addEventListener('DOMContentLoaded', function() {
    // Get references to elements
    const testTrackerPanel = document.getElementById('test-tracker-panel');
    const selectedTestCaseDisplay = document.getElementById('selected-test-case-display');
    const deviceTypeDropdown = document.getElementById('deviceType');
    const fileUpload = document.getElementById('fileUpload');
    const loadFileBtn = document.getElementById('loadFile');
    const clearDataBtn = document.getElementById('clearData');
    const testDataContainer = document.getElementById('test-data-container');
    
    // Variables
    let workbook = null;
    let testResults = {};
    let currentSheetName = null;
    let currentDeviceType = '';
    let originalLVTestCases = []; // Store original LV test cases for category filtering
    let filteredTestCases = [];
    
    // Both panels are now visible by default and the Manual Testing button has been removed
    // No need for toggle functionality
    
    // Handle device type selection
    if (deviceTypeDropdown) {
        deviceTypeDropdown.addEventListener('change', function() {
            currentDeviceType = this.value;
            console.log('Device type changed to:', currentDeviceType);
            
            // Clear test data container
            testDataContainer.innerHTML = '';
            
            if (currentDeviceType) {
                // Special handling for LV
                if (currentDeviceType === 'LV') {
                    // Update file upload text
                    const fileUploadText = document.querySelector('.file-upload-container p');
                    if (fileUploadText) {
                        fileUploadText.textContent = 'Upload your test plan Excel file:';
                    }
                    
                    // Update button text
                    if (loadFileBtn) {
                        loadFileBtn.textContent = 'Load Test Plan';
                    }
                    
                    // Show the LV category filter dropdown
                    const lvCategoryFilterContainer = document.getElementById('lv-category-filter-container');
                    if (lvCategoryFilterContainer) {
                        lvCategoryFilterContainer.style.display = 'flex';
                    }
                } else {
                    // For other device types
                    // Update file upload text
                    const fileUploadText = document.querySelector('.file-upload-container p');
                    if (fileUploadText) {
                        fileUploadText.textContent = `Upload your ${currentDeviceType} test cases Excel file:`;
                    }
                    
                    // Hide the LV category filter dropdown
                    const lvCategoryFilterContainer = document.getElementById('lv-category-filter-container');
                    if (lvCategoryFilterContainer) {
                        lvCategoryFilterContainer.style.display = 'none';
                    }
                    
                    // Update button text
                    if (loadFileBtn) {
                        loadFileBtn.textContent = `Load ${currentDeviceType} Test Cases`;
                    }
                }
                
                // If we already have workbook data, process it with the new device type
                if (workbook) {
                    processDeviceTestCases(workbook, currentDeviceType);
                }
            }
        });
    }
    
    // Load Excel file
    if (loadFileBtn) {
        loadFileBtn.addEventListener('click', function() {
            if (!fileUpload.files.length) {
                // Custom alert with 'Warning:' instead of 'localhost:3000 says'
                const warningMessage = 'Please select a file first.';
                
                // Create a custom modal dialog
                const modal = document.createElement('div');
                modal.className = 'custom-alert-modal';
                modal.innerHTML = `
                    <div class="custom-alert-content">
                        <div class="custom-alert-header">Warning:</div>
                        <div class="custom-alert-message">${warningMessage}</div>
                        <button class="custom-alert-button">OK</button>
                    </div>
                `;
                
                document.body.appendChild(modal);
                
                // Add event listener to the OK button
                const okButton = modal.querySelector('.custom-alert-button');
                okButton.addEventListener('click', function() {
                    document.body.removeChild(modal);
                });
                
                // Also close when clicking outside the modal
                modal.addEventListener('click', function(event) {
                    if (event.target === modal) {
                        document.body.removeChild(modal);
                    }
                });
                return;
            }
            
            const file = fileUpload.files[0];
            const reader = new FileReader();
            
            testDataContainer.innerHTML = `<p>Loading ${currentDeviceType || 'test'} cases...</p>`;
            
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    workbook = XLSX.read(data, { type: 'array' });
                    
                    // Process the workbook based on device type
                    if (currentDeviceType) {
                        processDeviceTestCases(workbook, currentDeviceType);
                    } else {
                        // If no device type is selected, just show a message
                        testDataContainer.innerHTML = '<p>Please select a device type first.</p>';
                    }
                } catch (error) {
                    console.error('Error processing file:', error);
                    testDataContainer.innerHTML = `<p>Error processing file: ${error.message}</p>`;
                }
            };
            
            reader.onerror = function() {
                console.error('Error reading file');
                testDataContainer.innerHTML = '<p>Error reading file</p>';
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
    
    // Clear all data
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', function() {
            workbook = null;
            testResults = {};
            currentSheetName = null;
            filteredTestCases = [];
            originalLVTestCases = []; // Reset the original LV test cases array
            
            // Clear the test data container
            testDataContainer.innerHTML = '';
            
            // Reset summary stats
            updateSummaryStats();
            
            // Clear file input
            fileUpload.value = '';
            
            // Reset and disable the LV category filter dropdown
            const lvCategoryFilter = document.getElementById('lv-category-filter');
            if (lvCategoryFilter) {
                lvCategoryFilter.value = 'all'; // Reset to 'All' option
                lvCategoryFilter.disabled = true;
            }
        });
    }
    
    // List of known section headers for LV test plans
    const knownSectionHeaders = [
        'Heat Mode Setpoint Below Ambient',
        'Heat Mode Setpoint Above Ambient',
        'Heat Mode Setpoint Above Ambient - Refresh CONFIG',
        'OFF Mode w Heat',
        'OFF Mode w Heat - Refresh CONFIG',
        'Setpoint is above the ambient',
        'Setpoint is below the ambient',
        'Heat Mode to Fan Mode',
        'Heat Mode to Fan Mode - Refresh CONFIG',
        'Heat Mode to Auto Mode',
        'C Mode Setpoint Below Ambient',
        'C Mode Setpoint Above Ambient',
        'C Mode Setpoint Below Ambient - Refresh CONFIG',
        'C Mode Setpoint Above Ambient - Refresh CONFIG'
    ];
    
    // Process device test cases based on device type
    function processDeviceTestCases(workbook, deviceType) {
        console.log(`Processing ${deviceType} test cases`);
        filteredTestCases = [];
        
        // If this is an LV device type, enable the category filter dropdown
        if (deviceType === 'LV') {
            const lvCategoryFilter = document.getElementById('lv-category-filter');
            if (lvCategoryFilter) {
                // Enable the dropdown
                lvCategoryFilter.disabled = false;
                
                // Add event listener to filter test cases when category changes
                lvCategoryFilter.addEventListener('change', function() {
                    filterLVTestCasesByCategory(this.value);
                });
                
                // Reset to 'All' option
                lvCategoryFilter.value = 'all';
            }
        }
        
        try {
            // Process the first sheet with label filtering for all device types
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            console.log('Excel data loaded, rows:', jsonData.length);
            
            // Find the header row
            const headerRow = jsonData[0];
            
            // Find column indices
            const issueKeyIndex = headerRow.findIndex(header => 
                header && (String(header).includes('Issue Key') || String(header).includes('Key') || 
                String(header).includes('Issue') || String(header).includes('Test #')));
            const summaryIndex = headerRow.findIndex(header => 
                header && String(header).includes('Summary'));
            const descriptionIndex = headerRow.findIndex(header => 
                header && String(header).includes('Description'));
            
            // Find Zen V1 and Mysa LV columns for LV test plans
            const zenV1Index = headerRow.findIndex(header => 
                header && String(header).includes('Zen V1'));
            const mysaLVIndex = headerRow.findIndex(header => 
                header && String(header).includes('Mysa LV'));
            
            // Find and exclude Build column
            const buildIndex = headerRow.findIndex(header => 
                header && String(header).includes('Build'));
                
            console.log('Column indices:', { issueKeyIndex, summaryIndex, descriptionIndex, zenV1Index, mysaLVIndex, buildIndex });
            
            // Find all label columns
            const labelIndices = [];
            headerRow.forEach((header, index) => {
                if (header && String(header).includes('Label')) {
                    labelIndices.push(index);
                }
            });
            
            console.log('Label column indices:', labelIndices);
            
            // Process each row
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || !row.length) continue;
                
                // Define hasMatchingLabel at the correct scope
                let hasMatchingLabel = false;
                
                // Check if any label column matches the requirements
                for (const labelIndex of labelIndices) {
                    const labelValue = row[labelIndex];
                    if (labelValue) {
                        const labelStr = String(labelValue);
                        const labels = labelStr.split(',').map(l => l.trim());
                        
                        // Apply device-specific label filtering
                        switch(deviceType) {
                            case 'LV':
                                // LV - The label must include 'LV' (case insensitive)
                                if (labels.some(label => label.toUpperCase().includes('LV'))) {
                                    hasMatchingLabel = true;
                                }
                                break;
                            case 'Smoke':
                                // Smoke - The label must include 'smoke' (case insensitive)
                                if (labels.some(label => label.toLowerCase().includes('smoke'))) {
                                    hasMatchingLabel = true;
                                }
                                break;
                            case 'BB1':
                                // BB1 - The label must be BB1 or BB
                                if (labels.includes('BB1') || labels.includes('BB')) {
                                    hasMatchingLabel = true;
                                }
                                break;
                            case 'BB2':
                                // BB2 - The label must be BB or BB2
                                if (labels.includes('BB2') || labels.includes('BB')) {
                                    hasMatchingLabel = true;
                                }
                                break;
                            case 'BB2L':
                                // BB2L - The label must be BB or BB2L
                                if (labels.includes('BB2L') || labels.includes('BB')) {
                                    hasMatchingLabel = true;
                                }
                                break;
                            case 'INF':
                                // INF - The label must be INF
                                if (labels.includes('INF')) {
                                    hasMatchingLabel = true;
                                }
                                break;
                            case 'AC':
                                // AC - The label must be AC
                                if (labels.includes('AC')) {
                                    hasMatchingLabel = true;
                                }
                                break;
                            case 'BB':
                                // BB - The label can be BB, BB1, BB2, or BB2L
                                if (labels.includes('BB') || labels.includes('BB1') || 
                                    labels.includes('BB2') || labels.includes('BB2L')) {
                                    hasMatchingLabel = true;
                                }
                                break;
                            case 'Sanity':
                                // Sanity - The label must include 'sanity' (case insensitive)
                                if (labels.some(label => label.toLowerCase().includes('sanity'))) {
                                    hasMatchingLabel = true;
                                }
                                break;
                        }
                        
                        if (hasMatchingLabel) break;
                    }
                }
                
                if (hasMatchingLabel) {
                    // Collect all labels
                    const labels = [];
                    for (const labelIndex of labelIndices) {
                        if (row[labelIndex]) {
                            labels.push(row[labelIndex]);
                        }
                    }
                    
                    // Check if this is a sub-row
                    let isSubRow = false;
                    let testNumStr = '';
                    
                    if (issueKeyIndex >= 0 && row[issueKeyIndex]) {
                        testNumStr = String(row[issueKeyIndex]);
                        // Sub-row if test number starts with dash or space-dash
                        if (testNumStr.startsWith('-') || testNumStr.startsWith(' -') || testNumStr.includes('Wait')) {
                            isSubRow = true;
                        }
                    }
                    
                    // Add to filtered test cases
                    filteredTestCases.push({
                        issueKey: issueKeyIndex >= 0 ? row[issueKeyIndex] : 'N/A',
                        summary: summaryIndex >= 0 ? row[summaryIndex] : 'N/A',
                        description: descriptionIndex >= 0 ? row[descriptionIndex] : 'N/A',
                        zenV1: zenV1Index >= 0 ? row[zenV1Index] : '',
                        mysaLV: mysaLVIndex >= 0 ? row[mysaLVIndex] : '',
                        labels: labels.join(', '),
                        status: 'not-tested', // Default status
                        isSubRow: isSubRow, // Flag to identify sub-rows
                        notes: '' // Field to store user notes
                    });
                }
            }
            
            // Store original LV test cases for filtering
            if (deviceType === 'LV') {
                originalLVTestCases = [...filteredTestCases];
            }
            
            // Display the filtered test cases
            displayFilteredTestCases(deviceType);
            
            // Update summary statistics
            updateSummaryStats();
            
        } catch (error) {
            console.error(`Error processing ${deviceType} file:`, error);
            testDataContainer.innerHTML = `<p>Error processing ${deviceType} file: ${error.message}</p>`;
        }
    }
    
    // Process LV test plan with tabs and sheet-based processing
    function processLVTestPlan(workbook) {
        // Clear previous data
        testDataContainer.innerHTML = '';
        
        // Enable the LV category filter dropdown
        const lvCategoryFilter = document.getElementById('lv-category-filter');
        if (lvCategoryFilter) {
            // Enable the dropdown
            lvCategoryFilter.disabled = false;
            
            // Add event listener to filter test cases when category changes
            lvCategoryFilter.addEventListener('change', function() {
                filterLVTestCasesByCategory(this.value);
            });
            
            // Reset to 'All' option
            lvCategoryFilter.value = 'all';
        }
        
        // Create tabs container if it doesn't exist
        let tabsContainer = document.getElementById('tabs-container');
        if (!tabsContainer) {
            tabsContainer = document.createElement('div');
            tabsContainer.id = 'tabs-container';
            tabsContainer.className = 'tabs-container';
            testDataContainer.appendChild(tabsContainer);
        } else {
            tabsContainer.innerHTML = '';
        }
        
        // Create test content container if it doesn't exist
        let testContentContainer = document.getElementById('test-content-container');
        if (!testContentContainer) {
            testContentContainer = document.createElement('div');
            testContentContainer.id = 'test-content-container';
            testContentContainer.className = 'test-content-container';
            testDataContainer.appendChild(testContentContainer);
        } else {
            testContentContainer.innerHTML = '';
        }
        
        // Store the Specific Config Testing sheet for CN tests if available
        const specificConfigSheet = workbook.SheetNames.find(name => name === 'Specific Config Testing');
        if (specificConfigSheet) {
            // Store this sheet data globally for CN test processing
            window.specificConfigData = XLSX.utils.sheet_to_json(workbook.Sheets[specificConfigSheet], { header: 1 });
            console.log('Found Specific Config Testing sheet for CN tests');
        } else {
            window.specificConfigData = null;
            console.log('No Specific Config Testing sheet found for CN tests');
        }
        
        // Filter out sheets we don't want to show
        const filteredSheets = workbook.SheetNames.filter(name => 
            !name.includes('Summary of Issues') && 
            !name.includes('Release Notes'));
        
        if (filteredSheets.length === 0) {
            testDataContainer.innerHTML = `<p>No valid sheets found in the Excel file. Make sure your Excel file has proper sheets for LV test plans.</p>`;
            return;
        }
        
        // Create tabs for each sheet
        filteredSheets.forEach(sheetName => {
            const tab = document.createElement('button');
            
            // Rename specific tabs for display
            let displayName = sheetName;
            if (sheetName === 'PairingConfig') {
                displayName = 'Pairing/Config';
            } else if (sheetName === 'GeneralMisc') {
                displayName = 'General/Misc';
            }
            
            tab.textContent = displayName;
            tab.className = 'tab';
            tab.dataset.sheetName = sheetName; // Store original sheet name
            
            tab.addEventListener('click', function() {
                // Remove active class from all tabs
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                // Add active class to clicked tab
                this.classList.add('active');
                // Display a specific sheet for LV test plan
                displayLVSheet(this.dataset.sheetName, workbook.Sheets[this.dataset.sheetName]);
            });
            
            tabsContainer.appendChild(tab);
        });
        
        // Display the first sheet by default
        if (filteredSheets.length > 0) {
            document.querySelector('.tab').classList.add('active');
            displayLVSheet(filteredSheets[0], workbook.Sheets[filteredSheets[0]]);
        }
    }
    
    function displayLVSheet(sheetName, worksheet) {
        // Convert worksheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Find the header row
        let headerRowIndex = -1;
        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row.some(cell => cell && cell.toString().toLowerCase().includes('test #'))) {
                headerRowIndex = i;
                break;
            }
        }
        
        if (headerRowIndex === -1) {
            document.getElementById('test-content-container').innerHTML = '<p>Error: Header row not found in sheet</p>';
            return;
        }
        
        // Extract headers
        const headers = jsonData[headerRowIndex];
        
        // Find important column indices
        let testNumColumnIndex = -1;
        let passFailColumnIndex = -1;
        let buildColumnIndex = -1;
        let generalNotesColumnIndex = -1;
        
        headers.forEach((header, index) => {
            if (!header) return;
            const headerText = header.toString().toLowerCase();
            if (headerText.includes('test #')) {
                testNumColumnIndex = index;
            } else if (headerText.includes('pass/fail')) {
                passFailColumnIndex = index;
            } else if (headerText.includes('build')) {
                buildColumnIndex = index;
            } else if (headerText.includes('general note') || headerText.includes('bugs')) {
                generalNotesColumnIndex = index;
            }
        });
        
        if (testNumColumnIndex === -1) {
            document.getElementById('test-content-container').innerHTML = '<p>Error: Test # column not found in sheet</p>';
            return;
        }
        
        // Known section headers in LV test plans
        const knownSectionHeaders = [
            'Heat Mode', 'Cool Mode', 'Fan Mode', 'Auto Mode',
            'Pairing', 'Configuration', 'General', 'Misc',
            'Automated Testing', 'Manual Testing'
        ];
        
        // Create the table
        let tableHTML = '<table class="test-table">';
        
        // Add header row
        tableHTML += '<thead><tr>';
        headers.forEach((header, index) => {
            // Skip the Build column and General Notes column
            if (index === buildColumnIndex || index === generalNotesColumnIndex) {
                return;
            }
            tableHTML += `<th>${header !== undefined ? header : ''}</th>`;
        });
        
        // Add a Pass/Fail column if not present
        if (passFailColumnIndex === -1) {
            tableHTML += '<th>Pass/Fail</th>';
        }
        
        tableHTML += '</tr></thead>';
        tableHTML += '<tbody>';
        
        // Function to check if a test is a CN test
        function isCNTest(testNumber) {
            if (!testNumber) return false;
            return /^CN-\d{3}$/i.test(testNumber.toString().trim());
        }
        
        // Function to get CN test data from Specific Config Testing sheet
        function getCNTestData(testNumber) {
            if (!window.specificConfigData) return null;
            
            // Find the header row in the Specific Config Testing sheet
            let headerRowIndex = -1;
            for (let i = 0; i < window.specificConfigData.length; i++) {
                const row = window.specificConfigData[i];
                if (row && row.some(cell => cell && cell.toString().toLowerCase().includes('test #'))) {
                    headerRowIndex = i;
                    break;
                }
            }
            
            if (headerRowIndex === -1) return null;
            
            // Get headers
            const headers = window.specificConfigData[headerRowIndex];
            
            // Find Test # column index
            const testNumIndex = headers.findIndex(header => 
                header && header.toString().toLowerCase().includes('test #'));
            
            if (testNumIndex === -1) return null;
            
            // Find the row with matching test number
            for (let i = headerRowIndex + 1; i < window.specificConfigData.length; i++) {
                const row = window.specificConfigData[i];
                if (!row || !row[testNumIndex]) continue;
                
                if (row[testNumIndex].toString().trim() === testNumber.toString().trim()) {
                    // Return the row data with headers
                    return {
                        headers: headers,
                        data: row
                    };
                }
            }
            
            return null;
        }
        
        let failedTests = 0;
        let notTestedTests = 0;
        
        allSelects.forEach(select => {
            if (select.value === 'pass') {
                passedTests++;
            } else if (select.value === 'fail') {
                failedTests++;
            } else {
                notTestedTests++;
            }
        });
        
        // Process the data rows and add to table
        let totalTests = 0;
        let passedTests = 0;
        let allSelects = [];
        
        // Process each row in the sheet
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;
            
            // Check if this is a test row (has a test number)
            const testNumber = row[testNumColumnIndex];
            if (!testNumber) continue;
            
            // Check if this is a CN test
            const isCNTestRow = isCNTest(testNumber);
            
            // If it's a CN test, get the data from the Specific Config Testing sheet
            if (isCNTestRow && window.specificConfigData) {
                const cnTestData = getCNTestData(testNumber);
                
                if (cnTestData) {
                    // Add a special row for CN tests
                    tableHTML += `<tr class="cn-test-row">`;
                    
                    // Add the test number
                    tableHTML += `<td><strong>${testNumber}</strong> (Config Test)</td>`;
                    
                    // Add other columns from the main sheet
                    for (let j = 0; j < headers.length; j++) {
                        // Skip the test number column (already added) and build/notes columns
                        if (j === testNumColumnIndex || j === buildColumnIndex || j === generalNotesColumnIndex) {
                            continue;
                        }
                        
                        // Add the cell value
                        const cellValue = row[j] !== undefined ? row[j] : '';
                        tableHTML += `<td>${cellValue}</td>`;
                    }
                    
                    // Add Pass/Fail dropdown if not present in the original data
                    if (passFailColumnIndex === -1) {
                        const selectId = `test-status-${totalTests}`;
                        tableHTML += `<td>
                            <select id="${selectId}" class="test-status-select" onchange="updateTestStatus(this)">
                                <option value="not-tested">Not Tested</option>
                                <option value="pass">Pass</option>
                                <option value="fail">Fail</option>
                            </select>
                        </td>`;
                    }
                    
                    tableHTML += `</tr>`;
                    
                    // Add a special row with the Specific Config Testing data
                    tableHTML += `<tr class="cn-test-details">`;
                    
                    // Calculate the colspan based on the number of visible columns
                    const visibleColumns = headers.length - (buildColumnIndex !== -1 ? 1 : 0) - (generalNotesColumnIndex !== -1 ? 1 : 0);
                    const colspan = passFailColumnIndex === -1 ? visibleColumns : visibleColumns - 1;
                    
                    // Create a nested table for the CN test details
                    tableHTML += `<td colspan="${colspan}">`;
                    tableHTML += `<div class="cn-test-details-container">`;
                    tableHTML += `<h4>Config Test Details</h4>`;
                    tableHTML += `<table class="cn-test-details-table">`;
                    
                    // Create a more compact display with Issue Key on a single line
                    // Find the Issue Key column index if it exists
                    const issueKeyIndex = cnTestData.headers.findIndex(header => 
                        header && header.toString().toLowerCase().includes('issue key'));
                    
                    // First show the Issue Key on a single line if it exists
                    if (issueKeyIndex !== -1 && cnTestData.data[issueKeyIndex]) {
                        tableHTML += `<div class="cn-issue-key"><strong>Issue Key:</strong> ${cnTestData.data[issueKeyIndex]}</div>`;
                    }
                    
                    // Then show the rest of the data in a table
                    tableHTML += `<table class="cn-test-details-table">`;
                    tableHTML += `<tr>`;
                    
                    // Add headers, skipping Issue Key since we already displayed it
                    cnTestData.headers.forEach((header, idx) => {
                        if (header && idx !== issueKeyIndex) {
                            tableHTML += `<th>${header}</th>`;
                        }
                    });
                    tableHTML += `</tr>`;
                    
                    // Add data, skipping Issue Key
                    tableHTML += `<tr>`;
                    cnTestData.headers.forEach((header, idx) => {
                        if (header && idx !== issueKeyIndex) {
                            const cellValue = cnTestData.data[idx] !== undefined ? cnTestData.data[idx] : '';
                            tableHTML += `<td>${cellValue}</td>`;
                        }
                    });
                    tableHTML += `</tr>`;
                    tableHTML += `</table>`;
                    
                    tableHTML += `</div>`;
                    tableHTML += `</td>`;
                    
                    // If we have a Pass/Fail column, add an empty cell to maintain the table structure
                    if (passFailColumnIndex === -1) {
                        tableHTML += `<td></td>`;
                    }
                    
                    tableHTML += `</tr>`;
                } else {
                    // CN test without specific data - just show normal row
                    tableHTML += `<tr>`;
                    
                    // Add each cell
                    for (let j = 0; j < headers.length; j++) {
                        // Skip build and notes columns
                        if (j === buildColumnIndex || j === generalNotesColumnIndex) {
                            continue;
                        }
                        
                        // Add the cell value
                        const cellValue = row[j] !== undefined ? row[j] : '';
                        tableHTML += `<td>${cellValue}</td>`;
                    }
                    
                    // Add Pass/Fail dropdown if not present in the original data
                    if (passFailColumnIndex === -1) {
                        const selectId = `test-status-${totalTests}`;
                        tableHTML += `<td>
                            <select id="${selectId}" class="test-status-select" onchange="updateTestStatus(this)">
                                <option value="not-tested">Not Tested</option>
                                <option value="pass">Pass</option>
                                <option value="fail">Fail</option>
                            </select>
                        </td>`;
                    }
                    
                    tableHTML += `</tr>`;
                }
            } else {
                // Regular test case (not a CN test)
                tableHTML += `<tr>`;
                
                // Add each cell
                for (let j = 0; j < headers.length; j++) {
                    // Skip build and notes columns
                    if (j === buildColumnIndex || j === generalNotesColumnIndex) {
                        continue;
                    }
                    
                    // Add the cell value
                    const cellValue = row[j] !== undefined ? row[j] : '';
                    tableHTML += `<td>${cellValue}</td>`;
                }
                
                // Add Pass/Fail dropdown if not present in the original data
                if (passFailColumnIndex === -1) {
                    const selectId = `test-status-${totalTests}`;
                    tableHTML += `<td>
                        <select id="${selectId}" class="test-status-select" onchange="updateTestStatus(this)">
                            <option value="not-tested">Not Tested</option>
                            <option value="pass">Pass</option>
                            <option value="fail">Fail</option>
                        </select>
                    </td>`;
                }
                
                tableHTML += `</tr>`;
            }
            
            totalTests++;
        }
        
        tableHTML += '</tbody></table>';
        
        // Add the table to the content container
        document.getElementById('test-content-container').innerHTML = tableHTML;
        
        // Store original LV test cases for filtering
        originalLVTestCases = [...filteredTestCases];
        
        // Add CSS for CN test styling and single-line Issue Key display
        const style = document.createElement('style');
        style.textContent = `
            .cn-test-row { background-color: #e3f2fd; }
            .cn-test-details { background-color: #f5f5f5; }
            .cn-test-details-container { padding: 10px; }
            .cn-test-details-container h4 { margin-top: 0; margin-bottom: 10px; color: #0d47a1; }
            .cn-issue-key { 
                font-size: 14px; 
                margin-bottom: 12px; 
                padding: 6px 10px; 
                background-color: #e8f5e9; 
                border-left: 4px solid #2e7d32; 
                border-radius: 3px;
            }
            .issue-key-header {
                width: 120px; /* Fixed width for Issue Key column */
            }
            .single-line-key {
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                max-width: 120px !important;
                font-weight: bold;
                color: #0d47a1;
                display: block !important;
            }
            .test-table td:first-child {
                white-space: nowrap !important;
            }
            .cn-test-details-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
            .cn-test-details-table th, .cn-test-details-table td { 
                border: 1px solid #ddd; 
                padding: 8px; 
                text-align: left; 
            }
            .cn-test-details-table th { background-color: #e8eaf6; }
        `;
        document.head.appendChild(style);
        
        // Get all the test status selects
        const testStatusSelects = document.querySelectorAll('.test-status-select');
        allSelects = Array.from(testStatusSelects);
        
        // Count the pass/fail/not-tested
        allSelects.forEach(select => {
            if (select.value === 'pass') {
                passedTests++;
            } else if (select.value === 'fail') {
                failedTests++;
            } else {
                notTestedTests++;
            }
        });
        
        // Calculate pass rate (only considering tested items)
        const testedTotal = passedTests + failedTests;
        const passRate = testedTotal > 0 ? Math.round((passedTests / testedTotal) * 100) : 0;
        
        // Update the summary stats
        document.getElementById('total-tests').textContent = totalTests;
        document.getElementById('passed-tests').textContent = passedTests;
        document.getElementById('failed-tests').textContent = failedTests;
        document.getElementById('not-tested-tests').textContent = notTestedTests;
        document.getElementById('pass-rate').textContent = `${passRate}%`;
    }
    
    // Display filtered test cases for non-LV device types
    function displayFilteredTestCases(deviceType) {
        if (!filteredTestCases.length) {
            if (deviceType === 'LV') {
                testDataContainer.innerHTML = `<p>No test cases found in the Excel file. Make sure your Excel file has proper headers and contains test cases.</p>`;
            } else {
                testDataContainer.innerHTML = `<p>No ${deviceType} test cases found. Make sure your Excel file has a column with 'Label' in the header and contains test cases with the '${deviceType}' label.</p>`;
            }
            return;
        }
        
        // Create table
        let tableHTML = '<table class="test-table">';
        
        // Create table header
        tableHTML += '<thead><tr>';
        let headers;
        if (deviceType === 'LV') {
            headers = ['Issue Key', 'Summary', 'Description', 'Zen V1', 'Mysa LV', 'Pass/Fail'];
        } else {
            headers = ['Issue Key', 'Summary', 'Description', 'Labels', 'Pass/Fail'];
        }
        headers.forEach((header, index) => {
            // Add a special class for the Issue Key column header
            if (deviceType !== 'LV' && index === 0) {
                tableHTML += `<th class="issue-key-header">${header}</th>`;
            } else {
                tableHTML += `<th>${header}</th>`;
            }
        });
        tableHTML += '</tr></thead>';
        
        // Create table body
        tableHTML += '<tbody>';
        
        filteredTestCases.forEach((testCase, index) => {
            // Apply sub-row styling if needed
            const rowClasses = [];
            if (testCase.isSubRow) {
                rowClasses.push('sub-row');
                rowClasses.push('sub-line-divider');
            }
            
            tableHTML += `<tr data-index="${index}" class="${rowClasses.join(' ')}">`;
            
            if (deviceType === 'LV') {
                // Issue Key for LV - using the same fixed width approach as for non-LV
                const issueKey = testCase.issueKey || 'N/A';
                tableHTML += `<td style="width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${issueKey}
                    <i class="notes-icon fa fa-sticky-note" onclick="openNotesPopup(${index})" title="Add/Edit Notes"></i>
                </td>`;
                
                // Summary for LV - remove LV label if present
                let summary = testCase.summary || 'N/A';
                // Remove 'LV' prefix if it exists
                summary = summary.replace(/^\s*LV\s*[-:]*\s*/i, '');
                // Use the same styling as other device types
                tableHTML += `<td>${summary}</td>`;
                
                // Description - clean and preserve line breaks, reduce width to give space to Zen V1 and Mysa LV
                let description = testCase.description || 'N/A';
                description = cleanDescription(description);
                tableHTML += `<td style="width: 30%;">${description.replace(/\n/g, '<br>')}</td>`;
                
                // Zen V1 column - preserve line breaks and set fixed width
                const zenV1 = testCase.zenV1 || '';
                tableHTML += `<td style="width: 20%;">${zenV1.replace(/\n/g, '<br>')}</td>`;
                
                // Mysa LV column - preserve line breaks and set fixed width
                const mysaLV = testCase.mysaLV || '';
                tableHTML += `<td style="width: 20%;">${mysaLV.replace(/\n/g, '<br>')}</td>`;
            } else {
                // Issue Key on a single line - using a fixed width approach
                const issueKey = testCase.issueKey || 'N/A';
                tableHTML += `<td style="width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${issueKey}
                    <i class="notes-icon fa fa-sticky-note" onclick="openNotesPopup(${index})" title="Add/Edit Notes"></i>
                </td>`;
                
                // Summary as a separate column
                tableHTML += `<td>${testCase.summary || 'N/A'}</td>`;
                
                // Description - clean and preserve line breaks
                let description = testCase.description || 'N/A';
                description = cleanDescription(description);
                tableHTML += `<td>${description.replace(/\n/g, '<br>')}</td>`;
                
                // Labels column for non-LV device types
                tableHTML += `<td>${testCase.labels || 'N/A'}</td>`;
            }
            
            // Pass/Fail dropdown
            tableHTML += '<td>';
            tableHTML += '<select class="status-select" onchange="updateTestStatus(this)">';
            tableHTML += '<option value="not-tested" selected>Not Tested</option>';
            tableHTML += '<option value="pass">Pass</option>';
            tableHTML += '<option value="fail">Fail</option>';
            tableHTML += '</select>';
            tableHTML += '</td>';
            
            tableHTML += '</tr>';
        });
        
        tableHTML += '</tbody></table>';
        
        // Display the table
        testDataContainer.innerHTML = tableHTML;
        
        // Add event listener for status changes
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', function() {
                const row = this.closest('tr');
                const index = row.dataset.index;
                const status = this.value;
                
                // Update the test case status
                filteredTestCases[index].status = status;
                
                // Apply color styling based on selection
                this.className = 'status-select';
                if (status === 'pass') {
                    this.classList.add('pass-selected');
                } else if (status === 'fail') {
                    this.classList.add('fail-selected');
                }
                
                // Update summary stats
                updateSummaryStats();
            });
        });
        
        // Add click event listeners to test case rows
        document.querySelectorAll('#test-data-container tr').forEach(row => {
            row.addEventListener('click', function(event) {
                // Ignore clicks on the select dropdown
                if (event.target.tagName === 'SELECT' || event.target.tagName === 'OPTION') {
                    return;
                }
                
                const index = this.dataset.index;
                if (index !== undefined) {
                    // Display the selected test case in the Test Case Tracker window
                    displaySelectedTestCase(index);
                }
            });
        });
    }
    
    // Function to filter LV test cases by category
    function filterLVTestCasesByCategory(category) {
        // If no category selected or 'all' selected, show all test cases
        if (!category || category === 'all') {
            filteredTestCases = [...originalLVTestCases];
        } else {
            // Filter test cases based on the Issue Key prefix
            filteredTestCases = originalLVTestCases.filter(testCase => {
                const issueKey = testCase.issueKey || '';
                
                switch(category) {
                    case 'heat':
                        return issueKey.startsWith('H-');
                    case 'cool':
                        return issueKey.startsWith('C-');
                    case 'general':
                        return issueKey.startsWith('G-');
                    case 'pairing':
                        return issueKey.startsWith('CP-');
                    case 'specific':
                        return issueKey.startsWith('CN-');
                    default:
                        return true;
                }
            });
        }
        
        // Display the filtered test cases
        displayFilteredTestCases('LV');
        
        // Update summary statistics
        updateSummaryStats();
    }
    
    // Update the summary statistics
    function updateSummaryStats() {
        // Calculate totals
        let totalTests = filteredTestCases.length;
        let totalPassed = 0;
        let totalFailed = 0;
        let totalNotTested = 0;
        
        filteredTestCases.forEach(testCase => {
            if (testCase.status === 'pass') {
                totalPassed++;
            } else if (testCase.status === 'fail') {
                totalFailed++;
            } else {
                totalNotTested++;
            }
        });
        
        // Calculate pass rate (only considering tested items - Pass vs Fail)
        const testedTotal = totalPassed + totalFailed;
        const passRate = testedTotal > 0 ? Math.round((totalPassed / testedTotal) * 100) : 0;
        
        // Update summary stats display
        document.getElementById('total-tests').textContent = totalTests;
        document.getElementById('passed-tests').textContent = totalPassed;
        document.getElementById('failed-tests').textContent = totalFailed;
        document.getElementById('not-tested-tests').textContent = totalNotTested;
        document.getElementById('pass-rate').textContent = `${passRate}%`;
        
        // Update the summary display
        const summaryDisplay = document.getElementById('test-summary-display');
        if (summaryDisplay) {
            summaryDisplay.innerHTML = `
                <div class="summary-stats">
                    <div class="stat-item">Total: <span class="stat-value">${totalTests}</span></div>
                    <div class="stat-item">Passed: <span class="stat-value pass">${totalPassed}</span></div>
                    <div class="stat-item">Failed: <span class="stat-value fail">${totalFailed}</span></div>
                    <div class="stat-item">Not Tested: <span class="stat-value">${totalNotTested}</span></div>
                </div>
            `;
        }
    }
    
    // Display the selected test case in the Test Case Tracker window
    function displaySelectedTestCase(index) {
        const testCase = filteredTestCases[index];
        if (!testCase) return;
        
        // Generate a unique ID for this test case
        const testCaseId = `test-case-${Date.now()}`;
        
        // Store as currently displayed test case - this is the key part that makes the buttons work
        currentlyDisplayedTestCase = testCaseId;
        
        // Initialize test log entries for this test case
        if (!testLogEntries[testCaseId]) {
            testLogEntries[testCaseId] = {};
        }
        
        // Store test case data
        testLogEntries[testCaseId].testCase = testCase;
        testLogEntries[testCaseId].index = index; // Store the index for updating status later
        
        // Create the test case display
        selectedTestCaseDisplay.innerHTML = '';
        
        // Create the header
        const header = document.createElement('h3');
        header.textContent = testCase.summary || 'Selected Test Case';
        selectedTestCaseDisplay.appendChild(header);
        
        // Create the test case details
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'test-case-details';
        
        // Add test case ID/number
        const idElement = document.createElement('div');
        idElement.className = 'test-case-id';
        idElement.innerHTML = `<strong>Issue Key:</strong> ${testCase.issueKey || 'N/A'}`;
        detailsContainer.appendChild(idElement);
        
        // Add summary
        const summaryElement = document.createElement('div');
        summaryElement.className = 'test-case-summary';
        let summary = testCase.summary || 'N/A';
        // Remove 'LV' prefix if it exists
        summary = summary.replace(/^\s*LV\s*[-:]*\s*/i, '');
        summaryElement.innerHTML = `<strong>Summary:</strong> ${summary}`;
        detailsContainer.appendChild(summaryElement);
        
        // Add description
        const descElement = document.createElement('div');
        descElement.className = 'test-case-description';
        descElement.innerHTML = `<strong>Description:</strong><br>${testCase.description ? testCase.description.replace(/\n/g, '<br>') : 'N/A'}`;
        detailsContainer.appendChild(descElement);
        
        // For LV tests, add Zen V1 and Mysa LV fields if they exist
        if (testCase.zenV1 !== undefined) {
            const zenV1Element = document.createElement('div');
            zenV1Element.className = 'test-case-zen-v1';
            zenV1Element.innerHTML = `<strong>Zen V1:</strong><br>${testCase.zenV1 ? testCase.zenV1.replace(/\n/g, '<br>') : 'N/A'}`;
            detailsContainer.appendChild(zenV1Element);
        }
        
        if (testCase.mysaLV !== undefined) {
            const mysaLVElement = document.createElement('div');
            mysaLVElement.className = 'test-case-mysa-lv';
            mysaLVElement.innerHTML = `<strong>Mysa LV:</strong><br>${testCase.mysaLV ? testCase.mysaLV.replace(/\n/g, '<br>') : 'N/A'}`;
            detailsContainer.appendChild(mysaLVElement);
        }
        
        selectedTestCaseDisplay.appendChild(detailsContainer);
        
        // Add note about using existing buttons
        const noteElement = document.createElement('div');
        noteElement.className = 'test-note';
        noteElement.innerHTML = `<p>Use the <strong>Start</strong>, <strong>Pass</strong>, and <strong>Fail</strong> buttons above to log test actions.</p>`;
        selectedTestCaseDisplay.appendChild(noteElement);
        
        // Update button states - this enables/disables buttons appropriately
        updateTestActionButtonsState();
        
        // Add event listener for test log updates to update the status in the table
        document.addEventListener('testLogUpdated', function updateTestStatus() {
            // Check if this is still the current test case
            if (currentlyDisplayedTestCase === testCaseId) {
                // Update test status in the table based on the log entries
                if (testLogEntries[testCaseId].pass) {
                    updateTestCaseStatus(index, 'pass');
                } else if (testLogEntries[testCaseId].fail) {
                    updateTestCaseStatus(index, 'fail');
                }
            } else {
                // Remove this listener if it's no longer the current test case
                document.removeEventListener('testLogUpdated', updateTestStatus);
            }
        });
    }
    
    // We're using the existing test action buttons and functions instead of these custom ones
    
    // Clean description by removing 'Complete Using: Android Device or iOS Device' section
    function cleanDescription(description) {
        if (!description) return '';
        
        // Check if the description contains a reference to both Android and iOS devices
        const hasBothDevices = /Android.*iOS|iOS.*Android/i.test(description);
        
        if (hasBothDevices) {
            // Find the index where the 'Complete using' section starts
            const completeUsingMatch = description.match(/\*Complete [uU]sing:?\*/i);
            
            if (completeUsingMatch && completeUsingMatch.index !== undefined) {
                // Get everything before the 'Complete using' section
                description = description.substring(0, completeUsingMatch.index).trim();
                
                // Clean up any trailing newlines
                description = description.replace(/\n+$/g, '');
            }
        }
        
        return description;
    }
    
    // Update the test case status in the table
    function updateTestCaseStatus(index, status) {
        if (index < 0 || index >= filteredTestCases.length) return;
        
        // Update the status in the data
        filteredTestCases[index].status = status;
        
        // Update the dropdown in the table
        const rows = document.querySelectorAll('#test-data-container tr');
        if (rows[index]) {
            const select = rows[index].querySelector('.status-select');
            if (select) {
                select.value = status;
                
                // Apply color styling
                select.className = 'status-select';
                if (status === 'pass') {
                    select.classList.add('pass-selected');
                } else if (status === 'fail') {
                    select.classList.add('fail-selected');
                }
            }
        }
        
        // Update summary stats
        updateSummaryStats();
    }
    
    // Function to update test status (called from inline event handler)
    window.updateTestStatus = function(selectElement) {
        const row = selectElement.closest('tr');
        const index = parseInt(row.dataset.index);
        const status = selectElement.value;
        
        // Update the test case status
        filteredTestCases[index].status = status;
        
        // Apply color styling based on selection
        selectElement.className = 'status-select';
        if (status === 'pass') {
            selectElement.classList.add('pass-selected');
        } else if (status === 'fail') {
            selectElement.classList.add('fail-selected');
        }
        
        // Update summary stats
        updateSummaryStats();
    };
    
    // Initialize
    updateSummaryStats();
    
    // Notes popup functionality
    let currentNoteIndex = -1;
    
    // Function to open the notes popup
    window.openNotesPopup = function(index) {
        currentNoteIndex = index;
        const testCase = filteredTestCases[index];
        if (!testCase) return;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'notes-overlay';
        document.body.appendChild(overlay);
        
        // Create popup
        const popup = document.createElement('div');
        popup.className = 'notes-popup';
        
        // Create popup header
        const popupHeader = document.createElement('div');
        popupHeader.className = 'notes-popup-header';
        
        const popupTitle = document.createElement('h3');
        popupTitle.textContent = `Notes for ${testCase.issueKey}`;
        popupHeader.appendChild(popupTitle);
        
        const closeButton = document.createElement('button');
        closeButton.className = 'close-notes-popup';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = closeNotesPopup;
        popupHeader.appendChild(closeButton);
        
        popup.appendChild(popupHeader);
        
        // Create textarea for notes
        const textarea = document.createElement('textarea');
        textarea.className = 'notes-textarea';
        textarea.value = testCase.notes || '';
        textarea.placeholder = 'Add your notes here...';
        popup.appendChild(textarea);
        
        // Create save button
        const saveButton = document.createElement('button');
        saveButton.className = 'save-notes-btn';
        saveButton.textContent = 'Save Notes';
        saveButton.onclick = function() {
            saveNotes(textarea.value);
        };
        popup.appendChild(saveButton);
        
        document.body.appendChild(popup);
        
        // Focus the textarea
        textarea.focus();
        
        // Close popup when clicking on overlay
        overlay.addEventListener('click', closeNotesPopup);
    };
    
    // Function to save notes
    function saveNotes(notesText) {
        if (currentNoteIndex >= 0 && currentNoteIndex < filteredTestCases.length) {
            // Save the notes to the test case
            filteredTestCases[currentNoteIndex].notes = notesText;
            
            // Close the popup
            closeNotesPopup();
            
            // Provide visual feedback that notes were saved
            const row = document.querySelector(`tr[data-index="${currentNoteIndex}"]`);
            if (row) {
                const notesIcon = row.querySelector('.notes-icon');
                if (notesIcon) {
                    // Change color or add a class to indicate notes exist
                    if (notesText.trim()) {
                        notesIcon.style.opacity = '1';
                    } else {
                        notesIcon.style.opacity = '0.7';
                    }
                }
            }
        }
    }
    
    // Function to close the notes popup
    function closeNotesPopup() {
        // Remove the overlay and popup
        const overlay = document.querySelector('.notes-overlay');
        const popup = document.querySelector('.notes-popup');
        
        if (overlay) document.body.removeChild(overlay);
        if (popup) document.body.removeChild(popup);
        
        currentNoteIndex = -1;
    }
});
