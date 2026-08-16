-- Medi-Track — Make clinic deactivation actually suspend the clinic
-- Depends on 0001 (helper functions, clinics, profiles).
--
-- Apply: Supabase Dashboard → SQL Editor → paste → Run.
--
-- Before this migration, SUPER_ADMIN deactivating a clinic set
-- clinics.is_active = FALSE and nothing else. No policy and no application code
-- read that flag, so every user in a "deactivated" clinic kept signing in and
-- reading and writing data exactly as before. The toggle was cosmetic.
--
-- All 35 RLS policies resolve tenancy through get_user_clinic_id(), so gating
-- that one function suspends the clinic everywhere at once — no policy needs to
-- change. A deactivated clinic makes it return NULL, and `clinic_id = NULL`
-- evaluates to NULL rather than TRUE, so every clinic-scoped read and write
-- yields zero rows.
--
-- SUPER_ADMIN is unaffected: their clinic_id is NULL so they never satisfy the
-- join, and is_super_admin() does not consult clinic state. They can therefore
-- still see and reactivate a suspended clinic — without which deactivation
-- would be irreversible.

CREATE OR REPLACE FUNCTION get_user_clinic_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.clinic_id
  FROM profiles p
  JOIN clinics c ON c.id = p.clinic_id
  WHERE p.id = auth.uid()
    AND p.is_active = TRUE
    AND c.is_active = TRUE;
$$;

-- Lets the application distinguish "clinic suspended" from "no data", so a
-- locked-out user gets a clear message instead of a silently empty screen.
--
-- Needed because once a clinic is deactivated its users can no longer read
-- their own clinics row: the clinics_select policy routes through
-- get_user_clinic_id(), which now returns NULL for them.
--
-- Returns TRUE for a user with no clinic (SUPER_ADMIN), who is never suspended
-- by this mechanism.
CREATE OR REPLACE FUNCTION current_user_clinic_is_active()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT c.is_active
      FROM profiles p
      JOIN clinics c ON c.id = p.clinic_id
      WHERE p.id = auth.uid()
    ),
    TRUE
  );
$$;

GRANT EXECUTE ON FUNCTION current_user_clinic_is_active() TO authenticated;
