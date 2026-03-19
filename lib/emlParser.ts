import { simpleParser, ParsedMail } from "mailparser";

export interface ParsedEmail {
  html: string;
  text: string;
  subject?: string;
  from?: unknown;
  date?: Date;
}

/**
 * Parse an .eml file and extract HTML and text content.
 */
export async function parseEML(
  emlContent: Buffer | string
): Promise<ParsedEmail> {
  const parsed: ParsedMail = await simpleParser(
    typeof emlContent === "string" ? Buffer.from(emlContent, "utf-8") : emlContent
  );
  const rawHtml = parsed.html ?? "";
  const rawText = parsed.text ?? "";
  const html = typeof rawHtml === "string" ? rawHtml : Array.isArray(rawHtml) ? (rawHtml as string[]).join("") : "";
  const text = typeof rawText === "string" ? rawText : Array.isArray(rawText) ? (rawText as string[]).join("") : "";
  return {
    html,
    text,
    subject: parsed.subject ?? undefined,
    from: parsed.from,
    date: parsed.date ?? undefined,
  };
}
