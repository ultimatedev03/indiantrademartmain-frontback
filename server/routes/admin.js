import express from "express";
import { supabase } from "../lib/supabaseClient.js";
import { notifyRole, notifyUser } from "../lib/notify.js";
import { writeAuditLog } from "../lib/audit.js";
import { requireEmployeeRoles } from "../middleware/requireEmployeeRoles.js";
import {
  getPublicUserByEmail,
  getPublicUserById,
  hashPassword,
  normalizeEmail,
  normalizeRole,
  setPublicUserPassword,
  upsertPublicUser,
} from "../lib/auth.js";

const router = express.Router();

// All admin routes require a valid ADMIN employee session.
router.use(requireEmployeeRoles(["ADMIN"]));

/**
 * =========================
 * UTIL
 * =========================
 */
function isActiveSub(s) {
  const st = String(s?.status || "").toUpperCase();
  if (st !== "ACTIVE") return false;
  const end = s?.end_date ? new Date(s.end_date).getTime() : null;
  if (!end) return true;
  return end > Date.now();
}

async function findPublicUserByEmail(email) {
  const target = normalizeEmail(email);
  if (!target) return null;
  return getPublicUserByEmail(target);
}

async function getPublicUserByIdSafe(userId) {
  if (!userId) return null;
  return getPublicUserById(userId);
}

async function resolveEmployeeUser(employee) {
  if (!employee) return null;
  const email = normalizeEmail(employee?.email);
  let publicUser = null;

  if (employee.user_id) {
    publicUser = await getPublicUserByIdSafe(employee.user_id);
  }

  if (publicUser && email) {
    const storedEmail = normalizeEmail(publicUser?.email);
    if (storedEmail && storedEmail !== email) {
      publicUser = null;
    }
  }

  if (!publicUser && email) {
    publicUser = await findPublicUserByEmail(email);
  }

  if (publicUser?.id && publicUser.id !== employee.user_id) {
    await supabase
      .from("employees")
      .update({ user_id: publicUser.id })
      .eq("id", employee.id);
  }

  return publicUser;
}

async function ensureEmployeeUser(employee, password) {
  if (!employee) return null;
  const email = normalizeEmail(employee?.email);
  if (!email) return null;

  let publicUser = await resolveEmployeeUser(employee);

  if (!publicUser) {
    if (!password) {
      const err = new Error("Password required to create employee user");
      err.statusCode = 400;
      throw err;
    }

    const fullName = String(employee?.full_name || "").trim();
    const role = normalizeRole(employee?.role || "DATA_ENTRY");
    const phone = String(employee?.phone || "").trim() || null;

    const password_hash = await hashPassword(password);

    publicUser = await upsertPublicUser({
      email,
      full_name: fullName,
      role,
      phone,
      password_hash,
      allowPasswordUpdate: true,
    });
  }

  if (publicUser?.id && publicUser.id !== employee.user_id) {
    await supabase.from("employees").update({ user_id: publicUser.id }).eq("id", employee.id);
  }

  return publicUser;
}

async function resolveBuyerRecordForAdmin(buyerId) {
  const id = String(buyerId || "").trim();
  if (!id) return { data: null, error: null };

  const byId = await supabase.from("buyers").select("*").eq("id", id).maybeSingle();
  if (byId.error) return { data: null, error: byId.error };
  if (byId.data) return { data: byId.data, error: null };

  const byUserId = await supabase.from("buyers").select("*").eq("user_id", id).maybeSingle();
  if (byUserId.error) return { data: null, error: byUserId.error };
  if (byUserId.data) return { data: byUserId.data, error: null };

  return { data: null, error: null };
}

async function resolveVendorRecordForAdmin(vendorId) {
  const id = String(vendorId || "").trim();
  if (!id) return { data: null, error: null };

  const byId = await supabase.from("vendors").select("*").eq("id", id).maybeSingle();
  if (byId.error) return { data: null, error: byId.error };
  if (byId.data) return { data: byId.data, error: null };

  const byUserId = await supabase.from("vendors").select("*").eq("user_id", id).maybeSingle();
  if (byUserId.error) return { data: null, error: byUserId.error };
  if (byUserId.data) return { data: byUserId.data, error: null };

  const normalizedIdEmail = normalizeIdentityEmail(id);
  if (normalizedIdEmail) {
    const byEmail = await supabase
      .from("vendors")
      .select("*")
      .ilike("email", normalizedIdEmail)
      .maybeSingle();
    if (byEmail.error) return { data: null, error: byEmail.error };
    if (byEmail.data) return { data: byEmail.data, error: null };
  }

  return { data: null, error: null };
}

