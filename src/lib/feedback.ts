import { z } from "zod";

export const feedbackCategories = {
  suggestion: "Sugestão",
  problem: "Problema",
  compliment: "Elogio",
  other: "Outro",
} as const;

export const feedbackSchema = z.object({
  requestId: z.uuid(),
  category: z.enum(["suggestion", "problem", "compliment", "other"]),
  message: z.string().trim().min(10).max(2000),
  rating: z.number().int().min(1).max(5).nullable(),
  source: z.string().trim().startsWith("/").max(200),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildFeedbackEmail(
  feedback: FeedbackInput,
  user: { name: string; email: string },
) {
  const category = feedbackCategories[feedback.category];
  const rating = feedback.rating ? `${feedback.rating}/5` : "Não informada";
  const text = [
    `Novo feedback: ${category}`,
    "",
    `Usuário: ${user.name}`,
    `E-mail: ${user.email}`,
    `Avaliação: ${rating}`,
    `Página: ${feedback.source}`,
    "",
    feedback.message,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#1d1930">
      <p style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6c4cff">LevelUp 100</p>
      <h1 style="font-size:24px;margin:8px 0 24px">Novo feedback: ${escapeHtml(category)}</h1>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr><td style="padding:8px;border-bottom:1px solid #ded9ee"><strong>Usuário</strong></td><td style="padding:8px;border-bottom:1px solid #ded9ee">${escapeHtml(user.name)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #ded9ee"><strong>E-mail</strong></td><td style="padding:8px;border-bottom:1px solid #ded9ee">${escapeHtml(user.email)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #ded9ee"><strong>Avaliação</strong></td><td style="padding:8px;border-bottom:1px solid #ded9ee">${escapeHtml(rating)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #ded9ee"><strong>Página</strong></td><td style="padding:8px;border-bottom:1px solid #ded9ee">${escapeHtml(feedback.source)}</td></tr>
      </table>
      <div style="padding:18px;border-radius:12px;background:#f3f0ff;white-space:pre-wrap">${escapeHtml(feedback.message)}</div>
    </div>`;

  return {
    subject: `[LevelUp 100] ${category}`,
    text,
    html,
  };
}
