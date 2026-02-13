import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 6-digit OTP (same as your code)
const OTP_TTL_SECONDS = 300; // 5 minutes
const OTP_TTL_MS = OTP_TTL_SECONDS * 1000;
const OTP_TTL_MINUTES = Math.floor(OTP_TTL_SECONDS / 60);

function generateOtp() {
  let otp = "";
  for (let i = 0; i < 6; i++) otp += Math.floor(Math.random() * 10);
  return otp;
}

function isValidEmail(email) {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

async function sendOtpEmail(email, otp) {
  const mailOptions = {
    from: `${process.env.OTP_FROM_NAME || "IndianTradeMart"} <${process.env.GMAIL_EMAIL}>`,
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
            <p style="color: #666; font-size: 14px;">This code will expire in ${OTP_TTL_MINUTES} minutes.</p>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">If you didn't request this code, please ignore this email.</p>
          </div>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="text-align: center; color: #999; font-size: 11px;">
            © 2025 IndianTradeMart. All rights reserved.
          </p>
        </body>
      </html>
    `
  };

  await transporter.sendMail(mailOptions);
}

export const handler = async (event) => {
  try {
    // Only POST
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    // Parse path: /.netlify/functions/otp/request OR /verify OR /resend
    const path = event.path || "";
    const action =
      path.endsWith("/request") ? "request" :
      path.endsWith("/verify") ? "verify" :
      path.endsWith("/resend") ? "resend" : null;

    if (!action) {
      return { statusCode: 404, body: JSON.stringify({ error: "Invalid OTP route" }) };
    }

    const body = JSON.parse(event.body || "{}");

    // ✅ REQUEST / RESEND
    if (action === "request" || action === "resend") {
      const { email } = body;
      const normalizedEmail = String(email || "").toLowerCase().trim();

      if (!isValidEmail(normalizedEmail)) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid email format" }) };
      }

      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

      // delete old OTPs
      await supabase.from("auth_otps").delete().eq("email", normalizedEmail).eq("used", false);

      // insert new OTP
      const { error: dbError } = await supabase.from("auth_otps").insert([{
        email: normalizedEmail,
        otp_code: otp,
        expires_at: expiresAt,
        used: false
      }]);

      if (dbError) {
        return { statusCode: 500, body: JSON.stringify({ error: "Failed to generate OTP" }) };
      }

      await sendOtpEmail(normalizedEmail, otp);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: action === "resend" ? "New OTP sent to your email" : "OTP sent successfully to your email",
          expiresIn: OTP_TTL_SECONDS
        })
      };
    }

    // ✅ VERIFY
    if (action === "verify") {
      const { email, otp_code } = body;
      const normalizedEmail = String(email || "").toLowerCase().trim();
      const otpCode = String(otp_code || "").trim();

      if (!normalizedEmail || !otpCode) {
        return { statusCode: 400, body: JSON.stringify({ error: "Email and OTP code are required" }) };
      }

      const { data, error } = await supabase
        .from("auth_otps")
        .select("*")
        .eq("email", normalizedEmail)
        .eq("otp_code", otpCode)
        .eq("used", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return { statusCode: 500, body: JSON.stringify({ error: "Verification failed" }) };
      }

      if (!data) {
        const { data: activeOtp } = await supabase
          .from("auth_otps")
          .select("id, expires_at")
          .eq("email", normalizedEmail)
          .eq("used", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeOtp) {
          return { statusCode: 401, body: JSON.stringify({ error: "A newer OTP was sent. Please use the latest code." }) };
        }

        return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired OTP code" }) };
      }

      const expiresAt = data?.expires_at ? new Date(data.expires_at) : null;
      if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        return { statusCode: 401, body: JSON.stringify({ error: "OTP expired. Please request a new code." }) };
      }

      await supabase.from("auth_otps").update({ used: true }).eq("id", data.id);

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: "OTP verified successfully", email: normalizedEmail })
      };
    }

    return { statusCode: 404, body: JSON.stringify({ error: "Unknown action" }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Server error" }) };
  }
};
