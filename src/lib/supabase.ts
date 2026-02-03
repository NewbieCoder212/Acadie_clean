import { createClient } from '@supabase/supabase-js';
import { hashPassword, verifyPassword, isBcryptHash, hashPin, verifyPin } from './password';

// Use environment variables for Supabase credentials
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[Supabase] Missing credentials. Please add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your environment variables.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Re-export password utilities for use in other files
export { hashPassword, verifyPassword, isBcryptHash, hashPin, verifyPin };

// Database types
export interface CleaningLogRow {
  id: string;
  location_id: string;
  location_name: string;
  staff_name: string;
  timestamp: string;
  status: 'complete' | 'attention_required';
  notes: string;
  checklist_supplies: boolean;
  checklist_surfaces: boolean;
  checklist_fixtures: boolean;
  checklist_trash: boolean;
  checklist_floor: boolean;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface InsertCleaningLog {
  location_id: string;
  location_name: string;
  staff_name: string;
  timestamp: string;
  status: 'complete' | 'attention_required';
  notes: string;
  checklist_supplies: boolean;
  checklist_surfaces: boolean;
  checklist_fixtures: boolean;
  checklist_trash: boolean;
  checklist_floor: boolean;
  resolved?: boolean;
  resolved_at?: string | null;
}

// Initialize the cleaning_logs table if it doesn't exist
export async function initializeDatabase(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: checkError } = await supabase
      .from('cleaning_logs')
      .select('id')
      .limit(1);

    if (!checkError) {
      return { success: true };
    }

