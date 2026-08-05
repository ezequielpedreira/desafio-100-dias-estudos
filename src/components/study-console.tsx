"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, Pause, Play, Square, TimerReset, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { studyCategories } from "@/lib/brand";
import { calculateEffectiveSeconds, calculateSessionXp } from "@/lib/game";
import { formatDuration } from "@/lib/utils";
import { getCheckinButtonState } from "@/lib/checkin";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";

type Session = {
  id: string;
  title: string;
  content: string;
  objective: string;
  category: string;
  plannedMinutes: number;
  startedAt: string;
  pausedAt: string | null;
  accumulatedPauseSeconds: number;
  status: "active" | "paused";
};

type DailyStatus = {
  checked_in: boolean;
  checkin_date: string;
  checked_in_at: string | null;
  next_checkin_at: string;
  timezone: string;
};

type ActiveSessionRow = {
  id: string;
  title: string;
  planned_content: string;
  planned_objective: string;
  planned_minutes: number;
  started_at: string;
  paused_at: string | null;
  accumulated_pause_seconds: number;
  status: "active" | "paused";
  study_categories: { name: string } | { name: string }[] | null;
};

type CreateCheckinResult = {
  created: boolean;
  already_checked_in: boolean;
  session_id: string | null;
  checkin_date: string;
  checked_in_at: string;
  next_checkin_at: string;
  timezone: string;
  message: string;
};

function toSession(row: ActiveSessionRow): Session {
  const category = Array.isArray(row.study_categories) ? row.study_categories[0] : row.study_categories;
  return {
    id: row.id,
    title: row.title,
    content: row.planned_content,
    objective: row.planned_objective,
    category: category?.name ?? "Estudo",
    plannedMinutes: row.planned_minutes,
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    accumulatedPauseSeconds: row.accumulated_pause_seconds,
    status: row.status,
  };
}

