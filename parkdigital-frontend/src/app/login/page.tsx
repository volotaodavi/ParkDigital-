"use client";

import { Suspense, useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, LogIn, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

function AvisoSessaoExpirada() {
  const parametros = useSearchParams();

  if (parametros.get("motivo") !== "sessao_expirada") {
    return null;
  }

  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>Sua sessão expirou. Faça login novamente.</span>
    </div>
  );
}

export default function PaginaLogin() {
  const { login } = useAuth();
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      await login(identificador, senha);
    } catch (erroLogin) {
      setErro(erroLogin instanceof Error ? erroLogin.message : "Não foi possível fazer login.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">ParkDigital</h1>
          <p className="mt-1 text-sm text-slate-500">Acesso de fiscais, gestores e administradores</p>
        </div>

        <Suspense fallback={null}>
          <AvisoSessaoExpirada />
        </Suspense>

        <form onSubmit={aoEnviar} className="flex flex-col gap-4">
          {erro && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <div>
            <label htmlFor="identificador" className="mb-1 block text-sm font-medium text-slate-700">
              Identificador (CPF ou matrícula)
            </label>
            <input
              id="identificador"
              type="text"
              value={identificador}
              onChange={(evento) => setIdentificador(evento.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label htmlFor="senha" className="mb-1 block text-sm font-medium text-slate-700">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(evento) => setSenha(evento.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {carregando ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Entrando...
              </>
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                Entrar
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
