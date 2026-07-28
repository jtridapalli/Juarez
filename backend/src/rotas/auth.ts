import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { registrarAuditoria } from '../lib/auditoria.js';
import { naoAutorizado } from '../lib/erros.js';
import { prisma } from '../lib/prisma.js';

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(4),
});

export async function rotasAuth(app: FastifyInstance) {
  app.post('/api/auth/login', async (requisicao) => {
    const { email, senha } = loginSchema.parse(requisicao.body);
    const usuario = await prisma.usuario.findUnique({ where: { email }, include: { unidade: true } });
    if (!usuario || !usuario.ativo) throw naoAutorizado();

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaValida) throw naoAutorizado();

    const token = app.jwt.sign(
      {
        sub: usuario.id,
        nome: usuario.nome,
        perfil: usuario.perfil,
        unidadeId: usuario.unidadeId,
        unidade: usuario.unidade?.codigo ?? null,
      },
      { expiresIn: '12h' },
    );

    await registrarAuditoria({ usuarioId: usuario.id, acao: 'LOGIN', entidade: 'Usuario', entidadeId: usuario.id });

    return {
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        unidade: usuario.unidade ? { codigo: usuario.unidade.codigo, nome: usuario.unidade.nome } : null,
      },
    };
  });

  app.get('/api/auth/eu', { onRequest: [app.autenticar] }, async (requisicao) => {
    const usuario = await prisma.usuario.findUnique({
      where: { id: requisicao.usuario.sub },
      include: { unidade: true },
    });
    if (!usuario) throw naoAutorizado();
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      unidade: usuario.unidade ? { codigo: usuario.unidade.codigo, nome: usuario.unidade.nome } : null,
    };
  });
}
