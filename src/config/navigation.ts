import type { UserRole } from "@/types/user";

export interface NavItem {
  label: string;
  href: string;
  /** MUI icon name, resolved in the sidebar. */
  icon:
    | "dashboard"
    | "clinics"
    | "users"
    | "settings"
    | "patients"
    | "appointments"
    | "schedule"
    | "consultations"
    | "medicines";
}

/**
 * Role-based navigation.
 *
 * UI only — hiding a link is not authorisation. Every page independently
 * re-checks the role server-side via requireRole().
 *
 * Lists only routes that exist. Consultations, medicines and billing links are
 * added by their own phases.
 */
const DASHBOARD: NavItem = { label: "Dashboard", href: "/dashboard", icon: "dashboard" };
const PATIENTS: NavItem = { label: "Patients", href: "/patients", icon: "patients" };
const APPOINTMENTS: NavItem = {
  label: "Appointments",
  href: "/appointments",
  icon: "appointments",
};
const CONSULTATIONS: NavItem = {
  label: "Consultations",
  href: "/consultations",
  icon: "consultations",
};

export const NAVIGATION: Record<UserRole, NavItem[]> = {
  SUPER_ADMIN: [DASHBOARD, { label: "Clinics", href: "/clinics", icon: "clinics" }],
  ADMIN: [
    DASHBOARD,
    PATIENTS,
    APPOINTMENTS,
    CONSULTATIONS,
    { label: "Medicines", href: "/medicines", icon: "medicines" },
    { label: "Users", href: "/users", icon: "users" },
    { label: "Clinic Settings", href: "/settings", icon: "settings" },
  ],
  DOCTOR: [
    DASHBOARD,
    PATIENTS,
    APPOINTMENTS,
    CONSULTATIONS,
    { label: "My Schedule", href: "/schedule", icon: "schedule" },
  ],
  OPTOMETRIST: [DASHBOARD, PATIENTS, APPOINTMENTS, CONSULTATIONS],
  STAFF: [DASHBOARD],
  FRONT_DESK: [DASHBOARD, PATIENTS, APPOINTMENTS, CONSULTATIONS],
  PATIENT: [DASHBOARD],
};
