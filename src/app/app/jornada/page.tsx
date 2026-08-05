import { JourneyGrid } from "@/components/journey-grid";
import { getJourneyData } from "@/lib/app-data";

export default async function JourneyPage() {
  const data = await getJourneyData();
  if (!data.challenge) return <section className="card p-8 text-center"><h1 className="font-display text-2xl font-black">Nenhum desafio ativo</h1><p className="mt-2 text-[var(--muted)]">Conclua o onboarding para criar sua jornada.</p></section>;
  return <><section><p className="eyebrow">MAPA DA JORNADA</p><h1 className="font-display mt-2 text-3xl font-black tracking-[-.04em] md:text-4xl">{data.challenge.total_days} dias. Uma história sua.</h1><p className="mt-2 text-[var(--muted)]">Cada check-in persistido ocupa exatamente um dia.</p></section><JourneyGrid challenge={data.challenge} checkins={data.checkins} sessions={data.sessions} today={data.checkinStatus.checkin_date} streak={data.stats.streak} timezone={data.profile.timezone} /></>;
}
