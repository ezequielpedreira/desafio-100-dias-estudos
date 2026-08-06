import { buildFeedbackEmail, feedbackSchema } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_SUBMISSIONS = 3;
const recentSubmissions = new Map<string, Map<string, number>>();

function isRateLimited(userId: string, requestId: string) {
  const now = Date.now();
  const recent = new Map(
    [...(recentSubmissions.get(userId) ?? new Map())].filter(
      ([, timestamp]) => now - timestamp < WINDOW_MS,
    ),
  );
  recentSubmissions.set(userId, recent);
  return !recent.has(requestId) && recent.size >= MAX_SUBMISSIONS;
}

function recordSubmission(userId: string, requestId: string) {
  const recent = recentSubmissions.get(userId) ?? new Map<string, number>();
  recent.set(requestId, Date.now());
  recentSubmissions.set(userId, recent);
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

    if (isRateLimited(data.user.id, parsed.data.requestId)) {
      return json("Você já enviou alguns feedbacks. Aguarde alguns minutos para enviar outro.", 429);
    }

    const { error: storageError } = await supabase.from("feedback_submissions").insert({
      user_id: data.user.id,
      request_id: parsed.data.requestId,
      category: parsed.data.category,
      message: parsed.data.message,
      rating: parsed.data.rating,
      source: parsed.data.source,
    });
    const isDuplicate = storageError?.code === "23505";
    if (storageError && !isDuplicate) {
      console.error("Falha ao armazenar feedback no Supabase.", {
        code: storageError.code,
      });
      return json("Não foi possível salvar seu feedback agora. Tente novamente.", 503);
    }
    if (!isDuplicate) recordSubmission(data.user.id, parsed.data.requestId);

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const to = process.env.FEEDBACK_TO_EMAIL?.trim();
    const from = process.env.RESEND_FROM_EMAIL?.trim() || "LevelUp 100 <onboarding@resend.dev>";
    if (!apiKey || !to) {
      console.error("Serviço de feedback não configurado.", {
        hasApiKey: Boolean(apiKey),
        hasRecipient: Boolean(to),
      });
      return json("Feedback salvo. O aviso por e-mail está temporariamente indisponível.", 202);
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
        "Idempotency-Key": `feedback/${data.user.id}/${parsed.data.requestId}`,
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
      return json("Feedback salvo, mas não foi possível enviar o aviso por e-mail agora.", 502);
    }

    return json("Feedback salvo e enviado. Obrigado por ajudar a melhorar a jornada!", 200);
  } catch (error) {
    console.error("Falha inesperada no envio de feedback.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return json("Não foi possível enviar agora. Tente novamente em alguns instantes.", 500);
  }
}
