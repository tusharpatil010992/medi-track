import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Box sx={{ textAlign: "center", py: 8, px: 2 }}>
      <Typography variant="h6" color="text.secondary">
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {description}
        </Typography>
      ) : null}
      {action ? <Box sx={{ mt: 3 }}>{action}</Box> : null}
    </Box>
  );
}
