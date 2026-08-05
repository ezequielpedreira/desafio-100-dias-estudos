"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, LoaderCircle, LockKeyhole, Moon, Save, ShieldCheck, Sun, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateProfile, type ProfileState } from "@/app/actions/profile";
import { useTheme } from "@/components/theme-provider";
import type { Profile } from "@/lib/app-data";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/utils";

const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxAvatarBytes = 2 * 1024 * 1024;

export function ProfileForm({ profile, email }: { profile: Profile; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, {} as ProfileState);
  const [avatarPath, setAvatarPath] = useState(profile.avatar_path ?? "");
  const [previewUrl, setPreviewUrl] = useState(profile.avatar_url ?? "");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (state.message) (state.ok ? toast.success : toast.error)(state.message);
  }, [state]);

  async function uploadAvatar(file: File) {
    if (!acceptedImageTypes.has(file.type)) {
      toast.error("Escolha uma imagem JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > maxAvatarBytes) {
      toast.error("A foto deve ter no máximo 2 MB.");
      return;
    }

    const previousPreview = previewUrl;
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploading(true);
    try {
      const supabase = createClient();
      const path = `${profile.id}/profile`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      });
      if (error) throw error;
      const { data, error: signedUrlError } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
      if (signedUrlError || !data?.signedUrl) throw signedUrlError ?? new Error("URL da foto indisponível.");
      setAvatarPath(path);
      setPreviewUrl(data.signedUrl);
      toast.success("Foto carregada. Salve as alterações para confirmar.");
    } catch {
      setPreviewUrl(previousPreview);
      toast.error("Não foi possível enviar a foto. Tente novamente.");
    } finally {
      URL.revokeObjectURL(localPreview);
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function removeAvatar() {
    setAvatarPath("");
    setPreviewUrl("");
    toast.info("A foto será removida ao salvar as alterações.");
  }

  return (
    <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_330px]">
      <form action={action} className="card p-5 md:p-7">
        <input type="hidden" name="avatar_path" value={avatarPath} />
        <div className="flex flex-col gap-5 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-center">
          <span
            className={`grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-[#6c4cff] bg-cover bg-center bg-no-repeat font-display text-xl font-black text-white ${previewUrl ? "text-transparent" : ""}`}
            style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
            aria-label={previewUrl ? "Prévia da foto de perfil" : undefined}
          >
            {!previewUrl && initials(profile.display_name || profile.full_name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-black">{profile.full_name || "Participante"}</h2>
            <p className="truncate text-sm text-[var(--muted)]">{email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className={`btn-secondary ${uploading ? "cursor-wait opacity-60" : "cursor-pointer"}`}>
                {uploading ? <LoaderCircle className="animate-spin" size={18} /> : <Camera size={18} />}
                {uploading ? "Enviando..." : previewUrl ? "Trocar foto" : "Adicionar foto"}
                <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file); }} />
              </label>
              {previewUrl && <button className="btn-secondary" type="button" onClick={removeAvatar} disabled={uploading}><Trash2 size={17} />Remover</button>}
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">JPEG, PNG ou WebP · máximo de 2 MB</p>
            {state.errors?.avatar_path?.[0] && <p className="mt-1 text-xs font-bold text-[#df5b62]">{state.errors.avatar_path[0]}</p>}
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="Nome completo" name="full_name" value={profile.full_name} error={state.errors?.full_name?.[0]} required />
          <Field label="Apelido no ranking" name="display_name" value={profile.display_name ?? ""} error={state.errors?.display_name?.[0]} />
          <div className="md:col-span-2">
            <label className="label" htmlFor="linkedin_handle">LinkedIn</label>
            <div className="relative">
              <span className="absolute left-3 top-[.72rem] font-black text-[#0a66c2]">@</span>
              <input className="input linkedin-input" id="linkedin_handle" name="linkedin_handle" defaultValue={profile.linkedin_handle ?? ""} placeholder="seu-identificador" autoComplete="url" aria-invalid={Boolean(state.errors?.linkedin_handle?.[0])} aria-describedby={state.errors?.linkedin_handle?.[0] ? "linkedin_handle-error" : "linkedin_handle-help"} />
            </div>
            <p id="linkedin_handle-help" className="mt-1 text-xs text-[var(--muted)]">Você também pode colar a URL completa do seu perfil.</p>
            {state.errors?.linkedin_handle?.[0] && <p id="linkedin_handle-error" className="mt-1 text-xs font-bold text-[#df5b62]">{state.errors.linkedin_handle[0]}</p>}
          </div>
          <div className="md:col-span-2"><label className="label" htmlFor="bio">Bio curta</label><textarea className="input min-h-24 resize-none" id="bio" name="bio" defaultValue={profile.bio ?? ""} maxLength={160} /></div>
          <Field label="Objetivo principal" name="main_study_goal" value={profile.main_study_goal ?? ""} />
          <Field label="Área prioritária" name="priority_subject" value={profile.priority_subject ?? ""} />
          <Field label="Meta diária (minutos)" name="daily_goal_minutes" value={String(profile.daily_goal_minutes)} type="number" />
          <div><label className="label" htmlFor="ranking_visibility">Visibilidade no ranking</label><select className="input" id="ranking_visibility" name="ranking_visibility" defaultValue={profile.ranking_visibility}><option value="full_name">Nome completo</option><option value="first_name">Primeiro nome</option><option value="nickname">Apelido</option><option value="anonymous">Anônimo</option><option value="hidden">Não participar</option></select></div>
          <div><label className="label" htmlFor="timezone">Fuso horário</label><select className="input" id="timezone" name="timezone" defaultValue={profile.timezone}><option>America/Sao_Paulo</option><option>America/Manaus</option><option>America/Recife</option><option>America/Fortaleza</option><option>America/Bahia</option></select></div>
        </div>
        <button className="btn-primary mt-7" disabled={pending || uploading}><Save size={18} />{pending ? "Salvando..." : "Salvar alterações"}</button>
      </form>

      <aside className="space-y-5">
        <section className="card p-5"><h2 className="font-display flex items-center gap-3 text-lg font-black">{theme === "light" ? <Sun className="text-[#d49400]" /> : <Moon className="text-[#6c4cff]" />}Aparência</h2><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => setTheme("light")} className={theme === "light" ? "btn-primary" : "btn-secondary"} type="button" aria-pressed={theme === "light"}><Sun size={17} />Claro</button><button onClick={() => setTheme("dark")} className={theme === "dark" ? "btn-primary" : "btn-secondary"} type="button" aria-pressed={theme === "dark"}><Moon size={17} />Escuro</button></div></section>
        <section className="card p-5"><h2 className="font-display flex items-center gap-3 text-lg font-black"><ShieldCheck className="text-[#27ae76]" />Privacidade</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">Seu e-mail, LinkedIn, objetivo e conteúdo das sessões não aparecem no ranking.</p></section>
        <section className="card p-5"><h2 className="font-display flex items-center gap-3 text-lg font-black"><LockKeyhole className="text-[#6c4cff]" />Segurança</h2><Link className="btn-secondary mt-4 w-full" href="/recuperar-senha">Alterar senha</Link></section>
      </aside>
    </div>
  );
}

function Field({ label, name, value, type = "text", error, required }: { label: string; name: string; value: string; type?: string; error?: string; required?: boolean }) {
  return <div><label className="label" htmlFor={name}>{label}</label><input className="input" id={name} name={name} defaultValue={value} type={type} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} />{error && <p id={`${name}-error`} className="mt-1 text-xs font-bold text-[#df5b62]">{error}</p>}</div>;
}
