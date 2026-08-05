import { describe, expect, it } from "vitest";
import { getCheckinButtonState, isIdempotentCheckinResponse } from "./checkin";

describe("estado do check-in diário", () => {
  it("permite o primeiro check-in do dia", () => expect(getCheckinButtonState({ checkedIn: false })).toEqual({ label: "Fazer check-in", disabled: false }));
  it("bloqueia a segunda tentativa no mesmo dia", () => expect(getCheckinButtonState({ checkedIn: true }).disabled).toBe(true));
  it("continua bloqueado após recarregar com o estado retornado pelo servidor", () => expect(getCheckinButtonState({ checkedIn: true }).label).toBe("Check-in concluído"));
  it("usa o estado do backend recebido em outro dispositivo", () => expect(getCheckinButtonState({ checkedIn: true }).disabled).toBe(true));
  it("bloqueia duplo clique durante o processamento", () => expect(getCheckinButtonState({ checkedIn: false, pending: true })).toEqual({ label: "Registrando...", disabled: true }));
  it("libera novamente quando o servidor informa um novo dia", () => expect(getCheckinButtonState({ checkedIn: false }).disabled).toBe(false));
  it("reconhece uma resposta duplicada controlada", () => expect(isIdempotentCheckinResponse({ created: false, already_checked_in: true })).toBe(true));
});
