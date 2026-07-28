import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

let app: FastifyInstance;
let tokenCentral: string;
let tokenUnidade: string;

async function autenticar(email: string) {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, senha: 'loa2027' },
  });
  expect(resposta.statusCode).toBe(200);
  return resposta.json().token as string;
}

beforeAll(async () => {
  app = await criarApp();
  await app.ready();
  tokenCentral = await autenticar('orcamento@sepl.pr.gov.br');
  tokenUnidade = await autenticar('gos@sesa.pr.gov.br');
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('autenticacao e perfis', () => {
  it('rejeita credenciais invalidas', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'orcamento@sepl.pr.gov.br', senha: 'incorreta' },
    });
    expect(resposta.statusCode).toBe(401);
  });

  it('identifica o usuario autenticado e a unidade vinculada', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/auth/eu',
      headers: { authorization: `Bearer ${tokenUnidade}` },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({
      perfil: 'UNIDADE_ORCAMENTARIA',
      unidade: { codigo: '3000.3001' },
    });
  });

  it('impede que o perfil de consulta altere parametros fiscais', async () => {
    const token = await autenticar('consulta@pr.gov.br');
    const resposta = await app.inject({
      method: 'PUT',
      url: '/api/exercicios/2027/parametros/PERC_MIN_SAUDE',
      headers: { authorization: `Bearer ${token}` },
      payload: { valor: 5 },
    });
    expect(resposta.statusCode).toBe(403);
  });
});

describe('painel e cadastros', () => {
  it('apresenta o painel consolidado do exercicio equilibrado', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/exercicios/2027/painel' });
    expect(resposta.statusCode).toBe(200);
    const painel = resposta.json();
    expect(painel.exercicio.ano).toBe(2027);
    expect(painel.totais.receitaTotal).toBeGreaterThan(80_000_000_000);
    expect(painel.totais.diferenca).toBe(0);
    expect(painel.totais.quantidadeUnidades).toBeGreaterThan(50);
    expect(painel.totais.porFuncao[0]).toHaveProperty('nome');
  });

  it('lista a estrutura institucional e as classificacoes de referencia', async () => {
    const orgaos = await app.inject({ method: 'GET', url: '/api/cadastros/orgaos' });
    expect(orgaos.json().length).toBeGreaterThan(20);

    const funcoes = await app.inject({ method: 'GET', url: '/api/cadastros/funcoes' });
    const educacao = funcoes.json().find((f: { codigo: string }) => f.codigo === '12');
    expect(educacao.nome).toBe('Educacao');
    expect(educacao.subfuncoes.length).toBeGreaterThan(5);

    const naturezas = await app.inject({ method: 'GET', url: '/api/cadastros/naturezas-despesa' });
    expect(naturezas.json().grupos).toHaveLength(7);
  });
});

