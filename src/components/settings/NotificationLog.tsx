import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { createClient } from "@/lib/supabase/server";
import {
  DELIVERY_STATUS_LABELS,
  NOTIFICATION_TYPE_LABELS,
  type DeliveryStatus,
  type NotificationLog as NotificationRow,
} from "@/types/notification";

const STATUS_COLOUR: Record<DeliveryStatus, "default" | "success" | "error" | "warning"> = {
  PENDING: "warning",
  SENT: "success",
  FAILED: "error",
  SKIPPED: "default",
};

/**
 * Recent outbound messages for this clinic.
 *
 * ADMIN-only, both here and in RLS: the rows carry patients' email addresses
 * and phone numbers. "Not configured" means the clinic is still on placeholder
 * credentials, so nothing was attempted — distinct from a genuine failure.
 */
export async function NotificationLog({ clinicId }: { clinicId: string }) {
  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("sent_at", { ascending: false })
    .limit(50)
    .returns<NotificationRow[]>();

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Notification log
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        The last 50 messages this clinic sent to patients.
      </Typography>

      {!notifications || notifications.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Nothing sent yet. Appointments, completed consultations, invoices and payments each
          trigger a message.
        </Typography>
      ) : (
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Event</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Channel</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>To</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {notifications.map((notification) => (
                <TableRow key={notification.id}>
                  <TableCell>{new Date(notification.sent_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {NOTIFICATION_TYPE_LABELS[notification.notification_type]}
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                    {notification.channel}
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    {notification.recipient_email ?? notification.recipient_phone ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      {/* The failure reason is the whole value of the log; keep it reachable. */}
                      <Tooltip title={notification.error_message ?? ""}>
                        <Chip
                          size="small"
                          label={DELIVERY_STATUS_LABELS[notification.delivery_status]}
                          color={STATUS_COLOUR[notification.delivery_status]}
                          variant={notification.delivery_status === "SKIPPED" ? "outlined" : "filled"}
                        />
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
