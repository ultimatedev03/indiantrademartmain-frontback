import express from "express";
import { supabase } from "../lib/supabaseClient.js";

const router = express.Router();

async function writeAudit({ user_id = null, action, entity_type, entity_id = null, details = {} }) {
  try {
    await supabase.from("audit_logs").insert([
      { user_id, action, entity_type, entity_id, details, created_at: new Date().toISOString() }
    ]);
  } catch {
    // ignore
  }
}

function isActiveSub(s) {
  const st = String(s?.status || "").toUpperCase();
  if (st !== "ACTIVE") return false;
  const end = s?.end_date ? new Date(s.end_date).getTime() : null;
  if (!end) return true;
  return end > Date.now();
}

// GET /api/admin/vendors
router.get("/vendors", async (req, res) => {
  try {
    const { data: vendors, error: vErr } = await supabase
      .from("vendors")
      .select("id, vendor_id, company_name, owner_name, email, phone, kyc_status, created_at, is_active")
      .order("created_at", { ascending: false });

    if (vErr) return res.status(500).json({ success: false, error: "Failed to fetch vendors", details: vErr.message });

    const { data: pRows } = await supabase.from("products").select("vendor_id");
    const countMap = {};
    (pRows || []).forEach((r) => {
      if (!r.vendor_id) return;
      countMap[r.vendor_id] = (countMap[r.vendor_id] || 0) + 1;
    });

    const { data: subs } = await supabase
      .from("vendor_plan_subscriptions")
      .select("vendor_id, plan_id, status, start_date, end_date")
      .order("start_date", { ascending: false });

    const activeSubByVendor = {};
    (subs || []).forEach((s) => {
      if (!s.vendor_id) return;
      if (activeSubByVendor[s.vendor_id]) return;
      if (isActiveSub(s)) activeSubByVendor[s.vendor_id] = s;
    });

    const planIds = Array.from(new Set(Object.values(activeSubByVendor).map((x) => x.plan_id).filter(Boolean)));

    let planMap = {};
    if (planIds.length) {
      const { data: plans } = await supabase.from("vendor_plans").select("id, name, price").in("id", planIds);
      (plans || []).forEach((p) => (planMap[p.id] = p));
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
    return res.status(500).json({ success: false, error: "Failed to fetch vendors", details: e.message });
  }
});

// POST /api/admin/vendors/:vendorId/terminate
router.post("/vendors/:vendorId/terminate", async (req, res) => {
  try {
    const { vendorId } = req.params;
    const reason = String(req.body?.reason || "").trim();

    const { data, error } = await supabase
      .from("vendors")
      .update({ is_active: false })
      .eq("id", vendorId)
      .select("id, company_name, is_active")
      .maybeSingle();

    if (error) return res.status(500).json({ success: false, error: "Terminate failed", details: error.message });

    await writeAudit({ action: "VENDOR_TERMINATE", entity_type: "vendors", entity_id: vendorId, details: { reason: reason || null } });

    return res.json({ success: true, vendor: data });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Terminate failed", details: e.message });
  }
});

// POST /api/admin/vendors/:vendorId/activate
router.post("/vendors/:vendorId/activate", async (req, res) => {
  try {
    const { vendorId } = req.params;

    const { data, error } = await supabase
      .from("vendors")
      .update({ is_active: true })
      .eq("id", vendorId)
      .select("id, company_name, is_active")
      .maybeSingle();

    if (error) return res.status(500).json({ success: false, error: "Activate failed", details: error.message });

    await writeAudit({ action: "VENDOR_ACTIVATE", entity_type: "vendors", entity_id: vendorId, details: {} });

    return res.json({ success: true, vendor: data });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Activate failed", details: e.message });
  }
});

// GET /api/admin/vendors/:vendorId/products
router.get("/vendors/:vendorId/products", async (req, res) => {
  try {
    const { vendorId } = req.params;

    const { data: vendor, error: vErr } = await supabase
      .from("vendors")
      .select("id, vendor_id, company_name, owner_name, email, phone, kyc_status, is_active")
      .eq("id", vendorId)
      .maybeSingle();

    if (vErr) return res.status(500).json({ success: false, error: "Failed to fetch vendor", details: vErr.message });

    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });

    if (pErr) return res.status(500).json({ success: false, error: "Failed to fetch products", details: pErr.message });

    const ids = (products || []).map((p) => p.id);
    let imagesByProduct = {};
    if (ids.length) {
      const { data: imgs } = await supabase.from("product_images").select("*").in("product_id", ids);
      (imgs || []).forEach((img) => {
        imagesByProduct[img.product_id] = imagesByProduct[img.product_id] || [];
        imagesByProduct[img.product_id].push(img);
      });
    }

    const out = (products || []).map((p) => ({ ...p, product_images: imagesByProduct[p.id] || [] }));

    return res.json({ success: true, vendor, products: out });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Failed to fetch products", details: e.message });
  }
});

