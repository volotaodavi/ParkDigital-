import { Request, Response } from 'express';
import { consultarPlaca } from './fiscal.service';

export async function consultarPlacaController(
  req: Request<{ placa: string }>,
  res: Response,
): Promise<void> {
  try {
    const { placa } = req.params;

    if (!placa || placa.trim().length === 0) {
      res.status(400).json({ status: 'ERRO', mensagem: 'Placa é obrigatória.' });
      return;
    }

    const resultado = await consultarPlaca(placa);
    res.status(200).json(resultado);
  } catch (error) {
    console.error('[fiscal.controller] Erro ao consultar placa:', error);
    res.status(500).json({
      status: 'ERRO',
      mensagem: 'Não foi possível consultar a placa no momento. Tente novamente.',
    });
  }
}
