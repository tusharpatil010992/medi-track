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
