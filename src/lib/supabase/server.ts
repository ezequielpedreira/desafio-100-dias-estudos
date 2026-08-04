import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseKey, supabaseUrl } from "./env";

export async function createClient(){
  if(!supabaseUrl||!supabaseKey) throw new Error("Supabase não configurado.");
  const store=await cookies();
  return createServerClient(supabaseUrl,supabaseKey,{
    cookies:{
      getAll(){return store.getAll();},
      setAll(items){
        try{items.forEach(({name,value,options})=>store.set(name,value,options));}
        catch{/* O Proxy atualiza cookies quando a chamada parte de um Server Component. */}
      },
    },
  });
}
