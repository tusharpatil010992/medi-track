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
    | "medicines"
    | "noteTypes"
    | "billing"
    | "profile";
}

/**
 * Role-based navigation.
 *
 * UI only — hiding a link is not authorisation. Every page independently
 * re-checks the role server-side via requireRole().
 *
 * Lists only routes that exist. Each phase adds its own links.
 */
const DASHBOARD: NavItem = { label: "Dashboard", href: "/dashboard", icon: "dashboard" };
const PATIENTS: NavItem = { label: "Patients", href: "/patients", icon: "patients" };
const APPOINTMENTS: NavItem = {
  label: "Appointments",
  href: "/appointments",
  icon: "appointments",
};
const PROFILE: NavItem = { label: "My Profile", href: "/profile", icon: "profile" };
const CONSULTATIONS: NavItem = {
  label: "Consultations",
  href: "/consultations",
  icon: "consultations",
};
const BILLING: NavItem = { label: "Billing", href: "/billing", icon: "billing" };
/** The consultation-notes dropdown, maintained by ADMIN and DOCTOR alike. */
const NOTE_TYPES: NavItem = {
  label: "Consultation Fields",
  href: "/note-types",
  icon: "noteTypes",
};

export const NAVIGATION: Record<UserRole, NavItem[]> = {
  SUPER_ADMIN: [DASHBOARD, { label: "Clinics", href: "/clinics", icon: "clinics" }, PROFILE],
  ADMIN: [
    DASHBOARD,
    PATIENTS,
    APPOINTMENTS,
    CONSULTATIONS,
    BILLING,
    { label: "Medicines", href: "/medicines", icon: "medicines" },
    NOTE_TYPES,
    { label: "Billing Services", href: "/billing/services", icon: "billing" },
    { label: "Users", href: "/users", icon: "users" },
    { label: "Clinic Settings", href: "/settings", icon: "settings" },
    PROFILE,
  ],
  DOCTOR: [
    DASHBOARD,
    PATIENTS,
    APPOINTMENTS,
    CONSULTATIONS,
    BILLING,
    NOTE_TYPES,
    { label: "My Schedule", href: "/schedule", icon: "schedule" },
    PROFILE,
  ],
  OPTOMETRIST: [DASHBOARD, PATIENTS, APPOINTMENTS, CONSULTATIONS, PROFILE],
  STAFF: [DASHBOARD, PROFILE],
  FRONT_DESK: [DASHBOARD, PATIENTS, APPOINTMENTS, CONSULTATIONS, BILLING, PROFILE],
  PATIENT: [DASHBOARD, PROFILE],
};
