-- Medi-Track — Letterhead gap setting
-- Adds a per-clinic print offset so each tenant can match its own stationery.
-- Depends on 0001 (clinics).
--
-- Apply: Supabase Dashboard → SQL Editor → paste → Run.

-- Deliberately on `clinics`, NOT `clinic_config`.
--
-- clinic_config holds live credentials, so its RLS restricts SELECT to ADMIN and
-- SUPER_ADMIN. The consultation letter is printed by DOCTORs, who therefore
-- cannot read that table at all. This value is presentation config rather than a
-- secret, so it belongs on `clinics`, which every clinic member can already read
-- while remaining ADMIN-editable.
--
-- Percentage of A4 page height (297mm): 12% ≈ 35mm, a typical letterhead band.
ALTER TABLE clinics
  ADD COLUMN letterhead_gap_percent NUMERIC(4, 1) NOT NULL DEFAULT 12.0
  CONSTRAINT clinics_letterhead_gap_range CHECK (letterhead_gap_percent BETWEEN 0 AND 50);

COMMENT ON COLUMN clinics.letterhead_gap_percent IS
  'Blank space reserved at the top of printed letters, as a percentage of A4 page height, so content clears pre-printed letterhead. 0 disables the gap.';
