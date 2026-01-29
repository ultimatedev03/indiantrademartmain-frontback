import express from "express";
import { supabase } from "../lib/supabaseClient.js";
import { notifyUser } from "../lib/notify.js";
import { writeAuditLog } from "../lib/audit.js";
import { requireEmployeeRoles } from "../middleware/requireEmployeeRoles.js";

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

async function findAuthUserByEmail(email) {
  const target = String(email || "").trim().toLowerCase();
  if (!target) return null;

  if (supabase?.auth?.admin?.getUserByEmail) {
    const { data, error } = await supabase.auth.admin.getUserByEmail(target);
    if (error) return null;
    return data?.user || null;
  }

  // Fallback: list users and match by email (bounded).
  const perPage = 100;
  const maxPages = 50;
  for (let page = 1; page <= maxPages; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) return null;
    const users = data?.users || [];
    const match = users.find(
      (u) => String(u?.email || "").trim().toLowerCase() === target
    );
    if (match) return match;
    if (users.length < perPage) break;
  }
  return null;
}

async function getAuthUserById(userId) {
  if (!userId) return null;
  if (!supabase?.auth?.admin?.getUserById) return null;
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) return null;
  return data?.user || null;
}

async function resolveEmployeeAuthUser(employee) {
  if (!employee) return null;
  const email = String(employee?.email || "").trim().toLowerCase();
  let authUser = null;

  if (employee.user_id) {
    authUser = await getAuthUserById(employee.user_id);
  }

  if (authUser && email) {
    const authEmail = String(authUser?.email || "").trim().toLowerCase();
    if (authEmail && authEmail !== email) {
      authUser = null;
    }
  }

  if (!authUser && email) {
    authUser = await findAuthUserByEmail(email);
  }

  if (authUser && authUser.id && authUser.id !== employee.user_id) {
    await supabase
      .from("employees")
      .update({ user_id: authUser.id })
      .eq("id", employee.id);
  }

  return authUser;
}

async function ensureEmployeeAuthUser(employee, password) {
  if (!employee) return null;
  const email = String(employee?.email || "").trim().toLowerCase();
  if (!email) return null;

  let authUser = await resolveEmployeeAuthUser(employee);

  if (!authUser) {
    const fullName = String(employee?.full_name || "").trim();
    const role = String(employee?.role || "DATA_ENTRY").trim().toUpperCase();
    const department = String(employee?.department || "").trim() || "Operations";
    const phone = String(employee?.phone || "").trim() || null;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role, phone, department },
      app_metadata: { role },
    });

    if (error || !data?.user) {
      const err = new Error(error?.message || "Failed to create employee auth user");
      err.statusCode = 500;
      throw err;
    }

    authUser = data.user;
  }

  if (authUser?.id && authUser.id !== employee.user_id) {
    await supabase.from("employees").update({ user_id: authUser.id }).eq("id", employee.id);
  }

  return authUser;
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

    const { data: authData, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (error) throw error;

    const userId = authData.user.id;

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
    await supabase.auth.admin.deleteUser(emp.user_id);

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

    let authUser = await resolveEmployeeAuthUser(emp);
    if (!authUser?.id) {
      try {
        authUser = await ensureEmployeeAuthUser(emp, password);
      } catch (err) {
        const statusCode = err?.statusCode || 500;
        return res.status(statusCode).json({ success: false, error: err?.message || "Auth user create failed" });
      }
    }

    const { error: updErr } = await supabase.auth.admin.updateUserById(authUser.id, { password });
    if (updErr) {
      return res.status(500).json({ success: false, error: updErr.message });
    }

    await writeAuditLog({
      req,
      actor: req.actor,
      action: "STAFF_PASSWORD_CHANGE",
      entityType: "employees",
      entityId: employeeId,
      details: { user_id: authUser.id || null, email: emp?.email || null },
    });

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
