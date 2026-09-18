import { Router, Request, Response } from 'express';
import { supabase } from '../../config/database';
import { TICKETS_TABLE, TicketZonaAzul } from '../../types/ticket.types';

interface RelatorioPorSetor {
  setor: string;
  total_arrecadado: number;
  quantidade_tickets: number;
}

const dashboardFinanceiroRouter = Router();

dashboardFinanceiroRouter.get('/arrecadacao', async (_req: Request, res: Response): Promise<void> => {
  try {
    const inicioDoDia = new Date();
    inicioDoDia.setHours(0, 0, 0, 0);
    const inicioDoDiaSeguinte = new Date(inicioDoDia.getTime() + 24 * 60 * 60 * 1000);

    // Tickets pagos e ativados hoje: base tanto da arrecadação do dia quanto
    // do relatório por setor.
    const { data: ticketsHojeAtivos, error: erroTicketsHoje } = await supabase
      .from(TICKETS_TABLE)
      .select('valor, setor')
      .eq('status', 'ATIVO')
      .gte('data_ativacao', inicioDoDia.toISOString())
      .lt('data_ativacao', inicioDoDiaSeguinte.toISOString());

    if (erroTicketsHoje) {
      throw new Error(`Erro ao buscar arrecadação do dia: ${erroTicketsHoje.message}`);
    }

    // Volume total de vagas com pagamento confirmado, sem recorte de data.
    const { count: volumeTransacoesAtivas, error: erroContagem } = await supabase
      .from(TICKETS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ATIVO');

    if (erroContagem) {
      throw new Error(`Erro ao contar transações ativas: ${erroContagem.message}`);
    }

    const registrosHoje = (ticketsHojeAtivos ?? []) as Array<Pick<TicketZonaAzul, 'valor' | 'setor'>>;

    const valorTotalArrecadadoHoje = registrosHoje.reduce((soma, ticket) => soma + Number(ticket.valor ?? 0), 0);

    const relatorioPorSetorMap = new Map<string, RelatorioPorSetor>();
    for (const ticket of registrosHoje) {
      const setor = ticket.setor || 'NAO_INFORMADO';
      const acumulado = relatorioPorSetorMap.get(setor) ?? { setor, total_arrecadado: 0, quantidade_tickets: 0 };
      acumulado.total_arrecadado += Number(ticket.valor ?? 0);
      acumulado.quantidade_tickets += 1;
      relatorioPorSetorMap.set(setor, acumulado);
    }

    const relatorioPorSetor = Array.from(relatorioPorSetorMap.values())
      .sort((a, b) => b.total_arrecadado - a.total_arrecadado)
      .map((item) => ({ ...item, total_arrecadado: Number(item.total_arrecadado.toFixed(2)) }));

    console.log(
      `[dashboardFinanceiro] Auditoria acessada - arrecadação hoje: R$ ${valorTotalArrecadadoHoje.toFixed(2)} | transações ativas: ${volumeTransacoesAtivas ?? 0}.`,
    );

    res.status(200).json({
      status: 'SUCESSO',
      valor_total_arrecadado_hoje: Number(valorTotalArrecadadoHoje.toFixed(2)),
      volume_total_transacoes_ativas: volumeTransacoesAtivas ?? 0,
      relatorio_por_setor: relatorioPorSetor,
    });
  } catch (error) {
    console.error('[dashboardFinanceiro] Erro ao gerar auditoria de arrecadação:', error);
    res.status(500).json({
      status: 'ERRO',
      mensagem: 'Não foi possível gerar a auditoria de arrecadação no momento.',
    });
  }
});

export default dashboardFinanceiroRouter;
