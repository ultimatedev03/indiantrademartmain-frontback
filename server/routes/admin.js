import express from "express";
import { supabase } from "../lib/supabaseClient.js";

const router = express.Router();

/**
 * =========================
 * AUDIT LOG HELPER
 * =========================
 */
async function writeAudit({
  user_id = null,
  action,
  entity_type,
  entity_id = null,
  details = {},
}) {
  try {
    await supabase.from("audit_logs").insert([
      {
        user_id,
        action,
        entity_type,
        entity_id,
        details,
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (e) {
    console.error("Audit log failed:", e.message);
  }
}

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
      .select(
        `
        id,
        action,
        entity_type,
        entity_id,
        details,
        created_at,
        user:users(email)
      `
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      logs: (data || []).map((l) => ({
        timestamp: l.created_at,
        user: l.user?.email || "System",
        action: l.action,
        resource: l.entity_type,
        resource_id: l.entity_id,
        status: "SUCCESS",
        details: l.details || {},
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
      return res
        .status(500)
        .json({ success: false, error: error.message });

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

    await writeAudit({
      user_id: req.adminUser?.id,
      action: "VENDOR_TERMINATE",
      entity_type: "vendors",
      entity_id: vendorId,
      details: { reason },
    });

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

    await writeAudit({
      user_id: req.adminUser?.id,
      action: "VENDOR_ACTIVATE",
      entity_type: "vendors",
      entity_id: vendorId,
    });

    return res.json({ success: true, vendor: data });
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

    await writeAudit({
      user_id: req.adminUser?.id,
      action: "PRODUCT_UPDATE",
      entity_type: "products",
      entity_id: productId,
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

    await writeAudit({
      user_id: req.adminUser?.id,
      action: "PRODUCT_DELETE",
      entity_type: "products",
      entity_id: productId,
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

    await writeAudit({
      user_id: req.adminUser?.id,
      action: "STAFF_CREATE",
      entity_type: "employees",
      entity_id: emp.id,
      details: { email, role },
    });

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

    await writeAudit({
      user_id: req.adminUser?.id,
      action: "STAFF_DELETE",
      entity_type: "employees",
      entity_id: employeeId,
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

    await writeAudit({
      user_id: req.adminUser?.id,
      action: "STAFF_PASSWORD_CHANGE",
      entity_type: "employees",
      entity_id: employeeId,
    });

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

export default router;