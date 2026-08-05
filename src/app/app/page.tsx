import Link from "next/link";
import { ArrowRight, BookOpen, Clock3, Flame, Medal, Target, Trophy, Zap } from "lucide-react";
import { StudyConsole } from "@/components/study-console";
import { getDashboardData } from "@/lib/app-data";
import { getLevel } from "@/lib/game";
import { formatDuration, initials } from "@/lib/utils";

function dateDiff(start: string, end: string) {
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const firstName = (data.profile.display_name || data.profile.full_name || "Participante").split(" ")[0];
  const day = data.challenge ? Math.min(data.challenge.total_days, Math.max(1, dateDiff(data.challenge.start_date, data.checkinStatus.checkin_date) + 1)) : 1;
  const totalDays = data.challenge?.total_days ?? 100;
  const level = getLevel(data.stats.totalXp);
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: data.profile.timezone }).format(new Date(data.checkinStatus.server_time)));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const goalSeconds = data.profile.daily_goal_minutes * 60;
  const goalProgress = Math.min(100, Math.round((data.stats.todaySeconds / goalSeconds) * 100));
  const ranking = data.ranking.slice(0, 4);

  return (
    <>
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><p className="eyebrow">DIA {day} · NÍVEL {level.level}</p><h1 className="font-display mt-2 text-3xl font-black tracking-[-.04em] md:text-4xl">{greeting}, {firstName}! <span aria-hidden="true">👋</span></h1><p className="mt-1 text-[var(--muted)]">Pronto para avançar mais um nível?</p></div>
        <Link href="/app/jornada" className="btn-secondary">Ver jornada <ArrowRight size={17} /></Link>
      </section>

      <ChallengeCard day={day} totalDays={totalDays} completedDays={data.stats.completedDays} />

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<Flame />} label="Sequência atual" value={`${data.stats.streak} ${data.stats.streak === 1 ? "dia" : "dias"}`} hint={`${data.stats.completedDays} check-ins concluídos`} color="#ff7448" background="#fff0ea" />
        <Stat icon={<Clock3 />} label="Tempo total" value={formatDuration(data.stats.totalSeconds)} hint={`Hoje: ${formatDuration(data.stats.todaySeconds)}`} color="#268c68" background="#e1f7ed" />
        <Stat icon={<Zap />} label="XP acumulado" value={data.stats.totalXp.toLocaleString("pt-BR")} hint={level.next ? `${level.next.minXp - data.stats.totalXp} para o nível ${level.next.level}` : "Nível máximo alcançado"} color="#9b6200" background="#fff4d3" />
        <Stat icon={<Trophy />} label="Posição geral" value={data.stats.rank ? `#${data.stats.rank}` : "—"} hint="Ranking da comunidade" color="#5b3ee4" background="#eeeaff" />
      </section>

      <section className="mt-7 grid gap-6 xl:grid-cols-[1fr_340px]">
        <StudyConsole initialStatus={data.checkinStatus} dailyGoalMinutes={data.profile.daily_goal_minutes} />
        <article className="card p-5">
          <div className="flex items-center justify-between"><p className="eyebrow">MISSÃO DO DIA</p><Target size={20} className="text-[#6c4cff]" /></div>
          <h2 className="font-display mt-3 text-xl font-black">Complete {data.profile.daily_goal_minutes} minutos</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Hoje: <strong className="text-[var(--ink)]">{formatDuration(data.stats.todaySeconds)}</strong></p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#eeeaff]"><div className="h-full bg-[#27ae76]" style={{ width: `${goalProgress}%` }} /></div>
          <p className="mt-3 text-xs font-bold text-[var(--muted)]">{goalProgress}% da meta diária</p>
        </article>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <Weekly progress={data.progress} today={data.checkinStatus.checkin_date} />
        <article className="card p-5">
          <div className="flex items-center justify-between"><div><p className="eyebrow">RANKING</p><h2 className="font-display mt-2 text-xl font-black">Quem está no foco</h2></div><Trophy className="text-[#d49400]" /></div>
          <div className="mt-5 space-y-3">{ranking.length ? ranking.map((entry) => <div key={entry.user_id} className="flex items-center gap-3"><RankingPosition position={entry.rank_position} /><span className={`avatar ${entry.avatar_url ? "avatar-photo" : ""}`} style={entry.avatar_url ? { backgroundImage: `url(${entry.avatar_url})` } : undefined}>{entry.avatar_url ? <span className="sr-only">Foto de {entry.display_name}</span> : initials(entry.display_name)}</span><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{entry.display_name}</strong><span className="text-[11px] text-[var(--muted)]">{entry.completed_days} check-ins</span></div><strong className="text-sm">{entry.total_xp} XP</strong></div>) : <p className="text-sm text-[var(--muted)]">Ainda não há participantes visíveis.</p>}</div>
          <Link href="/app/ranking" className="mt-5 flex items-center justify-center gap-2 text-sm font-extrabold text-[#6c4cff]">Ver ranking completo <ArrowRight size={16} /></Link>
        </article>
      </section>
    </>
  );
}

