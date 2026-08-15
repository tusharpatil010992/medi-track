-- Medi-Track — Phase 2: Patients, Doctors & Appointments
-- Creates: appointment_status enum, patients, patient_history,
--          doctor_availability, appointments, and their RLS policies.
-- Depends on 0001 (clinics, profiles, RLS helper functions).
--
-- Apply: Supabase Dashboard → SQL Editor → paste → Run.

-- ============================================================================
-- ENUM
-- ============================================================================
-- Includes CONFIRMED and CHECKED_IN, which docs/database.md omitted. Phase 2
-- requires check-in, so a checked-in patient needs a state to sit in.
-- Lifecycle: SCHEDULED → CONFIRMED → CHECKED_IN → IN_PROGRESS → COMPLETED,
-- with CANCELLED / NO_SHOW / RESCHEDULED as terminal exits.

CREATE TYPE appointment_status AS ENUM (
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'RESCHEDULED'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- first_name / last_name are absent from docs/database.md but required for
-- registration and search; plan/Mark1.md §13 specifies both.
-- patient_number is the clinic's human-facing reference (P-0001), allocated in
-- application code. It is unique per clinic, not globally.
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_number VARCHAR(50) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  date_of_birth DATE,
  gender VARCHAR(20),
  blood_group VARCHAR(5),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT patients_clinic_number_unique UNIQUE (clinic_id, patient_number)
);

CREATE INDEX idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX idx_patients_is_active ON patients(is_active);
CREATE INDEX idx_patients_last_name ON patients(clinic_id, last_name);
CREATE INDEX idx_patients_phone ON patients(clinic_id, phone);

-- Change-audit trail, per docs/database.md. (plan/Mark1.md §14 describes a
-- clinical-history table instead; requirements.md agrees with database.md, so
-- the audit shape wins. Clinical history lives on consultations in Phase 3.)
CREATE TABLE patient_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  change_type VARCHAR(50) NOT NULL,
  previous_data JSONB,
  new_data JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID
);

CREATE INDEX idx_patient_history_clinic_id ON patient_history(clinic_id);
CREATE INDEX idx_patient_history_patient_id ON patient_history(patient_id);

-- day_of_week follows Postgres EXTRACT(DOW): 0 = Sunday .. 6 = Saturday.
CREATE TABLE doctor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT doctor_availability_time_order CHECK (end_time > start_time)
);

CREATE INDEX idx_doctor_availability_clinic_id ON doctor_availability(clinic_id);
CREATE INDEX idx_doctor_availability_doctor ON doctor_availability(doctor_id, day_of_week);

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  status appointment_status NOT NULL DEFAULT 'SCHEDULED',
  notes TEXT,
  reason_for_visit VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_appointments_clinic_id ON appointments(clinic_id);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_clinic_date ON appointments(clinic_id, appointment_date);
CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Same pattern as 0001: every write policy carries WITH CHECK as well as
-- USING, so a clinic user cannot write a row stamped with another clinic's id.
-- Helper functions come from 0001 and are SECURITY DEFINER.
--
-- Write access is limited to FRONT_DESK and DOCTOR. ADMIN and OPTOMETRIST get
-- read-only; SUPER_ADMIN is a platform role and is not clinic staff, so it has
-- no access to clinical data here.

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------- patients ---
CREATE POLICY patients_select ON patients
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY patients_insert ON patients
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('FRONT_DESK', 'DOCTOR')
  );

CREATE POLICY patients_update ON patients
  FOR UPDATE TO authenticated
  USING (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('FRONT_DESK', 'DOCTOR')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('FRONT_DESK', 'DOCTOR')
  );

-- -------------------------------------------------------- patient_history ---
CREATE POLICY patient_history_select ON patient_history
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY patient_history_insert ON patient_history
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('FRONT_DESK', 'DOCTOR')
  );

-- No UPDATE or DELETE policy: an audit trail is append-only.

-- ---------------------------------------------------- doctor_availability ---
CREATE POLICY doctor_availability_select ON doctor_availability
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id());

-- doctor_id = auth.uid() restricts a doctor to their own schedule.
CREATE POLICY doctor_availability_insert ON doctor_availability
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND current_user_role() = 'DOCTOR'
    AND doctor_id = auth.uid()
  );

CREATE POLICY doctor_availability_update ON doctor_availability
  FOR UPDATE TO authenticated
  USING (
    clinic_id = get_user_clinic_id()
    AND current_user_role() = 'DOCTOR'
    AND doctor_id = auth.uid()
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND current_user_role() = 'DOCTOR'
    AND doctor_id = auth.uid()
  );

-- ----------------------------------------------------------- appointments ---
CREATE POLICY appointments_select ON appointments
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY appointments_insert ON appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('FRONT_DESK', 'DOCTOR')
  );

CREATE POLICY appointments_update ON appointments
  FOR UPDATE TO authenticated
  USING (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('FRONT_DESK', 'DOCTOR')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('FRONT_DESK', 'DOCTOR')
  );

-- No DELETE policies anywhere: records are deactivated via is_active.
