import cron from 'node-cron';
import { supabase } from './database';
import { whatsAppService } from './whatsappClient';
import { TICKETS_TABLE, TicketZonaAzul } from '../types/ticket.types';

const JANELA_ALERTA_MINUTOS_MIN = 9;
const JANELA_ALERTA_MINUTOS_MAX = 10;
const TEMPLATE_ALERTA_VENCIMENTO = 'alerta_vencimento_vaga';

async function verificarVagasProximasDoVencimento(): Promise<void> {
  try {
    const agora = Date.now();
    const limiteInferior = new Date(agora + JANELA_ALERTA_MINUTOS_MIN * 60_000);
    const limiteSuperior = new Date(agora + JANELA_ALERTA_MINUTOS_MAX * 60_000);

    const { data, error } = await supabase
      .from(TICKETS_TABLE)
      .select('*')
      .eq('status', 'ATIVO')
      .gte('data_expiracao', limiteInferior.toISOString())
      .lte('data_expiracao', limiteSuperior.toISOString());

    if (error) {
      throw new Error(`Erro ao buscar vagas próximas do vencimento: ${error.message}`);
    }

    const tickets = (data ?? []) as TicketZonaAzul[];

    await Promise.all(
      tickets.map(async (ticket) => {
        if (!ticket.telefone) {
          console.warn(
            `[cronTasks] Ticket ${ticket.id} (placa ${ticket.placa}) está vencendo, mas não tem telefone cadastrado para alerta via WhatsApp.`,
          );
          return;
        }

        await whatsAppService.sendTemplateMessage(ticket.telefone, TEMPLATE_ALERTA_VENCIMENTO, [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: ticket.placa },
              { type: 'text', text: ticket.setor },
            ],
          },
        ]);
      }),
    );
  } catch (error) {
    console.error('[cronTasks] Erro ao verificar vagas próximas do vencimento:', error);
  }
}

export function iniciarTarefasCron(): void {
  cron.schedule('*/1 * * * *', () => {
    void verificarVagasProximasDoVencimento();
  });

  console.log('Tarefa cron de alertas anti-multa iniciada (execução a cada 1 minuto).');
}
