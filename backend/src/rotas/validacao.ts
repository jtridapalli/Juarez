import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { registrarAuditoria } from '../lib/auditoria.js';
import { naoEncontrado, proibido } from '../lib/erros.js';
import { prisma } from '../lib/prisma.js';
import { validarOrcamento, validarUnidade } from '../dominio/validacao.js';
import { totalizacoes } from '../servicos/anexos.js';
import { carregarSnapshot } from '../servicos/snapshot.js';

const paramsAno = z.object({ ano: z.coerce.number().int().min(2000).max(2100) });
const PERFIS_CENTRAIS = ['ADMIN', 'ORGAO_CENTRAL', 'CONTROLE_INTERNO'];

export async function rotasValidacao(app: FastifyInstance) {
  /** Executa o motor de regras e persiste o resultado. */
  app.post('/api/exercicios/:ano/validacao', { onRequest: [app.autenticar] }, async (requisicao) => {
    if (!PERFIS_CENTRAIS.includes(requisicao.usuario.perfil)) throw proibido();
    const { ano } = paramsAno.parse(requisicao.params);
    const exercicio = await prisma.exercicio.findUnique({ where: { ano } });
    if (!exercicio) throw naoEncontrado(`Exercicio ${ano} nao encontrado.`);

    const snapshot = await carregarSnapshot(ano);
    const relatorio = validarOrcamento(snapshot);

    const execucao = await prisma.execucaoValidacao.create({
      data: {
        exercicioId: exercicio.id,
        escopo: 'GLOBAL',
        totalRegras: relatorio.totalRegras,
        totalErros: relatorio.totalErros,
        totalAlertas: relatorio.totalAlertas,
        aprovado: relatorio.aprovado,
        resultados: {
          create: relatorio.resultados.map((r) => ({
            regra: r.regra,
            titulo: r.titulo,
            severidade: r.severidade,
            aprovado: r.aprovado,
            mensagem: r.mensagem,
            fundamento: r.fundamento ?? null,
            valorApurado: r.valorApurado ?? null,
            valorReferencia: r.valorReferencia ?? null,
            detalhes: r.detalhes === undefined ? null : JSON.stringify(r.detalhes),
          })),
        },
      },
      include: { resultados: true },
    });

    await registrarAuditoria({
      usuarioId: requisicao.usuario.sub,
      acao: 'EXECUTAR_VALIDACAO',
      entidade: 'ExecucaoValidacao',
      entidadeId: execucao.id,
      detalhes: { erros: relatorio.totalErros, alertas: relatorio.totalAlertas },
    });

    return { execucaoId: execucao.id, ...relatorio };
  });

  /** Ultima validacao global registrada. */
  app.get('/api/exercicios/:ano/validacao', async (requisicao) => {
    const { ano } = paramsAno.parse(requisicao.params);
    const exercicio = await prisma.exercicio.findUnique({ where: { ano } });
    if (!exercicio) throw naoEncontrado(`Exercicio ${ano} nao encontrado.`);

    const execucao = await prisma.execucaoValidacao.findFirst({
      where: { exercicioId: exercicio.id, escopo: 'GLOBAL' },
      orderBy: { executadaEm: 'desc' },
      include: { resultados: { orderBy: { regra: 'asc' } } },
    });
    if (!execucao) return null;

    return {
      execucaoId: execucao.id,
      exercicio: ano,
      executadaEm: execucao.executadaEm,
      totalRegras: execucao.totalRegras,
      totalErros: execucao.totalErros,
      totalAlertas: execucao.totalAlertas,
      aprovado: execucao.aprovado,
      resultados: execucao.resultados.map((r) => ({
        regra: r.regra,
        titulo: r.titulo,
        severidade: r.severidade,
        aprovado: r.aprovado,
        mensagem: r.mensagem,
        fundamento: r.fundamento,
        valorApurado: r.valorApurado,
        valorReferencia: r.valorReferencia,
        detalhes: r.detalhes ? JSON.parse(r.detalhes) : null,
      })),
    };
  });

  /** Validacao previa de uma unidade orcamentaria. */
  app.get('/api/exercicios/:ano/validacao/unidade/:codigo', async (requisicao) => {
    const { ano } = paramsAno.parse(requisicao.params);
    const { codigo } = z.object({ codigo: z.string().min(4) }).parse(requisicao.params);
    const snapshot = await carregarSnapshot(ano, ['EM_ELABORACAO', 'ENVIADA', 'EM_ANALISE', 'DEVOLVIDA', 'HOMOLOGADA']);
    return validarUnidade(snapshot, codigo);
  });

  /** Consolida o orcamento, gerando uma versao numerada e assinada por hash. */
  app.post('/api/exercicios/:ano/consolidacao', { onRequest: [app.autenticar] }, async (requisicao) => {
    if (!['ADMIN', 'ORGAO_CENTRAL'].includes(requisicao.usuario.perfil)) throw proibido();
    const { ano } = paramsAno.parse(requisicao.params);
    const exercicio = await prisma.exercicio.findUnique({ where: { ano } });
    if (!exercicio) throw naoEncontrado(`Exercicio ${ano} nao encontrado.`);

    const snapshot = await carregarSnapshot(ano);
    const relatorio = validarOrcamento(snapshot);
    const totais = totalizacoes(snapshot);

    const fiscal = totais.porEsfera.find((e) => e.esfera === 'F') ?? { receita: 0, despesa: 0 };
    const seguridade = totais.porEsfera.find((e) => e.esfera === 'S') ?? { receita: 0, despesa: 0 };

    const ultima = await prisma.consolidacao.findFirst({
      where: { exercicioId: exercicio.id },
      orderBy: { versao: 'desc' },
    });
    const versao = (ultima?.versao ?? 0) + 1;

    const conteudo = JSON.stringify({
      exercicio: ano,
      receitas: snapshot.receitas.map((r) => [r.natureza, r.fonte, r.valor]),
      dotacoes: snapshot.dotacoes.map((d) => [d.unidade, d.funcao, d.programa, d.acao, d.fonte, d.valor]),
    });
    const hash = createHash('sha256').update(conteudo).digest('hex');

    const consolidacao = await prisma.consolidacao.create({
      data: {
        exercicioId: exercicio.id,
        versao,
        geradaPor: requisicao.usuario.nome,
        receitaTotal: totais.receitaTotal,
        despesaTotal: totais.despesaTotal,
        fiscalReceita: fiscal.receita,
        fiscalDespesa: fiscal.despesa,
        seguridadeReceita: seguridade.receita,
        seguridadeDespesa: seguridade.despesa,
        equilibrada: Math.abs(totais.diferenca) <= 0.01,
        validacaoOk: relatorio.aprovado,
        hash,
        resumo: JSON.stringify({
          porFuncao: totais.porFuncao,
          porOrgao: totais.porOrgao,
          porGrupo: totais.porGrupo,
          quantidadeDotacoes: totais.quantidadeDotacoes,
          quantidadeUnidades: totais.quantidadeUnidades,
          validacao: { erros: relatorio.totalErros, alertas: relatorio.totalAlertas },
        }),
      },
    });

    await registrarAuditoria({
      usuarioId: requisicao.usuario.sub,
      acao: 'CONSOLIDAR_ORCAMENTO',
      entidade: 'Consolidacao',
      entidadeId: consolidacao.id,
      detalhes: { versao, hash, receitaTotal: totais.receitaTotal, despesaTotal: totais.despesaTotal },
    });

    return { ...consolidacao, resumo: JSON.parse(consolidacao.resumo!), validacao: relatorio };
  });

  app.get('/api/exercicios/:ano/consolidacoes', async (requisicao) => {
    const { ano } = paramsAno.parse(requisicao.params);
    const exercicio = await prisma.exercicio.findUnique({ where: { ano } });
    if (!exercicio) throw naoEncontrado(`Exercicio ${ano} nao encontrado.`);
    const consolidacoes = await prisma.consolidacao.findMany({
      where: { exercicioId: exercicio.id },
      orderBy: { versao: 'desc' },
    });
    return consolidacoes.map((c) => ({ ...c, resumo: c.resumo ? JSON.parse(c.resumo) : null }));
  });
}
