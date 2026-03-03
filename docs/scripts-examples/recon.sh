#!/bin/bash
# Quick recon: nmap -sV -T4 on target. Usage: recon.sh [target]
# Copy to OPENPAW_SCRIPTS_DIR (e.g. .openpaw/scripts) and run via: run_script with script=recon.sh, args="192.168.1.0/24"
TARGET="${1:-192.168.1.0/24}"
nmap -sV -T4 --open "$TARGET"
