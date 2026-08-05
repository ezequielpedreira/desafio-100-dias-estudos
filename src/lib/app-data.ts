import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  linkedin_handle: string | null;
  bio: string | null;
  timezone: string;
  daily_goal_minutes: number;
  main_study_goal: string | null;
  priority_subject: string | null;
  ranking_visibility: string;
  onboarding_completed: boolean;
  created_at: string;
};

export type Challenge = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string;
};

export type StudySession = {
  id: string;
  title: string;
  planned_content: string;
  planned_objective: string;
  planned_minutes: number;
  actual_content: string | null;
  learning_summary: string | null;
  goal_achieved: boolean | null;
  rating: number | null;
  status: string;
  started_at: string;
  finished_at: string | null;
  effective_duration_seconds: number;
  study_categories: { name: string } | { name: string }[] | null;
};

export type SessionWithCategory = StudySession & { category: string };

export type DailyCheckin = {
  id: string;
  session_id: string | null;
  checkin_date: string;
  checked_in_at: string;
};

export type DailyProgress = {
  study_date: string;
  challenge_day: number;
  total_duration_seconds: number;
  is_completed: boolean;
  xp_earned: number;
};

export type RankingEntry = {
  rank_position: number;
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  avatar_url: string | null;
  total_xp: number;
  total_seconds: number;
  current_streak: number;
  completed_days: number;
  level: number;
};

export type Achievement = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  condition_type: string;
  condition_value: number;
  user_achievements: { unlocked_at: string }[] | { unlocked_at: string } | null;
};

export type CheckinStatus = {
  checked_in: boolean;
  checkin_id: string | null;
  session_id: string | null;
  checkin_date: string;
  checked_in_at: string | null;
  timezone: string;
  server_time: string;
  next_checkin_at: string;
};

type BaseData = {
  user: { id: string; email: string };
  profile: Profile;
  checkinStatus: CheckinStatus;
};

type RawRankingEntry = Omit<RankingEntry, "avatar_url">;

async function addRankingAvatarUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entries: RawRankingEntry[],
): Promise<RankingEntry[]> {
  const paths = [...new Set(entries.map((entry) => entry.avatar_path).filter((path): path is string => Boolean(path)))];
  if (!paths.length) return entries.map((entry) => ({ ...entry, avatar_url: null }));

  const { data, error } = await supabase.storage.from("avatars").createSignedUrls(paths, 3600);
  if (error) return entries.map((entry) => ({ ...entry, avatar_url: null }));

  const signedUrls = new Map((data ?? []).map((item) => [item.path, item.signedUrl ?? null]));
  return entries.map((entry) => ({
    ...entry,
    avatar_url: entry.avatar_path ? signedUrls.get(entry.avatar_path) ?? null : null,
  }));
}

function relationName(value: StudySession["study_categories"]) {
  return Array.isArray(value) ? value[0]?.name ?? "Estudo" : value?.name ?? "Estudo";
}

function previousDate(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function calculateStreak(checkins: DailyCheckin[], today: string) {
  const dates = new Set(checkins.map((item) => item.checkin_date));
  let cursor = dates.has(today) ? today : previousDate(today);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = previousDate(cursor);
  }
  return streak;
}

async function loadSessions() {
  const supabase = await createClient();
  const result = await supabase
    .from("study_sessions")
    .select("id,title,planned_content,planned_objective,planned_minutes,actual_content,learning_summary,goal_achieved,rating,status,started_at,finished_at,effective_duration_seconds,study_categories(name)")
    .order("started_at", { ascending: false })
    .limit(200);
  if (result.error) throw new Error("Não foi possível carregar as sessões.");
  return ((result.data ?? []) as unknown as StudySession[]).map((session) => ({
    ...session,
    category: relationName(session.study_categories),
  }));
}

