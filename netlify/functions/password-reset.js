import { createClient } from "@supabase/supabase-js";



export const handler = async (event) => {
  try {
    // ✅ Load env vars fresh on each request
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing env vars:', { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY });
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Server configuration error: Missing Supabase credentials" })
      };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

    const body = JSON.parse(event.body || "{}");
    const { email, role } = body;

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email is required" })
      };
    }

    // ✅ VERIFY EMAIL - works for both roles
    const tableName = role === "VENDOR" ? "vendors" : "buyers";
    const { data: user, error: queryError } = await supabase
      .from(tableName)
      .select("id, email")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (queryError) {
      console.error(`Query error for ${tableName}:`, queryError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database error: " + queryError.message })
      };
    }

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: `This email is not registered as a ${role?.toLowerCase() || 'user'}`
        })
      };
    }

    // Email verified - return success
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Email verified successfully",
        email: user.email
      })
    };

  } catch (error) {
    console.error("Password reset error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || "Server error"
      })
    };
  }
};
