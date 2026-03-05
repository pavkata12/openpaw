import type { ToolDefinition } from "./types.js";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Professional Penetration Testing Report Generator
 * Compiles scan results into professional PDF/HTML reports
 */

interface Finding {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  cvss?: number;
  cve?: string;
  description: string;
  impact: string;
  affectedAssets: string[];
  proofOfConcept?: string;
  remediation: string;
  references: string[];
  foundBy: string;  // Which tool found it
  timestamp: string;
}

interface ReportMetadata {
  title: string;
  client: string;
  testDate: string;
  tester: string;
  scope: string[];
  methodology: string[];
  executiveSummary?: string;
}

class PentestReport {
  private findings: Finding[] = [];
  private metadata: ReportMetadata;
  private reportDir: string;
  
  constructor(reportName: string, metadata: ReportMetadata) {
    this.metadata = metadata;
    this.reportDir = join(process.cwd(), ".openpaw", "reports", reportName);
    mkdirSync(this.reportDir, { recursive: true });
  }
  
  addFinding(finding: Finding): void {
    this.findings.push(finding);
    this.save();
  }
  
  save(): void {
    const reportFile = join(this.reportDir, "report-data.json");
    writeFileSync(reportFile, JSON.stringify({
      metadata: this.metadata,
      findings: this.findings
    }, null, 2));
  }
  
  load(reportName: string): void {
    const reportFile = join(process.cwd(), ".openpaw", "reports", reportName, "report-data.json");
    if (existsSync(reportFile)) {
      const data = JSON.parse(readFileSync(reportFile, "utf-8"));
      this.metadata = data.metadata;
      this.findings = data.findings;
    }
  }
  
