# Quarterly Review Feature Setup

The Quarterly Review feature uses Google's Gemini AI to analyze quarterly assessment data and generate insights.

## Setup

### 1. Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the API key

### 2. Add to Environment Variables

Add to your `.env.local` file:

```bash
GEMINI_API_KEY=your-gemini-api-key-here
```

For production (Vercel), add it in:
- **Settings** → **Environment Variables**
- Add `GEMINI_API_KEY` as a **Private** variable

### 3. Install Dependencies

The `@google/generative-ai` package should already be installed. If not:

```bash
npm install
```

## Usage

### Accessing Quarterly Reviews

1. Go to **Admin Panel** → **Company Overview**
2. Find a company with at least 2 assessments
3. Click the **"Quarterly Review"** button (blue card with checkmark icon)
4. The review will be generated automatically using Gemini AI

### What the Review Includes

- **Executive Summary**: 2-3 sentence overview of key changes
- **Key Insights**: 3-5 insights highlighting:
  - Meaningful score changes (>1.0 points)
  - Leadership shifts (Product vs Market)
  - Correlations with monthly challenges
  - Areas of concern or strength
- **Recommendations**: 2-3 actionable recommendations

### Requirements

- Company must have at least 2 assessments (current and previous quarter)
- Monthly reports data is optional but enhances the analysis
- Gemini API key must be configured

## How It Works

1. **Fetches Data**:
   - Current quarter assessment scores
   - Previous quarter assessment scores
   - Monthly reports for the current quarter

2. **Formats Data**:
   - Groups scores by pillar and category
   - Calculates category averages
   - Structures monthly challenges

3. **Calls Gemini AI**:
   - Sends formatted data with analysis instructions
   - Receives JSON response with insights

4. **Displays Results**:
   - Executive summary
   - Color-coded insights (improvement/decline/shift/correlation)
   - Actionable recommendations

## Troubleshooting

**"Gemini API key not configured"**
- Make sure `GEMINI_API_KEY` is set in `.env.local`
- Restart your dev server after adding the key

**"Previous quarter assessment not found"**
- The company needs at least 2 consecutive quarters of assessments
- Check that assessments exist for both current and previous quarters

**"Failed to generate review"**
- Check your Gemini API key is valid
- Verify you have API quota remaining
- Check browser console for detailed error messages

**Review takes a long time**
- Gemini API calls can take 5-10 seconds
- This is normal for AI analysis

## API Costs

- Gemini Pro API is free for reasonable usage
- Check [Google AI Studio pricing](https://ai.google.dev/pricing) for details
- Typical review uses ~2000-3000 tokens per request

