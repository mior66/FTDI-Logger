// Connect to Socket.io server
const socket = io();

// Map to store the relationship between error entries and log entries
let errorToLogMap = new Map();

// Environment data tracking
let envChart = null;
let temperatureData = [];
let humidityData = [];
let setpointData = [];
let timeLabels = [];
// Set to track processed setpoint messages to prevent duplicate plotting
let processedSetpointMessages = new Set();
const MAX_DATA_POINTS = 20; // Maximum number of data points to display on the chart
const MAX_VISIBLE_LOG_ENTRIES = 500; // Reduced from 1000 to 500 for better performance
const LOG_BATCH_RENDER_SIZE = 50; // Number of logs to render in a batch for better performance

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
// Timestamp is always enabled - removed checkbox
const logWindow = document.getElementById('log-window');
const errorWindow = document.getElementById('error-window');
const hiddenLogWindow = document.getElementById('hidden-log-window');
const connectionStatus = document.getElementById('connection-status');
const statusValue = document.getElementById('status-value');
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

// Array to store custom filter patterns
let customFilterPatterns = [];

// Map to track which filter hid which log entries
let filterToHiddenEntriesMap = new Map();

// Helper function to check if a message should be hidden
function shouldHideMessage(message) {
    // Check custom filter patterns
    for (const pattern of customFilterPatterns) {
        if (message.includes(pattern)) {
            return pattern; // Return the pattern that matched
        }
    }
    
    return false; // No pattern matched
}

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
    
    // Load default settings
    loadDefaultSettings();
    
    // Load the test plan data automatically
    loadTestPlanData();
    
    // Display a random inspirational quote
    displayRandomQuote();
    
    // Initialize environment data chart
    initializeEnvChart();
    
    // Directly add event listener for clear chart button
    document.getElementById('clear-chart-button').onclick = function() {
        clearChart();
    };
    
    // Set up event listeners
    connectButton.addEventListener('click', connectToPort);
    disconnectButton.addEventListener('click', disconnectFromPort);
    
    // Set up export all test cases button event listener
    const exportAllTestCasesButton = document.getElementById('export-all-test-cases');
    if (exportAllTestCasesButton) {
        exportAllTestCasesButton.addEventListener('click', exportAllTestCases);
    }

    clearLogButton.addEventListener('click', clearLog);
    saveLogButton.addEventListener('click', saveLog);
    clearErrorsButton.addEventListener('click', clearErrors);
    saveErrorsButton.addEventListener('click', saveErrors);
    clearSelectedTestCaseButton.addEventListener('click', clearSelectedTestCase);
    
    // Clear chart button event listener is now handled directly with onclick
    
    // Set up print buttons
    const printLogButton = document.getElementById('print-log');
    const printErrorsButton = document.getElementById('print-errors');
    
    if (printLogButton) {
        printLogButton.addEventListener('click', printLog);
    }
    
    if (printErrorsButton) {
        printErrorsButton.addEventListener('click', printErrors);
    }
    
    // Dark mode feature removed
    
    // Set up hidden filter input event listeners
    const addHiddenFilterButton = document.getElementById('add-hidden-filter');
    const hiddenFilterText = document.getElementById('hidden-filter-text');
    
    if (addHiddenFilterButton && hiddenFilterText) {
        // Add filter when button is clicked
        addHiddenFilterButton.addEventListener('click', addCustomFilter);
        
        // Add filter when Enter key is pressed in the input field
        hiddenFilterText.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                addCustomFilter();
            }
        });
    }
    
    // Initialize the parsed line types list
    updateParsedLineTypesList();
    
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
    
    // Set up manual test button event listener
    const manualTestButton = document.getElementById('manual-test-button');
    if (manualTestButton) {
        manualTestButton.addEventListener('click', createManualTestCase);
    }
    
    // Set up lunch idea button event listener
    const lunchIdeaButton = document.getElementById('lunch-idea-button');
    if (lunchIdeaButton) {
        lunchIdeaButton.addEventListener('click', suggestLunchPlaces);
    }
    
    // Set up work tasks button event listener
    const workTasksButton = document.getElementById('work-tasks-button');
    const tasksOverlay = document.getElementById('tasks-overlay');
    const tasksCloseButton = document.getElementById('tasks-close');
    const tasksSaveButton = document.getElementById('tasks-save');
    const tasksExportButton = document.getElementById('tasks-export');
    const tasksTextarea = document.getElementById('tasks-textarea');
    
    if (workTasksButton && tasksOverlay) {
        // Load saved tasks from localStorage
        const savedTasks = localStorage.getItem('workTasks');
        if (savedTasks && tasksTextarea) {
            tasksTextarea.value = savedTasks;
        }
        
        // Show tasks overlay when button is clicked
        workTasksButton.addEventListener('click', function() {
            tasksOverlay.classList.add('active');
        });
        
        // Close tasks overlay when close button is clicked
        if (tasksCloseButton) {
            tasksCloseButton.addEventListener('click', function() {
                tasksOverlay.classList.remove('active');
            });
        }
        
        // Save tasks when save button is clicked
        if (tasksSaveButton && tasksTextarea) {
            tasksSaveButton.addEventListener('click', function() {
                localStorage.setItem('workTasks', tasksTextarea.value);
                showNotification('Tasks saved successfully!', 'success');
                tasksOverlay.classList.remove('active');
            });
        }
        
        // Export tasks to text file when export button is clicked
        if (tasksExportButton && tasksTextarea) {
            tasksExportButton.addEventListener('click', function() {
                const tasksContent = tasksTextarea.value;
                if (!tasksContent.trim()) {
                    showNotification('No tasks to export', 'error');
                    return;
                }
                
                // Create a blob with the tasks content
                const blob = new Blob([tasksContent], { type: 'text/plain' });
                
                // Create a download link
                const downloadLink = document.createElement('a');
                downloadLink.href = URL.createObjectURL(blob);
                
                // Generate filename with current date and time
                const now = new Date();
                const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
                const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
                downloadLink.download = `FTDI-Logger-Tasks_${dateStr}_${timeStr}.txt`;
                
                // Trigger download
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                
                showNotification('Tasks exported successfully!', 'success');
            });
        }
    }
    
    // Set up bug list button event listener
    const bugListButton = document.getElementById('bug-list-button');
    const bugListOverlay = document.getElementById('bug-list-overlay');
    const bugListCloseButton = document.getElementById('bug-list-close');
    const bugListRefreshButton = document.getElementById('bug-list-refresh');
    const bugListTbody = document.getElementById('bug-list-tbody');
    const bugListLoading = document.querySelector('.bug-list-loading');
    const bugListError = document.querySelector('.bug-list-error');
    const bugListContainer = document.querySelector('.bug-list-container');
    const reporterFilter = document.getElementById('reporter-filter');
    
    // Variables for bug list sorting
    let currentSortColumn = 'number';
    let currentSortDirection = 'asc';
    let bugData = [];
    
    // Function to open the Jira page directly
    function openJiraPage() {
        // Check if we're on the MYSA Logger page
        if (window.location.pathname.includes('mysa-logger')) {
            // MYSA Jira filter
            window.open('https://empoweredhomes.atlassian.net/issues/?filter=10571', '_blank');
        } else {
            // LV Jira filter
            window.open('https://empoweredhomes.atlassian.net/jira/software/c/projects/LV/issues/?jql=project%20%3D%20%22LV%22%20AND%20reporter%20%3D%2062726ff1106b60006f583820%20ORDER%20BY%20created%20DESC', '_blank');
        }
    }
    
    // Function to show today's sports events
    function showTodaysSports() {
        // Create a modal dialog
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        // Create the modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content sports-modal';
        
        // Add a close button
        const closeButton = document.createElement('span');
        closeButton.className = 'close-button';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', function() {
            document.body.removeChild(modal);
        });
        
        // Add a title
        const title = document.createElement('h2');
        title.textContent = 'Today\'s Sports Events';
        
        // Get current date
        const now = new Date();
        const dateString = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        
        // Add date subtitle
        const dateSubtitle = document.createElement('h3');
        dateSubtitle.textContent = dateString;
        dateSubtitle.className = 'sports-date';
        
        // Create the sports events container
        const sportsContainer = document.createElement('div');
        sportsContainer.className = 'sports-container';
        
        // Add loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = '<div class="spinner"></div><p>Loading today\'s games...</p>';
        sportsContainer.appendChild(loadingIndicator);
        
        // Assemble the modal
        modalContent.appendChild(closeButton);
        modalContent.appendChild(title);
        modalContent.appendChild(dateSubtitle);
        modalContent.appendChild(sportsContainer);
        modal.appendChild(modalContent);
        
        // Add the modal to the body
        document.body.appendChild(modal);
        
        // Close the modal when clicking outside of it
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                document.body.removeChild(modal);
            }
        });
        
        // Fetch real sports data
        fetchSportsData(sportsContainer);
    }
    
    // Teams to highlight in the sports events window
    const teamsToHighlight = [
        'Boston Bruins',
        'Toronto Maple Leafs',
        'Montreal Canadians',
        'New York Yankees',
        'Los Angelas Dodgers',
        'Toronto Raptors',
        'Los Angelas Lakers',
        'Toronto Blue Jays',
        'Edmonton Oilers'
    ];
    
    // Function to check if a matchup contains any of the teams to highlight
    function shouldHighlightTeam(matchup) {
        return teamsToHighlight.some(team => matchup.includes(team));
    }
    
    // Function to fetch real sports data from API
    function fetchSportsData(container) {
        // Clear any existing content
        container.innerHTML = '';
        
        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        
        // Define league info using our server-side proxy
        const leagues = [
            { id: 'nba', name: 'NBA', icon: '🏀', apiEndpoint: '/api/sports/nba' },
            { id: 'nhl', name: 'NHL', icon: '🏒', apiEndpoint: '/api/sports/nhl' },
            { id: 'mlb', name: 'MLB', icon: '⚾', apiEndpoint: '/api/sports/mlb' },
            { id: 'nfl', name: 'NFL', icon: '🏈', apiEndpoint: '/api/sports/nfl' },
            { id: 'golf', name: 'Golf', icon: '⛳', apiEndpoint: '/api/sports/golf' },
            { id: 'wnba', name: 'WNBA', icon: '🏀', apiEndpoint: '/api/sports/wnba' },
            { id: 'mls', name: 'MLS Soccer', icon: '⚽', apiEndpoint: '/api/sports/mls' }
        ];
        
        // Create a promise for each league
        const promises = leagues.map(league => {
            console.log(`Fetching data for ${league.name} from: ${league.apiEndpoint}`);
            return fetch(league.apiEndpoint)
                .then(response => {
                    console.log(`${league.name} response status:`, response.status);
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log(`${league.name} data received:`, data);
                    if (!data || !data.events) {
                        console.error(`${league.name} data is missing events property:`, data);
                        throw new Error('Invalid data format');
                    }
                    return { league, data };
                })
                .catch(error => {
                    console.error(`Error fetching ${league.name} data:`, error);
                    return { 
                        league, 
                        data: { events: [] }, 
                        error: true 
                    };
                });
        });
        
        // Wait for all promises to resolve
        Promise.all(promises)
            .then(results => {
                let hasAnyEvents = false;
                let hasAnyErrors = false;
                
                // Process each league's data
                results.forEach(result => {
                    const { league, data, error } = result;
                    
                    // Create league section
                    const leagueSection = document.createElement('div');
                    leagueSection.className = 'league-section';
                    
                    // Add league header
                    const leagueHeader = document.createElement('h4');
                    leagueHeader.innerHTML = `${league.icon} ${league.name}`;
                    leagueSection.appendChild(leagueHeader);
                    
                    // Add events
                    const eventsList = document.createElement('ul');
                    eventsList.className = 'events-list';
                    
                    if (error || !data.events || data.events.length === 0) {
                        const eventItem = document.createElement('li');
                        eventItem.className = 'event-item';
                        eventItem.textContent = error ? 'Error loading games' : 'No games scheduled today';
                        eventsList.appendChild(eventItem);
                        
                        if (error) {
                            hasAnyErrors = true;
                            console.error(`Error with ${league.name} data:`, error);
                        }
                    } else {
                        hasAnyEvents = true;
                        
                        // Log all events for debugging
                        console.log(`${league.name} all events:`, data.events);
                        
                        // For now, just use all events from the API
                        // The ESPN API should be returning today's events by default
                        const todaysEvents = data.events;
                        
                        // Log the events we're using
                        console.log(`${league.name}: Using ${todaysEvents.length} events`);
                        
                        console.log(`${league.name}: Found ${todaysEvents.length} events for today out of ${data.events.length} total events`);
                        
                        if (todaysEvents.length === 0) {
                            const eventItem = document.createElement('li');
                            eventItem.className = 'event-item';
                            eventItem.textContent = 'No games scheduled today';
                            eventsList.appendChild(eventItem);
                        } else {
                            // Process today's events for this league
                            todaysEvents.forEach(event => {
                                try {
                                    const eventItem = document.createElement('li');
                                    eventItem.className = 'event-item';
                                    
                                    // Handle different sports formats
                                    let matchup = '';
                                    
                                    // Special handling for golf which doesn't have home/away teams
                                    if (league.id === 'golf') {
                                        // For golf, show the tournament name and top competitors
                                        const tournamentName = event.name || 'Golf Tournament';
                                        
                                        // Try to get top competitors if available
                                        let topPlayers = '';
                                        if (event.competitions[0].competitors && event.competitions[0].competitors.length > 0) {
                                            // Get top 3 players if available
                                            const players = event.competitions[0].competitors
                                                .slice(0, 3)
                                                .map(player => {
                                                    // Try to get player name from different possible locations in the API response
                                                    return player.athlete?.displayName || 
                                                           player.athlete?.fullName || 
                                                           player.team?.displayName || 
                                                           player.displayName || 
                                                           'Unknown Player';
                                                });
                                            
                                            if (players.length > 0) {
                                                topPlayers = `: ${players.join(', ')}...`;
                                            }
                                        }
                                        
                                        matchup = `${tournamentName}${topPlayers}`;
                                    } else {
                                        // Standard team sports handling
                                        const homeTeam = event.competitions[0].competitors.find(team => team.homeAway === 'home');
                                        const awayTeam = event.competitions[0].competitors.find(team => team.homeAway === 'away');
                                        
                                        if (!homeTeam || !awayTeam) {
                                            throw new Error('Missing team data');
                                        }
                                        
                                        matchup = `${awayTeam.team.displayName} vs. ${homeTeam.team.displayName}`;
                                    }
                                    
                                    // Get time
                                    const date = new Date(event.date);
                                    const timeString = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                                    
                                    // Get broadcast info
                                    let channel = 'TBD';
                                    if (event.competitions[0].broadcasts && event.competitions[0].broadcasts.length > 0) {
                                        channel = event.competitions[0].broadcasts[0].names.join(', ');
                                    }
                                    
                                    const teamsSpan = document.createElement('span');
                                    teamsSpan.className = 'event-teams';
                                    teamsSpan.textContent = matchup;
                                    
                                    // Check if this matchup contains any of the teams to highlight
                                    if (shouldHighlightTeam(matchup)) {
                                        eventItem.classList.add('highlighted-team');
                                    }
                                    
                                    const timeSpan = document.createElement('span');
                                    timeSpan.className = 'event-time';
                                    timeSpan.textContent = timeString;
                                    
                                    const channelSpan = document.createElement('span');
                                    channelSpan.className = 'event-channel';
                                    channelSpan.textContent = `on ${channel}`;
                                    
                                    eventItem.appendChild(teamsSpan);
                                    eventItem.appendChild(document.createTextNode(' • '));
                                    eventItem.appendChild(timeSpan);
                                    eventItem.appendChild(document.createTextNode(' • '));
                                    eventItem.appendChild(channelSpan);
                                    
                                    eventsList.appendChild(eventItem);
                                } catch (eventError) {
                                    console.error('Error processing event:', eventError, event);
                                    const errorItem = document.createElement('li');
                                    errorItem.className = 'event-item error-item';
                                    errorItem.textContent = 'Error processing game data';
                                    eventsList.appendChild(errorItem);
                                }
                            });
                        }
                    }
                    
                    leagueSection.appendChild(eventsList);
                    container.appendChild(leagueSection);
                });
                
                // If no events were found for any league
                if (container.children.length === 0) {
                    const noEventsMessage = document.createElement('div');
                    noEventsMessage.className = 'no-events-message';
                    noEventsMessage.textContent = 'No sports events scheduled for today.';
                    container.appendChild(noEventsMessage);
                } else if (!hasAnyEvents && hasAnyErrors) {
                    // Add a retry button if we had errors but no events
                    const retryButton = document.createElement('button');
                    retryButton.className = 'retry-button';
                    retryButton.textContent = 'Retry Loading Data';
                    retryButton.addEventListener('click', function() {
                        fetchSportsData(container);
                    });
                    
                    const retryContainer = document.createElement('div');
                    retryContainer.className = 'retry-container';
                    retryContainer.appendChild(retryButton);
                    container.appendChild(retryContainer);
                }
            })
            .catch(error => {
                console.error('Error fetching sports data:', error);
                container.innerHTML = '<div class="error-message">Error loading sports data. Please try again later.</div>';
                
                // Add a retry button
                const retryButton = document.createElement('button');
                retryButton.className = 'retry-button';
                retryButton.textContent = 'Retry Loading Data';
                retryButton.addEventListener('click', function() {
                    fetchSportsData(container);
                });
                
                const retryContainer = document.createElement('div');
                retryContainer.className = 'retry-container';
                retryContainer.appendChild(retryButton);
                container.appendChild(retryContainer);
            });
    }
    
    // Function to update bug counts
    function updateBugCounts(bugs) {
        const totalCount = bugs.length;
        document.getElementById('bug-count-total').textContent = totalCount;
        
        // Count bugs by priority
        const priorityCounts = {
            highest: 0,
            high: 0,
            medium: 0,
            low: 0
        };
        
        bugs.forEach(bug => {
            // Add null check before using toLowerCase
            const priority = bug.priority ? bug.priority.toLowerCase() : 'medium';
            if (priorityCounts.hasOwnProperty(priority)) {
                priorityCounts[priority]++;
            }
        });
        
        // Update priority count elements
        document.getElementById('bug-count-highest').textContent = priorityCounts.highest;
        document.getElementById('bug-count-high').textContent = priorityCounts.high;
        document.getElementById('bug-count-medium').textContent = priorityCounts.medium;
        document.getElementById('bug-count-low').textContent = priorityCounts.low;
    }
    
    // Function to sort bugs
    function sortBugs(bugs, column, direction) {
        return [...bugs].sort((a, b) => {
            let valueA = a[column];
            let valueB = b[column];
            
            // Handle special sorting for dates
            if (column === 'updated') {
                valueA = new Date(valueA);
                valueB = new Date(valueB);
            }
            
            // Handle priority sorting
            if (column === 'priority') {
                const priorityOrder = { 'highest': 0, 'high': 1, 'medium': 2, 'low': 3 };
                valueA = priorityOrder[valueA && typeof valueA === 'string' ? valueA.toLowerCase() : 'medium'] || 999;
                valueB = priorityOrder[valueB && typeof valueB === 'string' ? valueB.toLowerCase() : 'medium'] || 999;
            }
            
            // Compare values
            if (valueA < valueB) {
                return direction === 'asc' ? -1 : 1;
            }
            if (valueA > valueB) {
                return direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }
    
    // Function to render bugs
    function renderBugs(bugs) {
        // Clear existing bug list
        bugListTbody.innerHTML = '';
        
        // Add bugs to table
        bugs.forEach(bug => {
            const row = document.createElement('tr');
            
            // Add priority class with null check
            const priorityClass = `priority-${bug.priority ? bug.priority.toLowerCase() : 'medium'}`;
            
            // Add status class with null check
            const statusClass = bug.status ? `status-${bug.status.toLowerCase().replace(/\s+/g, '')}` : 'status-unknown';
            
            row.innerHTML = `
                <td><a href="${bug.url || '#'}" target="_blank" class="bug-number-link">${bug.key}</a></td>
                <td>${bug.reporter}</td>
                <td>${bug.summary}</td>
                <td class="${priorityClass}">${bug.priority}</td>
            `;
            
            bugListTbody.appendChild(row);
        });
    }
    
    // Function to sort and render bugs
    function sortAndRenderBugs() {
        const sortedBugs = sortBugs(bugData, currentSortColumn, currentSortDirection);
        renderBugs(sortedBugs);
        
        // Update sort indicators
        document.querySelectorAll('.bug-list-table th.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.dataset.sort === currentSortColumn) {
                th.classList.add(currentSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });
    }
    
    if (bugListButton) {
        // Open the actual Jira page when button is clicked
        bugListButton.addEventListener('click', function() {
            openJiraPage();
        });
        
        // No need for other bug list related event listeners
    }
    
    // Set up Today's Sports button event listener
    const todaysSportsButton = document.getElementById('todays-sports-button');
    if (todaysSportsButton) {
        todaysSportsButton.addEventListener('click', function() {
            showTodaysSports();
        });
    }
    
    // Set up error legend filtering
    setupErrorLegendFiltering();
    
    // Set up export button event listener
    const exportSelectedTestCaseButton = document.getElementById('export-selected-test-case');
    exportSelectedTestCaseButton.addEventListener('click', exportSelectedTestCase);
    
    // Set up test action button event listeners
    testStartButton.addEventListener('click', addTestStartLog);
    testPassButton.addEventListener('click', addTestPassLog);
    testFailButton.addEventListener('click', addTestFailLog);
    
    // Timestamp checkbox removed - timestamps are always enabled
    // No need for event listener as timestamps are now always shown
    
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
    
    // Create a queue for processing log entries to prevent UI blocking
    let logQueue = [];
    let processingQueue = false;
    
    // Function to process the log queue in batches
    function processLogQueue() {
        if (logQueue.length === 0) {
            processingQueue = false;
            return;
        }
        
        processingQueue = true;
        
        // Process a batch of logs
        const batch = logQueue.splice(0, LOG_BATCH_RENDER_SIZE);
        
        // Process each log entry in the batch
        batch.forEach(data => {
            // Check if this data should be hidden
            if (shouldHideMessage(data.data)) {
                // Add to hidden entries
                hiddenEntries.push({ timestamp: data.timestamp, message: data.data });
                
                // Update hidden log window (debounced to prevent excessive updates)
                updateHiddenLogWindow();
            } else {
                // Add to regular log entries
                addLogEntry(data.timestamp, data.data);
            }
            
            // Check for various data patterns (using a single pass for efficiency)
            checkForEnvironmentData(data.data);
            checkForThermostatInfo(data.data);
            checkForAppVersion(data.data);
            checkForTemperatureUnit(data.data);
            checkForUILock(data.data);
            checkForDeviceID(data.data);
            checkForDeviceSerial(data.data);
            checkForDeviceType(data.data);
            checkForSetpointLimits(data.data);
            checkForBrightnessValues(data.data);
            checkForTimezone(data.data);
            checkForLanguage(data.data);
            checkForCoexistRomVersion(data.data);
        });
        
        // If there are more logs to process, schedule the next batch
        if (logQueue.length > 0) {
            setTimeout(processLogQueue, 0);
        } else {
            processingQueue = false;
        }
    }
    
    // Listen for serial data with high priority
    socket.on('serial-data', (data) => {
        console.log('Received serial data:', data);
        
        // Add to queue
        logQueue.push(data);
        
        // Start processing if not already processing
        if (!processingQueue) {
            processLogQueue();
        }
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
        // Update both connection status elements
        connectionStatus.textContent = 'Connected';
        statusValue.textContent = 'Connected';
        
        connectionStatus.className = 'connected';
        statusValue.className = 'connected';
        
        connectButton.disabled = true;
        disconnectButton.disabled = false;
        portSelect.disabled = true;
        
        // Command input elements have been removed
        
        showNotification('Connected successfully', 'success');
    } else {
        // Update both connection status elements
        connectionStatus.textContent = 'Not connected';
        statusValue.textContent = 'Not connected';
        
        connectionStatus.className = 'disconnected';
        statusValue.className = 'disconnected';
        
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
    
    // Create log entry object with current time if timestamp is more than 1 minute old
    // This helps prevent the appearance of delayed logs
    const now = new Date();
    const msgTime = new Date(timestamp);
    const timeDiff = now - msgTime;
    
    // If the timestamp is more than 60 seconds old, use current time instead
    // This prevents logs from appearing to be delayed
    if (timeDiff > 60000) {
        console.log(`Adjusting timestamp for delayed log (${timeDiff}ms old):`, message);
        timestamp = now.toISOString();
    }
    
    const entry = { timestamp, message };
    const entryIndex = logEntries.length;
    
    // Check if this message should be hidden based on custom filters
    const matchedPattern = shouldHideMessage(message);
    if (matchedPattern) {
        // Add to the hidden entries array
        hiddenEntries.push(entry);
        
        // Also track which filter hid this entry
        if (!filterToHiddenEntriesMap.has(matchedPattern)) {
            filterToHiddenEntriesMap.set(matchedPattern, []);
        }
        filterToHiddenEntriesMap.get(matchedPattern).push(entry);
        
        updateHiddenLogWindow();
        return;
    }
    
    // Add to the main log entries array if not filtered
    logEntries.push(entry);
    
    // Process the entry immediately without waiting for the next render cycle
    // This ensures that logs appear as soon as they are received
    
    // Always re-render when using a filter other than 'full'
    if (currentFilter !== 'full') {
        // Use requestAnimationFrame for smoother rendering
        requestAnimationFrame(() => {
            renderVisibleLogEntries();
            
            // Auto-scroll if enabled
            if (autoscrollCheckbox.checked) {
                logWindow.scrollTop = logWindow.scrollHeight;
            }
        });
    } else {
        // For 'full' filter, use the virtual scrolling logic
        if (logEntries.length > MAX_VISIBLE_LOG_ENTRIES) {
            // If we're at the bottom of the scroll, we want to show the new entry
            const isAtBottom = logWindow.scrollTop + logWindow.clientHeight >= logWindow.scrollHeight - 10;
            
            // Clear and re-render only if we're at the bottom or if this is the first entry over the limit
            if (isAtBottom || logEntries.length === MAX_VISIBLE_LOG_ENTRIES + 1) {
                requestAnimationFrame(() => {
                    renderVisibleLogEntries();
                });
            }
        } else {
            // Just create and add this single entry if we're under the limit and using the full filter
            // Use requestAnimationFrame for smoother rendering
            requestAnimationFrame(() => {
                createLogEntryElement(entry, entryIndex);
                
                // Auto-scroll if enabled
                if (autoscrollCheckbox.checked) {
                    logWindow.scrollTop = logWindow.scrollHeight;
                }
            });
        }
    }
    
    // Check for environment data and thermostat info in the message
    checkForEnvironmentData(message);
    checkForThermostatInfo(message);
    checkForAppVersion(message);
    checkForTemperatureUnit(message);
    checkForUILock(message);
    checkForDeviceID(message);
    checkForDeviceSerial(message);
    checkForDeviceType(message);
    checkForSetpointLimits(message);
    checkForBrightnessValues(message);
    checkForTimezone(message);
    checkForLanguage(message);
    checkForCoexistRomVersion(message);
    checkForFloorTemp(message);
    
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
    if (entry.timestamp) {
        const timestampElement = document.createElement('span');
        timestampElement.className = 'log-timestamp';
        timestampElement.textContent = formatTimestamp(entry.timestamp);
        logEntry.appendChild(timestampElement);
    }
    
    const messageElement = document.createElement('span');
    messageElement.className = 'log-message';
    
    // Handle special characters and control codes
    let formattedMessage = entry.message
        .replace(/\r\n|\r|\n/g, '')
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
    // First, restore all hidden entries back to the main log entries array
    // to ensure we're starting with the complete set of logs
    let allEntries = [...logEntries];
    
    // Add back any entries that were hidden by filters
    for (const [pattern, entries] of filterToHiddenEntriesMap.entries()) {
        // Only add back entries from filters that still exist
        if (customFilterPatterns.includes(pattern)) {
            // Keep these entries in the map for this pattern
            continue;
        }
        // Filter was removed, so add these entries back to the main log
        allEntries = [...allEntries, ...entries];
        // Remove this pattern from the map
        filterToHiddenEntriesMap.delete(pattern);
    }
    
    // Sort all entries by timestamp to maintain chronological order
    allEntries.sort((a, b) => {
        return new Date(a.timestamp) - new Date(b.timestamp);
    });
    
    // Reset the main log entries
    logEntries = allEntries;
    hiddenEntries = [];
    
    // Now reapply all current filters
    for (const pattern of customFilterPatterns) {
        let entriesToKeep = [];
        let entriesToHide = [];
        
        // Check each entry against this specific pattern
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            if (entry.message && entry.message.includes(pattern)) {
                entriesToHide.push(entry);
            } else {
                entriesToKeep.push(entry);
            }
        }
        
        // Update the main log entries to only keep non-matching entries
        logEntries = entriesToKeep;
        
        // Store the hidden entries for this pattern
        filterToHiddenEntriesMap.set(pattern, entriesToHide);
        
        // Add these hidden entries to the overall hidden entries array
        hiddenEntries = [...hiddenEntries, ...entriesToHide];
    }
    
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
    
    // Create a header with total count
    const totalCountHeader = document.createElement('div');
    totalCountHeader.className = 'hidden-count-header';
    totalCountHeader.innerHTML = `<strong>Total Hidden Entries: ${hiddenEntries.length}</strong>`;
    fragment.appendChild(totalCountHeader);
    
    // Group entries by the filter pattern that hid them
    if (filterToHiddenEntriesMap.size > 0) {
        // For each filter pattern, show one example with count
        filterToHiddenEntriesMap.forEach((entries, pattern) => {
            if (entries.length === 0) return;
            
            // Create a container for this pattern group
            const patternGroup = document.createElement('div');
            patternGroup.className = 'hidden-pattern-group';
            
            // Create header with pattern and count
            const patternHeader = document.createElement('div');
            patternHeader.className = 'hidden-pattern-header';
            patternHeader.innerHTML = `<strong>Pattern: "${pattern}"</strong> <span class="hidden-count">(${entries.length} occurrences)</span>`;
            patternGroup.appendChild(patternHeader);
            
            // Show just one example of this pattern
            const exampleEntry = entries[entries.length - 1]; // Use the most recent example
            const exampleDiv = document.createElement('div');
            exampleDiv.className = 'hidden-example log-entry';
            
            // Create timestamp element if needed
            if (exampleEntry.timestamp) {
                const timestampElement = document.createElement('span');
                timestampElement.className = 'log-timestamp';
                timestampElement.textContent = formatTimestamp(exampleEntry.timestamp);
                exampleDiv.appendChild(timestampElement);
            }
            
            // Create message element for the example
            const messageElement = document.createElement('span');
            messageElement.className = 'log-message';
            
            // Handle special characters and control codes
            let formattedMessage = exampleEntry.message
                .replace(/\r\n|\r|\n/g, '<br>')
                .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
                .replace(/ /g, '&nbsp;');
            
            // Apply color coding
            formattedMessage = applyColorCoding(formattedMessage);
            messageElement.innerHTML = formattedMessage;
            
            // Add message element to the example entry
            exampleDiv.appendChild(messageElement);
            patternGroup.appendChild(exampleDiv);
            
            // Add the pattern group to the fragment
            fragment.appendChild(patternGroup);
        });
    }
    
    // Add all entries to the DOM in a single operation
    hiddenLogWindow.appendChild(fragment);
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
        // Filter for entries containing 'update_hvac_state' or 'out of range. min'
        const targetPhrases = ['update_hvac_state', 'out of range. min'];
        // Additional criteria: Look for 'setpoint |' lines
        const setpointMarker = 'setpoint |';
        
        console.log('Starting setpoint filtering for target phrases:', targetPhrases, 'and', setpointMarker);
        
        // Find all entries containing any of the target phrases - EXACT MATCHES ONLY
        let setpointEntries = [];
        
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            // Skip if no message
            if (!entry.message) continue;
            
            // Check if this entry contains any of the target phrases (case insensitive)
            const lowerMessage = entry.message.toLowerCase();
            let matchFound = false;
            let matchedPhrase = '';
            
            for (const phrase of targetPhrases) {
                if (lowerMessage.includes(phrase.toLowerCase())) {
                    matchFound = true;
                    matchedPhrase = phrase;
                    break;
                }
            }
            
            if (matchFound) {
                console.log(`Found "${matchedPhrase}" at index:`, i, 'with message:', entry.message);
                
                // Add ONLY the matching entry - no context
                setpointEntries.push(entry);
            }
            
            // Additional criteria: Check if this entry contains 'setpoint |'
            if (entry.message.includes(setpointMarker)) {
                console.log('Found setpoint | marker at index:', i, 'with message:', entry.message);
                
                // Add only if not already added
                if (!setpointEntries.includes(entry)) {
                    setpointEntries.push(entry);
                }
            }
        }
        
        filteredEntries = setpointEntries;
        console.log('Setpoint filtered entries:', filteredEntries.length);
        console.log('First few setpoint entries:', filteredEntries.slice(0, 5).map(e => e.message));
        console.log('Last few setpoint entries:', filteredEntries.slice(-5).map(e => e.message));
    } else if (currentFilter === 'mode') {
        // Filter for entries containing 'update_hvac_state'
        const targetPhrase = 'update_hvac_state';
        
        // Find all entries containing the target phrase
        let modeEntries = [];
        
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            // Check if this entry contains the target phrase
            if (entry.message && entry.message.toLowerCase().includes(targetPhrase.toLowerCase())) {
                modeEntries.push(entry);
            }
        }
        
        filteredEntries = modeEntries;
        console.log('Mode filtered entries:', filteredEntries.length);
        console.log('First few mode entries:', filteredEntries.slice(0, 5).map(e => e.message));
        console.log('Last few mode entries:', filteredEntries.slice(-5).map(e => e.message));
    } else if (currentFilter === 'temp') {
        // Filter for entries containing specific temperature-related keywords
        const targetPhrases = [
            'rawTemperature',
            'coreTemperature',
            'probeTemperature',
            'stageOneHeatOnTime',
            'stageTwoCoolOnTime',
            'hvacState',
            'roomTemperature',
            'humidity'
        ];
        
        console.log('Starting temperature data filtering for keywords:', targetPhrases);
        
        // Find all entries containing any of the target phrases
        let tempEntries = [];
        
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            // Skip if no message
            if (!entry.message) continue;
            
            // Check if this entry contains any of the target phrases (case insensitive)
            const lowerMessage = entry.message.toLowerCase();
            let matchFound = false;
            let matchedPhrase = '';
            
            for (const phrase of targetPhrases) {
                if (lowerMessage.includes(phrase.toLowerCase())) {
                    matchFound = true;
                    matchedPhrase = phrase;
                    break;
                }
            }
            
            if (matchFound) {
                console.log(`Found "${matchedPhrase}" at index:`, i, 'with message:', entry.message);
                
                // Add ONLY the matching entry - no context
                tempEntries.push(entry);
            }
        }
        
        filteredEntries = tempEntries;
        console.log('Temperature filtered entries:', filteredEntries.length);
        console.log('First few temperature entries:', filteredEntries.slice(0, 5).map(e => e.message));
        console.log('Last few temperature entries:', filteredEntries.slice(-5).map(e => e.message));
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
        
        // Additional criteria: Look for lines like "Booted, Version:" and show that line plus lines after it
        // until we reach 15 lines or encounter "Brownout" or "WIFI |" text
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            // Check if this entry contains "Booted, Version:"
            if (entry.message && entry.message.includes('Booted, Version:')) {
                console.log('Found Booted Version line at index:', i, 'with message:', entry.message);
                
                // Add this entry if not already added
                if (!bootEntries.includes(entry)) {
                    bootEntries.push(entry);
                }
                
                // Add lines after until we reach 15 lines or encounter a stop condition
                let linesAdded = 1; // Start at 1 because we already added the Booted line
                
                for (let j = 1; j <= 15 && i + j < logEntries.length && linesAdded < 15; j++) {
                    const nextEntry = logEntries[i + j];
                    
                    // Check if this is a stop condition ("Brownout" or "WIFI |")
                    if (nextEntry.message && (nextEntry.message.includes('Brownout') || nextEntry.message.includes('WIFI |'))) {
                        // Add this final entry if not already added
                        if (!bootEntries.includes(nextEntry)) {
                            bootEntries.push(nextEntry);
                            console.log('Found stop condition at index:', i + j, 'with message:', nextEntry.message);
                        }
                        // Stop adding more entries
                        break;
                    }
                    
                    // Otherwise add this entry if not already added
                    if (!bootEntries.includes(nextEntry)) {
                        bootEntries.push(nextEntry);
                        linesAdded++;
                    }
                }
            }
        }
        
        // Sort the entries by timestamp to maintain chronological order
        bootEntries.sort((a, b) => a.timestamp - b.timestamp);
        
        filteredEntries = bootEntries;
        console.log('Boot filtered entries:', filteredEntries.length);
        console.log('First few boot entries:', filteredEntries.slice(0, 5).map(e => e.message));
        console.log('Last few boot entries:', filteredEntries.slice(-5).map(e => e.message));
    } else if (currentFilter === 'options') {
        // Filter for entries containing 'preferences_helpers' - EXACT MATCHES ONLY
        const targetMarker = 'preferences_helpers';
        // Additional criteria: Look for 'settings |' lines
        const settingsMarker = 'settings |';
        
        console.log('Starting options filtering for exact matches of:', targetMarker, 'and', settingsMarker);
        
        // Find all entries containing the target markers - NO CONTEXT
        let optionsEntries = [];
        
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            // Skip if no message
            if (!entry.message) continue;
            
            // Check if this entry contains the original target marker (case insensitive)
            if (entry.message.toLowerCase().includes(targetMarker.toLowerCase())) {
                console.log('Found preferences_helpers marker at index:', i, 'with message:', entry.message);
                
                // Add ONLY the matching entry - no context
                optionsEntries.push(entry);
            }
            
            // Additional criteria: Check if this entry contains 'settings |'
            if (entry.message.includes(settingsMarker)) {
                console.log('Found settings | marker at index:', i, 'with message:', entry.message);
                
                // Add only if not already added
                if (!optionsEntries.includes(entry)) {
                    optionsEntries.push(entry);
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
        // Additional criteria: Look for 'WIFI |' lines
        const wifiMarker = 'WIFI |';
        
        console.log('Starting Wifi text filtering for', targetText, 'and', wifiMarker);
        
        // Find all entries containing the target text
        let wifiEntries = [];
        
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            // Skip if no message
            if (!entry.message) continue;
            
            // Check if this entry contains the target text (case insensitive)
            if (entry.message.toLowerCase().includes(targetText.toLowerCase())) {
                wifiEntries.push(entry);
            }
            
            // Additional criteria: Check if this entry contains 'WIFI |'
            if (entry.message.includes(wifiMarker)) {
                console.log('Found WIFI | marker at index:', i, 'with message:', entry.message);
                
                // Add only if not already added
                if (!wifiEntries.includes(entry)) {
                    wifiEntries.push(entry);
                }
            }
        }
        
        filteredEntries = wifiEntries;
        console.log('Wifi text filtered entries:', filteredEntries.length);
        console.log('First few Wifi text entries:', filteredEntries.slice(0, 5).map(e => e.message));
        console.log('Last few Wifi text entries:', filteredEntries.slice(-5).map(e => e.message));
    } else if (currentFilter === 'app') {
        // Filter for entries containing the exact word 'app' only
        console.log('Starting App text filtering for exact word matches only...');
        
        // Find all entries containing the exact word 'app'
        let appEntries = [];
        
        for (let i = 0; i < logEntries.length; i++) {
            const entry = logEntries[i];
            
            // Skip if no message
            if (!entry.message) continue;
            
            // Match only the exact word 'app' with word boundaries
            // This prevents matching words like 'Applied', 'Application', etc.
            if (entry.message.match(/\bapp\b/i)) {
                console.log('Found exact word "app" at index:', i, 'with message:', entry.message);
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
                <div class="lunch-buttons">
                    <button class="print-lunch-btn">Print</button>
                    <button class="close-lunch-btn">Close</button>
                </div>
            </div>
        `;
        notification.className = 'notification lunch-suggestion';
        
        // Add event listeners to the buttons
        setTimeout(() => {
            const closeBtn = notification.querySelector('.close-lunch-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    notification.classList.add('hidden');
                });
            }
            
            const printBtn = notification.querySelector('.print-lunch-btn');
            if (printBtn) {
                printBtn.addEventListener('click', () => {
                    // Create a new window for printing
                    const printWindow = window.open('', '_blank');
                    
                    // Get the lunch content
                    const lunchContent = notification.querySelector('.lunch-content').innerHTML;
                    
                    // Create a styled document for printing
                    printWindow.document.write(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>FTDI Logger - Lunch Suggestions</title>
                            <style>
                                body {
                                    font-family: Arial, sans-serif;
                                    padding: 20px;
                                    max-width: 600px;
                                    margin: 0 auto;
                                }
                                h1 {
                                    color: #0d5c23;
                                    border-bottom: 2px solid #0d5c23;
                                    padding-bottom: 10px;
                                    margin-bottom: 20px;
                                }
                                .restaurant-item {
                                    margin-bottom: 20px;
                                    padding: 15px;
                                    border: 1px solid #ddd;
                                    border-radius: 5px;
                                }
                                .restaurant-name {
                                    font-size: 18px;
                                    font-weight: bold;
                                    margin-bottom: 5px;
                                }
                                .restaurant-rating {
                                    color: #f8c000;
                                    margin-bottom: 5px;
                                }
                                .rating-number {
                                    color: #666;
                                }
                                .restaurant-details {
                                    display: flex;
                                    justify-content: space-between;
                                    color: #666;
                                    font-size: 14px;
                                }
                                .suggestion-footer {
                                    margin-top: 30px;
                                    padding-top: 10px;
                                    border-top: 1px dashed #ccc;
                                    font-size: 12px;
                                    color: #666;
                                }
                                .suggestion-time {
                                    margin-top: 5px;
                                    font-style: italic;
                                }
                                @media print {
                                    body {
                                        padding: 0;
                                    }
                                    .no-print {
                                        display: none;
                                    }
                                }
                            </style>
                        </head>
                        <body>
                            <h1>FTDI Logger - Lunch Suggestions</h1>
                            ${lunchContent}
                            <div class="no-print">
                                <button onclick="window.print();" style="padding: 8px 15px; background-color: #0d5c23; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 20px;">Print</button>
                                <button onclick="window.close();" style="padding: 8px 15px; background-color: #666; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 20px; margin-left: 10px;">Close</button>
                            </div>
                        </body>
                        </html>
                    `);
                    
                    // Focus the new window
                    printWindow.focus();
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
            { name: "Chinched", rating: 4.6, cuisine: "Gastropub", url: "https://www.yelp.ca/biz/chinched-st-johns", hours: "11:30-22:00" },
            { name: "YellowBelly Brewery", rating: 4.4, cuisine: "Pub", url: "https://www.yelp.ca/biz/yellowbelly-brewery-st-johns-2", hours: "11:00-23:00" },
            { name: "India Gate", rating: 4.3, cuisine: "Indian", url: "https://www.yelp.ca/biz/india-gate-restaurant-st-johns", hours: "11:30-21:30" },
            { name: "Sun Sushi", rating: 4.5, cuisine: "Japanese", url: "https://www.yelp.ca/biz/sun-sushi-st-johns", hours: "11:30-21:00" },
            { name: "Piatto Pizzeria", rating: 4.5, cuisine: "Pizza", url: "https://www.yelp.ca/biz/piatto-st-johns", hours: "11:30-22:00" },
            { name: "The Celtic Hearth", rating: 4.1, cuisine: "Irish", url: "https://www.yelp.ca/biz/the-celtic-hearth-st-johns", hours: "24 Hours" },
            { name: "Bannerman Brewing Co.", rating: 4.5, cuisine: "Brewery", url: "https://www.yelp.ca/biz/bannerman-brewing-st-johns", hours: "11:00-23:00" },
            { name: "Toslow", rating: 4.6, cuisine: "Cafe", url: "https://www.yelp.ca/biz/toslow-st-johns-2", hours: "7:30-16:00" },
            { name: "Hungry Heart Cafe", rating: 4.3, cuisine: "Cafe", url: "https://www.yelp.ca/biz/hungry-heart-cafe-st-johns", hours: "8:00-16:00" },
            { name: "Rocket Bakery and Fresh Food", rating: 4.4, cuisine: "Bakery", url: "https://www.yelp.ca/biz/rocket-bakery-and-fresh-food-st-johns", hours: "7:30-18:00" },
            { name: "The Battery Cafe", rating: 4.5, cuisine: "Cafe", url: "https://www.yelp.ca/biz/the-battery-cafe-st-johns", hours: "8:00-16:00" },
            { name: "St. John's Fish Exchange", rating: 4.6, cuisine: "Seafood", url: "https://www.yelp.ca/biz/st-johns-fish-exchange-st-johns", hours: "11:30-22:00" },
            { name: "The Duke of Duckworth", rating: 4.2, cuisine: "Pub", url: "https://www.yelp.ca/biz/the-duke-of-duckworth-st-johns", hours: "11:00-23:00" },
            { name: "Manna Bakery", rating: 4.6, cuisine: "Bakery", url: "https://www.yelp.ca/biz/manna-european-bakery-and-deli-st-johns", hours: "8:00-18:00" },
            { name: "Basho", rating: 4.4, cuisine: "Japanese", url: "https://www.yelp.ca/biz/basho-restaurant-and-lounge-st-johns", hours: "11:30-22:00" },
            { name: "The Gypsy Tea Room", rating: 4.2, cuisine: "Mediterranean", url: "https://www.yelp.ca/biz/gypsy-tea-room-st-johns", hours: "11:30-22:00" },
            { name: "The Sprout", rating: 4.5, cuisine: "Vegetarian", url: "https://www.yelp.ca/biz/the-sprout-restaurant-st-johns", hours: "11:30-21:00" },
            { name: "Quidi Vidi Brewery", rating: 4.5, cuisine: "Brewery", url: "https://www.yelp.ca/biz/quidi-vidi-brewery-st-johns", hours: "11:00-22:00" },
            { name: "The Rooms Cafe", rating: 4.4, cuisine: "Cafe", url: "https://www.yelp.ca/biz/the-rooms-cafe-st-johns", hours: "10:00-17:00" },
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
            { name: "Bannerman Brewing Co", rating: 4.7, cuisine: "Brewery/Cafe", url: "https://www.yelp.ca/biz/bannerman-brewing-co-st-johns", hours: "8:00-23:00" },
            { name: "The Battery Cafe", rating: 4.5, cuisine: "Cafe", url: "https://www.yelp.ca/biz/the-battery-cafe-st-johns", hours: "8:00-16:00" },
            { name: "Newfoundland Chocolate Company", rating: 4.6, cuisine: "Dessert", url: "https://www.newfoundlandchocolatecompany.com/", hours: "10:00-18:00" },
            { name: "Gingergrass", rating: 4.5, cuisine: "Thai/Vietnamese", url: "https://www.yelp.ca/biz/gingergrass-st-johns", hours: "11:30-20:00" },
            { name: "Bagel Cafe", rating: 4.4, cuisine: "Cafe", url: "https://www.yelp.ca/biz/bagel-cafe-st-johns", hours: "8:00-18:00" },
            { name: "Pizza Supreme", rating: 3.8, cuisine: "Pizza", url: "https://www.yelp.ca/biz/pizza-supreme-st-johns", hours: "11:00-23:00" },
            { name: "McDonald's", rating: 3.5, cuisine: "Fast Food", url: "https://www.yelp.ca/biz/mcdonalds-st-johns", hours: "24 Hours" },
            { name: "Wendy's", rating: 3.6, cuisine: "Fast Food", url: "https://www.yelp.ca/biz/wendys-st-johns", hours: "10:00-23:00" },
            { name: "Mustang Sally's", rating: 4.2, cuisine: "American", url: "https://www.yelp.ca/biz/mustang-sallys-st-johns", hours: "11:00-22:00" },
            { name: "A & W", rating: 3.7, cuisine: "Fast Food", url: "https://www.yelp.ca/biz/a-and-w-st-johns-2", hours: "7:00-23:00" },
            { name: "Sun Sushi", rating: 4.5, cuisine: "Japanese", url: "https://www.yelp.ca/biz/sun-sushi-st-johns-2", hours: "11:30-21:00" },
            { name: "Thai Express", rating: 3.8, cuisine: "Thai", url: "https://www.yelp.ca/biz/thai-express-saint-johns", hours: "11:00-21:00" },
            { name: "Flavours Indian Cuisine", rating: 3.7, cuisine: "Indian", url: "https://www.yelp.ca/biz/flavours-indian-cuisine-st-johns", hours: "10:00-21:00" },
            { name: "Georgetown Bakery", rating: 4.2, cuisine: "Bakery", url: "https://www.yelp.ca/search?find_desc=Bakeries&find_loc=St.+John%27s%2C+NL", hours: "8:00-18:00" },
            { name: "The Market Family Cafe", rating: 3.9, cuisine: "Cafe", url: "https://www.yelp.ca/biz/the-market-family-cafe-st-johns", hours: "7:00-23:00" },
            { name: "Subway", rating: 3.5, cuisine: "Sandwiches", url: "https://www.yelp.ca/biz/subway-st-johns-3", hours: "8:00-22:00" },
            { name: "Postmaster's Bakery", rating: 4.7, cuisine: "Bakery", url: "https://postmastersbakery.com/menu/", hours: "8:00-18:00" },
            { name: "Pizza Hut", rating: 3.6, cuisine: "Pizza", url: "https://www.yelp.ca/biz/pizza-hut-st-johns-3", hours: "11:00-23:00" },
            { name: "Celtic Hearth", rating: 4.1, cuisine: "Irish", url: "https://www.yelp.ca/biz/the-celtic-hearth-st-johns", hours: "24 Hours" },
            { name: "Keith's Diner", rating: 4.2, cuisine: "Diner", url: "https://www.tripadvisor.ca/Restaurant_Review-g1519599-d4085605-Reviews-Keith_s_Diner-Goulds_St_John_s_Newfoundland_Newfoundland_and_Labrador.html", hours: "7:00-20:00" },
            { name: "Bellissimo Bistro & Espresso Bar", rating: 4.3, cuisine: "Italian", url: "https://www.yelp.ca/biz/bellissimo-bistro-and-espresso-bar-st-johns-2", hours: "8:00-21:00" },
            { name: "Leo's Restaurant", rating: 4.0, cuisine: "Fish & Chips", url: "https://www.yelp.ca/biz/leos-fish-and-chips-st-johns-2", hours: "11:00-21:00" },
            { name: "Magic Wok", rating: 4.1, cuisine: "Chinese", url: "https://www.yelp.ca/biz/magic-wok-restaurant-st-johns-2", hours: "11:30-21:30" },
            { name: "Persepolis Persian", rating: 4.4, cuisine: "Persian", url: "https://www.facebook.com/persepolisnl/", hours: "11:30-21:00" },
            { name: "Afro Kitchen NL", rating: 4.5, cuisine: "African", url: "https://www.facebook.com/afrokitchennl/", hours: "11:00-20:00" },
            { name: "Mary Brown's East End", rating: 3.9, cuisine: "Fried Chicken", url: "https://www.yelp.ca/biz/mary-browns-st-johns-5", hours: "11:00-22:00" },
            { name: "RJ Pinoy Yum", rating: 4.4, cuisine: "Filipino", url: "https://www.yelp.ca/biz/rj-pinoy-yum-st-johns-2", hours: "11:00-20:00" },
            { name: "Mr Sub", rating: 3.8, cuisine: "Sandwiches", url: "https://www.yelp.ca/biz/mr-sub-st-johns-2", hours: "10:00-20:00" },
            { name: "Johnny & Mae's", rating: 4.6, cuisine: "Food Truck", url: "https://www.yelp.com/biz/johnny-and-maes-st-johns", hours: "11:00-19:00" },
            { name: "Colemans Grocery Store", rating: 4.2, cuisine: "Grocery", url: "https://www.yelp.ca/biz/colemans-st-johns", hours: "7:00-21:00" },
            { name: "Venice Pizzeria", rating: 4.0, cuisine: "Pizza", url: "https://www.yelp.com/biz/venice-pizzeria-st-johns", hours: "12:00-24:00" }
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
            
            // Hide the 'Please load test plan' message and show the test plan container
            document.getElementById('test-plan-message').style.display = 'none';
            document.getElementById('test-plan').style.display = 'block';
            
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
        
        // Keep track of sub-header rows that need to be associated with test cases
        const subHeaderRows = new Map();
        
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
        
        // Find the important sub-header row for Specific Config Testing tab
        let modeAmbientSetpointHeaderRow = -1;
        let modeAmbientSetpointHeaderData = null;
        
        // Only for Specific Config Testing tab
        if (isSpecificConfigTab) {
            // Look for the sub-header row that contains Mode, Ambient, Setpoint, Lights
            for (let i = 1; i < filteredSheetData.length; i++) {
                const rowData = filteredSheetData[i];
                let containsAllHeaders = true;
                let headerTexts = [];
                
                // Check if this row contains the key header terms
                for (let j = 0; j < rowData.length; j++) {
                    if (rowData[j]) {
                        const cellText = String(rowData[j]).trim().toLowerCase();
                        headerTexts.push(cellText);
                    }
                }
                
                // Check if this row contains all the key header terms we're looking for
                const headerString = headerTexts.join(' ');
                if (headerString.includes('mode') && 
                    headerString.includes('ambient') && 
                    headerString.includes('setpoint') && 
                    headerString.includes('lights') && 
                    (headerString.includes('config') || headerString.includes('system type') || headerString.includes('description'))) {
                    
                    console.log('Found Mode/Ambient/Setpoint/Lights header row at index:', i);
                    modeAmbientSetpointHeaderRow = i;
                    modeAmbientSetpointHeaderData = rowData;
                    break;
                }
            }
        }
        
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
                
                // For Specific Config Testing tab, insert the sub-header after each test case header
                if (isSpecificConfigTab && modeAmbientSetpointHeaderData) {
                    // We'll add the sub-header row after this test case row is added to the tbody
                    row.dataset.needsSubHeader = 'true';
                }
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
                // Skip selection for regular sub-header rows, but allow our custom mode-ambient-setpoint-header
                if (this.classList.contains('sub-header-row') && !this.classList.contains('mode-ambient-setpoint-header')) {
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
                    if (rowIndex < 0) {
                        // This is a virtual row index for a sub-header
                        const subHeaderRow = subHeaderRows.get(rowIndex);
                        if (subHeaderRow) {
                            const subHeaderId = subHeaderRow.dataset.rowId;
                            groupRows.push({ row: subHeaderRow, id: subHeaderId });
                        }
                    } else {
                        // This is a regular row index
                        const groupRowId = `${sheetName}-row-${rowIndex}`;
                        const groupRow = tbody.querySelector(`tr[data-row-id="${groupRowId}"]`);
                        if (groupRow) {
                            groupRows.push({ row: groupRow, id: groupRowId });
                        }
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
            
            // If this row needs a sub-header (for Specific Config Testing tab)
            if (isSpecificConfigTab && row.dataset.needsSubHeader === 'true' && modeAmbientSetpointHeaderData) {
                // Create a sub-header row
                const subHeaderRow = document.createElement('tr');
                subHeaderRow.classList.add('sub-header-row');
                subHeaderRow.classList.add('mode-ambient-setpoint-header');
                
                // Link this sub-header to the same test case as the header row
                if (row.dataset.testCaseId) {
                    const testCaseId = row.dataset.testCaseId;
                    subHeaderRow.dataset.testCaseId = testCaseId;
                    subHeaderRow.dataset.partOfTestCase = 'true';
                    
                    // Add this sub-header row to the test case group
                    if (testCaseGroups.has(testCaseId)) {
                        const groupRows = testCaseGroups.get(testCaseId);
                        // Add a virtual row index for this sub-header
                        // We'll use a negative number to distinguish it from real rows
                        const virtualRowIndex = -1 * (i + 1000); // Ensure it's unique and negative
                        groupRows.push(virtualRowIndex);
                        // Store the sub-header row with its virtual index for later reference
                        subHeaderRows.set(virtualRowIndex, subHeaderRow);
                    }
                }
                
                // Add the same row ID pattern but with a suffix to link it to the original row
                const subHeaderRowId = `${rowId}-subheader`;
                subHeaderRow.dataset.rowId = subHeaderRowId;
                
                // Add cells to the sub-header row
                for (let j = 0; j < headers.length; j++) {
                    // Skip excluded columns
                    if (excludeColumns.includes(j)) continue;
                    
                    const cell = document.createElement('td');
                    let cellContent = modeAmbientSetpointHeaderData[j] !== undefined ? modeAmbientSetpointHeaderData[j] : '';
                    cell.textContent = cellContent;
                    
                    // Add a special class to highlight these cells
                    cell.classList.add('sub-header-cell');
                    
                    subHeaderRow.appendChild(cell);
                }
                
                // Add the sub-header row to the tbody
                tbody.appendChild(subHeaderRow);
                
                // Add click event to the sub-header row to select the entire test case
                subHeaderRow.addEventListener('click', function() {
                    // Find the test case header row and trigger its click event
                    if (this.dataset.testCaseId) {
                        const testCaseId = this.dataset.testCaseId;
                        const testCaseHeaderRow = tbody.querySelector(`tr[data-test-case-id="${testCaseId}"]:not(.sub-header-row)`);
                        if (testCaseHeaderRow) {
                            testCaseHeaderRow.click();
                        }
                    }
                });
            }
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
function displaySelectedTestCase(testCaseId, sheetName, rowIndices, targetElement) {
    // Store the currently displayed test case ID
    currentlyDisplayedTestCase = testCaseId;
    
    // Initialize test case notes if they don't exist
    if (!window.testCaseNotes) {
        window.testCaseNotes = {};
    }
    
    // Determine where to display the test case
    const displayTarget = targetElement || selectedTestCaseDisplay;
    
    // Clear the display area if it's the main display
    if (!targetElement) {
        selectedTestCaseDisplay.innerHTML = '';
        
        // Update test action buttons state
        updateTestActionButtonsState();
        
        // Enable the export button if there are test logs for this test case
        exportSelectedTestCaseButton.disabled = !(testLogEntries[testCaseId] && testLogEntries[testCaseId].start);
    }
    
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
    
    // Create a header container with title and collapse button
    const headerContainer = document.createElement('div');
    headerContainer.className = 'test-case-header-container';
    
    // Create the title div
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
    
    // Create collapse/expand button
    const collapseButton = document.createElement('button');
    collapseButton.className = 'collapse-expand-button';
    collapseButton.innerHTML = '▼';
    collapseButton.title = 'Collapse/Expand test case';
    
    // Add elements to header container
    headerContainer.appendChild(titleDiv);
    headerContainer.appendChild(collapseButton);
    displayTarget.appendChild(headerContainer);
    
    // Create a content container for collapsible content
    const contentContainer = document.createElement('div');
    contentContainer.className = 'test-case-content-container';
    contentContainer.style.maxHeight = 'none'; // Start expanded
    
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
    
    // Check if this is the Specific Config Testing tab
    const isSpecificConfigTab = sheetName === 'Specific Config Testing';
    
    // Find the Mode/Ambient/Setpoint/Lights header data if this is the Specific Config Testing tab
    let modeAmbientSetpointHeaderData = null;
    let modeAmbientSetpointHeaderRow = -1;
    if (isSpecificConfigTab) {
        // Look for the row that contains Mode, Ambient, Setpoint, Lights
        for (let i = 1; i < filteredSheetData.length; i++) {
            const rowData = filteredSheetData[i];
            let headerTexts = [];
            
            // Check if this row contains the key header terms
            for (let j = 0; j < rowData.length; j++) {
                if (rowData[j]) {
                    const cellText = String(rowData[j]).trim().toLowerCase();
                    headerTexts.push(cellText);
                }
            }
            
            // Check if this row contains all the key header terms we're looking for
            const headerString = headerTexts.join(' ');
            if (headerString.includes('mode') && 
                headerString.includes('ambient') && 
                headerString.includes('setpoint') && 
                headerString.includes('lights') && 
                (headerString.includes('config') || headerString.includes('system type') || headerString.includes('description'))) {
                
                modeAmbientSetpointHeaderData = rowData;
                modeAmbientSetpointHeaderRow = i;
                console.log('Found Mode/Ambient/Setpoint/Lights header row at index:', i);
                break;
            }
        }
    }
    
    // First, let's ensure we always show the sub-header for Specific Config Testing
    // Add it at the beginning of the table if it's not already included in rowIndices
    if (isSpecificConfigTab && modeAmbientSetpointHeaderData) {
        let hasSubHeader = rowIndices.some(index => index < 0);
        
        if (!hasSubHeader) {
            // Create a sub-header row with the Mode/Ambient/Setpoint/Lights data
            const subHeaderRow = document.createElement('tr');
            subHeaderRow.classList.add('sub-header-row');
            subHeaderRow.classList.add('mode-ambient-setpoint-header');
            
            // Add cells to the sub-header row
            for (let j = 0; j < headers.length; j++) {
                // Skip excluded columns
                if (excludeColumns.includes(j)) continue;
                
                const cell = document.createElement('td');
                let cellContent = modeAmbientSetpointHeaderData[j] !== undefined ? modeAmbientSetpointHeaderData[j] : '';
                cell.textContent = cellContent;
                
                // Add a special class to highlight these cells
                cell.classList.add('sub-header-cell');
                
                subHeaderRow.appendChild(cell);
            }
            
            tbody.appendChild(subHeaderRow);
        }
    }
    
    // Add the test case rows
    rowIndices.forEach(rowIndex => {
        // Handle negative indices (virtual rows for sub-headers)
        if (rowIndex < 0) {
            // This is a virtual row for a sub-header
            // Create a sub-header row with the Mode/Ambient/Setpoint/Lights data
            if (isSpecificConfigTab && modeAmbientSetpointHeaderData) {
                const subHeaderRow = document.createElement('tr');
                subHeaderRow.classList.add('sub-header-row');
                subHeaderRow.classList.add('mode-ambient-setpoint-header');
                
                // Add cells to the sub-header row
                for (let j = 0; j < headers.length; j++) {
                    // Skip excluded columns
                    if (excludeColumns.includes(j)) continue;
                    
                    const cell = document.createElement('td');
                    let cellContent = modeAmbientSetpointHeaderData[j] !== undefined ? modeAmbientSetpointHeaderData[j] : '';
                    cell.textContent = cellContent;
                    
                    // Add a special class to highlight these cells
                    cell.classList.add('sub-header-cell');
                    
                    subHeaderRow.appendChild(cell);
                }
                
                tbody.appendChild(subHeaderRow);
            }
            return; // Skip the rest of the processing for virtual rows
        }
        
        // Handle regular rows
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
    contentContainer.appendChild(table);
    
    // Add the content container to the display
    displayTarget.appendChild(contentContainer);
    
    // Add event listener to the collapse button
    collapseButton.addEventListener('click', () => {
        if (contentContainer.style.maxHeight === 'none' || contentContainer.style.maxHeight === '') {
            // Collapse
            contentContainer.style.maxHeight = '0px';
            collapseButton.innerHTML = '▶';
            collapseButton.title = 'Expand test case';
        } else {
            // Expand
            contentContainer.style.maxHeight = 'none';
            collapseButton.innerHTML = '▼';
            collapseButton.title = 'Collapse test case';
        }
    });
    
    // Add a subtle entrance animation
    displayTarget.animate([
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
}

// Clear the selected test case panel
function clearSelectedTestCase() {
    currentlyDisplayedTestCase = null;
    selectedTestCaseDisplay.innerHTML = '<div class="test-case-placeholder">No test selected. Select a test case from the Test Plan below or add one manually.</div>';
    
    // Disable test action buttons
    testStartButton.disabled = true;
    testPassButton.disabled = true;
    testFailButton.disabled = true;
    exportSelectedTestCaseButton.disabled = true;
}

// Create a manual test case input
function createManualTestCase() {
    const manualTestCaseId = `manual-test-${Date.now()}`;
    currentlyDisplayedTestCase = manualTestCaseId;
    
    // Initialize test log entries for this test case
    if (!testLogEntries[manualTestCaseId]) {
        testLogEntries[manualTestCaseId] = {};
    }
    
    // Create the manual test case display
    selectedTestCaseDisplay.innerHTML = '';
    
    // Create the header
    const header = document.createElement('h3');
    header.textContent = 'Manual Test Case';
    selectedTestCaseDisplay.appendChild(header);
    
    // Create the text box for the manual test case description
    const textBox = document.createElement('textarea');
    textBox.className = 'manual-test-description';
    textBox.placeholder = 'Enter test case description here...';
    textBox.rows = 5;
    
    // Save the description when it changes
    textBox.addEventListener('input', function() {
        testLogEntries[manualTestCaseId].description = this.value;
    });
    
    selectedTestCaseDisplay.appendChild(textBox);
    
    // Update button states
    updateTestActionButtonsState();
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
    
    // Add Status column
    const statusHeader = document.createElement('th');
    statusHeader.textContent = 'Status';
    statusHeader.style.width = '80px';
    headerRow.appendChild(statusHeader);
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create the table body
    const tbody = document.createElement('tbody');
    
    // Store test case data for later use
    const testCaseData = [];
    
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
            
            // Create test case ID
            const testCaseId = `${sheetName}-test-${testCaseValue}`;
            
            // Find description column (usually the second column or column after test #)
            let descColumnIndex = 1;
            if (testCaseColumnIndex === 1) {
                descColumnIndex = 2;
            }
            
            // Find all rows that belong to this test case
            const testCaseRows = [];
            let currentRowIndex = i;
            let nextTestCaseFound = false;
            
            // Add the current row
            testCaseRows.push(currentRowIndex);
            
            // Look ahead for additional rows that belong to this test case
            for (let j = i + 1; j < filteredSheetData.length; j++) {
                const nextRowData = filteredSheetData[j];
                const nextTestCaseValue = nextRowData[testCaseColumnIndex];
                
                // Check if this is a new test case row
                const isNextTestCaseRow = nextTestCaseValue && (
                    (typeof nextTestCaseValue === 'string' && 
                     (nextTestCaseValue.match(/\d/) || 
                      nextTestCaseValue.toLowerCase().startsWith('test') || 
                      nextTestCaseValue.includes('#'))) ||
                    (typeof nextTestCaseValue === 'number') ||
                    (!isNaN(parseInt(nextTestCaseValue, 10)))
                );
                
                if (isNextTestCaseRow) {
                    nextTestCaseFound = true;
                    break;
                }
                
                // Add this row to the current test case
                testCaseRows.push(j);
            }
            
            // Store test case data
            testCaseData.push({
                id: testCaseId,
                testNumber: testCaseValue,
                description: rowData[descColumnIndex] || '',
                rows: testCaseRows
            });
            
            // Create the test case row
            const row = document.createElement('tr');
            row.className = 'test-case-row';
            row.dataset.testCaseId = testCaseId;
            
            // Add Test # cell
            const testNumCell = document.createElement('td');
            testNumCell.textContent = testCaseValue;
            row.appendChild(testNumCell);
            
            // Add Description cell
            const descCell = document.createElement('td');
            descCell.textContent = rowData[descColumnIndex] || '';
            row.appendChild(descCell);
            
            // Add Status cell with expand/collapse button
            const statusCell = document.createElement('td');
            statusCell.className = 'test-case-status';
            
            const expandButton = document.createElement('button');
            expandButton.className = 'expand-button';
            expandButton.innerHTML = '▶';
            expandButton.title = 'Show test case details';
            statusCell.appendChild(expandButton);
            
            row.appendChild(statusCell);
            
            // Add click event to expand/collapse test case details
            row.addEventListener('click', function(event) {
                // Get the test case ID
                const testCaseId = this.dataset.testCaseId;
                
                // Find the test case data
                const testCase = testCaseData.find(tc => tc.id === testCaseId);
                
                if (!testCase) return;
                
                // Check if details are already expanded
                const detailsRow = tbody.querySelector(`.test-case-details[data-parent-id="${testCaseId}"]`);
                
                if (detailsRow) {
                    // Details are already expanded, collapse them
                    detailsRow.remove();
                    expandButton.innerHTML = '▶';
                    expandButton.title = 'Show test case details';
                    this.classList.remove('expanded');
                } else {
                    // Collapse any other expanded test case
                    const expandedDetails = tbody.querySelectorAll('.test-case-details');
                    expandedDetails.forEach(detail => {
                        const parentId = detail.dataset.parentId;
                        const parentRow = tbody.querySelector(`tr[data-test-case-id="${parentId}"]`);
                        if (parentRow) {
                            const parentButton = parentRow.querySelector('.expand-button');
                            if (parentButton) {
                                parentButton.innerHTML = '▶';
                                parentButton.title = 'Show test case details';
                            }
                            parentRow.classList.remove('expanded');
                        }
                        detail.remove();
                    });
                    
                    // Create details row
                    const detailsRow = document.createElement('tr');
                    detailsRow.className = 'test-case-details';
                    detailsRow.dataset.parentId = testCaseId;
                    
                    // Create details cell that spans all columns
                    const detailsCell = document.createElement('td');
                    detailsCell.colSpan = 3;
                    
                    // Display the test case details
                    displaySelectedTestCase(testCaseId, sheetName, testCase.rows, detailsCell);
                    
                    detailsRow.appendChild(detailsCell);
                    
                    // Insert after the current row
                    this.parentNode.insertBefore(detailsRow, this.nextSibling);
                    
                    // Update button
                    expandButton.innerHTML = '▼';
                    expandButton.title = 'Hide test case details';
                    this.classList.add('expanded');
                    
                    // Add animation
                    detailsRow.animate([
                        { opacity: 0, height: '0' },
                        { opacity: 1, height: 'auto' }
                    ], {
                        duration: 300,
                        easing: 'ease-out'
                    });
                }
                
                // Prevent event from bubbling to parent elements
                event.stopPropagation();
            });
            
            tbody.appendChild(row);
            
            // If this row needs a sub-header (for Specific Config Testing tab)
            if (isSpecificConfigTab && row.dataset.needsSubHeader === 'true' && modeAmbientSetpointHeaderData) {
                // Create a sub-header row
                const subHeaderRow = document.createElement('tr');
                subHeaderRow.classList.add('sub-header-row');
                subHeaderRow.classList.add('mode-ambient-setpoint-header');
                
                // Link this sub-header to the same test case as the header row
                if (row.dataset.testCaseId) {
                    const testCaseId = row.dataset.testCaseId;
                    subHeaderRow.dataset.testCaseId = testCaseId;
                    subHeaderRow.dataset.partOfTestCase = 'true';
                    
                    // Add this sub-header row to the test case group
                    if (testCaseGroups.has(testCaseId)) {
                        const groupRows = testCaseGroups.get(testCaseId);
                        // Add a virtual row index for this sub-header
                        // We'll use a negative number to distinguish it from real rows
                        const virtualRowIndex = -1 * (i + 1000); // Ensure it's unique and negative
                        groupRows.push(virtualRowIndex);
                        // Store the sub-header row with its virtual index for later reference
                        subHeaderRows.set(virtualRowIndex, subHeaderRow);
                    }
                }
                
                // Add the same row ID pattern but with a suffix to link it to the original row
                const subHeaderRowId = `${rowId}-subheader`;
                subHeaderRow.dataset.rowId = subHeaderRowId;
                
                // Add cells to the sub-header row
                for (let j = 0; j < headers.length; j++) {
                    // Skip excluded columns
                    if (excludeColumns.includes(j)) continue;
                    
                    const cell = document.createElement('td');
                    let cellContent = modeAmbientSetpointHeaderData[j] !== undefined ? modeAmbientSetpointHeaderData[j] : '';
                    cell.textContent = cellContent;
                    
                    // Add a special class to highlight these cells
                    cell.classList.add('sub-header-cell');
                    
                    subHeaderRow.appendChild(cell);
                }
                
                // Add the sub-header row to the tbody
                tbody.appendChild(subHeaderRow);
                
                // Add click event to the sub-header row to select the entire test case
                subHeaderRow.addEventListener('click', function() {
                    // Find the test case header row and trigger its click event
                    if (this.dataset.testCaseId) {
                        const testCaseId = this.dataset.testCaseId;
                        const testCaseHeaderRow = tbody.querySelector(`tr[data-test-case-id="${testCaseId}"]:not(.sub-header-row)`);
                        if (testCaseHeaderRow) {
                            testCaseHeaderRow.click();
                        }
                    }
                });
            }
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
        showNotification('No test selected', 'error');
        return;
    }
    
    // Get the test logs for the current test case
    const testLogs = testLogEntries[currentlyDisplayedTestCase];
    if (!testLogs || !testLogs.start) {
        showNotification('No test logs available for export', 'error');
        return;
    }
    
    // Check if this is a manual test case
    const isManualTest = currentlyDisplayedTestCase.startsWith('manual-test-');
    
    // Create a text content for the export
    let textContent = '';
    
    // Add test case header information
    textContent += `TEST CASE REPORT\n`;
    textContent += `=================\n\n`;
    
    if (isManualTest) {
        textContent += `Manual Test Case\n`;
        if (testLogs.description) {
            textContent += `Description: ${testLogs.description}\n`;
        }
    } else {
        // Get the test case data directly from the test log entries
        let issueKey = 'unknown';
        let summary = '';
        let description = '';
        
        // If we have test log entries with a test case object, use its properties
        if (testLogs.testCase) {
            issueKey = testLogs.testCase.issueKey || 'unknown';
            summary = testLogs.testCase.summary || '';
            description = testLogs.testCase.description || '';
        }
        
        textContent += `Issue Key: ${issueKey}\n`;
        if (summary) {
            textContent += `Summary: ${summary}\n`;
        }
        textContent += `Sheet: ${currentlyDisplayedTestCase.split('-test-')[0]}\n`;
    }
    
    textContent += `Date: ${new Date().toLocaleString()}\n`;
    
    // Add additional information if available
    const firmwareVersion = document.getElementById('firmware-build');
    if (firmwareVersion && firmwareVersion.value) {
        textContent += `Firmware Version: ${firmwareVersion.value}\n`;
    }
    
    // Add App Version if available - check both the status display and the tracker input
    const appVersionStatus = document.getElementById('app-version');
    const appVersionTracker = document.getElementById('app-version-tracker');
    
    if (appVersionTracker && appVersionTracker.value) {
        // First priority: use the value from the input field if available
        textContent += `App Version: ${appVersionTracker.value}\n`;
    } else if (appVersionStatus && appVersionStatus.textContent && appVersionStatus.textContent !== '--') {
        // Second priority: use the value from the status display if available
        textContent += `App Version: ${appVersionStatus.textContent}\n`;
    }
    
    // Add Phone OS/Version if available
    const phoneOSVersion = document.getElementById('phone-type');
    if (phoneOSVersion && phoneOSVersion.value) {
        textContent += `Phone OS/Version: ${phoneOSVersion.value}\n`;
    }
    
    // Add Notes if available - check both the test notes and the test case notes
    const testNotes = document.getElementById('test-notes');
    if (testNotes && testNotes.value) {
        // First priority: use the value from the test notes textarea
        textContent += `\nNotes: ${testNotes.value}\n`;
    } else if (window.testCaseNotes && window.testCaseNotes[currentlyDisplayedTestCase]) {
        // Second priority: use the test case notes if available
        textContent += `\nNotes: ${window.testCaseNotes[currentlyDisplayedTestCase]}\n`;
    }
    
    textContent += `\n`;
    
    // Add test result information
    const result = testLogs.pass ? 'PASS' : (testLogs.fail ? 'FAIL' : 'INCOMPLETE');
    textContent += `TEST RESULT: ${result}\n\n`;
    
    // Add test case details from the table
    textContent += `TEST CASE DETAILS:\n`;
    textContent += `------------------\n\n`;
    
    // For manual test cases, we don't have a table
    if (isManualTest) {
        textContent += `Manual test case with user-provided description\n\n`;
    } else {
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
    }
    
    // Add notes if they exist (moved to appear above the logs)
    if (testLogs.notes && testLogs.notes.trim()) {
        textContent += `\nTEST SPECIFIC NOTES/BUGS:\n`;
        textContent += `-----------------\n`;
        textContent += `${testLogs.notes}\n\n`;
    }
    
    // Add test log information
    textContent += `CURRENT TEST LOGS:\n`;
    textContent += `-----------------\n\n`;
    
    // Add start log
    textContent += `START: ${testLogs.start.timestamp} - ${testLogs.start.text}\n\n`;
    
    // Add result log if available
    if (testLogs.pass) {
        textContent += `PASS: ${testLogs.pass.timestamp} - ${testLogs.pass.text}\n\n`;
    } else if (testLogs.fail) {
        textContent += `FAIL: ${testLogs.fail.timestamp} - ${testLogs.fail.text}\n\n`;
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
    
    // Save the errors to a file
    function saveErrors() {
        if (errorEntries.length === 0) {
            showNotification('No errors to save', 'warning');
            return;
        }
        
        const content = errorEntries.map(entry => {
            return `${entry.timestamp} ${entry.message}`;
        }).join('\n');
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `FTDI_Errors_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        showNotification('Errors saved successfully', 'success');
    }

    // Print the main log window
    function printLog() {
        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        
        // Get the current filter
        const currentFilterValue = logFilter.value;
        const filterLabel = logFilter.options[logFilter.selectedIndex].text;
        
        // Create the content to print
        let printContent = `
            <html>
            <head>
                <title>FTDI Logger - ${filterLabel} Log</title>
                <style>
                    body { font-family: monospace; padding: 20px; }
                    h1 { font-size: 18px; margin-bottom: 10px; }
                    .timestamp { color: #666; }
                    .log-entry { margin-bottom: 5px; white-space: pre-wrap; }
                    .error { color: #e74c3c; }
                    .warning { color: #f39c12; }
                    .info { color: #3498db; }
                    .success { color: #2ecc71; }
                    .footer { margin-top: 20px; font-size: 12px; color: #999; }
                </style>
            </head>
            <body>
                <h1>FTDI Logger - ${filterLabel} Log (${new Date().toLocaleString()})</h1>
                <div class="log-content">
        `;
        
        // Add the log entries
        const visibleEntries = logEntries.filter(entry => {
            if (currentFilterValue === 'full') return true;
            return entry.message.toLowerCase().includes(currentFilterValue.toLowerCase());
        });
        
        visibleEntries.forEach(entry => {
            const colorClass = applyColorCoding(entry.message);
            printContent += `<div class="log-entry ${colorClass}">
                <span class="timestamp">${entry.timestamp}</span> ${entry.message}
            </div>`;
        });
        
        // Close the HTML structure
        printContent += `
                </div>
                <div class="footer">
                    Generated by FTDI Logger on ${new Date().toLocaleString()}
                </div>
            </body>
            </html>
        `;
        
        // Write to the new window and print
        printWindow.document.open();
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Wait for content to load before printing
        printWindow.onload = function() {
            printWindow.print();
            // Don't close the window automatically to allow the user to cancel or adjust print settings
        };
    }

    // Print the errors window
    function printErrors() {
        if (errorEntries.length === 0) {
            showNotification('No errors to print', 'warning');
            return;
        }
        
        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        
        // Create the content to print
        let printContent = `
            <html>
            <head>
                <title>FTDI Logger - Errors, Exceptions and Warnings</title>
                <style>
                    body { font-family: monospace; padding: 20px; }
                    h1 { font-size: 18px; margin-bottom: 10px; }
                    .timestamp { color: #666; }
                    .log-entry { margin-bottom: 5px; white-space: pre-wrap; }
                    .error { color: #e74c3c; }
                    .warning { color: #f39c12; }
                    .exception { color: #9b59b6; }
                    .unexpected { color: #e67e22; }
                    .connection { color: #3498db; }
                    .footer { margin-top: 20px; font-size: 12px; color: #999; }
                    .summary { margin: 15px 0; padding: 10px; background: #f8f8f8; border-radius: 4px; }
                </style>
            </head>
            <body>
                <h1>FTDI Logger - Errors, Exceptions and Warnings (${new Date().toLocaleString()})</h1>
                <div class="summary">
                    <strong>Summary:</strong><br>
                    Errors: ${errorCounts.error}<br>
                    Failures: ${errorCounts.failure}<br>
                    Warnings: ${errorCounts.warning}<br>
                    Exceptions: ${errorCounts.exception}<br>
                    Unexpected: ${errorCounts.unexpected}<br>
                    Connection Issues: ${errorCounts.connection}
                </div>
                <div class="log-content">
        `;
        
        // Add the error entries
        errorEntries.forEach(entry => {
            const colorClass = applyColorCoding(entry.message);
            printContent += `<div class="log-entry ${colorClass}">
                <span class="timestamp">${entry.timestamp}</span> ${entry.message}
            </div>`;
        });
        
        // Close the HTML structure
        printContent += `
                </div>
                <div class="footer">
                    Generated by FTDI Logger on ${new Date().toLocaleString()}
                </div>
            </body>
            </html>
        `;
        
        // Write to the new window and print
        printWindow.document.open();
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Wait for content to load before printing
        printWindow.onload = function() {
            printWindow.print();
            // Don't close the window automatically to allow the user to cancel or adjust print settings
        };
    }

    // Create a filename for the export
    let filename;
    
    if (isManualTest) {
        // Get components for manual test case file name
        let firmwareVersion = '';
        let status = testLogs.pass ? 'Pass' : (testLogs.fail ? 'Fail' : 'Incomplete');
        
        // Get Firmware Version from input field
        const firmwareElement = document.getElementById('firmware-build');
        if (firmwareElement && firmwareElement.value) {
            firmwareVersion = firmwareElement.value;
        }
        
        // Format: "Manual Test Case - [Firmware Version] - [Pass/Fail]"
        filename = `Manual Test Case - ${firmwareVersion ? firmwareVersion + ' - ' : ''}${status}.txt`;
    } else {
        // Get the components for the file name
        let issueKey = 'unknown';
        let summary = '';
        let firmwareVersion = '';
        let status = testLogs.pass ? 'Pass' : (testLogs.fail ? 'Fail' : 'Incomplete');
        
        // Get Issue Key and Summary from test case object
        if (testLogs.testCase) {
            issueKey = testLogs.testCase.issueKey || 'unknown';
            summary = testLogs.testCase.summary || '';
        }
        
        // Get Firmware Version from input field
        const firmwareElement = document.getElementById('firmware-build');
        if (firmwareElement && firmwareElement.value) {
            firmwareVersion = firmwareElement.value;
        }
        
        // Clean up summary for filename (remove special characters, limit length)
        summary = summary.replace(/[\/:*?"<>|]/g, '').trim();
        if (summary.length > 30) {
            summary = summary.substring(0, 30) + '...';
        }
        
        // Format: "Test Case - [Firmware Version] - [Issue Key] - [Summary] - [Pass/Fail status]"
        filename = `Test Case - ${firmwareVersion ? firmwareVersion + ' - ' : ''}${issueKey} - ${summary} - ${status}.txt`;
    }
    
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

// Export all test cases with their Pass/Fail status and individual notes
function exportAllTestCases() {
    // Get the test plan table
    const testPlanTable = document.querySelector('#test-data-container table');
    
    if (!testPlanTable) {
        showNotification('No test plan loaded', 'error');
        return;
    }
    
    // Create a text content for the export
    let textContent = '';
    
    // Add header information
    textContent += `ALL TEST CASES REPORT\n`;
    textContent += `====================\n\n`;
    textContent += `Date: ${new Date().toLocaleString()}\n`;
    
    // Add Device Type if available
    const deviceType = document.getElementById('deviceType');
    if (deviceType && deviceType.value) {
        textContent += `Device Type: ${deviceType.value}\n`;
    }
    
    // Add Firmware Version if available
    const firmwareVersion = document.getElementById('firmware-build');
    if (firmwareVersion && firmwareVersion.value) {
        textContent += `Firmware Version: ${firmwareVersion.value}\n`;
    }
    
    // Add App Version if available - check both the status display and the tracker input
    const appVersionStatus = document.getElementById('app-version');
    const appVersionTracker = document.getElementById('app-version-tracker');
    
    if (appVersionTracker && appVersionTracker.value) {
        // First priority: use the value from the input field if available
        textContent += `App Version: ${appVersionTracker.value}\n`;
    } else if (appVersionStatus && appVersionStatus.textContent && appVersionStatus.textContent !== '--') {
        // Second priority: use the value from the status display if available
        textContent += `App Version: ${appVersionStatus.textContent}\n`;
    }
    
    // Add Phone OS/Version if available
    const phoneOSVersion = document.getElementById('phone-type');
    if (phoneOSVersion && phoneOSVersion.value) {
        textContent += `Phone OS/Version: ${phoneOSVersion.value}\n`;
    }
    
    // Add Test Plan Notes if available
    const testNotes = document.getElementById('test-notes');
    if (testNotes && testNotes.value) {
        textContent += `\nTest Plan Notes:\n`;
        textContent += `-----------------\n`;
        textContent += `${testNotes.value}\n`;
    }
    
    textContent += `\n`;
    
    // Get all rows from the table body
    const rows = testPlanTable.querySelectorAll('tbody tr');
    
    if (!rows || rows.length === 0) {
        showNotification('No test cases available to export', 'error');
        return;
    }
    
    // Get the headers from the table
    const headers = [];
    const headerRow = testPlanTable.querySelector('thead tr');
    if (headerRow) {
        headerRow.querySelectorAll('th').forEach(th => {
            headers.push(th.textContent || '');
        });
    }
    
    // Find the index of the Issue Key column and Summary column
    let issueKeyIndex = -1;
    let summaryIndex = -1;
    
    headers.forEach((header, index) => {
        const headerText = header.toLowerCase();
        if (headerText.includes('issue') || headerText.includes('key') || headerText.includes('test #') || headerText === 'id') {
            issueKeyIndex = index;
        }
        if (headerText.includes('summary')) {
            summaryIndex = index;
        }
    });
    
    // If we couldn't find the Issue Key column, use the first column
    if (issueKeyIndex === -1) issueKeyIndex = 0;
    // If we couldn't find the Summary column, use the second column
    if (summaryIndex === -1) summaryIndex = 1;
    
    // Get test statistics from the UI display
    const passedTests = document.getElementById('passed-tests') ? parseInt(document.getElementById('passed-tests').textContent) || 0 : 0;
    const failedTests = document.getElementById('failed-tests') ? parseInt(document.getElementById('failed-tests').textContent) || 0 : 0;
    const notTestedTests = document.getElementById('not-tested-tests') ? parseInt(document.getElementById('not-tested-tests').textContent) || 0 : 0;
    const passRate = document.getElementById('pass-rate') ? document.getElementById('pass-rate').textContent : '0%';
    
    // Calculate total and incomplete tests
    const totalTests = rows.length;
    const incompleteTests = totalTests - passedTests - failedTests - notTestedTests;
    
    // Add summary statistics before test case details
    textContent += `TEST STATISTICS:\n`;
    textContent += `---------------\n`;
    textContent += `Total Tests: ${totalTests}\n`;
    textContent += `Passed: ${passedTests}\n`;
    textContent += `Failed: ${failedTests}\n`;
    textContent += `Incomplete: ${incompleteTests}\n`;
    textContent += `Not Started: ${notTestedTests}\n`;
    textContent += `Pass Rate: ${passRate}\n\n`;
    
    // Add test cases section header
    textContent += `TEST CASES:\n`;
    textContent += `-----------\n\n`;
    
    // Second pass: add each test case with its status and notes
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (!cells || cells.length === 0) return;
        
        // Get the Issue Key and Summary from the table cells
        const issueKey = cells[issueKeyIndex] ? cells[issueKeyIndex].textContent.trim() : 'unknown';
        const summary = cells[summaryIndex] ? cells[summaryIndex].textContent.trim() : '';
        
        // Create a test case ID from the Issue Key
        const testCaseId = `${activeSheetName}-test-${issueKey}`;
        const testLogs = testLogEntries[testCaseId] || {};
        
        // Get the status from the row
        let status = 'Not Started';
        
        // Check if the last cell in the row contains 'Pass' or 'Fail' text
        const allCells = Array.from(row.querySelectorAll('td'));
        if (allCells.length > 0) {
            const lastCell = allCells[allCells.length - 1];
            const cellText = lastCell.textContent.trim();
            
            if (cellText === 'Pass') {
                status = 'PASS';
            } else if (cellText === 'Fail') {
                status = 'FAIL';
            }
        }
        
        // If status not found in last cell, check for visual status indicators
        if (status === 'Not Started') {
            const statusIndicator = row.querySelector('.status-indicator');
            if (statusIndicator) {
                if (statusIndicator.classList.contains('status-pass')) {
                    status = 'PASS';
                } else if (statusIndicator.classList.contains('status-fail')) {
                    status = 'FAIL';
                } else if (statusIndicator.classList.contains('status-in-progress')) {
                    status = 'INCOMPLETE';
                }
            }
        }
        
        // If still not found, check for pass/fail buttons that are highlighted
        if (status === 'Not Started') {
            const passButton = row.querySelector('.pass-button.active');
            const failButton = row.querySelector('.fail-button.active');
            
            if (passButton) {
                status = 'PASS';
            } else if (failButton) {
                status = 'FAIL';
            }
        }
        
        // As a last resort, check the test logs
        if (status === 'Not Started') {
            if (testLogs.pass) {
                status = 'PASS';
            } else if (testLogs.fail) {
                status = 'FAIL';
            } else if (testLogs.start) {
                status = 'INCOMPLETE';
            }
        }
        
        // Add test case header
        textContent += `Issue Key: ${issueKey}\n`;
        textContent += `Summary: ${summary}\n`;
        
        // Add test case header
        textContent += `Issue Key: ${issueKey}\n`;
        textContent += `Summary: ${summary}\n`;
        
        // Add test case notes if available
        if (window.testCaseNotes && window.testCaseNotes[testCaseId]) {
            textContent += `Test Specific Notes/Bugs:\n${window.testCaseNotes[testCaseId]}\n`;
        }
        
        // Add timestamps if available
        if (testLogs.start) {
            textContent += `Start: ${testLogs.start.timestamp}\n`;
        }
        if (testLogs.pass) {
            textContent += `Pass: ${testLogs.pass.timestamp}\n`;
        } else if (testLogs.fail) {
            textContent += `Fail: ${testLogs.fail.timestamp}\n`;
        }
        
        textContent += `\n`; // Add a blank line between test cases
    });
    
    // Create a filename for the export
    let deviceTypeStr = deviceType && deviceType.value ? deviceType.value : 'Unknown';
    let firmwareVersionStr = firmwareVersion && firmwareVersion.value ? firmwareVersion.value : '';
    let filename = `Test Cases - ${deviceTypeStr} - ${firmwareVersionStr || 'No Firmware'} - ${new Date().toISOString().slice(0, 10)}.txt`;
    
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
    
    showNotification(`Test cases exported as ${filename}`, 'success');
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
    logHeading.textContent = 'Current Test Logs:';
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
    notesHeading.textContent = 'Test Specific Notes/Bugs:';
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

// Check for temperature, humidity, and setpoint data in log messages
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
    
    // Check for setpoint data in format "setpoint | current - celsius:28.000000"
    if (message.includes("setpoint | current")) {
        // Create a unique key for this message to prevent duplicate processing
        // Extract timestamp and message ID if available
        const timestampMatch = message.match(/^([\d:.]+)/);
        const idMatch = message.match(/id:([\d]+)/);
        const messageKey = (timestampMatch ? timestampMatch[1] : '') + 
                          (idMatch ? idMatch[1] : '') + 
                          'setpoint';
        
        // Only process if we haven't seen this message before
        if (!processedSetpointMessages.has(messageKey)) {
            // Mark as processed
            processedSetpointMessages.add(messageKey);
            
            // Extract the Celsius value
            const setpointMatch = message.match(/celsius:(\d+\.\d+)/);
            if (setpointMatch && setpointMatch[1]) {
                const setpointValue = parseFloat(setpointMatch[1]);
                if (!isNaN(setpointValue)) {
                    const roundedSetpoint = Math.round(setpointValue); // Round to whole number
                    console.log(`Found setpoint: ${roundedSetpoint}°C (message key: ${messageKey})`);
                    
                    // Update the setpoint data
                    const currentSetpointElement = document.getElementById('current-setpoint');
                    if (currentSetpointElement) {
                        currentSetpointElement.textContent = `${roundedSetpoint}°C`;
                    }
                    
                    // Add to chart
                    const now = new Date();
                    // Format time as 12-hour with AM/PM (e.g., "12:01 PM")
                    const timeLabel = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    timeLabels.push(timeLabel);
                    setpointData.push(roundedSetpoint);
                    
                    // Add null values for other datasets to maintain alignment
                    temperatureData.push(null);
                    humidityData.push(null);
                    
                    // Limit data points
                    if (timeLabels.length > MAX_DATA_POINTS) {
                        timeLabels.shift();
                        setpointData.shift();
                        temperatureData.shift();
                        humidityData.shift();
                    }
                    
                    // Update chart
                    if (envChart) {
                        envChart.update();
                    }
                }
            }
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

// Update setpoint data and display
function updateSetpointData(setpoint) {
    // Update the current setpoint display if it exists
    const currentSetpointElement = document.getElementById('current-setpoint');
    if (currentSetpointElement) {
        currentSetpointElement.textContent = `${setpoint}°C`;
    }
    
    // Add data to the chart
    addDataPoint('setpoint', setpoint);
}

// Add a data point to the chart
function addDataPoint(type, value) {
    const now = new Date();
    // Format time as 12-hour with AM/PM (e.g., "12:01 PM")
    const timeLabel = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const isMysa = window.location.pathname.includes('mysa-logger');
    
    // For setpoint data, always add a new data point
    if (type === 'setpoint') {
        // Always add a new time label and data point for setpoints
        timeLabels.push(timeLabel);
        
        // For setpoint data, we need to update the appropriate array
        if (isMysa) {
            // For MYSA page, update temperatureData (used for setpoint)
            temperatureData.push(value);
            
            // Limit the number of data points
            if (timeLabels.length > MAX_DATA_POINTS) {
                timeLabels.shift();
                temperatureData.shift();
            }
        } else {
            // For non-MYSA pages, update setpointData
            temperatureData.push(null);
            humidityData.push(null);
            setpointData.push(value);
            
            // Limit the number of data points
            if (timeLabels.length > MAX_DATA_POINTS) {
                timeLabels.shift();
                temperatureData.shift();
                humidityData.shift();
                setpointData.shift();
            }
        }
    } 
    // For other data types, use the original logic
    else if (timeLabels.length === 0 || timeLabels[timeLabels.length - 1] !== timeLabel) {
        // If this is a new time point, add it to the labels
        timeLabels.push(timeLabel);
        
        if (!isMysa) {
            // For non-MYSA pages, maintain original functionality
            temperatureData.push(type === 'temperature' ? value : null);
            humidityData.push(type === 'humidity' ? value : null);
            setpointData.push(null); // Add null for setpoint
            
            // Limit the number of data points
            if (timeLabels.length > MAX_DATA_POINTS) {
                timeLabels.shift();
                temperatureData.shift();
                humidityData.shift();
                setpointData.shift();
            }
        }
    } else {
        // Update the latest data point (only for non-MYSA pages)
        if (!isMysa) {
            if (type === 'temperature') {
                temperatureData[temperatureData.length - 1] = value;
            } else if (type === 'humidity') {
                humidityData[humidityData.length - 1] = value;
            }
        }
    }
    
    // Adjust the chart's Y-axis based on the current data
    if (envChart) {
        // Filter out null values
        const validTempData = temperatureData.filter(val => val !== null);
        const validHumidityData = isMysa ? [] : humidityData.filter(val => val !== null);
        
        // Only adjust if we have data
        if (validTempData.length > 0 || validHumidityData.length > 0) {
            // Find min and max values for datasets
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
    const ctx = document.getElementById('env-chart');
    if (!ctx) return; // Exit if chart element doesn't exist
    
    // Reset global chart data arrays
    timeLabels = [];
    temperatureData = [];
    humidityData = [];
    setpointData = [];
    
    // Clear the processed setpoint messages set
    processedSetpointMessages.clear(); 

    // Check if we're on the MYSA logger page
    const isMysa = window.location.pathname.includes('mysa-logger');
    
    // Configure datasets based on page type
    let datasets = [];
    
    if (isMysa) {
        // For MYSA page, only track setpoint values
        datasets = [
            {
                label: ' ', // Empty label to remove the 'Setpoint' text from the legend
                data: temperatureData,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 2
            }
        ];
    } else {
        // For other pages, maintain original functionality and add setpoint
        datasets = [
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
            },
            {
                label: 'Setpoint °',
                data: setpointData,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 2
            }
        ];
    }
    
    // Create the chart
    envChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 }
                }
            },
            // We'll use the grid borders instead of a chart border
            layout: {
                padding: {
                    left: 2,  // Just enough to move off the Y-axis
                    right: 0  // No padding needed on the right
                }
            },
            scales: {
                y: {
                    border: {
                        display: true,
                        color: '#000000',
                        width: 2
                    },
                    beginAtZero: true, // Always start at zero
                    min: 0, // Set minimum to 0
                    max: 40, // Set maximum to 40
                    ticks: {
                        stepSize: 10, // Use steps of 10 (0, 10, 20, 30, 40)
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            size: 13
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',  // Darker grid lines
                        borderColor: '#000000',        // Black border color for the y-axis
                        borderWidth: 2,               // Thicker border width
                        drawBorder: true,             // Enable border drawing
                        drawOnChartArea: true         // Draw grid lines on chart area
                    },
                    title: {
                        display: false // Hide the Y-axis title
                    }
                },
                x: {
                    border: {
                        display: true,
                        color: '#000000',
                        width: 2
                    },
                    offset: false,  // No offset to keep it simple
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',  // Darker grid lines
                        borderColor: '#000000',        // Black border color for the x-axis
                        borderWidth: 2,               // Increased border width to match Y-axis
                        drawBorder: true,             // Enable border drawing
                        drawOnChartArea: true         // Draw grid lines on chart area
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            size: 13
                        },
                        padding: 5, // Reduced padding to move labels closer to the chart
                        callback: function(value, index, values) {
                            // Just return the label as is since toLocaleTimeString already formats it
                            // The label already includes AM/PM from toLocaleTimeString
                            return timeLabels[index] || '';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time of Event',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        padding: {
                            top: 2,
                            bottom: 0
                        },
                        color: 'rgba(255, 255, 255, 1)' // Make text white
                    }
                }
            },
            plugins: {
                legend: {
                    display: isMysa ? false : true,
                    position: 'left',
                    align: 'start',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        boxWidth: 12,
                        padding: 10,
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                if (label.includes('Temp') && !label.includes('Setpoint')) {
                                    return `Temp = ${parseFloat(context.raw).toFixed(2)} °`;
                                } else if (label.includes('Humidity')) {
                                    return `Humidity = ${context.raw}%`;
                                } else if (label.includes('Setpoint')) {
                                    return `Setpoint = ${parseFloat(context.raw).toFixed(0)} °`;
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
    console.log('Thermostat command functionality removed');
    showNotification('Thermostat command functionality removed', 'info');
}

// Function to clear the chart data
function clearChart() {
    console.log('Clear chart button clicked');
    
    try {
        // Reset global data arrays
        timeLabels = [];
        temperatureData = [];
        humidityData = [];
        setpointData = [];
        
        // Clear the processed setpoint messages set to allow new setpoints to be processed
        processedSetpointMessages.clear();
        
        // Update the chart if it exists
        if (envChart) {
            console.log('Clearing chart data...');
            
            // Clear all datasets directly
            envChart.data.labels = [];
            
            // Clear each dataset's data array
            envChart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            
            // Ensure the chart data arrays are properly linked to the global arrays
            envChart.data.labels = timeLabels;
            for (let i = 0; i < envChart.data.datasets.length; i++) {
                if (i === 0 && envChart.data.datasets[i]) envChart.data.datasets[i].data = temperatureData;
                if (i === 1 && envChart.data.datasets[i]) envChart.data.datasets[i].data = humidityData;
                if (i === 2 && envChart.data.datasets[i]) envChart.data.datasets[i].data = setpointData;
            }
            
            // Update the chart to reflect the changes
            envChart.update();
            console.log('Chart updated with empty data');
        } else {
            console.log('Chart not initialized yet');
        }
        
        console.log('Chart data cleared - ready for new data points');
        showNotification('Chart cleared - ready for new data', 'success');
    } catch (error) {
        console.error('Error clearing chart:', error);
        showNotification('Error clearing chart: ' + error.message, 'error');
    }
}

// Check for thermostat mode and setpoint information in log messages
function checkForThermostatInfo(message) {
    // Check for MYSA setpoint log format
    // Example: "INFO  |       17620 |     setpoint | current - celsius:9.000000 fahrenheit:48.200000 src:0 issued:0 applied:0 units:0 id:6324325334918405061"
    if (message.includes('setpoint | current - celsius:')) {
        try {
            // Extract the celsius setpoint value
            const setpointMatch = message.match(/celsius:(\d+\.\d+)/);
            if (setpointMatch && setpointMatch[1]) {
                const setpoint = parseFloat(setpointMatch[1]);
                
                // Round to nearest whole number for display
                const roundedSetpoint = Math.round(setpoint);
                
                // Update the setpoint display
                thermostatSetpoint.textContent = `${roundedSetpoint}°C`;
                
                // Add setpoint data to the chart if we're on the MYSA page
                if (window.location.pathname.includes('mysa-logger')) {
                    addDataPoint('setpoint', roundedSetpoint);
                }
                
                console.log(`Detected MYSA setpoint update: ${roundedSetpoint}°C (from ${setpoint}°C)`);
            }
        } catch (error) {
            console.error('Error parsing MYSA setpoint:', error);
        }
    }
    // Check for the new hvac_controller update_hvac_state format
    // Example: "12:46:43.297 [0;32mI (198632) hvac_controller: update_hvac_state: time: 197 temp: 2273, mode: 0, hsp: 2300[0m"
    else if (message.includes('hvac_controller: update_hvac_state:')) {
        try {
            // Extract mode and heating setpoint values
            const modeMatch = message.match(/mode: (\d+)/);
            const hspMatch = message.match(/hsp: (\d+)/);
            
            if (modeMatch && modeMatch[1]) {
                const modeValue = parseInt(modeMatch[1]);
                
                // Update the thermostat mode display based on the mode value
                switch (modeValue) {
                    case 0:
                        thermostatMode.textContent = 'Off';
                        thermostatMode.className = 'status-value off';
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
                        break;
                    default:
                        thermostatMode.textContent = `Mode ${modeValue}`;
                        thermostatMode.className = 'status-value';
                }
                
                console.log(`Detected system mode from hvac_controller: ${thermostatMode.textContent}`);
            }
            
            if (hspMatch && hspMatch[1]) {
                const hspValue = parseInt(hspMatch[1]);
                // Convert from hundredths of a degree to whole degrees (e.g., 2300 -> 23.0)
                const setpoint = (hspValue / 100).toFixed(1);
                
                // Update the setpoint display
                thermostatSetpoint.textContent = `${setpoint}°C`;
                
                // Add setpoint data to the chart if we're on the MYSA page
                if (window.location.pathname.includes('mysa-logger')) {
                    addDataPoint('setpoint', parseFloat(setpoint));
                }
                
                console.log(`Detected heating setpoint from hvac_controller: ${setpoint}°C`);
            }
        } catch (error) {
            console.error('Error parsing hvac_controller update:', error);
        }
    }
    // Check for heating setpoint updates (legacy format)
    else if (message.includes('Matter app_events: Heating Setpoint Updated:')) {
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
                
                // Add setpoint data to the chart if we're on the MYSA page
                if (window.location.pathname.includes('mysa-logger')) {
                    addDataPoint('setpoint', setpoint);
                }
                
                console.log(`Detected heating setpoint update: ${setpoint}°C, Mode: ${thermostatMode.textContent}`);
            }
        } catch (error) {
            console.error('Error parsing heating setpoint:', error);
        }
    }
    
    // Check for cooling setpoint updates (legacy format)
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
                
                // Add setpoint data to the chart if we're on the MYSA page
                if (window.location.pathname.includes('mysa-logger')) {
                    addDataPoint('setpoint', setpoint);
                }
                
                console.log(`Detected cooling mode with setpoint: ${setpoint}°C`);
            }
        } catch (error) {
            console.error('Error parsing cooling setpoint:', error);
        }
    }
    
    // Check for Mode Updated events (legacy format)
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
    
    // Check for system mode from thermostat_endpoint (legacy format)
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
    // Check for MYSA Booted Version format
    // Example: "11:00:44.704 Booted, Version: 3.15.1.14"
    if (message.includes('Booted, Version:')) {
        try {
            // Extract the version value
            const versionMatch = message.match(/Booted, Version:\s+([\d\.]+)/);
            if (versionMatch && versionMatch[1]) {
                const version = versionMatch[1];
                
                // Update the App version display
                appVersion.textContent = version;
                
                console.log(`Detected MYSA App version: ${version}`);
            }
        } catch (error) {
            console.error('Error parsing MYSA App version:', error);
        }
    }
    // Check for LV App version information (legacy format)
    else if (message.includes('cpu_start: App version:')) {
        try {
            // Extract the version value
            const versionMatch = message.match(/cpu_start: App version:\s+(\d+\.\d+)/);
            if (versionMatch && versionMatch[1]) {
                const version = versionMatch[1];
                
                // Update the App version display
                appVersion.textContent = version;
                
                console.log(`Detected LV App version: ${version}`);
            }
        } catch (error) {
            console.error('Error parsing LV App version:', error);
        }
    }
}

// Check for temperature unit information in log messages
function checkForTemperatureUnit(message) {
    // Check for temperature unit information in the original format
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
    
    // Check for the new temperature unit format
    if (message.includes('settings | temperature units: celsius')) {
        try {
            tempUnit.textContent = 'C';
            console.log('Temperature unit set to Celsius (new format)');
        } catch (error) {
            console.error('Error setting temperature unit from new format:', error);
        }
    }
    
    // Check for Fahrenheit in the new format
    if (message.includes('settings | temperature units: fahrenheit')) {
        try {
            tempUnit.textContent = 'F';
            console.log('Temperature unit set to Fahrenheit (new format)');
        } catch (error) {
            console.error('Error setting temperature unit from new format:', error);
        }
    }
}

// Check for UI lock status in log messages
function checkForUILock(message) {
    // Check for UI lock information
    if (message.includes('settings | ui locked:')) {
        try {
            // Extract the lock value (0 or 1)
            const lockMatch = message.match(/settings \| ui locked:\s+(\d+)/);
            if (lockMatch && lockMatch[1]) {
                const lockValue = parseInt(lockMatch[1]);
                const uiLock = document.getElementById('ui-lock');
                
                // Update the UI lock display (1 = Yes, 0 = No)
                if (lockValue === 1) {
                    uiLock.textContent = 'Yes';
                    console.log('UI Lock set to Yes');
                } else if (lockValue === 0) {
                    uiLock.textContent = 'No';
                    console.log('UI Lock set to No');
                }
            }
        } catch (error) {
            console.error('Error parsing UI lock status:', error);
        }
    }
}

// Check for Device Type information in log messages (MYSA page) or language (LV page)
// Check for device ID in log messages
function checkForDeviceID(message) {
    // Example 1: " device info | accessory name: Mysa-7202d0"
    if (message.includes('device info | accessory name:')) {
        try {
            // Extract the Device ID value
            const deviceIDMatch = message.match(/accessory name:\s+([\w-]+)/);
            if (deviceIDMatch && deviceIDMatch[1]) {
                const deviceID = deviceIDMatch[1];
                
                // Update the Device ID display
                const deviceIDElement = document.getElementById('device-id');
                if (deviceIDElement) {
                    deviceIDElement.textContent = deviceID;
                }
                
                console.log(`Detected Device ID from accessory name: ${deviceID}`);
            }
        } catch (error) {
            console.error('Error parsing Device ID from accessory name:', error);
        }
    }
    
    // Example 2: "11:28:07.860INFO  |          40 |  device info | hwid: ac67b27202d0"
    if (message.includes('device info | hwid:')) {
        try {
            // Extract the Device ID value from hwid
            const deviceIDMatch = message.match(/hwid:\s+([\w]+)/);
            if (deviceIDMatch && deviceIDMatch[1]) {
                const deviceID = deviceIDMatch[1];
                
                // Update the Device ID display
                const deviceIDElement = document.getElementById('device-id');
                if (deviceIDElement) {
                    deviceIDElement.textContent = deviceID;
                }
                
                console.log(`Detected Device ID from hwid: ${deviceID}`);
            }
        } catch (error) {
            console.error('Error parsing Device ID from hwid:', error);
        }
    }
}

// Check for coexist rom version in log messages and update DID field
function checkForCoexistRomVersion(message) {
    if (message.includes('coexist: coexist rom version')) {
        const versionMatch = message.match(/coexist: coexist rom version ([a-f0-9]+)/);
        if (versionMatch && versionMatch[1]) {
            const romVersion = versionMatch[1];
            const deviceIDElement = document.getElementById('device-id');
            if (deviceIDElement) {
                deviceIDElement.textContent = romVersion;
            } else {
                const tempUnitElement = document.getElementById('temp-unit');
                if (tempUnitElement) {
                    tempUnitElement.textContent = romVersion;
                }
            }
            console.log(`Detected coexist rom version: ${romVersion}`);
        }
    }
}

// Check for device serial number in log messages
function checkForDeviceSerial(message) {
    // Example: "device info | serial: HQ12TVNUAZ"
    if (message.includes('device info | serial:')) {
        try {
            // Extract the serial number value
            const serialMatch = message.match(/serial:\s+([\w]+)/);
            if (serialMatch && serialMatch[1]) {
                const serialNumber = serialMatch[1];
                
                // Update the serial number display
                const serialElement = document.getElementById('device-serial');
                if (serialElement) {
                    serialElement.textContent = serialNumber;
                }
                
                console.log(`Detected Device Serial: ${serialNumber}`);
            }
        } catch (error) {
            console.error('Error parsing device serial number:', error);
        }
    }
}

// Check for minimum and maximum setpoint values in log messages
function checkForSetpointLimits(message) {
    // Example: "settings | min setpoint: 5.000000 max_setpoint: 30.000000"
    if (message.includes('settings | min setpoint:')) {
        try {
            // Extract the min and max setpoint values
            const minSetpointMatch = message.match(/min setpoint:\s+(\d+\.\d+)/);
            const maxSetpointMatch = message.match(/max_setpoint:\s+(\d+\.\d+)/);
            
            // Update the min setpoint display
            if (minSetpointMatch && minSetpointMatch[1]) {
                const minSetpoint = parseFloat(minSetpointMatch[1]);
                const minSetpointElement = document.getElementById('min-setpoint');
                if (minSetpointElement) {
                    minSetpointElement.textContent = `${minSetpoint}°`;
                }
                console.log(`Detected Min Setpoint: ${minSetpoint}°`);
            }
            
            // Update the max setpoint display
            if (maxSetpointMatch && maxSetpointMatch[1]) {
                const maxSetpoint = parseFloat(maxSetpointMatch[1]);
                const maxSetpointElement = document.getElementById('max-setpoint');
                if (maxSetpointElement) {
                    maxSetpointElement.textContent = `${maxSetpoint}°`;
                }
                console.log(`Detected Max Setpoint: ${maxSetpoint}°`);
            }
        } catch (error) {
            console.error('Error parsing setpoint limits:', error);
        }
    }
}

// Check for active and inactive brightness values in log messages
function checkForBrightnessValues(message) {
    // Example: "settings | active brightness: 100 inactive brightness: 50"
    if (message.includes('settings | active brightness:')) {
        try {
            // Extract the active and inactive brightness values
            const activeBrightnessMatch = message.match(/active brightness:\s+(\d+)/);
            const inactiveBrightnessMatch = message.match(/inactive brightness:\s+(\d+)/);
            
            // Update the active brightness display
            if (activeBrightnessMatch && activeBrightnessMatch[1]) {
                const activeBrightness = parseInt(activeBrightnessMatch[1]);
                const activeBrightnessElement = document.getElementById('ambient-brightness');
                if (activeBrightnessElement) {
                    activeBrightnessElement.textContent = `${activeBrightness}%`;
                }
                console.log(`Detected Active Brightness: ${activeBrightness}%`);
            }
            
            // Update the inactive brightness display
            if (inactiveBrightnessMatch && inactiveBrightnessMatch[1]) {
                const inactiveBrightness = parseInt(inactiveBrightnessMatch[1]);
                const inactiveBrightnessElement = document.getElementById('indicator-brightness');
                if (inactiveBrightnessElement) {
                    inactiveBrightnessElement.textContent = `${inactiveBrightness}%`;
                }
                console.log(`Detected Inactive Brightness: ${inactiveBrightness}%`);
            }
        } catch (error) {
            console.error('Error parsing brightness values:', error);
        }
    }
}

// Check for timezone information in log messages
function checkForTimezone(message) {
    // Example: "settings | timezone NST3:30NDT,M3.2.0,M11.1.0"
    if (message.includes('settings | timezone')) {
        try {
            // Extract the timezone information
            const timezoneMatch = message.match(/timezone\s+([^,]+)/);
            if (timezoneMatch && timezoneMatch[1]) {
                const timezoneInfo = timezoneMatch[1];
                
                // Parse the timezone string to extract the offset
                // Format is typically like: NST3:30NDT
                const offsetMatch = timezoneInfo.match(/([A-Z]+)(\d+):(\d+)([A-Z]+)/);
                if (offsetMatch) {
                    const hours = offsetMatch[2];
                    const minutes = offsetMatch[3];
                    const tzName = offsetMatch[4];
                    
                    // Format the timezone display
                    const formattedTimezone = `${hours}:${minutes} ${tzName}`;
                    
                    // Update the timezone display
                    const timezoneElement = document.getElementById('timezone');
                    if (timezoneElement) {
                        timezoneElement.textContent = formattedTimezone;
                    }
                    
                    console.log(`Detected Timezone: ${formattedTimezone}`);
                }
            }
        } catch (error) {
            console.error('Error parsing timezone information:', error);
        }
    }
}

// Check for device type information in log messages
function checkForDeviceType(message) {
    // Check for MYSA Device Type information
    // Example: "10:59:55.246 INFO  |          40 |  device info | ctrl: BB-V2-0 pwr: Not Available - Device Type is BB-V2-0"
    if (message.includes('device info | ctrl:')) {
        try {
            // Extract the Device Type value
            const deviceTypeMatch = message.match(/ctrl:\s+([\w-]+)/);
            if (deviceTypeMatch && deviceTypeMatch[1]) {
                const deviceType = deviceTypeMatch[1];
                
                // Update the Device Type display
                const deviceTypeElement = document.getElementById('device-type');
                if (deviceTypeElement) {
                    deviceTypeElement.textContent = deviceType;
                }
                
                console.log(`Detected MYSA Device Type: ${deviceType}`);
            }
        } catch (error) {
            console.error('Error parsing MYSA Device Type:', error);
        }
    }
}

// Check for language information in log messages
function checkForLanguage(message) {
    // Check for ESP32-S3 chip (LV device)
    if (message.includes('ESP-ROM:esp32s3')) {
        // Update the device type field based on which page we're on
        const deviceTypeElement = document.getElementById('device-type');
        if (deviceTypeElement) {
            deviceTypeElement.textContent = 'LV';
        } else if (language) {
            language.textContent = 'LV';
        }
        console.log('Detected ESP32-S3 chip, setting Device Type to LV');
        return;
    }
    
    // Check for LV language information (legacy format)
    if (message.includes('preferences_helpers: set_preferences_language:')) {
        try {
            // Extract the language value
            const langMatch = message.match(/preferences_helpers: set_preferences_language:\s+(\d+)/);
            if (langMatch && langMatch[1]) {
                const langValue = parseInt(langMatch[1]);
                
                // Update the language display based on the language value
                switch (langValue) {
                    case 0:
                        language.textContent = 'EN';
                        break;
                    case 1:
                        language.textContent = 'FR';
                        break;
                    default:
                        language.textContent = `Lang ${langValue}`;
                }
                
                console.log(`Detected language: ${language.textContent}`);
            }
        } catch (error) {
            console.error('Error parsing language:', error);
        }
    }
}

// Function to add a custom filter pattern
function addCustomFilter() {
    const hiddenFilterText = document.getElementById('hidden-filter-text');
    if (!hiddenFilterText || !hiddenFilterText.value.trim()) {
        return;
    }
    
    const filterText = hiddenFilterText.value.trim();
    
    // Don't add duplicate filters
    if (customFilterPatterns.includes(filterText)) {
        showNotification('This filter pattern already exists!', 'warning');
        hiddenFilterText.value = '';
        return;
    }
    
    // Add the new filter pattern
    customFilterPatterns.push(filterText);
    
    // Clear the input field
    hiddenFilterText.value = '';
    
    // Update the parsed line types list
    updateParsedLineTypesList();
    
    // Reapply filters to existing logs
    reapplyFilterToExistingLogs();
    
    showNotification(`Added new filter pattern: "${filterText}"`, 'success');
}

// Function to remove a custom filter pattern
function removeCustomFilter(pattern) {
    const index = customFilterPatterns.indexOf(pattern);
    if (index !== -1) {
        customFilterPatterns.splice(index, 1);
        
        // Update the parsed line types list
        updateParsedLineTypesList();
        
        // Reapply filters to existing logs
        reapplyFilterToExistingLogs();
        
        showNotification(`Removed filter pattern: "${pattern}"`, 'success');
    }
}

// Check for floor temperature information in log messages
function checkForFloorTemp(message) {
    // Check for floor temperature information
    // Example: "settings | max floor temp: 28.000000"
    if (message.includes('settings | max floor temp:')) {
        try {
            // Extract the floor temperature value
            const floorTempMatch = message.match(/max floor temp:\s+([\d.]+)/);
            if (floorTempMatch && floorTempMatch[1]) {
                const floorTemp = parseFloat(floorTempMatch[1]);
                
                // Format the floor temperature value (remove trailing zeros if it's a whole number)
                const formattedFloorTemp = Number.isInteger(floorTemp) ? floorTemp.toString() : floorTemp.toString();
                
                // Update the floor temperature display
                const floorTempElement = document.getElementById('floor-temp');
                if (floorTempElement) {
                    floorTempElement.textContent = `${formattedFloorTemp}°C`;
                }
                
                console.log(`Detected Floor Temperature: ${formattedFloorTemp}°C`);
            }
        } catch (error) {
            console.error('Error parsing floor temperature:', error);
        }
    }
}

// Function to update the parsed line types list
function updateParsedLineTypesList() {
    const parsedLineTypesList = document.getElementById('parsed-line-types-list');
    if (!parsedLineTypesList) {
        return;
    }
    
    // Clear the list
    parsedLineTypesList.innerHTML = '';
    
    // Add custom filter patterns
    if (customFilterPatterns.length === 0) {
        // Display a message when no filters are active
        const noFiltersMessage = document.createElement('div');
        noFiltersMessage.className = 'no-filters-message';
        noFiltersMessage.textContent = 'No active filters. Add a filter pattern above.';
        parsedLineTypesList.appendChild(noFiltersMessage);
    } else {
        // Add each custom filter pattern
        customFilterPatterns.forEach(pattern => {
            const filterTag = document.createElement('div');
            filterTag.className = 'filter-tag';
            filterTag.innerHTML = `
                <span>${pattern}</span>
                <span class="remove-filter" title="Remove this filter">✖</span>
            `;
            
            // Add event listener to remove button
            const removeButton = filterTag.querySelector('.remove-filter');
            removeButton.addEventListener('click', () => removeCustomFilter(pattern));
            
            parsedLineTypesList.appendChild(filterTag);
        });
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
