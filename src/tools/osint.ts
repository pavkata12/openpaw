import type { ToolDefinition } from "./types.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * OSINT (Open Source Intelligence) Reconnaissance Tools
 * Gather intelligence before active exploitation
 */

/**
 * WHOIS Lookup
 */
export function createWhoisTool(): ToolDefinition {
  return {
    name: "whois_lookup",
    description: `Perform WHOIS lookup on domain or IP. Returns: registrar info, nameservers, registration/expiration dates, contact information, organization. Use for reconnaissance to understand target infrastructure and ownership.`,
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Domain name or IP address (e.g., 'example.com', '8.8.8.8')"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const target = String(args.target ?? "").trim();
      if (!target) return "Error: target domain or IP required.";
      
      try {
        const { stdout } = await execAsync(`whois "${target}"`, { timeout: 15000 });
        
        let result = `🔍 WHOIS Lookup: ${target}\n`;
        result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        // Parse key information
        const lines = stdout.split('\n');
        const keyFields = ['Registrar:', 'Organization:', 'Name Server:', 'Creation Date:', 'Expir', 'Status:'];
        
        for (const line of lines) {
          if (keyFields.some(field => line.includes(field))) {
            result += `${line.trim()}\n`;
          }
        }
        
        result += `\n📄 Full output:\n${stdout}`;
        
        return result;
      } catch (e) {
        return `WHOIS lookup failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  };
}

/**
 * DNS Enumeration
 */
export function createDNSEnumTool(): ToolDefinition {
  return {
    name: "dns_enum",
    description: `Comprehensive DNS enumeration. Queries: A, AAAA, MX, NS, TXT, CNAME, SOA records. Reveals subdomains, mail servers, nameservers, SPF/DKIM records. Use for reconnaissance and subdomain discovery.`,
    parameters: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "Target domain (e.g., 'example.com')"
        },
        recordTypes: {
          type: "string",
          description: "Comma-separated record types (default: 'A,AAAA,MX,NS,TXT,CNAME,SOA')"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const domain = String(args.domain ?? "").trim();
      const recordTypes = String(args.recordTypes ?? "A,AAAA,MX,NS,TXT,CNAME,SOA").split(",").map(t => t.trim());
      
      if (!domain) return "Error: domain required.";
      
      let result = `🌐 DNS Enumeration: ${domain}\n`;
      result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      for (const recordType of recordTypes) {
        try {
          const { stdout } = await execAsync(`dig ${domain} ${recordType} +short`, { timeout: 10000 });
          if (stdout.trim()) {
            result += `${recordType} Records:\n`;
            const records = stdout.trim().split('\n');
            for (const record of records) {
              result += `  - ${record}\n`;
            }
            result += `\n`;
          }
        } catch {
          // Skip failed queries
        }
      }
      
      result += `💡 Next steps:\n`;
      result += `- Subdomain enumeration: gobuster mode="dns" target="${domain}"\n`;
      result += `- Port scan discovered IPs: nmap_scan\n`;
      result += `- Check MX records for mail server vulnerabilities`;
      
      return result;
    },
  };
}

/**
 * Subdomain Finder (using crt.sh Certificate Transparency)
 */
export function createSubdomainFinderTool(): ToolDefinition {
  return {
    name: "find_subdomains",
    description: `Discover subdomains using Certificate Transparency logs (crt.sh). Passive reconnaissance - doesn't touch target. Returns all subdomains found in SSL/TLS certificates. Much faster than brute-forcing. Use before active scanning.`,
    parameters: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "Target domain (e.g., 'example.com')"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const domain = String(args.domain ?? "").trim();
      if (!domain) return "Error: domain required.";
      
      try {
        // Query crt.sh for certificate transparency logs
        const url = `https://crt.sh/?q=%.${domain}&output=json`;
        const { stdout } = await execAsync(`curl -s "${url}"`, { timeout: 30000 });
        
        const certs = JSON.parse(stdout);
        const subdomains = new Set<string>();
        
        for (const cert of certs) {
          const names = cert.name_value.split('\n');
          for (const name of names) {
            if (name.endsWith(`.${domain}`) || name === domain) {
              subdomains.add(name.replace(/^\*\./, ''));
            }
          }
        }
        
        const uniqueSubdomains = Array.from(subdomains).sort();
        
        let result = `🔍 Subdomain Discovery: ${domain}\n`;
        result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        result += `Found ${uniqueSubdomains.length} subdomain(s):\n\n`;
        
        for (const subdomain of uniqueSubdomains.slice(0, 100)) {
          result += `- ${subdomain}\n`;
        }
        
        if (uniqueSubdomains.length > 100) {
          result += `\n... and ${uniqueSubdomains.length - 100} more\n`;
        }
        
        result += `\n💡 Next steps:\n`;
        result += `- Scan each subdomain with Nuclei or Nmap\n`;
        result += `- Check for takeover opportunities\n`;
        result += `- Test each subdomain for vulnerabilities`;
        
        return result;
      } catch (e) {
        return `Subdomain discovery failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  };
}

/**
 * Email harvester
 */
export function createEmailHarvesterTool(): ToolDefinition {
  return {
    name: "harvest_emails",
    description: `Harvest email addresses from domain using search engines and OSINT sources. Finds employee emails useful for social engineering, password attacks, or spear phishing simulations. ETHICAL USE ONLY.`,
    parameters: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "Target domain (e.g., 'example.com')"
        },
        limit: {
          type: "number",
          description: "Maximum emails to find (default: 50)"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const domain = String(args.domain ?? "").trim();
      const limit = Number(args.limit ?? 50);
      
      if (!domain) return "Error: domain required.";
      
      // Note: This is a simplified version. For production, use tools like theHarvester
      let result = `📧 Email Harvester: ${domain}\n`;
      result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      result += `⚠️  For comprehensive email harvesting, install theHarvester:\n`;
      result += `sudo apt install theharvester -y\n\n`;
      result += `Then run:\n`;
      result += `theHarvester -d ${domain} -l ${limit} -b all\n\n`;
      
      result += `This tool searches:\n`;
      result += `- Google\n`;
      result += `- Bing\n`;
      result += `- LinkedIn\n`;
      result += `- Twitter\n`;
      result += `- Hunter.io\n`;
      result += `- And more sources\n\n`;
      
      result += `⚠️  ETHICAL USE ONLY: Only harvest emails for authorized security testing!`;
      
      return result;
    },
  };
}

/**
 * Technology stack detection
 */
export function createTechDetectionTool(): ToolDefinition {
  return {
    name: "detect_tech",
    description: `Detect web technologies used by target. Identifies: CMS (WordPress, Drupal), frameworks (React, Angular), servers (Apache, Nginx), programming languages, analytics. Use to tailor attacks to specific technologies.`,
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Target URL (e.g., 'https://example.com')"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const url = String(args.url ?? "").trim();
      if (!url) return "Error: URL required.";
      
      try {
        // Fetch headers and HTML
        const { stdout: headers } = await execAsync(`curl -sI "${url}"`, { timeout: 10000 });
        const { stdout: html } = await execAsync(`curl -s "${url}" | head -n 100`, { timeout: 10000 });
        
        let result = `🔧 Technology Detection: ${url}\n`;
        result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        // Detect server
        const serverMatch = headers.match(/Server: (.+)/i);
        if (serverMatch) {
          result += `Web Server: ${serverMatch[1]}\n`;
        }
        
        // Detect CMS
        if (html.includes('wp-content') || html.includes('wordpress')) {
          result += `CMS: WordPress ✅ (use wpscan)\n`;
        } else if (html.includes('drupal')) {
          result += `CMS: Drupal\n`;
        } else if (html.includes('joomla')) {
          result += `CMS: Joomla\n`;
        }
        
        // Detect frameworks
        if (html.includes('react')) {
          result += `Frontend: React\n`;
        } else if (html.includes('angular')) {
          result += `Frontend: Angular\n`;
        } else if (html.includes('vue')) {
          result += `Frontend: Vue.js\n`;
        }
        
        // Detect analytics
        if (html.includes('google-analytics') || html.includes('gtag')) {
          result += `Analytics: Google Analytics\n`;
        }
        
        // Powered-by header
        const poweredByMatch = headers.match(/X-Powered-By: (.+)/i);
        if (poweredByMatch) {
          result += `Powered-By: ${poweredByMatch[1]}\n`;
        }
        
        result += `\n💡 For comprehensive detection, use Wappalyzer or BuiltWith online tools.`;
        
        return result;
      } catch (e) {
        return `Technology detection failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  };
}
