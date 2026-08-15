/**
 * Multi-tenant isolation and behaviour suite.
 *
 * Runs against the live Supabase project using REAL authenticated sessions —
 * not the service-role key, which bypasses RLS and would prove nothing. The
 * service key is used only to set up and tear down fixtures.
 *
 *   npm run verify:isolation
 *
 * Docs require this to be re-run at the end of every phase, since each phase
 * adds clinic-owned tables that inherit the same policy patterns.
 */

import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error("Missing Supabase env vars. Run with: node --env-file=.env.local");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const created = { clinics: [], users: [] };
let pass = 0;
let fail = 0;

function check(name, ok, detail = "") {
  console.log(`  ${ok ? "PASS" : "**FAIL**"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
}

function section(title) {
  console.log(`\n--- ${title} ---`);
}

async function makeClinic(name) {
  const { data } = await admin
    .from("clinics")
    .insert({ name, timezone: "UTC" })
    .select("id")
    .single();
  created.clinics.push(data.id);
  await admin.from("clinic_config").insert({ clinic_id: data.id, timezone: "UTC" });
  return data.id;
}

async function makeUser(clinicId, role, label) {
  const email = `${label}-${randomBytes(4).toString("hex")}@isolation-test.local`;
  const password = `${randomBytes(12).toString("base64url")}aA1!`;
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  created.users.push(data.user.id);
  await admin.from("profiles").insert({
    id: data.user.id,
    clinic_id: clinicId,
    email,
    full_name: label,
    role,
  });
  return { id: data.user.id, email, password };
}

async function sessionFor({ email, password }) {
  const client = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

async function makePatient(clinicId, number, first, last) {
  const { data } = await admin
    .from("patients")
    .insert({
      clinic_id: clinicId,
      patient_number: number,
      first_name: first,
      last_name: last,
    })
    .select("id")
    .single();
  return data.id;
}

console.log("setting up fixtures…");

const clinicA = await makeClinic("Isolation Test Clinic A");
const clinicB = await makeClinic("Isolation Test Clinic B");

const adminA = await makeUser(clinicA, "ADMIN", "admin-a");
const frontDeskA = await makeUser(clinicA, "FRONT_DESK", "frontdesk-a");
const doctorA = await makeUser(clinicA, "DOCTOR", "doctor-a");
const doctorA2 = await makeUser(clinicA, "DOCTOR", "doctor-a2");
const optometristA = await makeUser(clinicA, "OPTOMETRIST", "optom-a");
const doctorB = await makeUser(clinicB, "DOCTOR", "doctor-b");

const patientA = await makePatient(clinicA, "P-9001", "Ana", "Alpha");
const patientB = await makePatient(clinicB, "P-9001", "Ben", "Bravo");

// Doctor A publishes Monday availability (day_of_week 1), 09:00–17:00.
await admin.from("doctor_availability").insert({
  clinic_id: clinicA,
  doctor_id: doctorA.id,
  day_of_week: 1,
  start_time: "09:00",
  end_time: "17:00",
});

const asAdminA = await sessionFor(adminA);
const asFrontDeskA = await sessionFor(frontDeskA);
const asDoctorA = await sessionFor(doctorA);
const asOptometristA = await sessionFor(optometristA);
const asDoctorB = await sessionFor(doctorB);

// ---------------------------------------------------------------------------
section("Phase 1 — clinic, config and profile isolation");

const { data: clinicsSeen } = await asAdminA.from("clinics").select("id");
check("ADMIN A sees only own clinic", clinicsSeen?.length === 1 && clinicsSeen[0].id === clinicA);

const { data: bConfig } = await asAdminA
  .from("clinic_config")
  .select("resend_api_key")
  .eq("clinic_id", clinicB);
check("ADMIN A cannot read clinic B config", (bConfig?.length ?? 0) === 0);

const { data: docConfig } = await asDoctorA.from("clinic_config").select("resend_api_key");
check("DOCTOR cannot read clinic_config secrets", (docConfig?.length ?? 0) === 0);

// ---------------------------------------------------------------------------
section("Phase 2 — cross-clinic reads");

const { data: bPatients } = await asFrontDeskA.from("patients").select("id").eq("clinic_id", clinicB);
check("Clinic A cannot read clinic B patients", (bPatients?.length ?? 0) === 0);

const { data: allPatients } = await asFrontDeskA.from("patients").select("id, clinic_id");
check(
  "Patient list is scoped to own clinic",
  (allPatients ?? []).every((p) => p.clinic_id === clinicA),
  `${allPatients?.length ?? 0} row(s)`,
);

const { data: bAvail } = await asDoctorA
  .from("doctor_availability")
  .select("id")
  .eq("clinic_id", clinicB);
check("Clinic A cannot read clinic B availability", (bAvail?.length ?? 0) === 0);

const { data: bAppts } = await asFrontDeskA
  .from("appointments")
  .select("id")
  .eq("clinic_id", clinicB);
check("Clinic A cannot read clinic B appointments", (bAppts?.length ?? 0) === 0);

// ---------------------------------------------------------------------------
section("Phase 2 — cross-clinic writes blocked by WITH CHECK");

const { error: crossPatient } = await asFrontDeskA.from("patients").insert({
  clinic_id: clinicB,
  patient_number: `X-${randomBytes(3).toString("hex")}`,
  first_name: "Smuggled",
  last_name: "Record",
});
check("INSERT patient into clinic B rejected", Boolean(crossPatient), crossPatient?.code ?? "none");

const { error: crossAppt } = await asFrontDeskA.from("appointments").insert({
  clinic_id: clinicB,
  patient_id: patientB,
  doctor_id: doctorB.id,
  appointment_date: "2030-01-07",
  appointment_time: "10:00",
});
check("INSERT appointment into clinic B rejected", Boolean(crossAppt), crossAppt?.code ?? "none");

const { data: updatedB } = await asFrontDeskA
  .from("patients")
  .update({ last_name: "HIJACKED" })
  .eq("id", patientB)
  .select("id");
check("UPDATE of clinic B patient affects 0 rows", (updatedB?.length ?? 0) === 0);

const { data: bIntact } = await admin
  .from("patients")
  .select("last_name")
  .eq("id", patientB)
  .single();
check("Clinic B patient unmodified", bIntact?.last_name === "Bravo", bIntact?.last_name);

// ---------------------------------------------------------------------------
section("Phase 2 — role write restrictions");

const { error: adminWrite } = await asAdminA.from("patients").insert({
  clinic_id: clinicA,
  patient_number: `A-${randomBytes(3).toString("hex")}`,
  first_name: "Admin",
  last_name: "Attempt",
});
check("ADMIN cannot create patients (read-only)", Boolean(adminWrite), adminWrite?.code ?? "none");

const { error: optomWrite } = await asOptometristA.from("patients").insert({
  clinic_id: clinicA,
  patient_number: `O-${randomBytes(3).toString("hex")}`,
  first_name: "Optom",
  last_name: "Attempt",
});
check("OPTOMETRIST cannot create patients", Boolean(optomWrite), optomWrite?.code ?? "none");

const { data: optomRead } = await asOptometristA.from("patients").select("id");
check("OPTOMETRIST can still read patients", (optomRead?.length ?? 0) > 0);

const { error: frontDeskWrite } = await asFrontDeskA.from("patients").insert({
  clinic_id: clinicA,
  patient_number: `F-${randomBytes(3).toString("hex")}`,
  first_name: "Front",
  last_name: "Desk",
});
check("FRONT_DESK can create patients", !frontDeskWrite, frontDeskWrite?.message ?? "");

// ---------------------------------------------------------------------------
section("Phase 2 — availability ownership");

const { error: foreignAvail } = await asDoctorA.from("doctor_availability").insert({
  clinic_id: clinicA,
  doctor_id: doctorA2.id,
  day_of_week: 2,
  start_time: "09:00",
  end_time: "12:00",
});
check(
  "DOCTOR cannot publish availability for another doctor",
  Boolean(foreignAvail),
  foreignAvail?.code ?? "none",
);

const { error: ownAvail } = await asDoctorA.from("doctor_availability").insert({
  clinic_id: clinicA,
  doctor_id: doctorA.id,
  day_of_week: 3,
  start_time: "09:00",
  end_time: "12:00",
});
check("DOCTOR can publish own availability", !ownAvail, ownAvail?.message ?? "");

const { error: crossClinicAvail } = await asDoctorB.from("doctor_availability").insert({
  clinic_id: clinicA,
  doctor_id: doctorA.id,
  day_of_week: 4,
  start_time: "09:00",
  end_time: "12:00",
});
check(
  "DOCTOR B cannot publish availability in clinic A",
  Boolean(crossClinicAvail),
  crossClinicAvail?.code ?? "none",
);

// ---------------------------------------------------------------------------
section("Phase 2 — appointment integrity");

// 2030-01-07 is a Monday, matching doctor A's published availability.
const { error: validBooking } = await asFrontDeskA.from("appointments").insert({
  clinic_id: clinicA,
  patient_id: patientA,
  doctor_id: doctorA.id,
  appointment_date: "2030-01-07",
  appointment_time: "10:00",
  duration_minutes: 30,
});
check("Valid booking accepted", !validBooking, validBooking?.message ?? "");

const { data: sameDay } = await asFrontDeskA
  .from("appointments")
  .select("id, appointment_time, duration_minutes")
  .eq("clinic_id", clinicA)
  .eq("doctor_id", doctorA.id)
  .eq("appointment_date", "2030-01-07");
check("Booking is visible to own clinic", (sameDay?.length ?? 0) === 1);

// Overlap detection lives in the server action rather than the database, so
// these assert the helper the action depends on. Requires --experimental-strip-types
// to import the TypeScript module directly; npm run verify:isolation sets it.
const { timeToMinutes, intervalsOverlap } = await import("../src/types/appointment.ts");

const clashStart = timeToMinutes("10:15");
check(
  "Overlap helper flags a clash",
  intervalsOverlap(clashStart, clashStart + 30, timeToMinutes("10:00"), timeToMinutes("10:00") + 30),
);

const adjacentStart = timeToMinutes("10:30");
check(
  "Overlap helper allows back-to-back slots",
  !intervalsOverlap(
    adjacentStart,
    adjacentStart + 30,
    timeToMinutes("10:00"),
    timeToMinutes("10:00") + 30,
  ),
);

// ---------------------------------------------------------------------------
section("Phase 2 — patient_number is per-clinic");

const { data: dupeAcrossClinics } = await admin
  .from("patients")
  .select("clinic_id, patient_number")
  .eq("patient_number", "P-9001");
check(
  "Same patient_number can exist in two clinics",
  (dupeAcrossClinics?.length ?? 0) === 2,
  `${dupeAcrossClinics?.length ?? 0} clinic(s)`,
);

const { error: dupeWithinClinic } = await admin.from("patients").insert({
  clinic_id: clinicA,
  patient_number: "P-9001",
  first_name: "Duplicate",
  last_name: "Number",
});
check(
  "Duplicate patient_number within a clinic rejected",
  dupeWithinClinic?.code === "23505",
  dupeWithinClinic?.code ?? "none",
);

// ---------------------------------------------------------------------------
section("Phase 3 — consultations are DOCTOR-only");

const consultationFixture = {
  clinic_id: clinicA,
  patient_id: patientA,
  doctor_id: doctorA.id,
  consultation_date: "2030-01-07",
};

const { data: ownConsultation, error: doctorConsultErr } = await asDoctorA
  .from("consultations")
  .insert(consultationFixture)
  .select("id")
  .single();
check("DOCTOR can open a consultation", !doctorConsultErr, doctorConsultErr?.message ?? "");

const { error: frontDeskConsultErr } = await asFrontDeskA
  .from("consultations")
  .insert(consultationFixture);
check(
  "FRONT_DESK cannot open a consultation",
  Boolean(frontDeskConsultErr),
  frontDeskConsultErr?.code ?? "none",
);

const { error: adminConsultErr } = await asAdminA
  .from("consultations")
  .insert(consultationFixture);
check(
  "ADMIN cannot open a consultation",
  Boolean(adminConsultErr),
  adminConsultErr?.code ?? "none",
);

const { error: optomConsultErr } = await asOptometristA
  .from("consultations")
  .insert(consultationFixture);
check(
  "OPTOMETRIST cannot open a consultation",
  Boolean(optomConsultErr),
  optomConsultErr?.code ?? "none",
);

// Walk-in: appointment_id omitted entirely.
const { error: walkInErr } = await asDoctorA.from("consultations").insert({
  clinic_id: clinicA,
  patient_id: patientA,
  doctor_id: doctorA.id,
  consultation_date: "2030-01-08",
});
check("Walk-in consultation without an appointment accepted", !walkInErr, walkInErr?.message ?? "");

// ---------------------------------------------------------------------------
section("Phase 3 — medicines are ADMIN-managed");

const { data: medicineA, error: adminMedErr } = await asAdminA
  .from("medicines")
  .insert({ clinic_id: clinicA, name: "Probe Aspirin", strength: "75", unit: "mg" })
  .select("id")
  .single();
check("ADMIN can add a medicine", !adminMedErr, adminMedErr?.message ?? "");

const { error: doctorMedErr } = await asDoctorA
  .from("medicines")
  .insert({ clinic_id: clinicA, name: "Doctor Attempt" });
check("DOCTOR cannot add a medicine", Boolean(doctorMedErr), doctorMedErr?.code ?? "none");

const { data: doctorMedRead } = await asDoctorA.from("medicines").select("id");
check("DOCTOR can read medicines", (doctorMedRead?.length ?? 0) > 0);

const { data: frontDeskMedRead } = await asFrontDeskA.from("medicines").select("id");
check(
  "FRONT_DESK cannot read medicines",
  (frontDeskMedRead?.length ?? 0) === 0,
  `${frontDeskMedRead?.length ?? 0} row(s)`,
);

// ---------------------------------------------------------------------------
section("Phase 3 — optical power: DOCTOR and OPTOMETRIST only");

const opticalFixture = (consultationId, sph) => ({
  clinic_id: clinicA,
  consultation_id: consultationId,
  patient_id: patientA,
  date_recorded: "2030-01-07",
  right_eye_sph: sph,
  right_eye_add: 2.0,
});

const { error: optomOpticalErr } = await asOptometristA
  .from("optical_power")
  .insert(opticalFixture(ownConsultation.id, -1.25));
check(
  "OPTOMETRIST can record optical power",
  !optomOpticalErr,
  optomOpticalErr?.message ?? "",
);

const { error: frontDeskOpticalErr } = await asFrontDeskA
  .from("optical_power")
  .insert(opticalFixture(ownConsultation.id, -2.0));
check(
  "FRONT_DESK cannot record optical power",
  Boolean(frontDeskOpticalErr),
  frontDeskOpticalErr?.code ?? "none",
);

const { data: addStored } = await admin
  .from("optical_power")
  .select("right_eye_add")
  .eq("consultation_id", ownConsultation.id)
  .maybeSingle();
check("ADD value persisted", Number(addStored?.right_eye_add) === 2, String(addStored?.right_eye_add));

// ---------------------------------------------------------------------------
section("Phase 3 — cross-clinic isolation");

const { data: consultB } = await admin
  .from("consultations")
  .insert({
    clinic_id: clinicB,
    patient_id: patientB,
    doctor_id: doctorB.id,
    consultation_date: "2030-01-07",
  })
  .select("id")
  .single();

await admin.from("medicines").insert({ clinic_id: clinicB, name: "Clinic B Only" });

const { data: bConsults } = await asDoctorA
  .from("consultations")
  .select("id")
  .eq("clinic_id", clinicB);
check("Clinic A cannot read clinic B consultations", (bConsults?.length ?? 0) === 0);

const { data: bMeds } = await asDoctorA.from("medicines").select("id").eq("clinic_id", clinicB);
check("Clinic A cannot read clinic B medicines", (bMeds?.length ?? 0) === 0);

const { error: crossConsultErr } = await asDoctorA.from("consultations").insert({
  clinic_id: clinicB,
  patient_id: patientB,
  doctor_id: doctorB.id,
  consultation_date: "2030-01-09",
});
check(
  "INSERT consultation into clinic B rejected",
  Boolean(crossConsultErr),
  crossConsultErr?.code ?? "none",
);

const { error: crossOpticalErr } = await asDoctorA.from("optical_power").insert({
  clinic_id: clinicB,
  consultation_id: consultB.id,
  patient_id: patientB,
  date_recorded: "2030-01-07",
  right_eye_sph: -1,
});
check(
  "INSERT optical power into clinic B rejected",
  Boolean(crossOpticalErr),
  crossOpticalErr?.code ?? "none",
);

// ---------------------------------------------------------------------------
section("Phase 3 — prescription snapshot survives a rename");

const { data: prescriptionA } = await asDoctorA
  .from("prescriptions")
  .insert({
    clinic_id: clinicA,
    consultation_id: ownConsultation.id,
    patient_id: patientA,
    doctor_id: doctorA.id,
    prescription_date: "2030-01-07",
  })
  .select("id")
  .single();

const { error: itemErr } = await asDoctorA.from("prescription_items").insert({
  clinic_id: clinicA,
  prescription_id: prescriptionA.id,
  medicine_id: medicineA.id,
  medicine_name_snapshot: "Probe Aspirin",
  dosage: "1 tablet",
  frequency: "Once daily",
});
check("DOCTOR can add prescription items", !itemErr, itemErr?.message ?? "");

// Rename the master record, then confirm history is untouched.
await asAdminA.from("medicines").update({ name: "Renamed Aspirin" }).eq("id", medicineA.id);

const { data: itemAfterRename } = await admin
  .from("prescription_items")
  .select("medicine_name_snapshot")
  .eq("prescription_id", prescriptionA.id)
  .maybeSingle();
check(
  "Snapshot unchanged after medicine renamed",
  itemAfterRename?.medicine_name_snapshot === "Probe Aspirin",
  itemAfterRename?.medicine_name_snapshot ?? "missing",
);

const { data: renamedMaster } = await admin
  .from("medicines")
  .select("name")
  .eq("id", medicineA.id)
  .maybeSingle();
check("Medicine master did rename", renamedMaster?.name === "Renamed Aspirin", renamedMaster?.name);

const { error: frontDeskItemErr } = await asFrontDeskA.from("prescription_items").insert({
  clinic_id: clinicA,
  prescription_id: prescriptionA.id,
  medicine_id: medicineA.id,
  medicine_name_snapshot: "Smuggled",
  dosage: "1",
  frequency: "1",
});
check(
  "FRONT_DESK cannot add prescription items",
  Boolean(frontDeskItemErr),
  frontDeskItemErr?.code ?? "none",
);

// ---------------------------------------------------------------------------
section("Profile — per-visit history is clinic and patient scoped");

// The consultation page shows history from a patient's earlier visits. That
// query must never reach another clinic, or another patient in the same clinic.
const { data: priorHistory } = await asDoctorA
  .from("consultations")
  .select("id, clinic_id, patient_id, patient_history")
  .not("patient_history", "is", null);

check(
  "Prior-history query stays inside own clinic",
  (priorHistory ?? []).every((row) => row.clinic_id === clinicA),
  `${priorHistory?.length ?? 0} row(s)`,
);

const { data: otherPatientHistory } = await asDoctorA
  .from("consultations")
  .select("id")
  .eq("patient_id", patientB);
check("Cannot read consultations of a clinic B patient", (otherPatientHistory?.length ?? 0) === 0);

// ---------------------------------------------------------------------------
console.log("\ncleaning up…");
for (const id of created.clinics) await admin.from("clinics").delete().eq("id", id);
for (const id of created.users) await admin.auth.admin.deleteUser(id);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
