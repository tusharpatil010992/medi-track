"use server";

import { revalidatePath } from "next/cache";

import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { NOTE_TYPE_MANAGING_ROLES } from "@/types/user";

export interface NoteTypeFormState {
  error: string | null;
  success: boolean;
}

export async function createNoteType(
  _prevState: NoteTypeFormState,
  formData: FormData,
): Promise<NoteTypeFormState> {
  const profile = await requireRole(NOTE_TYPE_MANAGING_ROLES);
  const clinicId = requireClinicId(profile);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Field name is required.", success: false };

  const rawOrder = String(formData.get("display_order") ?? "").trim();
  const displayOrder = rawOrder ? Number(rawOrder) : 0;
  if (!Number.isInteger(displayOrder) || displayOrder < 0) {
    return { error: "Order must be a whole number, zero or more.", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("consultation_note_types").insert({
    clinic_id: clinicId,
    name,
    display_order: displayOrder,
    created_by: profile.id,
    updated_by: profile.id,
  });

  // 23505 = the UNIQUE(clinic_id, name) constraint. Worth naming, because
  // "duplicate key value violates..." tells a clinic administrator nothing.
  if (error?.code === "23505") {
    return { error: `"${name}" is already in this clinic's list.`, success: false };
  }
  if (error) return { error: `Could not add field: ${error.message}`, success: false };

  revalidatePath("/note-types");
  return { error: null, success: true };
}

/**
 * Deactivates or reactivates a field.
 *
 * Never deletes: consultation_notes reference this row, and a note written
 * under it keeps showing its note_type_snapshot either way.
 */
export async function setNoteTypeActive(noteTypeId: string, isActive: boolean): Promise<void> {
  const profile = await requireRole(NOTE_TYPE_MANAGING_ROLES);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();
  await supabase
    .from("consultation_note_types")
    .update({ is_active: isActive, updated_at: new Date().toISOString(), updated_by: profile.id })
    .eq("id", noteTypeId)
    .eq("clinic_id", clinicId);

  revalidatePath("/note-types");
}
