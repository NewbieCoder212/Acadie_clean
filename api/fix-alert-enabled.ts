// One-time migration endpoint to fix washrooms with alert_email but alert_enabled = false

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * One-time migration endpoint to fix washrooms that have alert_email set
 * but alert_enabled = false. This ensures they receive overdue alerts.
 *
 * Call this endpoint once to fix existing data.
 * GET /api/fix-alert-enabled
 */
export default async function handler(req: any, res: any) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Find all washrooms that have an alert_email but alert_enabled is false or null
    const { data: washrooms, error: fetchError } = await supabase
      .from('washrooms')
      .select('id, room_name, business_name, alert_email, alert_enabled')
      .not('alert_email', 'is', null)
      .neq('alert_email', '')
      .or('alert_enabled.is.null,alert_enabled.eq.false');

    if (fetchError) {
      console.error('[fix-alert-enabled] Fetch error:', fetchError);
      res.status(500).json({ error: 'Database fetch error', details: fetchError.message });
      return;
    }

    if (!washrooms || washrooms.length === 0) {
      res.status(200).json({
        message: 'No washrooms need fixing',
        fixed: 0
      });
      return;
    }

    console.log(`[fix-alert-enabled] Found ${washrooms.length} washrooms to fix`);

    // Update all these washrooms to have alert_enabled = true
    const ids = washrooms.map(w => w.id);
    const { error: updateError } = await supabase
      .from('washrooms')
      .update({ alert_enabled: true })
      .in('id', ids);

    if (updateError) {
      console.error('[fix-alert-enabled] Update error:', updateError);
      res.status(500).json({ error: 'Database update error', details: updateError.message });
      return;
    }

    const fixedList = washrooms.map(w => ({
      id: w.id,
      name: w.room_name,
      business: w.business_name,
      email: w.alert_email,
    }));

    console.log(`[fix-alert-enabled] Successfully fixed ${washrooms.length} washrooms`);

    res.status(200).json({
      message: `Successfully enabled alerts for ${washrooms.length} washrooms`,
      fixed: washrooms.length,
      washrooms: fixedList,
    });

  } catch (error) {
    console.error('[fix-alert-enabled] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: String(error) });
  }
}
