export const TICKETS_TABLE = 'tickets_zona_azul';

export interface TicketZonaAzul {
  id: string;
  placa: string;
  cpf_motorista: string;
  minutos_contratados: number;
  data_ativacao: string;
  data_expiracao: string;
}
