"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const timezones = ["America/Sao_Paulo", "America/Manaus", "America/Recife", "America/Fortaleza", "America/Bahia"] as const;
const schema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome.").max(80),
  display_name: z.string().trim().max(50),
  linkedin_handle: z.string().trim().max(120),
  avatar_path: z.string().trim().max(200),
  bio: z.string().trim().max(160),
  main_study_goal: z.string().trim().max(300),
  priority_subject: z.string().trim().max(80),
  daily_goal_minutes: z.coerce.number().int().min(1).max(600),
  ranking_visibility: z.enum(["full_name", "first_name", "nickname", "anonymous", "hidden"]),
  timezone: z.enum(timezones),
});

export type ProfileState = { ok?: boolean; message?: string; errors?: Record<string, string[]> };

function normalizeLinkedInHandle(value: string) {
  const trimmed = value.trim().replace(/^@/, "");
  if (!trimmed) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0]?.toLowerCase() === "in" && parts[1]) return parts[1];
    }
  } catch { /* O valor pode ser apenas o identificador. */ }
  return trimmed;
}

export async function updateProfile(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const result = schema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { errors: result.error.flatten().fieldErrors, message: "Revise os campos destacados." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { message: "Sua sessão expirou. Entre novamente." };
  const linkedinHandle = normalizeLinkedInHandle(result.data.linkedin_handle);
  if (linkedinHandle && !/^[A-Za-z0-9][A-Za-z0-9-]{2,99}$/.test(linkedinHandle)) {
    return { errors: { linkedin_handle: ["Use de 3 a 100 letras, números ou hífens."] }, message: "Revise o LinkedIn informado." };
  }
  if (result.data.avatar_path && result.data.avatar_path !== `${auth.user.id}/profile`) {
    return { errors: { avatar_path: ["A foto precisa ter sido enviada pela sua conta."] }, message: "Não foi possível validar a foto." };
  }
  const { avatar_path: avatarPath, ...profileData } = result.data;
  const { error } = await supabase.from("profiles").update({
    ...profileData,
    display_name: result.data.display_name || null,
    linkedin_handle: linkedinHandle || null,
    avatar_url: avatarPath || null,
    bio: result.data.bio || null,
    main_study_goal: result.data.main_study_goal || null,
    priority_subject: result.data.priority_subject || null,
  }).eq("id", auth.user.id);
  if (error) return { message: "Não foi possível salvar o perfil." };
  revalidatePath("/app", "layout");
  return { ok: true, message: "Perfil atualizado com sucesso." };
}
