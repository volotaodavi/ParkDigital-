import { Router, Request, Response } from 'express';
import { supabase } from '../../config/database';
import { TICKETS_TABLE, TicketZonaAzul } from '../../types/ticket.types';

type ConsultaPlacaResultado = { status: 'REGULAR'; tempo_restante_minutos: number } | { status: 'IRREGULAR' };

const plateScannerRouter = Router();

plateScannerRouter.get(
  '/placa/consultar/:placa',
  async (req: Request<{ placa: string }>, res: Response): Promise<void> => {
    try {
      const { placa } = req.params;

      if (!placa || placa.trim().length === 0) {
        res.status(400).json({ status: 'ERRO', mensagem: 'Placa é obrigatória.' });
        return;
      }

      const placaNormalizada = placa.toUpperCase().trim();

      const { data, error } = await supabase
        .from(TICKETS_TABLE)
        .select('*')
        .eq('placa', placaNormalizada)
        .eq('status', 'ATIVO')
        .order('data_expiracao', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(`Erro ao consultar placa no banco de dados: ${error.message}`);
      }

      let resultado: ConsultaPlacaResultado;

      if (!data) {
        resultado = { status: 'IRREGULAR' };
      } else {
        const ticket = data as TicketZonaAzul;
        const agora = Date.now();
        const expiracao = new Date(ticket.data_expiracao).getTime();

        resultado =
          agora < expiracao
            ? { status: 'REGULAR', tempo_restante_minutos: Math.ceil((expiracao - agora) / 60_000) }
            : { status: 'IRREGULAR' };
      }

      res.status(200).json(resultado);
    } catch (error) {
      console.error('[plateScanner] Erro ao consultar placa:', error);
      res.status(500).json({
        status: 'ERRO',
        mensagem: 'Não foi possível consultar a placa no momento. Tente novamente.',
      });
    }
  },
);

export default plateScannerRouter;
