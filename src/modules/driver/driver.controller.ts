import { Request, Response } from 'express';
import { ativarVaga } from './driver.service';
import { AtivarVagaRequestBody } from './driver.types';

export async function ativarVagaController(
  req: Request<unknown, unknown, Partial<AtivarVagaRequestBody>>,
  res: Response,
): Promise<void> {
  try {
    const { placa, cpf, minutos } = req.body;

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

    const resultado = await ativarVaga({ placa, cpf, minutos });

    res.status(201).json({
      status: 'SUCESSO',
      ...resultado,
    });
  } catch (error) {
    console.error('[driver.controller] Erro ao ativar vaga:', error);
    res.status(500).json({
      status: 'ERRO',
      mensagem: 'Não foi possível ativar a vaga no momento. Tente novamente.',
    });
  }
}
