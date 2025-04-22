#!/bin/bash

# Change to the application directory
cd "$(dirname "$0")"

# Check if Node.js is installed - using multiple detection methods
NODE_FOUND=false

# Method 1: Check using 'command -v'
if command -v node &> /dev/null; then
    NODE_FOUND=true
fi

# Method 2: Check using 'which'
if ! $NODE_FOUND && which node &> /dev/null; then
    NODE_FOUND=true
fi

# Method 3: Check specific locations where Node.js might be installed
if ! $NODE_FOUND && [ -x "/usr/local/bin/node" ]; then
    NODE_FOUND=true
fi

if ! $NODE_FOUND && [ -x "/usr/bin/node" ]; then
    NODE_FOUND=true
fi

if ! $NODE_FOUND && [ -x "/opt/homebrew/bin/node" ]; then
    NODE_FOUND=true
fi

# If Node.js is not found, display error message and exit
if ! $NODE_FOUND; then
    osascript -e 'display dialog "Node.js is not installed. Please install Node.js to run FTDI Logger." buttons {"OK"} default button "OK" with icon stop with title "FTDI Logger Error"'
    exit 1
fi

# Start the server in the background
node server.js &
SERVER_PID=$!

# Wait for the server to start (3 seconds)
sleep 3

# Open the application in the default browser
open http://localhost:3000

# Create a function to handle script termination
cleanup() {
    echo "Shutting down FTDI Logger server..."
    kill $SERVER_PID
    exit 0
}

# Register the cleanup function for when the script is terminated
trap cleanup INT TERM

# Keep the script running to maintain the server
echo "FTDI Logger is running. Press Ctrl+C to stop."
wait $SERVER_PID
