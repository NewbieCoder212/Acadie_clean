import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://duznbqmwcdpqjttdbpug.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_etfpW-Pzijoc-OS5mAlSjA_md78P8NR';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Database types
export interface CleaningLogRow {
  id: string;
  location_id: string;
  location_name: string;
  staff_name: string;
  timestamp: string;
  status: 'complete' | 'attention_required';
  notes: string;
  // Legacy checklist fields (currently in database)
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
  // Legacy checklist fields (currently in database)
  checklist_supplies: boolean;
  checklist_surfaces: boolean;
  checklist_fixtures: boolean;
  checklist_trash: boolean;
  checklist_floor: boolean;
  resolved?: boolean;
  resolved_at?: string | null;
}

// Initialize the cleaning_logs table if it doesn't exist
// Note: This uses Supabase's SQL API to create the table
export async function initializeDatabase(): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if table exists by trying to query it
    const { error: checkError } = await supabase
      .from('cleaning_logs')
      .select('id')
      .limit(1);

    // If no error, table exists
    if (!checkError) {
      console.log('[Supabase] cleaning_logs table already exists');
      return { success: true };
    }

    // If error is about table not existing, we need to create it
    // Note: Table creation should be done via Supabase dashboard or migrations
    // For now, we'll log the error and provide instructions
    console.log('[Supabase] Table check error:', checkError.message);

    if (checkError.code === '42P01' || checkError.message.includes('does not exist')) {
      console.log('[Supabase] cleaning_logs table does not exist. Please create it in Supabase dashboard.');
      return {
        success: false,
        error: 'Table does not exist. Please create the cleaning_logs table in your Supabase dashboard.'
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[Supabase] Database initialization error:', error);
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
      console.error('[Supabase] Insert error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Supabase] Log inserted successfully:', data?.id);
    return { success: true, data };
  } catch (error) {
    console.error('[Supabase] Insert exception:', error);
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
      console.error('[Supabase] Fetch logs error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error('[Supabase] Fetch logs exception:', error);
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
      console.error('[Supabase] Fetch all logs error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error('[Supabase] Fetch all logs exception:', error);
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
      console.error('[Supabase] Fetch 6-month logs error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error('[Supabase] Fetch 6-month logs exception:', error);
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
      console.error('[Supabase] Fetch unresolved logs error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error('[Supabase] Fetch unresolved logs exception:', error);
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
      console.error('[Supabase] Resolve log error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Supabase] Log resolved successfully:', logId);
    return { success: true };
  } catch (error) {
    console.error('[Supabase] Resolve log exception:', error);
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
// Maps legacy DB fields to new app checklist structure
export function rowToCleaningLog(row: CleaningLogRow) {
  return {
    id: row.id,
    locationId: row.location_id,
    locationName: row.location_name,
    timestamp: new Date(row.timestamp).getTime(),
    staffName: row.staff_name,
    checklist: {
      // Map legacy fields to new structure for display
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

// Diagnostic function to test read access
export async function testReadAccess(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Supabase Diagnostic] Testing READ access...');
    const { data, error } = await supabase
      .from('cleaning_logs')
      .select('id')
      .limit(1);

    if (error) {
      console.error('[Supabase Diagnostic] READ failed:', error.message);
      return { success: false, error: error.message };
    }

    console.log('[Supabase Diagnostic] READ success. Records found:', data?.length ?? 0);
    return { success: true };
  } catch (error) {
    console.error('[Supabase Diagnostic] READ exception:', error);
    return { success: false, error: String(error) };
  }
}

// Diagnostic function to test write access
export async function testWriteAccess(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Supabase Diagnostic] Testing WRITE access...');
    const testId = 'diagnostic_test_' + Date.now();

    // Insert a test record
    const { data: insertData, error: insertError } = await supabase
      .from('cleaning_logs')
      .insert([{
        id: testId,
        location_id: 'DIAGNOSTIC_TEST',
        location_name: 'Diagnostic Test Location',
        staff_name: 'Diagnostic System',
        timestamp: new Date().toISOString(),
        status: 'complete',
        notes: 'This is a diagnostic test record - safe to delete',
        checklist_supplies: true,
        checklist_surfaces: true,
        checklist_fixtures: true,
        checklist_trash: true,
        checklist_floor: true,
        resolved: true,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (insertError) {
      console.error('[Supabase Diagnostic] WRITE (insert) failed:', insertError.message);
      return { success: false, error: insertError.message };
    }

    console.log('[Supabase Diagnostic] WRITE (insert) success:', insertData?.id);

    // Clean up the test record
    const { error: deleteError } = await supabase
      .from('cleaning_logs')
      .delete()
      .eq('id', testId);

    if (deleteError) {
      console.warn('[Supabase Diagnostic] Cleanup failed (non-critical):', deleteError.message);
    } else {
      console.log('[Supabase Diagnostic] Cleanup success - test record deleted');
    }

    return { success: true };
  } catch (error) {
    console.error('[Supabase Diagnostic] WRITE exception:', error);
    return { success: false, error: String(error) };
  }
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
  is_active: boolean;
  created_at: string;
}

export interface InsertWashroom {
  id: string;
  business_name: string;
  room_name: string;
  pin_code: string;
  is_active?: boolean;
}

// Insert a new location to Supabase
export async function insertLocation(location: InsertLocation): Promise<{ success: boolean; data?: LocationRow; error?: string }> {
  try {
    console.log('[Supabase] Inserting location:', location.id);
    const { data, error } = await supabase
      .from('locations')
      .insert([{
        id: location.id,
        name: location.name,
        business_id: location.business_id || null,
        supervisor_email: location.supervisor_email || null,
        pin_code: location.pin_code,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Insert location error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Supabase] Location inserted successfully:', data?.id);
    return { success: true, data };
  } catch (error) {
    console.error('[Supabase] Insert location exception:', error);
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
      // If no rows found, it's not really an error for our use case
      if (error.code === 'PGRST116') {
        return { success: true, data: undefined };
      }
      console.error('[Supabase] Get location error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('[Supabase] Get location exception:', error);
    return { success: false, error: String(error) };
  }
}

// Verify PIN for a location against Supabase
export async function verifyLocationPin(locationId: string, pin: string): Promise<{ success: boolean; valid?: boolean; error?: string }> {
  try {
    console.log('[Supabase] Verifying PIN for location:', locationId);
    const { data, error } = await supabase
      .from('locations')
      .select('pin_code')
      .eq('id', locationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, valid: false }; // Location not found
      }
      console.error('[Supabase] Verify PIN error:', error);
      return { success: false, error: error.message };
    }

    const valid = data?.pin_code === pin;
    console.log('[Supabase] PIN verification result:', valid);
    return { success: true, valid };
  } catch (error) {
    console.error('[Supabase] Verify PIN exception:', error);
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
      console.error('[Supabase] Get washroom error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('[Supabase] Get washroom exception:', error);
    return { success: false, error: String(error) };
  }
}

// Verify PIN for a washroom
export async function verifyWashroomPin(washroomId: string, pin: string): Promise<{ success: boolean; valid?: boolean; error?: string }> {
  try {
    console.log('[Supabase] Verifying PIN for washroom:', washroomId);
    const { data, error } = await supabase
      .from('washrooms')
      .select('pin_code')
      .eq('id', washroomId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, valid: false };
      }
      console.error('[Supabase] Verify washroom PIN error:', error);
      return { success: false, error: error.message };
    }

    const valid = data?.pin_code === pin;
    console.log('[Supabase] Washroom PIN verification result:', valid);
    return { success: true, valid };
  } catch (error) {
    console.error('[Supabase] Verify washroom PIN exception:', error);
    return { success: false, error: String(error) };
  }
}

// Update last_cleaned timestamp for a washroom
export async function updateWashroomLastCleaned(washroomId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Supabase] Updating last_cleaned for washroom:', washroomId);
    const { error } = await supabase
      .from('washrooms')
      .update({ last_cleaned: new Date().toISOString() })
      .eq('id', washroomId);

    if (error) {
      console.error('[Supabase] Update last_cleaned error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Supabase] last_cleaned updated successfully');
    return { success: true };
  } catch (error) {
    console.error('[Supabase] Update last_cleaned exception:', error);
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
      console.error('[Supabase] Get all washrooms error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error('[Supabase] Get all washrooms exception:', error);
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
      console.error('[Supabase] Get washrooms for business error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error('[Supabase] Get washrooms for business exception:', error);
    return { success: false, error: String(error) };
  }
}

// Delete a washroom (soft delete - set is_active to false)
export async function deleteWashroom(washroomId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Supabase] Deleting washroom:', washroomId);
    const { error } = await supabase
      .from('washrooms')
      .update({ is_active: false })
      .eq('id', washroomId);

    if (error) {
      console.error('[Supabase] Delete washroom error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Supabase] Washroom deleted successfully:', washroomId);
    return { success: true };
  } catch (error) {
    console.error('[Supabase] Delete washroom exception:', error);
    return { success: false, error: String(error) };
  }
}

// Insert a new washroom
export async function insertWashroom(washroom: InsertWashroom): Promise<{ success: boolean; data?: WashroomRow; error?: string }> {
  try {
    console.log('[Supabase] Inserting washroom:', washroom.id);
    const { data, error } = await supabase
      .from('washrooms')
      .insert([{
        ...washroom,
        is_active: washroom.is_active ?? true,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Insert washroom error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Supabase] Washroom inserted successfully:', data?.id);
    return { success: true, data };
  } catch (error) {
    console.error('[Supabase] Insert washroom exception:', error);
    return { success: false, error: String(error) };
  }
}

// Delete a location from Supabase
export async function deleteLocation(locationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Supabase] Deleting location:', locationId);
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', locationId);

    if (error) {
      console.error('[Supabase] Delete location error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Supabase] Location deleted successfully:', locationId);
    return { success: true };
  } catch (error) {
    console.error('[Supabase] Delete location exception:', error);
    return { success: false, error: String(error) };
  }
}

// Delete all cleaning logs for a specific location
export async function deleteLogsForLocation(locationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Supabase] Deleting logs for location:', locationId);

    const { error } = await supabase
      .from('cleaning_logs')
      .delete()
      .eq('location_id', locationId);

    if (error) {
      console.error('[Supabase] Delete logs error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Supabase] Logs deleted successfully for location:', locationId);
    return { success: true };
  } catch (error) {
    console.error('[Supabase] Delete logs exception:', error);
    return { success: false, error: String(error) };
  }
}

// Get all cleaning logs within a date range for audit reports
export async function getLogsForDateRange(
  startDate: Date,
  endDate: Date
): Promise<{ success: boolean; data?: CleaningLogRow[]; error?: string }> {
  try {
    console.log('[Supabase] Fetching logs for date range:', startDate.toISOString(), 'to', endDate.toISOString());

    const { data, error } = await supabase
      .from('cleaning_logs')
      .select('*')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('[Supabase] Date range query error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Supabase] Found', data?.length ?? 0, 'logs in date range');
    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error('[Supabase] Date range query exception:', error);
    return { success: false, error: String(error) };
  }
}

// Business table types
export interface BusinessRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  is_admin: boolean;
  created_at: string;
}

export interface InsertBusiness {
  name: string;
  email: string;
  password: string;
  is_admin?: boolean;
}

// Insert a new business
export async function insertBusiness(business: InsertBusiness): Promise<{ success: boolean; data?: BusinessRow; error?: string }> {
  try {
    console.log('[Supabase] Inserting business:', business.name);
    const { data, error } = await supabase
      .from('businesses')
      .insert([{
        id: generateId(),
        name: business.name,
        email: business.email.toLowerCase(),
        password_hash: business.password, // Simple password for now
        is_admin: business.is_admin ?? false,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Insert business error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Supabase] Business inserted successfully:', data?.id);
    return { success: true, data };
  } catch (error) {
    console.error('[Supabase] Insert business exception:', error);
    return { success: false, error: String(error) };
  }
}

// Login business by email and password
export async function loginBusiness(email: string, password: string): Promise<{ success: boolean; data?: BusinessRow; error?: string }> {
  try {
    console.log('[Supabase] Logging in business:', email);
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('password_hash', password)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Invalid email or password' };
      }
      console.error('[Supabase] Login error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Supabase] Login successful:', data?.name);
    return { success: true, data };
  } catch (error) {
    console.error('[Supabase] Login exception:', error);
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
      console.error('[Supabase] Get all businesses error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error('[Supabase] Get all businesses exception:', error);
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
      console.error('[Supabase] Get locations for business error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error('[Supabase] Get locations for business exception:', error);
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
      console.error('[Supabase] Get all locations error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error('[Supabase] Get all locations exception:', error);
    return { success: false, error: String(error) };
  }
}

// Get logs for a specific business (all their locations)
export async function getLogsForBusiness(businessId: string): Promise<{ success: boolean; data?: CleaningLogRow[]; error?: string }> {
  try {
    // First get all location IDs for this business
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
      console.error('[Supabase] Get logs for business error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error('[Supabase] Get logs for business exception:', error);
    return { success: false, error: String(error) };
  }
}

// Get logs for a specific business by name (using washrooms table)
export async function getLogsForBusinessByName(businessName: string): Promise<{ success: boolean; data?: CleaningLogRow[]; error?: string }> {
  try {
    // First get all washroom IDs for this business
    const washroomsResult = await getWashroomsForBusiness(businessName);
    if (!washroomsResult.success || !washroomsResult.data) {
      return { success: false, error: washroomsResult.error };
    }

    const washroomIds = washroomsResult.data.map(w => w.id);
    console.log('[Supabase] Found washrooms for business:', washroomIds);

    if (washroomIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from('cleaning_logs')
      .select('*')
      .in('location_id', washroomIds)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('[Supabase] Get logs for business by name error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Supabase] Found', data?.length ?? 0, 'logs for business:', businessName);
    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error('[Supabase] Get logs for business by name exception:', error);
    return { success: false, error: String(error) };
  }
}

// Get reported issues for a specific business
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
      console.error('[Supabase] Get issues for business error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error('[Supabase] Get issues for business exception:', error);
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
    console.log('[Supabase] Inserting reported issue for location:', issue.location_id);
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
      console.error('[Supabase] Insert issue error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Supabase] Issue inserted successfully:', data?.id);
    return { success: true, data };
  } catch (error) {
    console.error('[Supabase] Insert issue exception:', error);
    return { success: false, error: String(error) };
  }
}

// Get all open reported issues
export async function getOpenReportedIssues(): Promise<{ success: boolean; data?: ReportedIssueRow[]; error?: string }> {
  try {
    console.log('[Supabase] Fetching open reported issues...');
    const { data, error } = await supabase
      .from('reported_issues')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Get open issues error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Supabase] Found', data?.length ?? 0, 'open issues');
    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error('[Supabase] Get open issues exception:', error);
    return { success: false, error: String(error) };
  }
}

// Resolve a reported issue
export async function resolveReportedIssue(issueId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Supabase] Resolving issue:', issueId);
    const { error } = await supabase
      .from('reported_issues')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', issueId);

    if (error) {
      console.error('[Supabase] Resolve issue error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Supabase] Issue resolved successfully:', issueId);
    return { success: true };
  } catch (error) {
    console.error('[Supabase] Resolve issue exception:', error);
    return { success: false, error: String(error) };
  }
}
