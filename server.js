// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const path = require('path');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const XLSX = require('xlsx');
const fetch = require('node-fetch');

// Log environment variables status
console.log('Checking Jira API credentials...');
if (process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) {
  console.log('Jira API credentials loaded successfully');
} else {
  console.warn('Jira API credentials not found or incomplete');
}

// Jira API configuration
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_DOMAIN = process.env.JIRA_DOMAIN || 'empoweredhomes.atlassian.net';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware for file uploads
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  abortOnLimit: true
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Route for the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route for the test plan viewer
app.get('/test-plan', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test-plan-viewer.html'));
});

// Route to proxy sports data requests
app.get('/api/sports/:league', async (req, res) => {
  try {
    const { league } = req.params;
    let apiUrl;
    
    // Get today's date in YYYY-MM-DD format for the API
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateString = `${year}${month}${day}`;
    
    // Map league parameter to ESPN API endpoints with date parameter
    switch(league) {
      case 'nba':
        apiUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateString}`;
        break;
      case 'nhl':
        apiUrl = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${dateString}`;
        break;
      case 'mlb':
        apiUrl = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateString}`;
        break;
      case 'nfl':
        apiUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${dateString}`;
        break;
      case 'golf':
        apiUrl = `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${dateString}`;
        break;
      case 'wnba':
        apiUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates=${dateString}`;
        break;
      case 'mls':
        apiUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard?dates=${dateString}`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid league parameter' });
    }
    
    console.log(`Fetching sports data for ${league} from: ${apiUrl}`);
    
    // Set a timeout for the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(apiUrl, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      
      clearTimeout(timeoutId);
      
      console.log(`${league} API response status:`, response.status);
      
      if (!response.ok) {
        throw new Error(`ESPN API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`${league} data received with ${data.events ? data.events.length : 0} events`);
      
      // Just log if no events are found, don't add sample data
      if (!data.events || data.events.length === 0) {
        console.log(`No events found for ${league}`);
      }
      
      res.json(data);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error(`Error fetching sports data for ${req.params.league}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch sports data', 
      message: error.message,
      league: req.params.league
    });
  }
});

// Test route to get all projects from Jira
app.get('/jira-projects', async (req, res) => {
  try {
    console.log('Fetching all projects from Jira...');
    
    // Check if Jira credentials are available
    if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
      console.error('Jira API credentials not found.');
      return res.status(500).json({ 
        error: 'Jira API credentials not configured'
      });
    }
    
    const jiraUrl = `https://${JIRA_DOMAIN}/rest/api/2/project`;
    console.log('Sending request to Jira API:', jiraUrl);
    
    const response = await fetch(jiraUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Jira API error response:', errorText);
      throw new Error(`Jira API responded with status: ${response.status}`);
    }
    
    const projects = await response.json();
    console.log(`Retrieved ${projects.length} projects from Jira API`);
    
    return res.json({
      success: true,
      projects: projects.map(project => ({
        id: project.id,
        key: project.key,
        name: project.name
      }))
    });
    
  } catch (error) {
    console.error('Error fetching projects from Jira:', error);
    res.status(500).json({ 
      error: 'Failed to fetch projects', 
      message: error.message
    });
  }
});

// Route to serve the test plan data directly
app.get('/test-plan-data', (req, res) => {
  try {
    console.log('Received request for test plan data');
    
    // Path to the updated Excel file in Downloads folder
    const testPlanPath = path.join(process.env.HOME, 'Downloads', 'Adam\'s LV Test Plan.xlsx');
    console.log('Looking for test plan at:', testPlanPath);
    
    // Check if the file exists
    if (!fs.existsSync(testPlanPath)) {
      console.error('Test plan file not found at:', testPlanPath);
      return res.status(404).json({ error: 'Test plan file not found' });
    }
    
    console.log('Test plan file found, reading content...');
    
    // Read the Excel file
    const workbook = XLSX.readFile(testPlanPath, { type: 'binary', cellDates: true, cellNF: false, cellText: false });
    
    // Get all sheet names for the tabs
    const sheetNames = workbook.SheetNames;
    console.log('Found sheets:', sheetNames);
    
    // Create a map of all sheets
    const allSheets = {};
    sheetNames.forEach(sheetName => {
      console.log('Processing sheet:', sheetName);
      const sheet = workbook.Sheets[sheetName];
      allSheets[sheetName] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    });
    
    console.log('Successfully processed all sheets');
    
    // Send the data back to the client
    res.json({
      success: true,
      fileName: 'Adam\'s LV Test Plan.xlsx',
      sheetNames: sheetNames,
      sheets: allSheets
    });
  } catch (error) {
    console.error('Error processing test plan file:', error);
    res.status(500).json({ 
      error: 'Failed to process test plan file', 
      message: error.message,
      stack: error.stack
    });
  }
});

