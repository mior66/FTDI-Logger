// Print the test plan with all test cases, status, and metadata
function printTestPlan() {
    // Get the test plan table
    const testPlanTable = document.querySelector('#test-data-container table');
    
    if (!testPlanTable) {
        showNotification('No test plan loaded', 'error');
        return;
    }
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    // Get metadata information
    const deviceType = document.getElementById('deviceType')?.value || '--';
    const firmwareVersion = document.getElementById('firmware-build')?.value || document.getElementById('firmware-version')?.textContent || '--';
    const appVersionTracker = document.getElementById('app-version-tracker')?.value || '';
    const appVersionStatus = document.getElementById('app-version')?.textContent || '--';
    const appVersion = appVersionTracker || (appVersionStatus !== '--' ? appVersionStatus : '--');
    const phoneOSVersion = document.getElementById('phone-type')?.value || '--';
    
    // Get test plan notes if they exist
    const testPlanNotes = document.getElementById('test-plan-notes')?.value || '';
    
    // Get test statistics
    const passedTests = document.getElementById('passed-tests') ? parseInt(document.getElementById('passed-tests').textContent) || 0 : 0;
    const failedTests = document.getElementById('failed-tests') ? parseInt(document.getElementById('failed-tests').textContent) || 0 : 0;
    const notTestedTests = document.getElementById('not-tested-tests') ? parseInt(document.getElementById('not-tested-tests').textContent) || 0 : 0;
    const passRate = document.getElementById('pass-rate') ? document.getElementById('pass-rate').textContent : '0%';
    
    // Get all rows from the table body
    const rows = testPlanTable.querySelectorAll('tbody tr');
    const totalTests = rows.length;
    
    // Get the headers from the table
    const headers = [];
    const headerRow = testPlanTable.querySelector('thead tr');
    if (headerRow) {
        headerRow.querySelectorAll('th').forEach(th => {
            headers.push(th.textContent || '');
        });
    }
    
    // Find the index of the Issue Key column, Summary column, and Description column
    let issueKeyIndex = -1;
    let summaryIndex = -1;
    let descriptionIndex = -1;
    
    headers.forEach((header, index) => {
        const headerText = header.toLowerCase();
        if (headerText.includes('issue') || headerText.includes('key') || headerText.includes('test #') || headerText === 'id') {
            issueKeyIndex = index;
        }
        if (headerText.includes('summary')) {
            summaryIndex = index;
        }
        if (headerText.includes('description')) {
            descriptionIndex = index;
        }
    });
    
    // If we couldn't find the Issue Key column, use the first column
    if (issueKeyIndex === -1) issueKeyIndex = 0;
    // If we couldn't find the Summary column, use the second column
    if (summaryIndex === -1) summaryIndex = 1;
    // If we couldn't find the Description column, use the third column
    if (descriptionIndex === -1) descriptionIndex = 2;
    
    // Create the HTML content
    let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>FTDI Logger - Test Plan</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #0d5c23; margin-bottom: 5px; }
                h2 { color: #0d5c23; margin-top: 20px; margin-bottom: 10px; }
                .metadata { margin-bottom: 20px; }
                .metadata-item { margin: 5px 0; }
                .metadata-label { font-weight: bold; }
                .statistics { margin-bottom: 20px; }
                .statistics-item { margin: 5px 0; }
                .test-case { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #ddd; }
                .test-case-header { font-weight: bold; margin-bottom: 3px; }
                .test-case-info { margin: 2px 0; }
                .test-case-description { margin: 3px 0; white-space: normal; }
                .test-case-notes { margin-top: 3px; white-space: normal; }
                .status { font-weight: bold; }
                .status-pass { color: #0d5c23; }
                .status-fail { color: #c5221f; }
                .status-incomplete { color: #f9a825; }
                .status-not-started { color: #777; }
                .notes-section { margin-top: 10px; }
                .notes-label { font-weight: bold; }
                .test-plan-notes { white-space: pre-wrap; margin-top: 5px; }
                .timestamp { color: #555; font-size: 12px; }
                .page-break { page-break-after: always; }
                .no-print { display: block; }
                @media print { 
                    body { font-size: 12px; }
                    h1 { font-size: 18px; }
                    h2 { font-size: 16px; }
                    .no-print { display: none; }
                    .test-case { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="margin-bottom: 20px;">
                <button onclick="window.print();" style="padding: 8px 15px; background-color: #0d5c23; color: white; border: none; border-radius: 4px; cursor: pointer;">Print</button>
                <button onclick="window.close();" style="padding: 8px 15px; background-color: #777; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">Close</button>
            </div>
            
            <h1>FTDI Logger - Test Plan Report</h1>
            <div class="metadata">
                <div class="metadata-item"><span class="metadata-label">Date:</span> ${new Date().toLocaleString()}</div>
                <div class="metadata-item"><span class="metadata-label">Device Type:</span> ${deviceType}</div>
                <div class="metadata-item"><span class="metadata-label">Firmware Version:</span> ${firmwareVersion}</div>
                <div class="metadata-item"><span class="metadata-label">App Version:</span> ${appVersion}</div>
                <div class="metadata-item"><span class="metadata-label">Phone OS/Version:</span> ${phoneOSVersion}</div>
            </div>
            
            <h2>Test Results Summary</h2>
            <div class="statistics">
                <div class="statistics-item"><span class="metadata-label">Total Tests:</span> ${totalTests}</div>
                <div class="statistics-item"><span class="metadata-label">Passed:</span> <span class="status-pass">${passedTests}</span></div>
                <div class="statistics-item"><span class="metadata-label">Failed:</span> <span class="status-fail">${failedTests}</span></div>
                <div class="statistics-item"><span class="metadata-label">Not Tested:</span> ${notTestedTests}</div>
                <div class="statistics-item"><span class="metadata-label">Pass Rate:</span> <span class="status-pass">${passRate}</span></div>
            </div>
    `;
    
    // Add Test Plan Notes if available
    if (testPlanNotes) {
        htmlContent += `<h2>Test Plan Notes</h2><div class="test-plan-notes">${testPlanNotes}</div>`;
    }
    
    htmlContent += `<h2>Test Cases</h2>`;
    
    // Add each test case
    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (!cells || cells.length === 0) return;
        
        // Get the Issue Key, Summary, and Description from the table cells
        const issueKey = cells[issueKeyIndex] ? cells[issueKeyIndex].textContent.trim() : 'unknown';
        const summary = cells[summaryIndex] ? cells[summaryIndex].textContent.trim() : '';
        const description = cells[descriptionIndex] ? cells[descriptionIndex].textContent.trim() : '';
        
        // Create a test case ID from the Issue Key
        const testCaseId = `${activeSheetName}-test-${issueKey}`;
        const testLogs = testLogEntries[testCaseId] || {};
        
        // Get the status from the row
        let status = 'Not Started';
        let statusClass = 'status-not-started';
        
        // Check if the last cell in the row contains 'Pass' or 'Fail' text
        const allCells = Array.from(cells);
        if (allCells.length > 0) {
            const lastCell = allCells[allCells.length - 1];
            const cellText = lastCell.textContent.trim();
            
            if (cellText === 'Pass') {
                status = 'PASS';
                statusClass = 'status-pass';
            } else if (cellText === 'Fail') {
                status = 'FAIL';
                statusClass = 'status-fail';
            }
        }
        
        // If status not found in last cell, check for visual status indicators
        if (status === 'Not Started') {
            const statusIndicator = row.querySelector('.status-indicator');
            if (statusIndicator) {
                if (statusIndicator.classList.contains('status-pass')) {
                    status = 'PASS';
                    statusClass = 'status-pass';
                } else if (statusIndicator.classList.contains('status-fail')) {
                    status = 'FAIL';
                    statusClass = 'status-fail';
                } else if (statusIndicator.classList.contains('status-in-progress')) {
                    status = 'INCOMPLETE';
                    statusClass = 'status-incomplete';
                }
            }
        }
        
        // If still not found, check for pass/fail buttons that are highlighted
        if (status === 'Not Started') {
            const passButton = row.querySelector('.pass-button.active');
            const failButton = row.querySelector('.fail-button.active');
            
            if (passButton) {
                status = 'PASS';
                statusClass = 'status-pass';
            } else if (failButton) {
                status = 'FAIL';
                statusClass = 'status-fail';
            }
        }
        
        // As a last resort, check the test logs
        if (status === 'Not Started') {
            if (testLogs.pass) {
                status = 'PASS';
                statusClass = 'status-pass';
            } else if (testLogs.fail) {
                status = 'FAIL';
                statusClass = 'status-fail';
            } else if (testLogs.start) {
                status = 'INCOMPLETE';
                statusClass = 'status-incomplete';
            }
        }
        
        // Get test case notes if available
        const notes = window.testCaseNotes && window.testCaseNotes[testCaseId] ? window.testCaseNotes[testCaseId] : '';
        
        // Add test case to HTML content
        htmlContent += `<div class="test-case"><div class="test-case-header">${issueKey}: ${summary}</div><div class="test-case-info"><span class="metadata-label">Status:</span> <span class="status ${statusClass}">${status}</span></div>`;
        
        // Add description if available
        if (description) {
            htmlContent += `<div class="test-case-description"><span class="metadata-label">Description:</span> ${description}</div>`;
        }
        
        // Add timestamps if available
        if (testLogs.start) {
            htmlContent += `<div class="test-case-info timestamp"><span class="metadata-label">Start:</span> ${testLogs.start.timestamp}</div>`;
        }
        if (testLogs.pass) {
            htmlContent += `<div class="test-case-info timestamp"><span class="metadata-label">Pass:</span> ${testLogs.pass.timestamp}</div>`;
        } else if (testLogs.fail) {
            htmlContent += `<div class="test-case-info timestamp"><span class="metadata-label">Fail:</span> ${testLogs.fail.timestamp}</div>`;
        }
        
        // Add notes if available
        if (notes) {
            htmlContent += `<div class="notes-section"><div class="notes-label">Notes:</div><div class="test-case-notes">${notes}</div></div>`;
        }
        
        htmlContent += `</div>`;
        
        // Add page break after every 15 test cases (except the last page)
        if ((index + 1) % 15 === 0 && index < rows.length - 1) {
            htmlContent += `<div class="page-break"></div>`;
        }
    });
    
    htmlContent += `</body></html>`;
    
    // Write the HTML content to the new window
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for the content to load before focusing the window
    printWindow.onload = function() {
        printWindow.focus();
    };
}
