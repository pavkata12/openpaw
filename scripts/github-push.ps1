# Refresh PATH so gh is found (e.g. after winget install GitHub.cli in another terminal)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

Set-Location $PSScriptRoot\..

# Create public repo and push (requires: gh auth login once)
gh repo create openpaw --public --source=. --remote=origin --push --description "Self-hosted AI assistant - voice, tools, shell, multi-channel"
