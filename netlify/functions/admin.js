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

function isActiveSub(s) {
  const st = String(s?.status || "").toUpperCase();
  if (st !== "ACTIVE") return false;
  const end = s?.end_date ? new Date(s.end_date).getTime() : null;
  if (!end) return true;
  return end > Date.now();
}

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") return ok({ ok: true });

    const tail = parseTail(event.path);

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
