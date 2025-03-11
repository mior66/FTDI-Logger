# FTDI Serial Logger

A web application that listens to FTDI chips on USB ports and displays the logging in a real-time web interface. This tool is designed to capture and display serial data from FTDI devices in a user-friendly web interface, similar to CoolTerm but with web-based accessibility.

## Features

- Automatically detects and lists available serial ports
- Intelligently identifies and highlights FTDI devices in the port selection dropdown
- Fully configurable serial connection settings:
  - Baud rate (default: 115200)
  - Data bits (default: 8)
  - Parity (default: None)
  - Stop bits (default: 1)
- Real-time log display with customizable timestamps
- Auto-scroll option for continuous monitoring
- Save logs to a text file
- Clear log functionality
- Responsive design for desktop and mobile devices
- Proper handling of special characters and control codes

## Technical Details

- **Backend**: Node.js with Express
- **Frontend**: Vanilla JavaScript, HTML5, and CSS3
- **Real-time Communication**: Socket.io
- **Serial Communication**: Node SerialPort library
- **Data Handling**: Raw data mode with binary encoding to preserve all characters

## Requirements

- Node.js (v14 or higher)
- NPM (v6 or higher)
- FTDI device connected via USB

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/ftdi-logger.git
   cd ftdi-logger
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Start the server:
   ```bash
   node server.js
   ```
   or
   ```bash
   npm start
   ```

2. Open your web browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Select your FTDI device from the dropdown menu
4. Configure the connection settings to match your device requirements
5. Click "Connect" to start receiving data
6. The log window will display incoming data in real-time

## Configuration

The application uses the following default settings:
- Port: First available FTDI device
- Baud Rate: 115200
- Data Bits: 8
- Parity: None
- Stop Bits: 1

These settings match common configurations for FTDI devices but can be adjusted through the UI as needed.

## Troubleshooting

- **No ports listed**: Make sure your FTDI device is properly connected and recognized by your operating system
- **Connection fails**: Check that another application isn't already using the port
- **No data displayed**: Verify that your device is sending data and that the baud rate matches
- **Garbled text**: Try different baud rate settings or check your device documentation

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
- Try different baud rates if you're not seeing any data
- On macOS, you may need to install FTDI drivers if they're not already installed
- On Linux, you may need to add your user to the `dialout` group to access serial ports

## License

MIT
