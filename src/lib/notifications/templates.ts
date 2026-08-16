import { formatMoney, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/types/billing";
import type { NotificationType } from "@/types/notification";

/**
 * The event being announced, as a discriminated union.
 *
 * Explicit variants mean a caller cannot raise APPOINTMENT_CREATED without
 * supplying the doctor and the time — the mistake a loose bag of template
 * variables invites.
 *
 * Who the message is about is deliberately absent: the patient's name and the
 * clinic's name are resolved once, server-side, by the dispatcher.
 */
export type NotificationEvent =
  | {
      type: "APPOINTMENT_CREATED" | "APPOINTMENT_RESCHEDULED" | "APPOINTMENT_REMINDER";
      doctorName: string;
      date: string;
      time: string;
    }
  | { type: "APPOINTMENT_CANCELLED"; doctorName: string; date: string; time: string }
  | { type: "CONSULTATION_COMPLETED"; doctorName: string; followUpDate: string | null }
  | {
      type: "INVOICE_CREATED";
      invoiceNumber: string;
      totalAmount: number;
      balanceAmount: number;
    }
  | {
      type: "PAYMENT_RECEIVED";
      invoiceNumber: string;
      amount: number;
      method: PaymentMethod;
      balanceAmount: number;
    };

export interface NotificationContext {
  patientName: string;
  clinicName: string;
}

export interface RenderedNotification {
  type: NotificationType;
  subject: string;
  body: string;
}

/** Plain text on purpose — the same body serves both email and WhatsApp. */
export function renderNotification(
  event: NotificationEvent,
  context: NotificationContext,
): RenderedNotification {
  const greeting = `Hello ${context.patientName},`;

  switch (event.type) {
    case "APPOINTMENT_CREATED":
      return {
        type: event.type,
        subject: `Appointment confirmed — ${event.date}`,
        body: [
          greeting,
          "",
          `Your appointment with ${event.doctorName} is confirmed.`,
          "",
          `Date: ${event.date}`,
          `Time: ${event.time}`,
          "",
          context.clinicName,
        ].join("\n"),
      };

    case "APPOINTMENT_RESCHEDULED":
      return {
        type: event.type,
        subject: `Appointment moved to ${event.date}`,
        body: [
          greeting,
          "",
          `Your appointment with ${event.doctorName} has been rescheduled.`,
          "",
          `New date: ${event.date}`,
          `New time: ${event.time}`,
          "",
          context.clinicName,
        ].join("\n"),
      };

    case "APPOINTMENT_REMINDER":
      return {
        type: event.type,
        subject: `Reminder — appointment on ${event.date}`,
        body: [
          greeting,
          "",
          `This is a reminder of your appointment with ${event.doctorName}.`,
          "",
          `Date: ${event.date}`,
          `Time: ${event.time}`,
          "",
          context.clinicName,
        ].join("\n"),
      };

    case "APPOINTMENT_CANCELLED":
      return {
        type: event.type,
        subject: `Appointment cancelled — ${event.date}`,
        body: [
          greeting,
          "",
          `Your appointment with ${event.doctorName} on ${event.date} at ${event.time} has been cancelled.`,
          "",
          "Please contact us to rebook.",
          "",
          context.clinicName,
        ].join("\n"),
      };

    case "CONSULTATION_COMPLETED":
      return {
        type: event.type,
        subject: "Your consultation summary",
        body: [
          greeting,
          "",
          `Your consultation with ${event.doctorName} is complete.`,
          ...(event.followUpDate ? ["", `Follow-up date: ${event.followUpDate}`] : []),
          "",
          context.clinicName,
        ].join("\n"),
      };

    case "INVOICE_CREATED":
      return {
        type: event.type,
        subject: `Invoice ${event.invoiceNumber}`,
        body: [
          greeting,
          "",
          `Invoice ${event.invoiceNumber} has been issued.`,
          "",
          `Total: ${formatMoney(event.totalAmount)}`,
          `Balance due: ${formatMoney(event.balanceAmount)}`,
          "",
          context.clinicName,
        ].join("\n"),
      };

    case "PAYMENT_RECEIVED":
      return {
        type: event.type,
        subject: `Payment received — ${event.invoiceNumber}`,
        body: [
          greeting,
          "",
          `We have received ${formatMoney(event.amount)} by ${PAYMENT_METHOD_LABELS[event.method]} against invoice ${event.invoiceNumber}.`,
          "",
          `Balance due: ${formatMoney(event.balanceAmount)}`,
          "",
          context.clinicName,
        ].join("\n"),
      };
  }
}