const normalizeIdentityEmail = (value) => normalizeEmail(value || "");

async function fetchBuyerRoleIdentitySets() {
  const { data: users, error } = await supabase
    .from("users")
    .select("id, email")
    .eq("role", "BUYER");

  if (error) throw new Error(error.message || "Failed to fetch buyer role users");

  const buyerUserIds = new Set();
  const buyerEmails = new Set();

  (users || []).forEach((user) => {
    if (user?.id) buyerUserIds.add(String(user.id));
    const normalizedEmail = normalizeIdentityEmail(user?.email);
    if (normalizedEmail) buyerEmails.add(normalizedEmail);
  });

  return { buyerUserIds, buyerEmails };
}

function filterRowsToBuyerRole(rows = [], { buyerUserIds, buyerEmails }) {
  return (rows || []).filter((row) => {
    const rowUserId = String(row?.user_id || "").trim();
    const rowEmail = normalizeIdentityEmail(row?.email);
    if (rowUserId && buyerUserIds.has(rowUserId)) return true;
    if (rowEmail && buyerEmails.has(rowEmail)) return true;
    return false;
  });
}

function buildBuyerStatusUpdates(current, { isActive, reason = "" }) {
  const updates = { updated_at: new Date().toISOString() };

  if (typeof current?.is_active === "boolean" || "is_active" in (current || {})) {
    updates.is_active = !!isActive;
  }

  if (typeof current?.status === "string" || "status" in (current || {})) {
    updates.status = isActive ? "ACTIVE" : "TERMINATED";
  }

  if ("terminated_at" in (current || {})) {
    updates.terminated_at = isActive ? null : new Date().toISOString();
  }

  if ("terminated_reason" in (current || {})) {
    updates.terminated_reason = isActive ? null : (String(reason || "").trim() || null);
  }

  return updates;
}

function buildVendorStatusUpdates(current, { isActive, reason = "" }) {
  const updates = { updated_at: new Date().toISOString() };

  if (typeof current?.is_active === "boolean" || "is_active" in (current || {})) {
    updates.is_active = !!isActive;
  }

  if (typeof current?.status === "string" || "status" in (current || {})) {
    updates.status = isActive ? "ACTIVE" : "TERMINATED";
  }

  if ("terminated_at" in (current || {})) {
    updates.terminated_at = isActive ? null : new Date().toISOString();
  }

  if ("terminated_reason" in (current || {})) {
    updates.terminated_reason = isActive ? null : (String(reason || "").trim() || null);
  }

  return updates;
}

function buildAdminSupportTicketId() {
  const rand = Math.floor(100 + Math.random() * 900);
  return `TKT-${Date.now()}-${rand}`;
}

async function createSupportStatusTicket({
  entityType,
  entityId,
  entityName,
  action,
  reason = "",
}) {
  const normalizedEntity = String(entityType || "").trim().toUpperCase();
  const normalizedAction = String(action || "").trim().toUpperCase();
  const label = String(entityName || normalizedEntity || "Account").trim();
  const reasonText = String(reason || "").trim();
  const actor = normalizedEntity === "VENDOR" ? "Vendor" : "Buyer";
  const statusText = normalizedAction === "TERMINATED" ? "suspended" : "activated";

  const payload = {
    subject: `${actor} account ${statusText}: ${label}`,
    description:
      normalizedAction === "TERMINATED"
        ? `Admin suspended ${actor.toLowerCase()} "${label}".${reasonText ? ` Reason: ${reasonText}` : ""}`
        : `Admin activated ${actor.toLowerCase()} "${label}".`,
    category: "Account Status",
    priority: normalizedAction === "TERMINATED" ? "HIGH" : "MEDIUM",
    status: "OPEN",
    vendor_id: normalizedEntity === "VENDOR" ? entityId : null,
    buyer_id: normalizedEntity === "BUYER" ? entityId : null,
    ticket_display_id: buildAdminSupportTicketId(),
    attachments: JSON.stringify([]),
    created_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase.from("support_tickets").insert([payload]);
    if (error) {
      console.warn(
        `[admin] support ticket create failed for ${normalizedEntity} ${normalizedAction}:`,
        error?.message || error
      );
    }
  } catch (err) {
    console.warn(
      `[admin] support ticket create exception for ${normalizedEntity} ${normalizedAction}:`,
      err?.message || err
    );
  }
}

