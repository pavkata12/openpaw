#!/bin/bash
# Quick Wi-Fi scan. Usage: wifite_quick.sh [interface]
# Copy to OPENPAW_SCRIPTS_DIR and run via: run_script with script=wifite_quick.sh
IFACE="${1:-wlan0}"
wifite -i "$IFACE" --scan 2>&1 | head -80
