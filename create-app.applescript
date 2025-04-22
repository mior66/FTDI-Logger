-- Create an application to launch FTDI Logger
tell application "Finder"
    set desktopPath to POSIX path of (path to desktop folder as text)
    set scriptPath to POSIX path of ((path to me as text) as string)
    set projectPath to do shell script "dirname " & quoted form of scriptPath
end tell

-- Create the application
set appName to "FTDI Logger"

-- Compile the fixed AppleScript into an app
do shell script "osacompile -o '" & desktopPath & appName & ".app' '" & projectPath & "/FTDI-Logger.applescript'"

-- Make the app executable
do shell script "chmod +x '" & desktopPath & appName & ".app/Contents/MacOS/applet'"

-- Create a simple shell script to generate and set the icon
set iconScript to "#!/bin/bash

# Change to the project directory
cd " & quoted form of projectPath & "

# Create temporary directory for icon creation
mkdir -p tmp.iconset

# Convert SVG to PNG at different sizes
for size in 16 32 64 128 256 512; do
  # Use sips (built into macOS)
  sips -s format png -z ${size} ${size} public/app-icon.svg --out tmp.iconset/icon_${size}x${size}.png &>/dev/null || true
  sips -s format png -z $((size*2)) $((size*2)) public/app-icon.svg --out tmp.iconset/icon_${size}x${size}@2x.png &>/dev/null || true
done

# Create icns file
iconutil -c icns tmp.iconset -o /tmp/AppIcon.icns

# Copy to app resources
cp /tmp/AppIcon.icns '" & desktopPath & appName & ".app/Contents/Resources/applet.icns'

# Clean up
rm -rf tmp.iconset
rm -f /tmp/AppIcon.icns
"

-- Create and run the icon script
do shell script "mkdir -p /tmp/ftdi-logger"
do shell script "echo " & quoted form of iconScript & " > /tmp/ftdi-logger/create-icon.sh"
do shell script "chmod +x /tmp/ftdi-logger/create-icon.sh"
do shell script "/tmp/ftdi-logger/create-icon.sh"

-- Clean up
do shell script "rm -rf /tmp/ftdi-logger"

-- Touch the app to update its modification time
do shell script "touch '" & desktopPath & appName & ".app'"

display dialog "FTDI Logger application has been created on your Desktop." buttons {"OK"} default button "OK"
