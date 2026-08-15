export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "DOCTOR"
  | "OPTOMETRIST"
  | "STAFF"
  | "FRONT_DESK"
  | "PATIENT";

/** Roles a clinic ADMIN is allowed to create. Never includes ADMIN or SUPER_ADMIN. */
export const CLINIC_STAFF_ROLES = [
  "DOCTOR",
  "OPTOMETRIST",
  "STAFF",
  "FRONT_DESK",
] as const satisfies readonly UserRole[];

export type ClinicStaffRole = (typeof CLINIC_STAFF_ROLES)[number];

/**
 * Roles that may view clinic operational data (patients, appointments).
 *
 * Excludes SUPER_ADMIN, which is platform-level and belongs to no clinic, and
 * PATIENT, whose self-service access arrives in a later phase.
 */
export const CLINIC_MEMBER_ROLES = [
  "ADMIN",
  "DOCTOR",
  "OPTOMETRIST",
  "FRONT_DESK",
] as const satisfies readonly UserRole[];

/** Roles that may create or modify patients and appointments. */
export const CLINICAL_WRITE_ROLES = [
  "FRONT_DESK",
  "DOCTOR",
] as const satisfies readonly UserRole[];

export function canWriteClinicalData(role: UserRole): boolean {
  return (CLINICAL_WRITE_ROLES as readonly UserRole[]).includes(role);
}

/**
 * Whether this user records optical power.
 *
 * True for OPTOMETRIST — measuring is their entire remit — and for a DOCTOR
 * practising ophthalmology, who may record it themselves.
 *
 * `specialty` is a free-text column, so the match is deliberately loose to
 * cover "Ophthalmology", "Ophthalmologist" and "Ophthalmic". A clinic that
 * types something else entirely will not see the section; ADMINs need to know
 * this field drives behaviour, which is noted in docs/database.md.
 */
export function recordsOpticalPower(
  profile: Pick<Profile, "role" | "specialty">,
): boolean {
  if (profile.role === "OPTOMETRIST") return true;
  if (profile.role !== "DOCTOR") return false;
  return /ophthalm/i.test(profile.specialty ?? "");
}

export interface Profile {
  id: string;
  /** NULL for SUPER_ADMIN — a platform-level role that belongs to no clinic. */
  clinic_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  license_number: string | null;
  specialty: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  DOCTOR: "Doctor",
  OPTOMETRIST: "Optometrist",
  STAFF: "Staff",
  FRONT_DESK: "Front Desk",
  PATIENT: "Patient",
};
