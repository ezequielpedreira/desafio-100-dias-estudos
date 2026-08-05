export default function AppLoading() {
  return (
    <div className="animate-pulse" role="status" aria-live="polite" aria-label="Carregando página">
      <div className="h-3 w-32 rounded bg-[var(--line)]" />
      <div className="mt-4 h-10 w-full max-w-md rounded-xl bg-[var(--line)]" />
      <div className="mt-3 h-4 w-full max-w-sm rounded bg-[var(--line)]" />
      <div className="mt-8 h-56 rounded-[20px] bg-[var(--line)]" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 rounded-[20px] bg-[var(--line)]" />)}
      </div>
      <span className="sr-only">Carregando conteúdo…</span>
    </div>
  );
}
