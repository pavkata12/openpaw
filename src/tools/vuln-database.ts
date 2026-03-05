import type { ToolDefinition } from "./types.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * CVE and Vulnerability Database Integration
 * Access NVD, ExploitDB, and other vulnerability databases
 */

interface CVEInfo {
  id: string;
  description: string;
  cvss: number;
  severity: string;
  published: string;
  references: string[];
  affectedProducts: string[];
}

/**
 * Query CVE details from NVD
 */
export function createCVELookupTool(): ToolDefinition {
  return {
    name: "cve_lookup",
    description: `Look up detailed information about a CVE (Common Vulnerabilities and Exposures). Returns: description, CVSS score, severity, affected products, references, and available exploits. Use to understand vulnerability impact and exploitation paths.`,
    parameters: {
      type: "object",
      properties: {
        cve: {
          type: "string",
          description: "CVE ID (e.g., 'CVE-2024-1234', 'CVE-2017-0144')"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const cve = String(args.cve ?? "").trim().toUpperCase();
      
      if (!cve || !cve.match(/CVE-\d{4}-\d+/)) {
        return "Error: Valid CVE ID required (format: CVE-YYYY-NNNNN)";
      }
      
      try {
        // Use curl to query NVD API (no API key needed for basic lookups)
        const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cve}`;
        const cmd = `curl -s "${url}"`;
        
        const { stdout } = await execAsync(cmd, { timeout: 15000 });
        const data = JSON.parse(stdout);
        
        if (!data.vulnerabilities || data.vulnerabilities.length === 0) {
          return `CVE ${cve} not found in NVD database.\n\nVerify CVE ID is correct or try:\n- ExploitDB: https://www.exploit-db.com/search?cve=${cve}\n- Google: "${cve} vulnerability"`;
        }
        
        const vuln = data.vulnerabilities[0].cve;
        
        // Extract CVSS score
        let cvssScore = "N/A";
        let severity = "N/A";
        
        if (vuln.metrics?.cvssMetricV31?.[0]) {
          const cvss = vuln.metrics.cvssMetricV31[0].cvssData;
          cvssScore = cvss.baseScore.toString();
          severity = cvss.baseSeverity;
        } else if (vuln.metrics?.cvssMetricV2?.[0]) {
          const cvss = vuln.metrics.cvssMetricV2[0].cvssData;
          cvssScore = cvss.baseScore.toString();
          severity = cvss.baseSeverity || "MEDIUM";
        }
        
        // Extract description
        const description = vuln.descriptions.find((d: any) => d.lang === "en")?.value || "No description available";
        
        // Extract references
        const references = vuln.references?.slice(0, 5).map((r: any) => r.url) || [];
        
        // Extract affected products
        const affectedProducts: string[] = [];
        if (vuln.configurations) {
          for (const config of vuln.configurations) {
            for (const node of config.nodes || []) {
              for (const match of node.cpeMatch || []) {
                if (match.criteria) {
                  const parts = match.criteria.split(":");
                  if (parts.length >= 5) {
                    affectedProducts.push(`${parts[3]} ${parts[4]} ${parts[5]}`);
                  }
                }
              }
            }
          }
        }
        
        let result = `🔍 CVE Information: ${cve}\n`;
        result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        result += `📊 CVSS Score: ${cvssScore} (${severity})\n\n`;
        
        result += `📝 Description:\n${description}\n\n`;
        
        if (affectedProducts.length > 0) {
          result += `🎯 Affected Products:\n`;
          for (const product of affectedProducts.slice(0, 10)) {
            result += `- ${product}\n`;
          }
          if (affectedProducts.length > 10) {
            result += `... and ${affectedProducts.length - 10} more\n`;
          }
          result += `\n`;
        }
        
        if (references.length > 0) {
          result += `📚 References:\n`;
          for (const ref of references) {
            result += `- ${ref}\n`;
          }
          result += `\n`;
        }
        
        result += `🔗 More Info:\n`;
        result += `- NVD: https://nvd.nist.gov/vuln/detail/${cve}\n`;
        result += `- ExploitDB: https://www.exploit-db.com/search?cve=${cve}\n`;
        result += `- Metasploit: Use metasploit_search query="${cve}"\n\n`;
        
        result += `💡 Next Steps:\n`;
        result += `1. Search for exploits: metasploit_search query="${cve}"\n`;
        result += `2. Get exploitation guidance: suggest_exploit vulnerability="${cve}"\n`;
        result += `3. Check if your target is affected`;
        
        return result;
      } catch (e) {
        return `Error querying NVD: ${e instanceof Error ? e.message : String(e)}\n\nFallback: https://nvd.nist.gov/vuln/detail/${cve}`;
      }
    },
  };
}

