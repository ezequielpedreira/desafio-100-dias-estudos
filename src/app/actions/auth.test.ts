import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, signInWithPasswordMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({ hasSupabaseEnv: true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { login } from "./auth";

function loginForm() {
  const formData = new FormData();
  formData.set("email", "usuario@example.com");
  formData.set("password", "senha-incorreta");
  formData.set("redirectTo", "/app");
  return formData;
}

describe("login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    createClientMock.mockResolvedValue({
      auth: { signInWithPassword: signInWithPasswordMock },
    });
  });

  it("returns the same controlled warning on consecutive invalid attempts", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { code: "invalid_credentials", status: 400 },
    });

    const firstAttempt = await login(undefined, loginForm());
    const secondAttempt = await login(firstAttempt, loginForm());

    expect(firstAttempt).toEqual({
      kind: "error",
      message: "E-mail ou senha incorretos. Verifique os dados digitados e tente novamente.",
    });
    expect(secondAttempt).toEqual(firstAttempt);
    expect(signInWithPasswordMock).toHaveBeenCalledTimes(2);
  });

  it("keeps an unexpected service failure inside the form", async () => {
    signInWithPasswordMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(login(undefined, loginForm())).resolves.toEqual({
      kind: "error",
      message: "Não foi possível verificar seu acesso agora. Confira sua conexão e tente novamente.",
    });
  });
});
