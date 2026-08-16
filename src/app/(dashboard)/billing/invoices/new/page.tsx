import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";

import { InvoiceForm } from "@/components/billing/InvoiceForm";
import { PatientPicker, type PickablePatient } from "@/components/billing/PatientPicker";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { BillingService } from "@/types/billing";
import type { Consultation } from "@/types/clinical";
import { patientDisplayName, type Patient } from "@/types/patient";
import { BILLING_WRITE_ROLES } from "@/types/user";

/**
 * A new invoice, reached two ways.
 *
 * `?consultation=` is the handoff from a completed consultation: the visit
 * decides whose bill it is and the invoice is stamped with the consultation, so
 * the two can be traced against each other afterwards.
 *
 * `?patient=` is the standalone route, for a charge with no consultation behind
 * it. With neither, the patient is chosen first.
 */
export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string; consultation?: string }>;
}) {
  const profile = await requireRole(BILLING_WRITE_ROLES);
  const clinicId = requireClinicId(profile);

  const { patient: patientParam, consultation: consultationParam } = await searchParams;
  const supabase = await createClient();

  const services = supabase
    .from("billing_services")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("name")
    .returns<BillingService[]>();

  // ---------------------------------------------------------------- handoff --
  if (consultationParam) {
    const { data: consultation } = await supabase
      .from("consultations")
      .select("id, consultation_number, patient_id, status, consultation_date")
      .eq("id", consultationParam)
      .eq("clinic_id", clinicId)
      .maybeSingle<
        Pick<
          Consultation,
          "id" | "consultation_number" | "patient_id" | "status" | "consultation_date"
        >
      >();

    if (!consultation) {
      return (
        <Stack spacing={3}>
          <Typography variant="h1" component="h1">
            New invoice
          </Typography>
          <Alert severity="error">That consultation is not in this clinic.</Alert>
        </Stack>
      );
    }

    if (consultation.status !== "COMPLETED") {
      return (
        <Stack spacing={3}>
          <Typography variant="h1" component="h1">
            New invoice
          </Typography>
          <Alert severity="warning">
            Consultation {consultation.consultation_number} is not complete yet. The clinical work
            is signed off before the visit is billed.{" "}
            <Link href={`/consultations/${consultation.id}`}>Open the consultation</Link>.
          </Alert>
        </Stack>
      );
    }

    const [{ data: patient }, { data: activeServices }] = await Promise.all([
      supabase
        .from("patients")
        .select("*")
        .eq("id", consultation.patient_id)
        .eq("clinic_id", clinicId)
        .maybeSingle<Patient>(),
      services,
    ]);

    return (
      <Stack spacing={3}>
        <div>
          <Typography variant="h1" component="h1">
            New invoice
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {patient ? patientDisplayName(patient) : "Patient"} · {patient?.patient_number} · from
            consultation{" "}
            <Link href={`/consultations/${consultation.id}`}>
              {consultation.consultation_number}
            </Link>{" "}
            on {consultation.consultation_date}
          </Typography>
        </div>

        <InvoiceForm
          consultationId={consultation.id}
          patientId={consultation.patient_id}
          invoice={null}
          items={[]}
          services={activeServices ?? []}
        />
      </Stack>
    );
  }

  // ------------------------------------------------------------- standalone --
  if (!patientParam) {
    const { data: patients } = await supabase
      .from("patients")
      .select("id, first_name, last_name, patient_number")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("first_name")
      .limit(200)
      .returns<PickablePatient[]>();

    return (
      <Stack spacing={3}>
        <Typography variant="h1" component="h1">
          New invoice
        </Typography>
        <PatientPicker patients={patients ?? []} />
      </Stack>
    );
  }

  const [{ data: patient }, { data: activeServices }] = await Promise.all([
    supabase
      .from("patients")
      .select("*")
      .eq("id", patientParam)
      .eq("clinic_id", clinicId)
      .maybeSingle<Patient>(),
    services,
  ]);

  if (!patient) {
    return (
      <Stack spacing={3}>
        <Typography variant="h1" component="h1">
          New invoice
        </Typography>
        <Alert severity="error">That patient is not in this clinic.</Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h1" component="h1">
          New invoice
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {patientDisplayName(patient)} · {patient.patient_number}
        </Typography>
      </div>

      <InvoiceForm
        patientId={patient.id}
        invoice={null}
        items={[]}
        services={activeServices ?? []}
      />
    </Stack>
  );
}
