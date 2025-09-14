# Database Migration: Add Automation Tables

The automation dashboard is showing 500 errors because the production database is missing the `scrapers` and `scraper_stats` tables needed by the automation API endpoints.

## Quick Fix

Run this command in your **backend Render service console**:

```bash
node scripts/add-automation-tables.js
```

This will:
- ✅ Create the missing `scrapers` and `scraper_stats` tables
- ✅ Insert all 9 default scrapers from ScraperManager
- ✅ Handle existing table schema dynamically
- ✅ Fix the 500 error on `/api/automation/scraper-runs`

## How to Access Render Console

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click on your `family-event-planner-backend` service
3. Click the **Shell** tab
4. Run: `node scripts/add-automation-tables.js`

## What This Fixes

The automation dashboard was failing because these API endpoints couldn't query the missing tables:
- `/api/automation/scrapers` - needs `scrapers` table
- `/api/automation/scraper-runs` - needs `scraper_stats` table  

After running the migration, the automation dashboard should load all widgets properly.

## Verification

After running the migration, you should see:
- ✅ 9 scrapers inserted (SF Rec Parks, SF Library, Cal Academy, etc.)
- ✅ Tables created with proper indexes
- ✅ Automation dashboard loads without 500 errors

The migration script is designed to be safe to run multiple times.