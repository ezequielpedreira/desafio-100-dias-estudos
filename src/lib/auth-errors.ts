type AuthErrorLike = {
  code?: string;
  status?: number;
};

function asAuthError(error: unknown): AuthErrorLike {
  return typeof error === "object" && error !== null ? error : {};
}

export function getLoginErrorMessage(error: unknown) {
  const { code, status } = asAuthError(error);

  if (code === "invalid_credentials") {
    return "E-mail ou senha incorretos. Verifique os dados digitados e tente novamente.";
  }

  if (code === "email_not_confirmed") {
    return "Seu e-mail ainda não foi confirmado. Confira sua caixa de entrada antes de entrar.";
  }

  if (code === "captcha_failed") {
    return "Não foi possível validar a verificação de segurança. Atualize a página e tente novamente.";
  }

  if (status === 429 || code === "over_request_rate_limit") {
    return "Muitas tentativas de entrada em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }

  if (status && status >= 500) {
    return "O serviço de autenticação está temporariamente indisponível. Tente novamente em alguns instantes.";
  }

  return "Não foi possível verificar seu acesso agora. Confira sua conexão e tente novamente.";
}
