-- Medi-Track Database Schema
-- Multi-tenant clinic management system
-- All tables include clinic_id for RLS enforcement
-- Apply this schema to Supabase via SQL Editor

-- ============================================================================
-- ENUMS
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

CREATE TYPE appointment_status AS ENUM (
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'RESCHEDULED'
);

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

CREATE TYPE invoice_status AS ENUM (
  'DRAFT',
  'ISSUED',
  'PAID',
  'PARTIALLY_PAID',
  'CANCELLED',
  'VOID'
);

CREATE TYPE payment_method AS ENUM (
  'CASH',
  'CARD',
  'UPI',
  'BANK_TRANSFER',
  'OTHER'
);

CREATE TYPE notification_type AS ENUM (
  'APPOINTMENT_CREATED',
  'APPOINTMENT_RESCHEDULED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_REMINDER',
  'CONSULTATION_COMPLETED',
  'PRESCRIPTION_ISSUED',
  'INVOICE_CREATED',
  'PAYMENT_RECEIVED',
  'OTHER'
);

CREATE TYPE notification_channel AS ENUM (
  'EMAIL',
  'WHATSAPP',
  'SMS'
);

CREATE TYPE audit_action AS ENUM (
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'CONFIG_CHANGE'
);

-- ============================================================================
-- PHASE 1: FOUNDATION & MULTI-TENANCY
-- ============================================================================

-- Clinics table
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
  timezone VARCHAR(50) DEFAULT 'UTC',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_clinics_is_active ON clinics(is_active);
CREATE INDEX idx_clinics_created_at ON clinics(created_at);

-- Clinic configuration (Resend, WhatsApp, timezone, etc.)
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
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID
);

CREATE INDEX idx_clinic_config_clinic_id ON clinic_config(clinic_id);

-- User profiles with roles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  avatar_url VARCHAR(500),
  role user_role NOT NULL,
  license_number VARCHAR(100),
  specialty VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  CONSTRAINT unique_email_per_clinic UNIQUE(clinic_id, email)
);

CREATE INDEX idx_profiles_clinic_id ON profiles(clinic_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);
CREATE INDEX idx_profiles_clinic_role ON profiles(clinic_id, role);

-- ============================================================================
-- PHASE 2: PATIENTS & APPOINTMENTS
-- ============================================================================

-- Patients table (clinic-scoped)
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_number VARCHAR(50) NOT NULL,
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
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  CONSTRAINT unique_patient_number UNIQUE(clinic_id, patient_number)
);

CREATE INDEX idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX idx_patients_email ON patients(email);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_patient_number ON patients(clinic_id, patient_number);
CREATE INDEX idx_patients_is_active ON patients(is_active);

-- Patient history audit trail
CREATE TABLE patient_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  change_type VARCHAR(50) NOT NULL,
  previous_data JSONB,
  new_data JSONB,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  changed_by UUID
);

CREATE INDEX idx_patient_history_clinic_id ON patient_history(clinic_id);
CREATE INDEX idx_patient_history_patient_id ON patient_history(patient_id);
CREATE INDEX idx_patient_history_changed_at ON patient_history(changed_at);

-- Doctor/Optometrist availability
CREATE TABLE doctor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_doctor_availability_clinic_id ON doctor_availability(clinic_id);
CREATE INDEX idx_doctor_availability_doctor_id ON doctor_availability(doctor_id);

-- Appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  status appointment_status DEFAULT 'SCHEDULED',
  notes TEXT,
  reason_for_visit VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_appointments_clinic_id ON appointments(clinic_id);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_clinic_date ON appointments(clinic_id, appointment_date);

-- ============================================================================
-- PHASE 3: CONSULTATIONS, MEDICINES & PRINTING
-- ============================================================================

-- Consultations
CREATE TABLE consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consultation_date DATE NOT NULL,
  status consultation_status DEFAULT 'DRAFT',
  chief_complaint TEXT,
  patient_history TEXT,
  examination_findings TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  follow_up_date DATE,
  follow_up_notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_consultations_clinic_id ON consultations(clinic_id);
CREATE INDEX idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX idx_consultations_doctor_id ON consultations(doctor_id);
CREATE INDEX idx_consultations_status ON consultations(status);
CREATE INDEX idx_consultations_consultation_date ON consultations(consultation_date);

-- Medicine master
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
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_medicines_clinic_id ON medicines(clinic_id);
CREATE INDEX idx_medicines_name ON medicines(name);
CREATE INDEX idx_medicines_is_active ON medicines(is_active);

-- Prescriptions
CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prescription_date DATE NOT NULL,
  status prescription_status DEFAULT 'ACTIVE',
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_prescriptions_clinic_id ON prescriptions(clinic_id);
CREATE INDEX idx_prescriptions_consultation_id ON prescriptions(consultation_id);
CREATE INDEX idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_status ON prescriptions(status);

-- Prescription items with medicine snapshot
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prescription_items_clinic_id ON prescription_items(clinic_id);
CREATE INDEX idx_prescription_items_prescription_id ON prescription_items(prescription_id);

