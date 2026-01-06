# Company Name Cleaning Guide

## Overview

Company names in Google Sheets may contain emojis (like 💊, 🌍, 💖, etc.) which can cause matching issues. This guide explains how we handle emoji cleaning and how to clean existing company names in your database.

## How It Works

### Automatic Cleaning During Import

When importing monthly reports from Google Sheets, company names are automatically cleaned:

- **Emojis removed**: All emoji characters (💊, 🌍, 💖, 🌆, 🧘, 🏞️, ⚛️, 🎤, etc.)
- **Special characters**: Removed except letters, numbers, spaces, `&`, `-`, `.`, and `@`
- **Whitespace normalized**: Multiple spaces collapsed to single space

**Examples:**
- `"Healthplus.ai 💊"` → `"Healthplus.ai"`
- `"Beyond Weather 🌍"` → `"Beyond Weather"`
- `"Hema.to 💖"` → `"Hema.to"`
- `"CityLegends 🎤"` → `"CityLegends"`

### Matching Logic

The import script uses intelligent matching:

1. **Exact match** (cleaned names)
2. **Cleaned name comparison** (handles cases where DB has emojis but sheet doesn't, or vice versa)
3. **Partial match** (fuzzy matching)
4. **SQL partial match** (fallback)

This ensures companies are matched correctly even if:
- Database has emojis but Google Sheet doesn't
- Google Sheet has emojis but database doesn't
- Both have different emojis

## Cleaning Existing Company Names

If your database already has company names with emojis, you can clean them all at once:

### Step 1: Preview Changes (Dry Run)

```bash
npm run clean:companies -- --dry-run
```

This will show you what would be changed without actually updating the database:

```
🔍 Found 5 companies with emojis/special characters:

  "Healthplus.ai 💊"
  → "Healthplus.ai"

  "Beyond Weather 🌍"
  → "Beyond Weather"

  ...
```

### Step 2: Clean Company Names

```bash
npm run clean:companies
```

This will update all company names in the database, removing emojis and special characters.

**Note:** The `slug` column will automatically update since it's a generated column based on the `name`.

## When to Clean

**Recommended:** Clean company names **before** the first monthly reports import to ensure consistent matching.

**After cleaning:**
- All future imports will match correctly
- Company names will be consistent across the system
- No more emoji-related matching issues

## Technical Details

### Cleaning Function

The cleaning function removes:
- **Emoji ranges**: `\u{1F300}-\u{1F9FF}` (most emojis)
- **Miscellaneous symbols**: `\u{2600}-\u{26FF}` (sun, moon, stars, etc.)
- **Dingbats**: `\u{2700}-\u{27BF}` (decorative symbols)
- **Variation selectors**: `\u{FE00}-\u{FE0F}` (emoji modifiers)
- **Zero-width joiner**: `\u{200D}` (used in compound emojis)
- **Other special characters**: Except letters, numbers, spaces, `&`, `-`, `.`, `@`

### Preserved Characters

These characters are **kept** in company names:
- Letters (a-z, A-Z)
- Numbers (0-9)
- Spaces
- `&` (for names like "Smith & Co")
- `-` (for names like "Beyond-Weather")
- `.` (for names like "Healthplus.ai")
- `@` (for names with email-like formats)

## Troubleshooting

**"Company not found" errors during import:**
- Run `npm run clean:companies` to clean database names
- Check that company names in Google Sheet match database names (after cleaning)
- The script will show warnings for partial matches

**Duplicate company names after cleaning:**
- If cleaning creates duplicates (e.g., "Company 💊" and "Company 🌍" both become "Company"), you'll need to manually resolve these
- The script will show an error if a duplicate would be created

**Slug conflicts:**
- The `slug` column is auto-generated from `name`
- If cleaning creates duplicate slugs, you may need to manually adjust company names

