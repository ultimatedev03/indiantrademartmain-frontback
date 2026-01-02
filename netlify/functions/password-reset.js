import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function isValidEmail(email) {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const handler = async (event) => {
  try {
    // Only POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

    const body = JSON.parse(event.body || "{}");
    const { email, role, new_password } = body;

    // Validate email
    if (!email || !isValidEmail(email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Valid email is required" })
      };
    }

    const emailLower = email.toLowerCase().trim();

    // ✅ CHECK EMAIL BY ROLE (BUYER / VENDOR)
    if (!new_password && role) {
      try {
        const normalizedRole = String(role).toUpperCase();

        if (normalizedRole !== "BUYER" && normalizedRole !== "VENDOR") {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: "Invalid role" })
          };
        }

        const table = normalizedRole === "BUYER" ? "buyers" : "vendors";

        const { data, error } = await supabase
          .from(table)
          .select("id, email, user_id")
          .eq("email", emailLower)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          console.error("[password-reset] Error checking", table, "for email", emailLower, error);
          return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to verify email" })
          };
        }

        if (!data) {
          const notFoundMsg = normalizedRole === "BUYER"
            ? "This email is not registered as a buyer"
            : "This email is not registered as a vendor";

          return {
            statusCode: 404,
            body: JSON.stringify({ error: notFoundMsg })
          };
        }

        const successMsg = normalizedRole === "BUYER"
          ? "Buyer account found"
          : "Vendor account found";

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            found: true,
            role: normalizedRole,
            email: emailLower,
            message: successMsg
          })
        };
      } catch (error) {
        console.error("[password-reset] Email verification error:", error);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: error.message || "Check email failed" })
        };
      }
    }

    // ✅ RESET PASSWORD
    if (new_password) {
      if (new_password.length < 6) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "Password must be at least 6 characters long"
          })
        };
      }

      try {
        // Find user by email
        const { data: userData, error: userError } = await supabase
          .from("auth_users")
          .select("id")
          .eq("email", emailLower)
          .maybeSingle();

        if (userError && userError.code !== "PGRST116") {
          return {
            statusCode: 500,
            body: JSON.stringify({ error: "User lookup failed" })
          };
        }

        if (!userData) {
          return {
            statusCode: 404,
            body: JSON.stringify({ error: "User not found" })
          };
        }

        // Update password using Supabase Admin API
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          userData.id,
          { password: new_password }
        );

        if (updateError) {
          return {
            statusCode: 500,
            body: JSON.stringify({
              error: updateError.message || "Failed to reset password"
            })
          };
        }

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: "Password has been reset successfully"
          })
        };
      } catch (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: error.message || "Password reset failed"
          })
        };
      }
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid request" })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Server error" })
    };
  }
};
