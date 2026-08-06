import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { POST } from "./route";

const requestIds = {
  success: "10000000-0000-4000-8000-000000000001",
  emailFailure: "10000000-0000-4000-8000-000000000002",
  duplicate: "10000000-0000-4000-8000-000000000003",
  storageFailure: "10000000-0000-4000-8000-000000000004",
  missingEmailConfig: "10000000-0000-4000-8000-000000000005",
} as const;

function buildRequest(requestId: string) {
  return new Request("http://localhost:3000/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      requestId,
      category: "problem",
      message: "O envio de feedback precisa ser persistido com segurança.",
      rating: 4,
      source: "/app",
    }),
  });
}

function authenticate(userId: string) {
  mocks.getUser.mockResolvedValue({
    data: {
      user: {
        id: userId,
        email: "pessoa@example.com",
        user_metadata: { full_name: "Pessoa Teste" },
      },
    },
    error: null,
  });
}

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("FEEDBACK_TO_EMAIL", "owner@example.com");
    vi.stubEnv("RESEND_FROM_EMAIL", "LevelUp 100 <feedback@example.com>");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: vi.fn().mockReturnValue({ insert: mocks.insert }),
    });
    mocks.insert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    mocks.createClient.mockReset();
    mocks.getUser.mockReset();
    mocks.insert.mockReset();
  });

  it("stores the authenticated user's feedback before sending the email", async () => {
    authenticate("20000000-0000-4000-8000-000000000001");
    const resend = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", resend);

    const response = await POST(buildRequest(requestIds.success));

    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "20000000-0000-4000-8000-000000000001",
      request_id: requestIds.success,
      category: "problem",
      message: "O envio de feedback precisa ser persistido com segurança.",
      rating: 4,
      source: "/app",
    });
    expect(mocks.insert.mock.invocationCallOrder[0]).toBeLessThan(
      resend.mock.invocationCallOrder[0],
    );
    expect(resend).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key":
            "feedback/20000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001",
        }),
      }),
    );
  });

  it("keeps the stored feedback when Resend is unavailable", async () => {
    authenticate("20000000-0000-4000-8000-000000000002");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );

    const response = await POST(buildRequest(requestIds.emailFailure));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: "Feedback salvo, mas não foi possível enviar o aviso por e-mail agora.",
    });
    expect(mocks.insert).toHaveBeenCalledOnce();
  });

  it("treats a repeated request as idempotent", async () => {
    authenticate("20000000-0000-4000-8000-000000000003");
    mocks.insert.mockResolvedValue({ error: { code: "23505" } });
    const resend = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", resend);

    const response = await POST(buildRequest(requestIds.duplicate));

    expect(response.status).toBe(200);
    expect(resend).toHaveBeenCalledOnce();
  });

  it("does not send email when storage fails", async () => {
    authenticate("20000000-0000-4000-8000-000000000004");
    mocks.insert.mockResolvedValue({ error: { code: "42501" } });
    const resend = vi.fn();
    vi.stubGlobal("fetch", resend);

    const response = await POST(buildRequest(requestIds.storageFailure));

    expect(response.status).toBe(503);
    expect(resend).not.toHaveBeenCalled();
  });

  it("confirms storage when the email integration is not configured", async () => {
    authenticate("20000000-0000-4000-8000-000000000005");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("FEEDBACK_TO_EMAIL", "");

    const response = await POST(buildRequest(requestIds.missingEmailConfig));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      message: "Feedback salvo. O aviso por e-mail está temporariamente indisponível.",
    });
    expect(mocks.insert).toHaveBeenCalledOnce();
  });
});