export function StudyConsole({ initialStatus, dailyGoalMinutes }: { initialStatus: DailyStatus; dailyGoalMinutes: number }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [dailyStatus, setDailyStatus] = useState(initialStatus);
  const [recovering, setRecovering] = useState(hasSupabaseEnv);
  const [serviceError, setServiceError] = useState(!hasSupabaseEnv);
  const [seconds, setSeconds] = useState(0);
  const [modal, setModal] = useState<"checkin" | "checkout" | "done" | null>(null);
  const [pending, setPending] = useState(false);
  const [xp, setXp] = useState(0);

  const calculate = useCallback(
    (value: Session) => calculateEffectiveSeconds(value.startedAt, new Date().toISOString(), value.accumulatedPauseSeconds, value.pausedAt),
    [],
  );

  const loadCurrentState = useCallback(async () => {
    if (!hasSupabaseEnv) return;
    const supabase = createClient();
    const [sessionResult, statusResult] = await Promise.all([
      supabase.from("study_sessions").select("id,title,planned_content,planned_objective,planned_minutes,started_at,paused_at,accumulated_pause_seconds,status,study_categories(name)").in("status", ["active", "paused"]).order("started_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.rpc("get_daily_checkin_status"),
    ]);
    if (sessionResult.error || statusResult.error) throw sessionResult.error ?? statusResult.error;
    setSession(sessionResult.data ? toSession(sessionResult.data as unknown as ActiveSessionRow) : null);
    setDailyStatus(statusResult.data as DailyStatus);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!hasSupabaseEnv) return;
    const timeout = window.setTimeout(() => {
      loadCurrentState()
        .catch(() => { if (!cancelled) setServiceError(true); })
        .finally(() => { if (!cancelled) setRecovering(false); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [loadCurrentState]);

  useEffect(() => {
    if (!session) return;
    const update = () => setSeconds(calculate(session));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [session, calculate]);

  async function start(form: HTMLFormElement) {
    if (pending || dailyStatus.checked_in) return;
    setPending(true);
    const data = new FormData(form);
    const values = {
      title: String(data.get("title") ?? "").trim(),
      content: String(data.get("content") ?? "").trim(),
      objective: String(data.get("objective") ?? "").trim(),
      category: String(data.get("category") ?? "").trim(),
      plannedMinutes: Number(data.get("minutes")),
    };
    try {
      const supabase = createClient();
      const { data: result, error } = await supabase.rpc("create_checkin", {
        p_title: values.title,
        p_planned_content: values.content,
        p_planned_objective: values.objective,
        p_category_name: values.category,
        p_planned_minutes: values.plannedMinutes,
        p_notes: String(data.get("notes") ?? "").trim() || null,
      });
      if (error) throw error;
      const response = result as CreateCheckinResult;
      setDailyStatus({
        checked_in: true,
        checkin_date: response.checkin_date,
        checked_in_at: response.checked_in_at,
        next_checkin_at: response.next_checkin_at,
        timezone: response.timezone,
      });
      setModal(null);
      await loadCurrentState();
      if (response.created) toast.success("Check-in feito! +10 XP. Hora de focar.");
      else toast.info("Check-in de hoje já foi concluído.");
      router.refresh();
    } catch {
      toast.error("Não foi possível registrar o check-in. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  async function togglePause() {
    if (!session || pending) return;
    setPending(true);
    try {
      const supabase = createClient();
      const fn = session.status === "active" ? "pause_study_session" : "resume_study_session";
      const { error } = await supabase.rpc(fn, { p_session_id: session.id });
      if (error) throw error;
      await loadCurrentState();
    } catch {
      toast.error("Não foi possível atualizar a sessão.");
    } finally {
      setPending(false);
    }
  }

  async function finish(form: HTMLFormElement) {
    if (!session || pending) return;
    setPending(true);
    const data = new FormData(form);
    let gained = calculateSessionXp(seconds, session.plannedMinutes);
    try {
      const supabase = createClient();
      const { data: result, error } = await supabase.rpc("finish_study_session", {
        p_session_id: session.id,
        p_actual_content: String(data.get("actualContent") ?? "").trim(),
        p_goal_achieved: data.get("goalAchieved") === "yes",
        p_learning_summary: String(data.get("learning") ?? "").trim(),
        p_difficulty: String(data.get("difficulty") ?? "").trim() || null,
        p_rating: Number(data.get("rating")) || null,
        p_checkout_notes: null,
      });
      if (error) throw error;
      gained = Number((result as { xp_earned?: number })?.xp_earned ?? gained);
      setXp(gained);
      setSession(null);
      setModal("done");
      router.refresh();
    } catch {
      toast.error("Não foi possível concluir a sessão. Seus dados continuam preenchidos.");
    } finally {
      setPending(false);
    }
  }

  if (!session) {
    const completed = dailyStatus.checked_in && !recovering;
    const buttonState = getCheckinButtonState({ checkedIn: completed, recovering, pending, serviceError });
    return (
      <>
        <section className="card flex min-h-72 flex-col items-center justify-center border-2 border-dashed border-[#cfc7ec] px-6 py-10 text-center">
          <span className="pulse-ring grid h-16 w-16 place-items-center rounded-2xl bg-[#6c4cff] text-white shadow-[0_5px_0_#4c32ca]">
            {completed ? <CheckCircle2 size={31} /> : <TimerReset size={31} />}
          </span>
          <h2 className="font-display mt-6 text-2xl font-black">
            {serviceError ? "Serviço temporariamente indisponível" : recovering ? "Recuperando sua sessão..." : completed ? "Check-in de hoje concluído." : "Sua próxima missão está pronta."}
          </h2>
          <p className="mt-2 max-w-md text-[var(--muted)]">
            {completed ? "Volte amanhã para continuar sua sequência." : "Faça o check-in, defina o foco e ligue o cronômetro. Um passo de cada vez."}
          </p>
          <button className="btn-primary mt-6 px-6" onClick={() => setModal("checkin")} disabled={buttonState.disabled}>
            {!buttonState.disabled && <Play size={18} fill="currentColor" />}{buttonState.label}
          </button>
          <span className="mt-4 text-xs font-bold text-[var(--muted)]">Meta de hoje: {dailyGoalMinutes} minutos</span>
        </section>
        {modal === "checkin" && <CheckinModal close={() => setModal(null)} submit={start} pending={pending} dailyGoalMinutes={dailyGoalMinutes} />}
        {modal === "done" && <DoneModal xp={xp} close={() => setModal(null)} />}
      </>
    );
  }

  return (
    <>
      <section className="card overflow-hidden border-2 border-[#6c4cff]">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#6c4cff] px-5 py-3 text-white">
          <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em]"><span className={`h-2.5 w-2.5 rounded-full ${session.status === "active" ? "animate-pulse bg-[#72efb7]" : "bg-[#ffc43d]"}`} />{session.status === "active" ? "Sessão em andamento" : "Sessão pausada"}</span>
          <span className="text-xs font-bold opacity-80">Iniciada às {new Date(session.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className="grid items-center gap-6 p-6 md:grid-cols-[1fr_auto]">
          <div><span className="chip bg-[#eeeaff] text-[#6c4cff]"><BookOpen size={15} />{session.category}</span><h2 className="font-display mt-4 text-2xl font-black">{session.title}</h2><p className="mt-2 text-sm text-[var(--muted)]">Objetivo: {session.objective}</p></div>
          <div className="text-center"><div className="font-display text-5xl font-black tabular-nums tracking-[-.05em]" aria-live="off">{formatDuration(seconds, true)}</div><p className="mt-1 text-xs font-bold text-[var(--muted)]">Meta: {session.plannedMinutes} minutos</p></div>
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--line)] bg-[var(--surface-soft)] px-6 py-4">
          <button className="btn-secondary" onClick={togglePause} disabled={pending}>{session.status === "active" ? <><Pause size={18} fill="currentColor" />Pausar</> : <><Play size={18} fill="currentColor" />Continuar</>}</button>
          <button className="btn-primary bg-[#27ae76] shadow-[0_4px_0_#187a51]" onClick={() => setModal("checkout")} disabled={pending}><Square size={17} fill="currentColor" />Finalizar sessão</button>
        </div>
      </section>
      {modal === "checkout" && <CheckoutModal session={session} seconds={seconds} close={() => setModal(null)} submit={finish} pending={pending} />}
    </>
  );
}

function Modal({ children, close, title }: { children: React.ReactNode; close: () => void; title: string }) {
  return <div className="fixed inset-0 z-[80] grid place-items-end bg-[#151424]/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-5" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(event) => { if (event.key === "Escape") close(); }}><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[24px] bg-[var(--surface)] p-6 text-[var(--ink)] shadow-2xl sm:rounded-[24px] sm:p-8"><div className="flex items-start justify-between"><p className="eyebrow">{title}</p><button type="button" className="icon-button" onClick={close} aria-label="Fechar" autoFocus><X size={19} /></button></div>{children}</div></div>;
}

function CheckinModal({ close, submit, pending, dailyGoalMinutes }: { close: () => void; submit: (form: HTMLFormElement) => void; pending: boolean; dailyGoalMinutes: number }) {
  return <Modal close={close} title="CHECK-IN"><h2 className="font-display mt-3 text-3xl font-black">Qual é a missão de agora?</h2><p className="mt-2 text-[var(--muted)]">Clareza primeiro, cronômetro depois.</p><form className="mt-7 space-y-4" onSubmit={(event) => { event.preventDefault(); submit(event.currentTarget); }}><Field label="Título da sessão" name="title" placeholder="Ex.: Modelagem dimensional" maxLength={120} /><Field label="O que você vai estudar?" name="content" placeholder="Conteúdo, capítulo ou tarefa" maxLength={500} /><Field label="Objetivo desta sessão" name="objective" placeholder="O que estará pronto ao terminar?" maxLength={500} /><div className="grid gap-4 sm:grid-cols-2"><div><label className="label" htmlFor="category">Categoria</label><select className="input" id="category" name="category">{studyCategories.map((category) => <option key={category}>{category}</option>)}</select></div><div><label className="label" htmlFor="minutes">Meta em minutos</label><input className="input" id="minutes" name="minutes" type="number" min={1} max={600} defaultValue={dailyGoalMinutes} required /></div></div><div><label className="label" htmlFor="notes">Observação <span className="font-normal text-[var(--muted)]">(opcional)</span></label><textarea className="input min-h-20 resize-none" id="notes" name="notes" maxLength={1000} /></div><button className="btn-primary mt-2 w-full" disabled={pending}>{pending ? "Registrando..." : <><Play size={18} fill="currentColor" />Fazer check-in</>}</button></form></Modal>;
}

function CheckoutModal({ session, seconds, close, submit, pending }: { session: Session; seconds: number; close: () => void; submit: (form: HTMLFormElement) => void; pending: boolean }) {
  return <Modal close={close} title="CHECK-OUT"><div className="mt-3 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-3xl font-black">Missão concluída?</h2><p className="mt-2 text-[var(--muted)]">Registre o que realmente aconteceu.</p></div><div className="rounded-xl bg-[#e1f7ed] px-4 py-3 text-right text-[#146c49]"><span className="block text-xs font-bold">TEMPO REGISTRADO</span><strong className="font-display text-xl">{formatDuration(seconds, true)}</strong></div></div><form className="mt-7 space-y-4" onSubmit={(event) => { event.preventDefault(); submit(event.currentTarget); }}><Field label="O que você estudou de fato?" name="actualContent" placeholder={session.content} maxLength={1000} /><fieldset><legend className="label">Alcançou o objetivo?</legend><div className="grid grid-cols-2 gap-2"><label className="flex items-center gap-2 rounded-xl border border-[var(--line)] p-3 font-bold"><input type="radio" name="goalAchieved" value="yes" defaultChecked />Sim</label><label className="flex items-center gap-2 rounded-xl border border-[var(--line)] p-3 font-bold"><input type="radio" name="goalAchieved" value="no" />Parcialmente</label></div></fieldset><div><label className="label" htmlFor="learning">Principal aprendizado</label><textarea className="input min-h-24 resize-none" id="learning" name="learning" required maxLength={1000} /></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="label" htmlFor="difficulty">Dificuldade encontrada</label><input className="input" id="difficulty" name="difficulty" maxLength={500} /></div><div><label className="label" htmlFor="rating">Nota da sessão</label><select className="input" id="rating" name="rating" defaultValue="5">{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}</option>)}</select></div></div><button className="btn-primary w-full bg-[#27ae76] shadow-[0_4px_0_#187a51]" disabled={pending}>{pending ? "Salvando..." : <><CheckCircle2 size={19} />Concluir check-out</>}</button></form></Modal>;
}

function DoneModal({ xp, close }: { xp: number; close: () => void }) {
  return <Modal close={close} title="CHECK-OUT CONCLUÍDO"><div className="py-8 text-center"><span className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-[#fff4d3] text-[#d18a00]"><Zap size={39} fill="currentColor" /></span><h2 className="font-display mt-6 text-3xl font-black">Sessão registrada!</h2><p className="mx-auto mt-3 max-w-md text-[var(--muted)]">O que você fez hoje já entrou na sua jornada.</p><div className="mx-auto mt-6 w-fit rounded-2xl bg-[#31294e] px-8 py-4 text-white"><span className="text-xs font-black text-[#ffc43d]">XP RECEBIDO</span><strong className="font-display block text-3xl">+{xp} XP</strong></div><button className="btn-primary mt-7" onClick={close}>Voltar ao dashboard</button></div></Modal>;
}

function Field({ label, name, placeholder, maxLength }: { label: string; name: string; placeholder: string; maxLength: number }) {
  return <div><label className="label" htmlFor={name}>{label}</label><input className="input" id={name} name={name} placeholder={placeholder} maxLength={maxLength} required /></div>;
}
