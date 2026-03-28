import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { SECURITY_HEADERS } from "../../server/lib/httpSecurity.js";

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "itm_access";
const CSRF_COOKIE_NAME = process.env.AUTH_CSRF_COOKIE || "itm_csrf";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[support function] Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
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
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    ...SECURITY_HEADERS,
  },
  body: JSON.stringify(body),
});

const ok = (b) => json(200, b);
const bad = (msg, details) => json(400, { success: false, error: msg, details });
const unauthorized = (msg, details) => json(401, { success: false, error: msg || "Unauthorized", details });
const forbidden = (msg, details) => json(403, { success: false, error: msg || "Forbidden", details });
const fail = (msg, details) => json(500, { success: false, error: msg, details });
const SUPPORT_TICKET_SELECT =
  "*, vendors(company_name, email, owner_name, vendor_id), buyers(id, full_name, email, company_name)";

function parseTail(eventPath) {
  const parts = String(eventPath || "").split("/").filter(Boolean);
  const fnIndex = parts.indexOf("support");
  if (fnIndex >= 0) return parts.slice(fnIndex + 1);
  return parts;
}

const nowIso = () => new Date().toISOString();
const normalizeSenderType = (v) => String(v || "").trim().toUpperCase();
const normalizeRole = (role) => {
  const raw = String(role || "").trim().toUpperCase();
  if (raw === "DATAENTRY") return "DATA_ENTRY";
  if (raw === "FINACE") return "FINANCE";
  return raw;
};

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
    console.warn(
      "[support function] JWT_SECRET missing. Falling back to another secret. Configure a dedicated JWT_SECRET."
    );
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

const ensureCsrfValid = (event) => {
  const cookieToken = getCookie(event, CSRF_COOKIE_NAME);
  const header =
    event?.headers?.["x-csrf-token"] ||
    event?.headers?.["x-xsrf-token"] ||
    event?.headers?.["csrf-token"];
  return !!cookieToken && !!header && String(cookieToken) === String(header);
};

