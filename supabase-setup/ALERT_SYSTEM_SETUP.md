# Overdue Cleaning Alert System - Complete Setup Guide

This guide walks you through setting up automated email alerts when washrooms haven't been cleaned within their configured timeframe.

---

## STEP 1: Run Database Migration

1. Go to your **Supabase Dashboard** (https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste ALL of the SQL below:

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

6. Click **Run** (or press Cmd+Enter / Ctrl+Enter)
7. You should see "Success. No rows returned" - this means it worked!

---

## STEP 2: Create the Edge Function

1. In your **Supabase Dashboard**, click **Edge Functions** in the left sidebar
2. Click **Create a new function** (or **+ New Function**)
3. For the function name, enter: `check-overdue-cleanings`
4. Delete all the default code in the editor
5. Copy and paste this ENTIRE code block:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface Washroom {
  id: string;
  business_name: string;
  room_name: string;
  last_cleaned: string | null;
  alert_email: string | null;
  alert_enabled: boolean;
  alert_threshold_hours: number;
  business_hours_start: string;
  business_hours_end: string;
  alert_days: string[];
  timezone: string;
  last_alert_sent_at: string | null;
}

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

function isWithinBusinessHours(washroom: Washroom, now: Date): boolean {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: washroom.timezone || "America/Halifax",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  };

  const formatter = new Intl.DateTimeFormat("en-US", options);
  const parts = formatter.formatToParts(now);

  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
  const dayOfWeek = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() || "";

  const alertDays = washroom.alert_days || ["monday", "tuesday", "wednesday", "thursday", "friday"];
  if (!alertDays.includes(dayOfWeek)) {
    console.log(`${washroom.room_name}: Not an alert day (${dayOfWeek})`);
    return false;
  }

  const currentMinutes = hour * 60 + minute;
  const startMinutes = timeToMinutes(washroom.business_hours_start || "08:00");
  const endMinutes = timeToMinutes(washroom.business_hours_end || "18:00");

  const withinHours = currentMinutes >= startMinutes && currentMinutes <= endMinutes;

  if (!withinHours) {
    console.log(`${washroom.room_name}: Outside business hours (${hour}:${minute})`);
  }

  return withinHours;
}

function isCleaningOverdue(washroom: Washroom, now: Date): { overdue: boolean; hoursSince: number } {
  if (!washroom.last_cleaned) {
    return { overdue: true, hoursSince: 999 };
  }

  const lastCleaned = new Date(washroom.last_cleaned);
  const hoursSince = (now.getTime() - lastCleaned.getTime()) / (1000 * 60 * 60);
  const threshold = washroom.alert_threshold_hours || 8;

  return {
    overdue: hoursSince >= threshold,
    hoursSince: Math.round(hoursSince * 10) / 10,
  };
}

function shouldSendAlert(washroom: Washroom, now: Date): boolean {
  if (!washroom.last_alert_sent_at) {
    return true;
  }

  const lastAlertSent = new Date(washroom.last_alert_sent_at);
  const hoursSinceAlert = (now.getTime() - lastAlertSent.getTime()) / (1000 * 60 * 60);
  const threshold = washroom.alert_threshold_hours || 8;

  if (hoursSinceAlert < threshold) {
    console.log(`${washroom.room_name}: Alert already sent ${hoursSinceAlert.toFixed(1)} hours ago`);
    return false;
  }

  return true;
}

