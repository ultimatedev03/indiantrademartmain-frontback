import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  },
  body: JSON.stringify(body),
});

const ok = (b) => json(200, b);
const bad = (msg, details) => json(400, { success: false, error: msg, details });
const fail = (msg, details) => json(500, { success: false, error: msg, details });

function parseTail(eventPath) {
  const parts = String(eventPath || "").split("/").filter(Boolean);
  const fnIndex = parts.indexOf("admin");
  if (fnIndex >= 0) return parts.slice(fnIndex + 1);
  return parts;
}

async function readBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return {};
  }
}

async function writeAudit({ user_id = null, action, entity_type, entity_id = null, details = {} }) {
  try {
    await supabase.from("audit_logs").insert([
      { user_id, action, entity_type, entity_id, details, created_at: new Date().toISOString() }
    ]);
  } catch {
    // ignore audit errors
  }
}

const nowIso = () => new Date().toISOString();

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

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") return ok({ ok: true });

    const tail = parseTail(event.path);

    // -------------------------
    // STAFF MANAGEMENT
    // GET /staff
    // POST /staff
    // DELETE /staff/:employeeId
    // PUT /staff/:employeeId/password
    // PUT /staff/password (fallback)
    // -------------------------
    if (tail[0] === "staff") {
      // GET /staff
      if (event.httpMethod === "GET" && tail.length === 1) {
        const { data, error } = await supabase
          .from("employees")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) return fail("Failed to fetch staff", error.message);

        const employees = (data || []).map((r) => ({
          ...r,
          full_name: r.full_name || r.name || r.employee_name || "",
          email: r.email || "",
          role: r.role || "",
          department: r.department || r.dept || "",
          status: r.status || "ACTIVE",
          created_at: r.created_at || r.joined || r.createdAt || new Date().toISOString(),
        }));

        return ok({ success: true, employees });
      }

      // POST /staff
      if (event.httpMethod === "POST" && tail.length === 1) {
        const body = await readBody(event);
        const full_name = String(body?.full_name || "").trim();
        const email = String(body?.email || "").trim().toLowerCase();
        const password = String(body?.password || "").trim();
        const phone = String(body?.phone || "").trim();
        const role = String(body?.role || "DATA_ENTRY").trim().toUpperCase();
        const department = String(body?.department || "Operations").trim();

        if (!full_name || !email || !password) return bad("full_name, email and password are required");

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name, role, phone, department },
        });

        if (authError || !authData?.user) return fail("Failed to create auth user", authError?.message);

        const userId = authData.user.id;

        // best-effort upsert into public.users
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
          try {
            await supabase.auth.admin.deleteUser(userId);
          } catch {
            // ignore
          }
          return fail("Failed to create employee", empErr.message);
        }

        await writeAudit({
          action: "STAFF_CREATE",
          entity_type: "employees",
          entity_id: emp?.id || null,
          details: { user_id: userId, email, role, department },
        });

        await notifyUser({
          user_id: userId,
          type: "WELCOME",
          title: "Welcome to the Admin Team",
          message: "Your staff account has been created. Please log in to continue.",
          link: "/employee/login",
        });

        return ok({ success: true, employee: emp || empPayload });
      }

      // PUT /staff/:employeeId/password
      if (event.httpMethod === "PUT" && tail.length === 3 && tail[2] === "password") {
        const employeeId = tail[1];
        const body = await readBody(event);
        const password = String(body?.password || "").trim();

        if (!employeeId) return bad("employeeId missing");
        if (!password || password.length < 6) return bad("Password must be at least 6 characters");

        const { data: emp, error: empErr } = await supabase
          .from("employees")
          .select("id,user_id,email,full_name")
          .eq("id", employeeId)
          .maybeSingle();

        if (empErr) return fail("Failed to fetch employee", empErr.message);
        let authUser = await resolveEmployeeAuthUser(emp);
        if (!authUser?.id) {
          try {
            authUser = await ensureEmployeeAuthUser(emp, password);
          } catch (err) {
            const statusCode = err?.statusCode || 500;
            return json(statusCode, { success: false, error: err?.message || "Auth user create failed" });
          }
        }

        const { error: updErr } = await supabase.auth.admin.updateUserById(authUser.id, { password });
        if (updErr) return fail("Failed to update password", updErr.message);

        await writeAudit({
          action: "STAFF_PASSWORD_CHANGE",
          entity_type: "employees",
          entity_id: employeeId,
          details: { user_id: authUser.id, email: emp.email },
        });

        return ok({ success: true });
      }

      // PUT /staff/password (fallback)
      if (event.httpMethod === "PUT" && tail.length === 2 && tail[1] === "password") {
        const body = await readBody(event);
        const employeeId = String(body?.employeeId || body?.id || "").trim();
        const password = String(body?.password || "").trim();

        if (!employeeId) return bad("employeeId missing");
        if (!password || password.length < 6) return bad("Password must be at least 6 characters");

        const { data: emp, error: empErr } = await supabase
          .from("employees")
          .select("id,user_id,email,full_name")
          .eq("id", employeeId)
          .maybeSingle();

        if (empErr) return fail("Failed to fetch employee", empErr.message);
        let authUser = await resolveEmployeeAuthUser(emp);
        if (!authUser?.id) {
          try {
            authUser = await ensureEmployeeAuthUser(emp, password);
          } catch (err) {
            const statusCode = err?.statusCode || 500;
            return json(statusCode, { success: false, error: err?.message || "Auth user create failed" });
          }
        }

        const { error: updErr } = await supabase.auth.admin.updateUserById(authUser.id, { password });
        if (updErr) return fail("Failed to update password", updErr.message);

        await writeAudit({
          action: "STAFF_PASSWORD_CHANGE",
          entity_type: "employees",
          entity_id: employeeId,
          details: { user_id: authUser.id, email: emp.email },
        });

        return ok({ success: true });
      }

      // DELETE /staff/:employeeId
      if (event.httpMethod === "DELETE" && tail.length === 2) {
        const employeeId = tail[1];
        if (!employeeId) return bad("employeeId missing");

        const { data: emp, error: empFetchErr } = await supabase
          .from("employees")
          .select("*")
          .eq("id", employeeId)
          .maybeSingle();

        if (empFetchErr) return fail("Failed to fetch employee", empFetchErr.message);

        const userId = emp?.user_id || null;

        const { error: delEmpErr } = await supabase.from("employees").delete().eq("id", employeeId);
        if (delEmpErr) return fail("Failed to delete employee", delEmpErr.message);

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

        return ok({ success: true });
      }

      return bad("Unsupported staff route");
    }

