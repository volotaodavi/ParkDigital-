"use client";

import { useEffect, useState } from "react";
import { Car, Check, Clock, Copy, Loader2, QrCode } from "lucide-react";
import { REGEX_PLACA, formatarCpf, formatarPlaca } from "@/lib/formatters";

type Etapa = "formulario" | "processando" | "aguardando_pagamento";

interface OpcaoTempo {
  minutos: number;
  valor: number;
  label: string;
}

const OPCOES_TEMPO: OpcaoTempo[] = [
  { minutos: 60, valor: 4.0, label: "60 minutos — R$ 4,00" },
  { minutos: 120, valor: 8.0, label: "120 minutos — R$ 8,00" },
];

const DURACAO_ESPERA_PAGAMENTO_SEGUNDOS = 10 * 60;

function gerarCodigoPixSimulado(valor: number): string {
  const identificador = Math.random().toString(36).slice(2, 10).toUpperCase();
  const valorFormatado = valor.toFixed(2);

  return (
    "00020126580014BR.GOV.BCB.PIX0136parkdigital@municipio.gov.br" +
    "5204000053039865" +
    `54${valorFormatado.length.toString().padStart(2, "0")}${valorFormatado}` +
    "5802BR5913PARKDIGITAL6009SAOPAULO" +
    `62070503${identificador}` +
    "6304FFFF"
  );
}

function formatarTempo(segundosTotais: number): string {
  const minutos = Math.floor(segundosTotais / 60);
  const segundos = segundosTotais % 60;
  return `${minutos.toString().padStart(2, "0")}:${segundos.toString().padStart(2, "0")}`;
}

export default function TelaMotorista() {
  const [placa, setPlaca] = useState("");
  const [cpf, setCpf] = useState("");
  const [minutosSelecionados, setMinutosSelecionados] = useState(OPCOES_TEMPO[0].minutos);
  const [etapa, setEtapa] = useState<Etapa>("formulario");
  const [codigoPix, setCodigoPix] = useState("");
  const [codigoCopiado, setCodigoCopiado] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(DURACAO_ESPERA_PAGAMENTO_SEGUNDOS);

  const opcaoSelecionada =
    OPCOES_TEMPO.find((opcao) => opcao.minutos === minutosSelecionados) ?? OPCOES_TEMPO[0];

  const placaValida = REGEX_PLACA.test(placa);
  const cpfValido = cpf.replace(/\D/g, "").length === 11;
  const formularioValido = placaValida && cpfValido;

  useEffect(() => {
    if (etapa !== "aguardando_pagamento" || segundosRestantes <= 0) {
      return;
    }

    const intervalo = setInterval(() => {
      setSegundosRestantes((atual) => Math.max(atual - 1, 0));
    }, 1000);

    return () => clearInterval(intervalo);
  }, [etapa, segundosRestantes]);

  function ativarVaga() {
    if (!formularioValido) {
      return;
    }

    setEtapa("processando");

    // Simula a chamada ao backend (POST /api/v1/motorista/vaga/ativar)
    setTimeout(() => {
      setCodigoPix(gerarCodigoPixSimulado(opcaoSelecionada.valor));
      setSegundosRestantes(DURACAO_ESPERA_PAGAMENTO_SEGUNDOS);
      setEtapa("aguardando_pagamento");
    }, 900);
  }

  async function copiarCodigoPix() {
    try {
      await navigator.clipboard.writeText(codigoPix);
      setCodigoCopiado(true);
      setTimeout(() => setCodigoCopiado(false), 2000);
    } catch (erro) {
      console.error("Não foi possível copiar o código Pix:", erro);
    }
  }

  function novaAtivacao() {
    setEtapa("formulario");
    setPlaca("");
    setCpf("");
    setCodigoPix("");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <header className="flex items-center gap-3 rounded-2xl bg-blue-900 px-5 py-4 text-white shadow-sm">
          <div className="rounded-full bg-white/10 p-2">
            <Car className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-blue-100">ParkDigital · Zona Azul</p>
            <h1 className="text-lg font-semibold">Ativar vaga de estacionamento</h1>
          </div>
        </header>

        {etapa !== "aguardando_pagamento" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="placa" className="mb-1 block text-sm font-medium text-slate-700">
                  Placa do veículo
                </label>
                <input
                  id="placa"
                  type="text"
                  inputMode="text"
                  placeholder="ABC-1234"
                  value={placa}
                  onChange={(evento) => setPlaca(formatarPlaca(evento.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg font-semibold tracking-wider text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
                  maxLength={8}
                />
              </div>

              <div>
                <label htmlFor="cpf" className="mb-1 block text-sm font-medium text-slate-700">
                  CPF do motorista
                </label>
                <input
                  id="cpf"
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(evento) => setCpf(formatarCpf(evento.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
                  maxLength={14}
                />
              </div>

              <div>
                <label htmlFor="tempo" className="mb-1 block text-sm font-medium text-slate-700">
                  Tempo de permanência
                </label>
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <select
                    id="tempo"
                    value={minutosSelecionados}
                    onChange={(evento) => setMinutosSelecionados(Number(evento.target.value))}
                    className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-4 text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
                  >
                    {OPCOES_TEMPO.map((opcao) => (
                      <option key={opcao.minutos} value={opcao.minutos}>
                        {opcao.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={ativarVaga}
                disabled={!formularioValido || etapa === "processando"}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {etapa === "processando" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Gerando cobrança...
                  </>
                ) : (
                  "Ativar Vaga com Pix"
                )}
              </button>

              {!formularioValido && (placa.length > 0 || cpf.length > 0) && (
                <p className="text-center text-sm text-slate-500">
                  Preencha a placa (ABC-1234) e o CPF completo para continuar.
                </p>
              )}
            </div>
          </section>
        )}

        {etapa === "aguardando_pagamento" && (
          <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-center">
              <p className="text-sm font-medium text-slate-500">Vaga reservada para</p>
              <p className="text-2xl font-bold tracking-wide text-slate-900">{placa}</p>
              <p className="text-sm text-slate-500">
                {opcaoSelecionada.minutos} minutos · R$ {opcaoSelecionada.valor.toFixed(2).replace(".", ",")}
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="flex h-40 w-40 items-center justify-center rounded-2xl bg-slate-200">
                <QrCode className="h-16 w-16 text-slate-500" strokeWidth={1.25} />
              </div>
              <p className="text-xs text-slate-400">QR Code simulado — escaneie no app do seu banco</p>
            </div>

            <div>
              <label htmlFor="pix-copia-cola" className="mb-1 block text-sm font-medium text-slate-700">
                Pix Copia e Cola
              </label>
              <div className="flex items-stretch gap-2">
                <input
                  id="pix-copia-cola"
                  type="text"
                  readOnly
                  value={codigoPix}
                  className="w-full truncate rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-600"
                />
                <button
                  type="button"
                  onClick={copiarCodigoPix}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-900 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800"
                >
                  {codigoCopiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {codigoCopiado ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1 rounded-xl bg-slate-900 px-4 py-4 text-white">
              <p className="text-xs uppercase tracking-wide text-slate-300">
                Aguardando confirmação do pagamento
              </p>
              <p className="font-mono text-3xl font-bold tabular-nums">{formatarTempo(segundosRestantes)}</p>
              {segundosRestantes === 0 && (
                <p className="text-xs text-amber-300">Tempo esgotado. Gere um novo código para continuar.</p>
              )}
            </div>

            <button
              type="button"
              onClick={novaAtivacao}
              className="text-center text-sm font-medium text-blue-900 underline-offset-2 hover:underline"
            >
              Ativar outra vaga
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
