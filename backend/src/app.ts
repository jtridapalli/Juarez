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

  // Diversas operacoes de tramitacao (enviar, homologar, consolidar) nao exigem
  // corpo na requisicao; um corpo vazio e interpretado como objeto vazio.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_requisicao, corpo, concluir) => {
    const conteudo = String(corpo).trim();
    if (conteudo.length === 0) return concluir(null, {});
    try {
      concluir(null, JSON.parse(conteudo));
    } catch {
      concluir(new ErroAplicacao(400, 'Corpo da requisicao nao e um JSON valido.'), undefined);
    }
  });

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
    const falha = erro as { code?: string; statusCode?: number; message?: string };
    const codigo = falha.code;
    const status = falha.statusCode;
    if (codigo?.startsWith('FAST_JWT') || status === 401) {
      return resposta.status(401).send({ erro: 'Sessao invalida ou expirada.' });
    }
    // Erros de validacao do proprio Fastify preservam o status original, para
    // que a causa nao seja mascarada por uma falha generica de servidor.
    if (status && status >= 400 && status < 500) {
      requisicao.log.warn(erro);
      return resposta.status(status).send({ erro: falha.message ?? 'Requisicao invalida.' });
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
