#!/bin/bash

# OpenPaw - Automatic Installation Script for macOS
# This script installs ALL dependencies and sets up OpenPaw

set -e  # Exit on any error

echo "🐾 OpenPaw Installation Script for macOS"
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

# 1. Check Homebrew
print_status "Checking Homebrew..."
if ! command -v brew &> /dev/null; then
    print_warning "Homebrew not found. Installing..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    print_success "Homebrew installed"
else
    print_success "Homebrew is installed"
fi

# 2. Check Node.js version
print_status "Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_warning "Node.js version is too old ($NODE_VERSION). Installing Node.js 20..."
        brew install node@20
        brew link node@20
        print_success "Node.js 20 installed"
    else
        print_success "Node.js $(node -v) is already installed"
    fi
else
    print_warning "Node.js not found. Installing Node.js 20..."
    brew install node@20
    print_success "Node.js 20 installed"
fi

# 3. Install Computer Use API dependencies
print_status "Installing Computer Use API dependencies..."
if ! command -v cliclick &> /dev/null; then
    brew install cliclick
    print_success "cliclick installed"
else
    print_success "cliclick already installed"
fi

# 4. Install pentesting tools (optional)
print_status "Checking pentesting tools..."

TOOLS=("nmap" "gobuster" "ffuf" "sqlmap" "hydra" "hashcat")
MISSING_TOOLS=()

for tool in "${TOOLS[@]}"; do
    if ! command -v ${tool} &> /dev/null; then
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
            brew install "${tool}" || print_warning "Could not install ${tool}"
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

# 8. Create data directory
print_status "Creating data directories..."
mkdir -p .openpaw/{sessions,checkpoints,screenshots,reports,workflows}
print_success "Data directories created"

# 9. Test installation
print_status "Testing installation..."
if [ -f "dist/cli.js" ]; then
    print_success "Build successful - dist/cli.js found"
else
    print_error "Build failed - dist/cli.js not found"
    exit 1
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
