import { SessionsList } from "@/components/sessions-list";
import { getSessionsData } from "@/lib/app-data";

export default async function SessionsPage() {
  const data = await getSessionsData();
  return <><section><p className="eyebrow">HISTÓRICO</p><h1 className="font-display mt-2 text-3xl font-black tracking-[-.04em] md:text-4xl">Suas sessões de estudo</h1><p className="mt-2 text-[var(--muted)]">Registros persistidos na sua conta, em qualquer dispositivo.</p></section><SessionsList sessions={data.sessions} timezone={data.profile.timezone} /></>;
}
