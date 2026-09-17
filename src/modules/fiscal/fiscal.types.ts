export interface ConsultaPlacaRegular {
  status: 'REGULAR';
  tempo_restante_minutos: number;
}

export interface ConsultaPlacaIrregular {
  status: 'IRREGULAR';
}

export type ConsultaPlacaResultado = ConsultaPlacaRegular | ConsultaPlacaIrregular;
