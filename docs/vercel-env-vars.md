# Vercel Environment Variables

Add these environment variables in your Vercel project settings:

## Required Environment Variables

### Supabase Configuration

#### 1. `NEXT_PUBLIC_SUPABASE_URL`
- **Type**: Public (exposed to browser)
- **Description**: Your Supabase project URL
- **Where to find**: Supabase Dashboard → Settings → API → Project URL
- **Example**: `https://xxxxxxxxxxxxx.supabase.co`

#### 2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Type**: Public (exposed to browser)
- **Description**: Your Supabase anonymous/public key
- **Where to find**: Supabase Dashboard → Settings → API → Project API keys → `anon` `public`
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

#### 3. `SUPABASE_SERVICE_ROLE_KEY`
- **Type**: Private (server-only, sensitive)
- **Description**: Your Supabase service role key (for admin operations)
- **Where to find**: Supabase Dashboard → Settings → API → Project API keys → `service_role` `secret`
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **⚠️ Important**: This key has admin privileges. Never expose it to the client.

### Azure AI (Quarterly Reviews)

#### 4. `AZURE_AI_ENDPOINT`
- **Type**: Private (server-only)
- **Description**: Azure AI Studio endpoint URL
- **Format**: `https://{resource}.services.ai.azure.com/api/projects/{project-name}`
- **Example**: `https://lumo-data-swedencentral-resource.services.ai.azure.com/api/projects/lumo-data-swedencentral`
- **Required for**: Quarterly Review feature with AI analysis

#### 5. `AZURE_AI_API_KEY`
- **Type**: Private (server-only, sensitive)
- **Description**: Azure AI Studio API key
- **Where to find**: Azure AI Studio → Project → Keys and Endpoint
- **Example**: `your-azure-ai-api-key-here`
- **Required for**: Quarterly Review feature with AI analysis

#### 6. `AZURE_AI_MODEL_NAME` (Optional)
- **Type**: Private (server-only)
- **Description**: Azure AI model name to use
- **Default**: `gpt-4o`
- **Example**: `gpt-4o`, `gpt-4-turbo`, `gpt-35-turbo`
- **Note**: Optional - defaults to `gpt-4o` if not specified

### Gemini AI (Quarterly Reviews) - Commented Out

#### `GEMINI_API_KEY` (Currently Disabled)
- **Type**: Private (server-only, sensitive)
- **Description**: Google Gemini API key for AI-powered quarterly reviews
- **Where to find**: [Google AI Studio](https://makersuite.google.com/app/apikey) → Create API Key
- **Example**: `AIzaSy...`
- **Status**: Code is commented out but preserved for future use when quota is available

### Google Sheets (Monthly Reports Sync)

#### 7. `GOOGLE_SHEETS_SPREADSHEET_ID`
- **Type**: Private (server-only)
- **Description**: Google Sheets spreadsheet ID for monthly reports
- **Where to find**: In the Google Sheets URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`
- **Example**: `1yHpgE3k4d4KEdhk2Jhja6Ym4R1gFGlEJTU5Op9R5geQ`
- **Required for**: Monthly reports sync from Google Sheets

#### 8. `GOOGLE_SERVICE_ACCOUNT_EMAIL` (Option A - Recommended for Vercel)
- **Type**: Private (server-only)
- **Description**: Google Service Account email address
- **Where to find**: Google Cloud Console → IAM & Admin → Service Accounts
- **Example**: `your-service-account@project-id.iam.gserviceaccount.com`
- **Required for**: Google Sheets API access

#### 9. `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (Option A - Recommended for Vercel)
- **Type**: Private (server-only, sensitive)
- **Description**: Google Service Account private key (full key including headers)
- **Where to find**: Download JSON key file from Google Cloud Console, extract the `private_key` field
- **Format**: Must include `\n` characters preserved (use `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`)
- **⚠️ Important**: Keep the `\n` characters in the key value

**OR**

#### 8. `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` (Option B - Local development only)
- **Type**: Private (server-only)
- **Description**: Path to Google Service Account JSON key file
- **Example**: `./google-service-account-key.json`
- **Note**: This option only works for local development. For Vercel, use Option A above.

#### 10. `MONTHLY_REPORTS_SYNC_SECRET` (Optional)
- **Type**: Private (server-only, sensitive)
- **Description**: Secret key to protect the monthly reports sync API endpoint
- **Example**: `your-random-secret-key-here`
- **Note**: Optional but recommended for production to secure the sync endpoint

## How to Add in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - For **Production**, **Preview**, and **Development** environments (or select specific environments)
   - Mark sensitive keys as **Sensitive** (they will be hidden):
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `GEMINI_API_KEY`
     - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
     - `MONTHLY_REPORTS_SYNC_SECRET` (if used)
4. After adding, redeploy your application for changes to take effect

## Quick Checklist

- [ ] `NEXT_PUBLIC_SUPABASE_URL` (Public)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Public)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (Private, Sensitive)
- [ ] `AZURE_AI_ENDPOINT` (Private) - **Required for Quarterly Reviews**
- [ ] `AZURE_AI_API_KEY` (Private, Sensitive) - **Required for Quarterly Reviews**
- [ ] `AZURE_AI_MODEL_NAME` (Private) - Optional, defaults to `gpt-4o`
- [ ] `GOOGLE_SHEETS_SPREADSHEET_ID` (Private) - **Required for Monthly Reports Sync**
- [ ] `GOOGLE_SERVICE_ACCOUNT_EMAIL` (Private) - **Required for Monthly Reports Sync**
- [ ] `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (Private, Sensitive) - **Required for Monthly Reports Sync**
- [ ] `MONTHLY_REPORTS_SYNC_SECRET` (Private, Sensitive) - Optional but recommended

## Notes

- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser and should be safe to share
- The `SUPABASE_SERVICE_ROLE_KEY` is only used server-side for admin operations
- For Google Service Account, use environment variables (`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`) in Vercel, not the file path option
- When copying `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, preserve the `\n` characters in the key
- Make sure your Supabase project has Row Level Security (RLS) enabled for security
- See `docs/google-sheets-setup.md` for detailed Google Service Account setup instructions

