"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { API_BASE_URL } from "@/lib/api";
import { CAMINHO_POR_ROLE, PapelUsuario } from "@/lib/auth";

interface RequireAuthProps {
  allowedRoles: PapelUsuario[];
  children: React.ReactNode;
}

/**
 * Bloqueia a renderização da página até confirmar, contra o backend (não só
 * localmente), que a sessão é válida e o papel do usuário está entre os
 * permitidos. Sem sessão -> /login. Papel errado -> home do próprio papel.
 * Sessão inválida/expirada -> /login com aviso.
 */
export function RequireAuth({ allowedRoles, children }: RequireAuthProps) {
  const { sessao, carregando } = useAuth();
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    if (carregando) {
      return;
    }

    if (!sessao) {
      router.replace("/login");
      return;
    }

    if (!allowedRoles.includes(sessao.usuario.role)) {
      router.replace(CAMINHO_POR_ROLE[sessao.usuario.role]);
      return;
    }

    let ativo = true;

    fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${sessao.token}` },
    })
      .then((resposta) => {
        if (!ativo) {
          return;
        }

        if (!resposta.ok) {
          router.replace("/login?motivo=sessao_expirada");
          return;
        }

        setAutorizado(true);
      })
      .catch(() => {
        if (ativo) {
          router.replace("/login?motivo=sessao_expirada");
        }
      });

    return () => {
      ativo = false;
    };
  }, [sessao, carregando, allowedRoles, router]);

  if (!autorizado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-900" />
      </div>
    );
  }

  return <>{children}</>;
}