/**
 * Search ExploitDB
 */
export function createExploitDBSearchTool(): ToolDefinition {
  return {
    name: "exploitdb_search",
    description: `Search Exploit-DB for public exploits. Search by CVE, software name, or keyword. Returns available exploits with EDB-ID, title, and direct download links. Use to find ready-to-use exploit code.`,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query: CVE ID, software name, or keyword (e.g., 'CVE-2024-1234', 'Apache Struts', 'WordPress')"
        },
        type: {
          type: "string",
          description: "Exploit type filter: 'remote', 'local', 'webapps', 'dos', or 'all' (default)"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const query = String(args.query ?? "").trim();
      const type = String(args.type ?? "all").toLowerCase();
      
      if (!query) return "Error: search query is required.";
      
      try {
        // Check if searchsploit is installed (part of exploitdb package)
        try {
          await execAsync("searchsploit --help");
        } catch {
          return `Error: searchsploit not installed. Install it:\n\nsudo apt install exploitdb -y\n\nOr search online: https://www.exploit-db.com/search?q=${encodeURIComponent(query)}`;
        }
        
        let cmd = `searchsploit "${query}"`;
        
        if (type !== "all") {
          cmd += ` --${type}`;
        }
        
        cmd += ` --json`;
        
        const { stdout } = await execAsync(cmd, { timeout: 30000 });
        
        let result = `🔍 Exploit-DB Search Results\n`;
        result += `Query: ${query}\n`;
        result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        try {
          const data = JSON.parse(stdout);
          const exploits = data.RESULTS_EXPLOIT || [];
          
          if (exploits.length === 0) {
            result += `No exploits found for: ${query}\n\n`;
            result += `Try:\n`;
            result += `- Broader search terms\n`;
            result += `- Check CVE on NVD: cve_lookup cve="${query}"\n`;
            result += `- Search Metasploit: metasploit_search query="${query}"`;
            return result;
          }
          
          result += `Found ${exploits.length} exploit(s):\n\n`;
          
          for (let i = 0; i < Math.min(exploits.length, 20); i++) {
            const exploit = exploits[i];
            result += `${i + 1}. [EDB-${exploit.EDB_ID}] ${exploit.Title}\n`;
            result += `   Platform: ${exploit.Platform || "N/A"} | Type: ${exploit.Type || "N/A"}\n`;
            result += `   Path: ${exploit.Path}\n`;
            result += `   URL: https://www.exploit-db.com/exploits/${exploit.EDB_ID}\n\n`;
          }
          
          if (exploits.length > 20) {
            result += `... and ${exploits.length - 20} more exploits\n\n`;
          }
          
          result += `💡 To view exploit code:\n`;
          result += `searchsploit -x <EDB-ID>\n`;
          result += `Or download: https://www.exploit-db.com/exploits/<EDB-ID>`;
          
          return result;
        } catch {
          // Fallback: parse text output
          const lines = stdout.split('\n').filter(l => l.includes('|'));
          if (lines.length > 0) {
            result += stdout;
          } else {
            result += `No exploits found for: ${query}`;
          }
          return result;
        }
      } catch (e) {
        return `ExploitDB search failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  };
}

/**
 * CVSS Calculator
 */
export function createCVSSCalculatorTool(): ToolDefinition {
  return {
    name: "calculate_cvss",
    description: `Calculate CVSS (Common Vulnerability Scoring System) score for a vulnerability. Input attack vector, complexity, privileges required, user interaction, scope, and impact metrics. Returns numeric score (0-10) and severity rating. Use for risk assessment and reporting.`,
    parameters: {
      type: "object",
      properties: {
        attackVector: {
          type: "string",
          description: "Attack Vector: 'network', 'adjacent', 'local', 'physical'"
        },
        attackComplexity: {
          type: "string",
          description: "Attack Complexity: 'low', 'high'"
        },
        privilegesRequired: {
          type: "string",
          description: "Privileges Required: 'none', 'low', 'high'"
        },
        userInteraction: {
          type: "string",
          description: "User Interaction: 'none', 'required'"
        },
        scope: {
          type: "string",
          description: "Scope: 'unchanged', 'changed'"
        },
        confidentiality: {
          type: "string",
          description: "Confidentiality Impact: 'none', 'low', 'high'"
        },
        integrity: {
          type: "string",
          description: "Integrity Impact: 'none', 'low', 'high'"
        },
        availability: {
          type: "string",
          description: "Availability Impact: 'none', 'low', 'high'"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      // Simplified CVSS 3.1 calculation
      const av = String(args.attackVector ?? "network").toLowerCase();
      const ac = String(args.attackComplexity ?? "low").toLowerCase();
      const pr = String(args.privilegesRequired ?? "none").toLowerCase();
      const ui = String(args.userInteraction ?? "none").toLowerCase();
      const s = String(args.scope ?? "unchanged").toLowerCase();
      const c = String(args.confidentiality ?? "high").toLowerCase();
      const i = String(args.integrity ?? "high").toLowerCase();
      const a = String(args.availability ?? "high").toLowerCase();
      
      // CVSS 3.1 metric values
      const avValues: Record<string, number> = { network: 0.85, adjacent: 0.62, local: 0.55, physical: 0.2 };
      const acValues: Record<string, number> = { low: 0.77, high: 0.44 };
      const prValues: Record<string, Record<string, number>> = {
        unchanged: { none: 0.85, low: 0.62, high: 0.27 },
        changed: { none: 0.85, low: 0.68, high: 0.5 }
      };
      const uiValues: Record<string, number> = { none: 0.85, required: 0.62 };
      const impactValues: Record<string, number> = { none: 0, low: 0.22, high: 0.56 };
      
      const avScore = avValues[av] || 0.85;
      const acScore = acValues[ac] || 0.77;
      const prScore = prValues[s]?.[pr] || 0.85;
      const uiScore = uiValues[ui] || 0.85;
      const cScore = impactValues[c] || 0.56;
      const iScore = impactValues[i] || 0.56;
      const aScore = impactValues[a] || 0.56;
      
      // Calculate ISS (Impact Sub-Score)
      const iss = 1 - ((1 - cScore) * (1 - iScore) * (1 - aScore));
      
      // Calculate Impact
      const impact = s === "changed" ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
                                    : 6.42 * iss;
      
      // Calculate Exploitability
      const exploitability = 8.22 * avScore * acScore * prScore * uiScore;
      
      // Calculate Base Score
      let baseScore = 0;
      if (impact <= 0) {
        baseScore = 0;
      } else if (s === "unchanged") {
        baseScore = Math.min(impact + exploitability, 10);
      } else {
        baseScore = Math.min(1.08 * (impact + exploitability), 10);
      }
      
      baseScore = Math.round(baseScore * 10) / 10;
      
      // Determine severity
      let severity = "NONE";
      if (baseScore === 0) severity = "NONE";
      else if (baseScore < 4.0) severity = "LOW";
      else if (baseScore < 7.0) severity = "MEDIUM";
      else if (baseScore < 9.0) severity = "HIGH";
      else severity = "CRITICAL";
      
      let result = `📊 CVSS 3.1 Score Calculation\n`;
      result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      result += `🎯 BASE SCORE: ${baseScore} (${severity})\n\n`;
      
      result += `Attack Vector: ${av.toUpperCase()}\n`;
      result += `Attack Complexity: ${ac.toUpperCase()}\n`;
      result += `Privileges Required: ${pr.toUpperCase()}\n`;
      result += `User Interaction: ${ui.toUpperCase()}\n`;
      result += `Scope: ${s.toUpperCase()}\n`;
      result += `Confidentiality: ${c.toUpperCase()}\n`;
      result += `Integrity: ${i.toUpperCase()}\n`;
      result += `Availability: ${a.toUpperCase()}\n\n`;
      
      result += `Vector String: CVSS:3.1/AV:${av[0].toUpperCase()}/AC:${ac[0].toUpperCase()}/PR:${pr[0].toUpperCase()}/UI:${ui[0].toUpperCase()}/S:${s[0].toUpperCase()}/C:${c[0].toUpperCase()}/I:${i[0].toUpperCase()}/A:${a[0].toUpperCase()}\n\n`;
      
      result += `Use this score in penetration test reports to quantify risk.`;
      
      return result;
    },
  };
}
