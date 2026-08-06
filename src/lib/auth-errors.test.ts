import { describe, expect, it } from "vitest";
import { getLoginErrorMessage } from "./auth-errors";

describe("getLoginErrorMessage", () => {
  it("explains invalid credentials without confirming whether the account exists", () => {
    expect(getLoginErrorMessage({ code: "invalid_credentials", status: 400 })).toBe(
      "E-mail ou senha incorretos. Verifique os dados digitados e tente novamente.",
    );
  });

  it("explains when the e-mail has not been confirmed", () => {
    expect(getLoginErrorMessage({ code: "email_not_confirmed", status: 400 })).toContain(
      "ainda não foi confirmado",
    );
  });

  it("handles rate limiting explicitly", () => {
    expect(getLoginErrorMessage({ status: 429 })).toContain("Muitas tentativas");
  });

  it("keeps unexpected failures inside the login form", () => {
    expect(getLoginErrorMessage(new TypeError("fetch failed"))).toContain(
      "Confira sua conexão",
    );
  });
});
