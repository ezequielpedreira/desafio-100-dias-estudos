import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { getViewerData } from "@/lib/app-data";
import { getLevel } from "@/lib/game";
import { initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Minha jornada" };
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const data = await getViewerData();
  const name = data.profile.display_name || data.profile.full_name || "Participante";
  const level = getLevel(data.stats.totalXp);
  return (
    <AppShell
      viewer={{
        name,
        initials: initials(name) || "L1",
        avatarUrl: data.profile.avatar_url,
        level: level.level,
        levelName: level.name,
        levelProgress: level.progress,
        nextXp: level.next ? level.next.minXp - data.stats.totalXp : 0,
        streak: data.stats.streak,
        serverTime: data.checkinStatus.server_time,
        timezone: data.profile.timezone,
      }}
    >
      {children}
    </AppShell>
  );
}
