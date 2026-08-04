import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export async function GET(request:Request){
  const url=new URL(request.url);const code=url.searchParams.get("code");let next=url.searchParams.get("next")??"/app";
  if(!next.startsWith("/")||next.startsWith("//"))next="/app";
  if(code&&hasSupabaseEnv){
    const supabase=await createClient();const{error}=await supabase.auth.exchangeCodeForSession(code);
    if(!error){const forwardedHost=request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();const destination=process.env.NODE_ENV==="development"||!forwardedHost?`${url.origin}${next}`:`https://${forwardedHost}${next}`;return NextResponse.redirect(destination);}
  }
  return NextResponse.redirect(new URL("/login?mode=signup&oauth=error",url.origin));
}
