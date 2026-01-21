import { supabase } from "../lib/supabaseClient.js";

export const requireAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "No token" });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { data: emp } = await supabase
      .from("employees")
      .select("role,status")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (
      !emp ||
      emp.status !== "ACTIVE" ||
      !["ADMIN", "SUPERADMIN"].includes(emp.role)
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    req.adminUser = data.user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Unauthorized" });
  }
};