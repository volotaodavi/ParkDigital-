import dotenv from 'dotenv';

dotenv.config();

interface EnvConfig {
  port: number;
  supabaseUrl: string;
  supabaseKey: string;
  precoPorMinuto: number;
  pixChave: string;
  jwtSecret: string;
  jwtExpiresIn: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export const env: EnvConfig = {
  port: Number(process.env.PORT ?? 3000),
  supabaseUrl: required('SUPABASE_URL'),
  supabaseKey: required('SUPABASE_KEY'),
  precoPorMinuto: Number(process.env.PRECO_POR_MINUTO ?? 0.1),
  pixChave: process.env.PIX_CHAVE ?? 'contato@parkdigital.com.br',
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
};
