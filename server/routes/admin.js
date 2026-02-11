import express from "express";
import { supabase } from "../lib/supabaseClient.js";
import { notifyUser } from "../lib/notify.js";
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
    const { data: vendors, error } = await supabase
      .from("vendors")
      .select(
        "id, vendor_id, company_name, owner_name, email, phone, kyc_status, created_at, is_active"
      )
      .order("created_at", { ascending: false });

    if (error)
      return res.status(500).json({ success: false, error: error.message });

    // product counts
    const { data: pRows, error: pErr } = await supabase
      .from("products")
      .select("vendor_id");

    if (pErr)
      return res.status(500).json({ success: false, error: pErr.message });

    const countMap = {};
    (pRows || []).forEach((r) => {
      if (!r.vendor_id) return;
      countMap[r.vendor_id] = (countMap[r.vendor_id] || 0) + 1;
    });

    // subscriptions + plans
    const { data: subs, error: sErr } = await supabase
      .from("vendor_plan_subscriptions")
      .select("vendor_id, plan_id, status, start_date, end_date")
      .order("start_date", { ascending: false });

    if (sErr)
      return res.status(500).json({ success: false, error: sErr.message });

    const activeSubByVendor = {};
    (subs || []).forEach((s) => {
      if (!s.vendor_id) return;
      if (activeSubByVendor[s.vendor_id]) return;
      if (isActiveSub(s)) activeSubByVendor[s.vendor_id] = s;
    });

    const planIds = Array.from(
      new Set(Object.values(activeSubByVendor).map((x) => x.plan_id).filter(Boolean))
    );

    let planMap = {};
    if (planIds.length) {
      const { data: plans, error: pErr2 } = await supabase
        .from("vendor_plans")
        .select("id, name, price")
        .in("id", planIds);

      if (pErr2)
        return res.status(500).json({ success: false, error: pErr2.message });

      (plans || []).forEach((p) => {
        planMap[p.id] = p;
      });
    }

    const result = (vendors || []).map((v) => {
      const sub = activeSubByVendor[v.id] || null;
      const plan = sub?.plan_id ? planMap[sub.plan_id] : null;
      return {
        ...v,
        product_count: countMap[v.id] || 0,
        package: plan
          ? { plan_id: plan.id, plan_name: plan.name, price: plan.price, end_date: sub?.end_date || null }
          : { plan_id: null, plan_name: "FREE", price: 0, end_date: null },
      };
    });

    return res.json({ success: true, vendors: result });
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

    const { data, error } = await supabase
      .from("vendors")
      .update({ is_active: false })
      .eq("id", vendorId)
      .select()
      .maybeSingle();

    if (error)
      return res.status(500).json({ success: false, error: error.message });

    await writeAuditLog({
      req,
      actor: req.actor,
      action: "VENDOR_TERMINATE",
      entityType: "vendors",
      entityId: vendorId,
      details: { reason },
    });

    if (data?.user_id) {
      await notifyUser({
        user_id: data.user_id,
        type: "ACCOUNT_SUSPENDED",
        title: "Account suspended",
        message: reason || "Your vendor account has been suspended by admin.",
        link: "/vendor/support",
      });
    }

    return res.json({ success: true, vendor: data });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/vendors/:vendorId/activate", async (req, res) => {
  try {
    const { vendorId } = req.params;

    const { data, error } = await supabase
      .from("vendors")
      .update({ is_active: true })
      .eq("id", vendorId)
      .select()
      .maybeSingle();

    if (error)
      return res.status(500).json({ success: false, error: error.message });

    await writeAuditLog({
      req,
      actor: req.actor,
      action: "VENDOR_ACTIVATE",
      entityType: "vendors",
      entityId: vendorId,
    });

    if (data?.user_id) {
      await notifyUser({
        user_id: data.user_id,
        type: "ACCOUNT_ACTIVATED",
        title: "Account re-activated",
        message: "Your vendor account has been activated by admin.",
        link: "/vendor/dashboard",
      });
    }

    return res.json({ success: true, vendor: data });
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

    return res.json({ success: true, buyers: data || [] });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/buyers/:buyerId/terminate", async (req, res) => {
  try {
    const { buyerId } = req.params;
    const reason = String(req.body?.reason || "").trim();

    const { data, error } = await supabase
      .from("buyers")
      .update({ is_active: false })
      .eq("id", buyerId)
      .select()
      .maybeSingle();

    if (error)
      return res.status(500).json({ success: false, error: error.message });

    await writeAuditLog({
      req,
      actor: req.actor,
      action: "BUYER_TERMINATE",
      entityType: "buyers",
      entityId: buyerId,
      details: { reason },
    });

    if (data?.user_id) {
      await notifyUser({
        user_id: data.user_id,
        type: "ACCOUNT_SUSPENDED",
        title: "Account suspended",
        message: reason || "Your buyer account has been suspended by admin.",
        link: "/buyer/tickets",
      });
    }

    return res.json({ success: true, buyer: data });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/buyers/:buyerId/activate", async (req, res) => {
  try {
    const { buyerId } = req.params;

    const { data, error } = await supabase
      .from("buyers")
      .update({ is_active: true })
      .eq("id", buyerId)
      .select()
      .maybeSingle();

    if (error)
      return res.status(500).json({ success: false, error: error.message });

    await writeAuditLog({
      req,
      actor: req.actor,
      action: "BUYER_ACTIVATE",
      entityType: "buyers",
      entityId: buyerId,
    });

    if (data?.user_id) {
      await notifyUser({
        user_id: data.user_id,
        type: "ACCOUNT_ACTIVATED",
        title: "Account re-activated",
        message: "Your buyer account has been activated by admin.",
        link: "/buyer/dashboard",
      });
    }

    return res.json({ success: true, buyer: data });
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
    const { password } = req.body;

    const { data: emp } = await supabase
      .from("employees")
      .select("id, user_id, email")
      .eq("id", employeeId)
      .single();

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