-- Optical power (for optometrist consultations)
CREATE TABLE optical_power (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date_recorded DATE NOT NULL,
  right_eye_sph DECIMAL(5, 2),
  right_eye_cyl DECIMAL(5, 2),
  right_eye_axis INTEGER,
  left_eye_sph DECIMAL(5, 2),
  left_eye_cyl DECIMAL(5, 2),
  left_eye_axis INTEGER,
  pupil_distance DECIMAL(5, 2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID
);

CREATE INDEX idx_optical_power_clinic_id ON optical_power(clinic_id);
CREATE INDEX idx_optical_power_consultation_id ON optical_power(consultation_id);
CREATE INDEX idx_optical_power_patient_id ON optical_power(patient_id);

-- ============================================================================
-- PHASE 4: BILLING & NOTIFICATIONS
-- ============================================================================

-- Billing services master
CREATE TABLE billing_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_billing_services_clinic_id ON billing_services(clinic_id);
CREATE INDEX idx_billing_services_is_active ON billing_services(is_active);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  invoice_number VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  status invoice_status DEFAULT 'DRAFT',
  subtotal DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL,
  paid_amount DECIMAL(12, 2) DEFAULT 0,
  balance_amount DECIMAL(12, 2) NOT NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  CONSTRAINT unique_invoice_number UNIQUE(clinic_id, invoice_number)
);

CREATE INDEX idx_invoices_clinic_id ON invoices(clinic_id);
CREATE INDEX idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date);

-- Invoice items
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoice_items_clinic_id ON invoice_items(clinic_id);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  method payment_method NOT NULL,
  reference_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID
);

CREATE INDEX idx_payments_clinic_id ON payments(clinic_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);

-- Notifications log
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  notification_type notification_type NOT NULL,
  channel notification_channel NOT NULL,
  subject VARCHAR(255),
  body TEXT NOT NULL,
  related_entity_type VARCHAR(100),
  related_entity_id UUID,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  delivery_status VARCHAR(50) DEFAULT 'PENDING',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_clinic_id ON notifications(clinic_id);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_channel ON notifications(channel);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at);

-- ============================================================================
-- PHASE 5: DOCUMENTS, AUDIT & SECURITY
-- ============================================================================

-- Medical documents
CREATE TABLE medical_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  file_path VARCHAR(500),
  storage_url VARCHAR(500),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  uploaded_by UUID,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_medical_documents_clinic_id ON medical_documents(clinic_id);
CREATE INDEX idx_medical_documents_patient_id ON medical_documents(patient_id);
CREATE INDEX idx_medical_documents_document_type ON medical_documents(document_type);

-- Audit logs (excludes full medical content)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  action audit_action NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  user_id UUID,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status VARCHAR(50) DEFAULT 'SUCCESS',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_clinic_id ON audit_logs(clinic_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- RLS POLICIES (Row Level Security)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE optical_power ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's clinic_id
CREATE OR REPLACE FUNCTION get_user_clinic_id()
RETURNS UUID AS $$
  SELECT clinic_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE;

-- RLS Policy: All tables enforce clinic_id isolation
-- Users can only see data from their own clinic
CREATE POLICY clinic_isolation_policy ON patients
  FOR ALL
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY clinic_isolation_policy ON appointments
  FOR ALL
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY clinic_isolation_policy ON consultations
  FOR ALL
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY clinic_isolation_policy ON medicines
  FOR ALL
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY clinic_isolation_policy ON prescriptions
  FOR ALL
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY clinic_isolation_policy ON prescription_items
  FOR ALL
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY clinic_isolation_policy ON invoices
  FOR ALL
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY clinic_isolation_policy ON invoice_items
  FOR ALL
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY clinic_isolation_policy ON payments
  FOR ALL
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY clinic_isolation_policy ON notifications
  FOR ALL
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY clinic_isolation_policy ON medical_documents
  FOR ALL
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY clinic_isolation_policy ON audit_logs
  FOR ALL
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY clinic_isolation_policy ON patient_history
  FOR ALL
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY clinic_isolation_policy ON doctor_availability
  FOR ALL
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY clinic_isolation_policy ON optical_power
  FOR ALL
  USING (clinic_id = get_user_clinic_id());

CREATE POLICY clinic_isolation_policy ON billing_services
  FOR ALL
  USING (clinic_id = get_user_clinic_id());

-- Profiles: users can see profiles from their clinic, SUPER_ADMIN can see all
CREATE POLICY see_clinic_profiles ON profiles
  FOR SELECT
  USING (
    clinic_id = get_user_clinic_id() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'::user_role
  );

-- Profiles: users can only update their own profile
CREATE POLICY update_own_profile ON profiles
  FOR UPDATE
  USING (id = auth.uid());

-- Clinic config: users can see their clinic's config, SUPER_ADMIN can see all
CREATE POLICY see_clinic_config ON clinic_config
  FOR SELECT
  USING (
    clinic_id = get_user_clinic_id() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'::user_role
  );

-- Clinics: users can see their own clinic, SUPER_ADMIN can see all
CREATE POLICY clinic_visibility ON clinics
  FOR SELECT
  USING (
    id = get_user_clinic_id() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'::user_role
  );

-- ============================================================================
-- NOTE: No triggers or functions used
-- Application code handles setting updated_at and audit logging
-- This keeps the schema simple and easy to understand/modify
-- ============================================================================