// PUT /api/admin/products/:productId
router.put("/products/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    const allowed = [
      "name",
      "description",
      "price",
      "status",
      "moq",
      "stock",
      "is_service",
      "video_url",
      "pdf_url",
      "price_unit",
      "min_order_qty",
      "qty_unit",
    ];

    const payload = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) payload[k] = req.body[k];
    });

    if (!Object.keys(payload).length) {
      return res.status(400).json({ success: false, error: "No fields to update" });
    }

    const { data, error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", productId)
      .select("*")
      .maybeSingle();

    if (error) return res.status(500).json({ success: false, error: "Update failed", details: error.message });

    await writeAudit({ action: "PRODUCT_UPDATE", entity_type: "products", entity_id: productId, details: { payload } });

    return res.json({ success: true, product: data });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Update failed", details: e.message });
  }
});

// DELETE /api/admin/products/:productId
router.delete("/products/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    await supabase.from("product_images").delete().eq("product_id", productId);

    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) return res.status(500).json({ success: false, error: "Delete failed", details: error.message });

    await writeAudit({ action: "PRODUCT_DELETE", entity_type: "products", entity_id: productId, details: {} });

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Delete failed", details: e.message });
  }
});

// ------------------------------------------------------------
// STAFF (EMPLOYEES) MANAGEMENT
// IMPORTANT:
// - This must run on the server because creating Auth users and
//   bypassing RLS requires the service_role key.
// - The frontend (Admin Portal) should call these routes via
//   /api/admin/staff (Vite proxy) or /.netlify/functions/admin/staff.
// ------------------------------------------------------------

// GET /api/admin/staff
router.get("/staff", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch staff",
        details: error.message,
      });
    }

    // Normalize fields so UI doesn't break if old columns exist
    const employees = (data || []).map((r) => ({
      ...r,
      full_name: r.full_name || r.name || r.employee_name || "",
      email: r.email || "",
      role: r.role || "",
      department: r.department || r.dept || "",
      status: r.status || "ACTIVE",
      created_at: r.created_at || r.joined || r.createdAt || new Date().toISOString(),
    }));

    return res.json({ success: true, employees });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: "Failed to fetch staff",
      details: e.message,
    });
  }
});

// POST /api/admin/staff
router.post("/staff", async (req, res) => {
  try {
    const full_name = String(req.body?.full_name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const role = String(req.body?.role || "DATA_ENTRY").trim().toUpperCase();
    const department = String(req.body?.department || "Operations").trim();

    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "full_name, email and password are required",
      });
    }

    // 1) Create Auth user (service role)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        phone,
        department,
      },
    });

    if (authError || !authData?.user) {
      return res.status(500).json({
        success: false,
        error: "Failed to create auth user",
        details: authError?.message || "Unknown error",
      });
    }

    const userId = authData.user.id;

    // 2) Upsert into public.users (best-effort)
    await supabase.from("users").upsert(
      [
        {
          id: userId,
          email,
          full_name,
          role,
          phone: phone || null,
          created_at: new Date().toISOString(),
        },
      ],
      { onConflict: "id" }
    );

    // 3) Upsert into employees
    const empPayload = {
      user_id: userId,
      full_name,
      email,
      phone: phone || null,
      role,
      department,
      status: "ACTIVE",
      created_at: new Date().toISOString(),
    };

    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .upsert([empPayload], { onConflict: "user_id" })
      .select("*")
      .maybeSingle();

    if (empErr) {
      // rollback auth user if employee insert fails (best effort)
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch {
        // ignore
      }
      return res.status(500).json({
        success: false,
        error: "Failed to create employee",
        details: empErr.message,
      });
    }

    await writeAudit({
      action: "STAFF_CREATE",
      entity_type: "employees",
      entity_id: emp?.id || null,
      details: { user_id: userId, email, role, department },
    });

    return res.json({ success: true, employee: emp || empPayload });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: "Failed to create employee",
      details: e.message,
    });
  }
});

