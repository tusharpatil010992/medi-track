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

// consultation_number is NOT NULL and unique per clinic (migration 0007), so
// every fixture insert needs its own. The 9000 range keeps these clear of the
// C-0001 sequence the application allocates.
let consultSeq = 9000;
const nextConsultRef = () => `C-${(consultSeq += 1)}`;

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

// Preflight: consultation_number (migration 0007) is mandatory and every Phase 3
// fixture supplies it. Without the column the run collapses somewhere in the
// middle with a null-dereference rather than saying what is actually wrong, so
// stop here — after tearing the fixtures down.
const { error: refProbe } = await admin.from("consultations").select("consultation_number").limit(1);

if (refProbe) {
  console.log("\n--- Consultation references — MISSING ---");
  console.log("  consultations.consultation_number is absent.");
  console.log("  Apply supabase/migrations/0007_consultation_number.sql");
  console.log("  (Supabase Dashboard → SQL Editor → paste → Run), then re-run this suite.");
  console.log(`  Reported: ${refProbe.code ?? ""} ${refProbe.message ?? ""}`.trim());

  console.log("\ncleaning up…");
  for (const id of created.clinics) await admin.from("clinics").delete().eq("id", id);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
  process.exit(1);
}

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

// A fresh object each time: the reference is unique per clinic, so reusing one
// literal across four inserts would confuse an RLS refusal with a duplicate key.
const consultationFixture = () => ({
  clinic_id: clinicA,
  consultation_number: nextConsultRef(),
  patient_id: patientA,
  doctor_id: doctorA.id,
  consultation_date: "2030-01-07",
});

const { data: ownConsultation, error: doctorConsultErr } = await asDoctorA
  .from("consultations")
  .insert(consultationFixture())
  .select("id")
  .single();
check("DOCTOR can open a consultation", !doctorConsultErr, doctorConsultErr?.message ?? "");

const { error: frontDeskConsultErr } = await asFrontDeskA
  .from("consultations")
  .insert(consultationFixture());
check(
  "FRONT_DESK cannot open a consultation",
  frontDeskConsultErr?.code === "42501",
  frontDeskConsultErr?.code ?? "none",
);

const { error: adminConsultErr } = await asAdminA
  .from("consultations")
  .insert(consultationFixture());
check(
  "ADMIN cannot open a consultation",
  adminConsultErr?.code === "42501",
  adminConsultErr?.code ?? "none",
);

const { error: optomConsultErr } = await asOptometristA
  .from("consultations")
  .insert(consultationFixture());
check(
  "OPTOMETRIST cannot open a consultation",
  optomConsultErr?.code === "42501",
  optomConsultErr?.code ?? "none",
);

