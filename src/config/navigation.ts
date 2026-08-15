import type { UserRole } from "@/types/user";

export interface NavItem {
  label: string;
  href: string;
  /** MUI icon name, resolved in the sidebar. */
  icon: "dashboard" | "clinics" | "users" | "settings" | "patients" | "appointments" | "schedule";
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

export const NAVIGATION: Record<UserRole, NavItem[]> = {
  SUPER_ADMIN: [DASHBOARD, { label: "Clinics", href: "/clinics", icon: "clinics" }],
  ADMIN: [
    DASHBOARD,
    PATIENTS,
    APPOINTMENTS,
    { label: "Users", href: "/users", icon: "users" },
    { label: "Clinic Settings", href: "/settings", icon: "settings" },
  ],
  DOCTOR: [
    DASHBOARD,
    PATIENTS,
    APPOINTMENTS,
    { label: "My Schedule", href: "/schedule", icon: "schedule" },
  ],
  OPTOMETRIST: [DASHBOARD, PATIENTS, APPOINTMENTS],
  STAFF: [DASHBOARD],
  FRONT_DESK: [DASHBOARD, PATIENTS, APPOINTMENTS],
  PATIENT: [DASHBOARD],
};
