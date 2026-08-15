"use server";

import { revalidatePath } from "next/cache";

import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface MedicineFormState {
  error: string | null;
  success: boolean;
}

interface MedicineFields {
  name: string;
  generic_name: string | null;
  strength: string | null;
  unit: string | null;
  dosage_form: string | null;
  manufacturer: string | null;
  cost_price: number | null;
  selling_price: number | null;
}

function readFields(formData: FormData): MedicineFields | string {
  const text = (key: string) => String(formData.get(key) ?? "").trim() || null;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Medicine name is required.";

  const price = (key: string): number | null | string => {
    const raw = String(formData.get(key) ?? "").trim();
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return `${key.replace("_", " ")} must be a positive number.`;
    return value;
  };

  const cost = price("cost_price");
  if (typeof cost === "string") return cost;
  const selling = price("selling_price");
  if (typeof selling === "string") return selling;

  return {
    name,
    generic_name: text("generic_name"),
    strength: text("strength"),
    unit: text("unit"),
    dosage_form: text("dosage_form"),
    manufacturer: text("manufacturer"),
    cost_price: cost,
    selling_price: selling,
  };
}

/** Medicine master is clinic-owned and ADMIN-managed. */
export async function createMedicine(
  _prevState: MedicineFormState,
  formData: FormData,
): Promise<MedicineFormState> {
  const profile = await requireRole(["ADMIN"]);
  const clinicId = requireClinicId(profile);

  const fields = readFields(formData);
  if (typeof fields === "string") return { error: fields, success: false };

  const supabase = await createClient();
  const { error } = await supabase.from("medicines").insert({
    clinic_id: clinicId,
    ...fields,
    created_by: profile.id,
    updated_by: profile.id,
  });

  if (error) return { error: `Could not add medicine: ${error.message}`, success: false };

  revalidatePath("/medicines");
  return { error: null, success: true };
}

export async function updateMedicine(
  _prevState: MedicineFormState,
  formData: FormData,
): Promise<MedicineFormState> {
  const profile = await requireRole(["ADMIN"]);
  const clinicId = requireClinicId(profile);

  const medicineId = String(formData.get("medicine_id") ?? "");
  if (!medicineId) return { error: "Missing medicine reference.", success: false };

  const fields = readFields(formData);
  if (typeof fields === "string") return { error: fields, success: false };

  const supabase = await createClient();
  const { error } = await supabase
    .from("medicines")
    .update({ ...fields, updated_at: new Date().toISOString(), updated_by: profile.id })
    .eq("id", medicineId)
    .eq("clinic_id", clinicId);

  if (error) return { error: `Could not save medicine: ${error.message}`, success: false };

  revalidatePath("/medicines");
  return { error: null, success: true };
}

/**
 * Deactivates or reactivates a medicine.
 *
 * Never deletes: historical prescriptions reference this row, and their
 * medicine_name_snapshot must stay resolvable.
 */
export async function setMedicineActive(medicineId: string, isActive: boolean): Promise<void> {
  const profile = await requireRole(["ADMIN"]);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();
  await supabase
    .from("medicines")
    .update({ is_active: isActive, updated_at: new Date().toISOString(), updated_by: profile.id })
    .eq("id", medicineId)
    .eq("clinic_id", clinicId);

  revalidatePath("/medicines");
}
