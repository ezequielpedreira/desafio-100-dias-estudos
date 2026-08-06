"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { LoaderCircle, MessageSquarePlus, Send, Star, X } from "lucide-react";
import { sendFeedbackRequest } from "@/lib/feedback-client";
import type { FeedbackInput } from "@/lib/feedback";

type FeedbackStatus = { kind: "error" | "success"; message: string } | null;

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackInput["category"]>("suggestion");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<FeedbackStatus>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pendingRef = useRef(false);
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    textareaRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pendingRef.current) setOpen(false);
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setStatus(null);
    const requestId = requestIdRef.current ?? crypto.randomUUID();
    requestIdRef.current = requestId;

    try {
      const result = await sendFeedbackRequest({
        requestId,
        category,
        message,
        rating,
        source: window.location.pathname,
      });
      setStatus({ kind: result.ok ? "success" : "error", message: result.message });
      if (result.ok) {
        // React 19 intercepta resets de formulário. Manter os campos controlados
        // evita que a limpeza após o sucesso alcance o error boundary da página.
        setCategory("suggestion");
        setMessage("");
        setRating(null);
        requestIdRef.current = null;
      }
    } catch {
      // Defesa adicional: falhas do canal de feedback nunca devem derrubar a jornada.
      setStatus({
        kind: "error",
        message: "Não foi possível concluir o envio. Tente novamente.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="fixed bottom-20 right-4 z-50 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#6c4cff] px-4 font-extrabold text-white shadow-[0_5px_0_#4c32ca,0_12px_28px_rgba(49,41,78,.24)] transition hover:-translate-y-0.5 lg:bottom-6 lg:right-6"
        onClick={() => { setStatus(null); setOpen(true); }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <MessageSquarePlus size={20} aria-hidden="true" />
        <span className="hidden sm:inline">Enviar feedback</span>
        <span className="sr-only sm:hidden">Enviar feedback</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] grid place-items-end bg-[#171326]/55 p-3 backdrop-blur-sm sm:place-items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) setOpen(false);
          }}
        >
          <section
            ref={dialogRef}
            className="card max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto p-5 sm:p-7"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            aria-describedby="feedback-description"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Sua opinião importa</p>
                <h2 id="feedback-title" className="font-display mt-2 text-2xl font-black">Enviar feedback</h2>
                <p id="feedback-description" className="mt-1 text-sm text-[var(--muted)]">
                  Conte o que funcionou ou o que podemos melhorar.
                </p>
              </div>
              <button type="button" className="icon-button shrink-0" onClick={() => setOpen(false)} disabled={pending} aria-label="Fechar feedback">
                <X size={20} />
              </button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={submitFeedback} aria-busy={pending}>
              <div>
                <label className="label" htmlFor="feedback-category">Tipo de feedback</label>
                <select className="input" id="feedback-category" name="category" value={category} onChange={(event) => { setCategory(event.target.value as FeedbackInput["category"]); requestIdRef.current = null; }} required disabled={pending}>
                  <option value="suggestion">Sugestão</option>
                  <option value="problem">Encontrei um problema</option>
                  <option value="compliment">Elogio</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              <fieldset>
                <legend className="label">Como está sua experiência? <span className="font-normal text-[var(--muted)]">(opcional)</span></legend>
                <div className="flex gap-2" aria-label="Avaliação de 1 a 5 estrelas">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`grid h-11 w-11 place-items-center rounded-xl border transition ${rating && value <= rating ? "border-[#ffc43d] bg-[#fff4d3] text-[#9b6200]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"}`}
                      onClick={() => { setRating(value); requestIdRef.current = null; }}
                      aria-label={`${value} ${value === 1 ? "estrela" : "estrelas"}`}
                      aria-pressed={rating === value}
                    >
                      <Star size={19} fill={rating && value <= rating ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
              </fieldset>

              <div>
                <label className="label" htmlFor="feedback-message">Mensagem</label>
                <textarea
                  ref={textareaRef}
                  className="input min-h-32 resize-y"
                  id="feedback-message"
                  name="message"
                  value={message}
                  onChange={(event) => { setMessage(event.target.value); requestIdRef.current = null; }}
                  minLength={10}
                  maxLength={2000}
                  placeholder="Descreva sua ideia, dificuldade ou experiência..."
                  required
                  disabled={pending}
                />
                <p className="mt-1 text-xs text-[var(--muted)]">O e-mail da sua conta será usado somente para responder ao feedback.</p>
              </div>

              {status && (
                <p
                  className={`rounded-xl p-3 text-sm font-bold ${status.kind === "success" ? "bg-[#e1f7ed] text-[#18734f]" : "bg-[#fff0f1] text-[#a83741]"}`}
                  role={status.kind === "error" ? "alert" : "status"}
                >
                  {status.message}
                </p>
              )}

              <button type="submit" className="btn-primary w-full" disabled={pending}>
                {pending ? <><LoaderCircle className="animate-spin" size={18} />Enviando...</> : <><Send size={18} />Enviar feedback</>}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
