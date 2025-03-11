const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Route for the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route to get default settings
app.get('/default-settings', (req, res) => {
  res.json({
    defaultPort: 'usbserial-141101',
    defaultBaudRate: 115200,
    defaultDataBits: 8,
    defaultParity: 'none',
    defaultStopBits: 1,
    timeStampFormat: 'Time+Millis'
  });
});

// List available ports for the frontend to use
app.get('/ports', async (req, res) => {
  try {
    const ports = await SerialPort.list();
    
    // Filter for FTDI devices and add more info
    const enhancedPorts = ports.map(port => {
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
    
    console.log('Available ports:', enhancedPorts);
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
    socket.emit('ports', ports);
  }).catch(err => {
    console.error('Error listing ports:', err);
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
      
        // Add a small delay before setting up data handler to allow device to initialize
        setTimeout(() => {
          console.log('Setting up data handler...');
          
          // For raw data mode, use a simpler approach without the ReadlineParser
          // This will capture all data exactly as it comes in
          currentPort.on('data', (buffer) => {
            // Convert buffer to string - use 'binary' encoding to preserve all bytes
            const data = buffer.toString('binary');
            console.log('Received data:', data);
            
            // Send the data to all connected clients
            io.emit('serial-data', { timestamp: new Date().toISOString(), data });
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
        }, 500);

      
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
