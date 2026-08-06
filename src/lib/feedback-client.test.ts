import { describe, expect, it, vi } from "vitest";
import { sendFeedbackRequest } from "./feedback-client";

const payload = {
  category: "problem" as const,
  message: "O formulário precisa continuar aberto quando o envio falhar.",
  rating: 3,
  source: "/app",
};

describe("sendFeedbackRequest", () => {
  it("returns a controlled success result", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({ message: "Feedback enviado com sucesso." }, { status: 200 }),
    );

    await expect(sendFeedbackRequest(payload, fetcher)).resolves.toEqual({
      ok: true,
      message: "Feedback enviado com sucesso.",
    });
  });

  it("does not expose invalid API response values to React", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({ message: { internal: "unexpected" } }, { status: 502 }),
    );

    await expect(sendFeedbackRequest(payload, fetcher)).resolves.toEqual({
      ok: false,
      message: "Não foi possível concluir o envio.",
    });
  });

  it("keeps network failures inside the feedback modal", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    await expect(sendFeedbackRequest(payload, fetcher)).resolves.toEqual({
      ok: false,
      message: "Sem conexão com o serviço de feedback. Verifique sua internet e tente novamente.",
    });
  });
});
