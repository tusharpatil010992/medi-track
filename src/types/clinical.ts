export type ConsultationStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type PrescriptionStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface Consultation {
  id: string;
  clinic_id: string;
  /**
   * Clinic-facing reference such as C260818001, allocated in application code.
   * Unique per clinic, so two clinics may both hold a C260818001. Printed on the
   * invoice raised from this visit.
   */
  consultation_number: string;
  /** NULL for a walk-in consultation with no prior booking. */
  appointment_id: string | null;
  patient_id: string;
  doctor_id: string;
  consultation_date: string;
  status: ConsultationStatus;
  /**
   * The five fields below are RESERVED — superseded by `consultation_notes` in
   * Phase 4.3, which records the same material as any number of typed rows.
   * Migration 0008 cleared them and nothing reads or writes them. They are kept
   * on the table rather than dropped in case a fixed shape is wanted again.
   */
  chief_complaint: string | null;
  /** Reserved. Free-text visit history — not the patient_history audit table. */
  patient_history: string | null;
  examination_findings: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  follow_up_date: string | null;
  follow_up_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * One entry in the clinic's consultation-field dropdown.
 *
 * Clinic-owned master data maintained by ADMIN and DOCTOR at /note-types. Every
 * clinic starts with the five labels the consultation form used to hard-code.
 */
export interface ConsultationNoteType {
  id: string;
  clinic_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * The fields every new clinic starts with — the five the consultation form
 * hard-coded until Phase 4.3. Migration 0008 seeds the same list into clinics
 * that already existed; createClinic() applies it to new ones.
 */
export const DEFAULT_NOTE_TYPES: readonly { name: string; display_order: number }[] = [
  { name: "Chief complaint", display_order: 1 },
  { name: "History", display_order: 2 },
  { name: "Examination findings", display_order: 3 },
  { name: "Diagnosis", display_order: 4 },
  { name: "Treatment plan / doctor's note", display_order: 5 },
];

export interface ConsultationNote {
  id: string;
  clinic_id: string;
  consultation_id: string;
  patient_id: string;
  note_type_id: string | null;
  /** The field label at the moment the note was written. Never rewritten. */
  note_type_snapshot: string;
  content: string;
  /** Checked by the doctor to print this note on the consultation letter. */
  show_on_receipt: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface Medicine {
  id: string;
  clinic_id: string;
  name: string;
  generic_name: string | null;
  strength: string | null;
  unit: string | null;
  dosage_form: string | null;
  manufacturer: string | null;
  cost_price: number | null;
  selling_price: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface Prescription {
  id: string;
  clinic_id: string;
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  prescription_date: string;
  status: PrescriptionStatus;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface PrescriptionItem {
  id: string;
  clinic_id: string;
  prescription_id: string;
  medicine_id: string | null;
  /** The medicine's name at the moment it was prescribed. Never rewritten. */
  medicine_name_snapshot: string;
  dosage: string;
  frequency: string;
  duration: string | null;
  quantity: number | null;
  instructions: string | null;
  created_at: string;
}

export interface OpticalPower {
  id: string;
  clinic_id: string;
  consultation_id: string;
  patient_id: string;
  date_recorded: string;
  right_eye_sph: number | null;
  right_eye_cyl: number | null;
  right_eye_axis: number | null;
  /** Near-vision addition. Required for reading and bifocal prescriptions. */
  right_eye_add: number | null;
  left_eye_sph: number | null;
  left_eye_cyl: number | null;
  left_eye_axis: number | null;
  left_eye_add: number | null;
  pupil_distance: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export const CONSULTATION_STATUS_LABELS: Record<ConsultationStatus, string> = {
  DRAFT: "Draft",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const PRESCRIPTION_STATUS_LABELS: Record<PrescriptionStatus, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Statuses after which clinical content is locked. */
export const CLOSED_CONSULTATION_STATUSES: readonly ConsultationStatus[] = [
  "COMPLETED",
  "CANCELLED",
];

export function isConsultationEditable(status: ConsultationStatus): boolean {
  return !CLOSED_CONSULTATION_STATUSES.includes(status);
}

/** Formats a dioptre value with an explicit sign, as optical prescriptions are written. */
export function formatDioptre(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}
