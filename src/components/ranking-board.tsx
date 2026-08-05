"use client";

import { useMemo, useState } from "react";
import { Clock3, Flame, Trophy, Zap } from "lucide-react";
import type { RankingEntry } from "@/lib/app-data";
import { formatDuration, initials } from "@/lib/utils";

const filters = ["XP", "Tempo total", "Maior sequência", "Mais check-ins"] as const;
type Filter = (typeof filters)[number];

export function RankingBoard({ entries, currentUserId }: { entries: RankingEntry[]; currentUserId: string }) {
  const [filter, setFilter] = useState<Filter>("XP");
  const rows = useMemo(
    () =>
      [...entries].sort((a, b) => {
        if (filter === "Tempo total") return b.total_seconds - a.total_seconds;
        if (filter === "Maior sequência") return b.current_streak - a.current_streak;
        if (filter === "Mais check-ins") return b.completed_days - a.completed_days;
        return b.total_xp - a.total_xp;
      }),
    [entries, filter],
  );
  const rankedPodium = rows.slice(0, 3).map((entry, index) => ({ entry, position: index + 1 }));
  const podium = [rankedPodium[1], rankedPodium[0], rankedPodium[2]].filter(Boolean) as {
    entry: RankingEntry;
    position: number;
  }[];

  return (
    <>
      <div className="scrollbar-none mt-7 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Ordenar ranking">
        {filters.map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={filter === value ? "btn-primary whitespace-nowrap" : "btn-secondary whitespace-nowrap"}
            aria-pressed={filter === value}
          >
            {value}
          </button>
        ))}
      </div>

      {rows.length ? (
        <>
          <section className="mt-5 grid items-end gap-3 sm:grid-cols-3" aria-label="Pódio do ranking">
            {podium.map(({ entry, position }) => (
              <article
                key={entry.user_id}
                className={`card p-5 text-center ${position === 1 ? "sm:col-start-2 sm:row-start-1 sm:py-7" : position === 2 ? "sm:col-start-1 sm:row-start-1" : "sm:col-start-3 sm:row-start-1"}`}
              >
                <span className="ranking-medal mx-auto grid h-12 w-12 place-items-center rounded-2xl"><Trophy /></span>
                <span className="font-display mt-3 block text-sm font-black text-[var(--muted)]">{position}º lugar</span>
                <strong className="font-display mt-1 block text-lg">{entry.display_name}</strong>
                <span className="ranking-metric mt-2 block text-sm font-black">{metric(entry, filter)}</span>
              </article>
            ))}
          </section>

          <section className="card mt-6 overflow-hidden">
            <div className="grid grid-cols-[50px_1fr_auto] items-center gap-3 border-b border-[var(--line)] px-5 py-3 text-xs font-black uppercase text-[var(--muted)] md:grid-cols-[60px_1fr_110px_120px_110px]">
              <span>#</span><span>Participante</span><span className="hidden md:block">Sequência</span><span className="hidden md:block">Tempo</span><span>XP</span>
            </div>
            {rows.map((entry, index) => (
              <div key={entry.user_id} className={`grid grid-cols-[50px_1fr_auto] items-center gap-3 border-b border-[var(--line)] px-5 py-4 last:border-0 md:grid-cols-[60px_1fr_110px_120px_110px] ${entry.user_id === currentUserId ? "ranking-current-row" : ""}`}>
                <span className="font-display text-lg font-black text-[var(--muted)]">{index + 1}</span>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="avatar">{initials(entry.display_name)}</span>
                  <div className="min-w-0">
                    <strong className="block truncate">{entry.display_name}{entry.user_id === currentUserId && <span className="ml-2 rounded bg-[#6c4cff] px-1.5 py-0.5 text-[9px] text-white">VOCÊ</span>}</strong>
                    <span className="text-xs text-[var(--muted)]">Nível {entry.level} · {entry.completed_days} check-ins</span>
                  </div>
                </div>
                <span className="ranking-streak hidden items-center gap-1 font-bold md:flex"><Flame size={16} />{entry.current_streak} dias</span>
                <span className="ranking-time hidden items-center gap-1 font-bold md:flex"><Clock3 size={16} />{formatDuration(entry.total_seconds)}</span>
                <span className="ranking-metric flex items-center gap-1 font-black"><Zap size={15} fill="currentColor" />{entry.total_xp.toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </section>
        </>
      ) : (
        <section className="card mt-6 p-10 text-center">
          <Trophy className="mx-auto text-[var(--muted)]" />
          <h2 className="font-display mt-3 text-xl font-black">Ranking ainda vazio</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Os participantes visíveis aparecerão aqui.</p>
        </section>
      )}
    </>
  );
}

function metric(entry: RankingEntry, filter: Filter) {
  if (filter === "Tempo total") return formatDuration(entry.total_seconds);
  if (filter === "Maior sequência") return `${entry.current_streak} dias`;
  if (filter === "Mais check-ins") return `${entry.completed_days} check-ins`;
  return `${entry.total_xp.toLocaleString("pt-BR")} XP`;
}
