"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Clock3, Filter, Search, X, Zap } from "lucide-react";
import { formatDuration } from "@/lib/utils";

type Row = {
  id: string; title: string; planned_objective: string; status: string; started_at: string;
  finished_at: string | null; effective_duration_seconds: number; category: string;
};

function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"); }

export function SessionsList({ sessions, timezone }: { sessions: Row[]; timezone: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [status, setStatus] = useState("Todos");
  const categories = [...new Set(sessions.map((session) => session.category))];
  const rows = useMemo(() => sessions.filter((session) => {
    const matchesQuery = normalize(`${session.title} ${session.planned_objective}`).includes(normalize(query.trim()));
    return matchesQuery && (category === "Todas" || session.category === category) && (status === "Todos" || session.status === status);
  }), [sessions, query, category, status]);
  const filtered = query || category !== "Todas" || status !== "Todos";

  return <section className="card mt-7 p-4 md:p-6"><div className="grid gap-3 md:grid-cols-[1fr_210px_180px_auto]"><label className="relative"><Search className="absolute left-3 top-3.5 text-[var(--muted)]" size={18} /><input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título ou objetivo" aria-label="Buscar sessões" /></label><select className="input" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filtrar por categoria"><option>Todas</option>{categories.map((value) => <option key={value}>{value}</option>)}</select><select className="input" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por status"><option value="Todos">Todos os status</option><option value="completed">Concluídas</option><option value="active">Em andamento</option><option value="paused">Pausadas</option><option value="cancelled">Canceladas</option></select><button type="button" className="btn-secondary" disabled={!filtered} onClick={() => { setQuery(""); setCategory("Todas"); setStatus("Todos"); }}><X size={17} />Limpar</button></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b border-[var(--line)] text-xs font-black uppercase tracking-wider text-[var(--muted)]"><th className="pb-3">Sessão</th><th className="pb-3">Categoria</th><th className="pb-3">Início</th><th className="pb-3">Tempo</th><th className="pb-3">Status</th></tr></thead><tbody>{rows.map((session) => <tr key={session.id} className="border-b border-[var(--line)] last:border-0"><td className="py-4 pr-4"><strong className="block">{session.title}</strong><span className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]"><CalendarDays size={12} />{session.planned_objective}</span></td><td><span className="chip bg-[#eeeaff] text-[#5b3ee4]">{session.category}</span></td><td className="text-sm font-bold">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: timezone }).format(new Date(session.started_at))}</td><td><span className="flex items-center gap-1 text-sm font-bold"><Clock3 size={15} className="text-[#27ae76]" />{formatDuration(session.effective_duration_seconds)}</span></td><td><span className="flex items-center gap-1 text-sm font-black text-[#6c4cff]"><Zap size={14} />{statusLabel(session.status)}</span></td></tr>)}</tbody></table>{!rows.length && <div className="py-16 text-center"><Filter className="mx-auto text-[var(--muted)]" /><strong className="mt-3 block">Nenhuma sessão encontrada</strong><p className="mt-1 text-sm text-[var(--muted)]">Tente limpar ou ajustar os filtros.</p></div>}</div></section>;
}

function statusLabel(status: string) { return ({ completed: "Concluída", active: "Em andamento", paused: "Pausada", cancelled: "Cancelada" } as Record<string, string>)[status] ?? status; }
