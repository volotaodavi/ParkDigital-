"use client";

import { useState } from "react";
import {
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { REGEX_PLACA, formatarPlaca } from "@/lib/formatters";

type ResultadoConsulta = { status: "REGULAR"; tempoRestanteMinutos: number } | { status: "IRREGULAR" };

type EtapaInfracao = "oculto" | "formulario" | "enviando" | "enviado";

function calcularHash(texto: string): number {
  let hash = 0;
  for (let indice = 0; indice < texto.length; indice += 1) {
    hash = (hash * 31 + texto.charCodeAt(indice)) >>> 0;
  }
  return hash;
}

function consultarPlacaSimulado(placa: string): ResultadoConsulta {
  const hash = calcularHash(placa);

  if (hash % 2 === 0) {
    return { status: "REGULAR", tempoRestanteMinutos: (hash % 58) + 1 };
  }

  return { status: "IRREGULAR" };
}

export default function TelaFiscal() {
  const [placa, setPlaca] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  const [etapaInfracao, setEtapaInfracao] = useState<EtapaInfracao>("oculto");
  const [rua, setRua] = useState("");
  const [observacao, setObservacao] = useState("");
  const [nomeArquivoFoto, setNomeArquivoFoto] = useState<string | null>(null);

  const placaValida = REGEX_PLACA.test(placa);

  function consultarPlaca() {
    if (!placaValida) {
      return;
    }

    setConsultando(true);
    setResultado(null);
    setEtapaInfracao("oculto");

    // Simula a chamada ao backend (GET /api/v1/fiscal/placa/consultar/:placa)
    setTimeout(() => {
      setResultado(consultarPlacaSimulado(placa));
      setConsultando(false);
    }, 700);
  }

  function abrirFormularioInfracao() {
    setEtapaInfracao("formulario");
    setRua("");
    setObservacao("");
    setNomeArquivoFoto(null);
  }

  function enviarInfracao() {
    if (!rua.trim() || !nomeArquivoFoto) {
      return;
    }

    setEtapaInfracao("enviando");

    // Simula a chamada ao backend (POST /api/v1/fiscal/infracao/emitir)
    setTimeout(() => {
      setEtapaInfracao("enviado");
    }, 900);
  }

  function consultarOutraPlaca() {
    setPlaca("");
    setResultado(null);
    setEtapaInfracao("oculto");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <header className="flex items-center gap-3 rounded-2xl bg-blue-900 px-5 py-4 text-white shadow-sm">
          <div className="rounded-full bg-white/10 p-2">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-blue-100">ParkDigital · Fiscalização</p>
            <h1 className="text-lg font-semibold">Consulta de regularidade</h1>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label htmlFor="placa-fiscal" className="mb-1 block text-sm font-medium text-slate-700">
            Digitar ou escanear placa
          </label>
          <input
            id="placa-fiscal"
            type="text"
            inputMode="text"
            placeholder="ABC-1234"
            value={placa}
            onChange={(evento) => setPlaca(formatarPlaca(evento.target.value))}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg font-semibold tracking-wider text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
            maxLength={8}
          />
          <button
            type="button"
            onClick={consultarPlaca}
            disabled={!placaValida || consultando}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {consultando ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Consultando...
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                Consultar
              </>
            )}
          </button>
        </section>

        {resultado?.status === "REGULAR" && (
          <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-600 p-2 text-white">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-800">REGULAR</p>
                <p className="text-sm text-emerald-700">
                  {resultado.tempoRestanteMinutos} minutos restantes na vaga
                </p>
              </div>
            </div>
          </section>
        )}

        {resultado?.status === "IRREGULAR" && etapaInfracao === "oculto" && (
          <section className="rounded-2xl border border-red-300 bg-red-50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-red-600 p-2 text-white">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-bold text-red-800">IRREGULAR</p>
                <p className="text-sm text-red-700">Nenhuma vaga ativa encontrada para esta placa</p>
              </div>
            </div>
            <button
              type="button"
              onClick={abrirFormularioInfracao}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-red-800"
            >
              <ShieldAlert className="h-5 w-5" />
              Emitir Notificação de Infração
            </button>
          </section>
        )}

        {(etapaInfracao === "formulario" || etapaInfracao === "enviando") && (
          <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Registrar infração — {placa}</h2>

            <div>
              <label htmlFor="rua" className="mb-1 block text-sm font-medium text-slate-700">
                Rua / local da infração
              </label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="rua"
                  type="text"
                  placeholder="Ex: Av. Paulista, 1000"
                  value={rua}
                  onChange={(evento) => setRua(evento.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="foto" className="mb-1 block text-sm font-medium text-slate-700">
                Foto comprovante
              </label>
              <label
                htmlFor="foto"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 transition-colors hover:border-blue-700 hover:text-blue-700"
              >
                <Camera className="h-5 w-5 shrink-0" />
                {nomeArquivoFoto ?? "Toque para anexar uma foto"}
              </label>
              <input
                id="foto"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(evento) => setNomeArquivoFoto(evento.target.files?.[0]?.name ?? null)}
              />
            </div>

            <div>
              <label htmlFor="observacao" className="mb-1 block text-sm font-medium text-slate-700">
                Observação (opcional)
              </label>
              <textarea
                id="observacao"
                rows={2}
                value={observacao}
                onChange={(evento) => setObservacao(evento.target.value)}
                className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
                placeholder="Detalhes adicionais sobre a infração"
              />
            </div>

            <button
              type="button"
              onClick={enviarInfracao}
              disabled={!rua.trim() || !nomeArquivoFoto || etapaInfracao === "enviando"}
              className="flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {etapaInfracao === "enviando" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Enviando notificação...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Enviar alerta de multa
                </>
              )}
            </button>
          </section>
        )}

        {etapaInfracao === "enviado" && (
          <section className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <p className="font-semibold text-slate-900">Infração registrada com sucesso</p>
            <p className="text-sm text-slate-500">A notificação da placa {placa} foi enviada para emissão.</p>
            <button
              type="button"
              onClick={consultarOutraPlaca}
              className="mt-2 text-sm font-medium text-blue-900 underline-offset-2 hover:underline"
            >
              Consultar outra placa
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
