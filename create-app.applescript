-- Create an application to launch FTDI Logger
tell application "Finder"
    set appPath to POSIX path of ((path to desktop folder as text) & "FTDI Logger.app")
    set scriptPath to POSIX path of ((path to me as text) as string)
    set projectPath to do shell script "dirname " & quoted form of scriptPath
end tell

-- Create the application
set appName to "FTDI Logger"
set iconName to "AppIcon.icns"

-- Create the script to be executed by the app
set appScript to "#!/bin/bash

# Get the directory where this script is located
DIR=\"$( cd \"$( dirname \"${BASH_SOURCE[0]}\" )\" && pwd )\"

# Change to the project directory
cd " & quoted form of projectPath & "

# Run the start script
" & quoted form of projectPath & "/start-ftdi-logger.sh
"

-- Create a temporary script file
do shell script "mkdir -p /tmp/appscript"
do shell script "echo " & quoted form of appScript & " > /tmp/appscript/runscript.sh"
do shell script "chmod +x /tmp/appscript/runscript.sh"

-- Create the application bundle
do shell script "osacompile -o " & quoted form of (POSIX path of ((path to desktop folder as text) & appName & ".app")) & " -e 'do shell script \"/tmp/appscript/runscript.sh\"'"

-- Clean up
do shell script "rm -rf /tmp/appscript"

display dialog "FTDI Logger application has been created on your Desktop." buttons {"OK"} default button "OK"
