import { prisma } from '../lib/prisma.js';
import type { OrcamentoSnapshot } from '../dominio/tipos.js';

/** Status de proposta considerados na consolidacao do projeto de lei. */
export const STATUS_CONSOLIDAVEIS = ['ENVIADA', 'EM_ANALISE', 'HOMOLOGADA'];

/**
 * Monta o retrato completo do orcamento de um exercicio, com as
 * classificacoes ja desnormalizadas, para uso do motor de validacao e
 * dos geradores de anexos.
 */
export async function carregarSnapshot(
  exercicioAno: number,
  statusPropostas: string[] = STATUS_CONSOLIDAVEIS,
): Promise<OrcamentoSnapshot> {
  const exercicio = await prisma.exercicio.findUnique({ where: { ano: exercicioAno } });
  if (!exercicio) throw new Error(`Exercicio ${exercicioAno} nao encontrado.`);

  const [parametros, receitas, dotacoes, limites, emendas] = await Promise.all([
    prisma.parametroFiscal.findMany({ where: { exercicioId: exercicio.id } }),
    prisma.receitaPrevista.findMany({
      where: { exercicioId: exercicio.id },
      include: { natureza: true, fonte: true },
      orderBy: { id: 'asc' },
    }),
    prisma.dotacao.findMany({
      where: { proposta: { exercicioId: exercicio.id, status: { in: statusPropostas } } },
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
      orderBy: { id: 'asc' },
    }),
    prisma.limiteOrcamentario.findMany({
      where: { exercicioId: exercicio.id },
      include: { unidade: true },
    }),
    prisma.emendaParlamentar.findMany({ where: { exercicioId: exercicio.id } }),
  ]);

  return {
    exercicio: exercicio.ano,
    parametros: Object.fromEntries(parametros.map((p) => [p.chave, p.valor])),
    receitas: receitas.map((r) => ({
      id: r.id,
      natureza: r.natureza.codigo,
      naturezaNome: r.natureza.nome,
      categoria: r.natureza.categoria,
      origem: r.natureza.origem,
      especie: r.natureza.especie,
      deducao: r.natureza.deducao,
      fonte: r.fonte.codigo,
      fonteNome: r.fonte.nome,
      fonteOrigem: r.fonte.origem,
      fonteVinculacao: r.fonte.vinculacao,
      esfera: r.esfera,
      valor: r.valor,
    })),
    dotacoes: dotacoes.map((d) => ({
      id: d.id,
      unidade: d.unidade.codigo,
      unidadeNome: d.unidade.nome,
      unidadeSigla: d.unidade.sigla,
      orgao: d.unidade.orgao.codigo,
      orgaoNome: d.unidade.orgao.nome,
      orgaoSigla: d.unidade.orgao.sigla,
      poder: d.unidade.orgao.poder,
      funcao: d.funcao.codigo,
      funcaoNome: d.funcao.nome,
      subfuncao: d.subfuncao.codigo,
      subfuncaoNome: d.subfuncao.nome,
      programa: d.programa.codigo,
      programaNome: d.programa.nome,
      programaPpaFim: d.programa.ppaFim,
      programaAtivo: d.programa.ativo,
      acao: d.acao.codigo,
      acaoNome: d.acao.nome,
      acaoTipo: d.acao.tipo,
      subtitulo: d.subtitulo,
      esfera: d.esfera,
      categoria: d.categoria,
      grupo: d.grupo.codigo,
      grupoNome: d.grupo.nome,
      modalidade: d.modalidade.codigo,
      modalidadeNome: d.modalidade.nome,
      elemento: d.elemento.codigo,
      elementoNome: d.elemento.nome,
      elementoGrupos: d.elemento.grupos,
      fonte: d.fonte.codigo,
      fonteNome: d.fonte.nome,
      fonteOrigem: d.fonte.origem,
      fonteVinculacao: d.fonte.vinculacao,
      rp: d.rp,
      valor: d.valor,
      propostaStatus: d.proposta.status,
    })),
    limites: limites.map((l) => ({
      unidade: l.unidade.codigo,
      unidadeNome: l.unidade.nome,
      escopo: l.escopo,
      valor: l.valor,
    })),
    emendas: emendas.map((e) => ({ numero: e.numero, autor: e.autor, valor: e.valor, status: e.status })),
  };
}
