-- Medi-Track — Phase 3: Consultations, Medicines & Printing
-- Creates: consultation_status / prescription_status enums, consultations,
--          medicines, prescriptions, prescription_items, optical_power + RLS.
-- Depends on 0001 (RLS helpers) and 0002 (patients, appointments).
--
-- Apply: Supabase Dashboard → SQL Editor → paste → Run.

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE consultation_status AS ENUM (
  'DRAFT',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE prescription_status AS ENUM (
  'ACTIVE',
  'COMPLETED',
  'CANCELLED'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- appointment_id is NULLABLE so a walk-in can be consulted without a prior
-- booking. It stays UNIQUE: Postgres treats NULLs as distinct under a UNIQUE
-- constraint, so many walk-ins coexist while a booked appointment still maps to
-- at most one consultation.
CREATE TABLE consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id UUID UNIQUE REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consultation_date DATE NOT NULL,
  status consultation_status NOT NULL DEFAULT 'DRAFT',
  chief_complaint TEXT,
  -- Free-text clinical history recorded during this consultation. Distinct
  -- from the patient_history table (0002), which is a change-audit trail.
  patient_history TEXT,
  examination_findings TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  follow_up_date DATE,
  follow_up_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_consultations_clinic_id ON consultations(clinic_id);
CREATE INDEX idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX idx_consultations_doctor_id ON consultations(doctor_id);
CREATE INDEX idx_consultations_status ON consultations(status);
CREATE INDEX idx_consultations_clinic_date ON consultations(clinic_id, consultation_date);

CREATE TABLE medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255),
  strength VARCHAR(100),
  unit VARCHAR(50),
  dosage_form VARCHAR(100),
  manufacturer VARCHAR(255),
  cost_price DECIMAL(10, 2),
  selling_price DECIMAL(10, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_medicines_clinic_id ON medicines(clinic_id);
CREATE INDEX idx_medicines_name ON medicines(clinic_id, name);
CREATE INDEX idx_medicines_is_active ON medicines(is_active);

CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  consultation_id UUID NOT NULL UNIQUE REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prescription_date DATE NOT NULL,
  status prescription_status NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_prescriptions_clinic_id ON prescriptions(clinic_id);
CREATE INDEX idx_prescriptions_patient_id ON prescriptions(patient_id);

-- medicine_name_snapshot preserves what was actually prescribed. Renaming a
-- medicine later must never rewrite historical prescriptions. medicine_id is
-- ON DELETE SET NULL purely as a backstop — medicines are deactivated, not
-- deleted.
CREATE TABLE prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES medicines(id) ON DELETE SET NULL,
  medicine_name_snapshot VARCHAR(255) NOT NULL,
  dosage VARCHAR(100) NOT NULL,
  frequency VARCHAR(100) NOT NULL,
  duration VARCHAR(100),
  quantity INTEGER,
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prescription_items_clinic_id ON prescription_items(clinic_id);
CREATE INDEX idx_prescription_items_prescription ON prescription_items(prescription_id);

-- right_eye_add / left_eye_add carry the near-vision addition. Absent from
-- docs/database.md but specified in plan/Mark1.md §25; without them a reading
-- or bifocal prescription cannot be recorded.
CREATE TABLE optical_power (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date_recorded DATE NOT NULL,
  right_eye_sph DECIMAL(5, 2),
  right_eye_cyl DECIMAL(5, 2),
  right_eye_axis INTEGER CHECK (right_eye_axis BETWEEN 0 AND 180),
  right_eye_add DECIMAL(5, 2),
  left_eye_sph DECIMAL(5, 2),
  left_eye_cyl DECIMAL(5, 2),
  left_eye_axis INTEGER CHECK (left_eye_axis BETWEEN 0 AND 180),
  left_eye_add DECIMAL(5, 2),
  pupil_distance DECIMAL(5, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_optical_power_clinic_id ON optical_power(clinic_id);
CREATE INDEX idx_optical_power_consultation ON optical_power(consultation_id);
CREATE INDEX idx_optical_power_patient ON optical_power(patient_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Same pattern as 0001/0002: every write policy carries WITH CHECK as well as
-- USING. Helper functions come from 0001 and are SECURITY DEFINER.
--
-- Write access by role:
--   consultations, prescriptions, prescription_items  -> DOCTOR
--   medicines                                         -> ADMIN
--   optical_power                                     -> DOCTOR, OPTOMETRIST
--
-- NOTE: the "only an ophthalmologist sees optical power" rule is specialty-
-- based, and profiles.specialty is free text that cannot be matched reliably in
-- a policy. RLS therefore gates optical_power by ROLE only; the specialty check
-- lives in the server action and UI. RLS remains the outer boundary — it stops
-- FRONT_DESK and other clinics outright.

ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE optical_power ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------- consultations ---
CREATE POLICY consultations_select ON consultations
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY consultations_insert ON consultations
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id() AND current_user_role() = 'DOCTOR');

CREATE POLICY consultations_update ON consultations
  FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id() AND current_user_role() = 'DOCTOR')
  WITH CHECK (clinic_id = get_user_clinic_id() AND current_user_role() = 'DOCTOR');

-- -------------------------------------------------------------- medicines ---
-- Master data: readable by clinical staff and ADMIN, writable by ADMIN only.
CREATE POLICY medicines_select ON medicines
  FOR SELECT TO authenticated
  USING (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('ADMIN', 'DOCTOR', 'OPTOMETRIST')
  );

CREATE POLICY medicines_insert ON medicines
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id() AND current_user_role() = 'ADMIN');

CREATE POLICY medicines_update ON medicines
  FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id() AND current_user_role() = 'ADMIN')
  WITH CHECK (clinic_id = get_user_clinic_id() AND current_user_role() = 'ADMIN');

-- ---------------------------------------------------------- prescriptions ---
CREATE POLICY prescriptions_select ON prescriptions
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY prescriptions_insert ON prescriptions
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id() AND current_user_role() = 'DOCTOR');

CREATE POLICY prescriptions_update ON prescriptions
  FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id() AND current_user_role() = 'DOCTOR')
  WITH CHECK (clinic_id = get_user_clinic_id() AND current_user_role() = 'DOCTOR');

-- ----------------------------------------------------- prescription_items ---
CREATE POLICY prescription_items_select ON prescription_items
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY prescription_items_insert ON prescription_items
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id() AND current_user_role() = 'DOCTOR');

-- Items are replaced wholesale when a prescription is re-saved, so DELETE is
-- permitted here. The parent prescription is the historical record and is never
-- deleted.
CREATE POLICY prescription_items_delete ON prescription_items
  FOR DELETE TO authenticated
  USING (clinic_id = get_user_clinic_id() AND current_user_role() = 'DOCTOR');

-- ---------------------------------------------------------- optical_power ---
CREATE POLICY optical_power_select ON optical_power
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY optical_power_insert ON optical_power
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('DOCTOR', 'OPTOMETRIST')
  );

CREATE POLICY optical_power_update ON optical_power
  FOR UPDATE TO authenticated
  USING (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('DOCTOR', 'OPTOMETRIST')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('DOCTOR', 'OPTOMETRIST')
  );

-- No DELETE policies elsewhere: records are deactivated via is_active.
