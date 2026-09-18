import { API_BASE_URL } from "./api";
import { limparSessao, obterSessao } from "./auth";

/** Lançado quando o backend responde 401: a sessão local já foi limpa. */
export class SessaoInvalidaError extends Error {
  constructor() {
    super("Sessão expirada ou inválida.");
    this.name = "SessaoInvalidaError";
  }
}

/**
 * Wrapper de `fetch` que anexa automaticamente o token da sessão atual e
 * trata uma resposta 401 limpando a sessão local (o chamador decide o que
 * fazer a seguir — normalmente redirecionar para /login).
 */
export async function fetchAutenticado(caminho: string, opcoes: RequestInit = {}): Promise<Response> {
  const sessao = obterSessao();

  const resposta = await fetch(`${API_BASE_URL}${caminho}`, {
    ...opcoes,
    headers: {
      ...(opcoes.headers ?? {}),
      ...(sessao ? { Authorization: `Bearer ${sessao.token}` } : {}),
    },
  });

  if (resposta.status === 401) {
    limparSessao();
    throw new SessaoInvalidaError();
  }

  return resposta;
}
