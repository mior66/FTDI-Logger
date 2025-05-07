// Test Tracker Integration for FTDI Logger
document.addEventListener('DOMContentLoaded', function() {
    // Get references to elements
    const testTrackerButton = document.getElementById('test-tracker-button');
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
    let filteredTestCases = [];
    
    // Toggle Test Tracker panel when the button is clicked
    if (testTrackerButton) {
        testTrackerButton.addEventListener('click', function() {
            // Toggle the display of the Test Tracker panel
            if (testTrackerPanel.style.display === 'none') {
                // Hide the selected test case display
                selectedTestCaseDisplay.style.display = 'none';
                // Show the Test Tracker panel
                testTrackerPanel.style.display = 'block';
                
                // Update the button text to indicate it's active
                testTrackerButton.textContent = 'Automated Testing';
                testTrackerButton.style.backgroundColor = '#0a2a12';
            } else {
                // Show the selected test case display
                selectedTestCaseDisplay.style.display = 'block';
                // Hide the Test Tracker panel
                testTrackerPanel.style.display = 'none';
                
                // Update the button text to indicate it's inactive
                testTrackerButton.textContent = 'Manual Testing';
                testTrackerButton.style.backgroundColor = '#0d5c23';
            }
        });
    }
    
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
                } else {
                    // For other device types
                    // Update file upload text
                    const fileUploadText = document.querySelector('.file-upload-container p');
                    if (fileUploadText) {
                        fileUploadText.textContent = `Upload your ${currentDeviceType} test cases Excel file:`;
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
                alert('Please select a file first.');
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
            
            // Clear the test data container
            testDataContainer.innerHTML = '';
            
            // Reset summary stats
            updateSummaryStats();
            
            // Clear file input
            fileUpload.value = '';
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
                            case 'Smoke':
                                // Smoke - The label must include 'smoke' (case insensitive)
                                if (labels.some(label => label.toLowerCase().includes('smoke'))) {
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
                        isSubRow: isSubRow // Flag to identify sub-rows
                    });
                }
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
            headers = ['Test #', 'Summary', 'Description', 'Zen V1', 'Mysa LV', 'Pass/Fail'];
        } else {
            headers = ['Issue Key', 'Summary', 'Description', 'Labels', 'Pass/Fail'];
        }
        headers.forEach(header => {
            tableHTML += `<th>${header}</th>`;
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
            
            // Test # / Issue Key
            tableHTML += `<td>${testCase.issueKey || 'N/A'}</td>`;
            
            // Summary
            tableHTML += `<td>${testCase.summary || 'N/A'}</td>`;
            
            // Description - preserve line breaks
            const description = testCase.description || 'N/A';
            tableHTML += `<td>${description.replace(/\n/g, '<br>')}</td>`;
            
            if (deviceType === 'LV') {
                // Zen V1 column - preserve line breaks
                const zenV1 = testCase.zenV1 || '';
                tableHTML += `<td>${zenV1.replace(/\n/g, '<br>')}</td>`;
                
                // Mysa LV column - preserve line breaks
                const mysaLV = testCase.mysaLV || '';
                tableHTML += `<td>${mysaLV.replace(/\n/g, '<br>')}</td>`;
            } else {
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
});
