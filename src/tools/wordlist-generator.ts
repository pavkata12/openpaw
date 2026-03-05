import type { ToolDefinition } from "./types.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Smart Custom Wordlist Generator
 * Creates target-specific wordlists for brute-forcing and fuzzing
 */

/**
 * Generate custom wordlist based on target information
 */
export function createWordlistGeneratorTool(): ToolDefinition {
  return {
    name: "generate_wordlist",
    description: `Generate custom wordlist tailored to target. Creates wordlist from: company name, domain, common patterns, years, tech stack keywords. Much more effective than generic wordlists for targeted attacks. Use before Gobuster, Hydra, or ffuf.`,
    parameters: {
      type: "object",
      properties: {
        companyName: {
          type: "string",
          description: "Company/organization name (e.g., 'Acme Corp')"
        },
        domain: {
          type: "string",
          description: "Domain name (e.g., 'acme.com')"
        },
        keywords: {
          type: "string",
          description: "Comma-separated keywords (products, technologies, locations). E.g., 'api,cloud,mobile,admin'"
        },
        includeYears: {
          type: "boolean",
          description: "Include years (2020-2026) and common year patterns. Default: true"
        },
        includeSpecialChars: {
          type: "boolean",
          description: "Add variations with special characters (!@#$). Default: true"
        },
        includeNumbers: {
          type: "boolean",
          description: "Add common number patterns (123, 2024, etc.). Default: true"
        },
        caseVariations: {
          type: "boolean",
          description: "Generate case variations (admin, Admin, ADMIN). Default: true"
        },
        outputFile: {
          type: "string",
          description: "Output filename (default: custom-wordlist.txt)"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const companyName = String(args.companyName ?? "").trim();
      const domain = String(args.domain ?? "").trim();
      const keywords = String(args.keywords ?? "").trim().split(",").map(k => k.trim()).filter(Boolean);
      const includeYears = args.includeYears !== false;
      const includeSpecialChars = args.includeSpecialChars !== false;
      const includeNumbers = args.includeNumbers !== false;
      const caseVariations = args.caseVariations !== false;
      const outputFile = String(args.outputFile ?? "custom-wordlist.txt").trim();
      
      if (!companyName && !domain && keywords.length === 0) {
        return "Error: Provide at least companyName, domain, or keywords.";
      }
      
      const wordlist = new Set<string>();
      
      // Base words
      const baseWords: string[] = [];
      
      if (companyName) {
        baseWords.push(companyName.toLowerCase().replace(/\s+/g, ""));
        baseWords.push(companyName.toLowerCase().replace(/\s+/g, "-"));
        baseWords.push(companyName.toLowerCase().replace(/\s+/g, "_"));
        const parts = companyName.split(/\s+/);
        baseWords.push(...parts.map(p => p.toLowerCase()));
      }
      
      if (domain) {
        const domainParts = domain.replace(/\.(com|net|org|io|co)$/i, "").split(".");
        baseWords.push(...domainParts);
      }
      
      baseWords.push(...keywords);
      
      // Common patterns
      const commonPatterns = [
        "admin", "administrator", "root", "user", "test", "demo", "dev", "prod",
        "staging", "backup", "temp", "tmp", "api", "portal", "dashboard",
        "login", "auth", "panel", "cpanel", "manager", "console", "config",
        "db", "database", "sql", "mysql", "postgres", "mongo",
        "old", "new", "beta", "v1", "v2", "archive", "static", "assets",
        "upload", "uploads", "files", "documents", "images", "media",
        "private", "internal", "confidential", "secret", "hidden"
      ];
      
      baseWords.push(...commonPatterns);
      
      // Generate variations
      for (const word of baseWords) {
        if (!word) continue;
        
        // Original
        wordlist.add(word);
        
        // Case variations
        if (caseVariations) {
          wordlist.add(word.toLowerCase());
          wordlist.add(word.toUpperCase());
          wordlist.add(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
        }
        
        // With numbers
        if (includeNumbers) {
          for (const num of ["1", "123", "2024", "2025", "2026", "01", "001"]) {
            wordlist.add(`${word}${num}`);
            wordlist.add(`${num}${word}`);
            wordlist.add(`${word}_${num}`);
            wordlist.add(`${word}-${num}`);
          }
        }
        
        // With years
        if (includeYears) {
          for (let year = 2020; year <= 2026; year++) {
            wordlist.add(`${word}${year}`);
            wordlist.add(`${word}_${year}`);
            wordlist.add(`${word}-${year}`);
          }
        }
        
        // With special characters
        if (includeSpecialChars) {
          for (const char of ["!", "@", "#", "$", "_", "-"]) {
            wordlist.add(`${word}${char}`);
            wordlist.add(`${char}${word}`);
          }
        }
        
        // Combinations
        for (const other of baseWords.slice(0, 10)) {
          if (other && other !== word) {
            wordlist.add(`${word}${other}`);
            wordlist.add(`${word}_${other}`);
            wordlist.add(`${word}-${other}`);
          }
        }
      }
      
      // Convert to array and sort
      const finalWordlist = Array.from(wordlist).sort();
      
      // Save to file
      const wordlistDir = join(process.cwd(), ".openpaw", "wordlists");
      mkdirSync(wordlistDir, { recursive: true });
      const outputPath = join(wordlistDir, outputFile);
      
      writeFileSync(outputPath, finalWordlist.join("\n"));
      
      let result = `📝 Custom Wordlist Generated\n`;
      result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      result += `Output: ${outputPath}\n`;
      result += `Total words: ${finalWordlist.length}\n\n`;
      
      result += `Base keywords: ${baseWords.slice(0, 10).join(", ")}${baseWords.length > 10 ? "..." : ""}\n\n`;
      
      result += `Sample entries:\n`;
      for (const word of finalWordlist.slice(0, 20)) {
        result += `- ${word}\n`;
      }
      if (finalWordlist.length > 20) {
        result += `... and ${finalWordlist.length - 20} more\n`;
      }
      
      result += `\n💡 Use with:\n`;
      result += `- Gobuster: gobuster mode="dir" target="<url>" wordlist="${outputPath}"\n`;
      result += `- ffuf: ffuf url="<url>/FUZZ" wordlist="${outputPath}"\n`;
      result += `- Hydra: hydra -L "${outputPath}" -p password <target> ssh`;
      
      return result;
    },
  };
}

/**
 * Generate password mutations
 */
export function createPasswordMutatorTool(): ToolDefinition {
  return {
    name: "mutate_passwords",
    description: `Generate password mutations from base words. Creates variations with: leet speak (a->@, e->3), capitalization patterns, common suffixes (!@#, 123), year patterns. Use to create targeted password lists for brute-forcing when you have user information.`,
    parameters: {
      type: "object",
      properties: {
        baseWords: {
          type: "string",
          description: "Comma-separated base words (names, company, keywords). E.g., 'john,acme,admin'"
        },
        includeL33t: {
          type: "boolean",
          description: "Include leet speak variations (a->@, e->3, i->1, o->0, s->$). Default: true"
        },
        includeSuffixes: {
          type: "boolean",
          description: "Add common suffixes (!, @, 123, 2024, etc.). Default: true"
        },
        maxLength: {
          type: "number",
          description: "Maximum password length (default: 20)"
        },
        outputFile: {
          type: "string",
          description: "Output filename (default: password-mutations.txt)"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const baseWords = String(args.baseWords ?? "").trim().split(",").map(w => w.trim()).filter(Boolean);
      const includeL33t = args.includeL33t !== false;
      const includeSuffixes = args.includeSuffixes !== false;
      const maxLength = Number(args.maxLength ?? 20);
      const outputFile = String(args.outputFile ?? "password-mutations.txt").trim();
      
      if (baseWords.length === 0) {
        return "Error: baseWords required (comma-separated).";
      }
      
      const passwords = new Set<string>();
      
      // Leet speak mapping
      const leetMap: Record<string, string[]> = {
        'a': ['@', '4'],
        'e': ['3'],
        'i': ['1', '!'],
        'o': ['0'],
        's': ['$', '5'],
        't': ['7'],
        'l': ['1'],
        'g': ['9']
      };
      
      function generateLeetVariations(word: string): string[] {
        const variations = [word];
        
        for (let i = 0; i < word.length; i++) {
          const char = word[i].toLowerCase();
          if (leetMap[char]) {
            const newVariations: string[] = [];
            for (const variation of variations) {
              for (const replacement of leetMap[char]) {
                const newVar = variation.substring(0, i) + replacement + variation.substring(i + 1);
                if (newVar.length <= maxLength) {
                  newVariations.push(newVar);
                }
              }
            }
            variations.push(...newVariations);
          }
        }
        
        return variations.slice(0, 50); // Limit variations per word
      }
      
      // Common suffixes
      const suffixes = includeSuffixes ? [
        "", "!", "!!", "@", "#", "$", "123", "1234", "12345",
        "2024", "2025", "2026", "!@#", "!2024", "@123"
      ] : [""];
      
      // Generate mutations
      for (const word of baseWords) {
        if (!word) continue;
        
        // Case variations
        const caseVariations = [
          word.toLowerCase(),
          word.toUpperCase(),
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          word.toLowerCase().split('').map((c, i) => i % 2 === 0 ? c.toUpperCase() : c).join('')
        ];
        
        for (const caseVar of caseVariations) {
          // L33t speak
          const leetVariations = includeL33t ? generateLeetVariations(caseVar) : [caseVar];
          
          for (const leetVar of leetVariations) {
            // Add suffixes
            for (const suffix of suffixes) {
              const password = leetVar + suffix;
              if (password.length >= 4 && password.length <= maxLength) {
                passwords.add(password);
              }
            }
          }
        }
      }
      
      // Sort by length then alphabetically (common password patterns)
      const finalPasswords = Array.from(passwords).sort((a, b) => {
        if (a.length !== b.length) return a.length - b.length;
        return a.localeCompare(b);
      });
      
      // Save to file
      const wordlistDir = join(process.cwd(), ".openpaw", "wordlists");
      mkdirSync(wordlistDir, { recursive: true });
      const outputPath = join(wordlistDir, outputFile);
      
      writeFileSync(outputPath, finalPasswords.join("\n"));
      
      let result = `🔐 Password Mutations Generated\n`;
      result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      result += `Output: ${outputPath}\n`;
      result += `Total passwords: ${finalPasswords.length}\n\n`;
      
      result += `Sample passwords:\n`;
      for (const pwd of finalPasswords.slice(0, 20)) {
        result += `- ${pwd}\n`;
      }
      if (finalPasswords.length > 20) {
        result += `... and ${finalPasswords.length - 20} more\n`;
      }
      
      result += `\n💡 Use with Hydra:\n`;
      result += `hydra -l admin -P "${outputPath}" <target> ssh\n\n`;
      
      result += `⚠️  WARNING: Use only on systems you have authorization to test!`;
      
      return result;
    },
  };
}
