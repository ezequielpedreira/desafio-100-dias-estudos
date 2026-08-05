export type CheckinButtonInput = {
  checkedIn: boolean;
  recovering?: boolean;
  pending?: boolean;
  serviceError?: boolean;
};

export function getCheckinButtonState(input: CheckinButtonInput) {
  if (input.pending) return { label: "Registrando...", disabled: true } as const;
  if (input.recovering) return { label: "Carregando...", disabled: true } as const;
  if (input.checkedIn) return { label: "Check-in concluído", disabled: true } as const;
  if (input.serviceError) return { label: "Fazer check-in", disabled: true } as const;
  return { label: "Fazer check-in", disabled: false } as const;
}

export function isIdempotentCheckinResponse(value: { created: boolean; already_checked_in: boolean }) {
  return !value.created && value.already_checked_in;
}