async function loadChallenge() {
  const supabase = await createClient();
  const result = await supabase
    .from("challenges")
    .select("id,name,start_date,end_date,total_days,status")
    .in("status", ["active", "scheduled"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw new Error("Não foi possível carregar o desafio.");
  return result.data as Challenge | null;
}

export const getBaseData = cache(async (): Promise<BaseData> => {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) redirect("/login");

  const [profileResult, statusResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,display_name,avatar_url,linkedin_handle,bio,timezone,daily_goal_minutes,main_study_goal,priority_subject,ranking_visibility,onboarding_completed,created_at")
      .eq("id", authData.user.id)
      .single(),
    supabase.rpc("get_daily_checkin_status"),
  ]);

  if (profileResult.error || statusResult.error || !statusResult.data) {
    throw new Error("Não foi possível carregar os dados da conta.");
  }
  const storedProfile = profileResult.data as Omit<Profile, "avatar_path">;
  let signedAvatarUrl: string | null = null;
  if (storedProfile.avatar_url) {
    const { data: signedAvatar } = await supabase.storage.from("avatars").createSignedUrl(storedProfile.avatar_url, 3600);
    signedAvatarUrl = signedAvatar?.signedUrl ?? null;
  }
  const profile: Profile = {
    ...storedProfile,
    avatar_path: storedProfile.avatar_url,
    avatar_url: signedAvatarUrl,
  };
  if (!profile.onboarding_completed) redirect("/onboarding");

  return {
    user: { id: authData.user.id, email: authData.user.email ?? "" },
    profile,
    checkinStatus: statusResult.data as CheckinStatus,
  };
});

export const getUserStats = cache(async () => {
  const base = await getBaseData();
  const supabase = await createClient();
  const [xpResult, checkinsResult] = await Promise.all([
    supabase.from("xp_transactions").select("amount"),
    supabase
      .from("daily_checkins")
      .select("id,session_id,checkin_date,checked_in_at")
      .order("checkin_date", { ascending: false })
      .limit(365),
  ]);
  if (xpResult.error || checkinsResult.error) throw new Error("Não foi possível carregar o progresso.");

  const checkins = (checkinsResult.data ?? []) as DailyCheckin[];
  return {
    totalXp: (xpResult.data ?? []).reduce((sum, item) => sum + Number(item.amount), 0),
    completedDays: checkins.length,
    streak: calculateStreak(checkins, base.checkinStatus.checkin_date),
    checkins,
  };
});

export const getViewerData = cache(async () => {
  const [base, stats] = await Promise.all([getBaseData(), getUserStats()]);
  return { ...base, stats };
});

export const getDashboardData = cache(async () => {
  const supabase = await createClient();
  const [base, userStats, challenge, progressResult, rankingResult] = await Promise.all([
    getBaseData(),
    getUserStats(),
    loadChallenge(),
    supabase
      .from("daily_progress")
      .select("study_date,challenge_day,total_duration_seconds,is_completed,xp_earned")
      .order("study_date", { ascending: false })
      .limit(365),
    supabase.rpc("get_ranking", { p_limit: 100 }),
  ]);
  if (progressResult.error || rankingResult.error) throw new Error("Não foi possível carregar o painel.");

  const progress = (progressResult.data ?? []) as DailyProgress[];
  const ranking = await addRankingAvatarUrls(supabase, (rankingResult.data ?? []) as RawRankingEntry[]);
  const currentRanking = ranking.find((entry) => entry.user_id === base.user.id);
  const todayProgress = progress.find((item) => item.study_date === base.checkinStatus.checkin_date);

  return {
    ...base,
    challenge,
    progress,
    ranking,
    stats: {
      ...userStats,
      totalSeconds: progress.reduce((sum, item) => sum + item.total_duration_seconds, 0),
      todaySeconds: todayProgress?.total_duration_seconds ?? 0,
      rank: currentRanking?.rank_position ?? null,
    },
  };
});

export const getJourneyData = cache(async () => {
  const [base, stats, challenge, sessions] = await Promise.all([
    getBaseData(),
    getUserStats(),
    loadChallenge(),
    loadSessions(),
  ]);
  return { ...base, stats, challenge, sessions, checkins: stats.checkins };
});

export const getSessionsData = cache(async () => {
  const [base, sessions] = await Promise.all([getBaseData(), loadSessions()]);
  return { ...base, sessions };
});

export const getRankingData = cache(async () => {
  const supabase = await createClient();
  const [base, rankingResult] = await Promise.all([
    getBaseData(),
    supabase.rpc("get_ranking", { p_limit: 100 }),
  ]);
  if (rankingResult.error) throw new Error("Não foi possível carregar o ranking.");
  const ranking = await addRankingAvatarUrls(supabase, (rankingResult.data ?? []) as RawRankingEntry[]);
  return { ...base, ranking };
});

export const getAchievementsData = cache(async () => {
  const supabase = await createClient();
  const [base, achievementsResult] = await Promise.all([
    getBaseData(),
    supabase
      .from("achievements")
      .select("id,slug,name,description,icon,condition_type,condition_value,user_achievements(unlocked_at)")
      .order("condition_value"),
  ]);
  if (achievementsResult.error) throw new Error("Não foi possível carregar as conquistas.");
  return { ...base, achievements: (achievementsResult.data ?? []) as unknown as Achievement[] };
});
