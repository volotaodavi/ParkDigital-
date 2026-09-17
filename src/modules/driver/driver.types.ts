export interface AtivarVagaRequestBody {
  placa: string;
  cpf: string;
  minutos: number;
}

export interface AtivarVagaResultado {
  ticket: {
    id: string;
    placa: string;
    data_ativacao: string;
    data_expiracao: string;
    minutos_contratados: number;
  };
  pagamento: {
    valor: number;
    pix_copia_e_cola: string;
  };
}
