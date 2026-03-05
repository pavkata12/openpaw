#!/bin/bash

# OpenPaw - Automatic Installation Script for Linux/Kali
# This script installs ALL dependencies and sets up OpenPaw

set -e  # Exit on any error

echo "🐾 OpenPaw Installation Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_status() {
    echo -e "${BLUE}[*]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if running as root (we need sudo for apt)
if [ "$EUID" -eq 0 ]; then 
    print_error "Don't run this script as root! Use regular user (script will ask for sudo when needed)"
    exit 1
fi

# 1. Update system
print_status "Updating system packages..."
sudo apt update -qq
print_success "System updated"

# 2. Check Node.js version
print_status "Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_warning "Node.js version is too old ($NODE_VERSION). Installing Node.js 20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
        print_success "Node.js 20 installed"
    else
        print_success "Node.js $(node -v) is already installed"
    fi
else
    print_warning "Node.js not found. Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    print_success "Node.js 20 installed"
fi

# 3. Check and install Computer Use API dependencies (REQUIRED)
print_status "Checking Computer Use API dependencies..."

REQUIRED_DEPS=(
    "xdotool"
    "scrot"
    "imagemagick"
)

MISSING_DEPS=()

for dep in "${REQUIRED_DEPS[@]}"; do
    if ! command -v ${dep} &> /dev/null && ! dpkg -l | grep -q "^ii.*${dep}"; then
        MISSING_DEPS+=("${dep}")
    fi
done

if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    print_warning "Missing required dependencies: ${MISSING_DEPS[*]}"
    print_status "Installing missing dependencies..."
    for dep in "${MISSING_DEPS[@]}"; do
        print_status "Installing ${dep}..."
        sudo apt install -y "${dep}" || {
            print_error "Failed to install ${dep}!"
            print_error "Computer Use API will not work without: xdotool, scrot, imagemagick"
            exit 1
        }
    done
    print_success "All Computer Use dependencies installed"
else
    print_success "All Computer Use dependencies already installed (xdotool, scrot, imagemagick)"
fi

# Verify installation
print_status "Verifying Computer Use API tools..."
if command -v xdotool &> /dev/null && command -v scrot &> /dev/null && command -v convert &> /dev/null; then
    print_success "✓ xdotool: $(xdotool --version 2>&1 | head -n1)"
    print_success "✓ scrot: installed"
    print_success "✓ imagemagick: $(convert --version | head -n1 | awk '{print $3}')"
else
    print_error "Computer Use API dependencies verification failed!"
    exit 1
fi

# 4. Install pentesting tools (optional but recommended for Kali)
print_status "Checking pentesting tools..."

TOOLS=(
    "nmap"
    "nuclei" 
    "gobuster"
    "ffuf"
    "sqlmap"
    "wpscan"
    "hydra"
    "hashcat"
    "enum4linux-ng"
    "metasploit-framework"
    "whois"
    "dnsutils"
)

MISSING_TOOLS=()

for tool in "${TOOLS[@]}"; do
    if ! command -v ${tool} &> /dev/null && ! dpkg -l | grep -q "^ii.*${tool}"; then
        MISSING_TOOLS+=("${tool}")
    fi
done

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
    print_warning "Missing pentesting tools: ${MISSING_TOOLS[*]}"
    read -p "Install missing pentesting tools? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Installing pentesting tools..."
        for tool in "${MISSING_TOOLS[@]}"; do
            print_status "Installing ${tool}..."
            sudo apt install -y "${tool}" > /dev/null 2>&1 || print_warning "Could not install ${tool} (might need manual installation)"
        done
        print_success "Pentesting tools installed"
    fi
else
    print_success "All pentesting tools already installed"
fi

# 5. Install npm dependencies
print_status "Installing npm packages..."
npm install
print_success "npm packages installed"

# 6. Build TypeScript
print_status "Building TypeScript..."
npm run build
print_success "TypeScript compiled"

# 7. Setup .env file
if [ ! -f ".env" ]; then
    print_status "Creating .env file..."
    cp .env.example .env
    print_success ".env file created"
    print_warning "⚠️  IMPORTANT: Edit .env and add your API key!"
    print_warning "   Run: nano .env"
else
    print_success ".env file already exists"
fi

# 8. Download LinPEAS/WinPEAS if not present
print_status "Checking privilege escalation scripts..."
mkdir -p .openpaw/scripts

if [ ! -f ".openpaw/scripts/linpeas.sh" ]; then
    print_status "Downloading LinPEAS..."
    curl -sL https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh -o .openpaw/scripts/linpeas.sh
    chmod +x .openpaw/scripts/linpeas.sh
    print_success "LinPEAS downloaded"
else
    print_success "LinPEAS already present"
fi

if [ ! -f ".openpaw/scripts/winPEASx64.exe" ]; then
    print_status "Downloading WinPEAS (x64)..."
    curl -sL https://github.com/carlospolop/PEASS-ng/releases/latest/download/winPEASx64.exe -o .openpaw/scripts/winPEASx64.exe
    print_success "WinPEAS downloaded"
else
    print_success "WinPEAS already present"
fi

# 9. Create data directory
print_status "Creating data directory..."
mkdir -p .openpaw/{sessions,checkpoints,screenshots,reports,workflows,scripts}
print_success "Data directories created"

# 10. Test installation
print_status "Testing installation..."
if [ -f "dist/cli.js" ]; then
    print_success "Build successful - dist/cli.js found"
else
    print_error "Build failed - dist/cli.js not found"
    exit 1
fi

# Final system check
print_status "Running final system check..."
CHECKS_PASSED=0
CHECKS_TOTAL=6

# Check Node.js
if command -v node &> /dev/null; then
    ((CHECKS_PASSED++))
fi

# Check Computer Use dependencies
if command -v xdotool &> /dev/null; then
    ((CHECKS_PASSED++))
fi
if command -v scrot &> /dev/null; then
    ((CHECKS_PASSED++))
fi
if command -v convert &> /dev/null; then
    ((CHECKS_PASSED++))
fi

# Check build output
if [ -f "dist/cli.js" ]; then
    ((CHECKS_PASSED++))
fi

# Check .env
if [ -f ".env" ]; then
    ((CHECKS_PASSED++))
fi

if [ $CHECKS_PASSED -eq $CHECKS_TOTAL ]; then
    print_success "All system checks passed ($CHECKS_PASSED/$CHECKS_TOTAL)"
else
    print_warning "System checks: $CHECKS_PASSED/$CHECKS_TOTAL passed"
fi

# Print success message
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ OpenPaw installed successfully!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Edit .env file and add your API key:"
echo -e "   ${BLUE}nano .env${NC}"
echo ""
echo "2. Start OpenPaw:"
echo -e "   ${BLUE}npm start${NC}"
echo ""
echo "3. Or start the web gateway:"
echo -e "   ${BLUE}npm run dashboard${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🐾 OpenPaw is ready! You now have:"
echo "   • 48 Professional Tools"
echo "   • Computer Use API (screen/mouse/keyboard)"
echo "   • 13 Pentesting Tools"
echo "   • AI Exploit Suggestions"
echo "   • Professional Report Generation"
echo "   • OSINT Tools"
echo ""
echo "📚 Documentation:"
echo "   • BEATS-OPENCLAW.md - Full feature comparison"
echo "   • PENTESTING-TOOLS-COMPLETE.md - Pentesting guide"
echo "   • COMPLETE-SYSTEM.md - System overview"
echo ""
print_success "Happy hacking! 🚀"
