import { Router, Request, Response } from 'express';
import { supabase } from '../../config/database';

export const INFRACOES_TABLE = 'infracoes_zona_azul';

interface EmitirInfracaoBody {
  placa?: string;
  localizacao_rua?: string;
  foto_comprovante_url?: string;
  observacao?: string;
}

const infractionManagerRouter = Router();

infractionManagerRouter.post(
  '/emitir',
  async (req: Request<unknown, unknown, EmitirInfracaoBody>, res: Response): Promise<void> => {
    try {
      const { placa, localizacao_rua, foto_comprovante_url, observacao } = req.body;

      if (!placa || typeof placa !== 'string' || placa.trim().length === 0) {
        res.status(400).json({ status: 'ERRO', mensagem: 'Campo "placa" é obrigatório.' });
        return;
      }

      if (!localizacao_rua || typeof localizacao_rua !== 'string' || localizacao_rua.trim().length === 0) {
        res.status(400).json({ status: 'ERRO', mensagem: 'Campo "localizacao_rua" é obrigatório.' });
        return;
      }

      if (
        !foto_comprovante_url ||
        typeof foto_comprovante_url !== 'string' ||
        foto_comprovante_url.trim().length === 0
      ) {
        res.status(400).json({ status: 'ERRO', mensagem: 'Campo "foto_comprovante_url" é obrigatório.' });
        return;
      }

      const novaInfracao = {
        placa: placa.toUpperCase().trim(),
        localizacao_rua: localizacao_rua.trim(),
        foto_comprovante_url: foto_comprovante_url.trim(),
        observacao: observacao?.trim() || null,
        status: 'AGUARDANDO_EMISSAO_NOTIFICACAO',
        data_emissao: new Date().toISOString(),
      };

      const { data, error } = await supabase.from(INFRACOES_TABLE).insert(novaInfracao).select().single();

      if (error) {
        throw new Error(`Erro ao salvar infração no banco de dados: ${error.message}`);
      }

      console.log(
        `[infractionManager] Infração emitida por fiscal "${req.usuario?.sub ?? 'desconhecido'}" - placa ${novaInfracao.placa} em "${novaInfracao.localizacao_rua}".`,
      );

      res.status(201).json({ status: 'SUCESSO', infracao: data });
    } catch (error) {
      console.error('[infractionManager] Erro ao emitir infração:', error);
      res.status(500).json({
        status: 'ERRO',
        mensagem: 'Não foi possível emitir a infração no momento.',
      });
    }
  },
);

export default infractionManagerRouter;
