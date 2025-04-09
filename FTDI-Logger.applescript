-- FTDI Logger Launcher
-- This script launches the FTDI Logger application

-- Get the path to the FTDI Logger directory
set ftdiLoggerPath to "/Users/adam/CascadeProjects/FTDI-Logger"

-- Display a notification that the app is starting
display notification "Starting FTDI Logger..." with title "FTDI Logger"

-- Use the full path to Node.js from nvm
set nodePath to "/Users/adam/.nvm/versions/node/v16.15.0/bin/node"

-- Run the application
tell application "Terminal"
    -- Open a new terminal window and source nvm before running node
    do script "cd \"" & ftdiLoggerPath & "\" && \"" & nodePath & "\" server.js"
    -- Set the title of the terminal window
    set custom title of front window to "FTDI Logger Server"
end tell

-- Wait a moment for the server to start
delay 3

-- Open the application in the default browser
do shell script "open http://localhost:3000"
