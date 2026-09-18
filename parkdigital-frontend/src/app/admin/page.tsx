"use client";

import { Construction, LogOut } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/AuthContext";

export default function PaginaAdministrador() {
  return (
    <RequireAuth allowedRoles={["ADMINISTRADOR"]}>
      <ConteudoAdministrador />
    </RequireAuth>
  );
}

function ConteudoAdministrador() {
  const { sessao, logout } = useAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
      <Construction className="h-12 w-12 text-slate-400" />
      <div>
        <h1 className="text-xl font-bold text-slate-900">Painel do Administrador</h1>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Olá, {sessao?.usuario.nome}. A administração da plataforma (municípios, faturamento, gestão de
          usuários) ainda está em construção.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void logout()}
        className="flex items-center gap-2 text-sm font-medium text-blue-900 underline-offset-2 hover:underline"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </main>
  );
}
