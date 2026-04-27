import { createClient } from "@supabase/supabase-js";
import { isEmailTransportConfigured, sendEmail } from "../../server/lib/emailService.js";
import { SECURITY_HEADERS } from "../../server/lib/httpSecurity.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[kyc function] Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(
  SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY || ""
);

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    ...SECURITY_HEADERS,
  },
  body: JSON.stringify(body),
});

const ok = (b) => json(200, b);
const bad = (msg, details) => json(400, { success: false, error: msg, details });
const fail = (msg, details) => json(500, { success: false, error: msg, details });

function parseTail(eventPath) {
  // event.path examples:
  // "/.netlify/functions/kyc/vendors/:id/documents"
  // "/.netlify/functions/kyc/vendors"
  const parts = String(eventPath || "")
    .split("/")
    .filter(Boolean);

  const fnIndex = parts.indexOf("kyc"); // function name
  if (fnIndex >= 0) return parts.slice(fnIndex + 1); // after "kyc"
  return parts;
}

const looksLikePdf = (v = "") => String(v || "").toLowerCase().includes(".pdf");

const normalizeDoc = (d) => {
  const url = d?.url || d?.document_url || d?.file_path || d?.path || d?.public_url || "";
  return {
    id: d?.id,
    document_type: d?.document_type || d?.type || "document",
    url,
    status: d?.verification_status || d?.status || "PENDING",
    created_at: d?.created_at || d?.uploaded_at || null,
    is_pdf: looksLikePdf(url),
    original_name: d?.original_name || null,
  };
};

const nowIso = () => new Date().toISOString();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const sendReminderEmail = async ({ to, subject, text, html }) => {
  const safeTo = normalizeEmail(to);
  if (!safeTo) return false;

  try {
    await sendEmail({
      to: safeTo,
      subject,
      text,
      html,
      purpose: "notification",
    });
    return true;
  } catch (error) {
    console.warn("[netlify/kyc] reminder email failed:", error?.message || error);
    return false;
  }
};

const getReminderContent = ({ context, vendorName, rejectionReason }) => {
  const isRejected = String(context || "").toLowerCase() === "rejected";
  const vendorTitle = isRejected ? "Action Required: KYC Rejected" : "Reminder: Upload KYC Documents";
  const vendorMessage = isRejected
    ? `Your KYC for "${vendorName}" is rejected. Please upload corrected documents and resubmit.`
    : `Please upload pending KYC documents for "${vendorName}" to complete verification.`;
  const buyerTitle = isRejected ? "Supplier KYC Rejected Update" : "Supplier KYC Pending Update";
  const buyerMessage = isRejected
    ? `KYC of supplier "${vendorName}" is currently rejected and under review by support team.`
    : `KYC of supplier "${vendorName}" is pending document submission and under review by support team.`;
  const reasonLine = rejectionReason ? `Reason: ${rejectionReason}` : "";

  return {
    vendorTitle,
    vendorMessage: [vendorMessage, reasonLine].filter(Boolean).join(" "),
    buyerTitle,
    buyerMessage,
  };
};

const resolveBuyerReminderTargets = async (vendorId) => {
  const buyerMap = new Map();
  const addTarget = ({ user_id, email, full_name }) => {
    const safeUserId = String(user_id || "").trim();
    const safeEmail = normalizeEmail(email);
    if (!safeUserId && !safeEmail) return;
    const key = safeUserId || safeEmail;
    if (buyerMap.has(key)) return;
    buyerMap.set(key, {
      user_id: safeUserId || null,
      email: safeEmail || null,
      full_name: full_name || null,
    });
  };

  const { data: proposalRows } = await supabase
    .from("proposals")
    .select("buyer_id, buyer_email, buyer_name")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(500);

  const buyerIds = Array.from(
    new Set((proposalRows || []).map((row) => String(row?.buyer_id || "").trim()).filter(Boolean))
  );
  const proposalEmails = Array.from(
    new Set((proposalRows || []).map((row) => normalizeEmail(row?.buyer_email)).filter(Boolean))
  );

  if (buyerIds.length > 0) {
    const { data: buyersById } = await supabase
      .from("buyers")
      .select("id, user_id, email, full_name, company_name")
      .in("id", buyerIds);

    (buyersById || []).forEach((buyer) =>
      addTarget({
        user_id: buyer?.user_id,
        email: buyer?.email,
        full_name: buyer?.full_name || buyer?.company_name || null,
      })
    );
  }

  if (proposalEmails.length > 0) {
    const { data: buyersByEmail } = await supabase
      .from("buyers")
      .select("id, user_id, email, full_name, company_name")
      .in("email", proposalEmails);

    (buyersByEmail || []).forEach((buyer) =>
      addTarget({
        user_id: buyer?.user_id,
        email: buyer?.email,
        full_name: buyer?.full_name || buyer?.company_name || null,
      })
    );
  }

  (proposalRows || []).forEach((row) =>
    addTarget({
      user_id: null,
      email: row?.buyer_email,
      full_name: row?.buyer_name || null,
    })
  );

  return Array.from(buyerMap.values());
};

