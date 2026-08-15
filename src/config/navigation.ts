import type { UserRole } from "@/types/user";

export interface NavItem {
  label: string;
  href: string;
  /** MUI icon name, resolved in the sidebar. */
  icon: "dashboard" | "clinics" | "users" | "settings";
}

/**
 * Role-based navigation.
 *
 * UI only — hiding a link is not authorisation. Every page independently
 * re-checks the role server-side via requireRole().
 *
 * Phase 1 lists only routes that exist. Patients, appointments, consultations,
 * medicines and billing links are added by their own phases.
 */
const DASHBOARD: NavItem = { label: "Dashboard", href: "/dashboard", icon: "dashboard" };

export const NAVIGATION: Record<UserRole, NavItem[]> = {
  SUPER_ADMIN: [DASHBOARD, { label: "Clinics", href: "/clinics", icon: "clinics" }],
  ADMIN: [
    DASHBOARD,
    { label: "Users", href: "/users", icon: "users" },
    { label: "Clinic Settings", href: "/settings", icon: "settings" },
  ],
  DOCTOR: [DASHBOARD],
  OPTOMETRIST: [DASHBOARD],
  STAFF: [DASHBOARD],
  FRONT_DESK: [DASHBOARD],
  PATIENT: [DASHBOARD],
};