// -------------------------
    // GET /vendors  (with product_count + plan)
    // -------------------------
    if (event.httpMethod === "GET" && tail[0] === "vendors" && tail.length === 1) {
      const { data: vendors, error: vErr } = await supabase
        .from("vendors")
        .select("id, vendor_id, company_name, owner_name, email, phone, kyc_status, created_at, is_active")
        .order("created_at", { ascending: false });

      if (vErr) return fail("Failed to fetch vendors", vErr.message);

      // product counts
      const { data: pRows } = await supabase.from("products").select("vendor_id");
      const countMap = {};
      (pRows || []).forEach((r) => {
        if (!r.vendor_id) return;
        countMap[r.vendor_id] = (countMap[r.vendor_id] || 0) + 1;
      });

      // subscriptions + plans
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

      const planIds = Array.from(
        new Set(Object.values(activeSubByVendor).map((x) => x.plan_id).filter(Boolean))
      );

      let planMap = {};
      if (planIds.length) {
        const { data: plans } = await supabase
          .from("vendor_plans")
          .select("id, name, price")
          .in("id", planIds);

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

      return ok({ success: true, vendors: result });
    }

    // -------------------------
    // POST /vendors/:vendorId/terminate
    // -------------------------
    if (event.httpMethod === "POST" && tail[0] === "vendors" && tail[2] === "terminate") {
      const vendorId = tail[1];
      if (!vendorId) return bad("vendorId missing");
      const body = await readBody(event);
      const reason = String(body?.reason || "").trim();

      const { data, error } = await supabase
        .from("vendors")
        .update({ is_active: false })
        .eq("id", vendorId)
        .select("id, company_name, is_active")
        .maybeSingle();

      if (error) return fail("Terminate failed", error.message);

      await writeAudit({
        action: "VENDOR_TERMINATE",
        entity_type: "vendors",
        entity_id: vendorId,
        details: { reason: reason || null },
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

      return ok({ success: true, vendor: data });
    }

    // -------------------------
    // POST /vendors/:vendorId/activate
    // -------------------------
    if (event.httpMethod === "POST" && tail[0] === "vendors" && tail[2] === "activate") {
      const vendorId = tail[1];
      if (!vendorId) return bad("vendorId missing");

      const { data, error } = await supabase
        .from("vendors")
        .update({ is_active: true })
        .eq("id", vendorId)
        .select("id, company_name, is_active")
        .maybeSingle();

      if (error) return fail("Activate failed", error.message);

      await writeAudit({
        action: "VENDOR_ACTIVATE",
        entity_type: "vendors",
        entity_id: vendorId,
        details: {},
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

      return ok({ success: true, vendor: data });
    }

    // -------------------------
    // GET /vendors/:vendorId/products
    // -------------------------
    if (event.httpMethod === "GET" && tail[0] === "vendors" && tail[2] === "products") {
      const vendorId = tail[1];
      if (!vendorId) return bad("vendorId missing");

      const { data: vendor, error: vErr } = await supabase
        .from("vendors")
        .select("id, vendor_id, company_name, owner_name, email, phone, kyc_status, is_active")
        .eq("id", vendorId)
        .maybeSingle();

      if (vErr) return fail("Failed to fetch vendor", vErr.message);

      const { data: products, error: pErr } = await supabase
        .from("products")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false });

      if (pErr) return fail("Failed to fetch products", pErr.message);

      const ids = (products || []).map((p) => p.id);
      let imagesByProduct = {};
      if (ids.length) {
        const { data: imgs } = await supabase
          .from("product_images")
          .select("*")
          .in("product_id", ids);
        (imgs || []).forEach((img) => {
          imagesByProduct[img.product_id] = imagesByProduct[img.product_id] || [];
          imagesByProduct[img.product_id].push(img);
        });
      }

      const out = (products || []).map((p) => ({
        ...p,
        product_images: imagesByProduct[p.id] || [],
      }));

      return ok({ success: true, vendor, products: out });
    }

    // -------------------------
    // PUT /products/:productId
    // -------------------------
    if (event.httpMethod === "PUT" && tail[0] === "products" && tail[1]) {
      const productId = tail[1];
      const body = await readBody(event);

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
        "category_path",
        "category_other",
        "head_category_id",
        "sub_category_id",
        "micro_category_id",
        "extra_micro_categories",
        "target_locations",
        "specifications",
        "images",
      ];

      const payload = {};
      allowed.forEach((k) => {
        if (body[k] !== undefined) payload[k] = body[k];
      });

      if (Object.keys(payload).length === 0) return bad("No fields to update");

      const { data, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", productId)
        .select("*")
        .maybeSingle();

      if (error) return fail("Update failed", error.message);

      await writeAudit({
        action: "PRODUCT_UPDATE",
        entity_type: "products",
        entity_id: productId,
        details: { payload },
      });

      return ok({ success: true, product: data });
    }

    // -------------------------
    // DELETE /products/:productId
    // -------------------------
    if (event.httpMethod === "DELETE" && tail[0] === "products" && tail[1]) {
      const productId = tail[1];

      // delete images rows first
      await supabase.from("product_images").delete().eq("product_id", productId);

      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) return fail("Delete failed", error.message);

      await writeAudit({
        action: "PRODUCT_DELETE",
        entity_type: "products",
        entity_id: productId,
        details: {},
      });

      return ok({ success: true });
    }

    return json(404, { success: false, error: "Not found" });
  } catch (e) {
    return fail("Unhandled error", e?.message || String(e));
  }
}
