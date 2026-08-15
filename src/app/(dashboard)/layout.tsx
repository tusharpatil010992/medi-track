import { AppShell } from "@/components/layout/AppShell";
import { NAVIGATION } from "@/config/navigation";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth boundary for every dashboard route.
 *
 * requireProfile() redirects signed-out or deactivated users. Individual pages
 * still assert their own role — this layout only proves *a* valid session.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  let clinicName = "Platform Administration";

  if (profile.clinic_id) {
    const supabase = await createClient();
    const { data: clinic } = await supabase
      .from("clinics")
      .select("name")
      .eq("id", profile.clinic_id)
      .single<{ name: string }>();

    clinicName = clinic?.name ?? "Clinic";
  }

  return (
    <AppShell profile={profile} clinicName={clinicName} navItems={NAVIGATION[profile.role]}>
      {children}
    </AppShell>
  );
}
