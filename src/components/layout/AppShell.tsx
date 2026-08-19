"use client";

import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import DashboardIcon from "@mui/icons-material/Dashboard";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import AssignmentIcon from "@mui/icons-material/Assignment";
import MedicationIcon from "@mui/icons-material/Medication";
import ListAltIcon from "@mui/icons-material/ListAlt";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import PeopleIcon from "@mui/icons-material/People";
import MedicalInformationIcon from "@mui/icons-material/MedicalInformation";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SettingsIcon from "@mui/icons-material/Settings";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FolderIcon from "@mui/icons-material/Folder";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { isNavGroup, type NavEntry, type NavItem } from "@/config/navigation";
import { logout } from "@/features/auth/actions";
import { ROLE_LABELS, type Profile } from "@/types/user";

const DRAWER_WIDTH = 240;

const ICONS = {
  dashboard: DashboardIcon,
  clinics: LocalHospitalIcon,
  users: PeopleIcon,
  settings: SettingsIcon,
  patients: MedicalInformationIcon,
  appointments: CalendarMonthIcon,
  schedule: EventAvailableIcon,
  consultations: AssignmentIcon,
  medicines: MedicationIcon,
  noteTypes: ListAltIcon,
  masterData: FolderIcon,
  billing: ReceiptLongIcon,
  profile: AccountCircleIcon,
} as const;

interface AppShellProps {
  profile: Profile;
  clinicName: string;
  navItems: NavEntry[];
  children: React.ReactNode;
}

export function AppShell({ profile, clinicName, navItems, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Explicit expand/collapse, keyed by group label. A group the user has not
  // touched falls back to "open if it holds the page you are on", so landing on
  // /medicines never hides the link you arrived by.
  const [toggledGroups, setToggledGroups] = useState<Record<string, boolean>>({});

  const covers = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // The longest matching href wins, so /billing/services highlights Billing
  // Services alone rather than Billing as well.
  const activeHref = navItems
    .flatMap((entry) => (isNavGroup(entry) ? entry.children : [entry]))
    .map((item) => item.href)
    .filter(covers)
    .sort((a, b) => b.length - a.length)[0];

  const renderItem = (item: NavItem, nested = false) => {
    const Icon = ICONS[item.icon];

    return (
      <ListItemButton
        key={item.href}
        component={Link}
        href={item.href}
        selected={item.href === activeHref}
        onClick={() => setMobileOpen(false)}
        sx={{ borderRadius: 1, mb: 0.5, pl: nested ? 4 : undefined }}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>
          <Icon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={item.label} />
      </ListItemButton>
    );
  };

  const navigation = (
    <List component="nav" sx={{ px: 1 }}>
      {navItems.map((entry) => {
        if (!isNavGroup(entry)) return renderItem(entry);

        const Icon = ICONS[entry.icon];
        const holdsActivePage = entry.children.some((child) => child.href === activeHref);
        const open = toggledGroups[entry.label] ?? holdsActivePage;

        return (
          <div key={entry.label}>
            {/* Toggles only — the group has no route, and closing the mobile
                drawer here would hide the links the user just asked to see. */}
            <ListItemButton
              onClick={() =>
                setToggledGroups((current) => ({ ...current, [entry.label]: !open }))
              }
              aria-expanded={open}
              sx={{ borderRadius: 1, mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={entry.label} />
              {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </ListItemButton>

            <Collapse in={open} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {entry.children.map((child) => renderItem(child, true))}
              </List>
            </Collapse>
          </div>
        );
      })}
    </List>
  );

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar sx={{ px: 2 }}>
        <Typography variant="h5" noWrap>
          Medi-Track
        </Typography>
      </Toolbar>
      <Divider />
      <Box sx={{ flex: 1, overflowY: "auto", pt: 1 }}>{navigation}</Box>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" noWrap>
          {profile.full_name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="p">
          {ROLE_LABELS[profile.role]}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Toolbar>
          <IconButton
            aria-label="Open navigation"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 2, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h5" noWrap sx={{ flexGrow: 1 }}>
            {clinicName}
          </Typography>

          <form action={logout}>
            <Tooltip title="Sign out">
              <IconButton type="submit" aria-label="Sign out">
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </form>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          {drawerContent}
        </Drawer>

        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              borderRight: "1px solid",
              borderColor: "divider",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          bgcolor: "background.default",
        }}
      >
        <Toolbar />
        <Box sx={{ p: { xs: 2, md: 3 } }}>{children}</Box>
      </Box>
    </Box>
  );
}
