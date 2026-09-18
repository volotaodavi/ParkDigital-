import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabase } from '../../config/database';
import { env } from '../../config/env';
import { authMiddleware, PapelUsuario } from '../../config/authMiddleware';
import { loginRateLimiter } from '../../config/rateLimit';

const USUARIOS_TABLE = 'usuarios';
const TAMANHO_MAXIMO_CAMPO = 255;

interface LoginRequestBody {
  identificador?: string;
  senha?: string;
}

interface UsuarioLogin {
  id: string;
  nome: string;
  senha_hash: string | null;
  role: PapelUsuario;
  ativo: boolean;
}

interface UsuarioSessao {
  id: string;
  nome: string;
  role: PapelUsuario;
  ativo: boolean;
}

// Hash sem usuário real correspondente: usado para manter o tempo de
// resposta constante quando o identificador não existe, evitando que a
// diferença de tempo revele quais identificadores estão cadastrados.
const HASH_FICTICIO = bcrypt.hashSync('senha-ficticia-para-tempo-constante', 10);

function gerarToken(usuario: { id: string; nome: string; role: PapelUsuario }): string {
  return jwt.sign({ sub: usuario.id, role: usuario.role, nome: usuario.nome }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
}

/** Busca a sessão atual do usuário no banco (usada por /me e /refresh para
 * confirmar que a conta ainda existe e está ativa, mesmo com o JWT válido). */
async function buscarUsuarioAtivo(id: string): Promise<UsuarioSessao | null> {
  const { data, error } = await supabase
    .from(USUARIOS_TABLE)
    .select('id, nome, role, ativo')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao consultar usuário: ${error.message}`);
  }

  return data as UsuarioSessao | null;
}

const authManagerRouter = Router();

authManagerRouter.post(
  '/login',
  loginRateLimiter,
  async (req: Request<unknown, unknown, LoginRequestBody>, res: Response): Promise<void> => {
    try {
      const { identificador, senha } = req.body;

      if (
        !identificador ||
        typeof identificador !== 'string' ||
        identificador.trim().length === 0 ||
        identificador.length > TAMANHO_MAXIMO_CAMPO
      ) {
        res.status(400).json({ status: 'ERRO', mensagem: 'Campo "identificador" é obrigatório.' });
        return;
      }

      if (
        !senha ||
        typeof senha !== 'string' ||
        senha.length === 0 ||
        senha.length > TAMANHO_MAXIMO_CAMPO
      ) {
        res.status(400).json({ status: 'ERRO', mensagem: 'Campo "senha" é obrigatório.' });
        return;
      }

      const { data, error } = await supabase
        .from(USUARIOS_TABLE)
        .select('id, nome, senha_hash, role, ativo')
        .eq('identificador', identificador.trim())
        .maybeSingle();

      if (error) {
        throw new Error(`Erro ao consultar usuário: ${error.message}`);
      }

      const usuario = data as UsuarioLogin | null;
      const senhaConfere = await bcrypt.compare(senha, usuario?.senha_hash ?? HASH_FICTICIO);

      if (!usuario || !senhaConfere) {
        console.warn(`[authManager] Tentativa de login inválida para identificador "${identificador}".`);
        res.status(401).json({
          status: 'ERRO',
          codigo: 'CREDENCIAIS_INVALIDAS',
          mensagem: 'Credenciais inválidas.',
        });
        return;
      }

      if (!usuario.ativo) {
        console.warn(`[authManager] Login recusado: conta "${usuario.id}" está desativada.`);
        res.status(403).json({
          status: 'ERRO',
          codigo: 'CONTA_DESATIVADA',
          mensagem: 'Sua conta está desativada. Entre em contato com o administrador.',
        });
        return;
      }

      const token = gerarToken(usuario);

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

/**
 * Confirma se a sessão atual ainda é válida: o JWT precisa estar assinado
 * corretamente e não expirado (checado pelo authMiddleware) E a conta
 * precisa continuar existindo e ativa no banco (checado aqui). Isso garante
 * que desativar um usuário produz efeito imediato, sem esperar o token
 * expirar naturalmente.
 */
authManagerRouter.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const usuarioToken = req.usuario;

    if (!usuarioToken) {
      res.status(401).json({ status: 'ERRO', mensagem: 'Usuário não autenticado.' });
      return;
    }

    const usuario = await buscarUsuarioAtivo(usuarioToken.sub);

    if (!usuario || !usuario.ativo) {
      console.warn(
        `[authManager] Sessão invalidada: usuário "${usuarioToken.sub}" não existe mais ou foi desativado.`,
      );
      res.status(401).json({
        status: 'ERRO',
        codigo: 'SESSAO_INVALIDA',
        mensagem: 'Sua sessão não é mais válida. Faça login novamente.',
      });
      return;
    }

    res.status(200).json({
      status: 'SUCESSO',
      usuario: { id: usuario.id, nome: usuario.nome, role: usuario.role },
    });
  } catch (error) {
    console.error('[authManager] Erro ao verificar sessão:', error);
    res.status(500).json({
      status: 'ERRO',
      mensagem: 'Não foi possível verificar a sessão no momento.',
    });
  }
});

/**
 * Renova a sessão emitindo um novo token com validade estendida, desde que
 * o token atual ainda esteja válido e a conta continue ativa. Um token já
 * expirado não pode ser renovado — nesse caso é preciso fazer login de novo.
 */
authManagerRouter.post('/refresh', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const usuarioToken = req.usuario;

    if (!usuarioToken) {
      res.status(401).json({ status: 'ERRO', mensagem: 'Usuário não autenticado.' });
      return;
    }

    const usuario = await buscarUsuarioAtivo(usuarioToken.sub);

    if (!usuario || !usuario.ativo) {
      res.status(401).json({
        status: 'ERRO',
        codigo: 'SESSAO_INVALIDA',
        mensagem: 'Sua sessão não é mais válida. Faça login novamente.',
      });
      return;
    }

    const token = gerarToken(usuario);

    console.log(`[authManager] Sessão renovada: usuário "${usuario.id}".`);

    res.status(200).json({
      status: 'SUCESSO',
      token,
      usuario: { id: usuario.id, nome: usuario.nome, role: usuario.role },
    });
  } catch (error) {
    console.error('[authManager] Erro ao renovar sessão:', error);
    res.status(500).json({
      status: 'ERRO',
      mensagem: 'Não foi possível renovar a sessão no momento.',
    });
  }
});

/**
 * Como o JWT é stateless (sem lista de revogação), o "logout" efetivo é o
 * frontend descartar o token armazenado. Esta rota existe para registrar o
 * evento no log de auditoria e para uma futura lista de revogação, caso
 * venha a ser necessária.
 */
authManagerRouter.post('/logout', authMiddleware, (req: Request, res: Response): void => {
  console.log(`[authManager] Logout: usuário "${req.usuario?.sub}".`);
  res.status(200).json({ status: 'SUCESSO', mensagem: 'Sessão encerrada.' });
});

export default authManagerRouter;