async function sendAlertEmail(washroom: Washroom, hoursSince: number): Promise<boolean> {
  const recipientEmail = washroom.alert_email || "microsaasnb@proton.me";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Overdue Cleaning Alert</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Acadia Clean IQ</p>
  </div>

  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <div style="background: #fef3c7; border-left: 4px solid #f97316; padding: 15px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
      <strong style="color: #92400e;">Cleaning Overdue</strong>
      <p style="margin: 5px 0 0 0; color: #92400e;">
        A washroom has not been cleaned within the expected timeframe.
      </p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 12px; background: #f9fafb; border-radius: 8px 0 0 0; font-weight: 600; width: 140px;">Business</td>
        <td style="padding: 12px; background: #f9fafb; border-radius: 0 8px 0 0;">${washroom.business_name}</td>
      </tr>
      <tr>
        <td style="padding: 12px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">Location</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${washroom.room_name}</td>
      </tr>
      <tr>
        <td style="padding: 12px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">Last Cleaned</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${
          washroom.last_cleaned
            ? new Date(washroom.last_cleaned).toLocaleString("en-CA", { timeZone: washroom.timezone || "America/Halifax" })
            : "Never"
        }</td>
      </tr>
      <tr>
        <td style="padding: 12px; background: #fef2f2; border-radius: 0 0 0 8px; font-weight: 600; color: #dc2626;">Time Overdue</td>
        <td style="padding: 12px; background: #fef2f2; border-radius: 0 0 8px 0; color: #dc2626; font-weight: 600;">${hoursSince} hours since last cleaning</td>
      </tr>
    </table>

    <p style="color: #6b7280; font-size: 14px;">
      Alert threshold: ${washroom.alert_threshold_hours} hours
    </p>

    <div style="text-align: center; margin-top: 30px;">
      <a href="https://app.acadiacleaniq.ca/manager" style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        View Manager Dashboard
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
      This is an automated alert from Acadia Clean IQ.<br>
      To adjust alert settings, contact your administrator.
    </p>
  </div>
</body>
</html>
  `;

  const plainText = `
OVERDUE CLEANING ALERT - Acadia Clean IQ

A washroom has not been cleaned within the expected timeframe.

Business: ${washroom.business_name}
Location: ${washroom.room_name}
Last Cleaned: ${washroom.last_cleaned ? new Date(washroom.last_cleaned).toLocaleString("en-CA", { timeZone: washroom.timezone || "America/Halifax" }) : "Never"}
Time Overdue: ${hoursSince} hours since last cleaning
Alert Threshold: ${washroom.alert_threshold_hours} hours

View Manager Dashboard: https://app.acadiacleaniq.ca/manager
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Acadia Clean <alerts@acadiacleaniq.ca>",
        to: [recipientEmail],
        subject: `⏰ Overdue Cleaning Alert: ${washroom.room_name} - ${washroom.business_name}`,
        html: htmlContent,
        text: plainText,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to send email for ${washroom.room_name}:`, error);
      return false;
    }

    console.log(`Alert email sent for ${washroom.room_name} to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`Error sending email for ${washroom.room_name}:`, error);
    return false;
  }
}

