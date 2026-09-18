export type PapelUsuario = "MOTORISTA" | "FISCAL" | "GESTOR_PUBLICO" | "ADMINISTRADOR";

export interface UsuarioSessao {
  id: string;
  nome: string;
  role: PapelUsuario;
}

export interface SessaoUsuario {
  token: string;
  usuario: UsuarioSessao;
}

export const CAMINHO_POR_ROLE: Record<PapelUsuario, string> = {
  MOTORISTA: "/motorista",
  FISCAL: "/fiscal",
  GESTOR_PUBLICO: "/governo",
  ADMINISTRADOR: "/admin",
};

const CHAVE_SESSAO = "parkdigital_sessao";

// A sessão fica em localStorage (não em cookie httpOnly) porque o frontend
// (Vercel) e o backend (Render) vivem em domínios diferentes: cookies
// cross-site exigiriam SameSite=None e ainda assim navegadores modernos
// bloqueiam cookies de terceiros com frequência crescente. Mitigação: o
// token expira em poucas horas (JWT_EXPIRES_IN) e é possível revogar a
// sessão no próximo login trocando o segredo, se necessário.
export function salvarSessao(sessao: SessaoUsuario): void {
  try {
    window.localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  } catch {
    // localStorage indisponível (modo privado, cota excedida etc.) — a
    // sessão simplesmente não persistirá entre recarregamentos de página.
  }
}

export function obterSessao(): SessaoUsuario | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const bruto = window.localStorage.getItem(CHAVE_SESSAO);
    return bruto ? (JSON.parse(bruto) as SessaoUsuario) : null;
  } catch {
    return null;
  }
}

export function limparSessao(): void {
  try {
    window.localStorage.removeItem(CHAVE_SESSAO);
  } catch {
    // ignorar
  }
}

/** @deprecated use obterSessao()?.token — mantido para compatibilidade. */
export function obterTokenArmazenado(): string | null {
  return obterSessao()?.token ?? null;
}
