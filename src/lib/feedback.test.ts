import { describe, expect, it } from "vitest";
import { buildFeedbackEmail, feedbackSchema } from "./feedback";

describe("feedback", () => {
  const validFeedback = {
    category: "suggestion" as const,
    message: "Gostei muito e tenho uma sugestão para a jornada.",
    rating: 5,
    source: "/app/jornada",
  };

  it("validates a complete feedback payload", () => {
    expect(feedbackSchema.safeParse(validFeedback).success).toBe(true);
  });

  it("rejects short messages and external source URLs", () => {
    expect(feedbackSchema.safeParse({ ...validFeedback, message: "curto" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...validFeedback, source: "https://example.com" }).success).toBe(false);
  });

  it("escapes user content in the HTML email", () => {
    const email = buildFeedbackEmail(
      { ...validFeedback, message: "<script>alert('xss')</script> ótimo app" },
      { name: "<Admin>", email: "user@example.com" },
    );

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&lt;Admin&gt;");
    expect(email.text).toContain("user@example.com");
  });
});