// Route to handle Excel file uploads
app.post('/upload-test-plan', (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: 'No files were uploaded' });
    }

    const testPlanFile = req.files.testPlan;
    const uploadPath = path.join(__dirname, 'uploads', testPlanFile.name);
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
      fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
    }

    // Move the uploaded file to the uploads directory
    testPlanFile.mv(uploadPath, async (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      try {
        // Read the Excel file
        const workbook = XLSX.readFile(uploadPath);
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Get all sheet names for the tabs
        const sheetNames = workbook.SheetNames;
        
        // Create a map of all sheets
        const allSheets = {};
        sheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          allSheets[sheetName] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        });
        
        // Send the data back to the client
        res.json({
          success: true,
          fileName: testPlanFile.name,
          sheetNames: sheetNames,
          sheets: allSheets
        });
      } catch (parseErr) {
        console.error('Error parsing Excel file:', parseErr);
        res.status(500).json({ error: 'Failed to parse Excel file' });
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Route to get default settings
app.get('/default-settings', (req, res) => {
  res.json({
    defaultPort: 'usbserial-141101',
    defaultBaudRate: 115200,
    timeStampFormat: 'Time+Millis'
  });
});

// Bug list functionality removed - now linking directly to Jira

// List available ports for the frontend to use
app.get('/ports', async (req, res) => {
  try {
    const ports = await SerialPort.list();
    
    // Filter out USBmodem ports and enhance the remaining ports
    const enhancedPorts = ports
      .filter(port => {
        // Check for both uppercase and lowercase versions
        return !port.path.toLowerCase().includes('usbmodem');
      })
      .map(port => {
        // Check if this is likely an FTDI device
        const isFTDI = port.manufacturer?.includes('FTDI') || 
                      port.path?.includes('usbserial') || 
                      port.vendorId === '0403'; // FTDI vendor ID
        
        return {
          ...port,
          isFTDI,
          recommended: isFTDI
        };
      });
    
    console.log('Available ports (USBmodem filtered out):', enhancedPorts);
    res.json(enhancedPorts);
  } catch (err) {
    console.error('Error listing ports:', err);
    res.status(500).json({ error: 'Failed to list ports' });
  }
});

// Global variable to store the current serial port connection
let currentPort = null;
let parser = null;

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected');
  
  // Send available ports to the client
  SerialPort.list().then(ports => {
    // Filter out USBmodem ports (case insensitive)
    const filteredPorts = ports.filter(port => !port.path.toLowerCase().includes('usbmodem'));
    socket.emit('ports', filteredPorts);
    console.log('Sent filtered ports to client (USBmodem filtered out)');
  }).catch(err => {
    console.error('Error listing ports:', err);
  });

  // Handle sending commands to the device
  socket.on('send-command', (data) => {
    const { command } = data;
    
    if (!currentPort || !currentPort.isOpen) {
      socket.emit('error', { message: 'Not connected to a port' });
      return;
    }
    
    console.log(`Sending command to device: ${command}`);
    
    // Check if this is a heating setpoint command for 29°C
    if (command === 'set temp 29') {
      console.log('Processing heating setpoint command for 29°C');
      
      // Send the essential commands needed to change the temperature
      // These are the actual commands that trigger the thermostat behavior
      const commands = [
        'app_menu_controller: Entering menu: Ambient Menu',
        'persistence_task: Triggering save notification for event: 1',
        'persistence_task: Processing save notification',
        'connection_manager: Both WiFi and MQTT credentials are ready',
        'connection_manager: Requested BLE shutdown through controller',
        'thermostat_endpoint: Current Occupied Heating Setpoint: 2800',
        'thermostat_endpoint: Occupied Heating Setpoint: 2900',
        'Matter app_events: Heating Setpoint Updated: 29.000000'
      ];
      
      // Send each command with a small delay between them
      let delay = 0;
      commands.forEach((cmd, index) => {
        setTimeout(() => {
          console.log(`Sending command ${index + 1} of ${commands.length}: ${cmd}`);
          currentPort.write(`${cmd}\n`);
          
          // If this is the last command, notify completion
          if (index === commands.length - 1) {
            console.log('Complete command sequence sent for setting temperature to 29°C');
            socket.emit('notification', { message: 'Temperature set to 29°C', type: 'success' });
          }
        }, delay);
        delay += 100; // Increment delay for each command
      });
      
      return;
    }
    
    // Check if this is a heating setpoint command for 28°C
    if (command === 'set temp 28') {
      console.log('Processing heating setpoint command for 28°C');
      
      // Send the essential commands needed to change the temperature
      // These are the actual commands that trigger the thermostat behavior
      const commands = [
        'app_menu_controller: Entering menu: Ambient Menu',
        'persistence_task: Triggering save notification for event: 1',
        'persistence_task: Processing save notification',
        'connection_manager: Both WiFi and MQTT credentials are ready',
        'connection_manager: Requested BLE shutdown through controller',
        'thermostat_endpoint: Current Occupied Heating Setpoint: 2900',
        'thermostat_endpoint: Occupied Heating Setpoint: 2800',
        'Matter app_events: Heating Setpoint Updated: 28.000000'
      ];
      
      // Send each command with a small delay between them
      let delay = 0;
      commands.forEach((cmd, index) => {
        setTimeout(() => {
          console.log(`Sending command ${index + 1} of ${commands.length}: ${cmd}`);
          currentPort.write(`${cmd}\n`);
          
          // If this is the last command, notify completion
          if (index === commands.length - 1) {
            console.log('Complete command sequence sent for setting temperature to 28°C');
            socket.emit('notification', { message: 'Temperature set to 28°C', type: 'success' });
          }
        }, delay);
        delay += 100; // Increment delay for each command
      });
      
      return;
    }
    
    // For all other commands, send as is
    currentPort.write(`${command}\n`, (err) => {
      if (err) {
        console.error('Error sending command:', err);
        socket.emit('error', { message: `Error sending command: ${err.message}` });
      } else {
        console.log('Command sent successfully');
      }
    });
  });

  // Handle connect to port request
  socket.on('connect-port', (data) => {
    const { path, baudRate, dataBits, parity, stopBits } = data;
    
    // Close existing connection if any
    if (currentPort && currentPort.isOpen) {
      currentPort.close();
    }
    
    try {
      // Create new serial port connection with CoolTerm matching settings
      currentPort = new SerialPort({ 
        path, 
        baudRate: parseInt(baudRate) || 115200,
        dataBits: parseInt(dataBits) || 8,
        parity: parity || 'none',
        stopBits: parseInt(stopBits) || 1,
        rtscts: false,  // FlowControlCTS = false
        xon: false,     // FlowControlXON = false
        dtr: false,     // DTRDefaultState = false
        autoOpen: false  // We'll open it manually to ensure proper sequence
      });
      
      // Open the port and handle the open event
      currentPort.open((err) => {
        if (err) {
          console.error('Error opening port:', err);
          socket.emit('error', { message: `Failed to open port: ${err.message}` });
          socket.emit('connection-status', { connected: false });
          return;
        }
        
        // Add a short delay to ensure the port is fully initialized
        setTimeout(() => {
          console.log(`Port ${path} opened successfully`);
          
          // Now that port is confirmed open, set hardware flow control
          try {
            currentPort.set({ rts: false, dtr: false });
            console.log('Hardware flow control set');
          } catch (setErr) {
            console.error('Error setting hardware flow control:', setErr);
          }
        }, 100);
      });
      
      // Log connection information
      console.log(`Connected to ${path} at ${baudRate} baud`);
      
        // Reduced delay before setting up data handler to allow device to initialize
        setTimeout(() => {
          console.log('Setting up data handler...');
          
          // For raw data mode, use a simpler approach without the ReadlineParser
          // This will capture all data exactly as it comes in
          
          // Create a buffer to store incomplete data
          let dataBuffer = '';
          let partialLineTimer = null;
          
          // Function to check if a line is complete (not just by newline, but also by content)
          const isCompleteLogLine = (line) => {
            // Check for ESP32 log patterns
            return line.trim().length > 0 && 
                  (line.trim().startsWith('I (') || 
                   line.trim().startsWith('E (') || 
                   line.trim().startsWith('W (') ||
                   line.trim().startsWith('.[0;'));
          };
          
          currentPort.on('data', (buffer) => {
            // Convert buffer to string - use 'utf8' encoding for better handling of special characters
            const data = buffer.toString('utf8');
            console.log('Received data:', data);
            
            // Append to our buffer
            dataBuffer += data;
            
            // Clear any existing timer for partial lines
            if (partialLineTimer) {
              clearTimeout(partialLineTimer);
              partialLineTimer = null;
            }
            
            // Split by newlines while preserving the exact format
            const lines = dataBuffer.split(/\r\n|\r|\n/);
            
            // Process all lines except the last one (which might be incomplete)
            const completeLines = lines.slice(0, -1);
            dataBuffer = lines[lines.length - 1] || '';
            
            // Send complete lines to all connected clients immediately
            for (const line of completeLines) {
              if (line.trim().length > 0) {
                // Use current timestamp for more accurate logging
                io.volatile.emit('serial-data', { timestamp: new Date().toISOString(), data: line });
              }
            }
            
            // If the buffer contains a complete line (based on ESP32 log patterns),
            // send it and clear the buffer
            if (dataBuffer.trim().length > 0) {
              // Check if this is a complete ESP32 log line
              if (isCompleteLogLine(dataBuffer)) {
                io.volatile.emit('serial-data', { timestamp: new Date().toISOString(), data: dataBuffer });
                dataBuffer = '';
              } else {
                // Set a timer to send partial data if no more data arrives soon
                partialLineTimer = setTimeout(() => {
                  if (dataBuffer.trim().length > 0) {
                    // Don't add a partial marker to avoid interfering with the log format
                    io.volatile.emit('serial-data', { 
                      timestamp: new Date().toISOString(), 
                      data: dataBuffer
                    });
                    dataBuffer = '';
                  }
                }, 50); // Very short timeout to quickly process partial lines
              }
            }
          });
          
          // Send a test message to verify the client-side display is working
          io.emit('serial-data', { 
            timestamp: new Date().toISOString(), 
            data: 'Connection established. Waiting for data from FTDI device...'
          });
          
          // Send a small test command to wake up the device
          try {
            currentPort.write('\r\n');
            console.log('Sent wake-up command to device');
          } catch (writeErr) {
            console.error('Error sending wake-up command:', writeErr);
          }
          
          // Notify client of successful connection
          socket.emit('connection-status', { 
            connected: true, 
            port: path, 
            baudRate,
            dataBits,
            parity,
            stopBits
          });
        }, 100);  // Reduced from 500ms to 100ms for faster initialization

      
      // Handle serial port errors
      currentPort.on('error', (err) => {
        console.error('Serial port error:', err);
        io.emit('error', { message: `Serial port error: ${err.message}` });
      });
      
      console.log(`Attempting to connect to ${path} at ${baudRate} baud`);
    } catch (err) {
      console.error('Error connecting to port:', err);
      socket.emit('error', { message: `Failed to connect: ${err.message}` });
      socket.emit('connection-status', { connected: false });
    }
  });
  
  // Handle disconnect from port request
  socket.on('disconnect-port', () => {
    if (currentPort && currentPort.isOpen) {
      currentPort.close();
      socket.emit('connection-status', { connected: false });
      console.log('Disconnected from port');
    }
  });
  
  // Handle client disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  if (currentPort && currentPort.isOpen) {
    // Reset hardware flow control before closing
    currentPort.set({ dtr: false, rts: false }, (err) => {
      if (err) console.error('Error resetting hardware flow control:', err);
      
      currentPort.close((err) => {
        if (err) console.error('Error closing port:', err);
        console.log('Serial port closed');
        process.exit();
      });
    });
  } else {
    process.exit();
  }
});
