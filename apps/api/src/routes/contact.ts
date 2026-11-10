import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../supabase";

export const contactRouter = Router();

const CONTACT_TO_EMAIL = "info@tebnu.com";
const CONTACT_FROM_EMAIL = "Tebnu Contact <info@tebnu.com>";
const RESEND_API_URL = "https://api.resend.com/emails";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(60).optional().nullable(),
  topic: z.string().trim().min(1).max(80),
  topicLabel: z.string().trim().min(1).max(120),
  message: z.string().trim().min(15).max(5000),
});

type ContactInput = z.infer<typeof contactSchema>;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function contactFromEmail(): string {
  const configured = process.env.CONTACT_FROM_EMAIL?.trim().replace(
    /^["']|["']$/g,
    "",
  );
  if (!configured) return CONTACT_FROM_EMAIL;
  const address = configured.match(/<([^>]+)>/)?.[1] ?? configured;
  if (/^[^@\s]+@tebnu\.com$/i.test(address)) return configured;
  return CONTACT_FROM_EMAIL;
}

function emailBody(input: ContactInput): { subject: string; text: string; html: string } {
  const phone = input.phone?.trim();
  const subject = `[Tebnu Contact] ${input.topicLabel}`;
  const text = [
    "New contact form submission",
    "",
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    phone ? `Phone: ${phone}` : null,
    `Topic: ${input.topicLabel} (${input.topic})`,
    "",
    input.message,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.55; color: #111827;">
      <h2 style="margin: 0 0 16px;">New contact form submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
      ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ""}
      <p><strong>Topic:</strong> ${escapeHtml(input.topicLabel)} (${escapeHtml(input.topic)})</p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="white-space: pre-wrap;">${escapeHtml(input.message)}</p>
    </div>
  `;

  return { subject, text, html };
}

async function postResend(
  apiKey: string,
  from: string,
  input: ContactInput,
  includeReplyTo: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { subject, text, html } = emailBody(input);
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [CONTACT_TO_EMAIL],
      ...(includeReplyTo ? { reply_to: input.email } : {}),
      subject,
      text,
      html,
    }),
  });

  if (res.ok) return { ok: true };

  let detail = `Resend returned HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { message?: string; error?: string };
    detail = body.message || body.error || detail;
  } catch {
    /* keep default detail */
  }
  return { ok: false, error: detail };
}

async function sendContactEmail(input: ContactInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const from = contactFromEmail();
  const first = await postResend(apiKey, from, input, true);
  if (first.ok) return;

  const fromWasRejected = /from|domain|verify|reply/i.test(first.error);
  if (!fromWasRejected) throw new Error(first.error);

  // A bad from-address or reply-to is rejected before delivery. Retry once
  // with the verified Tebnu sender and no reply-to.
  const second = await postResend(apiKey, CONTACT_FROM_EMAIL, input, false);
  if (second.ok) return;
  throw new Error(second.error || first.error);
}

function missingContactTable(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (/contact_messages/i.test(message) &&
      /does not exist|schema cache|could not find/i.test(message))
  );
}

/** Service role bypasses RLS, so visitor inserts are not blocked by policies. */
async function saveContactMessage(
  input: ContactInput,
  emailError: string | null,
): Promise<boolean> {
  const { error } = await supabaseAdmin.from("contact_messages").insert({
    name: input.name,
    email: input.email,
    phone: input.phone?.trim() || null,
    topic: input.topic,
    topic_label: input.topicLabel,
    message: input.message,
    email_sent: emailError == null,
    email_error: emailError,
  });

  if (!error) return true;

  if (missingContactTable(error)) {
    console.warn(
      "[Contact] contact_messages is missing. Run db/sql/150_contact_messages.sql.",
    );
  } else {
    console.error("[Contact] save failed:", error.code, error.message);
  }
  return false;
}

contactRouter.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Please check the form and try again.",
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    let emailError: string | null = null;
    try {
      await sendContactEmail(parsed.data);
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Failed to send contact email";
      console.error("[Contact] Resend failed:", emailError);
    }

    const saved = await saveContactMessage(parsed.data, emailError);
    if (emailError && !saved) {
      res.status(emailError.includes("RESEND_API_KEY") ? 503 : 500).json({
        error: emailError.includes("RESEND_API_KEY")
          ? "Contact email is not configured yet."
          : "Could not send your message. Please try again later.",
      });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[Contact] send failed:", err);
    res.status(500).json({
      error: "Could not send your message. Please try again later.",
    });
  }
});
