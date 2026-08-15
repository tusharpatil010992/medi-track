"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import { resetUserPassword, type ResetPasswordState } from "@/features/users/actions";

const INITIAL_STATE: ResetPasswordState = { error: null, reset: null };

export function ResetPasswordButton({ userId, fullName }: { userId: string; fullName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(resetUserPassword, INITIAL_STATE);

  return (
    <>
      <Button size="small" variant="text" onClick={() => setOpen(true)}>
        Reset password
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reset password</DialogTitle>

        {state.reset ? (
          <>
            <DialogContent>
              <Alert severity="success" sx={{ mb: 2 }}>
                New password issued for {state.reset.fullName}.
              </Alert>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Shown once. Hand it over directly — they can change it from My profile.
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                <strong>Temporary password:</strong> {state.reset.temporaryPassword}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button variant="contained" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogActions>
          </>
        ) : (
          <form action={formAction} noValidate>
            <input type="hidden" name="user_id" value={userId} />

            <DialogContent>
              {state.error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {state.error}
                </Alert>
              ) : null}
              <Typography variant="body2">
                Issue a new temporary password for <strong>{fullName}</strong>? Their existing
                password stops working immediately.
              </Typography>
            </DialogContent>

            <DialogActions>
              <Button variant="text" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton>Reset password</SubmitButton>
            </DialogActions>
          </form>
        )}
      </Dialog>
    </>
  );
}