describe('captacao das propostas de despesa', () => {
  it('rejeita dotacao com elemento incompativel com o grupo de natureza', async () => {
    const [unidade, funcao, subfuncao, programa, grupo, modalidade, elemento, fonte] = await Promise.all([
      prisma.unidadeOrcamentaria.findFirstOrThrow({ where: { codigo: '3000.3001' } }),
      prisma.funcao.findFirstOrThrow({ where: { codigo: '10' } }),
      prisma.subfuncao.findFirstOrThrow({ where: { codigo: '302' } }),
      prisma.programa.findFirstOrThrow({ where: { codigo: '1101' } }),
      prisma.grupoNaturezaDespesa.findFirstOrThrow({ where: { codigo: '1' } }),
      prisma.modalidadeAplicacao.findFirstOrThrow({ where: { codigo: '90' } }),
      prisma.elementoDespesa.findFirstOrThrow({ where: { codigo: '51' } }),
      prisma.fonteRecurso.findFirstOrThrow({ where: { codigo: '500' } }),
    ]);
    const acao = await prisma.acao.findFirstOrThrow({ where: { programaId: programa.id, codigo: '2301' } });

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/exercicios/2027/dotacoes',
      headers: { authorization: `Bearer ${tokenCentral}` },
      payload: {
        unidadeId: unidade.id,
        funcaoId: funcao.id,
        subfuncaoId: subfuncao.id,
        programaId: programa.id,
        acaoId: acao.id,
        grupoId: grupo.id,
        modalidadeId: modalidade.id,
        elementoId: elemento.id,
        fonteId: fonte.id,
        valor: 1_000,
      },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro).toContain('nao e compativel com o grupo');
  });

  it('rejeita acao que nao pertence ao programa informado', async () => {
    const programa = await prisma.programa.findFirstOrThrow({ where: { codigo: '1101' } });
    const outraAcao = await prisma.acao.findFirstOrThrow({ where: { programa: { codigo: '1001' } } });
    const unidade = await prisma.unidadeOrcamentaria.findFirstOrThrow({ where: { codigo: '3000.3001' } });
    const [funcao, subfuncao, grupo, modalidade, elemento, fonte] = await Promise.all([
      prisma.funcao.findFirstOrThrow({ where: { codigo: '10' } }),
      prisma.subfuncao.findFirstOrThrow({ where: { codigo: '302' } }),
      prisma.grupoNaturezaDespesa.findFirstOrThrow({ where: { codigo: '3' } }),
      prisma.modalidadeAplicacao.findFirstOrThrow({ where: { codigo: '90' } }),
      prisma.elementoDespesa.findFirstOrThrow({ where: { codigo: '39' } }),
      prisma.fonteRecurso.findFirstOrThrow({ where: { codigo: '500' } }),
    ]);

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/exercicios/2027/dotacoes',
      headers: { authorization: `Bearer ${tokenCentral}` },
      payload: {
        unidadeId: unidade.id,
        funcaoId: funcao.id,
        subfuncaoId: subfuncao.id,
        programaId: programa.id,
        acaoId: outraAcao.id,
        grupoId: grupo.id,
        modalidadeId: modalidade.id,
        elementoId: elemento.id,
        fonteId: fonte.id,
        valor: 1_000,
      },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro).toContain('nao pertence ao programa');
  });

  it('impede que a unidade orcamentaria lance dotacao para outra unidade', async () => {
    const unidade = await prisma.unidadeOrcamentaria.findFirstOrThrow({ where: { codigo: '4000.4001' } });
    const programa = await prisma.programa.findFirstOrThrow({ where: { codigo: '1001' } });
    const acao = await prisma.acao.findFirstOrThrow({ where: { programaId: programa.id, codigo: '2101' } });
    const [funcao, subfuncao, grupo, modalidade, elemento, fonte] = await Promise.all([
      prisma.funcao.findFirstOrThrow({ where: { codigo: '12' } }),
      prisma.subfuncao.findFirstOrThrow({ where: { codigo: '368' } }),
      prisma.grupoNaturezaDespesa.findFirstOrThrow({ where: { codigo: '3' } }),
      prisma.modalidadeAplicacao.findFirstOrThrow({ where: { codigo: '90' } }),
      prisma.elementoDespesa.findFirstOrThrow({ where: { codigo: '39' } }),
      prisma.fonteRecurso.findFirstOrThrow({ where: { codigo: '500' } }),
    ]);

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/exercicios/2027/dotacoes',
      headers: { authorization: `Bearer ${tokenUnidade}` },
      payload: {
        unidadeId: unidade.id,
        funcaoId: funcao.id,
        subfuncaoId: subfuncao.id,
        programaId: programa.id,
        acaoId: acao.id,
        grupoId: grupo.id,
        modalidadeId: modalidade.id,
        elementoId: elemento.id,
        fonteId: fonte.id,
        valor: 1_000,
      },
    });
    expect(resposta.statusCode).toBe(403);
  });

  it('inclui, altera e exclui dotacao mantendo o registro de auditoria', async () => {
    const unidade = await prisma.unidadeOrcamentaria.findFirstOrThrow({ where: { codigo: '3000.3001' } });
    const programa = await prisma.programa.findFirstOrThrow({ where: { codigo: '1101' } });
    const acao = await prisma.acao.findFirstOrThrow({ where: { programaId: programa.id, codigo: '2301' } });
    const [funcao, subfuncao, grupo, modalidade, elemento, fonte] = await Promise.all([
      prisma.funcao.findFirstOrThrow({ where: { codigo: '10' } }),
      prisma.subfuncao.findFirstOrThrow({ where: { codigo: '302' } }),
      prisma.grupoNaturezaDespesa.findFirstOrThrow({ where: { codigo: '3' } }),
      prisma.modalidadeAplicacao.findFirstOrThrow({ where: { codigo: '90' } }),
      prisma.elementoDespesa.findFirstOrThrow({ where: { codigo: '39' } }),
      prisma.fonteRecurso.findFirstOrThrow({ where: { codigo: '500' } }),
    ]);

    const criacao = await app.inject({
      method: 'POST',
      url: '/api/exercicios/2027/dotacoes',
      headers: { authorization: `Bearer ${tokenCentral}` },
      payload: {
        unidadeId: unidade.id,
        funcaoId: funcao.id,
        subfuncaoId: subfuncao.id,
        programaId: programa.id,
        acaoId: acao.id,
        grupoId: grupo.id,
        modalidadeId: modalidade.id,
        elementoId: elemento.id,
        fonteId: fonte.id,
        valor: 2_500_000.555,
        justificativa: 'Dotacao de teste automatizado.',
      },
    });
    expect(criacao.statusCode).toBe(201);
    const dotacao = criacao.json();
    expect(dotacao.valor).toBe(2_500_000.56);
    expect(dotacao.categoria).toBe('3');

    const alteracao = await app.inject({
      method: 'PUT',
      url: `/api/dotacoes/${dotacao.id}`,
      headers: { authorization: `Bearer ${tokenCentral}` },
      payload: { valor: 3_000_000 },
    });
    expect(alteracao.statusCode).toBe(200);
    expect(alteracao.json().valor).toBe(3_000_000);

    const auditoria = await prisma.auditoria.findMany({
      where: { entidade: 'Dotacao', entidadeId: String(dotacao.id) },
      orderBy: { id: 'asc' },
    });
    expect(auditoria.map((a) => a.acao)).toEqual(['INCLUIR_DOTACAO', 'ALTERAR_DOTACAO']);

    const exclusao = await app.inject({
      method: 'DELETE',
      url: `/api/dotacoes/${dotacao.id}`,
      headers: { authorization: `Bearer ${tokenCentral}` },
    });
    expect(exclusao.statusCode).toBe(200);
  });

  it('exige que as deducoes de receita sejam lancadas com valor negativo', async () => {
    const natureza = await prisma.naturezaReceita.findFirstOrThrow({ where: { deducao: true } });
    const fonte = await prisma.fonteRecurso.findFirstOrThrow({ where: { codigo: '500' } });
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/exercicios/2027/receitas',
      headers: { authorization: `Bearer ${tokenCentral}` },
      payload: { naturezaId: natureza.id, fonteId: fonte.id, valor: 1_000 },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro).toContain('negativo');
  });

  it('demonstra a utilizacao dos tetos por unidade orcamentaria', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/exercicios/2027/limites' });
    expect(resposta.statusCode).toBe(200);
    const limites = resposta.json();
    expect(limites.length).toBeGreaterThan(50);
    for (const limite of limites) {
      expect(limite.utilizacao).toBeGreaterThan(0);
      expect(limite.utilizacao).toBeLessThanOrEqual(100);
    }
  });
});

