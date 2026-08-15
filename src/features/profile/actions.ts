"use server";

import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface PasswordFormState {
  error: string | null;
  success: boolean;
}

const MIN_PASSWORD_LENGTH = 8;

/**
 * Changes the signed-in user's own password.
 *
 * Supabase's updateUser() does NOT require the current password, so on its own
 * it would let anyone holding a hijacked session silently take over the
 * account. Re-authenticating with signInWithPassword first proves the caller
 * actually knows the existing password — that verification is the whole point
 * of this flow.
 */
export async function changePassword(
  _prevState: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const profile = await requireProfile();

  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!currentPassword || !newPassword) {
    return { error: "Fill in every field.", success: false };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`, success: false };
  }
  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation do not match.", success: false };
  }
  if (newPassword === currentPassword) {
    return { error: "New password must differ from the current one.", success: false };
  }

  const supabase = await createClient();

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: currentPassword,
  });

  if (reauthError) {
    return { error: "Current password is incorrect.", success: false };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

  if (updateError) {
    return { error: `Could not update password: ${updateError.message}`, success: false };
  }

  return { error: null, success: true };
}
