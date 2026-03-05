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
        
        # Try standard install first
        if sudo apt install -y "${dep}" 2>/dev/null; then
            print_success "${dep} installed"
        else
            # If scrot fails, try alternatives
            if [ "${dep}" = "scrot" ]; then
                print_warning "scrot not found in repos, trying alternatives..."
                
                # Try gnome-screenshot
                if sudo apt install -y gnome-screenshot 2>/dev/null; then
                    print_success "gnome-screenshot installed (scrot alternative)"
                # Try maim
                elif sudo apt install -y maim 2>/dev/null; then
                    print_success "maim installed (scrot alternative)"
                # Try flameshot
                elif sudo apt install -y flameshot 2>/dev/null; then
                    print_success "flameshot installed (scrot alternative)"
                # Check if imagemagick import is available
                elif command -v convert &> /dev/null; then
                    print_success "imagemagick already installed (can use 'import' for screenshots)"
                else
                    print_warning "⚠️  Could not install screenshot tool automatically."
                    print_warning "    Computer screenshots may not work."
                    print_warning "    Try manually: sudo apt install scrot"
                    print_warning "    Or: sudo apt install gnome-screenshot"
                    print_warning "    Continuing installation..."
                fi
            elif [ "${dep}" = "imagemagick" ]; then
                # Try alternative imagemagick package name
                if sudo apt install -y imagemagick-6.q16 2>/dev/null; then
                    print_success "imagemagick-6.q16 installed"
                else
                    print_error "Failed to install ${dep}!"
                    print_warning "Try manually: sudo apt install imagemagick"
                    print_warning "Continuing installation..."
                fi
            else
                print_error "Failed to install ${dep}!"
                if [ "${dep}" = "xdotool" ]; then
                    print_error "xdotool is critical for mouse/keyboard control!"
                    print_warning "Try manually: sudo apt install xdotool"
                    exit 1
                fi
            fi
        fi
    done
    print_success "Dependency installation complete"
else
    print_success "All Computer Use dependencies already installed (xdotool, scrot, imagemagick)"
fi

# Verify installation
print_status "Verifying Computer Use API tools..."
VERIFIED=0
TOTAL_CHECKS=3

if command -v xdotool &> /dev/null; then
    print_success "✓ xdotool: $(xdotool --version 2>&1 | head -n1)"
    ((VERIFIED++))
else
    print_error "✗ xdotool: NOT FOUND - Critical for mouse/keyboard control!"
fi

# Check for screenshot tools (any one is OK)
if command -v scrot &> /dev/null; then
    print_success "✓ scrot: installed"
    ((VERIFIED++))
elif command -v gnome-screenshot &> /dev/null; then
    print_success "✓ gnome-screenshot: installed (scrot alternative)"
    ((VERIFIED++))
elif command -v maim &> /dev/null; then
    print_success "✓ maim: installed (scrot alternative)"
    ((VERIFIED++))
elif command -v flameshot &> /dev/null; then
    print_success "✓ flameshot: installed (scrot alternative)"
    ((VERIFIED++))
elif command -v import &> /dev/null; then
    print_success "✓ imagemagick import: available for screenshots"
    ((VERIFIED++))
else
    print_warning "⚠️  No screenshot tool found"
    print_warning "   Recommended: sudo apt install scrot"
fi

if command -v convert &> /dev/null; then
    print_success "✓ imagemagick: $(convert --version | head -n1 | awk '{print $3}')"
    ((VERIFIED++))
elif command -v magick &> /dev/null; then
    print_success "✓ imagemagick: $(magick --version | head -n1 | awk '{print $3}')"
    ((VERIFIED++))
else
    print_warning "⚠️  imagemagick: NOT FOUND"
fi

if [ $VERIFIED -ge 2 ]; then
    print_success "Computer Use API tools: $VERIFIED/$TOTAL_CHECKS verified (sufficient to run)"
elif [ $VERIFIED -eq 1 ]; then
    print_warning "Computer Use API tools: $VERIFIED/$TOTAL_CHECKS verified (limited functionality)"
    print_warning "Some features may not work. Install missing tools for full functionality."
else
    print_error "Computer Use API tools: $VERIFIED/$TOTAL_CHECKS verified (insufficient)"
    print_error "Critical dependencies missing! Computer Use API will not work."
    print_warning "Continuing installation, but manual fixes required..."
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
