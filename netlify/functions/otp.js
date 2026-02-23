import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[otp function] Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(
  SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY || ""
);

const sanitizeEnvValue = (value) => {
  if (typeof value !== "string") return "";
  let cleaned = value.trim();
  if (
    (cleaned.startsWith("\"") && cleaned.endsWith("\"")) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
};

const readEnv = (...keys) => {
  for (const key of keys) {
    const value = sanitizeEnvValue(process.env[key]);
    if (value) return value;
  }
  return "";
};

const parseBoolean = (value, fallback = false) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

const SMTP_CONFIG = Object.freeze({
  host: readEnv("SMTP_HOST", "MAIL_HOST"),
  port: Number.parseInt(readEnv("SMTP_PORT", "MAIL_PORT") || "587", 10),
  secure: parseBoolean(readEnv("SMTP_SECURE", "MAIL_SECURE"), false),
  user: readEnv("SMTP_USER", "SMTP_USERNAME", "MAIL_USER", "MAIL_USERNAME"),
  pass: readEnv("SMTP_PASS", "SMTP_PASSWORD", "MAIL_PASS", "MAIL_PASSWORD")
});

const GMAIL_CONFIG = Object.freeze({
  email: readEnv("GMAIL_EMAIL", "GMAIL_USER", "VITE_GMAIL_EMAIL"),
  appPassword: readEnv("GMAIL_APP_PASSWORD", "GMAIL_PASSWORD", "VITE_GMAIL_APP_PASSWORD").replace(
    /[\s\u200B-\u200D\uFEFF]+/g,
    ""
  )
});

const OTP_FROM_NAME = readEnv("OTP_FROM_NAME") || "IndianTradeMart";
const OTP_FROM_EMAIL = readEnv("OTP_FROM_EMAIL");

let cachedMailers = null;
const getMailers = () => {
  if (cachedMailers) return cachedMailers;

  const mailers = [];

  if (SMTP_CONFIG.host && SMTP_CONFIG.user && SMTP_CONFIG.pass) {
    mailers.push({
      provider: "SMTP",
      fromEmail: OTP_FROM_EMAIL || SMTP_CONFIG.user,
      transporter: nodemailer.createTransport({
        host: SMTP_CONFIG.host,
        port: Number.isNaN(SMTP_CONFIG.port) ? 587 : SMTP_CONFIG.port,
        secure: SMTP_CONFIG.secure,
        auth: {
          user: SMTP_CONFIG.user,
          pass: SMTP_CONFIG.pass
        }
      })
    });
  }

  if (GMAIL_CONFIG.email && GMAIL_CONFIG.appPassword) {
    mailers.push({
      provider: "GMAIL",
      fromEmail: OTP_FROM_EMAIL || GMAIL_CONFIG.email,
      transporter: nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: GMAIL_CONFIG.email,
          pass: GMAIL_CONFIG.appPassword
        }
      })
    });
  }

  if (!mailers.length) {
    throw new Error(
      "Email transporter is not configured. Set SMTP_* or GMAIL_EMAIL/GMAIL_APP_PASSWORD in Netlify environment variables."
    );
  }

  cachedMailers = mailers;
  return cachedMailers;
};

const parseRequestBody = (event) => {
  if (!event?.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

function generateOtp() {
  let otp = "";
  for (let i = 0; i < 6; i++) otp += Math.floor(Math.random() * 10);
  return otp;
}

function isValidEmail(email) {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendOtpEmail(email, otp) {
  const mailers = getMailers();
  const failures = [];

  for (const mailer of mailers) {
    const mailOptions = {
      from: mailer.fromEmail ? `${OTP_FROM_NAME} <${mailer.fromEmail}>` : OTP_FROM_NAME,
      to: email,
      subject: `Your OTP Code: ${otp}`,
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center;">
              <h2 style="color: #003D82;">Email Verification</h2>
              <p style="font-size: 16px; color: #333;">Your OTP verification code is:</p>
              <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h1 style="color: #003D82; letter-spacing: 8px; font-size: 36px; margin: 0;">${otp}</h1>
              </div>
              <p style="color: #666; font-size: 14px;">This code will expire in 2 minutes.</p>
              <p style="color: #999; font-size: 12px; margin-top: 20px;">If you didn't request this code, please ignore this email.</p>
            </div>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="text-align: center; color: #999; font-size: 11px;">
              &copy; 2025 IndianTradeMart. All rights reserved.
            </p>
          </body>
        </html>
      `
    };

    try {
      await mailer.transporter.sendMail(mailOptions);
      return;
    } catch (error) {
      const responseCode = Number(error?.responseCode);
      const isAuthError = error?.code === "EAUTH" || responseCode === 535;
      failures.push({ provider: mailer.provider, isAuthError, code: error?.code, responseCode });
      console.error(`[otp function] ${mailer.provider} send failed`, {
        code: error?.code,
        responseCode: error?.responseCode
      });
    }
  }

  if (failures.some((item) => item.isAuthError)) {
    throw new Error("Email service authentication failed. Please update Netlify SMTP credentials.");
  }

  console.error("[otp function] Failed to send OTP email with all configured providers.", { failures });
  throw new Error("Failed to send OTP email");
}

export const handler = async (event) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Server is missing Supabase configuration." })
      };
    }

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const path = event.path || "";
    const action =
      path.endsWith("/request") ? "request" :
      path.endsWith("/verify") ? "verify" :
      path.endsWith("/resend") ? "resend" : null;

    if (!action) {
      return { statusCode: 404, body: JSON.stringify({ error: "Invalid OTP route" }) };
    }

    const body = parseRequestBody(event);

    if (action === "request" || action === "resend") {
      const email = normalizeEmail(body?.email);

      if (!isValidEmail(email)) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid email format" }) };
      }

      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

      await supabase.from("auth_otps").delete().eq("email", email).eq("used", false);

      const { error: dbError } = await supabase.from("auth_otps").insert([
        {
          email,
          otp_code: otp,
          expires_at: expiresAt,
          used: false
        }
      ]);

      if (dbError) {
        console.error("[otp function] Failed to insert OTP:", dbError);
        return { statusCode: 500, body: JSON.stringify({ error: "Failed to generate OTP" }) };
      }

      await sendOtpEmail(email, otp);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: action === "resend" ? "New OTP sent to your email" : "OTP sent successfully to your email",
          expiresIn: 120
        })
      };
    }

    if (action === "verify") {
      const email = normalizeEmail(body?.email);
      const otpCode = String(body?.otp_code || "").trim();

      if (!email || !otpCode) {
        return { statusCode: 400, body: JSON.stringify({ error: "Email and OTP code are required" }) };
      }

      const { data, error } = await supabase
        .from("auth_otps")
        .select("*")
        .eq("email", email)
        .eq("otp_code", otpCode)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[otp function] Verification query failed:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Verification failed" }) };
      }

      if (!data) {
        return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired OTP code" }) };
      }

      await supabase.from("auth_otps").update({ used: true }).eq("id", data.id);

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: "OTP verified successfully", email })
      };
    }

    return { statusCode: 404, body: JSON.stringify({ error: "Unknown action" }) };
  } catch (e) {
    console.error("[otp function] Handler error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Server error" }) };
  }
};
