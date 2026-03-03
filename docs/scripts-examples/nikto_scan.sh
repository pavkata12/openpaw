#!/bin/bash
# Nikto web scan. Usage: nikto_scan.sh <url>
# Copy to OPENPAW_SCRIPTS_DIR and run via: run_script with script=nikto_scan.sh, args="http://192.168.1.10"
nikto -h "${1:?Provide URL (e.g. http://target)}"