describe('workflow das propostas', () => {
  it('percorre o fluxo de reabertura, envio, analise e homologacao', async () => {
    const proposta = await prisma.propostaUO.findFirstOrThrow({
      where: { unidade: { codigo: '7300.7301' } },
      include: { unidade: true },
    });

    const reabrir = await app.inject({
      method: 'POST',
      url: `/api/propostas/${proposta.id}/reabrir`,
      headers: { authorization: `Bearer ${tokenCentral}` },
    });
    expect(reabrir.statusCode).toBe(200);
    expect(reabrir.json().status).toBe('EM_ELABORACAO');

    const enviar = await app.inject({
      method: 'POST',
      url: `/api/propostas/${proposta.id}/enviar`,
      headers: { authorization: `Bearer ${tokenCentral}` },
    });
    expect(enviar.statusCode).toBe(200);
    expect(enviar.json().status).toBe('ENVIADA');

    const homologar = await app.inject({
      method: 'POST',
      url: `/api/propostas/${proposta.id}/homologar`,
      headers: { authorization: `Bearer ${tokenCentral}` },
      payload: { parecer: 'Proposta homologada em teste automatizado.' },
    });
    expect(homologar.statusCode).toBe(200);
    expect(homologar.json()).toMatchObject({ status: 'HOMOLOGADA', parecer: 'Proposta homologada em teste automatizado.' });
  });

  it('impede o envio de proposta ja homologada', async () => {
    const proposta = await prisma.propostaUO.findFirstOrThrow({ where: { status: 'HOMOLOGADA' } });
    const resposta = await app.inject({
      method: 'POST',
      url: `/api/propostas/${proposta.id}/enviar`,
      headers: { authorization: `Bearer ${tokenCentral}` },
    });
    expect(resposta.statusCode).toBe(409);
  });
});

