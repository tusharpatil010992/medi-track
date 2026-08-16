-- Medi-Track — Consultation reference numbers
-- Adds consultations.consultation_number: a clinic-facing reference (C-0001)
-- so an invoice can cite the visit it came from in a form a human can act on.
-- Depends on 0003 (consultations) and 0006 (invoices).
--
-- Apply: Supabase Dashboard → SQL Editor → paste → Run.

-- Nullable to begin with, so existing rows can be backfilled before the column
-- is made mandatory.
ALTER TABLE consultations ADD COLUMN consultation_number VARCHAR(50);

-- Backfill in creation order, numbered per clinic. Two clinics may both hold a
-- C-0001, exactly as they may both hold a P-0001 or an INV-0001.
--
-- This is one-off DML inside a migration, not a trigger: allocation for new
-- consultations lives in application code alongside the patient and invoice
-- allocators.
WITH numbered AS (
  SELECT
    id,
    'C-' || LPAD(
      (ROW_NUMBER() OVER (PARTITION BY clinic_id ORDER BY created_at, id))::TEXT,
      4,
      '0'
    ) AS allocated
  FROM consultations
)
UPDATE consultations
SET consultation_number = numbered.allocated
FROM numbered
WHERE consultations.id = numbered.id;

-- Mandatory from here on, so no consultation can exist without a reference.
ALTER TABLE consultations ALTER COLUMN consultation_number SET NOT NULL;

ALTER TABLE consultations
  ADD CONSTRAINT unique_consultation_number UNIQUE (clinic_id, consultation_number);

CREATE INDEX idx_consultations_number ON consultations(clinic_id, consultation_number);
