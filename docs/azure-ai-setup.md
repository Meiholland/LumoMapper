# Azure AI Setup Guide

This guide explains how to set up Azure AI Studio for the Quarterly Review feature.

## Overview

The Quarterly Review feature now uses Azure AI Studio instead of Gemini (due to quota limitations). The Gemini code is preserved and commented out for future use.

## Step 1: Get Your Azure AI Credentials

You should already have:
- **Endpoint**: `https://lumo-data-swedencentral-resource.openai.azure.com`
- **API Key**: (Get from Azure Portal - see below)
- **API Version**: `2025-04-01-preview` (or your preferred version)

If you need to find these again:
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Azure OpenAI resource
3. Go to **Keys and Endpoint** section
4. Copy the endpoint (base URL) and one of the keys
5. Note the API version (usually `2025-04-01-preview` or similar)

## Step 2: Configure Environment Variables

### For Local Development

Add to your `.env.local` file:

```bash
# Azure OpenAI Configuration
AZURE_AI_ENDPOINT=https://lumo-data-swedencentral-resource.openai.azure.com
AZURE_AI_API_KEY=your-azure-ai-api-key-here
AZURE_AI_MODEL_NAME=gpt-4o
AZURE_AI_API_VERSION=2025-04-01-preview
```

### For Vercel (Production)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add these variables:

   - **`AZURE_AI_ENDPOINT`** (Private)
     - Value: `https://lumo-data-swedencentral-resource.openai.azure.com`
     - This is the base endpoint URL
   
   - **`AZURE_AI_API_KEY`** (Private, Sensitive)
     - Value: Your Azure OpenAI API key (get from Azure Portal)
     - Mark as **Sensitive**
   
   - **`AZURE_AI_MODEL_NAME`** (Private, Optional)
     - Value: `gpt-4o` (or your deployment name)
     - Should match the deployment name in your Azure OpenAI resource
     - Defaults to `gpt-4o` if not set
   
   - **`AZURE_AI_API_VERSION`** (Private, Optional)
     - Value: `2025-04-01-preview` (or your preferred version)
     - Defaults to `2025-04-01-preview` if not set

4. After adding, redeploy your application

## Step 3: Verify Setup

1. Deploy your application
2. Go to Admin Panel → Company Overview
3. Click "Quarterly Review" for a company with 2+ assessments
4. The review should generate using Azure AI

## Available Models

Common Azure AI models you can use:
- `gpt-4o` (default, recommended)
- `gpt-4-turbo`
- `gpt-35-turbo`
- `gpt-4`

Check your Azure AI Studio project to see which models are available in your deployment.

## Troubleshooting

**"Azure AI not configured" error**
- Make sure `AZURE_AI_ENDPOINT` and `AZURE_AI_API_KEY` are set
- Check that the endpoint URL is correct (should end with `/api/projects/{project-name}`)
- Verify the API key is correct

**"Azure AI API error: 401"**
- Check that your API key is valid
- Verify the endpoint URL is correct

**"Azure AI API error: 404"**
- Check that the model name is available in your Azure AI Studio project
- Try using `gpt-4o` or `gpt-35-turbo` as they're commonly available

**"Model not found"**
- Verify the model name in your Azure AI Studio deployment
- Update `AZURE_AI_MODEL_NAME` to match an available model

## Switching Back to Gemini (Future)

If you want to switch back to Gemini when quota is available:

1. Uncomment the Gemini code in `src/app/admin/overview/[companyId]/review/actions.ts`
2. Comment out the Azure AI code
3. Set `GEMINI_API_KEY` environment variable
4. Remove Azure AI environment variables

The Gemini code is preserved in comments for easy restoration.

