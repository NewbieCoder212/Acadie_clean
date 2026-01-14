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
  alert_email: string | null;
  is_active: boolean;
  created_at: string;
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

// Verify PIN for a washroom (supports hashed and legacy plain-text PINs)
export async function verifyWashroomPin(washroomId: string, pin: string): Promise<{ success: boolean; valid?: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('washrooms')
      .select('id, pin_code')
      .eq('id', washroomId)
      .eq('is_active', true)
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
          .from('washrooms')
          .update({ pin_code: hashedPin })
          .eq('id', washroomId);
      }
    }

    return { success: true, valid };
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
export interface BusinessRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  address: string | null;
  is_admin: boolean;
  is_active: boolean;
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
  created_at: string;
}

export interface InsertBusiness {
  name: string;
  email: string;
  password: string;
  is_admin?: boolean;
  is_active?: boolean;
}

// Insert a new business with properly hashed password
export async function insertBusiness(business: InsertBusiness): Promise<{ success: boolean; data?: BusinessRow; error?: string }> {
  try {
    const hashedPassword = await hashPassword(business.password);

    const { data, error } = await supabase
      .from('businesses')
      .insert([{
        id: generateId(),
        name: business.name,
        email: business.email.toLowerCase(),
        password_hash: hashedPassword,
        is_admin: business.is_admin ?? false,
        is_active: business.is_active ?? true,
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

// Login business by email and password with secure password verification
export async function loginBusiness(email: string, password: string): Promise<{ success: boolean; data?: SafeBusinessRow; error?: string }> {
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
      // Legacy plain text password - verify and upgrade to hash
      passwordValid = data.password_hash === password;
      if (passwordValid) {
        const hashedPassword = await hashPassword(password);
        await supabase
          .from('businesses')
          .update({ password_hash: hashedPassword })
          .eq('id', data.id);
      }
    }

    if (!passwordValid) {
      return { success: false, error: 'Invalid email or password / Courriel ou mot de passe invalide' };
    }

    // Return safe business data (without password_hash)
    const safeData: SafeBusinessRow = {
      id: data.id,
      name: data.name,
      email: data.email,
      address: data.address ?? null,
      is_admin: data.is_admin,
      is_active: data.is_active,
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

// Get logs for a specific business by name (using washrooms table)
export async function getLogsForBusinessByName(businessName: string): Promise<{ success: boolean; data?: CleaningLogRow[]; error?: string }> {
  try {
    const washroomsResult = await getWashroomsForBusiness(businessName);
    if (!washroomsResult.success || !washroomsResult.data) {
      return { success: false, error: washroomsResult.error };
    }

    const washroomIds = washroomsResult.data.map(w => w.id);

    if (washroomIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from('cleaning_logs')
      .select('*')
      .in('location_id', washroomIds)
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

// Get reported issues for a specific business by name (uses washrooms table)
export async function getIssuesForBusinessByName(businessName: string): Promise<{ success: boolean; data?: ReportedIssueRow[]; error?: string }> {
  try {
    const washroomsResult = await getWashroomsForBusiness(businessName);
    if (!washroomsResult.success || !washroomsResult.data) {
      return { success: false, error: washroomsResult.error };
    }

    const washroomIds = washroomsResult.data.map(w => w.id);

    if (washroomIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from('reported_issues')
      .select('*')
      .in('location_id', washroomIds)
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
