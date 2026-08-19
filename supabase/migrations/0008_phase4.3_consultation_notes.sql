-- Medi-Track — Phase 4.3: Consultation notes as clinic-managed fields
-- Creates: consultation_note_types (the dropdown master), consultation_notes
--          (the per-visit rows) + RLS, seeds the five default types for every
--          clinic, and CLEARS the five now-reserved consultation columns.
-- Depends on 0001 (RLS helpers) and 0003 (consultations).
--
-- Apply: Supabase Dashboard → SQL Editor → paste → Run.
--
-- ############################################################################
-- ## DESTRUCTIVE — READ BEFORE RUNNING                                      ##
-- ##                                                                        ##
-- ## The final statement NULLs chief_complaint, patient_history,            ##
-- ## examination_findings, diagnosis and treatment_plan on EVERY            ##
-- ## consultation in EVERY clinic. That is every clinical note recorded up  ##
-- ## to Phase 4.2. It was authorised deliberately — those five columns are  ##
-- ## superseded by consultation_notes and no production patient data        ##
-- ## exists yet — but it cannot be undone without a point-in-time restore.  ##
-- ##                                                                        ##
-- ## Run this file ONCE. Re-running it after clinicians have started using  ##
-- ## the new tables is harmless to consultation_notes, but the seed INSERT  ##
-- ## will fail on UNIQUE(clinic_id, name), which is the intended brake.     ##
-- ############################################################################

-- ============================================================================
-- TABLES
-- ============================================================================

-- The dropdown a doctor picks from when adding a note to a consultation.
-- Clinic-owned master data, exactly like medicines and billing_services, but
-- writable by DOCTOR as well as ADMIN: the clinicians using the list are the
-- ones who know what it should contain.
CREATE TABLE consultation_note_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  UNIQUE (clinic_id, name)
);

CREATE INDEX idx_consultation_note_types_clinic ON consultation_note_types(clinic_id);
CREATE INDEX idx_consultation_note_types_active ON consultation_note_types(clinic_id, is_active);

-- One row per note a doctor adds to a visit.
--
-- note_type_snapshot preserves the label the note was written under, on the
-- same principle as prescription_items.medicine_name_snapshot: renaming
-- "Diagnosis" later must never rewrite a letter already handed to a patient.
-- note_type_id is ON DELETE SET NULL purely as a backstop — types are
-- deactivated, not deleted.
--
-- patient_id is denormalised from the consultation so that reading a patient's
-- notes across visits needs no join.
CREATE TABLE consultation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  note_type_id UUID REFERENCES consultation_note_types(id) ON DELETE SET NULL,
  note_type_snapshot VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  -- Checked by the doctor to put this note on the printed consultation letter.
  show_on_receipt BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  -- Soft delete. Removing a note from the form deactivates the row; nothing
  -- deletes clinical text, and there is no DELETE policy below to allow it.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_consultation_notes_clinic ON consultation_notes(clinic_id);
CREATE INDEX idx_consultation_notes_consultation ON consultation_notes(consultation_id, is_active);
CREATE INDEX idx_consultation_notes_patient ON consultation_notes(clinic_id, patient_id, is_active);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Same pattern as 0001/0003/0006: every write policy carries WITH CHECK as well
-- as USING. Helper functions come from 0001 and are SECURITY DEFINER.
--
-- Write access by role:
--   consultation_note_types  -> ADMIN, DOCTOR   (both maintain the dropdown)
--   consultation_notes       -> DOCTOR          (clinical content, as 0003)
--
-- No DELETE policy on either table. Both are deactivated via is_active.

ALTER TABLE consultation_note_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_notes ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------ consultation_note_types ---
-- Readable clinic-wide: these are field labels, not clinical content, and every
-- role that can open a consultation needs them to render its notes.
CREATE POLICY consultation_note_types_select ON consultation_note_types
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY consultation_note_types_insert ON consultation_note_types
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('ADMIN', 'DOCTOR')
  );

CREATE POLICY consultation_note_types_update ON consultation_note_types
  FOR UPDATE TO authenticated
  USING (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('ADMIN', 'DOCTOR')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('ADMIN', 'DOCTOR')
  );

-- ----------------------------------------------------- consultation_notes ---
CREATE POLICY consultation_notes_select ON consultation_notes
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY consultation_notes_insert ON consultation_notes
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id() AND current_user_role() = 'DOCTOR');

CREATE POLICY consultation_notes_update ON consultation_notes
  FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id() AND current_user_role() = 'DOCTOR')
  WITH CHECK (clinic_id = get_user_clinic_id() AND current_user_role() = 'DOCTOR');

-- ============================================================================
-- SEED — the five fields this replaces
-- ============================================================================
-- Every existing clinic starts with exactly the labels the consultation form
-- used to hard-code, so nothing a clinician can record today disappears. New
-- clinics are seeded the same way by createClinic() in application code.

INSERT INTO consultation_note_types (clinic_id, name, display_order)
SELECT c.id, defaults.name, defaults.display_order
FROM clinics c
CROSS JOIN (VALUES
  ('Chief complaint', 1),
  ('History', 2),
  ('Examination findings', 3),
  ('Diagnosis', 4),
  ('Treatment plan / doctor''s note', 5)
) AS defaults(name, display_order);

-- ============================================================================
-- RESERVE the five superseded consultation columns
-- ============================================================================
-- The columns stay — dropping them would be irreversible and they may yet be
-- wanted — but nothing in the application reads or writes them from Phase 4.3
-- onwards. Their data is cleared so no stale text can surface anywhere.
--
-- See the DESTRUCTIVE banner at the top of this file.

UPDATE consultations
SET chief_complaint = NULL,
    patient_history = NULL,
    examination_findings = NULL,
    diagnosis = NULL,
    treatment_plan = NULL,
    updated_at = NOW();

COMMENT ON COLUMN consultations.chief_complaint IS
  'RESERVED — superseded by consultation_notes in Phase 4.3. Not read or written.';
COMMENT ON COLUMN consultations.patient_history IS
  'RESERVED — superseded by consultation_notes in Phase 4.3. Not read or written.';
COMMENT ON COLUMN consultations.examination_findings IS
  'RESERVED — superseded by consultation_notes in Phase 4.3. Not read or written.';
COMMENT ON COLUMN consultations.diagnosis IS
  'RESERVED — superseded by consultation_notes in Phase 4.3. Not read or written.';
COMMENT ON COLUMN consultations.treatment_plan IS
  'RESERVED — superseded by consultation_notes in Phase 4.3. Not read or written.';
