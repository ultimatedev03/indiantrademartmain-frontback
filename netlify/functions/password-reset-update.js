import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // must be service role key
)

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) }
    }

    const body = JSON.parse(event.body || "{}")
    const { email, newPassword } = body

    if (!email || !newPassword) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email and newPassword are required" })
      }
    }

    // ✅ Directly update password using Supabase Admin API
    const { data, error } = await supabaseAdmin.auth.admin.updateUserByEmail(email, {
      password: newPassword
    })

    if (error) {
      console.error("Error updating password:", error)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message || "Failed to update password" })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Password updated successfully" })
    }
  } catch (err) {
    console.error("Password reset fatal error:", err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Internal server error" })
    }
  }
}
