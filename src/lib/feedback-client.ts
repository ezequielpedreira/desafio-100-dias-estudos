import type { FeedbackInput } from "./feedback";

type FeedbackResult = {
  ok: boolean;
  message: string;
};

const FALLBACK_MESSAGE = "Não foi possível concluir o envio.";
const CONNECTION_MESSAGE =
  "Sem conexão com o serviço de feedback. Verifique sua internet e tente novamente.";

export async function sendFeedbackRequest(
  payload: FeedbackInput,
  fetcher: typeof fetch = fetch,
): Promise<FeedbackResult> {
  try {
    const response = await fetcher("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => null)) as unknown;
    const message =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string" &&
      body.message.trim()
        ? body.message
        : FALLBACK_MESSAGE;

    return { ok: response.ok, message };
  } catch {
    return { ok: false, message: CONNECTION_MESSAGE };
  }
}
