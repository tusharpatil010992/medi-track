-- Medi-Track — Phase 4: Billing & Notifications
-- Creates: invoice_status / payment_method / notification_type /
--          notification_channel enums, billing_services, invoices,
--          invoice_items, payments, notifications + RLS.
-- Depends on 0001 (RLS helpers), 0002 (patients), 0003 (consultations).
--
-- Apply: Supabase Dashboard → SQL Editor → paste → Run.

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE invoice_status AS ENUM (
  'DRAFT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
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

-- ============================================================================
-- TABLES
-- ============================================================================

-- Clinic-owned price list, maintained by ADMIN and consumed by whoever raises
-- the invoice. Deactivated rather than deleted: historical invoice_items point
-- back here.
CREATE TABLE billing_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_billing_services_clinic_id ON billing_services(clinic_id);
CREATE INDEX idx_billing_services_is_active ON billing_services(is_active);

-- Every monetary column is written by the server from recomputed values. The
-- client never supplies a total; see computeInvoiceTotals() in
-- src/types/billing.ts, which is the single place the arithmetic lives.
--
-- discount_reason is not in docs/database.md. It was added on instruction: a
-- discount must always carry a written justification (e.g. a 100% "family
-- visit" waiver), and the CHECK below makes that unskippable at the database
-- level rather than only in the form.
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  invoice_number VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  status invoice_status NOT NULL DEFAULT 'DRAFT',
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  discount_reason TEXT,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  balance_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT unique_invoice_number UNIQUE (clinic_id, invoice_number),
  CONSTRAINT discount_needs_reason CHECK (discount_amount = 0 OR discount_reason IS NOT NULL)
);

CREATE INDEX idx_invoices_clinic_id ON invoices(clinic_id);
CREATE INDEX idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX idx_invoices_consultation_id ON invoices(consultation_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_clinic_date ON invoices(clinic_id, invoice_date);

-- service_id is not in docs/database.md either. Added for the same reason
-- prescription_items carries medicine_id alongside medicine_name_snapshot:
-- `description` is the snapshot and must never change, while the FK preserves
-- the link needed to report revenue by service. ON DELETE SET NULL is a
-- backstop only — services are deactivated, not deleted.
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  service_id UUID REFERENCES billing_services(id) ON DELETE SET NULL,
  description VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_clinic_id ON invoice_items(clinic_id);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- One row per tender. A patient settling ₹1,500 as ₹1,000 cash plus ₹500 card
-- produces two rows, which is why the method lives here and not on the invoice.
-- Payments are never updated or deleted: money received is a historical fact,
-- so there is deliberately no UPDATE or DELETE policy below.
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  method payment_method NOT NULL,
  reference_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_payments_clinic_id ON payments(clinic_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);

-- Outbound message log. Written only by the server-side notification service
-- using the service-role key, because the sender may be a FRONT_DESK or DOCTOR
-- who cannot read clinic_config (ADMIN-only, it holds live credentials).
--
-- provider_message_id is not in docs/database.md; without it a SENT row cannot
-- be traced back to Resend or WhatsApp when a patient reports a message never
-- arrived.
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
  provider_message_id VARCHAR(255),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_clinic_id ON notifications(clinic_id);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_channel ON notifications(channel);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Same pattern as 0001/0002/0003: every write policy carries WITH CHECK as well
-- as USING. Helper functions come from 0001 and are SECURITY DEFINER; clinic
-- suspension (0005) therefore covers these tables with no extra work.
--
-- Separation of duties, per instruction:
--   billing_services              ADMIN writes the price list
--   invoices, invoice_items       DOCTOR and FRONT_DESK transact
--   payments                      DOCTOR and FRONT_DESK take money
--   notifications                 ADMIN reads the log; nobody writes via RLS
--
-- ADMIN can read every billing row but cannot raise an invoice or record a
-- payment. OPTOMETRIST and STAFF have no billing access at all.

ALTER TABLE billing_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------- billing_services ---
CREATE POLICY billing_services_select ON billing_services
  FOR SELECT TO authenticated
  USING (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('ADMIN', 'DOCTOR', 'FRONT_DESK')
  );

CREATE POLICY billing_services_insert ON billing_services
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id() AND current_user_role() = 'ADMIN');

CREATE POLICY billing_services_update ON billing_services
  FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id() AND current_user_role() = 'ADMIN')
  WITH CHECK (clinic_id = get_user_clinic_id() AND current_user_role() = 'ADMIN');

-- --------------------------------------------------------------- invoices ---
CREATE POLICY invoices_select ON invoices
  FOR SELECT TO authenticated
  USING (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('ADMIN', 'DOCTOR', 'FRONT_DESK')
  );

CREATE POLICY invoices_insert ON invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('DOCTOR', 'FRONT_DESK')
  );

CREATE POLICY invoices_update ON invoices
  FOR UPDATE TO authenticated
  USING (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('DOCTOR', 'FRONT_DESK')
  )
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('DOCTOR', 'FRONT_DESK')
  );

-- ---------------------------------------------------------- invoice_items ---
CREATE POLICY invoice_items_select ON invoice_items
  FOR SELECT TO authenticated
  USING (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('ADMIN', 'DOCTOR', 'FRONT_DESK')
  );

CREATE POLICY invoice_items_insert ON invoice_items
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('DOCTOR', 'FRONT_DESK')
  );

-- Lines are replaced wholesale while the invoice is still DRAFT, the same way
-- prescription_items are. The server refuses this once the invoice is issued.
CREATE POLICY invoice_items_delete ON invoice_items
  FOR DELETE TO authenticated
  USING (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('DOCTOR', 'FRONT_DESK')
  );

-- --------------------------------------------------------------- payments ---
CREATE POLICY payments_select ON payments
  FOR SELECT TO authenticated
  USING (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('ADMIN', 'DOCTOR', 'FRONT_DESK')
  );

CREATE POLICY payments_insert ON payments
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('DOCTOR', 'FRONT_DESK')
  );

-- ---------------------------------------------------------- notifications ---
-- Read is ADMIN-only: rows carry patient names, email addresses and phone
-- numbers in plain text. There is no INSERT or UPDATE policy on purpose — the
-- notification service writes with the service-role key, so no authenticated
-- role can forge or alter a delivery record.
CREATE POLICY notifications_select ON notifications
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id() AND current_user_role() = 'ADMIN');
