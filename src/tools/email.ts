import type { ToolDefinition } from "./types.js";
import type { Config } from "../config.js";

function getEmailConfig(config: Config) {
  const host = config.OPENPAW_EMAIL_HOST;
  const user = config.OPENPAW_EMAIL_USER;
  const pass = config.OPENPAW_EMAIL_PASS;
  if (!host || !user) return null;
  return {
    host,
    port: config.OPENPAW_EMAIL_PORT ?? 993,
    user,
    pass: pass ?? "",
    secure: config.OPENPAW_EMAIL_SECURE ?? true,
  };
}

export function createEmailSearchTool(config: Config): ToolDefinition | null {
  const cfg = getEmailConfig(config);
  if (!cfg) return null;

  return {
    name: "email_search",
    description: "Search inbox for emails. Options: unread only, limit number of results, or since date (YYYY-MM-DD).",
    parameters: {
      type: "object",
      properties: {
        unreadOnly: { type: "boolean", description: "If true, only return unread emails" },
        limit: { type: "number", description: "Max number of emails to return (default 10)" },
        since: { type: "string", description: "Only emails since this date (YYYY-MM-DD)" },
      },
    },
    async execute(args) {
      const unreadOnly = !!args.unreadOnly;
      const limit = Math.min(50, Math.max(1, Number(args.limit) || 10));
      const since = typeof args.since === "string" ? args.since.trim() : undefined;
      const { createRequire } = await import("node:module");
      const require = createRequire(import.meta.url);
      const Imap = require("imap");
      return new Promise((resolve, reject) => {
        const imap = new Imap({
          user: cfg.user,
          password: cfg.pass,
          host: cfg.host,
          port: cfg.port,
          tls: cfg.secure,
          tlsOptions: { rejectUnauthorized: false },
        });
        const results: string[] = [];
        imap.once("ready", () => {
          imap.openBox("INBOX", false, (err: Error | null) => {
            if (err) {
              imap.end();
              return reject(err);
            }
            const searchCriteria: (string | string[])[] = unreadOnly ? ["UNSEEN"] : ["ALL"];
            if (since) searchCriteria.push(["SINCE", since]);
            imap.search(searchCriteria, (searchErr: Error | null, uids: number[]) => {
              if (searchErr || !uids.length) {
                imap.end();
                return resolve(results.length ? results.join("\n---\n") : "No emails found.");
              }
              const toFetch = uids.slice(-limit).reverse();
              const f = imap.fetch(toFetch, { bodies: "HEADER.FIELDS (FROM TO SUBJECT DATE)" });
              f.on("message", (msg: { on: (part: string, cb: (stream: NodeJS.ReadableStream) => void) => void }) => {
                msg.on("body", (stream: NodeJS.ReadableStream) => {
                  let buffer = "";
                  stream.on("data", (chunk: Buffer) => (buffer += chunk.toString()));
                  stream.once("end", () => {
                    const from = buffer.match(/From:\s*(.+?)(?:\r?\n|$)/i)?.[1]?.trim() ?? "";
                    const to = buffer.match(/To:\s*(.+?)(?:\r?\n|$)/i)?.[1]?.trim() ?? "";
                    const subj = buffer.match(/Subject:\s*(.+?)(?:\r?\n|$)/i)?.[1]?.trim() ?? "";
                    const date = buffer.match(/Date:\s*(.+?)(?:\r?\n|$)/i)?.[1]?.trim() ?? "";
                    results.push(`From: ${from}\nTo: ${to}\nSubject: ${subj}\nDate: ${date}`);
                  });
                });
              });
              f.once("error", (e: Error) => {
                imap.end();
                reject(e);
              });
              f.once("end", () => {
                imap.end();
                resolve(results.length ? results.join("\n---\n") : "No emails found.");
              });
            });
          });
        });
        imap.once("error", reject);
        imap.connect();
      });
    },
  };
}

export function createEmailSendTool(config: Config): ToolDefinition | null {
  const cfg = getEmailConfig(config);
  if (!cfg) return null;

  return {
    name: "email_send",
    description: "Send an email. Requires to, subject, and body.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Email body (plain text)" },
      },
    },
    async execute(args) {
      const to = String(args.to ?? "").trim();
      const subject = String(args.subject ?? "").trim();
      const body = String(args.body ?? "").trim();
      if (!to || !subject) return "Error: to and subject are required.";
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.default.createTransport({
        host: cfg.host,
        port: cfg.port === 993 ? 465 : cfg.port || 587,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
      });
      await transport.sendMail({
        from: cfg.user,
        to,
        subject,
        text: body,
      });
      return `Email sent to ${to} with subject "${subject}".`;
    },
  };
}
