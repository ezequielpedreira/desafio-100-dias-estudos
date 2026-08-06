"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Flame, Home, LogOut, Map, Medal, Settings, TimerReset, Trophy } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { ThemeToggle } from "./theme-toggle";
import { FeedbackWidget } from "./feedback-widget";
import { cn } from "@/lib/utils";
import { logout } from "@/app/actions/auth";

const nav = [
  { href: "/app", label: "Início", icon: Home },
  { href: "/app/jornada", label: "Minha jornada", icon: Map },
  { href: "/app/sessoes", label: "Sessões", icon: TimerReset },
  { href: "/app/ranking", label: "Ranking", icon: Trophy },
  { href: "/app/conquistas", label: "Conquistas", icon: Award },
  { href: "/app/perfil", label: "Perfil", icon: Settings },
];

type Viewer = {
  name: string;
  initials: string;
  avatarUrl: string | null;
  level: number;
  levelName: string;
  levelProgress: number;
  nextXp: number;
  streak: number;
  serverTime: string;
  timezone: string;
};

export function AppShell({ children, viewer }: { children: React.ReactNode; viewer: Viewer }) {
  const path = usePathname();

  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "numeric", month: "long", timeZone: viewer.timezone,
  }).format(new Date(viewer.serverTime)).toUpperCase();

  const sidebar = (
    <>
      <div className="px-5 py-5"><BrandMark /></div>
      <nav className="mt-3 space-y-1 px-3" aria-label="Navegação principal">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/app" ? path === item.href : path.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} prefetch={true} aria-current={active ? "page" : undefined}
              className={cn("nav-link", active && "nav-link-active")}>
              <Icon size={20} aria-hidden="true" />{item.label}
            </Link>
          );
        })}
      </nav>
      <div className="level-card mx-4 mt-auto rounded-2xl p-4 text-white">
        <div className="flex items-center gap-2 text-xs font-extrabold text-[#ffc43d]"><Medal size={16} />Nível {viewer.level}</div>
        <p className="font-display mt-2 font-black">{viewer.levelName}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#514b6c]">
          <div className="h-full bg-[#ffc43d]" style={{ width: `${viewer.levelProgress}%` }} />
        </div>
        <p className="mt-2 text-[11px] text-[#cfc9e8]">{viewer.nextXp ? `${viewer.nextXp} XP para o próximo nível` : "Nível máximo alcançado"}</p>
      </div>
      <div className="m-4 space-y-2">
        <form action={logout}>
          <button className="nav-link w-full" type="submit"><LogOut size={18} />Sair</button>
        </form>
      </div>
    </>
  );

  return (
    <div className="min-h-screen">
      <aside className="app-sidebar fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r lg:flex">{sidebar}</aside>
      <div className="lg:pl-64">
        <header className="app-header sticky top-0 z-30 flex h-[72px] items-center justify-end border-b px-4 backdrop-blur md:px-8 lg:justify-between">
          <p className="hidden text-xs font-bold text-[var(--muted)] lg:block">{dateLabel}</p>
          <div className="flex items-center gap-3">
            <div className="chip bg-[#fff4d3] text-[#9b6200]"><Flame size={15} fill="currentColor" />{viewer.streak} {viewer.streak === 1 ? "dia" : "dias"}</div>
            <ThemeToggle compact />
            <Link href="/app/perfil" className="profile-link" aria-label="Abrir perfil">
              <span className={cn("avatar", viewer.avatarUrl && "avatar-photo")} style={viewer.avatarUrl ? { backgroundImage: `url(${viewer.avatarUrl})` } : undefined}>{viewer.avatarUrl ? <span className="sr-only">Foto de perfil</span> : viewer.initials}</span><span className="hidden text-sm font-extrabold sm:inline">{viewer.name}</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1480px] p-4 pb-24 md:p-8">{children}</main>
      </div>
      <nav className="mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t px-1 pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Navegação móvel">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/app" ? path === item.href : path.startsWith(item.href);
          return <Link key={item.href} href={item.href} prefetch={true} aria-current={active ? "page" : undefined} className={cn("mobile-link", active && "text-[#6c4cff]")}><Icon size={19} />{item.label.replace("Minha ", "")}</Link>;
        })}
      </nav>
      <FeedbackWidget />
    </div>
  );
}
