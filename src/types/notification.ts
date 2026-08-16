export type NotificationType =
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_RESCHEDULED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_REMINDER"
  | "CONSULTATION_COMPLETED"
  | "PRESCRIPTION_ISSUED"
  | "INVOICE_CREATED"
  | "PAYMENT_RECEIVED"
  | "OTHER";

export type NotificationChannel = "EMAIL" | "WHATSAPP" | "SMS";

/**
 * Delivery outcome recorded against every attempt.
 *
 * SKIPPED is not in the documented set (PENDING/SENT/FAILED) but is the honest
 * answer for the common case: the clinic has not replaced its placeholder
 * credentials yet, so nothing was ever sent. Recording that as FAILED would
 * fill the log with errors that are not errors, and hide the real ones.
 */
export type DeliveryStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

export interface NotificationLog {
  id: string;
  clinic_id: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  notification_type: NotificationType;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  /** Provider-side id, so a delivery dispute can be traced back to Resend or WhatsApp. */
  provider_message_id: string | null;
  sent_at: string;
  delivery_status: DeliveryStatus;
  error_message: string | null;
  created_at: string;
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  APPOINTMENT_CREATED: "Appointment booked",
  APPOINTMENT_RESCHEDULED: "Appointment rescheduled",
  APPOINTMENT_CANCELLED: "Appointment cancelled",
  APPOINTMENT_REMINDER: "Appointment reminder",
  CONSULTATION_COMPLETED: "Consultation completed",
  PRESCRIPTION_ISSUED: "Prescription issued",
  INVOICE_CREATED: "Invoice issued",
  PAYMENT_RECEIVED: "Payment received",
  OTHER: "Other",
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING: "Pending",
  SENT: "Sent",
  FAILED: "Failed",
  SKIPPED: "Not configured",
};
