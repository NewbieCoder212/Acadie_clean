-- Migration: Multi-Tenant Manager Architecture
-- This migration adds support for:
-- 1. Managers (users who can access multiple businesses)
-- 2. Manager-Business relationships with roles (owner, supervisor, viewer)
-- 3. Business ID foreign key in washrooms (replacing business_name string)

-- ============================================================
-- STEP 1: Create managers table
-- ============================================================
-- Managers are users who can log in and access one or more businesses
CREATE TABLE IF NOT EXISTS managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email lookups during login
CREATE INDEX IF NOT EXISTS idx_managers_email ON managers(email);

-- ============================================================
-- STEP 2: Create manager_businesses junction table
-- ============================================================
-- Links managers to businesses with role-based permissions
CREATE TABLE IF NOT EXISTS manager_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'supervisor', 'viewer')),
  -- Permissions can be customized per role
  can_edit_locations BOOLEAN DEFAULT false,
  can_edit_settings BOOLEAN DEFAULT false,
  can_invite_users BOOLEAN DEFAULT false,
  can_view_billing BOOLEAN DEFAULT false,
  can_export_reports BOOLEAN DEFAULT true,
  can_resolve_issues BOOLEAN DEFAULT true,
  -- Invitation tracking
  invited_by UUID REFERENCES managers(id),
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure unique manager-business pairs
  UNIQUE(manager_id, business_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_manager_businesses_manager ON manager_businesses(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_businesses_business ON manager_businesses(business_id);

-- ============================================================
-- STEP 3: Add business_id column to washrooms table
-- ============================================================
-- Add business_id as UUID foreign key (will migrate from business_name)
ALTER TABLE washrooms
ADD COLUMN IF NOT EXISTS business_id TEXT REFERENCES businesses(id);

-- Create index for business_id lookups
CREATE INDEX IF NOT EXISTS idx_washrooms_business_id ON washrooms(business_id);

-- ============================================================
-- STEP 4: Migrate existing data
-- ============================================================

-- 4a. Create manager records for existing business owners
INSERT INTO managers (id, email, password_hash, name, is_active, created_at)
SELECT
  gen_random_uuid() as id,
  b.email,
  b.password_hash,
  b.name,
  b.is_active,
  b.created_at
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM managers m WHERE m.email = b.email
)
ON CONFLICT (email) DO NOTHING;

-- 4b. Link managers to their businesses as owners
INSERT INTO manager_businesses (manager_id, business_id, role, can_edit_locations, can_edit_settings, can_invite_users, can_view_billing, can_export_reports, can_resolve_issues)
SELECT
  m.id as manager_id,
  b.id as business_id,
  'owner' as role,
  true as can_edit_locations,
  true as can_edit_settings,
  true as can_invite_users,
  true as can_view_billing,
  true as can_export_reports,
  true as can_resolve_issues
FROM businesses b
JOIN managers m ON m.email = b.email
WHERE NOT EXISTS (
  SELECT 1 FROM manager_businesses mb
  WHERE mb.manager_id = m.id AND mb.business_id = b.id
);

-- 4c. Update washrooms.business_id from business_name
UPDATE washrooms w
SET business_id = b.id
FROM businesses b
WHERE w.business_name = b.name
AND w.business_id IS NULL;

-- ============================================================
-- STEP 5: Create helper functions
-- ============================================================

-- Function to get all businesses for a manager
CREATE OR REPLACE FUNCTION get_manager_businesses(p_manager_id UUID)
RETURNS TABLE (
  business_id TEXT,
  business_name TEXT,
  role TEXT,
  can_edit_locations BOOLEAN,
  can_edit_settings BOOLEAN,
  can_invite_users BOOLEAN,
  can_view_billing BOOLEAN,
  can_export_reports BOOLEAN,
  can_resolve_issues BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    mb.role,
    mb.can_edit_locations,
    mb.can_edit_settings,
    mb.can_invite_users,
    mb.can_view_billing,
    mb.can_export_reports,
    mb.can_resolve_issues
  FROM manager_businesses mb
  JOIN businesses b ON b.id = mb.business_id
  JOIN managers m ON m.id = mb.manager_id
  WHERE mb.manager_id = p_manager_id
  AND m.is_active = true
  AND b.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Function to check if manager has permission for a business
CREATE OR REPLACE FUNCTION check_manager_permission(
  p_manager_id UUID,
  p_business_id TEXT,
  p_permission TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  SELECT
    CASE p_permission
      WHEN 'edit_locations' THEN mb.can_edit_locations
      WHEN 'edit_settings' THEN mb.can_edit_settings
      WHEN 'invite_users' THEN mb.can_invite_users
      WHEN 'view_billing' THEN mb.can_view_billing
      WHEN 'export_reports' THEN mb.can_export_reports
      WHEN 'resolve_issues' THEN mb.can_resolve_issues
      ELSE false
    END INTO v_has_permission
  FROM manager_businesses mb
  WHERE mb.manager_id = p_manager_id
  AND mb.business_id = p_business_id;

  RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 6: Set default permissions by role
-- ============================================================
-- Update existing records to have proper permissions based on role

-- Owners get all permissions
UPDATE manager_businesses
SET
  can_edit_locations = true,
  can_edit_settings = true,
  can_invite_users = true,
  can_view_billing = true,
  can_export_reports = true,
  can_resolve_issues = true
WHERE role = 'owner';

-- Supervisors can view, export, and resolve issues but not edit settings
UPDATE manager_businesses
SET
  can_edit_locations = false,
  can_edit_settings = false,
  can_invite_users = false,
  can_view_billing = false,
  can_export_reports = true,
  can_resolve_issues = true
WHERE role = 'supervisor';

-- Viewers can only view (read-only access)
UPDATE manager_businesses
SET
  can_edit_locations = false,
  can_edit_settings = false,
  can_invite_users = false,
  can_view_billing = false,
  can_export_reports = false,
  can_resolve_issues = false
WHERE role = 'viewer';

-- ============================================================
-- NOTES:
-- ============================================================
-- After running this migration:
-- 1. Existing business owners can now log in as managers
-- 2. They see only their own businesses
-- 3. Owners can invite supervisors/viewers to their businesses
-- 4. Each user has their own email/password (no sharing!)
-- 5. The old business login still works for backward compatibility
--
-- To invite a supervisor:
-- 1. Create manager record (or use existing if they have account)
-- 2. Create manager_businesses record with role='supervisor'
--
-- The business_name column in washrooms is kept for backward compatibility
-- but new code should use business_id for all queries
