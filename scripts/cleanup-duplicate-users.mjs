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
        const value = valueParts.join("=").replace(/^["']|["']$/g, "");
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

async function cleanupDuplicates() {
  try {
    // Get all users
    const { data: allUsers, error: fetchError } = await supabase
      .from("users")
      .select("id, auth_user_id, full_name, role, company_id, created_at")
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Failed to fetch users:", fetchError.message);
      process.exit(1);
    }

    if (!allUsers || allUsers.length === 0) {
      console.log("No users found.");
      return;
    }

    // Group by auth_user_id
    const userGroups = new Map();
    for (const user of allUsers) {
      if (!userGroups.has(user.auth_user_id)) {
        userGroups.set(user.auth_user_id, []);
      }
      userGroups.get(user.auth_user_id).push(user);
    }

    // Find duplicates
    const duplicates = [];
    for (const [authUserId, users] of userGroups.entries()) {
      if (users.length > 1) {
        duplicates.push({ authUserId, users });
      }
    }

    if (duplicates.length === 0) {
      console.log("✓ No duplicate users found.");
      return;
    }

    console.log(`Found ${duplicates.length} user(s) with duplicates:\n`);

    for (const { authUserId, users } of duplicates) {
      // Sort by created_at, keep the oldest one
      users.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const keepUser = users[0];
      const deleteUsers = users.slice(1);

      console.log(`Auth User ID: ${authUserId}`);
      console.log(`  Keeping: ${keepUser.full_name} (${keepUser.id}) - created ${keepUser.created_at}`);
      console.log(`  Deleting ${deleteUsers.length} duplicate(s):`);

      for (const dup of deleteUsers) {
        console.log(`    - ${dup.full_name} (${dup.id}) - created ${dup.created_at}`);
        
        const { error: deleteError } = await supabase
          .from("users")
          .delete()
          .eq("id", dup.id);

        if (deleteError) {
          console.error(`      ✗ Failed to delete: ${deleteError.message}`);
        } else {
          console.log(`      ✓ Deleted`);
        }
      }
      console.log();
    }

    console.log("✓ Cleanup complete!");
  } catch (error) {
    console.error("Unexpected error:", error);
    process.exit(1);
  }
}

cleanupDuplicates();

