import { Router, type Request, type Response } from "express";
import { z } from "zod";

export const contactRouter = Router();

const CONTACT_TO_EMAIL = "info@tebnu.com";
const RESEND_API_URL = "https://api.resend.com/emails";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(60).optional().nullable(),
  topic: z.string().trim().min(1).max(80),
  topicLabel: z.string().trim().min(1).max(120),
  message: z.string().trim().min(15).max(5000),
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function contactFromEmail(): string {
  const configured = process.env.CONTACT_FROM_EMAIL?.trim();
  return configured || "Tebnu Contact <info@tebnu.com>";
}

async function sendContactEmail(input: z.infer<typeof contactSchema>) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

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

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: contactFromEmail(),
      to: [CONTACT_TO_EMAIL],
      reply_to: input.email,
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    let detail = `Resend returned HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      detail = body.message || body.error || detail;
    } catch {
      /* keep default detail */
    }
    throw new Error(detail);
  }
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

    await sendContactEmail(parsed.data);
    res.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to send contact message";
    console.error("[Contact] send failed:", err);
    res.status(message.includes("RESEND_API_KEY") ? 503 : 500).json({
      error:
        message.includes("RESEND_API_KEY")
          ? "Contact email is not configured yet."
          : "Could not send your message. Please try again later.",
    });
  }
});