describe('validacao, consolidacao e anexos', () => {
  it('executa o motor de regras e aprova a proposta consolidada', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/exercicios/2027/validacao',
      headers: { authorization: `Bearer ${tokenCentral}` },
    });
    expect(resposta.statusCode).toBe(200);
    const relatorio = resposta.json();
    expect(relatorio.totalRegras).toBe(18);
    expect(relatorio.totalErros).toBe(0);
    expect(relatorio.aprovado).toBe(true);

    const persistida = await app.inject({ method: 'GET', url: '/api/exercicios/2027/validacao' });
    expect(persistida.json().execucaoId).toBe(relatorio.execucaoId);
    expect(persistida.json().resultados).toHaveLength(18);
  });

  it('consolida o orcamento gerando versao e hash de integridade', async () => {
    const primeira = await app.inject({
      method: 'POST',
      url: '/api/exercicios/2027/consolidacao',
      headers: { authorization: `Bearer ${tokenCentral}` },
    });
    expect(primeira.statusCode).toBe(200);
    const consolidacao = primeira.json();
    expect(consolidacao.equilibrada).toBe(true);
    expect(consolidacao.validacaoOk).toBe(true);
    expect(consolidacao.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(consolidacao.receitaTotal).toBe(consolidacao.despesaTotal);

    const segunda = await app.inject({
      method: 'POST',
      url: '/api/exercicios/2027/consolidacao',
      headers: { authorization: `Bearer ${tokenCentral}` },
    });
    expect(segunda.json().versao).toBe(consolidacao.versao + 1);
    expect(segunda.json().hash).toBe(consolidacao.hash);
  });

  it('gera todos os anexos em JSON com receita e despesa coincidentes', async () => {
    const lista = await app.inject({ method: 'GET', url: '/api/exercicios/2027/anexos' });
    const anexos = lista.json() as { codigo: string }[];
    expect(anexos.length).toBe(12);

    for (const anexo of anexos) {
      const resposta = await app.inject({ method: 'GET', url: `/api/exercicios/2027/anexos/${anexo.codigo}` });
      expect(resposta.statusCode, anexo.codigo).toBe(200);
      expect(resposta.json().linhas.length, anexo.codigo).toBeGreaterThan(0);
    }

    const anexo1 = await app.inject({ method: 'GET', url: '/api/exercicios/2027/anexos/anexo-01' });
    const total = anexo1.json().linhas.at(-1);
    expect(total.receita).toBe(total.valorDespesa);
  });

  it('exporta anexos em CSV, XLSX e PDF', async () => {
    const csv = await app.inject({ method: 'GET', url: '/api/exercicios/2027/anexos/anexo-09?formato=csv' });
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body).toContain('Orgao;Denominacao;Funcao;Valor (R$)');
    expect(csv.body).toContain('TOTAL');

    const xlsx = await app.inject({ method: 'GET', url: '/api/exercicios/2027/anexos/anexo-01?formato=xlsx' });
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
    expect(xlsx.rawPayload.subarray(0, 2).toString()).toBe('PK');

    const pdf = await app.inject({ method: 'GET', url: '/api/exercicios/2027/anexos/demonstrativo-vinculacoes?formato=pdf' });
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('gera o texto do projeto de lei com os valores consolidados', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/exercicios/2027/projeto-lei?formato=txt' });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.body).toContain('PROJETO DE LEI ORCAMENTARIA ANUAL - EXERCICIO DE 2027');
    expect(resposta.body).toContain('Art. 3o A despesa total e fixada em');
    expect(resposta.body).toMatch(/bilhoes/);
  });

  it('filtra o quadro de detalhamento da despesa por unidade e fonte', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/exercicios/2027/dotacoes?unidade=4000.4003&porPagina=100',
    });
    expect(resposta.statusCode).toBe(200);
    const pagina = resposta.json();
    expect(pagina.total).toBeGreaterThan(0);
    for (const item of pagina.itens) {
      expect(item.unidade.codigo).toBe('4000.4003');
      expect(item.fonte.codigo).toMatch(/^54[0-3]$/);
    }
  });
});