  getSeverityCount(): Record<string, number> {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const finding of this.findings) {
      counts[finding.severity]++;
    }
    return counts;
  }
  
  generateMarkdown(): string {
    let md = `# ${this.metadata.title}\n\n`;
    md += `**Client:** ${this.metadata.client}\n`;
    md += `**Test Date:** ${this.metadata.testDate}\n`;
    md += `**Tester:** ${this.metadata.tester}\n\n`;
    
    md += `## Executive Summary\n\n`;
    md += this.metadata.executiveSummary || "This penetration test was conducted to assess the security posture of the target environment.\n\n";
    
    const counts = this.getSeverityCount();
    md += `### Findings Summary\n\n`;
    md += `- 🔴 **Critical:** ${counts.critical}\n`;
    md += `- 🟠 **High:** ${counts.high}\n`;
    md += `- 🟡 **Medium:** ${counts.medium}\n`;
    md += `- 🔵 **Low:** ${counts.low}\n`;
    md += `- ⚪ **Info:** ${counts.info}\n\n`;
    
    md += `## Scope\n\n`;
    for (const item of this.metadata.scope) {
      md += `- ${item}\n`;
    }
    md += `\n`;
    
    md += `## Methodology\n\n`;
    for (const method of this.metadata.methodology) {
      md += `- ${method}\n`;
    }
    md += `\n`;
    
    md += `## Detailed Findings\n\n`;
    
    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    const sortedFindings = [...this.findings].sort((a, b) => 
      severityOrder[a.severity] - severityOrder[b.severity]
    );
    
    for (let i = 0; i < sortedFindings.length; i++) {
      const finding = sortedFindings[i];
      md += `### ${i + 1}. ${finding.title}\n\n`;
      md += `**Severity:** ${finding.severity.toUpperCase()}`;
      if (finding.cvss) md += ` (CVSS ${finding.cvss})`;
      if (finding.cve) md += ` - ${finding.cve}`;
      md += `\n\n`;
      
      md += `**Affected Assets:**\n`;
      for (const asset of finding.affectedAssets) {
        md += `- ${asset}\n`;
      }
      md += `\n`;
      
      md += `**Description:**\n${finding.description}\n\n`;
      
      md += `**Impact:**\n${finding.impact}\n\n`;
      
      if (finding.proofOfConcept) {
        md += `**Proof of Concept:**\n\`\`\`\n${finding.proofOfConcept}\n\`\`\`\n\n`;
      }
      
      md += `**Remediation:**\n${finding.remediation}\n\n`;
      
      if (finding.references.length > 0) {
        md += `**References:**\n`;
        for (const ref of finding.references) {
          md += `- ${ref}\n`;
        }
        md += `\n`;
      }
      
      md += `---\n\n`;
    }
    
    md += `## Conclusion\n\n`;
    md += `This penetration test identified ${this.findings.length} finding(s). `;
    md += `Immediate attention should be given to ${counts.critical} critical and ${counts.high} high severity issues.\n\n`;
    
    md += `## Appendix\n\n`;
    md += `### Tools Used\n`;
    const tools = new Set(this.findings.map(f => f.foundBy));
    for (const tool of tools) {
      md += `- ${tool}\n`;
    }
    
    return md;
  }
  
  async generateHTML(): Promise<string> {
    const md = this.generateMarkdown();
    
    // Try to convert markdown to HTML (requires pandoc)
    try {
      const mdFile = join(this.reportDir, "report.md");
      writeFileSync(mdFile, md);
      
      const htmlFile = join(this.reportDir, "report.html");
      await execAsync(`pandoc "${mdFile}" -o "${htmlFile}" --standalone --css=style.css`);
      
      return htmlFile;
    } catch {
      // Fallback: basic HTML
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${this.metadata.title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; }
    h1 { color: #333; border-bottom: 3px solid #007acc; }
    h2 { color: #555; margin-top: 30px; }
    h3 { color: #777; }
    .critical { color: #d32f2f; font-weight: bold; }
    .high { color: #f57c00; font-weight: bold; }
    .medium { color: #fbc02d; font-weight: bold; }
    .low { color: #1976d2; }
    .info { color: #757575; }
    pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
    code { background: #e0e0e0; padding: 2px 6px; border-radius: 3px; }
  </style>
</head>
<body>${md.replace(/\n/g, '<br>')}</body>
</html>`;
      
      const htmlFile = join(this.reportDir, "report.html");
      writeFileSync(htmlFile, html);
      return htmlFile;
    }
  }
  
  async generatePDF(): Promise<string> {
    // Requires wkhtmltopdf or pandoc with pdflatex
    try {
      const htmlFile = await this.generateHTML();
      const pdfFile = join(this.reportDir, "report.pdf");
      
      await execAsync(`wkhtmltopdf "${htmlFile}" "${pdfFile}"`);
      return pdfFile;
    } catch {
      return "PDF generation failed. Install wkhtmltopdf: sudo apt install wkhtmltopdf";
    }
  }
}

// Global report registry
const activeReports = new Map<string, PentestReport>();

/**
 * Create new pentest report
 */
export function createNewReportTool(): ToolDefinition {
  return {
    name: "create_report",
    description: `Create a new penetration testing report. Initialize report structure with metadata (client name, test date, scope). Findings will be added incrementally as you discover vulnerabilities.`,
    parameters: {
      type: "object",
      properties: {
        reportName: {
          type: "string",
          description: "Report name/ID (e.g., 'acme-pentest-2026', 'webapp-security-audit')"
        },
        client: {
          type: "string",
          description: "Client/organization name"
        },
        title: {
          type: "string",
          description: "Report title (e.g., 'Web Application Penetration Test')"
        },
        scope: {
          type: "string",
          description: "Comma-separated list of in-scope targets (IPs, domains, networks)"
        },
        tester: {
          type: "string",
          description: "Tester name or team"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const reportName = String(args.reportName ?? "").trim();
      const client = String(args.client ?? "Unknown Client").trim();
      const title = String(args.title ?? "Penetration Test Report").trim();
      const scope = String(args.scope ?? "").trim().split(",").map(s => s.trim()).filter(Boolean);
      const tester = String(args.tester ?? "Security Team").trim();
      
      if (!reportName) return "Error: reportName is required.";
      
      const metadata: ReportMetadata = {
        title,
        client,
        testDate: new Date().toISOString().split('T')[0],
        tester,
        scope: scope.length > 0 ? scope : ["No scope defined"],
        methodology: [
          "Reconnaissance (OSINT, port scanning)",
          "Vulnerability scanning (automated tools)",
          "Manual testing and exploitation",
          "Privilege escalation attempts",
          "Post-exploitation and lateral movement"
        ]
      };
      
      const report = new PentestReport(reportName, metadata);
      activeReports.set(reportName, report);
      
      return `✅ Pentest report created: ${reportName}\n\nClient: ${client}\nScope: ${scope.join(", ")}\n\nUse add_finding to document vulnerabilities as you discover them.\nUse export_report when ready to generate final PDF/HTML.`;
    },
  };
}

/**
 * Add finding to report
 */
export function createAddFindingTool(): ToolDefinition {
  return {
    name: "add_finding",
    description: `Add a vulnerability finding to the active pentest report. Document: title, severity (critical/high/medium/low/info), description, impact, affected assets, proof-of-concept, remediation steps. Used throughout testing to build professional report.`,
    parameters: {
      type: "object",
      properties: {
        reportName: {
          type: "string",
          description: "Report name (from create_report)"
        },
        title: {
          type: "string",
          description: "Finding title (e.g., 'SQL Injection in Login Form')"
        },
        severity: {
          type: "string",
          description: "Severity: critical, high, medium, low, info"
        },
        description: {
          type: "string",
          description: "Detailed description of the vulnerability"
        },
        impact: {
          type: "string",
          description: "Business/technical impact"
        },
        affectedAssets: {
          type: "string",
          description: "Comma-separated list of affected systems/URLs"
        },
        proofOfConcept: {
          type: "string",
          description: "Commands, payloads, or steps to reproduce (optional)"
        },
        remediation: {
          type: "string",
          description: "Recommended fix/mitigation steps"
        },
        cve: {
          type: "string",
          description: "CVE ID if applicable (optional)"
        },
        cvss: {
          type: "number",
          description: "CVSS score (optional)"
        },
        foundBy: {
          type: "string",
          description: "Tool that discovered this (e.g., 'Nuclei', 'SQLMap', 'Manual Testing')"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const reportName = String(args.reportName ?? "").trim();
      const title = String(args.title ?? "").trim();
      const severity = String(args.severity ?? "medium").toLowerCase() as Finding["severity"];
      const description = String(args.description ?? "").trim();
      const impact = String(args.impact ?? "").trim();
      const affectedAssets = String(args.affectedAssets ?? "").trim().split(",").map(s => s.trim()).filter(Boolean);
      const proofOfConcept = args.proofOfConcept ? String(args.proofOfConcept).trim() : undefined;
      const remediation = String(args.remediation ?? "").trim();
      const cve = args.cve ? String(args.cve).trim() : undefined;
      const cvss = args.cvss ? Number(args.cvss) : undefined;
      const foundBy = String(args.foundBy ?? "Manual Testing").trim();
      
      if (!reportName || !title || !description) {
        return "Error: reportName, title, and description are required.";
      }
      
      const report = activeReports.get(reportName);
      if (!report) {
        return `Error: Report '${reportName}' not found. Create it first with create_report.`;
      }
      
      const finding: Finding = {
        id: `FIND-${Date.now()}`,
        title,
        severity,
        cvss,
        cve,
        description,
        impact: impact || "Impact not specified",
        affectedAssets: affectedAssets.length > 0 ? affectedAssets : ["Unknown"],
        proofOfConcept,
        remediation: remediation || "Remediation steps not provided",
        references: cve ? [`https://nvd.nist.gov/vuln/detail/${cve}`] : [],
        foundBy,
        timestamp: new Date().toISOString()
      };
      
      report.addFinding(finding);
      
      const counts = report.getSeverityCount();
      return `✅ Finding added to report: ${reportName}\n\nFinding: ${title}\nSeverity: ${severity.toUpperCase()}\n\nReport status:\n- Critical: ${counts.critical}\n- High: ${counts.high}\n- Medium: ${counts.medium}\n- Low: ${counts.low}\n- Info: ${counts.info}\n\nTotal findings: ${Object.values(counts).reduce((a, b) => a + b, 0)}`;
    },
  };
}

/**
 * Export report to various formats
 */
export function createExportReportTool(): ToolDefinition {
  return {
    name: "export_report",
    description: `Export completed penetration test report to PDF, HTML, or Markdown. Generates professional report with all findings, severity ratings, remediation steps, and executive summary. Use when testing is complete.`,
    parameters: {
      type: "object",
      properties: {
        reportName: {
          type: "string",
          description: "Report name (from create_report)"
        },
        format: {
          type: "string",
          description: "Export format: 'pdf', 'html', 'markdown', or 'all'"
        },
        executiveSummary: {
          type: "string",
          description: "Optional executive summary paragraph (for final export)"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const reportName = String(args.reportName ?? "").trim();
      const format = String(args.format ?? "all").toLowerCase();
      const executiveSummary = args.executiveSummary ? String(args.executiveSummary).trim() : undefined;
      
      if (!reportName) return "Error: reportName is required.";
      
      const report = activeReports.get(reportName);
      if (!report) {
        return `Error: Report '${reportName}' not found.`;
      }
      
      if (executiveSummary) {
        report["metadata"].executiveSummary = executiveSummary;
        report.save();
      }
      
      const reportDir = join(process.cwd(), ".openpaw", "reports", reportName);
      const files: string[] = [];
      
      try {
        if (format === "markdown" || format === "all") {
          const md = report.generateMarkdown();
          const mdFile = join(reportDir, "report.md");
          writeFileSync(mdFile, md);
          files.push(mdFile);
        }
        
        if (format === "html" || format === "all") {
          const htmlFile = await report.generateHTML();
          files.push(htmlFile);
        }
        
        if (format === "pdf" || format === "all") {
          const pdfFile = await report.generatePDF();
          files.push(pdfFile);
        }
        
        return `📄 Report exported successfully!\n\nReport: ${reportName}\nFormats: ${format}\nLocation: ${reportDir}\n\nGenerated files:\n${files.map(f => `- ${f}`).join('\n')}\n\nYou can now share these files with your client or team.`;
      } catch (e) {
        return `Error exporting report: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  };
}

export { PentestReport, activeReports };
