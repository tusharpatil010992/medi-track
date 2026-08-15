"use client";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { useFormStatus } from "react-dom";

interface SubmitButtonProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

/** Submit button that shows pending state from the enclosing form action. */
export function SubmitButton({ children, fullWidth }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="contained"
      color="primary"
      disabled={pending}
      fullWidth={fullWidth}
      startIcon={pending ? <CircularProgress size={20} color="inherit" /> : undefined}
    >
      {children}
    </Button>
  );
}
