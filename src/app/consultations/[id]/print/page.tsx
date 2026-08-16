import { notFound } from "next/navigation";

import { PrintButton } from "@/components/common/PrintButton";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_LETTERHEAD_GAP_PERCENT,
  letterheadGapToMm,
  type Clinic,
} from "@/types/clinic";
import {
  formatDioptre,
  type Consultation,
  type OpticalPower,
  type Prescription,
  type PrescriptionItem,
} from "@/types/clinical";
import { patientAge, patientDisplayName, type Patient } from "@/types/patient";
import { CLINIC_MEMBER_ROLES, type Profile } from "@/types/user";

import styles from "./print.module.css";

/**
 * Print-friendly consultation letter.
 *
 * Deliberately outside the (dashboard) group so no sidebar or app bar is
 * rendered. Printing is browser-native via window.print() with @media print
 * rules — no PDF service, per the documented strategy.
 *
 * This route still authenticates and authorises before showing medical data.
 */
export default async function ConsultationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const [{ data: clinic }, { data: patient }, { data: doctor }, { data: optical }, { data: prescription }] =
    await Promise.all([
      // Only the print offset — the letter carries no clinic header.
      supabase
        .from("clinics")
        .select("letterhead_gap_percent")
        .eq("id", clinicId)
        .maybeSingle<Pick<Clinic, "letterhead_gap_percent">>(),
      supabase
        .from("patients")
        .select("*")
        .eq("id", consultation.patient_id)
        .eq("clinic_id", clinicId)
        .maybeSingle<Patient>(),
      supabase
        .from("profiles")
        .select("*")
        .eq("id", consultation.doctor_id)
        .eq("clinic_id", clinicId)
        .maybeSingle<Profile>(),
      supabase
        .from("optical_power")
        .select("*")
        .eq("consultation_id", id)
        .eq("clinic_id", clinicId)
        .maybeSingle<OpticalPower>(),
      supabase
        .from("prescriptions")
        .select("*")
        .eq("consultation_id", id)
        .eq("clinic_id", clinicId)
        .maybeSingle<Prescription>(),
    ]);

  const { data: fetchedItems } = prescription
    ? await supabase
        .from("prescription_items")
        .select("*")
        .eq("prescription_id", prescription.id)
        .eq("clinic_id", clinicId)
        .returns<PrescriptionItem[]>()
    : { data: [] as PrescriptionItem[] };

  const items = fetchedItems ?? [];

  const gapPercent = clinic?.letterhead_gap_percent ?? DEFAULT_LETTERHEAD_GAP_PERCENT;
  const age = patient ? patientAge(patient.date_of_birth) : null;
  const hasOptical =
    optical &&
    [
      optical.right_eye_sph,
      optical.right_eye_cyl,
      optical.left_eye_sph,
      optical.left_eye_cyl,
    ].some((value) => value !== null);

  return (
    <main className={styles.sheet}>
      <div className={styles.noPrint}>
        <PrintButton />
      </div>

      {/*
        No clinic header. Clinics print these on their own pre-printed
        letterhead, so this space is left blank rather than duplicating (and
        colliding with) what is already on the page. Height is per-clinic,
        set under Clinic Settings; 0% collapses it for plain paper.
      */}
      {gapPercent > 0 ? (
        <div
          className={styles.letterheadSpace}
          style={{ height: letterheadGapToMm(gapPercent) }}
          aria-hidden="true"
        >
          <span className={styles.letterheadHint}>Letterhead area — blank when printed</span>
        </div>
      ) : null}

      <section className={styles.patientBlock}>
        <div>
          <strong>{patient ? patientDisplayName(patient) : "Patient"}</strong>
          <div className={styles.muted}>
            {patient?.patient_number}
            {age === null ? "" : ` · ${age} years`}
            {patient?.gender ? ` · ${patient.gender}` : ""}
          </div>
        </div>
        <div className={styles.right}>
          <div>Date: {consultation.consultation_date}</div>
          {/* Matches the reference printed on the invoice for this visit. */}
          <div className={styles.muted}>Ref: {consultation.consultation_number}</div>
          {consultation.follow_up_date ? <div>Follow-up: {consultation.follow_up_date}</div> : null}
        </div>
      </section>

      {consultation.diagnosis ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Diagnosis</h2>
          <p className={styles.body}>{consultation.diagnosis}</p>
        </section>
      ) : null}

      {consultation.treatment_plan ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Notes</h2>
          <p className={styles.body}>{consultation.treatment_plan}</p>
        </section>
      ) : null}

      {hasOptical && optical ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Optical power</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Eye</th>
                <th>SPH</th>
                <th>CYL</th>
                <th>AXIS</th>
                <th>ADD</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Right</td>
                <td>{formatDioptre(optical.right_eye_sph)}</td>
                <td>{formatDioptre(optical.right_eye_cyl)}</td>
                <td>{optical.right_eye_axis ?? "—"}</td>
                <td>{formatDioptre(optical.right_eye_add)}</td>
              </tr>
              <tr>
                <td>Left</td>
                <td>{formatDioptre(optical.left_eye_sph)}</td>
                <td>{formatDioptre(optical.left_eye_cyl)}</td>
                <td>{optical.left_eye_axis ?? "—"}</td>
                <td>{formatDioptre(optical.left_eye_add)}</td>
              </tr>
            </tbody>
          </table>
          {optical.pupil_distance !== null ? (
            <p className={styles.body}>PD: {optical.pupil_distance} mm</p>
          ) : null}
        </section>
      ) : null}

      {items.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Prescription</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Dosage</th>
                <th>Frequency</th>
                <th>Duration</th>
                <th>Instructions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.medicine_name_snapshot}</td>
                  <td>{item.dosage}</td>
                  <td>{item.frequency}</td>
                  <td>{item.duration ?? "—"}</td>
                  <td>{item.instructions ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <footer className={styles.footer}>
        <div className={styles.signature}>
          <div className={styles.signatureLine} />
          <div>{doctor?.full_name ?? ""}</div>
          <div className={styles.muted}>
            {[doctor?.specialty, doctor?.license_number ? `Reg. ${doctor.license_number}` : null]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      </footer>
    </main>
  );
}
