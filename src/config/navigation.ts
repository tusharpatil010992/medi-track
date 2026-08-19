import type { UserRole } from "@/types/user";

/** MUI icon name, resolved in the sidebar. */
export type NavIcon =
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
  | "masterData"
  | "billing"
  | "profile";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIcon;
}

/**
 * A collapsible heading with links inside it. Has no route of its own — the
 * header toggles, and only the children navigate.
 */
export interface NavGroup {
  label: string;
  icon: NavIcon;
  children: NavItem[];
}

export type NavEntry = NavItem | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
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

const MEDICINES: NavItem = { label: "Medicines", href: "/medicines", icon: "medicines" };
/** The consultation-notes dropdown, maintained by ADMIN and DOCTOR alike. */
const NOTE_TYPES: NavItem = {
  label: "Consultation Fields",
  href: "/note-types",
  icon: "noteTypes",
};
const BILLING_SERVICES: NavItem = {
  label: "Billing Services",
  href: "/billing/services",
  icon: "billing",
};

/**
 * The clinic's reference lists, gathered behind one heading.
 *
 * Built per role rather than shared, because ADMIN maintains all three and
 * DOCTOR only the consultation fields. A doctor therefore sees a group holding
 * a single link — deliberate, so the same item lives in the same place for
 * everyone who can reach it.
 */
function masterData(children: NavItem[]): NavGroup {
  return { label: "Master Data", icon: "masterData", children };
}

export const NAVIGATION: Record<UserRole, NavEntry[]> = {
  SUPER_ADMIN: [DASHBOARD, { label: "Clinics", href: "/clinics", icon: "clinics" }, PROFILE],
  ADMIN: [
    DASHBOARD,
    PATIENTS,
    APPOINTMENTS,
    CONSULTATIONS,
    BILLING,
    masterData([MEDICINES, NOTE_TYPES, BILLING_SERVICES]),
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
    masterData([NOTE_TYPES]),
    { label: "My Schedule", href: "/schedule", icon: "schedule" },
    PROFILE,
  ],
  OPTOMETRIST: [DASHBOARD, PATIENTS, APPOINTMENTS, CONSULTATIONS, PROFILE],
  STAFF: [DASHBOARD, PROFILE],
  FRONT_DESK: [DASHBOARD, PATIENTS, APPOINTMENTS, CONSULTATIONS, BILLING, PROFILE],
  PATIENT: [DASHBOARD, PROFILE],
};
