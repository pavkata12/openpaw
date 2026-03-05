# OpenPaw - Automatic Installation Script for Windows
# Run with: powershell -ExecutionPolicy Bypass -File install-windows.ps1

Write-Host "🐾 OpenPaw Installation Script for Windows" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Function to print colored messages
function Print-Status {
    param([string]$Message)
    Write-Host "[*] $Message" -ForegroundColor Blue
}

function Print-Success {
    param([string]$Message)
    Write-Host "[✓] $Message" -ForegroundColor Green
}

function Print-Error {
    param([string]$Message)
    Write-Host "[✗] $Message" -ForegroundColor Red
}

function Print-Warning {
    param([string]$Message)
    Write-Host "[!] $Message" -ForegroundColor Yellow
}

# 1. Check Node.js
Print-Status "Checking Node.js installation..."
try {
    $nodeVersion = node -v
    if ($nodeVersion -match "v(\d+)") {
        $majorVersion = [int]$matches[1]
        if ($majorVersion -ge 18) {
            Print-Success "Node.js $nodeVersion is installed"
        } else {
            Print-Error "Node.js version is too old ($nodeVersion). Please install Node.js 18+ from https://nodejs.org"
            exit 1
        }
    }
} catch {
    Print-Error "Node.js not found! Please install from https://nodejs.org"
    exit 1
}

# 2. Check npm
Print-Status "Checking npm installation..."
try {
    $npmVersion = npm -v
    Print-Success "npm $npmVersion is installed"
} catch {
    Print-Error "npm not found! Please install Node.js from https://nodejs.org"
    exit 1
}

# 3. Install npm dependencies
Print-Status "Installing npm packages..."
try {
    npm install
    Print-Success "npm packages installed"
} catch {
    Print-Error "npm install failed!"
    exit 1
}

# 4. Build TypeScript
Print-Status "Building TypeScript..."
try {
    npm run build
    Print-Success "TypeScript compiled"
} catch {
    Print-Error "Build failed!"
    exit 1
}

# 5. Setup .env file
if (-not (Test-Path ".env")) {
    Print-Status "Creating .env file..."
    Copy-Item ".env.example" ".env"
    Print-Success ".env file created"
    Print-Warning "⚠️  IMPORTANT: Edit .env and add your API key!"
    Print-Warning "   Use: notepad .env"
} else {
    Print-Success ".env file already exists"
}

# 6. Create data directory
Print-Status "Creating data directories..."
$dirs = @(".openpaw\sessions", ".openpaw\checkpoints", ".openpaw\screenshots", ".openpaw\reports", ".openpaw\workflows")
foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}
Print-Success "Data directories created"

# 7. Test installation
Print-Status "Testing installation..."
if (Test-Path "dist\cli.js") {
    Print-Success "Build successful - dist\cli.js found"
} else {
    Print-Error "Build failed - dist\cli.js not found"
    exit 1
}

# Print success message
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ OpenPaw installed successfully!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Edit .env file and add your API key:" -ForegroundColor White
Write-Host "   notepad .env" -ForegroundColor Blue
Write-Host ""
Write-Host "2. Start OpenPaw:" -ForegroundColor White
Write-Host "   npm start" -ForegroundColor Blue
Write-Host ""
Write-Host "3. Or start the web gateway:" -ForegroundColor White
Write-Host "   npm run dashboard" -ForegroundColor Blue
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "🐾 OpenPaw is ready! You now have:" -ForegroundColor Cyan
Write-Host "   • 48 Professional Tools"
Write-Host "   • Computer Use API (screen/mouse/keyboard)"
Write-Host "   • 13 Pentesting Tools"
Write-Host "   • AI Exploit Suggestions"
Write-Host "   • Professional Report Generation"
Write-Host "   • OSINT Tools"
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   • BEATS-OPENCLAW.md - Full feature comparison"
Write-Host "   • PENTESTING-TOOLS-COMPLETE.md - Pentesting guide"
Write-Host "   • COMPLETE-SYSTEM.md - System overview"
Write-Host ""
Print-Success "Happy hacking! 🚀"

Write-Host ""
Write-Host "Note: Computer Use API on Windows uses built-in PowerShell (no extra install needed!)" -ForegroundColor Yellow
