import { buildFeedbackEmail, feedbackSchema } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_SUBMISSIONS = 3;
const recentSubmissions = new Map<string, number[]>();

function isRateLimited(userId: string) {
  const now = Date.now();
  const recent = (recentSubmissions.get(userId) ?? []).filter(
    (timestamp) => now - timestamp < WINDOW_MS,
  );
  recentSubmissions.set(userId, recent);
  return recent.length >= MAX_SUBMISSIONS;
}

function recordSubmission(userId: string) {
  recentSubmissions.set(userId, [
    ...(recentSubmissions.get(userId) ?? []),
    Date.now(),
  ]);
}

function json(message: string, status: number) {
  return Response.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 8_000) {
    return json("O feedback ultrapassou o tamanho permitido.", 413);
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json("Origem da solicitação não permitida.", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json("Não foi possível ler o feedback enviado.", 400);
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return json("Revise a categoria, a avaliação e a mensagem do feedback.", 422);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email) {
      return json("Entre novamente para enviar seu feedback.", 401);
    }

    if (isRateLimited(data.user.id)) {
      return json("Você já enviou alguns feedbacks. Aguarde alguns minutos para enviar outro.", 429);
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const to = process.env.FEEDBACK_TO_EMAIL?.trim();
    const from = process.env.RESEND_FROM_EMAIL?.trim() || "LevelUp 100 <onboarding@resend.dev>";
    if (!apiKey || !to) {
      console.error("Serviço de feedback não configurado.", {
        hasApiKey: Boolean(apiKey),
        hasRecipient: Boolean(to),
      });
      return json("O canal de feedback está temporariamente indisponível.", 503);
    }

    const name =
      String(data.user.user_metadata?.full_name ?? data.user.email.split("@")[0]).trim() ||
      "Participante";
    const email = buildFeedbackEmail(parsed.data, { name, email: data.user.email });
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: data.user.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
        tags: [{ name: "category", value: parsed.data.category }],
      }),
      cache: "no-store",
    });

    if (!resendResponse.ok) {
      console.error("Falha no envio de feedback pelo Resend.", {
        status: resendResponse.status,
      });
      return json("Não foi possível enviar agora. Tente novamente em alguns instantes.", 502);
    }

    recordSubmission(data.user.id);
    return json("Feedback enviado. Obrigado por ajudar a melhorar a jornada!", 200);
  } catch (error) {
    console.error("Falha inesperada no envio de feedback.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return json("Não foi possível enviar agora. Tente novamente em alguns instantes.", 500);
  }
}
