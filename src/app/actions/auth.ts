"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export type AuthState={message?:string;errors?:Record<string,string[]>};
const loginSchema=z.object({email:z.email("Informe um e-mail válido.").trim(),password:z.string().min(8,"A senha deve ter pelo menos 8 caracteres.")});
const signupSchema=loginSchema.extend({name:z.string().trim().min(2,"Informe seu nome.").max(80,"Nome muito longo.")});

function parse(formData:FormData,signup=false){const raw={name:formData.get("name"),email:formData.get("email"),password:formData.get("password")};return signup?signupSchema.safeParse(raw):loginSchema.safeParse(raw);}
export async function login(_:AuthState|undefined,formData:FormData):Promise<AuthState>{
  const result=parse(formData);if(!result.success)return{errors:result.error.flatten().fieldErrors};if(!hasSupabaseEnv)return{message:"Modo demonstração ativo. Use o botão “Explorar demonstração”."};
  const supabase=await createClient();const {error}=await supabase.auth.signInWithPassword({email:result.data.email as string,password:result.data.password});if(error)return{message:"Não foi possível entrar. Confira e-mail e senha."};redirect("/app");
}
export async function signup(_:AuthState|undefined,formData:FormData):Promise<AuthState>{
  const result=parse(formData,true);if(!result.success)return{errors:result.error.flatten().fieldErrors};if(!hasSupabaseEnv)return{message:"Conecte um projeto Supabase para criar a conta."};
  const data=result.data as {name:string;email:string;password:string};const supabase=await createClient();const origin=process.env.NEXT_PUBLIC_SITE_URL??"http://localhost:3000";const {error}=await supabase.auth.signUp({email:data.email,password:data.password,options:{data:{full_name:data.name},emailRedirectTo:`${origin}/auth/callback?next=/onboarding`}});if(error)return{message:error.message.includes("already")?"Este e-mail já possui cadastro.":"Não foi possível criar a conta."};return{message:"Conta criada! Confira seu e-mail para continuar."};
}
export async function requestPasswordReset(_:AuthState|undefined,formData:FormData):Promise<AuthState>{const email=z.email().safeParse(formData.get("email"));if(!email.success)return{message:"Informe um e-mail válido."};if(!hasSupabaseEnv)return{message:"Conecte o Supabase para recuperar a senha."};const supabase=await createClient();const origin=process.env.NEXT_PUBLIC_SITE_URL??"http://localhost:3000";await supabase.auth.resetPasswordForEmail(email.data,{redirectTo:`${origin}/reset-password`});return{message:"Se houver uma conta, enviaremos o link de recuperação."};}
export async function logout(){if(hasSupabaseEnv){const supabase=await createClient();await supabase.auth.signOut();}redirect("/login");}
