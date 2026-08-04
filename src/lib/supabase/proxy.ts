import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseKey, supabaseUrl } from "./env";

export async function updateSession(request:NextRequest){
  if(!supabaseUrl||!supabaseKey) return NextResponse.next({request});
  let response=NextResponse.next({request});
  const supabase=createServerClient(supabaseUrl,supabaseKey,{cookies:{getAll(){return request.cookies.getAll();},setAll(items,headers){items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));Object.entries(headers).forEach(([key,value])=>response.headers.set(key,value));}}});
  const {data}=await supabase.auth.getClaims();
  const isProtected=request.nextUrl.pathname.startsWith("/app")||request.nextUrl.pathname.startsWith("/onboarding");
  if(isProtected&&!data?.claims){const url=request.nextUrl.clone();url.pathname="/login";url.searchParams.set("redirectTo",request.nextUrl.pathname);return NextResponse.redirect(url);}
  return response;
}
