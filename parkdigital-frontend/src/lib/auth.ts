const CHAVE_TOKEN = "parkdigital_token";

// Lê o JWT salvo por uma futura tela de login (ainda não implementada).
// Sem token, rotas protegidas do backend (ex: emissão de infração) respondem 401.
export function obterTokenArmazenado(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
}