/**
 * =========================
 * AUDIT LOGS (READ)
 * =========================
 */
router.get("/audit-logs", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, user_id, action, entity_type, entity_id, details, ip_address, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      logs: (data || []).map((l) => ({
        id: l.id,
        created_at: l.created_at,
        action: l.action,
        entity_type: l.entity_type,
        entity_id: l.entity_id,
        ip_address: l.ip_address || null,
        details: l.details || {},
        actor: {
          id: l?.details?.actor_id || l.user_id || null,
          type: l?.details?.actor_type || null,
          role: l?.details?.actor_role || null,
          email: l?.details?.actor_email || null,
        },
      })),
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * =========================
 * VENDORS
 * =========================
 */
router.get("/vendors", async (req, res) => {
  try {
    const rawSearch = String(req.query?.search || "").trim();
    const search = rawSearch.replace(/,/g, " ").trim();
    const kycRaw = String(req.query?.kyc || req.query?.kyc_status || "all").trim();
    const activeRaw = String(req.query?.active || req.query?.status || "all").trim();
    const parsedLimit = Number(req.query?.limit);
    const parsedOffset = Number(req.query?.offset);
    const MAX_VENDOR_LIMIT = 1000;
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_VENDOR_LIMIT)
      : MAX_VENDOR_LIMIT;
    const safeOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0
      ? parsedOffset
      : 0;

    let vendorQuery = supabase
      .from("vendors")
      .select(
        "id, vendor_id, company_name, owner_name, email, phone, kyc_status, created_at, is_active",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1);

    const kyc = kycRaw.toUpperCase();
    if (kyc && kyc !== "ALL") {
      vendorQuery = vendorQuery.eq("kyc_status", kyc);
    }

    const active = activeRaw.toLowerCase();
    if (active === "active") {
      vendorQuery = vendorQuery.neq("is_active", false);
    } else if (active === "inactive" || active === "terminated" || active === "suspended") {
      vendorQuery = vendorQuery.eq("is_active", false);
    }

    if (search) {
      vendorQuery = vendorQuery.or(
        `company_name.ilike.%${search}%,owner_name.ilike.%${search}%,vendor_id.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data: vendors, error, count } = await vendorQuery;
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const vendorIds = (vendors || []).map((v) => v.id).filter(Boolean);
    const chunk = (arr, size = 120) => {
      const out = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };
    const countMap = {};
    if (vendorIds.length) {
      for (const ids of chunk(vendorIds)) {
        const { data: pRows, error: pErr } = await supabase
          .from("products")
          .select("vendor_id")
          .in("vendor_id", ids);

        if (pErr) {
          return res.status(500).json({ success: false, error: pErr.message });
        }

        (pRows || []).forEach((r) => {
          if (!r.vendor_id) return;
          countMap[r.vendor_id] = (countMap[r.vendor_id] || 0) + 1;
        });
      }
    }

    let activeSubByVendor = {};
    let planMap = {};

    if (vendorIds.length) {
      const subRows = [];
      for (const ids of chunk(vendorIds)) {
        const { data: subs, error: sErr } = await supabase
          .from("vendor_plan_subscriptions")
          .select("vendor_id, plan_id, status, start_date, end_date")
          .in("vendor_id", ids)
          .order("start_date", { ascending: false });

        if (sErr) {
          return res.status(500).json({ success: false, error: sErr.message });
        }
        if (Array.isArray(subs) && subs.length) subRows.push(...subs);
      }

      subRows.sort(
        (a, b) =>
          new Date(b?.start_date || 0).getTime() - new Date(a?.start_date || 0).getTime()
      );

      activeSubByVendor = {};
      (subRows || []).forEach((s) => {
        if (!s.vendor_id) return;
        if (activeSubByVendor[s.vendor_id]) return;
        if (isActiveSub(s)) activeSubByVendor[s.vendor_id] = s;
      });

      const planIds = Array.from(
        new Set(
          Object.values(activeSubByVendor)
            .map((x) => x?.plan_id)
            .filter(Boolean)
        )
      );

      if (planIds.length) {
        planMap = {};
        for (const ids of chunk(planIds)) {
          const { data: plans, error: pErr2 } = await supabase
            .from("vendor_plans")
            .select("id, name, price")
            .in("id", ids);

          if (pErr2) {
            return res.status(500).json({ success: false, error: pErr2.message });
          }

          (plans || []).forEach((p) => {
            planMap[p.id] = p;
          });
        }
      }
    }

    const result = (vendors || []).map((v) => {
      const sub = activeSubByVendor[v.id] || null;
      const plan = sub?.plan_id ? planMap[sub.plan_id] : null;
      return {
        ...v,
        product_count: countMap[v.id] || 0,
        package: plan
          ? {
              plan_id: plan.id,
              plan_name: plan.name,
              price: plan.price,
              end_date: sub?.end_date || null,
            }
          : { plan_id: null, plan_name: "FREE", price: 0, end_date: null },
      };
    });

    return res.json({
      success: true,
      vendors: result,
      total: Number.isFinite(count) ? count : result.length,
      limit: safeLimit,
      offset: safeOffset,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/vendors/:vendorId/products", async (req, res) => {
  try {
    const { vendorId } = req.params;
    if (!vendorId) {
      return res.status(400).json({ success: false, error: "vendorId missing" });
    }

    const { data: vendor, error: vErr } = await supabase
      .from("vendors")
      .select("id, vendor_id, company_name, owner_name, email, phone, kyc_status, is_active")
      .eq("id", vendorId)
      .maybeSingle();

    if (vErr) {
      return res.status(500).json({ success: false, error: vErr.message });
    }
    if (!vendor) {
      return res.status(404).json({ success: false, error: "Vendor not found" });
    }

    let query = supabase
      .from("products")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });

    const limit = Number(req.query?.limit);
    const offset = Number(req.query?.offset);
    if (Number.isFinite(limit) && limit > 0) {
      const safeLimit = Math.min(limit, 2000);
      const start = Number.isFinite(offset) && offset >= 0 ? offset : 0;
      query = query.range(start, start + safeLimit - 1);
    }

    const { data: products, error: pErr } = await query;
    if (pErr) {
      return res.status(500).json({ success: false, error: pErr.message });
    }

    const ids = (products || []).map((p) => p.id);
    let imagesByProduct = {};
    if (ids.length) {
      const { data: imgs, error: imgErr } = await supabase
        .from("product_images")
        .select("*")
        .in("product_id", ids);
      if (imgErr) {
        return res.status(500).json({ success: false, error: imgErr.message });
      }

      (imgs || []).forEach((img) => {
        imagesByProduct[img.product_id] = imagesByProduct[img.product_id] || [];
        imagesByProduct[img.product_id].push(img);
      });
    }

    const out = (products || []).map((p) => ({
      ...p,
      product_images: imagesByProduct[p.id] || [],
    }));

    return res.json({ success: true, vendor, products: out });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/vendors/:vendorId/terminate", async (req, res) => {
  try {
    const { vendorId } = req.params;
    const reason = String(req.body?.reason || "").trim();
    const { data: existing, error: findErr } = await resolveVendorRecordForAdmin(vendorId);
    if (findErr) {
      return res.status(500).json({ success: false, error: findErr.message });
    }
    if (!existing) {
      return res.status(404).json({ success: false, error: "Vendor not found" });
    }

    const updates = buildVendorStatusUpdates(existing, { isActive: false, reason });

    const { data, error } = await supabase
      .from("vendors")
      .update(updates)
      .eq("id", existing.id)
      .select()
      .maybeSingle();

    if (error)
      return res.status(500).json({ success: false, error: error.message });
    const updatedVendor = data || { ...existing, ...updates };

    await writeAuditLog({
      req,
      actor: req.actor,
      action: "VENDOR_TERMINATE",
      entityType: "vendors",
      entityId: existing.id,
      details: { reason },
    });

    await createSupportStatusTicket({
      entityType: "VENDOR",
      entityId: updatedVendor?.id || existing.id,
      entityName:
        updatedVendor?.company_name ||
        updatedVendor?.vendor_id ||
        updatedVendor?.owner_name ||
        "Vendor",
      action: "TERMINATED",
      reason,
    });

    if (updatedVendor?.user_id) {
      await notifyUser({
        user_id: updatedVendor.user_id,
        email: updatedVendor?.email || null,
        type: "ACCOUNT_SUSPENDED",
        title: "Account suspended",
        message: reason || "Your vendor account has been suspended by admin.",
        link: "/vendor/support",
        role: "VENDOR",
        full_name: updatedVendor?.owner_name || updatedVendor?.company_name || "Vendor",
      });
    } else if (updatedVendor?.email) {
      await notifyUser({
        email: updatedVendor.email,
        type: "ACCOUNT_SUSPENDED",
        title: "Account suspended",
        message: reason || "Your vendor account has been suspended by admin.",
        link: "/vendor/support",
        role: "VENDOR",
        full_name: updatedVendor?.owner_name || updatedVendor?.company_name || "Vendor",
      });
    }

    await Promise.all([
      notifyRole("SUPPORT", {
        type: "VENDOR_STATUS_UPDATED",
        title: "Vendor account suspended",
        message:
          `Admin suspended vendor "${updatedVendor?.company_name || updatedVendor?.vendor_id || "Vendor"}"` +
          `${reason ? `: ${reason}` : "."}`,
        link: "/employee/support/tickets/vendor",
      }),
      notifyRole("DATA_ENTRY", {
        type: "VENDOR_STATUS_UPDATED",
        title: "Vendor account suspended",
        message:
          `Admin suspended vendor "${updatedVendor?.company_name || updatedVendor?.vendor_id || "Vendor"}"` +
          `${reason ? `: ${reason}` : "."}`,
        link: "/employee/dataentry/vendors",
      }),
    ]);

    return res.json({ success: true, vendor: updatedVendor });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/vendors/:vendorId/activate", async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { data: existing, error: findErr } = await resolveVendorRecordForAdmin(vendorId);
    if (findErr) {
      return res.status(500).json({ success: false, error: findErr.message });
    }
    if (!existing) {
      return res.status(404).json({ success: false, error: "Vendor not found" });
    }

    const updates = buildVendorStatusUpdates(existing, { isActive: true });

    const { data, error } = await supabase
      .from("vendors")
      .update(updates)
      .eq("id", existing.id)
      .select()
      .maybeSingle();

    if (error)
      return res.status(500).json({ success: false, error: error.message });
    const updatedVendor = data || { ...existing, ...updates };

    await writeAuditLog({
      req,
      actor: req.actor,
      action: "VENDOR_ACTIVATE",
      entityType: "vendors",
      entityId: existing.id,
    });

    await createSupportStatusTicket({
      entityType: "VENDOR",
      entityId: updatedVendor?.id || existing.id,
      entityName:
        updatedVendor?.company_name ||
        updatedVendor?.vendor_id ||
        updatedVendor?.owner_name ||
        "Vendor",
      action: "ACTIVATED",
    });

    if (updatedVendor?.user_id) {
      await notifyUser({
        user_id: updatedVendor.user_id,
        email: updatedVendor?.email || null,
        type: "ACCOUNT_ACTIVATED",
        title: "Account re-activated",
        message: "Your vendor account has been activated by admin.",
        link: "/vendor/dashboard",
        role: "VENDOR",
        full_name: updatedVendor?.owner_name || updatedVendor?.company_name || "Vendor",
      });
    } else if (updatedVendor?.email) {
      await notifyUser({
        email: updatedVendor.email,
        type: "ACCOUNT_ACTIVATED",
        title: "Account re-activated",
        message: "Your vendor account has been activated by admin.",
        link: "/vendor/dashboard",
        role: "VENDOR",
        full_name: updatedVendor?.owner_name || updatedVendor?.company_name || "Vendor",
      });
    }

    await Promise.all([
      notifyRole("SUPPORT", {
        type: "VENDOR_STATUS_UPDATED",
        title: "Vendor account activated",
        message: `Admin activated vendor "${updatedVendor?.company_name || updatedVendor?.vendor_id || "Vendor"}".`,
        link: "/employee/support/tickets/vendor",
      }),
      notifyRole("DATA_ENTRY", {
        type: "VENDOR_STATUS_UPDATED",
        title: "Vendor account activated",
        message: `Admin activated vendor "${updatedVendor?.company_name || updatedVendor?.vendor_id || "Vendor"}".`,
        link: "/employee/dataentry/vendors",
      }),
    ]);

    return res.json({ success: true, vendor: updatedVendor });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * =========================
 * BUYERS (NEW – SAME AS VENDORS)
 * =========================
 */
router.get("/buyers", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("buyers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error)
      return res.status(500).json({ success: false, error: error.message });

    const roleIdentitySets = await fetchBuyerRoleIdentitySets();
    const roleFilteredBuyers = filterRowsToBuyerRole(data || [], roleIdentitySets);

    return res.json({ success: true, buyers: roleFilteredBuyers });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.put("/buyers/:buyerId", async (req, res) => {
  try {
    const { buyerId } = req.params;
    const { data: existing, error: findErr } = await resolveBuyerRecordForAdmin(buyerId);
    if (findErr) {
      return res.status(500).json({ success: false, error: findErr.message });
    }
    if (!existing) {
      return res.status(404).json({ success: false, error: "Buyer not found" });
    }

    const payload = {
      full_name: String(req.body?.full_name || req.body?.fullName || "").trim() || null,
      phone: String(req.body?.phone || "").trim() || null,
      company_name: String(req.body?.company_name || req.body?.companyName || "").trim() || null,
      address: String(req.body?.address || "").trim() || null,
      city: String(req.body?.city || "").trim() || null,
      state: String(req.body?.state || "").trim() || null,
      pincode: String(req.body?.pincode || "").trim() || null,
      pan_card: String(req.body?.pan_card || req.body?.panCard || "").trim().toUpperCase() || null,
      gst_number: String(req.body?.gst_number || req.body?.gstNumber || "").trim().toUpperCase() || null,
      updated_at: new Date().toISOString(),
    };

    const updates = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined) updates[key] = value;
    }

    const { data, error } = await supabase
      .from("buyers")
      .update(updates)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const updatedBuyer = data || { ...existing, ...updates };

    await writeAuditLog({
      req,
      actor: req.actor,
      action: "BUYER_UPDATE",
      entityType: "buyers",
      entityId: existing.id,
      details: { fields: Object.keys(updates) },
    });

    return res.json({ success: true, buyer: updatedBuyer });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/buyers/:buyerId/terminate", async (req, res) => {
  try {
    const { buyerId } = req.params;
    const reason = String(req.body?.reason || "").trim();

    const { data: existing, error: findErr } = await resolveBuyerRecordForAdmin(buyerId);
    if (findErr) {
      return res.status(500).json({ success: false, error: findErr.message });
    }
    if (!existing) {
      return res.status(404).json({ success: false, error: "Buyer not found" });
    }

    const updates = buildBuyerStatusUpdates(existing, { isActive: false, reason });

    const { data, error } = await supabase
      .from("buyers")
      .update(updates)
      .eq("id", existing.id)
      .select()
      .maybeSingle();

    if (error)
      return res.status(500).json({ success: false, error: error.message });

    const updatedBuyer = data || { ...existing, ...updates };

    await writeAuditLog({
      req,
      actor: req.actor,
      action: "BUYER_TERMINATE",
      entityType: "buyers",
      entityId: existing.id,
      details: { reason },
    });

    await createSupportStatusTicket({
      entityType: "BUYER",
      entityId: existing.id,
      entityName: updatedBuyer?.full_name || updatedBuyer?.company_name || "Buyer",
      action: "TERMINATED",
      reason,
    });

    if (updatedBuyer?.user_id) {
      await notifyUser({
        user_id: updatedBuyer.user_id,
        email: updatedBuyer?.email || null,
        type: "ACCOUNT_SUSPENDED",
        title: "Account suspended",
        message: reason || "Your buyer account has been suspended by admin.",
        link: "/buyer/tickets",
        role: "BUYER",
        full_name: updatedBuyer?.full_name || updatedBuyer?.company_name || "Buyer",
      });
    } else if (updatedBuyer?.email) {
      await notifyUser({
        email: updatedBuyer.email,
        type: "ACCOUNT_SUSPENDED",
        title: "Account suspended",
        message: reason || "Your buyer account has been suspended by admin.",
        link: "/buyer/tickets",
        role: "BUYER",
        full_name: updatedBuyer?.full_name || updatedBuyer?.company_name || "Buyer",
      });
    }

    await notifyRole("SUPPORT", {
      type: "BUYER_STATUS_UPDATED",
      title: "Buyer account suspended",
      message:
        `Admin suspended buyer "${updatedBuyer?.full_name || updatedBuyer?.company_name || "Buyer"}"` +
        `${reason ? `: ${reason}` : "."}`,
      link: "/employee/support/tickets/buyer",
    });

    return res.json({ success: true, buyer: updatedBuyer });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/buyers/:buyerId/activate", async (req, res) => {
  try {
    const { buyerId } = req.params;

    const { data: existing, error: findErr } = await resolveBuyerRecordForAdmin(buyerId);
    if (findErr) {
      return res.status(500).json({ success: false, error: findErr.message });
    }
    if (!existing) {
      return res.status(404).json({ success: false, error: "Buyer not found" });
    }

    const updates = buildBuyerStatusUpdates(existing, { isActive: true });

    const { data, error } = await supabase
      .from("buyers")
      .update(updates)
      .eq("id", existing.id)
      .select()
      .maybeSingle();

    if (error)
      return res.status(500).json({ success: false, error: error.message });

    const updatedBuyer = data || { ...existing, ...updates };

    await writeAuditLog({
      req,
      actor: req.actor,
      action: "BUYER_ACTIVATE",
      entityType: "buyers",
      entityId: existing.id,
    });

    await createSupportStatusTicket({
      entityType: "BUYER",
      entityId: existing.id,
      entityName: updatedBuyer?.full_name || updatedBuyer?.company_name || "Buyer",
      action: "ACTIVATED",
    });

    if (updatedBuyer?.user_id) {
      await notifyUser({
        user_id: updatedBuyer.user_id,
        email: updatedBuyer?.email || null,
        type: "ACCOUNT_ACTIVATED",
        title: "Account re-activated",
        message: "Your buyer account has been activated by admin.",
        link: "/buyer/dashboard",
        role: "BUYER",
        full_name: updatedBuyer?.full_name || updatedBuyer?.company_name || "Buyer",
      });
    } else if (updatedBuyer?.email) {
      await notifyUser({
        email: updatedBuyer.email,
        type: "ACCOUNT_ACTIVATED",
        title: "Account re-activated",
        message: "Your buyer account has been activated by admin.",
        link: "/buyer/dashboard",
        role: "BUYER",
        full_name: updatedBuyer?.full_name || updatedBuyer?.company_name || "Buyer",
      });
    }

    await notifyRole("SUPPORT", {
      type: "BUYER_STATUS_UPDATED",
      title: "Buyer account activated",
      message: `Admin activated buyer "${updatedBuyer?.full_name || updatedBuyer?.company_name || "Buyer"}".`,
      link: "/employee/support/tickets/buyer",
    });

    return res.json({ success: true, buyer: updatedBuyer });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * =========================
 * PRODUCTS
 * =========================
 */
router.put("/products/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    const { data, error } = await supabase
      .from("products")
      .update(req.body)
      .eq("id", productId)
      .select()
      .maybeSingle();

    if (error)
      return res.status(500).json({ success: false, error: error.message });

    await writeAuditLog({
      req,
      actor: req.actor,
      action: "PRODUCT_UPDATE",
      entityType: "products",
      entityId: productId,
      details: { payload: req.body },
    });

    return res.json({ success: true, product: data });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.delete("/products/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    await supabase.from("product_images").delete().eq("product_id", productId);
    await supabase.from("products").delete().eq("id", productId);

    await writeAuditLog({
      req,
      actor: req.actor,
      action: "PRODUCT_DELETE",
      entityType: "products",
      entityId: productId,
    });

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * =========================
 * STAFF
 * =========================
 */
router.get("/staff", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, employees: data || [] });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/staff", async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body;
    const password_hash = await hashPassword(password);
    const publicUser = await upsertPublicUser({
      email,
      full_name,
      role,
      password_hash,
      allowPasswordUpdate: true,
    });
    const userId = publicUser.id;

    const { data: emp } = await supabase
      .from("employees")
      .insert([
        {
          user_id: userId,
          full_name,
          email,
          role,
          status: "ACTIVE",
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    await writeAuditLog({
      req,
      actor: req.actor,
      action: "STAFF_CREATE",
      entityType: "employees",
      entityId: emp.id,
      details: { email, role, user_id: userId },
    });

    if (userId) {
      await notifyUser({
        user_id: userId,
        type: "WELCOME",
        title: "Welcome to the Admin Team",
        message: "Your staff account has been created. Please log in to continue.",
        link: "/employee/login",
      });
    }

    return res.json({ success: true, employee: emp });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.delete("/staff/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    const { data: emp } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .single();

    await supabase.from("employees").delete().eq("id", employeeId);
    if (emp?.user_id) {
      await supabase.from("users").delete().eq("id", emp.user_id);
    }

    await writeAuditLog({
      req,
      actor: req.actor,
      action: "STAFF_DELETE",
      entityType: "employees",
      entityId: employeeId,
      details: { user_id: emp?.user_id || null, email: emp?.email || null },
    });

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.put("/staff/:employeeId/password", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const password = String(req.body?.password || "").trim();
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .select("id, user_id, email")
      .eq("id", employeeId)
      .single();
    if (empErr) {
      return res.status(500).json({ success: false, error: empErr.message || "Failed to fetch employee" });
    }
    if (!emp?.id) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    let publicUser = await resolveEmployeeUser(emp);
    if (!publicUser?.id) {
      try {
        publicUser = await ensureEmployeeUser(emp, password);
      } catch (err) {
        const statusCode = err?.statusCode || 500;
        return res.status(statusCode).json({ success: false, error: err?.message || "Auth user create failed" });
      }
    }
    await setPublicUserPassword(publicUser.id, password);

    // Keep Supabase auth credential in sync for any auth-provider based login flows.
    if (supabase?.auth?.admin?.updateUserById) {
      const authIds = [emp?.user_id, publicUser?.id].filter(Boolean);
      const seen = new Set();
      for (const authUserId of authIds) {
        if (!authUserId || seen.has(authUserId)) continue;
        seen.add(authUserId);
        // best-effort: if candidate id is not an auth user id, continue silently
        // eslint-disable-next-line no-await-in-loop
        const { error: authErr } = await supabase.auth.admin.updateUserById(authUserId, { password });
        if (!authErr) break;
      }
    }

    await writeAuditLog({
      req,
      actor: req.actor,
      action: "STAFF_PASSWORD_CHANGE",
      entityType: "employees",
      entityId: employeeId,
      details: { user_id: publicUser.id || null, email: emp?.email || null },
    });

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});


// Dashboard counts (buyers/products/pending KYC)
router.get("/dashboard/counts", async (req, res) => {
  try {
    const [buyersRes, productsRes, pendingKycRes] = await Promise.all([
      supabase.from("buyers").select("*", { count: "exact", head: true }),
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase
        .from("vendors")
        .select("*", { count: "exact", head: true })
        .eq("kyc_status", "SUBMITTED"),
    ]);

    if (buyersRes.error) return res.status(500).json({ success: false, error: buyersRes.error.message });
    if (productsRes.error) return res.status(500).json({ success: false, error: productsRes.error.message });
    if (pendingKycRes.error) return res.status(500).json({ success: false, error: pendingKycRes.error.message });

    return res.json({
      success: true,
      counts: {
        totalBuyers: buyersRes.count || 0,
        totalProducts: productsRes.count || 0,
        pendingKyc: pendingKycRes.count || 0,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});


// -------------------------
// DASHBOARD DATA (ADMIN)
// -------------------------
router.get("/dashboard/recent-lead-purchases", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query?.limit || 10), 50);
    const { data, error } = await supabase
      .from("lead_purchases")
      .select("id, vendor_id, amount, payment_status, purchase_date, created_at, vendor:vendors(company_name)")
      .order("purchase_date", { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, orders: data || [] });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/dashboard/data-entry-performance", async (req, res) => {
  try {
    const { data: employees, error } = await supabase
      .from("employees")
      .select("id, full_name, email, user_id, role")
      .in("role", ["DATA_ENTRY", "DATAENTRY"]);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const performance = await Promise.all(
      (employees || []).map(async (emp) => {
        const displayName = emp.full_name || emp.email || "Data Entry";
        const publicUser = await resolveEmployeeUser(emp);
        const userId = publicUser?.id || emp.user_id;

        if (!userId) {
          return {
            id: emp.id,
            name: displayName,
            vendorsCreated: 0,
            productsListed: 0,
            hasUserId: false,
          };
        }

        const vendorFilter = [
          `created_by_user_id.eq.${userId}`,
          `assigned_to.eq.${userId}`,
          `user_id.eq.${userId}`,
          emp?.id ? `assigned_to.eq.${emp.id}` : null,
        ].filter(Boolean).join(',');
        const { count: vendorCount } = await supabase
          .from("vendors")
          .select("*", { count: "exact", head: true })
          .or(vendorFilter);

        const { data: vendors } = await supabase
          .from("vendors")
          .select("id")
          .or(vendorFilter);

        let productCount = 0;
        if (vendors && vendors.length > 0) {
          const vendorIds = vendors.map((v) => v.id);
          const { count: pCount } = await supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .in("vendor_id", vendorIds);
          productCount = pCount || 0;
        } else {
          const { count: pCount, error: pErr } = await supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("created_by", userId);
          if (!pErr) productCount = pCount || 0;
        }

        return {
          id: userId,
          name: displayName,
          vendorsCreated: vendorCount || 0,
          productsListed: productCount,
          hasUserId: true,
        };
      })
    );

    return res.json({ success: true, performance });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
