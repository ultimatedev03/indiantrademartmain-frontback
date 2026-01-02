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

    // ✅ CHECK EMAIL BY ROLE
    if (!new_password && role) {
      try {
        // Query the auth_users table to check if email exists with this role
        const { data, error } = await supabase
          .from("auth_users")
          .select("id, email, role")
          .eq("email", emailLower)
          .eq("role", role)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          return {
            statusCode: 500,
            body: JSON.stringify({ error: "Database query failed" })
          };
        }

        if (!data) {
          return {
            statusCode: 404,
            body: JSON.stringify({
              error: "Email not registered with this role"
            })
          };
        }

        return {
          statusCode: 200,
          body: JSON.stringify({
            found: true,
            email: data.email,
            role: data.role,
            message: "Email found"
          })
        };
      } catch (error) {
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