// DELETE /api/admin/staff/:employeeId
router.delete("/staff/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) {
      return res.status(400).json({ success: false, error: "employeeId missing" });
    }

    // Find employee to get user_id (for auth deletion)
    const { data: emp, error: empFetchErr } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .maybeSingle();

    if (empFetchErr) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch employee",
        details: empFetchErr.message,
      });
    }

    const userId = emp?.user_id || null;

    const { error: delEmpErr } = await supabase.from("employees").delete().eq("id", employeeId);
    if (delEmpErr) {
      return res.status(500).json({
        success: false,
        error: "Failed to delete employee",
        details: delEmpErr.message,
      });
    }

    // best effort cleanup
    if (userId) {
      await supabase.from("users").delete().eq("id", userId);
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch {
        // ignore
      }
    }

    await writeAudit({
      action: "STAFF_DELETE",
      entity_type: "employees",
      entity_id: employeeId,
      details: { user_id: userId || null },
    });

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: "Failed to delete employee",
      details: e.message,
    });
  }
});

// PUT /api/admin/staff/password  (fallback for older frontend)
router.put("/staff/password", async (req, res) => {
  try {
    const employeeId = String(req.body?.employeeId || req.body?.id || "").trim();
    const password = String(req.body?.password || "").trim();

    if (!employeeId) return res.status(400).json({ success: false, error: "employeeId missing" });
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .select("id,user_id,email,full_name")
      .eq("id", employeeId)
      .maybeSingle();

    if (empErr) return res.status(500).json({ success: false, error: "Failed to fetch employee", details: empErr.message });
    if (!emp?.user_id) return res.status(400).json({ success: false, error: "Employee has no user_id" });

    const { error: updErr } = await supabase.auth.admin.updateUserById(emp.user_id, { password });
    if (updErr) return res.status(500).json({ success: false, error: "Failed to update password", details: updErr.message });

    await writeAudit({
      action: "STAFF_PASSWORD_CHANGE",
      entity_type: "employees",
      entity_id: employeeId,
      details: { user_id: emp.user_id, email: emp.email }
    });

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Failed to update password", details: e.message });
  }
});

// PUT /api/admin/staff/:employeeId/password
router.put("/staff/:employeeId/password", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const password = String(req.body?.password || "").trim();

    if (!employeeId) {
      return res.status(400).json({ success: false, error: "employeeId missing" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    // find employee to get auth user_id
    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .select("id,user_id,email,full_name")
      .eq("id", employeeId)
      .maybeSingle();

    if (empErr) {
      return res.status(500).json({ success: false, error: "Failed to fetch employee", details: empErr.message });
    }
    if (!emp?.user_id) {
      return res.status(400).json({ success: false, error: "Employee has no user_id" });
    }

    const { error: updErr } = await supabase.auth.admin.updateUserById(emp.user_id, { password });
    if (updErr) {
      return res.status(500).json({ success: false, error: "Failed to update password", details: updErr.message });
    }

    await writeAudit({
      action: "STAFF_PASSWORD_CHANGE",
      entity_type: "employees",
      entity_id: employeeId,
      details: { user_id: emp.user_id, email: emp.email }
    });

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Failed to update password", details: e.message });
  }
});

export default router;
