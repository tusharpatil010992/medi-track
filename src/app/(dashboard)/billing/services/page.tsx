import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { BillingServiceForm } from "@/components/billing/BillingServiceForm";
import { BillingServiceStatusToggle } from "@/components/billing/BillingServiceStatusToggle";
import { StatusChip } from "@/components/common/StatusChip";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, type BillingService } from "@/types/billing";

export default async function BillingServicesPage() {
  const profile = await requireRole(["ADMIN"]);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();
  const { data: services } = await supabase
    .from("billing_services")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("name")
    .returns<BillingService[]>();

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h1" component="h1" gutterBottom>
          Billing services
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Your clinic&apos;s price list. Clinical and front-desk staff pick from these when raising
          a bill. Deactivated services stay on past invoices but cannot be added to new ones.
        </Typography>
      </div>

      <BillingServiceForm />

      {!services || services.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            No services yet. Add the first one above — a consultation charge is the usual place to
            start.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Service</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Description</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id} hover>
                  <TableCell>{service.name}</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    {service.description ?? "—"}
                  </TableCell>
                  <TableCell align="right">{formatMoney(service.price)}</TableCell>
                  <TableCell>
                    <StatusChip isActive={service.is_active} />
                  </TableCell>
                  <TableCell align="right">
                    <BillingServiceStatusToggle
                      serviceId={service.id}
                      isActive={service.is_active}
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
