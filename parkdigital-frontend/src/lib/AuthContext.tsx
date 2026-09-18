"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "./api";
import { CAMINHO_POR_ROLE, SessaoUsuario, limparSessao, obterSessao, salvarSessao } from "./auth";

// Renovação silenciosa em segundo plano, para quem está no meio de um turno
// de trabalho não ser deslogado no meio de uma consulta em campo.
const INTERVALO_RENOVACAO_MS = 30 * 60 * 1000;

interface AuthContextValue {
  sessao: SessaoUsuario | null;
  carregando: boolean;
  login: (identificador: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sessao, setSessao] = useState<SessaoUsuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setSessao(obterSessao());
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (!sessao) {
      return;
    }

    const intervalo = setInterval(async () => {
      try {
        const resposta = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { Authorization: `Bearer ${sessao.token}` },
        });

        if (!resposta.ok) {
          limparSessao();
          setSessao(null);
          return;
        }

        const dados = await resposta.json();
        const novaSessao: SessaoUsuario = { token: dados.token, usuario: dados.usuario };
        salvarSessao(novaSessao);
        setSessao(novaSessao);
      } catch (erro) {
        console.error("[auth] Erro ao renovar sessão automaticamente:", erro);
      }
    }, INTERVALO_RENOVACAO_MS);

    return () => clearInterval(intervalo);
  }, [sessao]);

  const login = useCallback(
    async (identificador: string, senha: string) => {
      const resposta = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identificador, senha }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados?.mensagem ?? "Não foi possível fazer login.");
      }

      const novaSessao: SessaoUsuario = { token: dados.token, usuario: dados.usuario };
      salvarSessao(novaSessao);
      setSessao(novaSessao);
      router.push(CAMINHO_POR_ROLE[novaSessao.usuario.role]);
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      if (sessao) {
        await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${sessao.token}` },
        });
      }
    } catch (erro) {
      console.error("[auth] Erro ao registrar logout no servidor:", erro);
    } finally {
      limparSessao();
      setSessao(null);
      router.push("/login");
    }
  }, [sessao, router]);

  const valor = useMemo(
    () => ({ sessao, carregando, login, logout }),
    [sessao, carregando, login, logout],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);

  if (!contexto) {
    throw new Error("useAuth precisa ser usado dentro de um <AuthProvider>.");
  }

  return contexto;
}
