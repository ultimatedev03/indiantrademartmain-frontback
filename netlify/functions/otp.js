import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import { assertCaptchaForNetlifyEvent } from "../../server/lib/captcha.js";
import { SECURITY_HEADERS } from "../../server/lib/httpSecurity.js";
import { cacheDelete, cacheGetJson, cacheSetJson, isRedisConfigured } from "../../server/lib/redisCache.js";
import { sendOtpEmail as sendOtpMail } from "../../server/lib/emailService.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[otp function] Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(
  SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY || ""
);

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  ...SECURITY_HEADERS,
};

const json = (statusCode, body) => ({
  statusCode,
  headers: JSON_HEADERS,
  body: JSON.stringify(body),
});

const OTP_TTL_SECONDS = 120;
const OTP_REDIS_KEY_PREFIX = "auth_otp:";

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

const parseCookies = (cookieHeader = "") => {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== "string") return out;
  cookieHeader.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx < 0) return;
    const key = decodeURIComponent(part.slice(0, idx).trim());
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    if (key) out[key] = value;
  });
  return out;
};

const getCookie = (event, name) => {
  const header = event?.headers?.cookie || event?.headers?.Cookie || "";
  const cookies = parseCookies(header);
  return cookies[name];
};

const parseBearerToken = (headers = {}) => {
  const header = headers.Authorization || headers.authorization;
  if (!header || typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  return header.replace("Bearer ", "").trim();
};

let warnedMissingJwtSecret = false;
const getJwtSecret = () => {
  const secret =
    process.env.JWT_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("Missing JWT_SECRET (or fallback secret) in environment");
  }

  if (!process.env.JWT_SECRET && !warnedMissingJwtSecret) {
    console.warn("[otp function] JWT_SECRET missing. Falling back to another secret. Configure a dedicated JWT_SECRET.");
    warnedMissingJwtSecret = true;
  }

  return secret;
};

const verifyAuthToken = (token) => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
};

const getOptionalAuthUser = (event) => {
  try {
    const authCookieName = process.env.AUTH_COOKIE_NAME || "itm_access";
    const token = parseBearerToken(event?.headers || {}) || getCookie(event, authCookieName);
    if (!token) return null;
    const decoded = verifyAuthToken(token);
    if (!decoded?.sub) return null;
    return {
      id: decoded.sub,
      email: normalizeEmail(decoded.email || ""),
    };
  } catch {
    return null;
  }
};

const shouldBypassCaptcha = (event, email) => {
  const authUser = getOptionalAuthUser(event);
  return !!authUser?.email && authUser.email === normalizeEmail(email);
};

function generateOtp() {
  let otp = "";
  for (let i = 0; i < 6; i++) otp += Math.floor(Math.random() * 10);
  return otp;
}

function isValidEmail(email) {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendOtpEmail(email, otp) {
  try {
    await sendOtpMail(email, otp);
  } catch (error) {
    console.error("[otp function] send failed", {
      code: error?.code,
      responseCode: error?.responseCode || error?.statusCode,
      message: error?.message
    });
    if (
      error?.code === "EAUTH" ||
      Number(error?.responseCode || error?.statusCode) === 401 ||
      Number(error?.responseCode || error?.statusCode) === 403 ||
      Number(error?.responseCode || error?.statusCode) === 535
    ) {
      throw new Error("Email service authentication failed. Please update Netlify Resend or SMTP credentials.");
    }
    throw error;
  }
}

const getOtpCacheKey = (email) => `${OTP_REDIS_KEY_PREFIX}${normalizeEmail(email)}`;

const upsertOtpForEmail = async (email) => {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

  if (isRedisConfigured()) {
    try {
      await cacheSetJson(
        getOtpCacheKey(email),
        {
          email,
          otp_code: otp,
          expires_at: expiresAt
        },
        OTP_TTL_SECONDS
      );
      await supabase.from("auth_otps").delete().eq("email", email).eq("used", false);
      return { otp, expiresAt, store: "redis" };
    } catch (error) {
      console.warn("[otp function] Redis write failed. Falling back to Supabase OTP store.", {
        reason: error?.message || "Unknown Redis error"
      });
    }
  }

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
    throw new Error("Failed to generate OTP");
  }

  return { otp, expiresAt, store: "supabase" };
};

const verifyOtpFromRedis = async (email, otpCode) => {
  if (!isRedisConfigured()) return null;

  try {
    const record = await cacheGetJson(getOtpCacheKey(email));
    if (!record) return { matched: false };

    const expiresAtMs = new Date(record.expires_at || record.expiresAt || "").getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      await cacheDelete(getOtpCacheKey(email)).catch(() => null);
      return { matched: false };
    }

    const expected = String(record.otp_code || record.otp || "").trim();
    if (!expected || expected !== otpCode) return { matched: false };

    await cacheDelete(getOtpCacheKey(email));
    return { matched: true };
  } catch (error) {
    console.warn("[otp function] Redis verify failed. Falling back to Supabase OTP store.", {
      reason: error?.message || "Unknown Redis error"
    });
    return null;
  }
};

export const handler = async (event) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Server is missing Supabase configuration." });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const path = event.path || "";
    const action =
      path.endsWith("/request") ? "request" :
      path.endsWith("/verify") ? "verify" :
      path.endsWith("/resend") ? "resend" : null;

    if (!action) {
      return json(404, { error: "Invalid OTP route" });
    }

    const body = parseRequestBody(event);

    if (action === "request" || action === "resend") {
      const email = normalizeEmail(body?.email);

      if (!isValidEmail(email)) {
        return json(400, { error: "Invalid email format" });
      }

      if (!shouldBypassCaptcha(event, email)) {
        await assertCaptchaForNetlifyEvent(event, body, {
          action: action === "resend" ? "otp_resend" : "otp_request"
        });
      }

      const { otp } = await upsertOtpForEmail(email);

      await sendOtpEmail(email, otp);

      return json(200, {
        success: true,
        message: action === "resend" ? "New OTP sent to your email" : "OTP sent successfully to your email",
        expiresIn: OTP_TTL_SECONDS,
      });
    }

    if (action === "verify") {
      const email = normalizeEmail(body?.email);
      const otpCode = String(body?.otp_code || "").trim();

      if (!email || !otpCode) {
        return json(400, { error: "Email and OTP code are required" });
      }

      const redisVerification = await verifyOtpFromRedis(email, otpCode);
      if (redisVerification?.matched) {
        return json(200, { success: true, message: "OTP verified successfully", email });
      }
      if (redisVerification && !redisVerification.matched) {
        return json(401, { error: "Invalid or expired OTP code" });
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
        return json(500, { error: "Verification failed" });
      }

      if (!data) {
        return json(401, { error: "Invalid or expired OTP code" });
      }

      await supabase.from("auth_otps").update({ used: true }).eq("id", data.id);

      return json(200, { success: true, message: "OTP verified successfully", email });
    }

    return json(404, { error: "Unknown action" });
  } catch (e) {
    console.error("[otp function] Handler error:", e);
    return json(e?.statusCode || 500, { error: e?.message || "Server error" });
  }
};
