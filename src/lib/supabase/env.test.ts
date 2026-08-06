import { describe, expect, it } from "vitest";
import { isValidSupabaseConfig } from "./env";

describe("isValidSupabaseConfig", () => {
  it("accepts a Supabase project URL with a publishable key", () => {
    expect(
      isValidSupabaseConfig(
        "https://example-project.supabase.co",
        "sb_publishable_example123",
      ),
    ).toBe(true);
  });

  it("accepts local Supabase with a legacy anon JWT", () => {
    expect(
      isValidSupabaseConfig(
        "http://127.0.0.1:54321",
        "eyJheader.eyJpayload.signature",
      ),
    ).toBe(true);
  });

  it("rejects the placeholder accidentally used in a deployment", () => {
    expect(
      isValidSupabaseConfig(
        "https://example-project.supabase.co",
        "COLE_A_CHAVE_PUBLICA_DO_SUPABASE",
      ),
    ).toBe(false);
  });

  it("rejects URLs outside Supabase", () => {
    expect(
      isValidSupabaseConfig(
        "https://example.com",
        "sb_publishable_example123",
      ),
    ).toBe(false);
  });
});
