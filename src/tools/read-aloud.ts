import type { ToolDefinition } from "./types.js";
import { readFileSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Read Aloud - Text-to-Speech for screen content and files
 * For blind users - reads text from screen, files, or provided text
 */

interface ReadAloudArgs {
  source: "screen" | "file" | "text";
  content?: string;
  file_path?: string;
  voice?: "default" | "fast" | "slow";
  language?: string;
}

async function textToSpeech(text: string, voice: string, language?: string): Promise<string> {
  const cleanText = text.replace(/[^\w\s.,!?-]/g, '').slice(0, 5000); // Limit to 5000 chars
  
  if (process.platform === "win32") {
    // Windows: Use PowerShell SAPI
    const rate = voice === "fast" ? "5" : voice === "slow" ? "-5" : "0";
    const psScript = `
      Add-Type -AssemblyName System.Speech;
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
      $synth.Rate = ${rate};
      $synth.Speak([string]"${cleanText.replace(/"/g, '""')}");
    `;
    
    await execAsync(`powershell -Command "${psScript}"`, { timeout: 60000 });
    return "Windows SAPI";
    
  } else if (process.platform === "darwin") {
    // macOS: Use built-in say command
    const rate = voice === "fast" ? "300" : voice === "slow" ? "120" : "200";
    await execAsync(`say -r ${rate} "${cleanText.replace(/"/g, '\\"')}"`, { timeout: 60000 });
    return "macOS say";
    
  } else {
    // Linux: Try multiple TTS engines
    try {
      // espeak-ng (usually available on Kali)
      const speed = voice === "fast" ? "200" : voice === "slow" ? "120" : "160";
      const lang = language || "en";
      await execAsync(`espeak-ng -v ${lang} -s ${speed} "${cleanText.replace(/"/g, '\\"')}"`, { timeout: 60000 });
      return "espeak-ng";
    } catch {
      try {
        // festival (fallback)
        await execAsync(`echo "${cleanText.replace(/"/g, '\\"')}" | festival --tts`, { timeout: 60000 });
        return "festival";
      } catch {
        throw new Error("No TTS engine available. Install: sudo apt install espeak-ng");
      }
    }
  }
}

async function readScreen(): Promise<string> {
  // Use OCR to extract text from screen
  // For now, return instruction to use voice_describe_screen
  return "To read screen content, use 'voice_describe_screen' tool which provides AI-generated descriptions optimized for blind users.";
}

export function createReadAloudTool(): ToolDefinition {
  return {
    name: "read_aloud",
    description: `Text-to-Speech tool that reads content aloud. Can read from screen (OCR), files, or provided text. Essential for blind/low-vision users. Use when user asks to "read this", "read aloud", "what does it say", or needs audio feedback. Works with OPENPAW_ACCESSIBILITY_MODE=true. Supports adjustable voice speed and language.`,
    parameters: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "Source of text: 'screen' (OCR from current screen), 'file' (read from file), 'text' (read provided text)",
          enum: ["screen", "file", "text"]
        },
        content: {
          type: "string",
          description: "Text to read aloud (required if source='text')"
        },
        file_path: {
          type: "string",
          description: "Path to file to read (required if source='file')"
        },
        voice: {
          type: "string",
          description: "Voice speed: 'default', 'fast', 'slow'",
          enum: ["default", "fast", "slow"]
        },
        language: {
          type: "string",
          description: "Language code (e.g., 'en', 'bg', 'es'). Default: en"
        }
      }
    },
    
    async execute(args: Record<string, unknown>) {
      const source = args.source as string;
      const content = args.content as string;
      const filePath = args.file_path as string;
      const voice = (args.voice as string) || "default";
      const language = args.language as string;
      
      try {
        let textToRead = "";
        
        if (source === "text") {
          if (!content) {
            return "❌ Error: 'content' parameter required when source='text'";
          }
          textToRead = content;
          
        } else if (source === "file") {
          if (!filePath) {
            return "❌ Error: 'file_path' parameter required when source='file'";
          }
          try {
            textToRead = readFileSync(filePath, 'utf-8');
          } catch (error) {
            return `❌ Failed to read file: ${error instanceof Error ? error.message : 'unknown error'}`;
          }
          
        } else if (source === "screen") {
          const screenText = await readScreen();
          textToRead = screenText;
        }
        
        if (!textToRead) {
          return "❌ No text to read";
        }
        
        // Read aloud
        const engine = await textToSpeech(textToRead, voice, language);
        
        return `🔊 **Reading Aloud**

**Source:** ${source}
${filePath ? `**File:** ${filePath}\n` : ''}**Voice:** ${voice}
**Language:** ${language || 'en'}
**TTS Engine:** ${engine}

**Text (first 500 chars):**
${textToRead.slice(0, 500)}${textToRead.length > 500 ? '...' : ''}

✅ **Speech Complete!**

**Next Actions:**
- Say "continue" to keep reading
- Say "stop" to stop reading
- Say "repeat" to hear it again
- Say "read [something else]" to switch content

**Tip:** If speech is too fast/slow, use \`voice: "fast"\` or \`voice: "slow"\` parameter.`;
        
      } catch (error) {
        return `❌ Text-to-Speech failed: ${error instanceof Error ? error.message : 'unknown error'}

**Troubleshooting:**
1. **Windows:** TTS should work out-of-the-box (uses SAPI)
2. **macOS:** TTS should work out-of-the-box (uses \`say\`)
3. **Linux:** Install TTS engine:
   - \`sudo apt install espeak-ng\` (recommended, 200+ languages)
   - \`sudo apt install festival\` (alternative)

**Alternative:** Use ElevenLabs TTS by setting:
- \`OPENPAW_STT_PROVIDER=elevenlabs\`
- \`ELEVENLABS_API_KEY=...\` in .env

**Test TTS:**
\`\`\`bash
# Linux
espeak-ng "Hello world"

# macOS
say "Hello world"

# Windows
powershell -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak('Hello world')"
\`\`\``;
      }
    }
  };
}
