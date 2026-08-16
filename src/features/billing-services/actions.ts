"use server";

import { revalidatePath } from "next/cache";

import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface BillingServiceFormState {
  error: string | null;
  success: boolean;
}

interface ServiceFields {
  name: string;
  description: string | null;
  price: number;
}

function readFields(formData: FormData): ServiceFields | string {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Service name is required.";

  const raw = String(formData.get("price") ?? "").trim();
  if (!raw) return "Price is required.";

  const price = Number(raw);
  if (!Number.isFinite(price) || price < 0) return "Price must be zero or more.";

  return {
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    price,
  };
}

/**
 * Billing services are the clinic's price list, maintained by ADMIN.
 *
 * ADMIN owns what may be charged and for how much, but cannot raise an invoice
 * or take a payment — those belong to DOCTOR and FRONT_DESK. That split is
 * enforced by RLS in migration 0006, not just by these role checks.
 */
export async function createBillingService(
  _prevState: BillingServiceFormState,
  formData: FormData,
): Promise<BillingServiceFormState> {
  const profile = await requireRole(["ADMIN"]);
  const clinicId = requireClinicId(profile);

  const fields = readFields(formData);
  if (typeof fields === "string") return { error: fields, success: false };

  const supabase = await createClient();
  const { error } = await supabase.from("billing_services").insert({
    clinic_id: clinicId,
    ...fields,
    created_by: profile.id,
    updated_by: profile.id,
  });

  if (error) return { error: `Could not add service: ${error.message}`, success: false };

  revalidatePath("/billing/services");
  return { error: null, success: true };
}

export async function updateBillingService(
  _prevState: BillingServiceFormState,
  formData: FormData,
): Promise<BillingServiceFormState> {
  const profile = await requireRole(["ADMIN"]);
  const clinicId = requireClinicId(profile);

  const serviceId = String(formData.get("service_id") ?? "");
  if (!serviceId) return { error: "Missing service reference.", success: false };

  const fields = readFields(formData);
  if (typeof fields === "string") return { error: fields, success: false };

  const supabase = await createClient();
  const { error } = await supabase
    .from("billing_services")
    .update({ ...fields, updated_at: new Date().toISOString(), updated_by: profile.id })
    .eq("id", serviceId)
    .eq("clinic_id", clinicId);

  if (error) return { error: `Could not save service: ${error.message}`, success: false };

  revalidatePath("/billing/services");
  return { error: null, success: true };
}

/**
 * Deactivates or reactivates a service.
 *
 * Never deletes: historical invoice_items reference this row, and a past
 * invoice must keep showing what was actually charged.
 */
export async function setBillingServiceActive(
  serviceId: string,
  isActive: boolean,
): Promise<void> {
  const profile = await requireRole(["ADMIN"]);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();
  await supabase
    .from("billing_services")
    .update({ is_active: isActive, updated_at: new Date().toISOString(), updated_by: profile.id })
    .eq("id", serviceId)
    .eq("clinic_id", clinicId);

  revalidatePath("/billing/services");
}
