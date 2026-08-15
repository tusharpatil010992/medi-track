"use server";

import { revalidatePath } from "next/cache";

import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isConsultationEditable, type Consultation, type Medicine } from "@/types/clinical";

export interface PrescriptionFormState {
  error: string | null;
  success: boolean;
}

interface ItemInput {
  medicineId: string;
  dosage: string;
  frequency: string;
  duration: string | null;
  quantity: number | null;
  instructions: string | null;
}

/**
 * Reads the repeating item rows.
 *
 * The form posts parallel arrays (medicine_id[], dosage[], …); a row is kept
 * only when a medicine was chosen, so blank spare rows are ignored.
 */
function readItems(formData: FormData): ItemInput[] {
  const medicineIds = formData.getAll("medicine_id").map(String);
  const dosages = formData.getAll("dosage").map(String);
  const frequencies = formData.getAll("frequency").map(String);
  const durations = formData.getAll("duration").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const instructions = formData.getAll("instructions").map(String);

  const items: ItemInput[] = [];

  for (let i = 0; i < medicineIds.length; i += 1) {
    const medicineId = (medicineIds[i] ?? "").trim();
    if (!medicineId) continue;

    const quantityRaw = (quantities[i] ?? "").trim();
    const quantity = quantityRaw ? Number(quantityRaw) : null;

    items.push({
      medicineId,
      dosage: (dosages[i] ?? "").trim(),
      frequency: (frequencies[i] ?? "").trim(),
      duration: (durations[i] ?? "").trim() || null,
      quantity: Number.isFinite(quantity) ? quantity : null,
      instructions: (instructions[i] ?? "").trim() || null,
    });
  }

  return items;
}

/**
 * Saves the consultation's prescription, replacing its items wholesale.
 *
 * medicine_name_snapshot is captured here so a later rename of the medicine
 * master never rewrites what was actually prescribed. Inactive medicines are
 * rejected: they remain readable in historical prescriptions but cannot be
 * chosen for new ones.
 */
export async function savePrescription(
  _prevState: PrescriptionFormState,
  formData: FormData,
): Promise<PrescriptionFormState> {
  const profile = await requireRole(["DOCTOR"]);
  const clinicId = requireClinicId(profile);

  const consultationId = String(formData.get("consultation_id") ?? "");
  if (!consultationId) return { error: "Missing consultation reference.", success: false };

  const supabase = await createClient();

  const { data: consultation } = await supabase
    .from("consultations")
    .select("id, patient_id, status")
    .eq("id", consultationId)
    .eq("clinic_id", clinicId)
    .maybeSingle<Pick<Consultation, "id" | "patient_id" | "status">>();

  if (!consultation) return { error: "Consultation not found.", success: false };
  if (!isConsultationEditable(consultation.status)) {
    return { error: "This consultation is closed and cannot be prescribed against.", success: false };
  }

  const items = readItems(formData);

  for (const item of items) {
    if (!item.dosage) return { error: "Every medicine needs a dosage.", success: false };
    if (!item.frequency) return { error: "Every medicine needs a frequency.", success: false };
  }

  // Resolve names and validate every medicine in one query, scoped to the clinic.
  const medicineIds = [...new Set(items.map((item) => item.medicineId))];
  const medicinesById = new Map<string, Medicine>();

  if (medicineIds.length > 0) {
    const { data: medicines } = await supabase
      .from("medicines")
      .select("id, name, is_active")
      .eq("clinic_id", clinicId)
      .in("id", medicineIds)
      .returns<Pick<Medicine, "id" | "name" | "is_active">[]>();

    for (const medicine of medicines ?? []) {
      medicinesById.set(medicine.id, medicine as Medicine);
    }

    for (const id of medicineIds) {
      const medicine = medicinesById.get(id);
      if (!medicine) return { error: "A selected medicine is not in this clinic.", success: false };
      if (!medicine.is_active) {
        return {
          error: `"${medicine.name}" is deactivated and cannot be prescribed.`,
          success: false,
        };
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("prescriptions")
    .select("id")
    .eq("consultation_id", consultationId)
    .eq("clinic_id", clinicId)
    .maybeSingle<{ id: string }>();

  let prescriptionId = existing?.id;

  if (!prescriptionId) {
    const { data: created, error: createError } = await supabase
      .from("prescriptions")
      .insert({
        clinic_id: clinicId,
        consultation_id: consultationId,
        patient_id: consultation.patient_id,
        doctor_id: profile.id,
        prescription_date: today,
        notes: String(formData.get("prescription_notes") ?? "").trim() || null,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("id")
      .single<{ id: string }>();

    if (createError || !created) {
      return { error: `Could not save prescription: ${createError?.message}`, success: false };
    }
    prescriptionId = created.id;
  } else {
    await supabase
      .from("prescriptions")
      .update({
        notes: String(formData.get("prescription_notes") ?? "").trim() || null,
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      })
      .eq("id", prescriptionId)
      .eq("clinic_id", clinicId);
  }

  // Replace items rather than diffing them — the item list is small and this
  // keeps the save path obvious.
  await supabase
    .from("prescription_items")
    .delete()
    .eq("prescription_id", prescriptionId)
    .eq("clinic_id", clinicId);

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("prescription_items").insert(
      items.map((item) => ({
        clinic_id: clinicId,
        prescription_id: prescriptionId,
        medicine_id: item.medicineId,
        medicine_name_snapshot: medicinesById.get(item.medicineId)?.name ?? "Unknown",
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        quantity: item.quantity,
        instructions: item.instructions,
      })),
    );

    if (itemsError) {
      return { error: `Could not save prescription items: ${itemsError.message}`, success: false };
    }
  }

  revalidatePath(`/consultations/${consultationId}`);
  return { error: null, success: true };
}
