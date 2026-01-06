# Google Sheets API Setup Guide

This guide explains how to set up automatic monthly fetching of monthly reports from Google Sheets.

## Overview

There are two ways to sync monthly reports:

1. **Manual Script** (`npm run sync:reports`) - Run locally when needed
2. **API Endpoint** (`/api/sync/monthly-reports`) - Can be called by cron jobs or scheduled tasks

## Step 1: Create Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Google Sheets API**:
   - Go to **APIs & Services** → **Library**
   - Search for "Google Sheets API"
   - Click **Enable**

4. Create a Service Account:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **Service Account**
   - Give it a name (e.g., "LumoMapper Monthly Reports")
   - Click **Create and Continue**
   - Skip optional steps and click **Done**

5. Create a Key:
   - Click on the service account you just created
   - Go to **Keys** tab
   - Click **Add Key** → **Create new key**
   - Choose **JSON** format
   - Download the JSON file (keep it secure!)

## Step 2: Share Google Sheet with Service Account

1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1yHpgE3k4d4KEdhk2Jhja6Ym4R1gFGlEJTU5Op9R5geQ/edit
2. Click **Share** button (top right)
3. Copy the **Service Account Email** from the JSON file you downloaded (it looks like `something@project-id.iam.gserviceaccount.com`)
4. Paste it in the share dialog
5. Give it **Viewer** permissions (read-only is enough)
6. Click **Send**

## Step 3: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Google Sheets Configuration
GOOGLE_SHEETS_SPREADSHEET_ID=1yHpgE3k4d4KEdhk2Jhja6Ym4R1gFGlEJTU5Op9R5geQ

# Option 1: Use JSON key file path (recommended for local development)
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./google-service-account-key.json

# Option 2: Use environment variables (recommended for production)
# Extract these from the JSON key file:
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Optional: Secure the API endpoint with a secret
MONTHLY_REPORTS_SYNC_SECRET=your-random-secret-key-here
```

### For Production (Vercel/Serverless)

**Option A: Upload JSON Key File**
1. Upload the JSON key file to your hosting provider
2. Set `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` to the file path

**Option B: Use Environment Variables** (Recommended)
1. Open the JSON key file you downloaded
2. Copy the `client_email` value → set as `GOOGLE_SERVICE_ACCOUNT_EMAIL`
3. Copy the `private_key` value → set as `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
   - Make sure to include the full key with `\n` characters
   - In Vercel, you can paste it directly (it handles newlines)

## Step 4: Install Dependencies

```bash
npm install
```

This will install the `googleapis` package.

## Step 5: Test the Sync

### Test Locally (Manual Script)

```bash
npm run sync:reports
```

This will:
- Connect to Google Sheets
- Fetch all monthly reports
- Import/update them in your database

### Test API Endpoint

If you set up `MONTHLY_REPORTS_SYNC_SECRET`, you'll need to include it:

```bash
curl -X POST https://your-domain.com/api/sync/monthly-reports \
  -H "Authorization: Bearer your-random-secret-key-here"
```

Or without authentication (if you didn't set the secret):

```bash
curl -X POST https://your-domain.com/api/sync/monthly-reports
```

## Step 6: Set Up Monthly Automation

### Option A: Vercel Cron Jobs

If you're using Vercel, add this to your `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/sync/monthly-reports",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

This runs on the 1st of every month at midnight UTC.

### Option B: External Cron Service

Use a service like:
- [cron-job.org](https://cron-job.org/)
- [EasyCron](https://www.easycron.com/)
- [GitHub Actions](https://github.com/features/actions)

Set it to call your API endpoint:
```
POST https://your-domain.com/api/sync/monthly-reports
```

Schedule: First day of each month

### Option C: Manual Trigger

You can also create an admin button in your app to trigger the sync manually.

## Troubleshooting

**"Service Account credentials not found"**
- Make sure you've set either `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` or both `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- Check that the JSON file path is correct (if using file path)

**"Permission denied" or "Sheet not found"**
- Make sure you've shared the Google Sheet with the service account email
- The service account email is in the JSON file under `client_email`

**"Invalid credentials"**
- Check that the private key is correctly formatted
- Make sure newlines (`\n`) are preserved in the private key
- If using environment variables, the key should be wrapped in quotes

**"Company not found" errors**
- The script tries to match company names automatically
- Check that company names in the Google Sheet match your database
- Company names are matched case-insensitively and emojis are removed automatically

## Security Notes

- **Never commit** the JSON key file to git
- Add `google-service-account-key.json` to your `.gitignore`
- Use environment variables in production
- Consider using `MONTHLY_REPORTS_SYNC_SECRET` to protect the API endpoint
- The service account only needs **Viewer** access (read-only)

