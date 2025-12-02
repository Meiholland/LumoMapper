import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local if it exists
const envPath = path.resolve(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf-8");
  envFile.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").replace(/^["']|["']$/g, ""); // Remove quotes
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const email = process.argv[2];

if (!email) {
  console.error("Usage: node grant-admin.mjs <email>");
  process.exit(1);
}

async function grantAdmin() {
  try {
    // Find user by email - list users and filter
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error("Failed to list users:", listError.message);
      process.exit(1);
    }

    const authUser = usersData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (!authUser) {
      console.error(`User with email ${email} not found.`);
      console.error("They must sign up first before being granted admin access.");
      process.exit(1);
    }

    // Check if portal user exists
    const { data: existingUsers, error: fetchError } = await supabase
      .from("users")
      .select("id, full_name, role")
      .eq("auth_user_id", authUser.id);

    if (fetchError) {
      console.error("Failed to check portal user:", fetchError.message);
      process.exit(1);
    }

    if (!existingUsers || existingUsers.length === 0) {
      console.error(
        `Portal user not found for ${email}. They must complete signup first.`,
      );
      process.exit(1);
    }

    // Update user role
    const { error: updateError } = await supabase
      .from("users")
      .update({ role: "admin" })
      .eq("auth_user_id", authUser.id);

    if (updateError) {
      console.error("Failed to grant admin role:", updateError.message);
      process.exit(1);
    }

    const user = existingUsers[0];
    console.log(
      `✓ Admin access granted to ${user.full_name} (${email})`,
    );
    console.log(`  Previous role: ${user.role}`);
    console.log(`  New role: admin`);
  } catch (error) {
    console.error("Unexpected error:", error);
    process.exit(1);
  }
}

grantAdmin();

