import AddIcon from "@mui/icons-material/Add";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Link from "next/link";

import { EmptyState } from "@/components/common/EmptyState";
import { StatusChip } from "@/components/common/StatusChip";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Clinic } from "@/types/clinic";

import { ClinicStatusToggle } from "./ClinicStatusToggle";

export default async function ClinicsPage() {
  await requireRole(["SUPER_ADMIN"]);

  const supabase = await createClient();
  const { data: clinics } = await supabase
    .from("clinics")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Clinic[]>();

  const newClinicButton = (
    <Button component={Link} href="/clinics/new" variant="contained" startIcon={<AddIcon />}>
      New clinic
    </Button>
  );

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Typography variant="h1" component="h1">
          Clinics
        </Typography>
        {newClinicButton}
      </Stack>

      {!clinics || clinics.length === 0 ? (
        <Paper variant="outlined">
          <EmptyState
            title="No clinics yet"
            description="Create the first clinic to provision its administrator."
            action={newClinicButton}
          />
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Email</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Timezone</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clinics.map((clinic) => (
                <TableRow key={clinic.id} hover>
                  <TableCell>{clinic.name}</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    {clinic.email ?? "—"}
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                    {clinic.timezone}
                  </TableCell>
                  <TableCell>
                    <StatusChip isActive={clinic.is_active} />
                  </TableCell>
                  <TableCell align="right">
                    <ClinicStatusToggle clinicId={clinic.id} isActive={clinic.is_active} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
