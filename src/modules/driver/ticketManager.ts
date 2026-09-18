import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';
import { supabase } from '../../config/database';
import { env } from '../../config/env';
import { whatsAppService } from '../../config/whatsappClient';
import { TICKETS_TABLE, TicketZonaAzul } from '../../types/ticket.types';

interface AtivarVagaRequestBody {
  placa?: string;
  cpf?: string;
  minutos?: number;
  setor?: string;
  telefone?: string;
}

const TEMPLATE_CONFIRMACAO_PIX = 'confirmacao_ativacao_pix';

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

const ticketManagerRouter = Router();

ticketManagerRouter.post(
  '/vaga/ativar',
  async (req: Request<unknown, unknown, AtivarVagaRequestBody>, res: Response): Promise<void> => {
    try {
      const { placa, cpf, minutos, setor, telefone } = req.body;

      if (!placa || typeof placa !== 'string' || placa.trim().length === 0) {
        res.status(400).json({
          status: 'ERRO',
          mensagem: 'Campo "placa" é obrigatório e deve ser uma string não vazia.',
        });
        return;
      }

      if (!cpf || typeof cpf !== 'string' || cpf.trim().length === 0) {
        res.status(400).json({
          status: 'ERRO',
          mensagem: 'Campo "cpf" é obrigatório e deve ser uma string não vazia.',
        });
        return;
      }

      if (typeof minutos !== 'number' || !Number.isFinite(minutos) || minutos <= 0) {
        res.status(400).json({
          status: 'ERRO',
          mensagem: 'Campo "minutos" é obrigatório e deve ser um número positivo.',
        });
        return;
      }

      if (setor !== undefined && (typeof setor !== 'string' || setor.trim().length === 0)) {
        res.status(400).json({
          status: 'ERRO',
          mensagem: 'Campo "setor", se informado, deve ser uma string não vazia.',
        });
        return;
      }

      if (telefone !== undefined && (typeof telefone !== 'string' || telefone.trim().length === 0)) {
        res.status(400).json({
          status: 'ERRO',
          mensagem: 'Campo "telefone", se informado, deve ser uma string não vazia.',
        });
        return;
      }

      // Timestamps provisórios: o webhook de pagamento os recalcula a partir
      // do horário real da confirmação, para o motorista não perder minutos
      // pagos enquanto o pagamento ainda está pendente.
      const dataAtivacao = new Date();
      const dataExpiracao = new Date(dataAtivacao.getTime() + minutos * 60_000);
      const valor = Number((minutos * env.precoPorMinuto).toFixed(2));

      const novoTicket = {
        placa: placa.toUpperCase().trim(),
        cpf_motorista: cpf.trim(),
        minutos_contratados: minutos,
        data_ativacao: dataAtivacao.toISOString(),
        data_expiracao: dataExpiracao.toISOString(),
        status: 'PENDENTE_PAGAMENTO' as const,
        valor,
        setor: setor?.trim() || 'NAO_INFORMADO',
        telefone: telefone?.trim() || null,
      };

      const { data, error } = await supabase.from(TICKETS_TABLE).insert(novoTicket).select().single();

      if (error) {
        throw new Error(`Erro ao salvar ticket no banco de dados: ${error.message}`);
      }

      const ticket = data as TicketZonaAzul;
      const pixCopiaECola = gerarPixCopiaCola(valor, ticket.id ?? randomUUID());

      // Disparado em segundo plano: o motorista não deve esperar o WhatsApp
      // (com suas próprias tentativas/retries) para receber a resposta com
      // o código Pix. Falha no envio é só logada, nunca propagada aqui.
      if (ticket.telefone) {
        void whatsAppService.sendTemplateMessage(ticket.telefone, TEMPLATE_CONFIRMACAO_PIX, [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: `R$ ${valor.toFixed(2).replace('.', ',')}` },
              { type: 'text', text: pixCopiaECola },
            ],
          },
        ]);
      }

      res.status(201).json({
        status: 'SUCESSO',
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
      });
    } catch (error) {
      console.error('[ticketManager] Erro ao ativar vaga:', error);
      res.status(500).json({
        status: 'ERRO',
        mensagem: 'Não foi possível ativar a vaga no momento. Tente novamente.',
      });
    }
  },
);

export default ticketManagerRouter;
