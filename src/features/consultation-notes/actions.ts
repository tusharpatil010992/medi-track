"use server";

import { revalidatePath } from "next/cache";

import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isConsultationEditable, type Consultation, type ConsultationNote } from "@/types/clinical";

export interface ConsultationNotesFormState {
  error: string | null;
  success: boolean;
}

/** One row as it arrived from the form, before it is matched against storage. */
interface SubmittedNote {
  /** Empty for a row the doctor has just added. */
  id: string;
  noteTypeId: string;
  content: string;
  showOnReceipt: boolean;
}

/**
 * Saves the notes on a consultation.
 *
 * The form posts four parallel arrays, one entry per visible row. They stay
 * aligned because every field — including the checkbox, which as a real
 * checkbox would post nothing when unchecked and silently shift the others — is
 * rendered as a controlled input that always submits a value.
 *
 * Rows are reconciled rather than replaced wholesale. consultation_notes has no
 * DELETE policy (Rule 6), so a note the doctor removed is deactivated, an
 * existing note is updated in place, and only genuinely new rows are inserted.
 * That is more work than the delete-and-reinsert prescription_items uses, and
 * it is the price of never destroying clinical text.
 */
export async function saveConsultationNotes(
  _prevState: ConsultationNotesFormState,
  formData: FormData,
): Promise<ConsultationNotesFormState> {
  const profile = await requireRole(["DOCTOR"]);
  const clinicId = requireClinicId(profile);

  const consultationId = String(formData.get("consultation_id") ?? "");
  if (!consultationId) return { error: "Missing consultation reference.", success: false };

  const supabase = await createClient();

  // Re-read filtered by clinic, so a consultation id borrowed from another
  // clinic resolves to nothing. patient_id comes from here, never from the form.
  const { data: consultation } = await supabase
    .from("consultations")
    .select("id, status, patient_id")
    .eq("id", consultationId)
    .eq("clinic_id", clinicId)
    .maybeSingle<Pick<Consultation, "id" | "status" | "patient_id">>();

  if (!consultation) return { error: "Consultation not found.", success: false };
  if (!isConsultationEditable(consultation.status)) {
    return {
      error: `A ${consultation.status.toLowerCase()} consultation can no longer be edited.`,
      success: false,
    };
  }

  const ids = formData.getAll("note_id").map(String);
  const typeIds = formData.getAll("note_type_id").map(String);
  const contents = formData.getAll("content").map(String);
  const flags = formData.getAll("show_on_receipt").map(String);

  const submitted: SubmittedNote[] = ids.map((id, index) => ({
    id,
    noteTypeId: typeIds[index] ?? "",
    content: (contents[index] ?? "").trim(),
    showOnReceipt: flags[index] === "true",
  }));

  // An empty row is how a doctor clears a note, so it is treated as a removal
  // rather than as an error.
  const kept = submitted.filter((note) => note.content !== "");

  if (kept.some((note) => !note.noteTypeId)) {
    return { error: "Choose a field for every note you have written.", success: false };
  }

  const { data: noteTypes } = await supabase
    .from("consultation_note_types")
    .select("id, name")
    .eq("clinic_id", clinicId)
    .returns<{ id: string; name: string }[]>();

  const nameById = new Map((noteTypes ?? []).map((type) => [type.id, type.name]));

  if (kept.some((note) => !nameById.has(note.noteTypeId))) {
    return { error: "That field is not in this clinic's list.", success: false };
  }

  const { data: existing } = await supabase
    .from("consultation_notes")
    .select("id")
    .eq("consultation_id", consultationId)
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .returns<Pick<ConsultationNote, "id">[]>();

  const existingIds = new Set((existing ?? []).map((note) => note.id));
  const now = new Date().toISOString();

  // Updated in place so the note keeps its created_at and its identity.
  for (const [index, note] of kept.entries()) {
    if (!existingIds.has(note.id)) continue;

    const { error } = await supabase
      .from("consultation_notes")
      .update({
        note_type_id: note.noteTypeId,
        note_type_snapshot: nameById.get(note.noteTypeId) ?? "",
        content: note.content,
        show_on_receipt: note.showOnReceipt,
        display_order: index,
        updated_at: now,
        updated_by: profile.id,
      })
      .eq("id", note.id)
      .eq("clinic_id", clinicId);

    if (error) return { error: `Could not save notes: ${error.message}`, success: false };
  }

  const inserts = kept
    .map((note, index) => ({ note, index }))
    .filter(({ note }) => !existingIds.has(note.id))
    .map(({ note, index }) => ({
      clinic_id: clinicId,
      consultation_id: consultationId,
      patient_id: consultation.patient_id,
      note_type_id: note.noteTypeId,
      note_type_snapshot: nameById.get(note.noteTypeId) ?? "",
      content: note.content,
      show_on_receipt: note.showOnReceipt,
      display_order: index,
      created_by: profile.id,
      updated_by: profile.id,
    }));

  if (inserts.length > 0) {
    const { error } = await supabase.from("consultation_notes").insert(inserts);
    if (error) return { error: `Could not save notes: ${error.message}`, success: false };
  }

  // Deactivated, never deleted: a note the doctor removed stays in the record.
  const keptIds = new Set(kept.map((note) => note.id));
  const removedIds = [...existingIds].filter((id) => !keptIds.has(id));

  if (removedIds.length > 0) {
    const { error } = await supabase
      .from("consultation_notes")
      .update({ is_active: false, updated_at: now, updated_by: profile.id })
      .in("id", removedIds)
      .eq("clinic_id", clinicId);

    if (error) return { error: `Could not remove a note: ${error.message}`, success: false };
  }

  revalidatePath(`/consultations/${consultationId}`);
  return { error: null, success: true };
}
