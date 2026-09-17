import { randomUUID } from 'crypto';
import { supabase } from '../../config/supabaseClient';
import { env } from '../../config/env';
import { TICKETS_TABLE, TicketZonaAzul } from '../../types/ticket.types';
import { AtivarVagaRequestBody, AtivarVagaResultado } from './driver.types';

/**
 * Gera um payload simulado no padrão Pix Copia e Cola (BR Code / EMV).
 * Não é um código Pix válido perante o Banco Central: serve apenas para
 * a integração do app do motorista exibir/copiar durante os testes.
 */
function gerarPixCopiaCola(valor: number, txid: string): string {
  const valorFormatado = valor.toFixed(2);
  const txidCurto = txid.replace(/-/g, '').slice(0, 25).toUpperCase();
  const chave = env.pixChave;

  return (
    '00020126580014BR.GOV.BCB.PIX' +
    `0136${chave}` +
    '52040000' +
    '5303986' +
    `54${valorFormatado.length.toString().padStart(2, '0')}${valorFormatado}` +
    '5802BR' +
    '5913PARKDIGITAL' +
    '6009SAOPAULO' +
    `6207050${txidCurto}` +
    '63041D3D'
  );
}

export async function ativarVaga(dados: AtivarVagaRequestBody): Promise<AtivarVagaResultado> {
  const { placa, cpf, minutos } = dados;

  // Timestamps provisórios: o webhook de pagamento os recalcula a partir do
  // horário real da confirmação, para o motorista não perder minutos pagos
  // enquanto o pagamento ainda está pendente.
  const dataAtivacao = new Date();
  const dataExpiracao = new Date(dataAtivacao.getTime() + minutos * 60_000);

  const novoTicket = {
    placa: placa.toUpperCase().trim(),
    cpf_motorista: cpf.trim(),
    minutos_contratados: minutos,
    data_ativacao: dataAtivacao.toISOString(),
    data_expiracao: dataExpiracao.toISOString(),
    status: 'PENDENTE_PAGAMENTO' as const,
  };

  const { data, error } = await supabase
    .from(TICKETS_TABLE)
    .insert(novoTicket)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao salvar ticket no banco de dados: ${error.message}`);
  }

  const ticket = data as TicketZonaAzul;
  const valor = Number((minutos * env.precoPorMinuto).toFixed(2));
  const pixCopiaECola = gerarPixCopiaCola(valor, ticket.id ?? randomUUID());

  return {
    ticket: {
      id: ticket.id,
      placa: ticket.placa,
      data_ativacao: ticket.data_ativacao,
      data_expiracao: ticket.data_expiracao,
      minutos_contratados: ticket.minutos_contratados,
      status: ticket.status,
    },
    pagamento: {
      valor,
      pix_copia_e_cola: pixCopiaECola,
    },
  };
}
