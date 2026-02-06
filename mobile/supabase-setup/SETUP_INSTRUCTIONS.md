# Overdue Cleaning Alert System - Setup Instructions

This guide walks you through setting up automated email alerts when washrooms haven't been cleaned within their configured timeframe.

---

## STEP 1: Run Database Migration

1. Go to your **Supabase Dashboard**
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the SQL below
5. Click **Run**

```sql
-- =====================================================
-- MIGRATION: Add Alert Settings to Washrooms Table
-- =====================================================

-- Add alert configuration columns to washrooms table
ALTER TABLE washrooms
ADD COLUMN IF NOT EXISTS alert_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS alert_threshold_hours INTEGER DEFAULT 8,
ADD COLUMN IF NOT EXISTS business_hours_start TIME DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS business_hours_end TIME DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS alert_days TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Halifax',
ADD COLUMN IF NOT EXISTS last_alert_sent_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN washrooms.alert_enabled IS 'Enable/disable overdue cleaning alerts for this washroom';
COMMENT ON COLUMN washrooms.alert_threshold_hours IS 'Hours without cleaning before alert is sent';
COMMENT ON COLUMN washrooms.business_hours_start IS 'Start of business hours (alerts only sent during business hours)';
COMMENT ON COLUMN washrooms.business_hours_end IS 'End of business hours';
COMMENT ON COLUMN washrooms.alert_days IS 'Days of week to send alerts (lowercase)';
COMMENT ON COLUMN washrooms.timezone IS 'Timezone for business hours calculation';
COMMENT ON COLUMN washrooms.last_alert_sent_at IS 'Timestamp of last alert sent (prevents duplicate alerts)';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_washrooms_alert_enabled ON washrooms(alert_enabled) WHERE alert_enabled = true;
CREATE INDEX IF NOT EXISTS idx_washrooms_last_cleaned ON washrooms(last_cleaned);
```

You should see "Success. No rows returned" - this means it worked!

---

## STEP 2: Create the Edge Function

1. Go to your **Supabase Dashboard**
2. Click **Edge Functions** in the left sidebar
3. Click **Create a new function**
4. Name it: `check-overdue-cleanings`
5. Replace the default code with the code from `EDGE_FUNCTION_CODE.ts` file in this folder
6. Click **Deploy**

---

## STEP 3: Add Environment Variables to Edge Function

1. In Edge Functions, click on `check-overdue-cleanings`
2. Go to **Settings** tab
3. Add these secrets:
   - `RESEND_API_KEY` - Your Resend API key (same one used in your app)

Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available.

---

## STEP 4: Set Up the Cron Schedule

1. Go to your **Supabase Dashboard**
2. Click **SQL Editor**
3. Run this SQL to create an hourly cron job:

```sql
-- Enable the pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the cron job to run every hour
SELECT cron.schedule(
  'check-overdue-cleanings',  -- Job name
  '0 * * * *',                -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-overdue-cleanings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

**IMPORTANT:** Replace these values:
- `YOUR_PROJECT_REF` - Your Supabase project reference (found in Settings > General)
- `YOUR_ANON_KEY` - Your Supabase anon/public key (found in Settings > API)

---

## STEP 5: Verify the Setup

### Test the Edge Function manually:

1. Go to **Edge Functions** > `check-overdue-cleanings`
2. Click **Test Function**
3. Click **Run**
4. Check the logs to see the results

### Check the cron job:

```sql
-- View scheduled jobs
SELECT * FROM cron.job;

-- View recent job runs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

---

## How It Works

1. **Every hour**, the cron job triggers the Edge Function
2. The function fetches all washrooms where `alert_enabled = true`
3. For each washroom, it checks:
   - Is it currently within business hours? (based on `business_hours_start`, `business_hours_end`, `timezone`)
   - Is today an alert day? (based on `alert_days`)
   - Has the washroom been cleaned within the threshold? (based on `last_cleaned` vs `alert_threshold_hours`)
   - Have we already sent an alert recently? (based on `last_alert_sent_at`)
4. If all conditions are met, it sends an email to the `alert_email` address
5. It updates `last_alert_sent_at` to prevent duplicate alerts

---

## Configuring Alert Settings Per Washroom

After running the migration, each washroom will have these configurable fields:

| Field | Default | Description |
|-------|---------|-------------|
| `alert_enabled` | `true` | Turn alerts on/off |
| `alert_threshold_hours` | `8` | Hours without cleaning before alert |
| `business_hours_start` | `08:00` | When business opens |
| `business_hours_end` | `18:00` | When business closes |
| `alert_days` | `['monday','tuesday','wednesday','thursday','friday']` | Which days to monitor |
| `timezone` | `America/Halifax` | Timezone for hour calculations |

You can update these via the Admin Dashboard (once we add the UI) or directly in Supabase:

```sql
-- Example: Update alert settings for a specific washroom
UPDATE washrooms
SET
  alert_threshold_hours = 4,
  business_hours_start = '07:00',
  business_hours_end = '22:00',
  alert_days = ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
WHERE id = 'your-washroom-id';

-- Example: Disable alerts for a washroom
UPDATE washrooms
SET alert_enabled = false
WHERE id = 'your-washroom-id';
```

---

## Troubleshooting

### Alerts not sending?

1. Check Edge Function logs in Supabase Dashboard
2. Verify `RESEND_API_KEY` is set correctly
3. Verify `alert_email` is set on the washroom
4. Check if within business hours
5. Check if `alert_enabled` is true

### Too many alerts?

The system prevents duplicate alerts by tracking `last_alert_sent_at`. It won't send another alert until the threshold period has passed again.

### Wrong timezone?

Update the `timezone` field. Common values:
- `America/Halifax` (Atlantic)
- `America/Toronto` (Eastern)
- `America/Chicago` (Central)
- `America/Denver` (Mountain)
- `America/Vancouver` (Pacific)
