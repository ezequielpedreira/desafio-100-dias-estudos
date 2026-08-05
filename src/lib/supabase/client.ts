import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

export function createClient(){
  if(!supabaseUrl||!supabaseKey) throw new Error("Supabase não configurado. Preencha as variáveis de ambiente.");
  return createBrowserClient(supabaseUrl,supabaseKey,{auth:{detectSessionInUrl:false,experimental:{appendPkceFlowIdToRedirects:true}}});
}
