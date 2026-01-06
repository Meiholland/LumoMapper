# Quarterly Review Caching

## Overview

Quarterly reviews are cached for 24 hours to avoid regenerating the same analysis repeatedly. This improves performance and reduces API costs.

## How It Works

1. **Cache Check**: When generating a review, the system first checks if a cached version exists that hasn't expired
2. **Cache Hit**: If found, returns the cached review immediately (no AI generation needed)
3. **Cache Miss**: If not found or expired, generates a new review using Gemini AI
4. **Cache Store**: New reviews are stored in the database with a 24-hour expiration

## Database Schema

The `quarterly_reports` table stores:
- `company_id`, `year`, `quarter` - Unique identifier for the review
- `review_data` - JSON containing the full review (executive_summary, insights, recommendations)
- `expires_at` - Timestamp when the cache expires (24 hours from creation)

## User Experience

- **First Visit**: Shows loading modal "Working some AI magic, hold on while we process..." while generating
- **Cached Visit**: Returns instantly (no loading modal)
- **After 24 Hours**: Cache expires, new review is generated

## Migration Required

Run these migrations to enable caching:

1. `008-add-quarterly-reviews-cache.sql` - Creates the cache table
2. `009-add-quarterly-reviews-rls.sql` - Adds RLS policies

## Cleanup

Expired reviews are automatically filtered out by the query (`expires_at > now()`). You can optionally create a cleanup job to delete old records:

```sql
DELETE FROM quarterly_reviews 
WHERE expires_at < now();
```

## Benefits

- **Faster Load Times**: Cached reviews load instantly
- **Cost Savings**: Reduces Gemini API calls
- **Better UX**: Users see results immediately on repeat visits
- **Fresh Data**: 24-hour expiration ensures reviews stay current

