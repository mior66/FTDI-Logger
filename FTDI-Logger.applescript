-- FTDI Logger Launcher
-- This script launches the FTDI Logger application

-- Get the path to the FTDI Logger directory
set ftdiLoggerPath to "/Users/adam/CascadeProjects/FTDI-Logger"

-- Display a notification that the app is starting
display notification "Starting FTDI Logger..." with title "FTDI Logger"

-- Check if the server is already running
set isRunning to false
try
    set checkResult to do shell script "lsof -i :3000 | grep LISTEN"
    if checkResult is not equal to "" then
        set isRunning to true
    end if
on error
    -- Port is not in use, which means server is not running
    set isRunning to false
end try

-- Only start the server if it's not already running
if not isRunning then
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
end if

-- Open the application in the default browser (only once)
do shell script "open http://localhost:3000"
