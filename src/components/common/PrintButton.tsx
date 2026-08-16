"use client";

import Button from "@mui/material/Button";

/** Browser-native printing. No PDF service, per the documented strategy. */
export function PrintButton() {
  return (
    <Button variant="contained" onClick={() => window.print()}>
      Print
    </Button>
  );
}