    if (checkError.code === '42P01' || checkError.message.includes('does not exist')) {
      return {
        success: false,
        error: 'Table does not exist. Please create the cleaning_logs table in your Supabase dashboard.'
      };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Insert a new cleaning log
export async function insertCleaningLog(log: InsertCleaningLog): Promise<{ success: boolean; data?: CleaningLogRow; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('cleaning_logs')
      .insert([{
        ...log,
        id: generateId(),
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get logs for a specific location
export async function getLogsForLocation(locationId: string): Promise<{ success: boolean; data?: CleaningLogRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('cleaning_logs')
      .select('*')
      .eq('location_id', locationId)
      .order('timestamp', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get all logs (for manager dashboard)
export async function getAllLogs(): Promise<{ success: boolean; data?: CleaningLogRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('cleaning_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get logs for the last 6 months for a specific location
export async function getLogs6Months(locationId: string): Promise<{ success: boolean; data?: CleaningLogRow[]; error?: string }> {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data, error } = await supabase
      .from('cleaning_logs')
      .select('*')
      .eq('location_id', locationId)
      .gte('timestamp', sixMonthsAgo.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get logs for the last 14 days for a specific location
export async function getLogs14Days(locationId: string): Promise<{ success: boolean; data?: CleaningLogRow[]; error?: string }> {
  try {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data, error } = await supabase
      .from('cleaning_logs')
      .select('*')
      .eq('location_id', locationId)
      .gte('timestamp', fourteenDaysAgo.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get logs for the last 1 month for a specific location (30 days max)
export async function getLogs1Month(locationId: string): Promise<{ success: boolean; data?: CleaningLogRow[]; error?: string }> {
  try {
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    const { data, error } = await supabase
      .from('cleaning_logs')
      .select('*')
      .eq('location_id', locationId)
      .gte('timestamp', oneMonthAgo.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get unresolved attention-required logs
export async function getUnresolvedLogs(): Promise<{ success: boolean; data?: CleaningLogRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('cleaning_logs')
      .select('*')
      .eq('status', 'attention_required')
      .eq('resolved', false)
      .order('timestamp', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Mark a log as resolved
export async function resolveLog(logId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('cleaning_logs')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString()
      })
      .eq('id', logId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Auto-resolve all unresolved attention logs for a location
export async function autoResolveLogsForLocation(locationId: string): Promise<{ success: boolean; resolvedCount?: number; error?: string }> {
  try {
    // First get count of unresolved logs
    const { data: unresolvedLogs, error: fetchError } = await supabase
      .from('cleaning_logs')
      .select('id')
      .eq('location_id', locationId)
      .eq('status', 'attention_required')
      .eq('resolved', false);

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    const count = unresolvedLogs?.length ?? 0;
    if (count === 0) {
      return { success: true, resolvedCount: 0 };
    }

    // Update all unresolved attention logs for this location
    const { error } = await supabase
      .from('cleaning_logs')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString()
      })
      .eq('location_id', locationId)
      .eq('status', 'attention_required')
      .eq('resolved', false);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, resolvedCount: count };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Helper function to generate unique IDs
function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

// Helper function to generate UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Convert database row to app format
export function rowToCleaningLog(row: CleaningLogRow) {
  return {
    id: row.id,
    locationId: row.location_id,
    locationName: row.location_name,
    timestamp: new Date(row.timestamp).getTime(),
    staffName: row.staff_name,
    checklist: {
      handwashingStation: row.checklist_supplies,
      toiletPaper: row.checklist_supplies,
      bins: row.checklist_trash,
      surfacesDisinfected: row.checklist_surfaces,
      fixtures: row.checklist_fixtures,
      waterTemperature: row.checklist_fixtures,
      floors: row.checklist_floor,
      ventilationLighting: row.checklist_fixtures,
    },
    maintenanceNotes: row.notes,
    status: row.status,
    resolved: row.resolved,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).getTime() : undefined,
  };
}

// Location table types (legacy)
export interface LocationRow {
  id: string;
  name: string;
  business_id: string | null;
  supervisor_email: string | null;
  pin_code: string;
  created_at: string;
}

export interface InsertLocation {
  id: string;
  name: string;
  business_id?: string;
  supervisor_email?: string;
  pin_code: string;
}

// Washroom table types (new schema)
export interface WashroomRow {
  id: string;
  business_name: string;
  room_name: string;
  last_cleaned: string | null;
  pin_code: string;
  pin_display: string | null; // Plain PIN for manager display
  pin_changed_at: string | null; // Timestamp when PIN was last changed
  alert_email: string | null;
  is_active: boolean;
  created_at: string;
  // Alert settings (for overdue cleaning notifications)
  alert_enabled: boolean;
  alert_threshold_hours: number;
  business_hours_start: string; // TIME format "HH:MM"
  business_hours_end: string; // TIME format "HH:MM"
  alert_days: string[]; // Array of lowercase day names
  timezone: string;
  last_alert_sent_at: string | null;
}

export interface WashroomAlertSettings {
  alert_enabled: boolean;
  alert_threshold_hours: number;
  business_hours_start: string;
  business_hours_end: string;
  alert_days: string[];
  timezone: string;
}

export interface InsertWashroom {
  id: string;
  business_name: string;
  room_name: string;
  pin_code: string;
  alert_email?: string;
  is_active?: boolean;
}

// Insert a new location to Supabase with hashed PIN
export async function insertLocation(location: InsertLocation): Promise<{ success: boolean; data?: LocationRow; error?: string }> {
  try {
    // Hash the PIN before storing
    const hashedPin = await hashPin(location.pin_code);

    const { data, error } = await supabase
      .from('locations')
      .insert([{
        id: location.id,
        name: location.name,
        business_id: location.business_id || null,
        supervisor_email: location.supervisor_email || null,
        pin_code: hashedPin,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get a location by ID from Supabase
export async function getLocationById(locationId: string): Promise<{ success: boolean; data?: LocationRow; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('id', locationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, data: undefined };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Verify PIN for a location against Supabase (supports hashed and legacy plain-text PINs)
export async function verifyLocationPin(locationId: string, pin: string): Promise<{ success: boolean; valid?: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('id, pin_code')
      .eq('id', locationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, valid: false };
      }
      return { success: false, error: error.message };
    }

    // Check if PIN is hashed or plain text
    let valid = false;
    if (isBcryptHash(data?.pin_code)) {
      valid = await verifyPin(pin, data.pin_code);
    } else {
      // Legacy plain text PIN - verify and upgrade to hash
      valid = data?.pin_code === pin;
      if (valid) {
        const hashedPin = await hashPin(pin);
        await supabase
          .from('locations')
          .update({ pin_code: hashedPin })
          .eq('id', locationId);
      }
    }

    return { success: true, valid };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============ WASHROOM FUNCTIONS (new schema) ============

// Get a washroom by ID
export async function getWashroomById(washroomId: string): Promise<{ success: boolean; data?: WashroomRow; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('washrooms')
      .select('*')
      .eq('id', washroomId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, data: undefined };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get all alert email recipients for a washroom
 * Combines global business emails (if enabled) with location-specific email
 * Returns array of unique email addresses
 */
export async function getAlertRecipientsForWashroom(washroomId: string): Promise<{ success: boolean; emails: string[]; error?: string }> {
  try {
    // Get the washroom to find its business name and alert email
    const { data: washroom, error: washroomError } = await supabase
      .from('washrooms')
      .select('id, business_name, alert_email')
      .eq('id', washroomId)
      .single();

    if (washroomError || !washroom) {
      return { success: false, emails: [], error: washroomError?.message || 'Washroom not found' };
    }

    const emails: string[] = [];

    // Add location-specific email if set
    if (washroom.alert_email) {
      emails.push(washroom.alert_email.toLowerCase());
    }

    // Get business to check global alert settings
    if (washroom.business_name) {
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('global_alert_emails, use_global_alerts')
        .eq('name', washroom.business_name)
        .single();

      if (!businessError && business) {
        // Add global emails if global alerts are enabled
        if (business.use_global_alerts && business.global_alert_emails && Array.isArray(business.global_alert_emails)) {
          for (const email of business.global_alert_emails) {
            const normalizedEmail = email.toLowerCase();
            if (!emails.includes(normalizedEmail)) {
              emails.push(normalizedEmail);
            }
          }
        }
      }
    }

    // Fallback to default if no emails configured
    if (emails.length === 0) {
      emails.push('microsaasnb@proton.me');
    }

    return { success: true, emails };
  } catch (error) {
    return { success: false, emails: ['microsaasnb@proton.me'], error: String(error) };
  }
}

// Verify PIN for a washroom (checks universal business PIN first, then washroom-specific PIN)
// Returns pin_changed_at timestamp to track session validity
export async function verifyWashroomPin(washroomId: string, pin: string): Promise<{
  success: boolean;
  valid?: boolean;
  pinChangedAt?: string | null; // Timestamp when PIN was last changed
  error?: string
}> {
  try {
    // First, get the washroom to find its business
    const { data: washroom, error: washroomError } = await supabase
      .from('washrooms')
      .select('id, pin_code, pin_changed_at, business_name')
      .eq('id', washroomId)
      .eq('is_active', true)
      .single();

    if (washroomError) {
      if (washroomError.code === 'PGRST116') {
        return { success: true, valid: false };
      }
      return { success: false, error: washroomError.message };
    }

    // Try to verify against the universal business staff PIN first
    if (washroom?.business_name) {
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id, staff_pin_hash, staff_pin_changed_at')
        .eq('name', washroom.business_name)
        .eq('is_active', true)
        .single();

      if (!businessError && business?.staff_pin_hash) {
        // Check against universal business PIN
        let businessPinValid = false;
        if (isBcryptHash(business.staff_pin_hash)) {
          businessPinValid = await verifyPin(pin, business.staff_pin_hash);
        } else {
          // Legacy plain text PIN - verify and upgrade to hash
          businessPinValid = business.staff_pin_hash === pin;
          if (businessPinValid) {
            const hashedPin = await hashPin(pin);
            await supabase
              .from('businesses')
              .update({ staff_pin_hash: hashedPin })
              .eq('id', business.id);
          }
        }

        if (businessPinValid) {
          // Return the business PIN changed timestamp (most recent of business or washroom)
          const businessPinChangedAt = business.staff_pin_changed_at;
          const washroomPinChangedAt = washroom.pin_changed_at;
          // Use the most recent change timestamp
          const pinChangedAt = businessPinChangedAt && washroomPinChangedAt
            ? (new Date(businessPinChangedAt) > new Date(washroomPinChangedAt) ? businessPinChangedAt : washroomPinChangedAt)
            : businessPinChangedAt || washroomPinChangedAt;
          return { success: true, valid: true, pinChangedAt };
        }
      }
    }

    // Fall back to washroom-specific PIN
    let valid = false;
    if (isBcryptHash(washroom?.pin_code)) {
      valid = await verifyPin(pin, washroom.pin_code);
    } else {
      // Legacy plain text PIN - verify and upgrade to hash
      valid = washroom?.pin_code === pin;
      if (valid) {
        const hashedPin = await hashPin(pin);
        await supabase
          .from('washrooms')
          .update({ pin_code: hashedPin })
          .eq('id', washroomId);
      }
    }

    return { success: true, valid, pinChangedAt: washroom?.pin_changed_at ?? null };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Check if PIN has changed since a session started
// Returns true if PIN was changed AFTER sessionStartTime, meaning session is invalid
export async function isPinSessionInvalid(washroomId: string, sessionStartTime: string): Promise<{
  success: boolean;
  invalid?: boolean;
  error?: string
}> {
  try {
    // Get washroom to find its business
    const { data: washroom, error: washroomError } = await supabase
      .from('washrooms')
      .select('pin_changed_at, business_name')
      .eq('id', washroomId)
      .eq('is_active', true)
      .single();

    if (washroomError) {
      if (washroomError.code === 'PGRST116') {
        return { success: true, invalid: true }; // Washroom not found = invalid
      }
      return { success: false, error: washroomError.message };
    }

    const sessionStart = new Date(sessionStartTime);

    // Check washroom-specific PIN change
    if (washroom?.pin_changed_at) {
      const washroomPinChanged = new Date(washroom.pin_changed_at);
      if (washroomPinChanged > sessionStart) {
        return { success: true, invalid: true };
      }
    }

    // Check business universal PIN change
    if (washroom?.business_name) {
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('staff_pin_changed_at')
        .eq('name', washroom.business_name)
        .eq('is_active', true)
        .single();

      if (!businessError && business?.staff_pin_changed_at) {
        const businessPinChanged = new Date(business.staff_pin_changed_at);
        if (businessPinChanged > sessionStart) {
          return { success: true, invalid: true };
        }
      }
    }

    return { success: true, invalid: false };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Update last_cleaned timestamp for a washroom
export async function updateWashroomLastCleaned(washroomId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('washrooms')
      .update({ last_cleaned: new Date().toISOString() })
      .eq('id', washroomId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get all active washrooms
export async function getAllWashrooms(): Promise<{ success: boolean; data?: WashroomRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('washrooms')
      .select('*')
      .eq('is_active', true)
      .order('business_name', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get washrooms for a specific business
export async function getWashroomsForBusiness(businessName: string): Promise<{ success: boolean; data?: WashroomRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('washrooms')
      .select('*')
      .eq('business_name', businessName)
      .eq('is_active', true)
      .order('room_name', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Delete a washroom (soft delete - set is_active to false)
export async function deleteWashroom(washroomId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('washrooms')
      .update({ is_active: false })
      .eq('id', washroomId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Permanently delete a washroom (hard delete) - Admin only
export async function hardDeleteWashroom(washroomId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('washrooms')
      .delete()
      .eq('id', washroomId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Insert a new washroom with hashed PIN
export async function insertWashroom(washroom: InsertWashroom): Promise<{ success: boolean; data?: WashroomRow; error?: string }> {
  try {
    // Hash the PIN before storing
    const hashedPin = await hashPin(washroom.pin_code);

    const { data, error } = await supabase
      .from('washrooms')
      .insert([{
        id: washroom.id,
        business_name: washroom.business_name,
        room_name: washroom.room_name,
        pin_code: hashedPin,
        pin_display: washroom.pin_code, // Store plain PIN for manager display
        alert_email: washroom.alert_email || null,
        is_active: washroom.is_active ?? true,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Update alert settings for a washroom
export async function updateWashroomAlertSettings(
  washroomId: string,
  settings: WashroomAlertSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('washrooms')
      .update({
        alert_enabled: settings.alert_enabled,
        alert_threshold_hours: settings.alert_threshold_hours,
        business_hours_start: settings.business_hours_start,
        business_hours_end: settings.business_hours_end,
        alert_days: settings.alert_days,
        timezone: settings.timezone,
      })
      .eq('id', washroomId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Delete a location from Supabase
export async function deleteLocation(locationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', locationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Delete all cleaning logs for a specific location
export async function deleteLogsForLocation(locationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('cleaning_logs')
      .delete()
      .eq('location_id', locationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get all cleaning logs within a date range for audit reports
export async function getLogsForDateRange(
  startDate: Date,
  endDate: Date
): Promise<{ success: boolean; data?: CleaningLogRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('cleaning_logs')
      .select('*')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Business table types
export type SubscriptionTier = 'standard' | 'premium';
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';

export interface BusinessRow {
  id: string;
  auth_user_id: string | null; // Supabase Auth user ID
  name: string;
  email: string;
  password_hash: string;
  address: string | null;
  is_admin: boolean;
  is_active: boolean;
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  trial_start_date: string | null;
  trial_ends_at: string | null;
  subscription_expires_at: string | null;
  last_trial_reminder_sent_at: string | null;
  staff_pin_hash: string | null;
  staff_pin_display: string | null;
  staff_pin_changed_at: string | null; // Timestamp when PIN was last changed
  // Global alert settings
  global_alert_emails: string[] | null; // Array of email addresses for all location alerts
  use_global_alerts: boolean; // Toggle: if true, use global emails for all locations
  created_at: string;
}

// Safe business data without sensitive fields (for client-side storage)
export interface SafeBusinessRow {
  id: string;
  name: string;
  email: string;
  address: string | null;
  is_admin: boolean;
  is_active: boolean;
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  trial_start_date: string | null;
  trial_ends_at: string | null;
  subscription_expires_at: string | null;
  staff_pin_display: string | null;
  // Global alert settings
  global_alert_emails: string[] | null;
  use_global_alerts: boolean;
  created_at: string;
}

export interface InsertBusiness {
  name: string;
  email: string;
  password: string;
  is_admin?: boolean;
  is_active?: boolean;
  subscription_tier?: SubscriptionTier;
  trial_days?: number; // Number of trial days (default 14)
}

// Insert a new business (using password hashing - no Supabase Auth dependency)
export async function insertBusiness(business: InsertBusiness): Promise<{ success: boolean; data?: BusinessRow; error?: string }> {
  try {
    console.log('[insertBusiness] Starting business creation for:', business.email);

    // Check if email already exists
    const { data: existingBusiness, error: checkError } = await supabase
      .from('businesses')
      .select('id')
      .eq('email', business.email.toLowerCase())
      .single();

    if (existingBusiness) {
      return { success: false, error: 'This email is already registered' };
    }

    // Hash the password before storing
    const hashedPassword = await hashPassword(business.password);

    // Calculate trial end date based on trial_days (default 14)
    const trialDays = business.trial_days ?? 14;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

    // Insert business record with hashed password
    const businessId = generateId();
    const { data, error } = await supabase
      .from('businesses')
      .insert([{
        id: businessId,
        auth_user_id: null, // Not using Supabase Auth
        name: business.name,
        email: business.email.toLowerCase(),
        password_hash: hashedPassword,
        is_admin: business.is_admin ?? false,
        is_active: business.is_active ?? true,
        subscription_tier: business.subscription_tier ?? 'standard',
        subscription_status: 'trial',
        trial_start_date: new Date().toISOString(),
        trial_ends_at: trialEndsAt,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('[insertBusiness] Failed to insert business record:', error);
      return { success: false, error: error.message };
    }

    console.log('[insertBusiness] Business created successfully:', businessId);
    return { success: true, data };
  } catch (error) {
    console.error('[insertBusiness] Unexpected error:', error);
    return { success: false, error: String(error) };
  }
}

// Login business using Supabase Auth (with legacy fallback for existing users)
export async function loginBusiness(email: string, password: string): Promise<{ success: boolean; data?: SafeBusinessRow; error?: string }> {
  try {
    // Step 1: Try Supabase Auth first
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password: password,
    });

    // If Supabase Auth fails, try legacy password verification
    if (authError || !authData.user) {
      console.log('[loginBusiness] Auth failed, trying legacy login...');
      return await loginBusinessLegacy(email, password);
    }

    // Step 2: Get business data linked to this auth user
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('auth_user_id', authData.user.id)
      .single();

    // If no business found by auth_user_id, try legacy email lookup
    if (error || !data) {
      const { data: legacyData, error: legacyError } = await supabase
        .from('businesses')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (legacyError || !legacyData) {
        // Sign out since we couldn't find a business record
        await supabase.auth.signOut();
        return { success: false, error: 'Invalid email or password / Courriel ou mot de passe invalide' };
      }

      // Link this auth user to the legacy business if not already linked
      if (!legacyData.auth_user_id) {
        await supabase
          .from('businesses')
          .update({ auth_user_id: authData.user.id })
          .eq('id', legacyData.id);
      }

      // Check account status
      if (legacyData.is_active === false) {
        await supabase.auth.signOut();
        return { success: false, error: 'Your account has been deactivated. Please contact support. / Votre compte a été désactivé. Veuillez contacter le support.' };
      }

      // Return safe business data
      const safeData: SafeBusinessRow = {
        id: legacyData.id,
        name: legacyData.name,
        email: legacyData.email,
        address: legacyData.address ?? null,
        is_admin: legacyData.is_admin,
        is_active: legacyData.is_active,
        subscription_tier: legacyData.subscription_tier ?? 'standard',
        subscription_status: legacyData.subscription_status ?? 'trial',
        trial_start_date: legacyData.trial_start_date ?? null,
        trial_ends_at: legacyData.trial_ends_at ?? null,
        subscription_expires_at: legacyData.subscription_expires_at ?? null,
        staff_pin_display: legacyData.staff_pin_display ?? null,
        global_alert_emails: legacyData.global_alert_emails ?? null,
        use_global_alerts: legacyData.use_global_alerts ?? false,
        created_at: legacyData.created_at,
      };

      return { success: true, data: safeData };
    }

    // Check account status
    if (data.is_active === false) {
      await supabase.auth.signOut();
      return { success: false, error: 'Your account has been deactivated. Please contact support. / Votre compte a été désactivé. Veuillez contacter le support.' };
    }

    // Return safe business data (without password_hash)
    const safeData: SafeBusinessRow = {
      id: data.id,
      name: data.name,
      email: data.email,
      address: data.address ?? null,
      is_admin: data.is_admin,
      is_active: data.is_active,
      subscription_tier: data.subscription_tier ?? 'standard',
      subscription_status: data.subscription_status ?? 'trial',
      trial_start_date: data.trial_start_date ?? null,
      trial_ends_at: data.trial_ends_at ?? null,
      subscription_expires_at: data.subscription_expires_at ?? null,
      staff_pin_display: data.staff_pin_display ?? null,
      global_alert_emails: data.global_alert_emails ?? null,
      use_global_alerts: data.use_global_alerts ?? false,
      created_at: data.created_at,
    };

    return { success: true, data: safeData };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Legacy login function - for migrating existing users
// This is used as a fallback when Supabase Auth user doesn't exist yet
export async function loginBusinessLegacy(email: string, password: string): Promise<{ success: boolean; data?: SafeBusinessRow; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Invalid email or password / Courriel ou mot de passe invalide' };
      }
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Invalid email or password / Courriel ou mot de passe invalide' };
    }

    if (data.is_active === false) {
      return { success: false, error: 'Your account has been deactivated. Please contact support. / Votre compte a été désactivé. Veuillez contacter le support.' };
    }

    // Verify password - support both hashed and legacy plain text passwords
    let passwordValid = false;
    if (isBcryptHash(data.password_hash)) {
      passwordValid = await verifyPassword(password, data.password_hash);
    } else {
      // Legacy plain text password
      passwordValid = data.password_hash === password;
    }

    if (!passwordValid) {
      return { success: false, error: 'Invalid email or password / Courriel ou mot de passe invalide' };
    }

    // Return safe business data
    const safeData: SafeBusinessRow = {
      id: data.id,
      name: data.name,
      email: data.email,
      address: data.address ?? null,
      is_admin: data.is_admin,
      is_active: data.is_active,
      subscription_tier: data.subscription_tier ?? 'standard',
      subscription_status: data.subscription_status ?? 'trial',
      trial_start_date: data.trial_start_date ?? null,
      trial_ends_at: data.trial_ends_at ?? null,
      subscription_expires_at: data.subscription_expires_at ?? null,
      staff_pin_display: data.staff_pin_display ?? null,
      global_alert_emails: data.global_alert_emails ?? null,
      use_global_alerts: data.use_global_alerts ?? false,
      created_at: data.created_at,
    };

    return { success: true, data: safeData };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Logout business - clears Supabase Auth session
export async function logoutBusiness(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get current authenticated session
export async function getCurrentSession(): Promise<{ success: boolean; data?: SafeBusinessRow; error?: string }> {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      return { success: false, error: 'No active session' };
    }

    const userId = sessionData.session.user.id;

    // Get business data linked to this auth user
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('auth_user_id', userId)
      .single();

    if (error || !data) {
      return { success: false, error: 'Business not found' };
    }

    const safeData: SafeBusinessRow = {
      id: data.id,
      name: data.name,
      email: data.email,
      address: data.address ?? null,
      is_admin: data.is_admin,
      is_active: data.is_active,
      subscription_tier: data.subscription_tier ?? 'standard',
      subscription_status: data.subscription_status ?? 'trial',
      trial_start_date: data.trial_start_date ?? null,
      trial_ends_at: data.trial_ends_at ?? null,
      subscription_expires_at: data.subscription_expires_at ?? null,
      staff_pin_display: data.staff_pin_display ?? null,
      global_alert_emails: data.global_alert_emails ?? null,
      use_global_alerts: data.use_global_alerts ?? false,
      created_at: data.created_at,
    };

    return { success: true, data: safeData };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get a single business by ID (for refreshing business data)
export async function getBusinessById(businessId: string): Promise<{ success: boolean; data?: SafeBusinessRow; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Business not found' };
    }

    // Return safe business data (without password_hash)
    const safeData: SafeBusinessRow = {
      id: data.id,
      name: data.name,
      email: data.email,
      address: data.address ?? null,
      is_admin: data.is_admin,
      is_active: data.is_active,
      subscription_tier: data.subscription_tier ?? 'standard',
      subscription_status: data.subscription_status ?? 'trial',
      trial_start_date: data.trial_start_date ?? null,
      trial_ends_at: data.trial_ends_at ?? null,
      subscription_expires_at: data.subscription_expires_at ?? null,
      staff_pin_display: data.staff_pin_display ?? null,
      global_alert_emails: data.global_alert_emails ?? null,
      use_global_alerts: data.use_global_alerts ?? false,
      created_at: data.created_at,
    };

    return { success: true, data: safeData };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get all businesses (admin only)
export async function getAllBusinesses(): Promise<{ success: boolean; data?: BusinessRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Update business address
export async function updateBusinessAddress(businessId: string, address: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('businesses')
      .update({ address })
      .eq('id', businessId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Update business global alert settings
export async function updateBusinessGlobalAlertSettings(
  businessId: string,
  settings: { global_alert_emails: string[]; use_global_alerts: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('businesses')
      .update({
        global_alert_emails: settings.global_alert_emails,
        use_global_alerts: settings.use_global_alerts,
      })
      .eq('id', businessId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Update business password
export async function updateBusinessPassword(businessId: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('businesses')
      .update({ password: newPassword })
      .eq('id', businessId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Update business universal staff PIN (for all washroom locations)
export async function updateBusinessStaffPin(businessId: string, newPin: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Hash the PIN before storing
    const hashedPin = await hashPin(newPin);

    const { error } = await supabase
      .from('businesses')
      .update({
        staff_pin_hash: hashedPin,
        staff_pin_display: newPin, // Store plain PIN for manager display
        staff_pin_changed_at: new Date().toISOString(), // Track when PIN was changed
      })
      .eq('id', businessId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Verify universal business staff PIN
export async function verifyBusinessStaffPin(businessId: string, pin: string): Promise<{ success: boolean; valid?: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('id, staff_pin_hash')
      .eq('id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, valid: false };
      }
      return { success: false, error: error.message };
    }

    if (!data?.staff_pin_hash) {
      return { success: true, valid: false };
    }

    // Check if PIN is hashed or plain text
    let valid = false;
    if (isBcryptHash(data.staff_pin_hash)) {
      valid = await verifyPin(pin, data.staff_pin_hash);
    } else {
      // Legacy plain text PIN - verify and upgrade to hash
      valid = data.staff_pin_hash === pin;
      if (valid) {
        const hashedPin = await hashPin(pin);
        await supabase
          .from('businesses')
          .update({ staff_pin_hash: hashedPin })
          .eq('id', businessId);
      }
    }

    return { success: true, valid };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get business staff PIN display (for manager dashboard)
export async function getBusinessStaffPinDisplay(businessId: string): Promise<{ success: boolean; pin?: string | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('staff_pin_display')
      .eq('id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, pin: null };
      }
      return { success: false, error: error.message };
    }

    return { success: true, pin: data?.staff_pin_display ?? null };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get locations for a specific business
export async function getLocationsForBusiness(businessId: string): Promise<{ success: boolean; data?: LocationRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get all locations (admin only)
export async function getAllLocations(): Promise<{ success: boolean; data?: LocationRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get logs for a specific business (all their locations)
export async function getLogsForBusiness(businessId: string): Promise<{ success: boolean; data?: CleaningLogRow[]; error?: string }> {
  try {
    const locationsResult = await getLocationsForBusiness(businessId);
    if (!locationsResult.success || !locationsResult.data) {
      return { success: false, error: locationsResult.error };
    }

    const locationIds = locationsResult.data.map(loc => loc.id);

    if (locationIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from('cleaning_logs')
      .select('*')
      .in('location_id', locationIds)
      .order('timestamp', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get logs for a specific business by name (using washrooms table + legacy locations table)
export async function getLogsForBusinessByName(businessName: string): Promise<{ success: boolean; data?: CleaningLogRow[]; error?: string }> {
  try {
    // First try the new washrooms table
    const washroomsResult = await getWashroomsForBusiness(businessName);
    const washroomIds = washroomsResult.success && washroomsResult.data
      ? washroomsResult.data.map(w => w.id)
      : [];

    // Also try the legacy locations table - get business ID first
    const { data: businessData } = await supabase
      .from('businesses')
      .select('id')
      .eq('name', businessName)
      .single();

    let legacyLocationIds: string[] = [];
    if (businessData?.id) {
      const locationsResult = await getLocationsForBusiness(businessData.id);
      if (locationsResult.success && locationsResult.data) {
        legacyLocationIds = locationsResult.data.map(l => l.id);
      }
    }

    // Combine all location IDs (washrooms + legacy locations)
    const allLocationIds = [...new Set([...washroomIds, ...legacyLocationIds])];

    if (allLocationIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from('cleaning_logs')
      .select('*')
      .in('location_id', allLocationIds)
      .order('timestamp', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get logs for a specific business by name with date range (using washrooms table + legacy locations table)
export async function getLogsForBusinessByNameAndDateRange(
  businessName: string,
  startDate: Date,
  endDate: Date
): Promise<{ success: boolean; data?: CleaningLogRow[]; error?: string }> {
  try {
    // First try the new washrooms table
    const washroomsResult = await getWashroomsForBusiness(businessName);
    const washroomIds = washroomsResult.success && washroomsResult.data
      ? washroomsResult.data.map(w => w.id)
      : [];

    // Also try the legacy locations table - get business ID first
    const { data: businessData } = await supabase
      .from('businesses')
      .select('id')
      .eq('name', businessName)
      .single();

    let legacyLocationIds: string[] = [];
    if (businessData?.id) {
      const locationsResult = await getLocationsForBusiness(businessData.id);
      if (locationsResult.success && locationsResult.data) {
        legacyLocationIds = locationsResult.data.map(l => l.id);
      }
    }

    // Combine all location IDs (washrooms + legacy locations)
    const allLocationIds = [...new Set([...washroomIds, ...legacyLocationIds])];

    if (allLocationIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from('cleaning_logs')
      .select('*')
      .in('location_id', allLocationIds)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get reported issues for a specific business (legacy - uses locations table)
export async function getIssuesForBusiness(businessId: string): Promise<{ success: boolean; data?: ReportedIssueRow[]; error?: string }> {
  try {
    const locationsResult = await getLocationsForBusiness(businessId);
    if (!locationsResult.success || !locationsResult.data) {
      return { success: false, error: locationsResult.error };
    }

    const locationIds = locationsResult.data.map(loc => loc.id);

    if (locationIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from('reported_issues')
      .select('*')
      .in('location_id', locationIds)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get reported issues for a specific business by name (uses washrooms table + legacy locations table)
export async function getIssuesForBusinessByName(businessName: string): Promise<{ success: boolean; data?: ReportedIssueRow[]; error?: string }> {
  try {
    // First try the new washrooms table
    const washroomsResult = await getWashroomsForBusiness(businessName);
    const washroomIds = washroomsResult.success && washroomsResult.data
      ? washroomsResult.data.map(w => w.id)
      : [];

    // Also try the legacy locations table - get business ID first
    const { data: businessData } = await supabase
      .from('businesses')
      .select('id')
      .eq('name', businessName)
      .single();

    let legacyLocationIds: string[] = [];
    if (businessData?.id) {
      const locationsResult = await getLocationsForBusiness(businessData.id);
      if (locationsResult.success && locationsResult.data) {
        legacyLocationIds = locationsResult.data.map(l => l.id);
      }
    }

    // Combine all location IDs (washrooms + legacy locations)
    const allLocationIds = [...new Set([...washroomIds, ...legacyLocationIds])];

    if (allLocationIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from('reported_issues')
      .select('*')
      .in('location_id', allLocationIds)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Reported Issues table types
export interface ReportedIssueRow {
  id: string;
  location_id: string;
  location_name: string;
  issue_type: string;
  description: string;
  status: 'open' | 'resolved';
  created_at: string;
  resolved_at?: string | null;
}

export interface InsertReportedIssue {
  location_id: string;
  location_name: string;
  issue_type: string;
  description: string;
}

// Insert a new reported issue to Supabase
export async function insertReportedIssue(issue: InsertReportedIssue): Promise<{ success: boolean; data?: ReportedIssueRow; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('reported_issues')
      .insert([{
        id: generateUUID(),
        location_id: issue.location_id,
        location_name: issue.location_name,
        issue_type: issue.issue_type,
        description: issue.description,
        status: 'open',
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get all open reported issues
export async function getOpenReportedIssues(): Promise<{ success: boolean; data?: ReportedIssueRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('reported_issues')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Resolve a reported issue
export async function resolveReportedIssue(issueId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('reported_issues')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', issueId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get open reported issues for a specific location (for public status card)
export async function getOpenIssuesForLocation(locationId: string): Promise<{ success: boolean; data?: ReportedIssueRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('reported_issues')
      .select('*')
      .eq('location_id', locationId)
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Issue types that can be auto-resolved by a complete cleaning
// All issue types are now resolved when a complete cleaning log is submitted
// This resets the public status card back to "Clean"

// Auto-resolve ALL open issues for a location when a complete cleaning is logged
// This ensures the public status card resets to "Clean" after successful cleaning
export async function autoResolveIssuesForLocation(locationId: string): Promise<{ success: boolean; resolvedCount?: number; error?: string }> {
  try {
    // First get count of all open issues
    const { data: openIssues, error: fetchError } = await supabase
      .from('reported_issues')
      .select('id')
      .eq('location_id', locationId)
      .eq('status', 'open');

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    const count = openIssues?.length ?? 0;
    if (count === 0) {
      return { success: true, resolvedCount: 0 };
    }

    // Update ALL open issues for this location
    const { error } = await supabase
      .from('reported_issues')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('location_id', locationId)
      .eq('status', 'open');

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, resolvedCount: count };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Toggle business active status (admin only)
export async function toggleBusinessActive(businessId: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('businesses')
      .update({ is_active: isActive })
      .eq('id', businessId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Update business subscription tier (admin only)
export async function updateBusinessSubscriptionTier(businessId: string, tier: SubscriptionTier): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('businesses')
      .update({ subscription_tier: tier })
      .eq('id', businessId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Update alert email for a washroom
export async function updateWashroomAlertEmail(washroomId: string, alertEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('washrooms')
      .update({ alert_email: alertEmail })
      .eq('id', washroomId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Toggle washroom active status (soft delete)
export async function toggleWashroomActive(washroomId: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('washrooms')
      .update({ is_active: isActive })
      .eq('id', washroomId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Update washroom PIN (stores hashed PIN for verification and plain PIN for display)
export async function updateWashroomPin(washroomId: string, newPin: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Hash the PIN before storing
    const hashedPin = await hashPin(newPin);

    const { error } = await supabase
      .from('washrooms')
      .update({
        pin_code: hashedPin,
        pin_display: newPin, // Store plain PIN for manager display
        pin_changed_at: new Date().toISOString(), // Track when PIN was changed
      })
      .eq('id', washroomId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============ QR SCAN TRACKING (efficient counter-based) ============

export interface QrScanStatRow {
  id: string;
  location_id: string;
  scan_date: string;
  total_scans: number;
  created_at: string;
  updated_at: string;
}

// Track a QR scan - uses upsert to increment counter for location_id + date
export async function trackQrScan(locationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Use Supabase RPC to perform atomic upsert with increment
    // This calls a database function that handles the upsert logic
    const { error } = await supabase.rpc('increment_qr_scan', {
      p_location_id: locationId,
      p_scan_date: today,
    });

    if (error) {
      // If RPC doesn't exist, fall back to manual upsert
      if (error.code === '42883' || error.message.includes('does not exist')) {
        return await trackQrScanFallback(locationId, today);
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Fallback upsert method if RPC function doesn't exist
async function trackQrScanFallback(locationId: string, scanDate: string): Promise<{ success: boolean; error?: string }> {
  try {
    // First, try to get existing record
    const { data: existing, error: fetchError } = await supabase
      .from('qr_scan_stats')
      .select('id, total_scans')
      .eq('location_id', locationId)
      .eq('scan_date', scanDate)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is expected for new records
      return { success: false, error: fetchError.message };
    }

    if (existing) {
      // Update existing record - increment counter
      const { error: updateError } = await supabase
        .from('qr_scan_stats')
        .update({
          total_scans: existing.total_scans + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from('qr_scan_stats')
        .insert([{
          id: generateId(),
          location_id: locationId,
          scan_date: scanDate,
          total_scans: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

      if (insertError) {
        return { success: false, error: insertError.message };
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get QR scan stats for a specific location (last 30 days)
export async function getQrScanStatsForLocation(locationId: string): Promise<{ success: boolean; data?: QrScanStatRow[]; error?: string }> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('qr_scan_stats')
      .select('*')
      .eq('location_id', locationId)
      .gte('scan_date', startDate)
      .order('scan_date', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get QR scan stats for multiple locations (for admin dashboard)
export async function getQrScanStatsForLocations(locationIds: string[]): Promise<{ success: boolean; data?: QrScanStatRow[]; error?: string }> {
  try {
    if (locationIds.length === 0) {
      return { success: true, data: [] };
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('qr_scan_stats')
      .select('*')
      .in('location_id', locationIds)
      .gte('scan_date', startDate)
      .order('scan_date', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get aggregated QR scan stats for a business (sum by location)
export async function getQrScanStatsForBusiness(businessName: string): Promise<{
  success: boolean;
  data?: { locationId: string; locationName: string; totalScans: number; last7Days: number; last30Days: number }[];
  error?: string
}> {
  try {
    // First get all washrooms for this business
    const washroomsResult = await getWashroomsForBusiness(businessName);
    if (!washroomsResult.success || !washroomsResult.data) {
      return { success: false, error: washroomsResult.error };
    }

    const washrooms = washroomsResult.data;
    if (washrooms.length === 0) {
      return { success: true, data: [] };
    }

    const locationIds = washrooms.map(w => w.id);

    // Get scan stats for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: stats, error } = await supabase
      .from('qr_scan_stats')
      .select('*')
      .in('location_id', locationIds)
      .gte('scan_date', thirtyDaysAgo.toISOString().split('T')[0]);

    if (error) {
      return { success: false, error: error.message };
    }

    // Aggregate stats by location
    const aggregated = washrooms.map(washroom => {
      const locationStats = stats?.filter(s => s.location_id === washroom.id) ?? [];

      const totalScans = locationStats.reduce((sum, s) => sum + s.total_scans, 0);
      const last7Days = locationStats
        .filter(s => new Date(s.scan_date) >= sevenDaysAgo)
        .reduce((sum, s) => sum + s.total_scans, 0);
      const last30Days = totalScans;

      return {
        locationId: washroom.id,
        locationName: washroom.room_name,
        totalScans,
        last7Days,
        last30Days,
      };
    });

    return { success: true, data: aggregated };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============ QR SCAN DETAILED LOGS (with timestamps) ============

export interface QrScanLogRow {
  id: string;
  location_id: string;
  scanned_at: string;
  created_at: string;
}

// Track a QR scan with detailed timestamp logging
// This logs to both the counter table (for fast stats) and detailed logs table (for time-based reports)
export async function trackQrScanDetailed(locationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Insert detailed log entry
    const { error: logError } = await supabase
      .from('qr_scan_logs')
      .insert([{
        id: generateId(),
        location_id: locationId,
        scanned_at: now.toISOString(),
        created_at: now.toISOString(),
      }]);

    if (logError) {
      // If table doesn't exist, just log and continue with counter
      console.log('[QR Scan] Detailed log insert failed:', logError.message);
    }

    // Also update the counter table for fast aggregate stats
    const { error: counterError } = await supabase.rpc('increment_qr_scan', {
      p_location_id: locationId,
      p_scan_date: today,
    });

    if (counterError) {
      // Fall back to manual counter update if RPC doesn't exist
      if (counterError.code === '42883' || counterError.message.includes('does not exist')) {
        await trackQrScanFallback(locationId, today);
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get detailed scan logs for a location (with full timestamps)
export async function getQrScanLogsForLocation(
  locationId: string,
  options?: { limit?: number; startDate?: Date; endDate?: Date }
): Promise<{ success: boolean; data?: QrScanLogRow[]; error?: string }> {
  try {
    let query = supabase
      .from('qr_scan_logs')
      .select('*')
      .eq('location_id', locationId)
      .order('scanned_at', { ascending: false });

    if (options?.startDate) {
      query = query.gte('scanned_at', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('scanned_at', options.endDate.toISOString());
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get detailed scan logs for multiple locations
export async function getQrScanLogsForLocations(
  locationIds: string[],
  options?: { limit?: number; startDate?: Date; endDate?: Date }
): Promise<{ success: boolean; data?: QrScanLogRow[]; error?: string }> {
  try {
    if (locationIds.length === 0) {
      return { success: true, data: [] };
    }

    let query = supabase
      .from('qr_scan_logs')
      .select('*')
      .in('location_id', locationIds)
      .order('scanned_at', { ascending: false });

    if (options?.startDate) {
      query = query.gte('scanned_at', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('scanned_at', options.endDate.toISOString());
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get hourly breakdown of scans for a location (for charts)
export async function getQrScanHourlyBreakdown(
  locationId: string,
  date: Date
): Promise<{ success: boolean; data?: { hour: number; count: number }[]; error?: string }> {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('qr_scan_logs')
      .select('scanned_at')
      .eq('location_id', locationId)
      .gte('scanned_at', startOfDay.toISOString())
      .lte('scanned_at', endOfDay.toISOString());

    if (error) {
      return { success: false, error: error.message };
    }

    // Group by hour
    const hourlyCount: { [hour: number]: number } = {};
    for (let i = 0; i < 24; i++) {
      hourlyCount[i] = 0;
    }

    (data ?? []).forEach(log => {
      const hour = new Date(log.scanned_at).getHours();
      hourlyCount[hour]++;
    });

    const breakdown = Object.entries(hourlyCount).map(([hour, count]) => ({
      hour: parseInt(hour),
      count,
    }));

    return { success: true, data: breakdown };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============ SUBSCRIPTION MANAGEMENT ============

// Get businesses that need trial reminder (7 days or less remaining)
export interface TrialReminderBusiness {
  id: string;
  name: string;
  email: string;
  trial_ends_at: string;
  days_remaining: number;
}

export async function getBusinessesNeedingTrialReminder(): Promise<{ success: boolean; data?: TrialReminderBusiness[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('businesses_needing_trial_reminder')
      .select('*');

    if (error) {
      // View might not exist yet
      if (error.code === '42P01') {
        return { success: true, data: [] };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Mark trial reminder as sent
export async function markTrialReminderSent(businessId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('businesses')
      .update({ last_trial_reminder_sent_at: new Date().toISOString() })
      .eq('id', businessId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Activate subscription for a business
export async function activateSubscription(businessId: string, months: number = 12): Promise<{ success: boolean; error?: string }> {
  try {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + months);

    const { error } = await supabase
      .from('businesses')
      .update({
        subscription_status: 'active',
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq('id', businessId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Extend subscription for a business
export async function extendSubscription(businessId: string, months: number = 12): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current expiry
    const { data: business, error: fetchError } = await supabase
      .from('businesses')
      .select('subscription_expires_at')
      .eq('id', businessId)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    // Calculate new expiry date
    const baseDate = business?.subscription_expires_at && new Date(business.subscription_expires_at) > new Date()
      ? new Date(business.subscription_expires_at)
      : new Date();

    baseDate.setMonth(baseDate.getMonth() + months);

    const { error } = await supabase
      .from('businesses')
      .update({
        subscription_status: 'active',
        subscription_expires_at: baseDate.toISOString(),
      })
      .eq('id', businessId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Update subscription status
export async function updateSubscriptionStatus(businessId: string, status: SubscriptionStatus): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('businesses')
      .update({ subscription_status: status })
      .eq('id', businessId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get subscription status details for a business
export async function getSubscriptionDetails(businessId: string): Promise<{
  success: boolean;
  data?: {
    status: SubscriptionStatus;
    trialEndsAt: Date | null;
    subscriptionExpiresAt: Date | null;
    daysRemaining: number | null;
    isExpired: boolean;
  };
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('subscription_status, trial_ends_at, subscription_expires_at')
      .eq('id', businessId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const now = new Date();
    let expiryDate: Date | null = null;
    let daysRemaining: number | null = null;

    if (data.subscription_status === 'trial' && data.trial_ends_at) {
      expiryDate = new Date(data.trial_ends_at);
    } else if (data.subscription_status === 'active' && data.subscription_expires_at) {
      expiryDate = new Date(data.subscription_expires_at);
    }

    if (expiryDate) {
      daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    const isExpired = expiryDate ? expiryDate < now : false;

    return {
      success: true,
      data: {
        status: data.subscription_status,
        trialEndsAt: data.trial_ends_at ? new Date(data.trial_ends_at) : null,
        subscriptionExpiresAt: data.subscription_expires_at ? new Date(data.subscription_expires_at) : null,
        daysRemaining,
        isExpired,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
