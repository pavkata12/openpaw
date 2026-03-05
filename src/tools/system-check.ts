import type { ToolDefinition } from "./types.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Tool Installation Checker and System Readiness
 * Verifies all pentesting tools are installed and properly configured
 */

interface ToolStatus {
  name: string;
  installed: boolean;
  version?: string;
  installCommand: string;
}

const REQUIRED_TOOLS = [
  { name: "nuclei", check: "nuclei -version", install: "sudo apt install nuclei -y" },
  { name: "gobuster", check: "gobuster version", install: "sudo apt install gobuster -y" },
  { name: "ffuf", check: "ffuf -V", install: "sudo apt install ffuf -y" },
  { name: "sqlmap", check: "sqlmap --version", install: "sudo apt install sqlmap -y" },
  { name: "wpscan", check: "wpscan --version", install: "sudo apt install wpscan -y" },
  { name: "nmap", check: "nmap --version", install: "sudo apt install nmap -y" },
  { name: "nikto", check: "nikto -Version", install: "sudo apt install nikto -y" },
  { name: "hydra", check: "hydra -h", install: "sudo apt install hydra -y" },
  { name: "hashcat", check: "hashcat --version", install: "sudo apt install hashcat -y" },
  { name: "metasploit", check: "msfconsole --version", install: "sudo apt install metasploit-framework -y" },
  { name: "enum4linux", check: "enum4linux -h", install: "sudo apt install enum4linux-ng -y" },
  { name: "searchsploit", check: "searchsploit --help", install: "sudo apt install exploitdb -y" }
];

/**
 * Check if all required tools are installed
 */
export function createToolCheckTool(): ToolDefinition {
  return {
    name: "check_tools",
    description: `Check if all pentesting tools are properly installed. Verifies: Nuclei, Gobuster, ffuf, SQLMap, WPScan, Nmap, Nikto, Hydra, Hashcat, Metasploit, enum4linux, and ExploitDB. Returns installation status and commands to install missing tools. Run before starting penetration tests.`,
    parameters: {
      type: "object",
      properties: {
        fix: {
          type: "boolean",
          description: "Automatically install missing tools (requires sudo). Default: false"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const fix = args.fix === true;
      
      let result = `🔧 Pentesting Tools Status Check\n`;
      result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      const statuses: ToolStatus[] = [];
      let installedCount = 0;
      let missingCount = 0;
      
      // Check each tool
      for (const tool of REQUIRED_TOOLS) {
        try {
          const { stdout } = await execAsync(tool.check, { timeout: 5000 });
          const version = stdout.split('\n')[0].trim();
          statuses.push({
            name: tool.name,
            installed: true,
            version,
            installCommand: tool.install
          });
          installedCount++;
        } catch {
          statuses.push({
            name: tool.name,
            installed: false,
            installCommand: tool.install
          });
          missingCount++;
        }
      }
      
      // Display results
      result += `✅ INSTALLED (${installedCount}/${REQUIRED_TOOLS.length}):\n`;
      for (const status of statuses.filter(s => s.installed)) {
        result += `- ${status.name}: ${status.version?.substring(0, 50) || "OK"}\n`;
      }
      result += `\n`;
      
      if (missingCount > 0) {
        result += `❌ MISSING (${missingCount}):\n`;
        for (const status of statuses.filter(s => !s.installed)) {
          result += `- ${status.name}: ${status.installCommand}\n`;
        }
        result += `\n`;
        
        if (fix) {
          result += `🔄 Installing missing tools...\n\n`;
          
          for (const status of statuses.filter(s => !s.installed)) {
            try {
              result += `Installing ${status.name}...\n`;
              await execAsync(status.installCommand, { timeout: 120000 });
              result += `✅ ${status.name} installed successfully\n`;
            } catch (e) {
              result += `❌ ${status.name} installation failed: ${e instanceof Error ? e.message : String(e)}\n`;
            }
          }
        } else {
          result += `💡 To install all missing tools:\n`;
          result += `sudo apt update && sudo apt install -y ${statuses.filter(s => !s.installed).map(s => s.name).join(" ")}\n\n`;
          result += `Or run: check_tools fix=true (requires sudo)`;
        }
      } else {
        result += `🎉 All tools installed! You're ready for pentesting.\n\n`;
        result += `💡 Keep tools updated:\n`;
        result += `sudo apt update && sudo apt upgrade -y`;
      }
      
      return result;
    },
  };
}

/**
 * Quick system readiness check
 */
export function createSystemReadyTool(): ToolDefinition {
  return {
    name: "system_ready",
    description: `Quick system readiness check for pentesting. Verifies: OS (Kali Linux preferred), required tools, wordlists, network connectivity. Returns go/no-go status. Run before engagements.`,
    parameters: {
      type: "object",
      properties: {},
    },
    async execute() {
      let result = `🚀 System Readiness Check\n`;
      result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      const checks: Array<{ name: string; status: boolean; message: string }> = [];
      
      // Check OS
      try {
        const { stdout } = await execAsync("uname -a");
        const isLinux = stdout.toLowerCase().includes("linux");
        const isKali = stdout.toLowerCase().includes("kali");
        checks.push({
          name: "Operating System",
          status: isLinux,
          message: isKali ? "✅ Kali Linux (optimal)" : isLinux ? "⚠️  Linux (good, Kali recommended)" : "❌ Not Linux"
        });
      } catch {
        checks.push({ name: "Operating System", status: false, message: "❌ Unknown" });
      }
      
      // Check critical tools
      const criticalTools = ["nmap", "nuclei", "sqlmap"];
      let toolsOk = 0;
      for (const tool of criticalTools) {
        try {
          await execAsync(`which ${tool}`, { timeout: 2000 });
          toolsOk++;
        } catch {
          // Tool not found
        }
      }
      checks.push({
        name: "Critical Tools",
        status: toolsOk === criticalTools.length,
        message: toolsOk === criticalTools.length ? `✅ All ${criticalTools.length} available` : `⚠️  ${toolsOk}/${criticalTools.length} available`
      });
      
      // Check wordlists
      try {
        await execAsync("ls /usr/share/wordlists/rockyou.txt", { timeout: 2000 });
        checks.push({ name: "Wordlists", status: true, message: "✅ RockyOU available" });
      } catch {
        checks.push({ name: "Wordlists", status: false, message: "❌ RockyOU not found" });
      }
      
      // Check network
      try {
        await execAsync("ping -c 1 8.8.8.8", { timeout: 5000 });
        checks.push({ name: "Network", status: true, message: "✅ Internet reachable" });
      } catch {
        checks.push({ name: "Network", status: false, message: "❌ No internet" });
      }
      
      // Display results
      for (const check of checks) {
        result += `${check.message}\n`;
      }
      
      const allGood = checks.every(c => c.status);
      const mostlyGood = checks.filter(c => c.status).length >= checks.length * 0.75;
      
      result += `\n`;
      if (allGood) {
        result += `🎯 READY: System is fully configured for pentesting!\n`;
      } else if (mostlyGood) {
        result += `⚠️  MOSTLY READY: Some issues detected but you can proceed.\n`;
        result += `Run check_tools for detailed tool status.`;
      } else {
        result += `❌ NOT READY: Please install required tools.\n`;
        result += `Run check_tools fix=true to auto-install.`;
      }
      
      return result;
    },
  };
}
