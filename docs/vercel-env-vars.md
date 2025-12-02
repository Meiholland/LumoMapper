# Vercel Environment Variables

Add these environment variables in your Vercel project settings:

## Required Environment Variables

### 1. `NEXT_PUBLIC_SUPABASE_URL`
- **Type**: Public (exposed to browser)
- **Description**: Your Supabase project URL
- **Where to find**: Supabase Dashboard → Settings → API → Project URL
- **Example**: `https://xxxxxxxxxxxxx.supabase.co`

### 2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Type**: Public (exposed to browser)
- **Description**: Your Supabase anonymous/public key
- **Where to find**: Supabase Dashboard → Settings → API → Project API keys → `anon` `public`
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 3. `SUPABASE_SERVICE_ROLE_KEY`
- **Type**: Private (server-only, sensitive)
- **Description**: Your Supabase service role key (for admin operations)
- **Where to find**: Supabase Dashboard → Settings → API → Project API keys → `service_role` `secret`
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **⚠️ Important**: This key has admin privileges. Never expose it to the client.

## How to Add in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - For **Production**, **Preview**, and **Development** environments
   - Mark `SUPABASE_SERVICE_ROLE_KEY` as **Sensitive** (it will be hidden)
4. After adding, redeploy your application for changes to take effect

## Notes

- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser and should be safe to share
- The `SUPABASE_SERVICE_ROLE_KEY` is only used server-side for admin operations (granting admin access, etc.)
- Make sure your Supabase project has Row Level Security (RLS) enabled for security