// Walk-in: appointment_id omitted entirely.
const { error: walkInErr } = await asDoctorA.from("consultations").insert({
  clinic_id: clinicA,
  consultation_number: nextConsultRef(),
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
    consultation_number: nextConsultRef(),
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
  consultation_number: nextConsultRef(),
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
section("Print settings — letterhead gap");

// The whole reason this column sits on `clinics` rather than `clinic_config`:
// DOCTORs print the letters, and clinic_config is ADMIN-only because it stores
// credentials. If a doctor cannot read the gap, every printed letter silently
// falls back to the default.
const { data: doctorReadsGap } = await asDoctorA
  .from("clinics")
  .select("letterhead_gap_percent")
  .eq("id", clinicA)
  .maybeSingle();
check(
  "DOCTOR can read the letterhead gap (needed to print)",
  doctorReadsGap?.letterhead_gap_percent !== undefined,
  `${doctorReadsGap?.letterhead_gap_percent}%`,
);

const { data: adminSetGap } = await asAdminA
  .from("clinics")
  .update({ letterhead_gap_percent: 20 })
  .eq("id", clinicA)
  .select("letterhead_gap_percent");
check("ADMIN can set own clinic's gap", Number(adminSetGap?.[0]?.letterhead_gap_percent) === 20);

const { data: doctorSetGap } = await asDoctorA
  .from("clinics")
  .update({ letterhead_gap_percent: 45 })
  .eq("id", clinicA)
  .select("id");
check("DOCTOR cannot change the gap", (doctorSetGap?.length ?? 0) === 0);

const { data: crossGap } = await asAdminA
  .from("clinics")
  .update({ letterhead_gap_percent: 45 })
  .eq("id", clinicB)
  .select("id");
check("ADMIN A cannot change clinic B's gap", (crossGap?.length ?? 0) === 0);

const { error: rangeErr } = await asAdminA
  .from("clinics")
  .update({ letterhead_gap_percent: 80 })
  .eq("id", clinicA);
check("Out-of-range gap rejected", rangeErr?.code === "23514", rangeErr?.code ?? "none");

// ---------------------------------------------------------------------------
// Phase 4 tables are probed first. Without migration 0006 every billing check
// would fail with PGRST205 ("table not found"), which reads like a broken
// policy rather than a migration that has not been run — the same trap Phase 2
// hit from the other direction.
const { error: phase4Probe } = await admin.from("billing_services").select("id").limit(1);
const phase4Ready = phase4Probe?.code !== "PGRST205";

async function runPhase4DatabaseTests() {
section("Phase 4 — billing services are ADMIN-managed");

const { data: createdService, error: serviceErr } = await asAdminA
  .from("billing_services")
  .insert({ clinic_id: clinicA, name: "Probe Consultation", price: 500 })
  .select("id")
  .single();
check("ADMIN can add a billing service", Boolean(createdService), serviceErr?.code ?? "");

const { error: doctorService } = await asDoctorA
  .from("billing_services")
  .insert({ clinic_id: clinicA, name: "Doctor Priced", price: 100 });
check("DOCTOR cannot add a service", doctorService?.code === "42501", doctorService?.code ?? "none");

const { error: deskService } = await asFrontDeskA
  .from("billing_services")
  .insert({ clinic_id: clinicA, name: "Desk Priced", price: 100 });
check("FRONT_DESK cannot add a service", deskService?.code === "42501", deskService?.code ?? "none");

const { data: doctorReadsServices } = await asDoctorA.from("billing_services").select("id");
check("DOCTOR can read the price list", (doctorReadsServices?.length ?? 0) > 0);

const { data: optomServices } = await asOptometristA.from("billing_services").select("id");
check("OPTOMETRIST reads no services", (optomServices?.length ?? 0) === 0);

// ---------------------------------------------------------------------------
section("Phase 4 — invoices and payments are DOCTOR/FRONT_DESK");

async function invoicePayload(clinicId, patientId, number, total) {
  return {
    clinic_id: clinicId,
    patient_id: patientId,
    invoice_number: number,
    invoice_date: new Date().toISOString().slice(0, 10),
    status: "ISSUED",
    subtotal: total,
    total_amount: total,
    balance_amount: total,
  };
}

const { data: deskInvoice, error: deskInvoiceErr } = await asFrontDeskA
  .from("invoices")
  .insert(await invoicePayload(clinicA, patientA, "INV-9001", 500))
  .select("id")
  .single();
check("FRONT_DESK can raise an invoice", Boolean(deskInvoice), deskInvoiceErr?.code ?? "");

const { data: doctorInvoice, error: doctorInvoiceErr } = await asDoctorA
  .from("invoices")
  .insert(await invoicePayload(clinicA, patientA, "INV-9002", 800))
  .select("id")
  .single();
check("DOCTOR can raise an invoice", Boolean(doctorInvoice), doctorInvoiceErr?.code ?? "");

const { error: adminInvoice } = await asAdminA
  .from("invoices")
  .insert(await invoicePayload(clinicA, patientA, "INV-9003", 100));
check(
  "ADMIN cannot raise an invoice (separation of duties)",
  adminInvoice?.code === "42501",
  adminInvoice?.code ?? "none",
);

const { data: adminReadsInvoices } = await asAdminA.from("invoices").select("id");
check("ADMIN can still read invoices", (adminReadsInvoices?.length ?? 0) > 0);

const { data: optomInvoices } = await asOptometristA.from("invoices").select("id");
check("OPTOMETRIST reads no invoices", (optomInvoices?.length ?? 0) === 0);

const { error: deskPayment } = await asFrontDeskA.from("payments").insert({
  clinic_id: clinicA,
  invoice_id: deskInvoice.id,
  payment_date: new Date().toISOString().slice(0, 10),
  amount: 200,
  method: "CASH",
});
check("FRONT_DESK can take a payment", !deskPayment, deskPayment?.code ?? "");

const { error: adminPayment } = await asAdminA.from("payments").insert({
  clinic_id: clinicA,
  invoice_id: deskInvoice.id,
  payment_date: new Date().toISOString().slice(0, 10),
  amount: 50,
  method: "CASH",
});
check("ADMIN cannot take a payment", adminPayment?.code === "42501", adminPayment?.code ?? "none");

// Money received is a historical fact: there is no UPDATE policy, so an attempt
// silently matches nothing rather than rewriting the ledger.
const { data: alteredPayment } = await asFrontDeskA
  .from("payments")
  .update({ amount: 9999 })
  .eq("invoice_id", deskInvoice.id)
  .select("id");
check("Payments cannot be altered after the fact", (alteredPayment?.length ?? 0) === 0);

// ---------------------------------------------------------------------------
section("Phase 4 — cross-clinic billing isolation");

const { data: bSeesInvoices } = await asDoctorB.from("invoices").select("id").eq("clinic_id", clinicA);
check("DOCTOR B reads no clinic A invoices", (bSeesInvoices?.length ?? 0) === 0);

const { error: bWritesInvoice } = await asDoctorB
  .from("invoices")
  .insert(await invoicePayload(clinicA, patientA, "INV-9099", 100));
check(
  "DOCTOR B cannot raise an invoice in clinic A",
  Boolean(bWritesInvoice),
  bWritesInvoice?.code ?? "none",
);

const { data: bSeesPayments } = await asDoctorB.from("payments").select("id").eq("clinic_id", clinicA);
check("DOCTOR B reads no clinic A payments", (bSeesPayments?.length ?? 0) === 0);

const { data: bSeesServices } = await asDoctorB
  .from("billing_services")
  .select("id")
  .eq("clinic_id", clinicA);
check("DOCTOR B reads no clinic A services", (bSeesServices?.length ?? 0) === 0);

// ---------------------------------------------------------------------------
section("Phase 4 — billing integrity rules");

// A discount must always carry a written justification. This is the rule that
// makes a 100%-waived "family visit" auditable rather than unexplained.
const { error: silentDiscount } = await asFrontDeskA.from("invoices").insert({
  ...(await invoicePayload(clinicA, patientA, "INV-9004", 0)),
  discount_amount: 500,
});
check(
  "Discount without a reason rejected",
  silentDiscount?.code === "23514",
  silentDiscount?.code ?? "none",
);

const { error: explainedDiscount } = await asFrontDeskA.from("invoices").insert({
  ...(await invoicePayload(clinicA, patientA, "INV-9005", 0)),
  discount_amount: 500,
  discount_reason: "Family visit — waived",
});
check("Discount with a reason accepted", !explainedDiscount, explainedDiscount?.code ?? "");

const { error: negativePayment } = await asFrontDeskA.from("payments").insert({
  clinic_id: clinicA,
  invoice_id: deskInvoice.id,
  payment_date: new Date().toISOString().slice(0, 10),
  amount: -100,
  method: "CASH",
});
check(
  "Negative payment rejected",
  negativePayment?.code === "23514",
  negativePayment?.code ?? "none",
);

const { error: duplicateNumber } = await asFrontDeskA
  .from("invoices")
  .insert(await invoicePayload(clinicA, patientA, "INV-9001", 500));
check(
  "Duplicate invoice number rejected within a clinic",
  duplicateNumber?.code === "23505",
  duplicateNumber?.code ?? "none",
);

// The same number in another clinic must be fine — invoice numbers are
// clinic-scoped, exactly like patient numbers.
const { error: sameNumberElsewhere } = await asDoctorB
  .from("invoices")
  .insert(await invoicePayload(clinicB, patientB, "INV-9001", 500));
check("Same invoice number allowed in another clinic", !sameNumberElsewhere, sameNumberElsewhere?.code ?? "");

// The snapshot property, repeated for billing: renaming a service must not
// rewrite what a past invoice says the patient was charged for.
await asFrontDeskA.from("invoice_items").insert({
  clinic_id: clinicA,
  invoice_id: deskInvoice.id,
  service_id: createdService.id,
  description: "Probe Consultation",
  quantity: 1,
  unit_price: 500,
  amount: 500,
});

await asAdminA
  .from("billing_services")
  .update({ name: "Renamed Consultation" })
  .eq("id", createdService.id);

const { data: snapshotItem } = await asFrontDeskA
  .from("invoice_items")
  .select("description, service_id")
  .eq("invoice_id", deskInvoice.id)
  .maybeSingle();
check(
  "Invoice line keeps the service name it was billed under",
  snapshotItem?.description === "Probe Consultation",
  snapshotItem?.description ?? "missing",
);
check(
  "Invoice line still links back to the service for reporting",
  snapshotItem?.service_id === createdService.id,
);

// A visit whose first bill was cancelled gets a second one. Both rows coexist,
// so anything reading "the invoice for this consultation" must ask for the
// latest rather than assume a single row.
const { data: consultForBilling } = await asDoctorA
  .from("consultations")
  .select("id")
  .eq("clinic_id", clinicA)
  .limit(1)
  .maybeSingle();

if (consultForBilling) {
  await asDoctorA.from("invoices").insert({
    ...(await invoicePayload(clinicA, patientA, "INV-9010", 300)),
    consultation_id: consultForBilling.id,
    status: "CANCELLED",
  });
  const { error: reInvoice } = await asDoctorA.from("invoices").insert({
    ...(await invoicePayload(clinicA, patientA, "INV-9011", 300)),
    consultation_id: consultForBilling.id,
  });
  check("A cancelled visit can be re-invoiced", !reInvoice, reInvoice?.code ?? "");

  const { data: latest } = await asDoctorA
    .from("invoices")
    .select("invoice_number")
    .eq("consultation_id", consultForBilling.id)
    .order("created_at", { ascending: false })
    .limit(1);
  check(
    "The live bill for a visit is the latest one",
    latest?.[0]?.invoice_number === "INV-9011",
    latest?.[0]?.invoice_number ?? "none",
  );
}

// ---------------------------------------------------------------------------
section("Consultation reference — invoices are traceable to a visit");

const { data: refConsult } = await asDoctorA
  .from("consultations")
  .insert({
    clinic_id: clinicA,
    consultation_number: "C-9500",
    patient_id: patientA,
    doctor_id: doctorA.id,
    consultation_date: "2030-02-01",
  })
  .select("id, consultation_number")
  .single();
check("Consultation carries a clinic-facing reference", refConsult?.consultation_number === "C-9500");

const { error: missingRef } = await asDoctorA.from("consultations").insert({
  clinic_id: clinicA,
  patient_id: patientA,
  doctor_id: doctorA.id,
  consultation_date: "2030-02-02",
});
check(
  "A consultation cannot exist without a reference",
  missingRef?.code === "23502",
  missingRef?.code ?? "none",
);

const { error: dupeRef } = await asDoctorA.from("consultations").insert({
  clinic_id: clinicA,
  consultation_number: "C-9500",
  patient_id: patientA,
  doctor_id: doctorA.id,
  consultation_date: "2030-02-03",
});
check(
  "Duplicate reference rejected within a clinic",
  dupeRef?.code === "23505",
  dupeRef?.code ?? "none",
);

// Clinic-scoped like patient and invoice numbers: two clinics may both hold one.
const { error: refElsewhere } = await asDoctorB.from("consultations").insert({
  clinic_id: clinicB,
  consultation_number: "C-9500",
  patient_id: patientB,
  doctor_id: doctorB.id,
  consultation_date: "2030-02-01",
});
check("Same reference allowed in another clinic", !refElsewhere, refElsewhere?.code ?? "");

// The join the billing list and the printed invoice both rely on.
await asDoctorA.from("invoices").insert({
  ...(await invoicePayload(clinicA, patientA, "INV-9020", 400)),
  consultation_id: refConsult.id,
});

const { data: tracedInvoice } = await asFrontDeskA
  .from("invoices")
  .select("invoice_number, consultations(consultation_number)")
  .eq("invoice_number", "INV-9020")
  .maybeSingle();
check(
  "An invoice resolves back to its consultation reference",
  tracedInvoice?.consultations?.consultation_number === "C-9500",
  tracedInvoice?.consultations?.consultation_number ?? "missing",
);

const { data: bTraced } = await asDoctorB
  .from("invoices")
  .select("id, consultations(consultation_number)")
  .eq("invoice_number", "INV-9020");
check("Clinic B cannot traverse to clinic A's consultation", (bTraced?.length ?? 0) === 0);

// Deactivating a service must not remove it from history.
await asAdminA.from("billing_services").update({ is_active: false }).eq("id", createdService.id);
const { data: afterDeactivation } = await asFrontDeskA
  .from("invoice_items")
  .select("description")
  .eq("invoice_id", deskInvoice.id);
check(
  "Deactivated service stays on the historical invoice",
  (afterDeactivation?.length ?? 0) === 1,
);

// ---------------------------------------------------------------------------
section("Phase 4 — notification log");

await admin.from("notifications").insert({
  clinic_id: clinicA,
  recipient_email: "probe@isolation-test.local",
  notification_type: "APPOINTMENT_CREATED",
  channel: "EMAIL",
  subject: "Probe",
  body: "Probe body",
  delivery_status: "SKIPPED",
});

const { data: adminNotifications } = await asAdminA.from("notifications").select("id");
check("ADMIN can read the notification log", (adminNotifications?.length ?? 0) > 0);

const { data: doctorNotifications } = await asDoctorA.from("notifications").select("id");
check("DOCTOR reads no notifications", (doctorNotifications?.length ?? 0) === 0);

const { data: deskNotifications } = await asFrontDeskA.from("notifications").select("id");
check("FRONT_DESK reads no notifications", (deskNotifications?.length ?? 0) === 0);

// No INSERT policy exists at all: delivery records are written only by the
// server-side service, so no signed-in user can forge one.
const { error: forgedNotification } = await asAdminA.from("notifications").insert({
  clinic_id: clinicA,
  notification_type: "OTHER",
  channel: "EMAIL",
  body: "Forged",
});
check(
  "Nobody can forge a delivery record",
  forgedNotification?.code === "42501",
  forgedNotification?.code ?? "none",
);

const { data: bNotifications } = await asDoctorB.from("notifications").select("id");
check("Clinic B sees none of clinic A's notifications", (bNotifications?.length ?? 0) === 0);
}

if (phase4Ready) {
  await runPhase4DatabaseTests();
} else {
  section("Phase 4 — SKIPPED");
  console.log("  Billing tables are absent. Apply supabase/migrations/0006_phase4_billing_notifications.sql");
  console.log("  (Supabase Dashboard → SQL Editor → paste → Run), then re-run this suite.");
  fail += 1;
}

// ---------------------------------------------------------------------------
// Arithmetic needs no database, so it runs whether or not 0006 is applied.
section("Phase 4 — invoice arithmetic");

// These numbers are what a patient actually pays, so they are asserted directly
// against the pure function the server uses rather than only through the UI.
const { billingBlockerFor, computeInvoiceTotals, settlesConsultation, statusAfterPayment } =
  await import("../src/types/billing.ts");

const simple = computeInvoiceTotals([{ quantity: 2, unitPrice: 250 }], 0, 0, 0);
check(
  "Two lines at 250 total 500",
  simple.subtotal === 500 && simple.totalAmount === 500 && simple.balanceAmount === 500,
  JSON.stringify(simple),
);

const taxed = computeInvoiceTotals([{ quantity: 1, unitPrice: 1000 }], 180, 200, 500);
check(
  "Tax and discount applied, balance net of payment",
  taxed.totalAmount === 980 && taxed.balanceAmount === 480,
  JSON.stringify(taxed),
);

// Float arithmetic must not leave a residue that stops an invoice reaching PAID.
const fiddly = computeInvoiceTotals([{ quantity: 3, unitPrice: 0.1 }], 0, 0, 0.3);
check("Rounding leaves no residual balance", fiddly.balanceAmount === 0, JSON.stringify(fiddly));

const overDiscounted = computeInvoiceTotals([{ quantity: 1, unitPrice: 500 }], 0, 900, 0);
check("Discount beyond the bill floors the total at zero", overDiscounted.totalAmount === 0);

check("Full settlement marks PAID", statusAfterPayment(500, 500) === "PAID");
check("Short settlement marks PARTIALLY_PAID", statusAfterPayment(500, 200) === "PARTIALLY_PAID");

check(
  "A part-paid invoice lets the visit close",
  settlesConsultation({ status: "PARTIALLY_PAID", total_amount: 500, paid_amount: 200 }),
);
check(
  "A fully waived invoice closes without any payment",
  settlesConsultation({ status: "ISSUED", total_amount: 0, paid_amount: 0 }),
);
check(
  "An issued but unpaid invoice does not close the visit",
  !settlesConsultation({ status: "ISSUED", total_amount: 500, paid_amount: 0 }),
);
check(
  "A draft invoice never closes the visit",
  !settlesConsultation({ status: "DRAFT", total_amount: 500, paid_amount: 500 }),
);

// ---------------------------------------------------------------------------
section("The gate on completing a visit");

// The gate now runs when the APPOINTMENT is completed, not the consultation:
// completing the consultation is what reveals the billing button, so gating
// that would leave the bill impossible to raise. These assert the decision the
// appointment action defers to.
check(
  "No invoice at all blocks the visit",
  billingBlockerFor(null)?.startsWith("Raise the invoice") === true,
  billingBlockerFor(null) ?? "null",
);
check(
  "A draft invoice blocks the visit",
  billingBlockerFor({ status: "DRAFT", total_amount: 500, paid_amount: 0 })?.includes("draft") ===
    true,
);
check(
  "An issued but unpaid invoice blocks the visit",
  billingBlockerFor({ status: "ISSUED", total_amount: 500, paid_amount: 0 })?.includes("mode") ===
    true,
);
check(
  "A cancelled invoice blocks the visit and asks for a new one",
  billingBlockerFor({ status: "CANCELLED", total_amount: 500, paid_amount: 0 })?.includes(
    "Raise a new one",
  ) === true,
);
check(
  "A part-paid invoice releases the visit",
  billingBlockerFor({ status: "PARTIALLY_PAID", total_amount: 500, paid_amount: 200 }) === null,
);
check(
  "A fully waived invoice releases the visit with no payment",
  billingBlockerFor({ status: "ISSUED", total_amount: 0, paid_amount: 0 }) === null,
);
check(
  "A fully paid invoice releases the visit",
  billingBlockerFor({ status: "PAID", total_amount: 500, paid_amount: 500 }) === null,
);

// ---------------------------------------------------------------------------
section("Clinic deactivation suspends the whole clinic");

// Baseline: clinic A is active and its staff can work.
const { data: beforePatients } = await asFrontDeskA.from("patients").select("id");
check("Before: FRONT_DESK reads patients", (beforePatients?.length ?? 0) > 0);

await admin.from("clinics").update({ is_active: false }).eq("id", clinicA);

// Existing sessions must lose access too, not just future sign-ins.
const { data: afterPatients } = await asFrontDeskA.from("patients").select("id");
check(
  "After: existing session reads no patients",
  (afterPatients?.length ?? 0) === 0,
  `${afterPatients?.length ?? 0} row(s)`,
);

const { error: afterWrite } = await asFrontDeskA.from("patients").insert({
  clinic_id: clinicA,
  patient_number: `S-${randomBytes(3).toString("hex")}`,
  first_name: "Suspended",
  last_name: "Write",
});
check("After: writes rejected", Boolean(afterWrite), afterWrite?.code ?? "none");

const { data: afterConsults } = await asDoctorA.from("consultations").select("id");
check("After: DOCTOR reads no consultations", (afterConsults?.length ?? 0) === 0);

// Phase 4 tables inherit suspension for free: every policy resolves tenancy
// through get_user_clinic_id(), which returns NULL for a suspended clinic.
const { data: afterInvoices } = await asFrontDeskA.from("invoices").select("id");
check("After: FRONT_DESK reads no invoices", (afterInvoices?.length ?? 0) === 0);

const { data: afterNotifications } = await asAdminA.from("notifications").select("id");
check("After: ADMIN reads no notification log", (afterNotifications?.length ?? 0) === 0);

// A suspended ADMIN still resolves their OWN profile row: profiles_select
// grants `id = auth.uid()` first, deliberately, or session bootstrap could
// never load anyone — including SUPER_ADMIN, whose clinic_id is NULL. What must
// be gone is everyone else's.
const { data: adminSeesOthers } = await asAdminA
  .from("profiles")
  .select("id")
  .neq("id", adminA.id);
check(
  "After: clinic's own ADMIN cannot see other users",
  (adminSeesOthers?.length ?? 0) === 0,
  `${adminSeesOthers?.length ?? 0} row(s)`,
);

const { data: adminSeesPatients } = await asAdminA.from("patients").select("id");
check("After: clinic's own ADMIN reads no patients", (adminSeesPatients?.length ?? 0) === 0);

const { data: adminFlag } = await asAdminA.rpc("current_user_clinic_is_active");
check("After: clinic's own ADMIN is refused by the app layer", adminFlag === false);

// A fresh sign-in must be refused by the application layer.
const freshClient = createClient(URL, ANON, {
  auth: { autoRefreshToken: false, persistSession: false },
});
await freshClient.auth.signInWithPassword({ email: frontDeskA.email, password: frontDeskA.password });
const { data: freshFlag } = await freshClient.rpc("current_user_clinic_is_active");
check("After: clinic-active check reports false on fresh sign-in", freshFlag === false, String(freshFlag));

// SUPER_ADMIN must remain able to undo this, or deactivation is irreversible.
const { data: superSees } = await admin.from("clinics").select("id, is_active").eq("id", clinicA).maybeSingle();
check("After: clinic still visible to platform level", superSees?.is_active === false);

await admin.from("clinics").update({ is_active: true }).eq("id", clinicA);

const { data: reactivated } = await asFrontDeskA.from("patients").select("id");
check(
  "Reactivation restores access immediately",
  (reactivated?.length ?? 0) > 0,
  `${reactivated?.length ?? 0} row(s)`,
);

// Individually deactivated users must NOT be silently switched back on.
await admin.from("profiles").update({ is_active: false }).eq("id", doctorA2.id);
await admin.from("clinics").update({ is_active: false }).eq("id", clinicA);
await admin.from("clinics").update({ is_active: true }).eq("id", clinicA);
const { data: stillOff } = await admin
  .from("profiles")
  .select("is_active")
  .eq("id", doctorA2.id)
  .maybeSingle();
check("Reactivation does not revive individually disabled users", stillOff?.is_active === false);

// ---------------------------------------------------------------------------
console.log("\ncleaning up…");
for (const id of created.clinics) await admin.from("clinics").delete().eq("id", id);
for (const id of created.users) await admin.auth.admin.deleteUser(id);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
