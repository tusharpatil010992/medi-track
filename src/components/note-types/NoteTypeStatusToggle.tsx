"use client";

import Button from "@mui/material/Button";
import { useTransition } from "react";

import { setNoteTypeActive } from "@/features/note-types/actions";

/** Deactivate / reactivate. Never deletes — past notes reference this row. */
export function NoteTypeStatusToggle({
  noteTypeId,
  isActive,
}: {
  noteTypeId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="small"
      variant="outlined"
      color={isActive ? "error" : "success"}
      disabled={isPending}
      onClick={() => startTransition(() => setNoteTypeActive(noteTypeId, !isActive))}
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
