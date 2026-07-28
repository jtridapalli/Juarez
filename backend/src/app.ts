import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ErroAplicacao } from './lib/erros.js';
import { rotasAuth } from './rotas/auth.js';
import { rotasCadastros } from './rotas/cadastros.js';
import { rotasOrcamento } from './rotas/orcamento.js';
import { rotasRelatorios } from './rotas/relatorios.js';
import { rotasValidacao } from './rotas/validacao.js';

export interface UsuarioToken {
  sub: number;
  nome: string;
  perfil: string;
  unidadeId: number | null;
  unidade: string | null;
}

declare module 'fastify' {
  interface FastifyInstance {
    autenticar: (requisicao: FastifyRequest, resposta: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    usuario: UsuarioToken;
  }
}

export async function criarApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: process.env.LOG_LEVEL ?? 'info' },
    bodyLimit: 10 * 1024 * 1024,
  });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'loa2027-parana-dev-secret' });

  app.decorate('autenticar', async (requisicao: FastifyRequest) => {
    await requisicao.jwtVerify();
    requisicao.usuario = requisicao.user as UsuarioToken;
  });

  app.setErrorHandler((erro, requisicao, resposta) => {
    if (erro instanceof ZodError) {
      return resposta.status(400).send({
        erro: 'Dados invalidos na requisicao.',
        detalhes: erro.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
      });
    }
    if (erro instanceof ErroAplicacao) {
      return resposta.status(erro.status).send({ erro: erro.message, detalhes: erro.detalhes });
    }
    const codigo = (erro as { code?: string; statusCode?: number }).code;
    if (codigo?.startsWith('FAST_JWT') || (erro as { statusCode?: number }).statusCode === 401) {
      return resposta.status(401).send({ erro: 'Sessao invalida ou expirada.' });
    }
    requisicao.log.error(erro);
    return resposta.status(500).send({ erro: 'Erro interno no processamento da requisicao.' });
  });

  app.get('/api/saude', async () => ({
    servico: 'Sistema de Elaboracao da LOA - Governo do Estado do Parana',
    versao: '1.0.0',
    situacao: 'operacional',
    horario: new Date().toISOString(),
  }));

  await app.register(rotasAuth);
  await app.register(rotasCadastros);
  await app.register(rotasOrcamento);
  await app.register(rotasValidacao);
  await app.register(rotasRelatorios);

  return app;
}
