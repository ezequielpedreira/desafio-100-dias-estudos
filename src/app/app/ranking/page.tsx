import { RankingBoard } from "@/components/ranking-board";
import { getRankingData } from "@/lib/app-data";

export default async function RankingPage() {
  const data = await getRankingData();
  return <><section className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="eyebrow">PLACAR DA COMUNIDADE</p><h1 className="font-display mt-2 text-3xl font-black tracking-[-.04em] md:text-4xl">Ranking de consistência</h1><p className="mt-2 text-[var(--muted)]">Apenas perfis que escolheram participar aparecem aqui.</p></div><span className="chip w-fit bg-[#e1f7ed] text-[#18734f]">Privacidade respeitada</span></section><RankingBoard entries={data.ranking} currentUserId={data.user.id} /></>;
}
