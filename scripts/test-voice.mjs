#!/usr/bin/env node
/**
 * Quick test for the voice pipeline. Run with the server up: npm run voice (or gateway).
 * Usage: node scripts/test-voice.mjs [baseUrl]
 */

import http from "node:http";

const base = process.argv[2] || "http://localhost:3780";

async function post(url, body, headers = {}) {
  const u = new URL(url);
  const opts = {
    hostname: u.hostname,
    port: u.port || (u.protocol === "https:" ? 443 : 80),
    path: u.pathname,
    method: "POST",
    headers: { ...headers },
  };
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log("Testing voice pipeline at", base, "\n");

  // 1. Chat
  try {
    const chatRes = await post(
      base + "/api/chat",
      JSON.stringify({ text: "Say hello in one word.", sessionId: "test-voice" }),
      { "Content-Type": "application/json" }
    );
    console.log("POST /api/chat →", chatRes.status);
    if (chatRes.status === 200) {
      const j = JSON.parse(chatRes.data);
      console.log("  Reply:", (j.reply || "").slice(0, 80) + (j.reply?.length > 80 ? "…" : ""));
    } else {
      console.log("  Body:", chatRes.data.slice(0, 200));
    }
  } catch (e) {
    console.log("POST /api/chat failed:", e.message);
  }

  // 2. Transcribe (minimal multipart – expect 400 "Recording too short" if route exists)
  const boundary = "----test-boundary";
  const body =
    "--" +
    boundary +
    "\r\nContent-Disposition: form-data; name=\"audio\"; filename=\"x.webm\"\r\nContent-Type: audio/webm\r\n\r\n\x00\x00\r\n--" +
    boundary +
    "--\r\n";
  try {
    const trRes = await post(base + "/api/voice/transcribe", body, {
      "Content-Type": "multipart/form-data; boundary=" + boundary,
      "Content-Length": Buffer.byteLength(body),
    });
    console.log("\nPOST /api/voice/transcribe →", trRes.status);
    if (trRes.status === 404) {
      console.log("  Route not found. Start the app with: npm run voice  (not just dashboard)");
    } else {
      try {
        const j = JSON.parse(trRes.data || "{}");
        console.log("  Response:", j.error || j.text || trRes.data?.slice(0, 120));
      } catch {
        console.log("  Body:", trRes.data?.slice(0, 200));
      }
    }
  } catch (e) {
    console.log("\nPOST /api/voice/transcribe failed:", e.message);
    console.log("  Is the server running on", base, "?");
  }

  console.log("\nDone. Open", base + "/voice", "in the browser to use the mic.");
}

main();