serve(async (req: Request) => {
  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const now = new Date();
    console.log(`Running overdue cleaning check at ${now.toISOString()}`);

    const { data: washrooms, error } = await supabase
      .from("washrooms")
      .select("*")
      .eq("is_active", true)
      .eq("alert_enabled", true);

    if (error) {
      console.error("Error fetching washrooms:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${washrooms?.length || 0} washrooms with alerts enabled`);

    const results = {
      checked: 0,
      alertsSent: 0,
      skipped: { outsideBusinessHours: 0, notOverdue: 0, recentlyAlerted: 0 },
      errors: 0,
    };

    for (const washroom of (washrooms as Washroom[]) || []) {
      results.checked++;

      if (!isWithinBusinessHours(washroom, now)) {
        results.skipped.outsideBusinessHours++;
        continue;
      }

      const { overdue, hoursSince } = isCleaningOverdue(washroom, now);
      if (!overdue) {
        results.skipped.notOverdue++;
        continue;
      }

      if (!shouldSendAlert(washroom, now)) {
        results.skipped.recentlyAlerted++;
        continue;
      }

      console.log(`${washroom.room_name}: OVERDUE - ${hoursSince}h since last cleaning`);

      const emailSent = await sendAlertEmail(washroom, hoursSince);

      if (emailSent) {
        results.alertsSent++;
        await supabase
          .from("washrooms")
          .update({ last_alert_sent_at: now.toISOString() })
          .eq("id", washroom.id);
      } else {
        results.errors++;
      }
    }

    console.log("Check complete:", results);

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

6. Click **Deploy**

---

## STEP 3: Add the Resend API Key to Edge Function

1. After deploying, click on your `check-overdue-cleanings` function
2. Click the **Settings** tab (or look for "Secrets" / "Environment Variables")
3. Add a new secret:
   - **Name:** `RESEND_API_KEY`
   - **Value:** Your Resend API key (the same one you use in your app)
4. Click **Save**

Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available to Edge Functions.

---

## STEP 4: Set Up the Hourly Cron Job

1. Go back to **SQL Editor** in your Supabase Dashboard
2. Click **New Query**
3. First, enable the required extensions by running:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

4. Click **Run**
5. Create a new query and run this (replace the placeholders):

```sql
-- Create the hourly cron job
SELECT cron.schedule(
  'check-overdue-cleanings-hourly',
  '0 * * * *',
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

**IMPORTANT - Replace these values:**

- `YOUR_PROJECT_REF` - Find this in **Settings > General** (it looks like `abcdefghijklmnop`)
- `YOUR_ANON_KEY` - Find this in **Settings > API > Project API keys > anon public**

---

## STEP 5: Test the Edge Function

1. Go to **Edge Functions** in your Supabase Dashboard
2. Click on `check-overdue-cleanings`
3. Click the **Logs** tab to monitor
4. In a new browser tab, go to **SQL Editor** and run:

```sql
-- Manually trigger the function to test it
SELECT net.http_post(
  url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-overdue-cleanings',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer YOUR_ANON_KEY'
  ),
  body := '{}'::jsonb
);
```

5. Check the Edge Function logs to see the results

---

## STEP 6: Verify Cron Job is Running

Run this SQL to check your scheduled jobs:

```sql
-- View all scheduled cron jobs
SELECT jobid, jobname, schedule, command FROM cron.job;

-- View recent job execution history
SELECT jobid, runid, job_pid, status, return_message, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

---

## How to Configure Alert Settings Per Washroom

After running the migration, each washroom has these new fields you can configure:

| Field | Default | Description |
|-------|---------|-------------|
| `alert_enabled` | `true` | Turn alerts on/off for this washroom |
| `alert_threshold_hours` | `8` | Hours without cleaning before alert is sent |
| `business_hours_start` | `08:00` | Start of business hours |
| `business_hours_end` | `18:00` | End of business hours |
| `alert_days` | `['monday','tuesday','wednesday','thursday','friday']` | Which days to send alerts |
| `timezone` | `America/Halifax` | Timezone for calculations |

### Example: Configure a washroom for 24/7 operation with 4-hour alerts

```sql
UPDATE washrooms
SET
  alert_threshold_hours = 4,
  business_hours_start = '00:00',
  business_hours_end = '23:59',
  alert_days = ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
WHERE id = 'your-washroom-id-here';
```

### Example: Disable alerts for a specific washroom

```sql
UPDATE washrooms
SET alert_enabled = false
WHERE id = 'your-washroom-id-here';
```

### Example: Set different timezone

```sql
UPDATE washrooms
SET timezone = 'America/Toronto'
WHERE business_name = 'Some Business Name';
```

Common timezone values:
- `America/Halifax` (Atlantic)
- `America/Toronto` (Eastern)
- `America/Winnipeg` (Central)
- `America/Edmonton` (Mountain)
- `America/Vancouver` (Pacific)

---

## Troubleshooting

### Alerts not being sent?

1. Check Edge Function logs in Supabase Dashboard
2. Verify `RESEND_API_KEY` secret is set correctly
3. Verify the washroom has `alert_email` set
4. Check if current time is within the washroom's business hours
5. Check if `alert_enabled` is `true`
6. Check if `last_alert_sent_at` was recently updated (prevents duplicate alerts)

### Cron job not running?

1. Verify `pg_cron` and `pg_net` extensions are enabled
2. Check `cron.job` table to see if job exists
3. Check `cron.job_run_details` for errors

### Getting too many alerts?

The system tracks `last_alert_sent_at` to prevent spam. It won't send another alert until the full threshold period passes again after a cleaning.

---

## Summary

Once set up, the system will:

1. Run **every hour** automatically
2. Check each washroom where `alert_enabled = true`
3. Only send alerts **during business hours** on **configured days**
4. Send email if the washroom hasn't been cleaned within the **threshold**
5. Prevent duplicate alerts by tracking when the last alert was sent
