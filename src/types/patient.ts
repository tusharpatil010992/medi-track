export interface Patient {
  id: string;
  clinic_id: string;
  /** Clinic-facing reference such as P-0001. Unique per clinic, not globally. */
  patient_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface PatientHistoryEntry {
  id: string;
  clinic_id: string;
  patient_id: string;
  change_type: string;
  previous_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_at: string;
  changed_by: string | null;
}

export const GENDER_OPTIONS = ["Female", "Male", "Other", "Prefer not to say"] as const;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export function patientDisplayName(patient: Pick<Patient, "first_name" | "last_name">): string {
  return `${patient.first_name} ${patient.last_name}`.trim();
}

/** Whole years elapsed, or null when no date of birth is recorded. */
export function patientAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;

  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();

  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}
