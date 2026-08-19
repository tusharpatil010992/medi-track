import PrintIcon from "@mui/icons-material/Print";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConsultationBilling } from "@/components/billing/ConsultationBilling";
import { ConsultationDetailsForm } from "@/components/consultations/ConsultationDetailsForm";
import { ConsultationNotesForm } from "@/components/consultations/ConsultationNotesForm";
import { ConsultationStatusActions } from "@/components/consultations/ConsultationStatusActions";
import { OpticalPowerForm } from "@/components/consultations/OpticalPowerForm";
import { PrescriptionForm } from "@/components/consultations/PrescriptionForm";
import { PreviousHistory, type PriorNote } from "@/components/consultations/PreviousHistory";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  CONSULTATION_STATUS_LABELS,
  isConsultationEditable,
  type Consultation,
  type ConsultationNote,
  type ConsultationNoteType,
  type Medicine,
  type OpticalPower,
  type Prescription,
  type PrescriptionItem,
} from "@/types/clinical";
import { patientAge, patientDisplayName, type Patient } from "@/types/patient";
import { CLINIC_MEMBER_ROLES, recordsOpticalPower } from "@/types/user";

export default async function ConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(CLINIC_MEMBER_ROLES);
  const clinicId = requireClinicId(profile);
  const { id } = await params;

  const supabase = await createClient();

  const { data: consultation } = await supabase
    .from("consultations")
    .select("*")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .maybeSingle<Consultation>();

  if (!consultation) notFound();

  const [
    { data: patient },
    { data: prescription },
    { data: optical },
    { data: notes },
    { data: noteTypes },
    { data: priorVisits },
  ] = await Promise.all([
    supabase
      .from("patients")
      .select("*")
      .eq("id", consultation.patient_id)
      .eq("clinic_id", clinicId)
      .maybeSingle<Patient>(),
    supabase
      .from("prescriptions")
      .select("*")
      .eq("consultation_id", id)
      .eq("clinic_id", clinicId)
      .maybeSingle<Prescription>(),
    supabase
      .from("optical_power")
      .select("*")
      .eq("consultation_id", id)
      .eq("clinic_id", clinicId)
      .maybeSingle<OpticalPower>(),
    supabase
      .from("consultation_notes")
      .select("*")
      .eq("consultation_id", id)
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("display_order")
      .returns<ConsultationNote[]>(),
    // Inactive fields included, so a note written under one still shows its
    // label instead of falling back to a blank dropdown.
    supabase
      .from("consultation_note_types")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("display_order")
      .order("name")
      .returns<ConsultationNoteType[]>(),
    // Earlier visits by this patient, newest first. Their notes are read below,
    // once the visits themselves are known.
    supabase
      .from("consultations")
      .select("id, consultation_date")
      .eq("clinic_id", clinicId)
      .eq("patient_id", consultation.patient_id)
      .neq("id", consultation.id)
      .order("consultation_date", { ascending: false })
      .limit(10)
      .returns<Pick<Consultation, "id" | "consultation_date">[]>(),
  ]);

  const visitDates = new Map((priorVisits ?? []).map((visit) => [visit.id, visit.consultation_date]));

  const { data: priorNoteRows } =
    visitDates.size > 0
      ? await supabase
          .from("consultation_notes")
          .select("id, consultation_id, note_type_snapshot, content")
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .in("consultation_id", [...visitDates.keys()])
          .order("display_order")
          .returns<Omit<PriorNote, "consultation_date">[]>()
      : { data: [] as Omit<PriorNote, "consultation_date">[] };

  // Ordered by visit, newest first, so PreviousHistory can group as it reads.
  const priorNotes: PriorNote[] = (priorVisits ?? []).flatMap((visit) =>
    (priorNoteRows ?? [])
      .filter((note) => note.consultation_id === visit.id)
      .map((note) => ({ ...note, consultation_date: visit.consultation_date })),
  );

  // Medicines are only readable by ADMIN/DOCTOR/OPTOMETRIST under RLS, so this
  // returns nothing for other roles — the prescription form is hidden anyway.
  const [{ data: items }, { data: medicines }] = await Promise.all([
    prescription
      ? supabase
          .from("prescription_items")
          .select("*")
          .eq("prescription_id", prescription.id)
          .eq("clinic_id", clinicId)
          .returns<PrescriptionItem[]>()
      : Promise.resolve({ data: [] as PrescriptionItem[] }),
    supabase
      .from("medicines")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("name")
      .returns<Medicine[]>(),
  ]);

  const isOwningDoctor = profile.role === "DOCTOR" && profile.id === consultation.doctor_id;
  const editable = isConsultationEditable(consultation.status);
  const canEditClinical = isOwningDoctor && editable;
  const showOptical = recordsOpticalPower(profile);
  const age = patient ? patientAge(patient.date_of_birth) : null;

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <div>
          <Typography variant="h1" component="h1">
            {patient ? patientDisplayName(patient) : "Consultation"}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}>
            {patient ? (
              <Typography variant="body2" color="text.secondary">
                {patient.patient_number}
                {age === null ? "" : ` · ${age}y`}
                {patient.gender ? ` · ${patient.gender}` : ""}
              </Typography>
            ) : null}
            {/* The reference an invoice cites, so it is visible where it is quoted from. */}
            <Chip size="small" variant="outlined" label={consultation.consultation_number} />
            <Chip size="small" label={CONSULTATION_STATUS_LABELS[consultation.status]} />
            <Chip
              size="small"
              variant="outlined"
              label={consultation.appointment_id ? "Booked" : "Walk-in"}
            />
          </Stack>
        </div>

        <Stack direction="row" spacing={1}>
          <Button
            component={Link}
            href={`/consultations/${consultation.id}/print`}
            variant="outlined"
            startIcon={<PrintIcon />}
          >
            Print letter
          </Button>
          {isOwningDoctor ? (
            <ConsultationStatusActions
              consultationId={consultation.id}
              status={consultation.status}
            />
          ) : null}
        </Stack>
      </Stack>

      {!editable ? (
        <Alert severity="info">
          This consultation is {CONSULTATION_STATUS_LABELS[consultation.status].toLowerCase()} and
          is now read-only.
        </Alert>
      ) : null}

      {editable && !isOwningDoctor && profile.role === "DOCTOR" ? (
        <Alert severity="warning">
          This consultation belongs to another clinician, so it is read-only for you.
        </Alert>
      ) : null}

      <PreviousHistory notes={priorNotes} />

      <ConsultationNotesForm
        consultationId={consultation.id}
        noteTypes={noteTypes ?? []}
        notes={notes ?? []}
        readOnly={!canEditClinical}
      />

      <ConsultationDetailsForm consultation={consultation} readOnly={!canEditClinical} />

      {showOptical ? (
        <OpticalPowerForm
          consultationId={consultation.id}
          optical={optical ?? null}
          readOnly={!editable}
        />
      ) : null}

      {profile.role === "DOCTOR" ? (
        <PrescriptionForm
          consultationId={consultation.id}
          medicines={medicines ?? []}
          prescription={prescription ?? null}
          items={items ?? []}
          readOnly={!canEditClinical}
        />
      ) : null}

      <ConsultationBilling
        consultationId={consultation.id}
        consultationNumber={consultation.consultation_number}
        clinicId={clinicId}
        role={profile.role}
        consultationCompleted={consultation.status === "COMPLETED"}
      />

      {profile.role !== "DOCTOR" && items && items.length > 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h4" component="h2" gutterBottom>
              Prescription
            </Typography>
            <Stack spacing={1}>
              {items.map((item) => (
                <Typography key={item.id} variant="body2">
                  {item.medicine_name_snapshot} — {item.dosage}, {item.frequency}
                  {item.duration ? `, ${item.duration}` : ""}
                </Typography>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
