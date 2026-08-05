import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

function safePath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

function redirectOrigin(request: Request, requestUrl: URL) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();

  if (process.env.NODE_ENV === "development" || !forwardedHost) return requestUrl.origin;
  return `${forwardedProtocol === "http" ? "http" : "https"}://${forwardedHost}`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const flowId = requestUrl.searchParams.get("sb_flow_id");
  const next = safePath(requestUrl.searchParams.get("next"));
  const origin = redirectOrigin(request, requestUrl);

  if (code && hasSupabaseEnv) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );

    if (!error) {
      return NextResponse.redirect(new URL(next, origin), {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    console.error("Falha ao concluir o OAuth:", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
  }

  const errorUrl = new URL("/login", origin);
  errorUrl.searchParams.set("mode", "signup");
  errorUrl.searchParams.set("oauth", "error");
  return NextResponse.redirect(errorUrl, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
