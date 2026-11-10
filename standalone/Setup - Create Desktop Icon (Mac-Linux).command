#!/bin/bash
# Creates a launcher icon (Linux) or opens the simulator (macOS).
DIR="$(cd "$(dirname "$0")" && pwd)"; APP="$DIR/ORVIBO Smart Home Simulator.html"
if [ "$(uname)" = "Darwin" ]; then ln -sf "$APP" "$HOME/Desktop/ORVIBO Smart Home Simulator.html"; open "$APP"; exit 0; fi
D="$HOME/Desktop/orvibo-simulator.desktop"
printf '[Desktop Entry]\nType=Application\nName=ORVIBO Smart Home Simulator\nExec=xdg-open "%s"\nIcon=%s\nTerminal=false\n' "$APP" "$DIR/icon.png" > "$D"
chmod +x "$D"; xdg-open "$APP"
