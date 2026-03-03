import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition } from "./types.js";

const execAsync = promisify(exec);

const SCAN_TIMEOUT_MS = 120_000;
const ATTACK_TIMEOUT_MS = 600_000;

export function createWirelessScanTool(): ToolDefinition {
  return {
    name: "wireless_scan",
    description:
      "Scan for nearby Wi-Fi networks. Uses wifite (Kali). Optional interface (default wlan0). Returns list of APs with SSID, BSSID, channel, signal.",
    parameters: {
      type: "object",
      properties: {
        interface: { type: "string", description: "Wireless interface (e.g. wlan0). Optional, default wlan0." },
      },
    },
    async execute(args) {
      const iface = String(args.interface ?? "wlan0").trim() || "wlan0";
      const cmd = `wifite --scan -i ${iface}`;
      try {
        const { stdout, stderr } = await execAsync(cmd, {
          timeout: SCAN_TIMEOUT_MS,
          maxBuffer: 2 * 1024 * 1024,
        });
        const out = [stdout, stderr].filter(Boolean).join("\n").trim();
        return out || "(no output)";
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; message?: string; code?: number };
        if (e.message?.includes("ENOENT") || e.code === 127) {
          return "Error: wifite not found. Install it (e.g. apt install wifite on Kali).";
        }
        const out = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n").trim();
        return `wireless_scan failed:\n${out}`;
      }
    },
  };
}

type AttackType = "wpa" | "wep" | "wps";

export function createWirelessAttackTool(): ToolDefinition {
  return {
    name: "wireless_attack",
    description:
      "Run a wireless attack with wifite (Kali). attackType: wpa, wep, or wps. Optional: interface (wlan0), wordlist path for WPA, bssid for target AP. Long-running; may run several minutes.",
    parameters: {
      type: "object",
      properties: {
        interface: { type: "string", description: "Wireless interface (default wlan0)" },
        attackType: { type: "string", description: "wpa, wep, or wps" },
        wordlist: { type: "string", description: "Path to wordlist for WPA (optional)" },
        bssid: { type: "string", description: "Target BSSID (optional)" },
      },
    },
    async execute(args) {
      const iface = String(args.interface ?? "wlan0").trim() || "wlan0";
      const attackType = (String(args.attackType ?? "wpa").trim().toLowerCase() || "wpa") as AttackType;
      if (!["wpa", "wep", "wps"].includes(attackType)) {
        return "Error: attackType must be wpa, wep, or wps.";
      }
      const parts = ["wifite", "-i", iface];
      if (attackType === "wpa") parts.push("--wpa");
      else if (attackType === "wep") parts.push("--wep");
      else if (attackType === "wps") parts.push("--wps");
      const wordlist = String(args.wordlist ?? "").trim();
      if (wordlist) parts.push("--dict", wordlist);
      const bssid = String(args.bssid ?? "").trim();
      if (bssid) parts.push("--bssid", bssid);
      const cmd = parts.join(" ");
      try {
        const { stdout, stderr } = await execAsync(cmd, {
          timeout: ATTACK_TIMEOUT_MS,
          maxBuffer: 4 * 1024 * 1024,
        });
        const out = [stdout, stderr].filter(Boolean).join("\n").trim();
        return out || "(no output)";
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; message?: string; code?: number };
        if (e.message?.includes("ENOENT") || e.code === 127) {
          return "Error: wifite not found. Install it (e.g. apt install wifite on Kali).";
        }
        const out = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n").trim();
        return `wireless_attack failed:\n${out}`;
      }
    },
  };
}