async function notifyUser({ user_id, type, title, message, link }) {
  try {
    if (!user_id) return null;
    const { data, error } = await supabase
      .from("notifications")
      .insert([{
        user_id,
        type: type || "INFO",
        title: title || "Notification",
        message: message || "",
        link: link || null,
        is_read: false,
        created_at: nowIso(),
      }])
      .select()
      .maybeSingle();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") return ok({ ok: true });

    const tail = parseTail(event.path);

    // must start with vendors
    if (tail[0] !== "vendors") return json(404, { success: false, error: "Not found" });

    // -------------------------
    // GET /vendors?status=ALL|PENDING|SUBMITTED|APPROVED|REJECTED
    // -------------------------
    if (event.httpMethod === "GET" && tail.length === 1) {
      const status = String(event.queryStringParameters?.status || "ALL").toUpperCase();

      let q = supabase.from("vendors").select("*").order("created_at", { ascending: false });
      if (status !== "ALL") q = q.eq("kyc_status", status);

      const { data, error } = await q;
      if (error) return fail("Failed to fetch vendors", error.message);

      return ok({ success: true, vendors: data || [] });
    }

    if (event.httpMethod === "POST" && tail.length === 2 && tail[1] === "document-counts") {
      let body = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        body = {};
      }

      const vendorIds = Array.from(
        new Set((Array.isArray(body?.vendorIds) ? body.vendorIds : []).map((id) => String(id || "").trim()).filter(Boolean))
      );

      if (!vendorIds.length) {
        return ok({ success: true, counts: {} });
      }

      const counts = {};
      const mark = (vendor_id, signature, dedupe) => {
        const key = String(vendor_id || "").trim();
        if (!key) return;
        const dedupeKey = `${key}::${String(signature || "").trim()}`;
        if (dedupe.has(dedupeKey)) return;
        dedupe.add(dedupeKey);
        counts[key] = (counts[key] || 0) + 1;
      };

      const dedupe = new Set();
      const { data: docs, error: docsError } = await supabase
        .from("vendor_documents")
        .select("vendor_id, document_type, document_url, original_name, uploaded_at, created_at")
        .in("vendor_id", vendorIds);
      if (docsError) return fail("Failed to fetch document counts", docsError.message);

      (docs || []).forEach((row) => {
        const signature =
          row?.document_url ||
          row?.original_name ||
          `${row?.document_type || ""}:${row?.uploaded_at || row?.created_at || ""}`;
        mark(row?.vendor_id, signature, dedupe);
      });

      vendorIds.forEach((id) => {
        if (!Object.prototype.hasOwnProperty.call(counts, id)) counts[id] = 0;
      });

      return ok({ success: true, counts });
    }

    const vendorId = tail[1];
    const action = tail[2];

    if (!vendorId) return bad("vendorId missing");

    // -------------------------
    // GET /vendors/:vendorId/documents
    // -------------------------
    if (event.httpMethod === "GET" && action === "documents") {
      const { data: vendor, error: vErr } = await supabase
        .from("vendors")
        .select("*")
        .eq("id", vendorId)
        .maybeSingle();

      if (vErr) return fail("Failed to fetch vendor", vErr.message);

      const { data: docs, error: dErr } = await supabase
        .from("vendor_documents")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false });

      if (dErr) return fail("Failed to fetch documents", dErr.message);

      const documents = (docs || []).map(normalizeDoc);

      return ok({
        success: true,
        vendor: vendor || null,
        documents,
      });
    }

    // -------------------------
    // POST /vendors/:vendorId/approve
    // -------------------------
    if (event.httpMethod === "POST" && action === "approve") {
      const { data, error } = await supabase
        .from("vendors")
        .update({
          kyc_status: "APPROVED",
          is_verified: true,
          verification_badge: true,
          verified_at: new Date().toISOString(),
        })
        .eq("id", vendorId)
        .select("*")
        .maybeSingle();

      if (error) return fail("Approve failed", error.message);

      if (data?.user_id) {
        await notifyUser({
          user_id: data.user_id,
          type: "KYC_APPROVED",
          title: "KYC Approved",
          message: "Your KYC has been approved. Your account is now verified.",
          link: "/vendor/profile?tab=kyc",
        });
      }

      return ok({ success: true, vendor: data || null });
    }

    // -------------------------
    // POST /vendors/:vendorId/reject
    // -------------------------
    if (event.httpMethod === "POST" && action === "reject") {
      let body = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        body = {};
      }

      const remarks = String(body?.remarks || "").trim() || null;

      const { data, error } = await supabase
        .from("vendors")
        .update({
          kyc_status: "REJECTED",
          is_verified: false,
          verification_badge: false,
          rejection_reason: remarks,
        })
        .eq("id", vendorId)
        .select("*")
        .maybeSingle();

      if (error) return fail("Reject failed", error.message);

      if (data?.user_id) {
        await notifyUser({
          user_id: data.user_id,
          type: "KYC_REJECTED",
          title: "KYC Rejected",
          message: remarks || "Your KYC was rejected. Please re-upload the correct documents.",
          link: "/vendor/profile?tab=kyc",
        });
      }

      return ok({ success: true, vendor: data || null });
    }

    if (event.httpMethod === "POST" && action === "reminder") {
      let body = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        body = {};
      }

      const context = String(body?.context || "awaiting_documents").trim().toLowerCase();
      const target = String(body?.target || "vendor").trim().toLowerCase();
      const delivery = String(body?.delivery || "both").trim().toLowerCase();

      if (!["vendor", "buyers", "both"].includes(target)) {
        return bad("Invalid target. Use vendor, buyers, or both.");
      }
      if (!["bell", "email", "both"].includes(delivery)) {
        return bad("Invalid delivery. Use bell, email, or both.");
      }

      const sendBell = delivery === "both" || delivery === "bell";
      const sendEmail = delivery === "both" || delivery === "email";

      const { data: vendor, error: vendorError } = await supabase
        .from("vendors")
        .select("id, user_id, email, company_name, vendor_id, rejection_reason")
        .eq("id", vendorId)
        .maybeSingle();

      if (vendorError) return fail("Failed to load vendor", vendorError.message);
      if (!vendor) return json(404, { success: false, error: "Vendor not found" });

      const vendorName = vendor?.company_name || vendor?.vendor_id || "Vendor";
      const content = getReminderContent({
        context,
        vendorName,
        rejectionReason: vendor?.rejection_reason || "",
      });

      let vendorBellSent = 0;
      let vendorEmailSent = 0;
      let buyersBellSent = 0;
      let buyersEmailSent = 0;
      let buyersMatched = 0;

      if (target === "vendor" || target === "both") {
        if (sendBell) {
          const vendorNotif = await notifyUser({
            user_id: vendor?.user_id || null,
            type: "KYC_REMINDER_VENDOR",
            title: content.vendorTitle,
            message: content.vendorMessage,
            link: "/vendor/profile?tab=kyc",
          });
          if (vendorNotif) vendorBellSent += 1;
        }

        if (sendEmail) {
          const vendorEmailOk = await sendReminderEmail({
            to: vendor?.email || null,
            subject: content.vendorTitle,
            text: content.vendorMessage,
            html: `<p>${content.vendorMessage}</p>`,
          });
          if (vendorEmailOk) vendorEmailSent += 1;
        }
      }

      if (target === "buyers" || target === "both") {
        const buyerTargets = await resolveBuyerReminderTargets(vendor.id);
        buyersMatched = buyerTargets.length;

        for (const buyer of buyerTargets) {
          if (sendBell) {
            const buyerNotif = await notifyUser({
              user_id: buyer?.user_id || null,
              type: "KYC_REMINDER_BUYER",
              title: content.buyerTitle,
              message: content.buyerMessage,
              link: "/buyer/proposals",
            });
            if (buyerNotif) buyersBellSent += 1;
          }

          if (sendEmail) {
            const buyerEmailOk = await sendReminderEmail({
              to: buyer?.email || null,
              subject: content.buyerTitle,
              text: content.buyerMessage,
              html: `<p>${content.buyerMessage}</p>`,
            });
            if (buyerEmailOk) buyersEmailSent += 1;
          }
        }
      }

      return ok({
        success: true,
        summary: {
          target,
          delivery,
          context,
          vendorBellSent,
          vendorEmailSent,
          buyersMatched,
          buyersBellSent,
          buyersEmailSent,
          emailConfigured: isEmailTransportConfigured(),
        },
      });
    }

    return json(404, { success: false, error: "Not found" });
  } catch (e) {
    return fail("Unhandled error", e?.message || String(e));
  }
}
