import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { registrarAuditoria } from '../lib/auditoria.js';
import { conflito, naoEncontrado, proibido, requisicaoInvalida } from '../lib/erros.js';
import { centavos } from '../lib/money.js';
import { prisma } from '../lib/prisma.js';
import { totalizacoes } from '../servicos/anexos.js';
import { carregarSnapshot } from '../servicos/snapshot.js';
import { validarUnidade } from '../dominio/validacao.js';

const PERFIS_CENTRAIS = ['ADMIN', 'ORGAO_CENTRAL'];
const STATUS_EDITAVEIS = ['EM_ELABORACAO', 'DEVOLVIDA'];
const TODOS_OS_STATUS = ['EM_ELABORACAO', 'ENVIADA', 'EM_ANALISE', 'DEVOLVIDA', 'HOMOLOGADA'];

async function exercicioPorAno(ano: number) {
  const exercicio = await prisma.exercicio.findUnique({ where: { ano } });
  if (!exercicio) throw naoEncontrado(`Exercicio ${ano} nao encontrado.`);
  return exercicio;
}

const paramsAno = z.object({ ano: z.coerce.number().int().min(2000).max(2100) });

export async function rotasOrcamento(app: FastifyInstance) {
  // -------------------------------------------------------------------------
  // Exercicios e parametros
  // -------------------------------------------------------------------------
  app.get('/api/exercicios', async () => {
    const exercicios = await prisma.exercicio.findMany({ orderBy: { ano: 'desc' } });
    return exercicios;
  });

  app.get('/api/exercicios/:ano', async (requisicao) => {
    const { ano } = paramsAno.parse(requisicao.params);
    const exercicio = await exercicioPorAno(ano);
    const parametros = await prisma.parametroFiscal.findMany({
      where: { exercicioId: exercicio.id },
      orderBy: { chave: 'asc' },
    });
    return { ...exercicio, parametros };
  });

  app.put('/api/exercicios/:ano/parametros/:chave', { onRequest: [app.autenticar] }, async (requisicao) => {
    if (!PERFIS_CENTRAIS.includes(requisicao.usuario.perfil)) throw proibido();
    const { ano } = paramsAno.parse(requisicao.params);
    const { chave } = z.object({ chave: z.string().min(2) }).parse(requisicao.params);
    const { valor } = z.object({ valor: z.number() }).parse(requisicao.body);
    const exercicio = await exercicioPorAno(ano);

    const parametro = await prisma.parametroFiscal.update({
      where: { exercicioId_chave: { exercicioId: exercicio.id, chave } },
      data: { valor },
    });
    await registrarAuditoria({
      usuarioId: requisicao.usuario.sub,
      acao: 'ATUALIZAR_PARAMETRO',
      entidade: 'ParametroFiscal',
      entidadeId: parametro.id,
      detalhes: { chave, valor },
    });
    return parametro;
  });

  // -------------------------------------------------------------------------
  // Painel consolidado
  // -------------------------------------------------------------------------
  app.get('/api/exercicios/:ano/painel', async (requisicao) => {
    const { ano } = paramsAno.parse(requisicao.params);
    const exercicio = await exercicioPorAno(ano);
    const snapshot = await carregarSnapshot(ano);
    const totais = totalizacoes(snapshot);

    const propostas = await prisma.propostaUO.groupBy({
      by: ['status'],
      where: { exercicioId: exercicio.id },
      _count: { _all: true },
    });

    const ultimaValidacao = await prisma.execucaoValidacao.findFirst({
      where: { exercicioId: exercicio.id, escopo: 'GLOBAL' },
      orderBy: { executadaEm: 'desc' },
    });
    const ultimaConsolidacao = await prisma.consolidacao.findFirst({
      where: { exercicioId: exercicio.id },
      orderBy: { versao: 'desc' },
    });

    return {
      exercicio: { ano: exercicio.ano, status: exercicio.status, ppaInicio: exercicio.ppaInicio, ppaFim: exercicio.ppaFim, dataLimiteUO: exercicio.dataLimiteUO, dataEnvioAlep: exercicio.dataEnvioAlep },
      parametros: snapshot.parametros,
      totais,
      propostas: propostas.map((p) => ({ status: p.status, quantidade: p._count._all })),
      ultimaValidacao,
      ultimaConsolidacao,
    };
  });

  // -------------------------------------------------------------------------
  // Receita prevista
  // -------------------------------------------------------------------------
  app.get('/api/exercicios/:ano/receitas', async (requisicao) => {
    const { ano } = paramsAno.parse(requisicao.params);
    const exercicio = await exercicioPorAno(ano);
    const receitas = await prisma.receitaPrevista.findMany({
      where: { exercicioId: exercicio.id },
      include: { natureza: true, fonte: true },
      orderBy: [{ natureza: { codigo: 'asc' } }, { id: 'asc' }],
    });
    return receitas.map((r) => ({
      id: r.id,
      natureza: { codigo: r.natureza.codigo, nome: r.natureza.nome, categoria: r.natureza.categoria, deducao: r.natureza.deducao },
      fonte: { codigo: r.fonte.codigo, nome: r.fonte.nome },
      esfera: r.esfera,
      valor: r.valor,
      memoriaCalculo: r.memoriaCalculo,
    }));
  });

  const receitaSchema = z.object({
    naturezaId: z.number().int(),
    fonteId: z.number().int(),
    esfera: z.enum(['F', 'S', 'I']).default('F'),
    valor: z.number(),
    memoriaCalculo: z.string().max(2000).optional(),
  });

  app.post('/api/exercicios/:ano/receitas', { onRequest: [app.autenticar] }, async (requisicao, resposta) => {
    if (!PERFIS_CENTRAIS.includes(requisicao.usuario.perfil)) throw proibido();
    const { ano } = paramsAno.parse(requisicao.params);
    const exercicio = await exercicioPorAno(ano);
    const dados = receitaSchema.parse(requisicao.body);

    const natureza = await prisma.naturezaReceita.findUnique({ where: { id: dados.naturezaId } });
    if (!natureza) throw requisicaoInvalida('Natureza de receita inexistente.');
    if (natureza.deducao && dados.valor > 0) {
      throw requisicaoInvalida('Deducoes de receita devem ser lancadas com valor negativo.');
    }
    if (!natureza.deducao && dados.valor <= 0) {
      throw requisicaoInvalida('A receita prevista deve ser maior que zero.');
    }

    const receita = await prisma.receitaPrevista.create({
      data: { ...dados, valor: centavos(dados.valor), exercicioId: exercicio.id },
    });
    await registrarAuditoria({
      usuarioId: requisicao.usuario.sub,
      acao: 'INCLUIR_RECEITA',
      entidade: 'ReceitaPrevista',
      entidadeId: receita.id,
      detalhes: dados,
    });
    return resposta.status(201).send(receita);
  });

  app.put('/api/receitas/:id', { onRequest: [app.autenticar] }, async (requisicao) => {
    if (!PERFIS_CENTRAIS.includes(requisicao.usuario.perfil)) throw proibido();
    const { id } = z.object({ id: z.coerce.number().int() }).parse(requisicao.params);
    const dados = receitaSchema.partial().parse(requisicao.body);
    const atual = await prisma.receitaPrevista.findUnique({ where: { id }, include: { natureza: true } });
    if (!atual) throw naoEncontrado('Receita nao encontrada.');

    const valor = dados.valor === undefined ? atual.valor : centavos(dados.valor);
    if (atual.natureza.deducao && valor > 0) throw requisicaoInvalida('Deducoes de receita devem ter valor negativo.');
    if (!atual.natureza.deducao && valor <= 0) throw requisicaoInvalida('A receita prevista deve ser maior que zero.');

    const receita = await prisma.receitaPrevista.update({ where: { id }, data: { ...dados, valor } });
    await registrarAuditoria({
      usuarioId: requisicao.usuario.sub,
      acao: 'ALTERAR_RECEITA',
      entidade: 'ReceitaPrevista',
      entidadeId: id,
      detalhes: { de: atual.valor, para: valor },
    });
    return receita;
  });

  app.delete('/api/receitas/:id', { onRequest: [app.autenticar] }, async (requisicao) => {
    if (!PERFIS_CENTRAIS.includes(requisicao.usuario.perfil)) throw proibido();
    const { id } = z.object({ id: z.coerce.number().int() }).parse(requisicao.params);
    await prisma.receitaPrevista.delete({ where: { id } });
    await registrarAuditoria({ usuarioId: requisicao.usuario.sub, acao: 'EXCLUIR_RECEITA', entidade: 'ReceitaPrevista', entidadeId: id });
    return { removido: true };
  });

  // -------------------------------------------------------------------------
  // Propostas das unidades orcamentarias
  // -------------------------------------------------------------------------
  app.get('/api/exercicios/:ano/propostas', async (requisicao) => {
    const { ano } = paramsAno.parse(requisicao.params);
    const exercicio = await exercicioPorAno(ano);
    const propostas = await prisma.propostaUO.findMany({
      where: { exercicioId: exercicio.id },
      include: { unidade: { include: { orgao: true } }, dotacoes: { select: { valor: true } } },
      orderBy: { unidade: { codigo: 'asc' } },
    });
    const limites = await prisma.limiteOrcamentario.findMany({ where: { exercicioId: exercicio.id, escopo: 'TOTAL' } });

    return propostas.map((p) => {
      const total = centavos(p.dotacoes.reduce((t, d) => t + d.valor, 0));
      const limite = limites.find((l) => l.unidadeId === p.unidadeId);
      return {
        id: p.id,
        status: p.status,
        versao: p.versao,
        enviadaEm: p.enviadaEm,
        analisadaEm: p.analisadaEm,
        parecer: p.parecer,
        unidade: { id: p.unidade.id, codigo: p.unidade.codigo, sigla: p.unidade.sigla, nome: p.unidade.nome },
        orgao: { codigo: p.unidade.orgao.codigo, sigla: p.unidade.orgao.sigla, poder: p.unidade.orgao.poder },
        quantidadeDotacoes: p.dotacoes.length,
        total,
        teto: limite?.valor ?? null,
        saldoTeto: limite ? centavos(limite.valor - total) : null,
      };
    });
  });

  const transicoes: Record<string, { destino: string; perfis: string[] }> = {
    enviar: { destino: 'ENVIADA', perfis: ['ADMIN', 'ORGAO_CENTRAL', 'UNIDADE_ORCAMENTARIA'] },
    analisar: { destino: 'EM_ANALISE', perfis: PERFIS_CENTRAIS },
    devolver: { destino: 'DEVOLVIDA', perfis: PERFIS_CENTRAIS },
    homologar: { destino: 'HOMOLOGADA', perfis: PERFIS_CENTRAIS },
    reabrir: { destino: 'EM_ELABORACAO', perfis: PERFIS_CENTRAIS },
  };

  app.post('/api/propostas/:id/:acao', { onRequest: [app.autenticar] }, async (requisicao) => {
    const { id, acao } = z
      .object({ id: z.coerce.number().int(), acao: z.enum(['enviar', 'analisar', 'devolver', 'homologar', 'reabrir']) })
      .parse(requisicao.params);
    const { parecer } = z.object({ parecer: z.string().max(2000).optional() }).parse(requisicao.body ?? {});

    const transicao = transicoes[acao];
    if (!transicao.perfis.includes(requisicao.usuario.perfil)) throw proibido();

    const proposta = await prisma.propostaUO.findUnique({ where: { id }, include: { unidade: true, dotacoes: true } });
    if (!proposta) throw naoEncontrado('Proposta nao encontrada.');
    if (requisicao.usuario.perfil === 'UNIDADE_ORCAMENTARIA' && requisicao.usuario.unidadeId !== proposta.unidadeId) {
      throw proibido('A proposta pertence a outra unidade orcamentaria.');
    }

    if (acao === 'enviar') {
      if (!STATUS_EDITAVEIS.includes(proposta.status)) {
        throw conflito(`Proposta com status ${proposta.status} nao pode ser enviada.`);
      }
      if (proposta.dotacoes.length === 0) throw conflito('Proposta sem dotacoes nao pode ser enviada.');

      const exercicio = await prisma.exercicio.findUniqueOrThrow({ where: { id: proposta.exercicioId } });
      const snapshot = await carregarSnapshot(exercicio.ano, TODOS_OS_STATUS);
      const relatorio = validarUnidade(snapshot, proposta.unidade.codigo);
      if (!relatorio.aprovado) {
        throw conflito('A proposta possui inconsistencias que impedem o envio.', relatorio.resultados.filter((r) => !r.aprovado));
      }
    }

    const atualizada = await prisma.propostaUO.update({
      where: { id },
      data: {
        status: transicao.destino,
        parecer: parecer ?? proposta.parecer,
        enviadaEm: acao === 'enviar' ? new Date() : proposta.enviadaEm,
        analisadaEm: ['analisar', 'devolver', 'homologar'].includes(acao) ? new Date() : proposta.analisadaEm,
        versao: acao === 'reabrir' ? proposta.versao + 1 : proposta.versao,
      },
    });

    await registrarAuditoria({
      usuarioId: requisicao.usuario.sub,
      acao: `PROPOSTA_${acao.toUpperCase()}`,
      entidade: 'PropostaUO',
      entidadeId: id,
      detalhes: { de: proposta.status, para: transicao.destino, parecer },
    });
    return atualizada;
  });

  // -------------------------------------------------------------------------
  // Dotacoes (Quadro de Detalhamento da Despesa)
  // -------------------------------------------------------------------------
  app.get('/api/exercicios/:ano/dotacoes', async (requisicao) => {
    const { ano } = paramsAno.parse(requisicao.params);
    const filtros = z
      .object({
        unidade: z.string().optional(),
        orgao: z.string().optional(),
        funcao: z.string().optional(),
        programa: z.string().optional(),
        fonte: z.string().optional(),
        grupo: z.string().optional(),
        pagina: z.coerce.number().int().min(1).default(1),
        porPagina: z.coerce.number().int().min(1).max(500).default(50),
      })
      .parse(requisicao.query);

    const exercicio = await exercicioPorAno(ano);
    const where = {
      proposta: { exercicioId: exercicio.id },
      ...(filtros.unidade ? { unidade: { codigo: filtros.unidade } } : {}),
      ...(filtros.orgao ? { unidade: { orgao: { codigo: filtros.orgao } } } : {}),
      ...(filtros.funcao ? { funcao: { codigo: filtros.funcao } } : {}),
      ...(filtros.programa ? { programa: { codigo: filtros.programa } } : {}),
      ...(filtros.fonte ? { fonte: { codigo: filtros.fonte } } : {}),
      ...(filtros.grupo ? { grupo: { codigo: filtros.grupo } } : {}),
    };

    const [total, agregado, dotacoes] = await Promise.all([
      prisma.dotacao.count({ where }),
      prisma.dotacao.aggregate({ where, _sum: { valor: true } }),
      prisma.dotacao.findMany({
        where,
        include: {
          proposta: true,
          unidade: { include: { orgao: true } },
          funcao: true,
          subfuncao: true,
          programa: true,
          acao: true,
          grupo: true,
          modalidade: true,
          elemento: true,
          fonte: true,
        },
        orderBy: [{ unidade: { codigo: 'asc' } }, { id: 'asc' }],
        skip: (filtros.pagina - 1) * filtros.porPagina,
        take: filtros.porPagina,
      }),
    ]);

    return {
      total,
      somaValor: centavos(agregado._sum.valor ?? 0),
      pagina: filtros.pagina,
      porPagina: filtros.porPagina,
      itens: dotacoes.map((d) => ({
        id: d.id,
        propostaId: d.propostaId,
        propostaStatus: d.proposta.status,
        unidade: { codigo: d.unidade.codigo, sigla: d.unidade.sigla, nome: d.unidade.nome },
        orgao: { codigo: d.unidade.orgao.codigo, sigla: d.unidade.orgao.sigla },
        funcao: { codigo: d.funcao.codigo, nome: d.funcao.nome },
        subfuncao: { codigo: d.subfuncao.codigo, nome: d.subfuncao.nome },
        programa: { codigo: d.programa.codigo, nome: d.programa.nome },
        acao: { codigo: d.acao.codigo, nome: d.acao.nome, tipo: d.acao.tipo },
        subtitulo: d.subtitulo,
        localizador: d.localizador,
        esfera: d.esfera,
        natureza: `${d.categoria}.${d.grupo.codigo}.${d.modalidade.codigo}.${d.elemento.codigo}`,
        grupo: { codigo: d.grupo.codigo, nome: d.grupo.nome },
        modalidade: { codigo: d.modalidade.codigo, nome: d.modalidade.nome },
        elemento: { codigo: d.elemento.codigo, nome: d.elemento.nome },
        fonte: { codigo: d.fonte.codigo, nome: d.fonte.nome },
        rp: d.rp,
        valor: d.valor,
        justificativa: d.justificativa,
      })),
    };
  });

  const dotacaoSchema = z.object({
    unidadeId: z.number().int(),
    funcaoId: z.number().int(),
    subfuncaoId: z.number().int(),
    programaId: z.number().int(),
    acaoId: z.number().int(),
    subtitulo: z.string().min(1).max(8).default('0000'),
    localizador: z.string().max(120).optional(),
    esfera: z.enum(['F', 'S', 'I']).default('F'),
    grupoId: z.number().int(),
    modalidadeId: z.number().int(),
    elementoId: z.number().int(),
    fonteId: z.number().int(),
    iduso: z.string().max(1).default('0'),
    rp: z.string().max(1).default('2'),
    valor: z.number().positive(),
    justificativa: z.string().max(2000).optional(),
  });

  async function validarClassificacao(dados: z.infer<typeof dotacaoSchema>) {
    const [grupo, elemento, acao] = await Promise.all([
      prisma.grupoNaturezaDespesa.findUnique({ where: { id: dados.grupoId } }),
      prisma.elementoDespesa.findUnique({ where: { id: dados.elementoId } }),
      prisma.acao.findUnique({ where: { id: dados.acaoId }, include: { programa: true } }),
    ]);
    if (!grupo) throw requisicaoInvalida('Grupo de natureza da despesa inexistente.');
    if (!elemento) throw requisicaoInvalida('Elemento de despesa inexistente.');
    if (!acao) throw requisicaoInvalida('Acao inexistente.');
    if (acao.programaId !== dados.programaId) {
      throw requisicaoInvalida('A acao informada nao pertence ao programa selecionado.');
    }
    if (!elemento.grupos.split(',').map((g) => g.trim()).includes(grupo.codigo)) {
      throw requisicaoInvalida(
        `O elemento ${elemento.codigo} - ${elemento.nome} nao e compativel com o grupo ${grupo.codigo} - ${grupo.nome}.`,
      );
    }
    return { grupo, elemento, acao };
  }

  app.post('/api/exercicios/:ano/dotacoes', { onRequest: [app.autenticar] }, async (requisicao, resposta) => {
    const { ano } = paramsAno.parse(requisicao.params);
    const exercicio = await exercicioPorAno(ano);
    const dados = dotacaoSchema.parse(requisicao.body);

    if (requisicao.usuario.perfil === 'UNIDADE_ORCAMENTARIA' && requisicao.usuario.unidadeId !== dados.unidadeId) {
      throw proibido('Nao e permitido lancar dotacao para outra unidade orcamentaria.');
    }
    if (!['ADMIN', 'ORGAO_CENTRAL', 'UNIDADE_ORCAMENTARIA'].includes(requisicao.usuario.perfil)) throw proibido();

    const { grupo } = await validarClassificacao(dados);

    let proposta = await prisma.propostaUO.findUnique({
      where: { exercicioId_unidadeId: { exercicioId: exercicio.id, unidadeId: dados.unidadeId } },
    });
    if (!proposta) {
      proposta = await prisma.propostaUO.create({
        data: { exercicioId: exercicio.id, unidadeId: dados.unidadeId, status: 'EM_ELABORACAO' },
      });
    }
    if (requisicao.usuario.perfil === 'UNIDADE_ORCAMENTARIA' && !STATUS_EDITAVEIS.includes(proposta.status)) {
      throw conflito(`Proposta com status ${proposta.status} nao aceita alteracoes pela unidade orcamentaria.`);
    }

    const dotacao = await prisma.dotacao.create({
      data: {
        ...dados,
        valor: centavos(dados.valor),
        categoria: grupo.categoria,
        propostaId: proposta.id,
      },
    });
    await registrarAuditoria({
      usuarioId: requisicao.usuario.sub,
      acao: 'INCLUIR_DOTACAO',
      entidade: 'Dotacao',
      entidadeId: dotacao.id,
      detalhes: dados,
    });
    return resposta.status(201).send(dotacao);
  });

  app.put('/api/dotacoes/:id', { onRequest: [app.autenticar] }, async (requisicao) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(requisicao.params);
    const atual = await prisma.dotacao.findUnique({ where: { id }, include: { proposta: true } });
    if (!atual) throw naoEncontrado('Dotacao nao encontrada.');

    if (requisicao.usuario.perfil === 'UNIDADE_ORCAMENTARIA') {
      if (requisicao.usuario.unidadeId !== atual.unidadeId) throw proibido();
      if (!STATUS_EDITAVEIS.includes(atual.proposta.status)) {
        throw conflito(`Proposta com status ${atual.proposta.status} nao aceita alteracoes.`);
      }
    } else if (!PERFIS_CENTRAIS.includes(requisicao.usuario.perfil)) {
      throw proibido();
    }

    const dados = dotacaoSchema.partial().parse(requisicao.body);
    const mesclado = { ...atual, ...dados } as z.infer<typeof dotacaoSchema>;
    const { grupo } = await validarClassificacao(mesclado);

    const dotacao = await prisma.dotacao.update({
      where: { id },
      data: {
        ...dados,
        ...(dados.valor === undefined ? {} : { valor: centavos(dados.valor) }),
        categoria: grupo.categoria,
      },
    });
    await registrarAuditoria({
      usuarioId: requisicao.usuario.sub,
      acao: 'ALTERAR_DOTACAO',
      entidade: 'Dotacao',
      entidadeId: id,
      detalhes: { de: atual.valor, para: dotacao.valor },
    });
    return dotacao;
  });

  app.delete('/api/dotacoes/:id', { onRequest: [app.autenticar] }, async (requisicao) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(requisicao.params);
    const atual = await prisma.dotacao.findUnique({ where: { id }, include: { proposta: true } });
    if (!atual) throw naoEncontrado('Dotacao nao encontrada.');
    if (requisicao.usuario.perfil === 'UNIDADE_ORCAMENTARIA') {
      if (requisicao.usuario.unidadeId !== atual.unidadeId) throw proibido();
      if (!STATUS_EDITAVEIS.includes(atual.proposta.status)) throw conflito('Proposta nao aceita alteracoes.');
    } else if (!PERFIS_CENTRAIS.includes(requisicao.usuario.perfil)) {
      throw proibido();
    }

    await prisma.dotacao.delete({ where: { id } });
    await registrarAuditoria({ usuarioId: requisicao.usuario.sub, acao: 'EXCLUIR_DOTACAO', entidade: 'Dotacao', entidadeId: id });
    return { removido: true };
  });

  // -------------------------------------------------------------------------
  // Limites (tetos) e emendas
  // -------------------------------------------------------------------------
  app.get('/api/exercicios/:ano/limites', async (requisicao) => {
    const { ano } = paramsAno.parse(requisicao.params);
    const exercicio = await exercicioPorAno(ano);
    const limites = await prisma.limiteOrcamentario.findMany({
      where: { exercicioId: exercicio.id },
      include: { unidade: { include: { orgao: true } } },
      orderBy: { unidade: { codigo: 'asc' } },
    });
    const dotacoes = await prisma.dotacao.groupBy({
      by: ['unidadeId'],
      where: { proposta: { exercicioId: exercicio.id } },
      _sum: { valor: true },
    });

    return limites.map((l) => {
      const proposto = centavos(dotacoes.find((d) => d.unidadeId === l.unidadeId)?._sum.valor ?? 0);
      return {
        id: l.id,
        unidade: { codigo: l.unidade.codigo, sigla: l.unidade.sigla, nome: l.unidade.nome },
        orgao: { codigo: l.unidade.orgao.codigo, sigla: l.unidade.orgao.sigla },
        escopo: l.escopo,
        valor: l.valor,
        proposto,
        saldo: centavos(l.valor - proposto),
        utilizacao: l.valor === 0 ? 0 : (proposto / l.valor) * 100,
        observacao: l.observacao,
      };
    });
  });

  app.put('/api/limites/:id', { onRequest: [app.autenticar] }, async (requisicao) => {
    if (!PERFIS_CENTRAIS.includes(requisicao.usuario.perfil)) throw proibido();
    const { id } = z.object({ id: z.coerce.number().int() }).parse(requisicao.params);
    const { valor, observacao } = z.object({ valor: z.number().nonnegative(), observacao: z.string().max(500).optional() }).parse(requisicao.body);
    const limite = await prisma.limiteOrcamentario.update({ where: { id }, data: { valor: centavos(valor), observacao } });
    await registrarAuditoria({ usuarioId: requisicao.usuario.sub, acao: 'ATUALIZAR_TETO', entidade: 'LimiteOrcamentario', entidadeId: id, detalhes: { valor } });
    return limite;
  });

  app.get('/api/exercicios/:ano/emendas', async (requisicao) => {
    const { ano } = paramsAno.parse(requisicao.params);
    const exercicio = await exercicioPorAno(ano);
    const emendas = await prisma.emendaParlamentar.findMany({
      where: { exercicioId: exercicio.id },
      include: { unidade: true, acao: true },
      orderBy: { numero: 'asc' },
    });
    return emendas.map((e) => ({
      id: e.id,
      numero: e.numero,
      autor: e.autor,
      tipo: e.tipo,
      objeto: e.objeto,
      municipio: e.municipio,
      valor: e.valor,
      status: e.status,
      unidade: { codigo: e.unidade.codigo, sigla: e.unidade.sigla },
      acao: e.acao ? { codigo: e.acao.codigo, nome: e.acao.nome } : null,
    }));
  });

  app.get('/api/auditoria', { onRequest: [app.autenticar] }, async (requisicao) => {
    const { limite } = z.object({ limite: z.coerce.number().int().min(1).max(500).default(100) }).parse(requisicao.query);
    const registros = await prisma.auditoria.findMany({
      orderBy: { criadoEm: 'desc' },
      take: limite,
      include: { usuario: true },
    });
    return registros.map((r) => ({
      id: r.id,
      acao: r.acao,
      entidade: r.entidade,
      entidadeId: r.entidadeId,
      detalhes: r.detalhes ? JSON.parse(r.detalhes) : null,
      criadoEm: r.criadoEm,
      usuario: r.usuario ? { nome: r.usuario.nome, email: r.usuario.email, perfil: r.usuario.perfil } : null,
    }));
  });
}
