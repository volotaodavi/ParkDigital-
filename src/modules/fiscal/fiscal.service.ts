import { supabase } from '../../config/supabaseClient';
import { TICKETS_TABLE, TicketZonaAzul } from '../../types/ticket.types';
import { ConsultaPlacaResultado } from './fiscal.types';

export async function consultarPlaca(placa: string): Promise<ConsultaPlacaResultado> {
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

  if (!data) {
    return { status: 'IRREGULAR' };
  }

  const ticket = data as TicketZonaAzul;
  const agora = Date.now();
  const expiracao = new Date(ticket.data_expiracao).getTime();

  if (agora < expiracao) {
    const tempoRestanteMinutos = Math.ceil((expiracao - agora) / 60_000);
    return { status: 'REGULAR', tempo_restante_minutos: tempoRestanteMinutos };
  }

  return { status: 'IRREGULAR' };
}
