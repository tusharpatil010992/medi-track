import Chip from "@mui/material/Chip";

/** Active/inactive indicator. Uses a label as well as colour, not colour alone. */
export function StatusChip({ isActive }: { isActive: boolean }) {
  return (
    <Chip
      size="small"
      label={isActive ? "Active" : "Inactive"}
      color={isActive ? "success" : "default"}
      variant={isActive ? "filled" : "outlined"}
    />
  );
}
