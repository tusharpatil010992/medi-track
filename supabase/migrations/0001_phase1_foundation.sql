-- Medi-Track — Phase 1: Foundation, Multi-Tenancy & Clinic Users
-- Creates: user_role enum, clinics, clinic_config, profiles, RLS policies.
-- Phase 2-5 tables are intentionally NOT created here; each phase adds its own migration.
--
-- Apply: Supabase Dashboard → SQL Editor → paste → Run.

-- ============================================================================
-- ENUM
-- ============================================================================

CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN',
  'ADMIN',
  'DOCTOR',
  'OPTOMETRIST',
  'STAFF',
  'FRONT_DESK',
  'PATIENT'
);

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_clinics_is_active ON clinics(is_active);

-- Holds per-clinic secrets (Resend / WhatsApp). Readable by ADMIN of that clinic
-- and SUPER_ADMIN only — see RLS policies below.
CREATE TABLE clinic_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL UNIQUE REFERENCES clinics(id) ON DELETE CASCADE,
  resend_api_key VARCHAR(255) NOT NULL DEFAULT 'dummy_resend_key',
  resend_sender_email VARCHAR(255) NOT NULL DEFAULT 'noreply@dummy.com',
  whatsapp_api_url VARCHAR(500) NOT NULL DEFAULT 'https://api.whatsapp.com/dummy',
  whatsapp_access_token VARCHAR(500) NOT NULL DEFAULT 'dummy_whatsapp_token',
  whatsapp_phone_number_id VARCHAR(100) NOT NULL DEFAULT 'dummy_phone_id',
  whatsapp_business_account_id VARCHAR(100) NOT NULL DEFAULT 'dummy_business_id',
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID
);

CREATE INDEX idx_clinic_config_clinic_id ON clinic_config(clinic_id);

-- clinic_id is NULL for SUPER_ADMIN: architecture.md states SUPER_ADMIN is a
-- platform-level role and "not automatically a member of every clinic".
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  avatar_url VARCHAR(500),
  role user_role NOT NULL,
  license_number VARCHAR(100),
  specialty VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT profiles_clinic_email_unique UNIQUE (clinic_id, email),
  CONSTRAINT profiles_clinic_scope_check CHECK (
    (role = 'SUPER_ADMIN' AND clinic_id IS NULL)
    OR (role <> 'SUPER_ADMIN' AND clinic_id IS NOT NULL)
  )
);

CREATE INDEX idx_profiles_clinic_id ON profiles(clinic_id);
CREATE INDEX idx_profiles_clinic_role ON profiles(clinic_id, role);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);

-- ============================================================================
-- RLS HELPER FUNCTIONS
-- ============================================================================
-- SECURITY DEFINER is REQUIRED. These functions read `profiles`, and they are
-- called from policies ON `profiles`. Without SECURITY DEFINER the policy
-- re-enters itself and Postgres aborts with:
--   "infinite recursion detected in policy for relation profiles"
-- SECURITY DEFINER runs the function as its owner, bypassing RLS, which breaks
-- the cycle. search_path is pinned to avoid search_path hijacking.

CREATE OR REPLACE FUNCTION get_user_clinic_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id FROM profiles WHERE id = auth.uid() AND is_active = TRUE;
$$;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND is_active = TRUE;
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'SUPER_ADMIN' AND is_active = TRUE
  );
$$;

GRANT EXECUTE ON FUNCTION get_user_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Every policy that permits writes carries WITH CHECK as well as USING.
-- USING filters rows the user may *see*; WITH CHECK constrains rows the user may
-- *write*. USING alone leaves INSERT unconstrained, which would let a clinic
-- user insert a row stamped with another clinic's clinic_id.

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------- clinics ---
CREATE POLICY clinics_select ON clinics
  FOR SELECT TO authenticated
  USING (id = get_user_clinic_id() OR is_super_admin());

CREATE POLICY clinics_insert ON clinics
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY clinics_update ON clinics
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR (id = get_user_clinic_id() AND current_user_role() = 'ADMIN'))
  WITH CHECK (is_super_admin() OR (id = get_user_clinic_id() AND current_user_role() = 'ADMIN'));

-- No DELETE policy: clinics are deactivated via is_active, never hard-deleted.

-- ----------------------------------------------------------- clinic_config ---
-- Restricted to ADMIN + SUPER_ADMIN because this table stores live API
-- credentials. A clinic-wide read policy would expose the Resend key and
-- WhatsApp access token to every FRONT_DESK / DOCTOR / PATIENT in the clinic.
CREATE POLICY clinic_config_select ON clinic_config
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (clinic_id = get_user_clinic_id() AND current_user_role() = 'ADMIN')
  );

CREATE POLICY clinic_config_insert ON clinic_config
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY clinic_config_update ON clinic_config
  FOR UPDATE TO authenticated
  USING (
    is_super_admin()
    OR (clinic_id = get_user_clinic_id() AND current_user_role() = 'ADMIN')
  )
  WITH CHECK (
    is_super_admin()
    OR (clinic_id = get_user_clinic_id() AND current_user_role() = 'ADMIN')
  );

-- --------------------------------------------------------------- profiles ---
-- `id = auth.uid()` is listed first so a user can always load their own profile.
-- Session bootstrap depends on it, and SUPER_ADMIN (clinic_id IS NULL) would
-- otherwise match nothing: in SQL, NULL = NULL evaluates to NULL, not TRUE.
CREATE POLICY profiles_select ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR is_super_admin()
    OR clinic_id = get_user_clinic_id()
  );

CREATE POLICY profiles_insert ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR (current_user_role() = 'ADMIN' AND clinic_id = get_user_clinic_id())
  );

CREATE POLICY profiles_update ON profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR is_super_admin()
    OR (current_user_role() = 'ADMIN' AND clinic_id = get_user_clinic_id())
  )
  WITH CHECK (
    id = auth.uid()
    OR is_super_admin()
    OR (current_user_role() = 'ADMIN' AND clinic_id = get_user_clinic_id())
  );

-- No DELETE policy: users are deactivated via is_active, never hard-deleted.