function RankingPosition({ position }: { position: number }) {
  const medals = {
    1: { label: "ouro", className: "bg-[#fff4d3] text-[#b77900]" },
    2: { label: "prata", className: "bg-[#eef1f5] text-[#697386]" },
    3: { label: "bronze", className: "bg-[#f9e5d5] text-[#a95723]" },
  } as const;
  const medal = medals[position as keyof typeof medals];

  if (medal) {
    return <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${medal.className}`} title={`Medalha de ${medal.label}`}><Medal size={19} fill="currentColor" aria-hidden="true" /><span className="sr-only">{position}º lugar, medalha de {medal.label}</span></span>;
  }

  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eeeaff] text-xs font-black text-[#5b3ee4]">{position}</span>;
}

function ChallengeCard({ day, totalDays, completedDays }: { day: number; totalDays: number; completedDays: number }) {
  const progress = Math.min(100, Math.round((completedDays / totalDays) * 100));
  const racerPosition = `calc(${progress}% - ${progress * 0.5}px)`;
  return <section className="game-card card mt-7 border-0 bg-[#31294e] p-6 text-white shadow-[0_7px_0_#1e1b35] md:p-7"><div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row"><div><p className="text-xs font-black uppercase tracking-[.12em] text-[#bdb5dd]">Desafio em andamento</p><h2 className="font-display mt-2 text-4xl font-black">Dia {day} <span className="text-xl text-[#bdb5dd]">de {totalDays}</span></h2><p className="mt-2 text-[#d6d0e8]">Você já concluiu {progress}% da jornada. Continue acelerando!</p></div><div className="flex gap-3"><div className="rounded-2xl bg-white/10 px-4 py-3"><span className="text-xs text-[#cfc9e8]">Concluídos</span><strong className="font-display block text-2xl">{completedDays}</strong></div><div className="rounded-2xl bg-white/10 px-4 py-3"><span className="text-xs text-[#cfc9e8]">Restantes</span><strong className="font-display block text-2xl">{Math.max(0, totalDays - completedDays)}</strong></div></div></div><div className="relative z-10 mt-6"><div className="mb-3 flex justify-between text-xs font-bold"><span>Corrida da jornada</span><span>{progress}%</span></div><div className="relative pb-2 pt-8" role="progressbar" aria-label="Progresso da jornada" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="journey-track relative h-3 overflow-hidden rounded-full"><div className="journey-progress-fill h-full rounded-full" style={{ width: `${progress}%` }} /></div><span className="journey-racer absolute top-0" style={{ left: racerPosition }} aria-hidden="true"><LegoRaceCar /></span><span className="lego-finish absolute -right-1 -top-2" title="Linha de chegada" aria-hidden="true"><LegoFinishFlag /></span></div><div className="mt-1 flex justify-between text-[10px] font-bold text-[#aaa4bd]"><span>DIA 1</span><span>DIA 25</span><span>DIA 50</span><span>DIA 75</span><span>DIA {totalDays}</span></div></div></section>;
}

function LegoRaceCar() {
  return <span className="lego-car lego-f1-car"><span className="lego-f1-rear-wing" /><span className="lego-f1-engine-cover"><span className="lego-f1-number">1</span></span><span className="lego-f1-cockpit"><span className="lego-f1-driver" /></span><span className="lego-f1-body" /><span className="lego-f1-nose" /><span className="lego-f1-front-wing" /><span className="lego-wheel lego-wheel-left"><span /></span><span className="lego-wheel lego-wheel-right"><span /></span></span>;
}

function LegoFinishFlag() {
  return <span className="lego-flag-set"><span className="lego-checkered-flag">{Array.from({ length: 12 }, (_, index) => <span key={index} />)}</span><span className="lego-flag-pole" /><span className="lego-flag-base"><span /></span></span>;
}

function Stat({ icon, label, value, hint, color, background }: { icon: React.ReactNode; label: string; value: string; hint: string; color: string; background: string }) {
  return <article className="card p-4"><span className="grid h-9 w-9 place-items-center rounded-xl" style={{ color, background }}>{icon}</span><p className="mt-4 text-xs font-bold text-[var(--muted)]">{label}</p><strong className="font-display mt-1 block text-xl font-black">{value}</strong><span className="mt-1 block text-[11px] font-bold text-[var(--muted)]">{hint}</span></article>;
}

function Weekly({ progress, today }: { progress: { study_date: string; total_duration_seconds: number }[]; today: string }) {
  const base = new Date(`${today}T12:00:00Z`);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base); date.setUTCDate(base.getUTCDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const seconds = progress.find((item) => item.study_date === key)?.total_duration_seconds ?? 0;
    return { key, label: new Intl.DateTimeFormat("pt-BR", { weekday: "narrow", timeZone: "UTC" }).format(date), minutes: Math.floor(seconds / 60) };
  });
  const max = Math.max(1, ...days.map((item) => item.minutes));
  return <article className="card p-5 md:p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">ÚLTIMOS 7 DIAS</p><h2 className="font-display mt-2 text-xl font-black">Seu ritmo esta semana</h2></div><BookOpen className="text-[#6c4cff]" /></div><div className="mt-7 flex h-36 items-end justify-between gap-2">{days.map((item) => <div key={item.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] font-bold text-[var(--muted)]">{item.minutes ? `${item.minutes}m` : "—"}</span><div className="w-full max-w-10 rounded-t-lg bg-[#6c4cff]" style={{ height: `${Math.max(5, item.minutes / max * 100)}%` }} /><span className="text-xs font-black text-[var(--muted)]">{item.label}</span></div>)}</div></article>;
}
