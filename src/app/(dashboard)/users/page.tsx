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
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS, type Profile } from "@/types/user";

import { UserStatusToggle } from "./UserStatusToggle";

export default async function UsersPage() {
  const profile = await requireRole(["ADMIN"]);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();

  // RLS already restricts this to the caller's clinic; the explicit filter is a
  // second, application-level guarantee.
  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .returns<Profile[]>();

  const newUserButton = (
    <Button component={Link} href="/users/new" variant="contained" startIcon={<AddIcon />}>
      New user
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
          Users
        </Typography>
        {newUserButton}
      </Stack>

      {!users || users.length === 0 ? (
        <Paper variant="outlined">
          <EmptyState title="No users yet" action={newUserButton} />
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>{user.full_name}</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    {user.email}
                  </TableCell>
                  <TableCell>{ROLE_LABELS[user.role]}</TableCell>
                  <TableCell>
                    <StatusChip isActive={user.is_active} />
                  </TableCell>
                  <TableCell align="right">
                    {user.id === profile.id ? (
                      <Typography variant="caption" color="text.secondary">
                        You
                      </Typography>
                    ) : (
                      <UserStatusToggle userId={user.id} isActive={user.is_active} />
                    )}
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
