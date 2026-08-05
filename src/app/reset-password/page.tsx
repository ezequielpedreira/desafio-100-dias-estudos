"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import { updatePassword, type AuthState } from "@/app/actions/auth";
import { BrandMark } from "@/components/brand-mark";

export default function ResetPasswordPage() { const [state, action, pending] = useActionState(updatePassword, {} as AuthState); return <main className="grid min-h-screen place-items-center p-5"><div className="card w-full max-w-md p-7"><BrandMark /><LockKeyhole className="mt-8 text-[#6c4cff]" /><h1 className="font-display mt-4 text-3xl font-black">Criar nova senha</h1><p className="mt-2 text-[var(--muted)]">Use pelo menos 8 caracteres.</p><form action={action} className="mt-6 space-y-4"><PasswordField name="password" label="Nova senha" error={state.errors?.password?.[0]} /><PasswordField name="confirmation" label="Confirmar senha" error={state.errors?.confirmation?.[0]} />{state.message && <p className="rounded-xl bg-[#fff0f1] p-3 text-sm font-bold text-[#a83741]">{state.message}</p>}<button className="btn-primary w-full" disabled={pending}>{pending ? "Salvando..." : "Atualizar senha"}</button></form></div></main>; }
function PasswordField({ name, label, error }: { name: string; label: string; error?: string }) { return <div><label className="label" htmlFor={name}>{label}</label><input className="input" id={name} name={name} type="password" minLength={8} maxLength={128} autoComplete="new-password" required aria-invalid={Boolean(error)} />{error && <p className="mt-1 text-xs font-bold text-[#df5b62]">{error}</p>}</div>; }
