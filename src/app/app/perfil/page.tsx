import { getBaseData } from "@/lib/app-data";
import { ProfileForm } from "@/components/profile-form";

export default async function ProfilePage() {
  const data = await getBaseData();
  return <><section><p className="eyebrow">CONFIGURAÇÕES</p><h1 className="font-display mt-2 text-3xl font-black tracking-[-.04em] md:text-4xl">Seu perfil</h1><p className="mt-2 text-[var(--muted)]">Alterações salvas aqui acompanham sua conta em qualquer dispositivo.</p></section><ProfileForm profile={data.profile} email={data.user.email} /></>;
}
