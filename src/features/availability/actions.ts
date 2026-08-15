"use server";

import { revalidatePath } from "next/cache";

import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { timeToMinutes } from "@/types/appointment";

export interface AvailabilityFormState {
  error: string | null;
  success: boolean;
}

/**
 * Adds an availability window to the acting doctor's own schedule.
 *
 * doctor_id is taken from the session, never from the form, so a doctor cannot
 * publish availability on a colleague's behalf. RLS enforces the same rule.
 */
export async function addAvailability(
  _prevState: AvailabilityFormState,
  formData: FormData,
): Promise<AvailabilityFormState> {
  const profile = await requireRole(["DOCTOR"]);
  const clinicId = requireClinicId(profile);

  const dayOfWeek = Number(formData.get("day_of_week"));
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { error: "Select a day of the week.", success: false };
  }
  if (!startTime || !endTime) {
    return { error: "Enter both a start and end time.", success: false };
  }
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    return { error: "End time must be after start time.", success: false };
  }

  const supabase = await createClient();

  const { data: sameDay } = await supabase
    .from("doctor_availability")
    .select("start_time, end_time")
    .eq("clinic_id", clinicId)
    .eq("doctor_id", profile.id)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .returns<{ start_time: string; end_time: string }[]>();

  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  const overlaps = (sameDay ?? []).some(
    (window) =>
      start < timeToMinutes(window.end_time) && timeToMinutes(window.start_time) < end,
  );

  if (overlaps) {
    return { error: "That window overlaps one you already have on this day.", success: false };
  }

  const { error } = await supabase.from("doctor_availability").insert({
    clinic_id: clinicId,
    doctor_id: profile.id,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
  });

  if (error) return { error: `Could not save availability: ${error.message}`, success: false };

  revalidatePath("/schedule");
  return { error: null, success: true };
}

/** Deactivates an availability window. Scoped to the acting doctor's own rows. */
export async function removeAvailability(availabilityId: string): Promise<void> {
  const profile = await requireRole(["DOCTOR"]);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();
  await supabase
    .from("doctor_availability")
    .update({ is_active: false })
    .eq("id", availabilityId)
    .eq("clinic_id", clinicId)
    .eq("doctor_id", profile.id);

  revalidatePath("/schedule");
}
