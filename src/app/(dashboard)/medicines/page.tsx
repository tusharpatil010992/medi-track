import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { StatusChip } from "@/components/common/StatusChip";
import { MedicineForm } from "@/components/medicines/MedicineForm";
import { MedicineStatusToggle } from "@/components/medicines/MedicineStatusToggle";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Medicine } from "@/types/clinical";

export default async function MedicinesPage() {
  const profile = await requireRole(["ADMIN"]);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();
  const { data: medicines } = await supabase
    .from("medicines")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("name")
    .returns<Medicine[]>();

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h1" component="h1" gutterBottom>
          Medicines
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Your clinic&apos;s catalogue. Deactivated medicines stay visible in past prescriptions but
          cannot be chosen for new ones.
        </Typography>
      </div>

      <MedicineForm />

      {!medicines || medicines.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            No medicines yet. Add the first one above.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Generic</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Strength</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Form</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {medicines.map((medicine) => (
                <TableRow key={medicine.id} hover>
                  <TableCell>{medicine.name}</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    {medicine.generic_name ?? "—"}
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                    {[medicine.strength, medicine.unit].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    {medicine.dosage_form ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusChip isActive={medicine.is_active} />
                  </TableCell>
                  <TableCell align="right">
                    <MedicineStatusToggle
                      medicineId={medicine.id}
                      isActive={medicine.is_active}
                    />
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
