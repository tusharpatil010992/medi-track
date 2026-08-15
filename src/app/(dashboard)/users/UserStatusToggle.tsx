"use client";

import Button from "@mui/material/Button";
import { useTransition } from "react";

import { setUserActive } from "@/features/users/actions";

/** Activate / deactivate a clinic user. Never deletes — history must survive. */
export function UserStatusToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="small"
      variant="outlined"
      color={isActive ? "error" : "success"}
      disabled={isPending}
      onClick={() => startTransition(() => setUserActive(userId, !isActive))}
    >
      {isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}
