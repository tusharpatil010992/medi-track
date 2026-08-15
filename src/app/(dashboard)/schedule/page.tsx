import Typography from "@mui/material/Typography";

import { ScheduleEditor } from "@/components/appointments/ScheduleEditor";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { DoctorAvailability } from "@/types/appointment";

export default async function SchedulePage() {
  const profile = await requireRole(["DOCTOR"]);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();

  // Own rows only. RLS enforces the same restriction on writes.
  const { data: availability } = await supabase
    .from("doctor_availability")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("doctor_id", profile.id)
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time")
    .returns<DoctorAvailability[]>();

  return (
    <>
      <Typography variant="h1" component="h1" gutterBottom>
        My schedule
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Appointments can only be booked inside these windows.
      </Typography>
      <ScheduleEditor availability={availability ?? []} />
    </>
  );
}