const readBody = (event) => {
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

const getActorFromEvent = (event) => {
  const bearer = parseBearerToken(event?.headers || {});
  const tokenFromCookie = getCookie(event, AUTH_COOKIE_NAME);
  const token = bearer || tokenFromCookie;
  if (!token) {
    return { actor: null, tokenSource: null };
  }

  const decoded = verifyAuthToken(token);
  if (!decoded?.sub) {
    return { actor: null, tokenSource: bearer ? "bearer" : "cookie" };
  }

  return {
    actor: {
      id: decoded.sub,
      email: decoded.email || null,
      role: normalizeRole(decoded.role || "USER"),
    },
    tokenSource: bearer ? "bearer" : "cookie",
  };
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

async function notifyRole(role, payload) {
  try {
    const r = String(role || "").trim().toUpperCase();
    if (!r) return [];
    const { data: employees, error } = await supabase
      .from("employees")
      .select("user_id, status, role")
      .eq("role", r);
    if (error || !employees?.length) return [];
    const activeIds = employees
      .filter((e) => !e.status || String(e.status).toUpperCase() === "ACTIVE")
      .map((e) => e.user_id)
      .filter(Boolean);
    if (!activeIds.length) return [];
    const rows = activeIds.map((id) => ({
      user_id: id,
      type: payload?.type || "INFO",
      title: payload?.title || "Notification",
      message: payload?.message || "",
      link: payload?.link || null,
      is_read: false,
      created_at: nowIso(),
    }));
    const { data } = await supabase.from("notifications").insert(rows).select();
    return data || [];
  } catch {
    return [];
  }
}

const notifyAdmins = async (payload) => {
  await notifyRole("ADMIN", payload);
  await notifyRole("SUPERADMIN", payload);
  await notifyRole("SUPPORT", payload);
};

async function getTicketUsers(ticket) {
  const vendorId = ticket?.vendor_id || null;
  const buyerId = ticket?.buyer_id || null;
  let vendorUserId = null;
  let buyerUserId = null;

  if (vendorId) {
    const { data } = await supabase
      .from("vendors")
      .select("user_id")
      .eq("id", vendorId)
      .maybeSingle();
    vendorUserId = data?.user_id || null;
  }

  if (buyerId) {
    const { data } = await supabase
      .from("buyers")
      .select("user_id")
      .eq("id", buyerId)
      .maybeSingle();
    buyerUserId = data?.user_id || null;
  }

  return { vendorUserId, buyerUserId };
}

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") return ok({ ok: true });

    const tail = parseTail(event.path);
    const [root, id, action] = tail;

    // -------------------------
    // GET /tickets
    // -------------------------
    if (event.httpMethod === "GET" && root === "tickets" && tail.length === 1) {
      const { status, priority, search, scope = "ALL", page = 1, pageSize = 100 } = event.queryStringParameters || {};
      let query = supabase
        .from("support_tickets")
        .select(SUPPORT_TICKET_SELECT, { count: "exact" })
        .order("created_at", { ascending: false });

      if (status && status !== "ALL") query = query.eq("status", status);
      if (priority && priority !== "ALL") query = query.eq("priority", priority);
      if (search && String(search).trim()) {
        const term = String(search).toLowerCase();
        query = query.or(
          `subject.ilike.%${term}%,description.ilike.%${term}%,ticket_display_id.ilike.%${term}%`
        );
      }

      const scopeValue = String(scope || "").toUpperCase();
      if (scopeValue === "VENDOR") {
        query = query.not("vendor_id", "is", null);
      } else if (scopeValue === "BUYER") {
        query = query.not("buyer_id", "is", null);
      }

      const offset = (Number(page) - 1) * Number(pageSize);
      query = query.range(offset, offset + Number(pageSize) - 1);

      const { data, error, count } = await query;
      if (error) return fail("Failed to fetch tickets", error.message);

      return ok({
        success: true,
        tickets: data || [],
        total: count || 0,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil((count || 0) / Number(pageSize)),
      });
    }

    // -------------------------
    // GET /tickets/:id
    // -------------------------
    if (event.httpMethod === "GET" && root === "tickets" && id && tail.length === 2) {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(SUPPORT_TICKET_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return json(404, { error: "Ticket not found" });
      return ok({ success: true, ticket: data });
    }

    // -------------------------
    // GET /tickets/:id/messages
    // -------------------------
    if (event.httpMethod === "GET" && root === "tickets" && id && action === "messages") {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });
      if (error) return fail("Failed to fetch messages", error.message);
      return ok({ success: true, messages: data || [] });
    }

    // -------------------------
    // POST /tickets/:id/messages
    // -------------------------
    if (event.httpMethod === "POST" && root === "tickets" && id && action === "messages") {
      let body = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        body = {};
      }

      const message = String(body?.message || "").trim();
      if (!message) return bad("Message is required");

      const senderType = normalizeSenderType(body?.sender_type) || "SUPPORT";
      const senderId = body?.sender_id || null;

      const { data: ticket, error: tErr } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (tErr || !ticket) return json(404, { error: "Ticket not found" });

      await supabase
        .from("support_tickets")
        .update({ last_reply_at: nowIso(), updated_at: nowIso() })
        .eq("id", id);

      const { data, error } = await supabase
        .from("ticket_messages")
        .insert([{
          ticket_id: id,
          sender_id: senderId,
          sender_type: senderType,
          message,
          created_at: nowIso(),
        }])
        .select()
        .single();

      if (error) return fail("Failed to send message", error.message);

      const { vendorUserId, buyerUserId } = await getTicketUsers(ticket);
      const title = `Support ticket update: ${ticket.ticket_display_id || ticket.id}`;
      const linkBase = ticket.vendor_id ? "/vendor/support" : "/buyer/tickets";

      if (["SUPPORT", "ADMIN", "STAFF"].includes(senderType)) {
        if (vendorUserId) {
          await notifyUser({
            user_id: vendorUserId,
            type: "SUPPORT_MESSAGE",
            title,
            message,
            link: linkBase,
          });
        }
        if (buyerUserId) {
          await notifyUser({
            user_id: buyerUserId,
            type: "SUPPORT_MESSAGE",
            title,
            message,
            link: linkBase,
          });
        }
      } else {
        await notifyAdmins({
          type: "SUPPORT_MESSAGE",
          title,
          message,
          link: "/admin/tickets",
        });
      }

      return ok({ success: true, message: data });
    }

    // -------------------------
    // POST /tickets
    // -------------------------
    if (event.httpMethod === "POST" && root === "tickets" && tail.length === 1) {
      let body = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        body = {};
      }

      const subject = String(body?.subject || "").trim();
      const description = String(body?.description || "").trim();
      if (!subject || !description) return bad("Missing required fields: subject and description");

      const ticketNumber = `TKT-${Date.now()}`;
      const payload = {
        subject,
        description,
        category: body?.category || "General",
        priority: String(body?.priority || "MEDIUM").toUpperCase(),
        status: String(body?.status || "OPEN").toUpperCase(),
        vendor_id: body?.vendor_id || null,
        buyer_id: body?.buyer_id || null,
        ticket_display_id: ticketNumber,
        attachments: JSON.stringify(body?.attachments || []),
        created_at: nowIso(),
      };

      const { data, error } = await supabase
        .from("support_tickets")
        .insert([payload])
        .select()
        .single();
      if (error) return fail("Failed to create ticket", error.message);

      await notifyAdmins({
        type: "SUPPORT_TICKET",
        title: `New support ticket: ${ticketNumber}`,
        message: subject,
        link: "/admin/tickets",
      });

      return json(201, { success: true, message: "Ticket created successfully", ticket: data });
    }

    // -------------------------
    // DELETE /tickets/:id
    // -------------------------
    if (event.httpMethod === "DELETE" && root === "tickets" && id && tail.length === 2) {
      let body = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        body = {};
      }

      const vendorId = String(body?.vendor_id || event?.queryStringParameters?.vendor_id || "").trim();
      const buyerId = String(body?.buyer_id || event?.queryStringParameters?.buyer_id || "").trim();

      if (!vendorId && !buyerId) {
        return bad("vendor_id or buyer_id is required to delete ticket");
      }

      let scopeQuery = supabase
        .from("support_tickets")
        .select("id")
        .eq("id", id);

      if (vendorId) scopeQuery = scopeQuery.eq("vendor_id", vendorId);
      if (buyerId) scopeQuery = scopeQuery.eq("buyer_id", buyerId);

      const { data: scopedTicket, error: scopeError } = await scopeQuery.maybeSingle();
      if (scopeError) {
        return fail("Failed to validate ticket ownership", scopeError.message);
      }

      if (!scopedTicket) {
        return json(404, { success: false, error: "Ticket not found or not allowed to delete" });
      }

      const { error: messageDeleteError } = await supabase
        .from("ticket_messages")
        .delete()
        .eq("ticket_id", id);

      if (messageDeleteError) {
        return fail("Failed to delete ticket messages", messageDeleteError.message);
      }

      const { data: deletedRows, error: deleteError } = await supabase
        .from("support_tickets")
        .delete()
        .eq("id", id)
        .select("id");

      if (deleteError) {
        return fail("Failed to delete ticket", deleteError.message);
      }

      if (!Array.isArray(deletedRows) || deletedRows.length === 0) {
        return json(404, { success: false, error: "Ticket not found or already deleted" });
      }

      return ok({ success: true, deleted: deletedRows[0]?.id || id });
    }

    // -------------------------
    // PATCH /tickets/:id
    // -------------------------
    if (event.httpMethod === "PATCH" && root === "tickets" && id && tail.length === 2) {
      let body = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        body = {};
      }

      const allowed = ["status", "priority", "category", "attachments"];
      const updates = {};
      Object.keys(body || {}).forEach((k) => {
        if (allowed.includes(k)) updates[k] = body[k];
      });
      if (!Object.keys(updates).length) return bad("No valid fields to update");

      const { data, error } = await supabase
        .from("support_tickets")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) return fail("Failed to update ticket", error.message);
      return ok({ success: true, message: "Ticket updated successfully", ticket: data });
    }

    // -------------------------
    // PUT /tickets/:id/status
    // -------------------------
    if (event.httpMethod === "PUT" && root === "tickets" && id && action === "status") {
      let body = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        body = {};
      }
      const status = String(body?.status || "").toUpperCase();
      if (!status) return bad("Status is required");

      const validStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"];
      if (!validStatuses.includes(status)) {
        return bad(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
      }

      const updatePayload = { status };
      if (["RESOLVED", "CLOSED"].includes(status)) updatePayload.resolved_at = nowIso();

      const { data, error } = await supabase
        .from("support_tickets")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();
      if (error) return fail("Failed to update ticket status", error.message);

      if (data) {
        const { vendorUserId, buyerUserId } = await getTicketUsers(data);
        const title = `Ticket status updated: ${data.ticket_display_id || data.id}`;
        const message = `Status changed to ${status}`;
        if (vendorUserId) {
          await notifyUser({ user_id: vendorUserId, type: "SUPPORT_STATUS", title, message, link: "/vendor/support" });
        }
        if (buyerUserId) {
          await notifyUser({ user_id: buyerUserId, type: "SUPPORT_STATUS", title, message, link: "/buyer/tickets" });
        }
      }

      return ok({ success: true, message: "Ticket status updated successfully", ticket: data });
    }

    // -------------------------
    // POST /tickets/:id/notify-customer
    // -------------------------
    if (event.httpMethod === "POST" && root === "tickets" && id && action === "notify-customer") {
      let body = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        body = {};
      }

      const rawMessage = String(body?.message || "").trim();

      const { data: ticket, error: ticketError } = await supabase
        .from("support_tickets")
        .select("id, ticket_display_id, subject, description, category, vendor_id, buyer_id")
        .eq("id", id)
        .maybeSingle();

      if (ticketError || !ticket) {
        return json(404, { error: "Ticket not found" });
      }

      const { vendorUserId, buyerUserId } = await getTicketUsers(ticket);
      if (!vendorUserId && !buyerUserId) {
        return bad("No linked vendor or buyer found for this ticket");
      }

      const message = rawMessage || ticket.description || ticket.subject || "Support update available";
      const title = ticket.subject
        ? `Support update: ${ticket.subject}`
        : `Support update: ${ticket.ticket_display_id || ticket.id}`;

      let sent = 0;
      if (vendorUserId) {
        const vendorLink = String(ticket.category || "").toUpperCase().includes("KYC")
          ? "/vendor/profile?tab=kyc"
          : "/vendor/support";
        await notifyUser({
          user_id: vendorUserId,
          type: "SUPPORT_ALERT",
          title,
          message,
          link: vendorLink,
        });
        sent += 1;
      }
      if (buyerUserId) {
        await notifyUser({
          user_id: buyerUserId,
          type: "SUPPORT_ALERT",
          title,
          message,
          link: "/buyer/tickets",
        });
        sent += 1;
      }

      return ok({ success: true, notified: sent });
    }

    // -------------------------
    // POST /tickets/:id/escalate
    // -------------------------
    if (event.httpMethod === "POST" && root === "tickets" && id && action === "escalate") {
      const { actor, tokenSource } = getActorFromEvent(event);
      if (!actor) {
        return unauthorized("Unauthorized");
      }
      if (tokenSource !== "bearer" && !ensureCsrfValid(event)) {
        return forbidden("CSRF token mismatch");
      }
      if (!["ADMIN", "SUPPORT", "SUPERADMIN", "SALES"].includes(actor.role)) {
        return forbidden("Forbidden");
      }

      const body = readBody(event);
      const targetRole = normalizeSenderType(body?.targetRole || body?.target_role);
      const rawMessage = String(body?.message || "").trim();

      if (!["ADMIN", "SALES"].includes(targetRole)) {
        return bad("targetRole must be ADMIN or SALES");
      }

      if (actor.role === "ADMIN" && targetRole === "ADMIN") {
        return json(409, {
          success: false,
          error: "Admins cannot escalate a ticket to themselves. Please choose Sales.",
        });
      }

      const { data: ticket, error: ticketError } = await supabase
        .from("support_tickets")
        .select("id, ticket_display_id, subject, description, vendor_id, buyer_id")
        .eq("id", id)
        .maybeSingle();

      if (ticketError || !ticket) {
        return json(404, { error: "Ticket not found" });
      }

      const entityLabel = ticket.vendor_id ? "Vendor" : ticket.buyer_id ? "Buyer" : "Customer";
      const targetLabel = targetRole === "SALES" ? "Sales" : "Admin";
      const message =
        rawMessage ||
        `Support escalated this ${entityLabel.toLowerCase()} issue to ${targetLabel} for review.`;
      const auditMessage = `[Escalated to ${targetLabel}] ${message}`;

      const { error: messageError } = await supabase
        .from("ticket_messages")
        .insert([{
          ticket_id: id,
          sender_id: null,
          sender_type: actor.role || "SUPPORT",
          message: auditMessage,
          created_at: nowIso(),
        }]);

      if (messageError) {
        return fail("Failed to record escalation", messageError.message);
      }

      await supabase
        .from("support_tickets")
        .update({ last_reply_at: nowIso(), updated_at: nowIso() })
        .eq("id", id);

      const title = `${targetLabel} escalation: ${ticket.ticket_display_id || ticket.id}`;
      const notificationMessage = [
        `${entityLabel} issue escalated from ${actor.role === "ADMIN" ? "Admin" : "Support"}.`,
        ticket.subject ? `Subject: ${ticket.subject}.` : null,
        `Note: ${message}`,
      ]
        .filter(Boolean)
        .join(" ");

      if (targetRole === "ADMIN") {
        await notifyRole("ADMIN", {
          type: "SUPPORT_ESCALATION",
          title,
          message: notificationMessage,
          link: "/admin/tickets",
        });
        await notifyRole("SUPERADMIN", {
          type: "SUPPORT_ESCALATION",
          title,
          message: notificationMessage,
          link: "/admin/tickets",
        });
      } else {
        await notifyRole("SALES", {
          type: "SUPPORT_ESCALATION",
          title,
          message: notificationMessage,
          link: `/employee/sales/dashboard?ticket=${encodeURIComponent(ticket.id)}`,
        });
      }

      return ok({
        success: true,
        ticketId: ticket.id,
        targetRole,
        message: auditMessage,
      });
    }

    // -------------------------
    // GET /stats
    // -------------------------
    if (event.httpMethod === "GET" && root === "stats") {
      const { data: tickets, error } = await supabase
        .from("support_tickets")
        .select("status, priority");
      if (error) return fail("Failed to fetch statistics", error.message);

      const stats = {
        totalTickets: tickets?.length || 0,
        openTickets: 0,
        inProgressTickets: 0,
        resolvedTickets: 0,
        closedTickets: 0,
        highPriorityTickets: 0,
        mediumPriorityTickets: 0,
        lowPriorityTickets: 0,
        resolutionRate: 0,
      };

      (tickets || []).forEach((ticket) => {
        switch (ticket.status) {
          case "OPEN": stats.openTickets++; break;
          case "IN_PROGRESS": stats.inProgressTickets++; break;
          case "RESOLVED": stats.resolvedTickets++; break;
          case "CLOSED": stats.closedTickets++; break;
          default: break;
        }
        switch (ticket.priority) {
          case "HIGH":
          case "URGENT": stats.highPriorityTickets++; break;
          case "MEDIUM": stats.mediumPriorityTickets++; break;
          case "LOW": stats.lowPriorityTickets++; break;
          default: break;
        }
      });

      const resolved = stats.resolvedTickets + stats.closedTickets;
      stats.resolutionRate = stats.totalTickets > 0
        ? Math.round((resolved / stats.totalTickets) * 100)
        : 0;

      return ok({ success: true, stats });
    }

    // -------------------------
    // GET /vendor/:vendorId
    // -------------------------
    if (event.httpMethod === "GET" && root === "vendor" && id) {
      const { status, priority } = event.queryStringParameters || {};
      let query = supabase
        .from("support_tickets")
        .select("*")
        .eq("vendor_id", id)
        .order("created_at", { ascending: false });

      if (status && status !== "ALL") query = query.eq("status", status);
      if (priority && priority !== "ALL") query = query.eq("priority", priority);

      const { data, error } = await query;
      if (error) return fail("Failed to fetch vendor tickets", error.message);

      return ok({ success: true, tickets: data || [], total: data?.length || 0 });
    }

    // -------------------------
    // GET /buyer/:buyerId
    // -------------------------
    if (event.httpMethod === "GET" && root === "buyer" && id) {
      const { status, priority } = event.queryStringParameters || {};
      let query = supabase
        .from("support_tickets")
        .select("*")
        .eq("buyer_id", id)
        .order("created_at", { ascending: false });

      if (status && status !== "ALL") query = query.eq("status", status);
      if (priority && priority !== "ALL") query = query.eq("priority", priority);

      const { data, error } = await query;
      if (error) return fail("Failed to fetch buyer tickets", error.message);

      return ok({ success: true, tickets: data || [], total: data?.length || 0 });
    }

    return json(404, { success: false, error: "Not found" });
  } catch (e) {
    return fail("Unhandled error", e?.message || String(e));
  }
}
