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

    return res.json({ success: true, vendors: vendors || [] });
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
      .select("user_id")
      .eq("id", employeeId)
      .single();

    await supabase.auth.admin.updateUserById(emp.user_id, { password });

    await writeAuditLog({
      req,
      actor: req.actor,
      action: "STAFF_PASSWORD_CHANGE",
      entityType: "employees",
      entityId: employeeId,
      details: { user_id: emp?.user_id || null },
    });

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
