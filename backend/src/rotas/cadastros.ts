import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

/** Consulta das tabelas de referencia usadas na captacao das propostas. */
export async function rotasCadastros(app: FastifyInstance) {
  app.get('/api/cadastros/orgaos', async () => {
    const orgaos = await prisma.orgao.findMany({
      orderBy: { codigo: 'asc' },
      include: { unidades: { orderBy: { codigo: 'asc' } } },
    });
    return orgaos.map((o) => ({
      codigo: o.codigo,
      sigla: o.sigla,
      nome: o.nome,
      poder: o.poder,
      tipoAdministracao: o.tipoAdministracao,
      unidades: o.unidades.map((u) => ({ id: u.id, codigo: u.codigo, sigla: u.sigla, nome: u.nome })),
    }));
  });

  app.get('/api/cadastros/unidades', async () => {
    const unidades = await prisma.unidadeOrcamentaria.findMany({
      orderBy: { codigo: 'asc' },
      include: { orgao: true },
    });
    return unidades.map((u) => ({
      id: u.id,
      codigo: u.codigo,
      sigla: u.sigla,
      nome: u.nome,
      orgao: { codigo: u.orgao.codigo, sigla: u.orgao.sigla, nome: u.orgao.nome, poder: u.orgao.poder },
    }));
  });

  app.get('/api/cadastros/funcoes', async () => {
    const funcoes = await prisma.funcao.findMany({
      orderBy: { codigo: 'asc' },
      include: { subfuncoes: { orderBy: { codigo: 'asc' } } },
    });
    return funcoes.map((f) => ({
      id: f.id,
      codigo: f.codigo,
      nome: f.nome,
      subfuncoes: f.subfuncoes.map((s) => ({ id: s.id, codigo: s.codigo, nome: s.nome })),
    }));
  });

  app.get('/api/cadastros/subfuncoes', async () =>
    prisma.subfuncao.findMany({ orderBy: { codigo: 'asc' }, include: { funcao: true } }),
  );

  app.get('/api/cadastros/programas', async () => {
    const programas = await prisma.programa.findMany({
      orderBy: { codigo: 'asc' },
      include: { acoes: { orderBy: { codigo: 'asc' } } },
    });
    return programas.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      nome: p.nome,
      tipo: p.tipo,
      objetivo: p.objetivo,
      publicoAlvo: p.publicoAlvo,
      ppaInicio: p.ppaInicio,
      ppaFim: p.ppaFim,
      ativo: p.ativo,
      acoes: p.acoes.map((a) => ({
        id: a.id,
        codigo: a.codigo,
        nome: a.nome,
        tipo: a.tipo,
        produto: a.produto,
        unidadeMedida: a.unidadeMedida,
        metaFisica: a.metaFisica,
      })),
    }));
  });

  app.get('/api/cadastros/naturezas-receita', async () =>
    prisma.naturezaReceita.findMany({ orderBy: { codigo: 'asc' } }),
  );

  app.get('/api/cadastros/naturezas-despesa', async () => {
    const [grupos, modalidades, elementos] = await Promise.all([
      prisma.grupoNaturezaDespesa.findMany({ orderBy: { codigo: 'asc' } }),
      prisma.modalidadeAplicacao.findMany({ orderBy: { codigo: 'asc' } }),
      prisma.elementoDespesa.findMany({ orderBy: { codigo: 'asc' } }),
    ]);
    return { grupos, modalidades, elementos };
  });

  app.get('/api/cadastros/fontes', async () => prisma.fonteRecurso.findMany({ orderBy: { codigo: 'asc' } }));
}
