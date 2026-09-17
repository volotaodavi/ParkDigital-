import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabase } from '../../config/database';
import { env } from '../../config/env';
import { PapelUsuario } from '../../config/authMiddleware';

const USUARIOS_TABLE = 'usuarios';

interface LoginRequestBody {
  identificador?: string;
  senha?: string;
}

interface UsuarioRegistro {
  id: string;
  nome: string;
  senha_hash: string;
  role: PapelUsuario;
}

// Hash sem usuário real correspondente: usado para manter o tempo de
// resposta constante quando o identificador não existe, evitando que a
// diferença de tempo revele quais identificadores estão cadastrados.
const HASH_FICTICIO = bcrypt.hashSync('senha-ficticia-para-tempo-constante', 10);

const authManagerRouter = Router();

authManagerRouter.post(
  '/login',
  async (req: Request<unknown, unknown, LoginRequestBody>, res: Response): Promise<void> => {
    try {
      const { identificador, senha } = req.body;

      if (!identificador || typeof identificador !== 'string' || identificador.trim().length === 0) {
        res.status(400).json({ status: 'ERRO', mensagem: 'Campo "identificador" é obrigatório.' });
        return;
      }

      if (!senha || typeof senha !== 'string' || senha.length === 0) {
        res.status(400).json({ status: 'ERRO', mensagem: 'Campo "senha" é obrigatório.' });
        return;
      }

      const { data, error } = await supabase
        .from(USUARIOS_TABLE)
        .select('id, nome, senha_hash, role')
        .eq('identificador', identificador.trim())
        .maybeSingle();

      if (error) {
        throw new Error(`Erro ao consultar usuário: ${error.message}`);
      }

      const usuario = data as UsuarioRegistro | null;
      const senhaConfere = await bcrypt.compare(senha, usuario?.senha_hash ?? HASH_FICTICIO);

      if (!usuario || !senhaConfere) {
        console.warn(`[authManager] Tentativa de login inválida para identificador "${identificador}".`);
        res.status(401).json({ status: 'ERRO', mensagem: 'Credenciais inválidas.' });
        return;
      }

      const token = jwt.sign({ sub: usuario.id, role: usuario.role }, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn,
      } as jwt.SignOptions);

      console.log(`[authManager] Login bem-sucedido: usuário "${usuario.id}" (role ${usuario.role}).`);

      res.status(200).json({
        status: 'SUCESSO',
        token,
        usuario: { id: usuario.id, nome: usuario.nome, role: usuario.role },
      });
    } catch (error) {
      console.error('[authManager] Erro ao processar login:', error);
      res.status(500).json({
        status: 'ERRO',
        mensagem: 'Não foi possível processar o login no momento.',
      });
    }
  },
);

export default authManagerRouter;
