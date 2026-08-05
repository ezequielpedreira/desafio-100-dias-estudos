"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Target, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { BrandMark } from "@/components/brand-mark";
import { studyCategories } from "@/lib/brand";
import { toast } from "sonner";

function localDateValue(date=new Date()){
  const year=date.getFullYear();
  const month=String(date.getMonth()+1).padStart(2,"0");
  const day=String(date.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
}
export default function Onboarding(){
  const[step,setStep]=useState(1);const[loading,setLoading]=useState(false);const startDateRef=useRef<HTMLInputElement>(null);const router=useRouter();
  useEffect(()=>{const input=startDateRef.current;if(!input)return;const today=localDateValue();input.min=today;if(!input.value)input.value=today;},[]);
  async function finish(form:HTMLFormElement){setLoading(true);const data=new FormData(form);if(hasSupabaseEnv){const supabase=createClient();const{error}=await supabase.rpc("complete_onboarding",{p_main_study_goal:data.get("goal"),p_priority_subject:data.get("subject"),p_daily_goal_minutes:Number(data.get("minutes")),p_start_date:data.get("startDate"),p_ranking_visibility:data.get("visibility"),p_display_name:data.get("displayName")});if(error){toast.error("Não foi possível concluir o onboarding.");setLoading(false);return;}}toast.success("Desafio criado. Sua jornada começou!");router.push("/app");}
  return <main className="min-h-screen bg-[#f7f6fb] p-5 md:p-8">
    <header className="mx-auto flex max-w-3xl items-center justify-between"><BrandMark/><span className="chip bg-[#eeeaff] text-[#6c4cff]">Passo {step} de 3</span></header>
    <div className="mx-auto mt-8 h-2 max-w-3xl overflow-hidden rounded-full bg-[#e3deef]"><div className="h-full rounded-full bg-[#6c4cff] transition-all" style={{width:`${step/3*100}%`}}/></div>
    <form className="card mx-auto mt-6 max-w-3xl p-6 md:p-10" onSubmit={(e)=>{e.preventDefault();if(step<3)setStep(step+1);else finish(e.currentTarget)}}>
      <section className={step===1?"":"hidden"}><span className="grid h-12 w-12 place-items-center rounded-xl bg-[#eeeaff] text-[#6c4cff]"><Target/></span><p className="eyebrow mt-6">Defina sua missão</p><h1 className="font-display mt-3 text-3xl font-black">O que você quer conquistar?</h1><p className="mt-2 text-[#716b86]">Uma meta clara deixa cada sessão mais significativa.</p><div className="mt-7"><label className="label" htmlFor="goal">Principal objetivo de estudo</label><textarea className="input min-h-28 resize-none" id="goal" name="goal" required maxLength={300} placeholder="Ex.: conquistar minha certificação de Power BI"/></div><div className="mt-5"><label className="label" htmlFor="subject">Assunto prioritário</label><select className="input" id="subject" name="subject" defaultValue="Power BI">{studyCategories.map(c=><option key={c}>{c}</option>)}</select></div></section>
      <section className={step===2?"":"hidden"}><span className="grid h-12 w-12 place-items-center rounded-xl bg-[#fff4d3] text-[#bb7400]"><Zap/></span><p className="eyebrow mt-6">Ajuste seu ritmo</p><h1 className="font-display mt-3 text-3xl font-black">Uma meta que cabe no seu dia.</h1><p className="mt-2 text-[#716b86]">Comece possível. Você sempre poderá ajustar depois.</p><div className="mt-7 grid gap-5 sm:grid-cols-2"><div><label className="label" htmlFor="minutes">Minutos por dia</label><input className="input" type="number" id="minutes" name="minutes" min={10} max={600} defaultValue={45} required/></div><div><label className="label" htmlFor="startDate">Início do desafio</label><input ref={startDateRef} className="input" type="date" id="startDate" name="startDate" required/></div></div><div className="mt-7 rounded-2xl bg-[#f3f0ff] p-5"><strong className="font-display">45 min × 100 dias = 75 horas</strong><p className="mt-1 text-sm text-[#716b86]">Tempo suficiente para sair do “um dia eu começo” e construir repertório de verdade.</p></div></section>
      <section className={step===3?"":"hidden"}><span className="grid h-12 w-12 place-items-center rounded-xl bg-[#e1f7ed] text-[#18885a]"><Check/></span><p className="eyebrow mt-6">Escolha como aparecer</p><h1 className="font-display mt-3 text-3xl font-black">Seu progresso, suas regras.</h1><p className="mt-2 text-[#716b86]">O ranking nunca mostra e-mail, objetivos ou detalhes das sessões.</p><div className="mt-7"><label className="label" htmlFor="displayName">Nome ou apelido</label><input className="input" id="displayName" name="displayName" maxLength={50} placeholder="Ezequiel"/></div><fieldset className="mt-5 space-y-2"><legend className="label">Visibilidade no ranking</legend>{[["first_name","Primeiro nome"],["nickname","Apelido"],["anonymous","Participante anônimo"],["hidden","Não participar"]].map(([value,label],i)=><label key={value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#ded9ee] p-3 font-bold"><input type="radio" name="visibility" value={value} defaultChecked={i===0} className="accent-[#6c4cff]"/>{label}</label>)}</fieldset></section>
      <footer className="mt-9 flex justify-between border-t border-[#e8e4f0] pt-6"><button type="button" className="btn-secondary" disabled={step===1} onClick={()=>setStep(step-1)}><ArrowLeft size={18}/>Voltar</button><button type="submit" className="btn-primary" disabled={loading}>{step<3?<>Continuar<ArrowRight size={18}/></>:<>{loading?"Criando...":"Começar jornada"}<Zap size={18}/></>}</button></footer>
    </form>
  </main>;
}
