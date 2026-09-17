"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Banknote, Car, Landmark, MapPin, ShieldAlert, TrendingUp } from "lucide-react";

interface SetorArrecadacao {
  setor: string;
  totalArrecadado: number;
}

interface AlertaFiscal {
  id: string;
  placa: string;
  rua: string;
  fiscal: string;
  horario: string;
}

interface AuditoriaArrecadacao {
  valorTotalArrecadadoHoje: number;
  crescimentoPercentualVsOntem: number;
  ocupacaoPercentual: number;
  infracoesEmitidasHoje: number;
  relatorioPorSetor: SetorArrecadacao[];
  ultimosAlertas: AlertaFiscal[];
}

/**
 * Simula GET /api/v1/governo/auditoria/arrecadacao (rota protegida por JWT
 * com role GESTOR_PUBLICO). Este frontend ainda não tem tela de login, então
 * os números aqui são ilustrativos; "ocupação de vagas" e "infrações do dia"
 * também não existem como campo na API real ainda — precisam de um endpoint
 * próprio antes desta tela poder consumir dados reais.
 */
function buscarAuditoriaSimulada(): Promise<AuditoriaArrecadacao> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        valorTotalArrecadadoHoje: 4250,
        crescimentoPercentualVsOntem: 12,
        ocupacaoPercentual: 74,
        infracoesEmitidasHoje: 38,
        relatorioPorSetor: [
          { setor: "Centro", totalArrecadado: 2100 },
          { setor: "Orla", totalArrecadado: 1400 },
          { setor: "Zona Norte", totalArrecadado: 480 },
          { setor: "Zona Sul", totalArrecadado: 270 },
        ],
        ultimosAlertas: [
          { id: "1", placa: "ABC-1234", rua: "Av. Paulista, 1000", fiscal: "Fiscal 042", horario: "09:42" },
          { id: "2", placa: "DEF-5678", rua: "Rua Augusta, 320", fiscal: "Fiscal 017", horario: "09:31" },
          { id: "3", placa: "GHI-9012", rua: "Av. Beira-Mar, 850", fiscal: "Fiscal 009", horario: "09:18" },
          { id: "4", placa: "JKL-3456", rua: "Rua XV de Novembro, 220", fiscal: "Fiscal 042", horario: "08:57" },
        ],
      });
    }, 600);
  });
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function DashboardGoverno() {
  const [auditoria, setAuditoria] = useState<AuditoriaArrecadacao | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    buscarAuditoriaSimulada().then((dados) => {
      if (ativo) {
        setAuditoria(dados);
        setCarregando(false);
      }
    });

    return () => {
      ativo = false;
    };
  }, []);

  const valorMaximoSetor = auditoria
    ? Math.max(...auditoria.relatorioPorSetor.map((item) => item.totalArrecadado))
    : 0;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex items-center gap-3 rounded-2xl bg-blue-900 px-6 py-5 text-white shadow-sm">
          <div className="rounded-full bg-white/10 p-2.5">
            <Landmark className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-blue-100">ParkDigital · Painel do Gestor</p>
            <h1 className="text-xl font-semibold">Auditoria de arrecadação da Zona Azul</h1>
          </div>
        </header>

        {carregando || !auditoria ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((indice) => (
              <div key={indice} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <CartaoKpi
                icone={<Banknote className="h-6 w-6" />}
                titulo="Arrecadação Total do Dia"
                valor={formatarMoeda(auditoria.valorTotalArrecadadoHoje)}
                rodape={
                  <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                    <TrendingUp className="h-4 w-4" />
                    +{auditoria.crescimentoPercentualVsOntem}% vs ontem
                  </span>
                }
              />
              <CartaoKpi
                icone={<Car className="h-6 w-6" />}
                titulo="Ocupação de Vagas em Tempo Real"
                valor={`${auditoria.ocupacaoPercentual}%`}
                rodape={<span className="text-sm text-slate-500">das vagas de rua ocupadas agora</span>}
              />
              <CartaoKpi
                icone={<ShieldAlert className="h-6 w-6" />}
                titulo="Notificações de Irregularidade"
                valor={auditoria.infracoesEmitidasHoje.toString()}
                rodape={<span className="text-sm text-slate-500">infrações emitidas hoje</span>}
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 font-semibold text-slate-900">Setores mais lucrativos hoje</h2>
                <div className="flex flex-col gap-4">
                  {auditoria.relatorioPorSetor.map((item) => {
                    const percentual =
                      valorMaximoSetor > 0 ? (item.totalArrecadado / valorMaximoSetor) * 100 : 0;

                    return (
                      <div key={item.setor}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 font-medium text-slate-700">
                            <MapPin className="h-4 w-4 text-slate-400" />
                            {item.setor}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {formatarMoeda(item.totalArrecadado)}
                          </span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-800"
                            style={{ width: `${percentual}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
                  <AlertTriangle className="h-5 w-5 text-slate-400" />
                  Últimos alertas emitidos pelos fiscais
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="pb-2 pr-4 font-medium">Placa</th>
                        <th className="pb-2 pr-4 font-medium">Local</th>
                        <th className="pb-2 pr-4 font-medium">Fiscal</th>
                        <th className="pb-2 font-medium">Horário</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditoria.ultimosAlertas.map((alerta) => (
                        <tr key={alerta.id}>
                          <td className="py-2.5 pr-4 font-semibold text-slate-900">{alerta.placa}</td>
                          <td className="py-2.5 pr-4 text-slate-600">{alerta.rua}</td>
                          <td className="py-2.5 pr-4 text-slate-600">{alerta.fiscal}</td>
                          <td className="py-2.5 text-slate-600">{alerta.horario}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

interface CartaoKpiProps {
  icone: React.ReactNode;
  titulo: string;
  valor: string;
  rodape: React.ReactNode;
}

function CartaoKpi({ icone, titulo, valor, rodape }: CartaoKpiProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        {icone}
        <p className="text-sm font-medium">{titulo}</p>
      </div>
      <p className="text-2xl font-bold text-slate-900">{valor}</p>
      <div className="mt-1">{rodape}</div>
    </div>
  );
}
