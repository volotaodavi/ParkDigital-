import { Router, Request, Response } from 'express';
import { supabase } from '../../config/database';
import { TICKETS_TABLE, TicketZonaAzul } from '../../types/ticket.types';

interface WebhookPagamentoBody {
  id_transacao?: string;
  placa?: string;
}

const webhookPaymentRouter = Router();

/**
 * Simula o webhook de confirmação de pagamento de um gateway Pix (ex: Asaas).
 * `id_transacao` corresponde ao `id` do ticket gerado na ativação da vaga:
 * é o identificador que devolvemos ao motorista para vincular a cobrança.
 *
 * Aviso: por ser uma simulação, não há validação de assinatura/segredo do
 * gateway. Em produção, o payload deve ser autenticado antes de confiar nele.
 */
webhookPaymentRouter.post(
  '/webhook',
  async (req: Request<unknown, unknown, Partial<WebhookPagamentoBody>>, res: Response): Promise<void> => {
    try {
      const { id_transacao, placa } = req.body;

      if (!id_transacao && !placa) {
        res.status(400).json({
          status: 'ERRO',
          mensagem: 'Informe "id_transacao" ou "placa" para identificar o pagamento.',
        });
        return;
      }

      let buscaTicketPendente = supabase
        .from(TICKETS_TABLE)
        .select('*')
        .eq('status', 'PENDENTE_PAGAMENTO');

      buscaTicketPendente = id_transacao
        ? buscaTicketPendente.eq('id', id_transacao)
        : buscaTicketPendente.eq('placa', (placa as string).toUpperCase().trim());

      const { data: ticketPendente, error: erroBusca } = await buscaTicketPendente
        .order('data_ativacao', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (erroBusca) {
        throw new Error(`Erro ao buscar ticket pendente de pagamento: ${erroBusca.message}`);
      }

      if (!ticketPendente) {
        res.status(404).json({
          status: 'ERRO',
          mensagem: 'Nenhuma vaga pendente de pagamento encontrada para os dados informados.',
        });
        return;
      }

      const ticket = ticketPendente as TicketZonaAzul;

      // Recontabiliza a janela a partir da confirmação real do pagamento,
      // para o motorista receber todos os minutos contratados.
      const novaDataAtivacao = new Date();
      const novaDataExpiracao = new Date(novaDataAtivacao.getTime() + ticket.minutos_contratados * 60_000);

      const { data: ticketAtualizado, error: erroUpdate } = await supabase
        .from(TICKETS_TABLE)
        .update({
          status: 'ATIVO',
          data_ativacao: novaDataAtivacao.toISOString(),
          data_expiracao: novaDataExpiracao.toISOString(),
        })
        .eq('id', ticket.id)
        .select()
        .single();

      if (erroUpdate) {
        throw new Error(`Erro ao ativar vaga após confirmação de pagamento: ${erroUpdate.message}`);
      }

      res.status(200).json({
        status: 'SUCESSO',
        mensagem: 'Pagamento confirmado. Vaga ativada.',
        ticket: ticketAtualizado,
      });
    } catch (error) {
      console.error('[webhookPayment] Erro ao processar confirmação de pagamento:', error);
      res.status(500).json({
        status: 'ERRO',
        mensagem: 'Não foi possível processar a confirmação de pagamento no momento.',
      });
    }
  },
);

export default webhookPaymentRouter;
