const nodemailer = require("nodemailer");

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Best-effort E.164 for Twilio: if 10-digit India mobile without country code, prefix +91.
 */
function normalizeSmsTo(raw) {
  const digits = String(raw || "").replace(/\s/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return digits;
  if (/^\d{10}$/.test(digits) && /^[6-9]/.test(digits)) return `+91${digits}`;
  return digits;
}

function getSmtpTransport() {
  const host = (process.env.SMTP_HOST || "").trim();
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: (process.env.SMTP_USER || "").trim() || undefined,
      pass: (process.env.SMTP_PASS || "").trim() || undefined,
    },
  });
}

async function sendBankTracedEmail({ to, subject, text, html }) {
  const transport = getSmtpTransport();
  if (!transport) {
    return { ok: false, skipped: true, reason: "SMTP not configured (set SMTP_HOST, etc.)" };
  }

  const from = (process.env.EMAIL_FROM || process.env.SMTP_USER || "").trim();
  if (!from) {
    return { ok: false, skipped: true, reason: "EMAIL_FROM or SMTP_USER is required" };
  }

  try {
    await transport.sendMail({
      from,
      to,
      subject,
      text,
      html: html || `<pre style="font-family:sans-serif">${text.replace(/</g, "&lt;")}</pre>`,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function sendSmsTwilio({ to, body }) {
  const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const token = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const from = (process.env.TWILIO_SMS_FROM || "").trim();

  if (!sid || !token || !from) {
    return {
      ok: false,
      skipped: true,
      reason: "Twilio not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM)",
    };
  }

  const normalizedTo = normalizeSmsTo(to);
  if (!normalizedTo) {
    return { ok: false, error: "SMS recipient phone is empty" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({
    From: from,
    To: normalizedTo,
    Body: body,
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText || `Twilio HTTP ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

module.exports = {
  escapeRegex,
  normalizeSmsTo,
  sendBankTracedEmail,
  sendSmsTwilio,
};
