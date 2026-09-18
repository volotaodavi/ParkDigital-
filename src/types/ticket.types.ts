export const TICKETS_TABLE = 'tickets_zona_azul';

export type StatusTicket = 'PENDENTE_PAGAMENTO' | 'ATIVO';

export interface TicketZonaAzul {
  id: string;
  placa: string;
  cpf_motorista: string;
  minutos_contratados: number;
  data_ativacao: string;
  data_expiracao: string;
  status: StatusTicket;
  valor: number;
  setor: string;
  telefone: string | null;
}
