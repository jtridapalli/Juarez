/**
 * Agregação — e o defeito que ela existe para impedir.
 *
 * O quadro 28 da consulta auditada publicava três agregações que somavam
 * R$ 46.584,5 mi contra um exercício de R$ 47.969,5 mi no mesmo quadro. Faltavam
 * R$ 1.385,0 mi, e nada no quadro acusava: a diferença cabia no arredondamento da
 * apresentação. A causa é sempre a mesma — linhas cuja chave de agrupamento não
 * casa com nenhum balde declarado simplesmente somem.
 *
 * Aqui isso não pode acontecer, por três decisões:
 *
 * 1. Toda agregação percorre a MESMA lista de linhas e devolve o total percorrido
 *    junto com os grupos. Os dois são publicados lado a lado.
 * 2. Chave sem classificação vai para um balde "não classificado" explícito. Uma
 *    linha pode ser estranha; ela não pode desaparecer.
 * 3. O resíduo entre a soma dos grupos e o total percorrido é calculado e
 *    devolvido. A conferência TRAVA a carga se ele passar de um real.
 */

import {
  PODER_NAO_CLASSIFICADO, elemento, gnd, modalidade, nomeDoPoder, poderDaLinha,
} from './regras.js';

/**
 * Critério por elemento de despesa que o DOCUMENTO atribui.
 *
 * Não é o mesmo que o ramo efetivamente executado, e a divergência é deliberada
 * aqui: três elementos — 16, 92 e 94 — recebem no documento um critério e na
 * execução outro, porque as naturezas 319016, 319092 e 319094 estão na lista de
 * mediana da regra 5.2, que roda antes. Publicar só uma das duas colunas foi o que
 * permitiu a consulta rotular o quadro com o critério do documento e tirar dele
 * uma conclusão sobre o comportamento do modelo.
 */
export const CRITERIO_DO_DOCUMENTO = Object.freeze({
  1: 'base geral', 3: 'base geral', 4: 'base geral', 7: 'base geral',
  8: 'base geral', 11: 'base geral', 12: 'base geral', 13: 'base geral',
  16: 'base geral', 17: 'base geral', 43: 'valor do último mês',
  46: 'base geral', 48: 'base geral', 49: 'base geral',
  91: 'média do exercício', 92: 'orçamento atualizado',
  93: 'média dos valores', 94: 'orçamento atualizado',
});

export const NOME_ELEMENTO = Object.freeze({
  1: 'Aposentadorias e reformas', 3: 'Pensões', 4: 'Contratação temporária',
  7: 'Contribuição a entidades fechadas', 8: 'Outros benefícios assistenciais',
  11: 'Vencimentos e vantagens fixas · pessoal civil', 12: 'Vencimentos · pessoal militar',
  13: 'Obrigações patronais', 16: 'Outras despesas variáveis · pessoal civil',
  17: 'Outras despesas variáveis · pessoal militar', 43: 'Subvenções sociais',
  46: 'Auxílio-alimentação', 48: 'Outros auxílios financeiros',
  49: 'Auxílio-transporte', 91: 'Sentenças judiciais',
  92: 'Despesas de exercícios anteriores', 93: 'Indenizações e restituições',
  94: 'Indenizações e restituições trabalhistas',
});

export const NOME_MODALIDADE = Object.freeze({
  90: 'Aplicação direta', 91: 'Aplicação direta intraorçamentária',
});

export const NOME_GND = Object.freeze({
  1: 'Pessoal e encargos sociais', 3: 'Outras despesas correntes',
});

export const NOME_RAMO = Object.freeze({
  desligada: 'Linha desligada · regra 5.1',
  mediana: 'Natureza de mediana · regra 5.2',
  composicao: 'Composição a partir de agosto · regra 5.3',
});

export const NOME_CLASSE27 = Object.freeze({
  ativo: 'Ativos · vegetativo de D6 a 1,50%',
  inativo: 'Inativos e RPPS · vegetativo de D6 a 0,50%',
  d4: 'Cesta D4 · média de 2026, sem vegetativo',
});

/**
 * Agrega as linhas por uma chave.
 *
 * @param {object[]} linhas
 * @param {object} p26 resultado de `projeta2026`
 * @param {object} p27 resultado de `projeta2027`
 * @param {(L:object)=>({chave:string|number,rotulo:string}|null)} classifica
 */
export function agrega(linhas, p26, p27, classifica) {
  const mapa = new Map();
  const total = zera('total', 'Total do recorte');

  for (const L of linhas) {
    const r26 = p26.porLinha.get(L.id);
    const r27 = p27.porLinha.get(L.id);
    const c = classifica(L) ?? { chave: '∅', rotulo: 'Não classificado' };
    const chave = String(c.chave);
    if (!mapa.has(chave)) mapa.set(chave, zera(c.chave, c.rotulo, c.ordem));
    acumula(mapa.get(chave), L, r26, r27);
    acumula(total, L, r26, r27);
  }

  const itens = [...mapa.values()].sort((a, b) => {
    if (a.ordem !== b.ordem) return (a.ordem ?? 0) - (b.ordem ?? 0);
    return b.proj26 - a.proj26;
  });

  // O resíduo é a prova. Ele é zero por construção — todas as linhas passam por
  // exatamente um balde — e é justamente por ser zero por construção que publicá-lo
  // vale a pena: se algum dia deixar de ser, a tela trava em vez de arredondar.
  const soma = itens.reduce((a, g) => ({
    linhas: a.linhas + g.linhas,
    dotacao: a.dotacao + g.dotacao,
    janAgo: a.janAgo + g.janAgo,
    setDez: a.setDez + g.setDez,
    proj26: a.proj26 + g.proj26,
    proj27: a.proj27 + g.proj27,
    t13: a.t13 + g.t13,
  }), {
    linhas: 0, dotacao: 0, janAgo: 0, setDez: 0, proj26: 0, proj27: 0, t13: 0,
  });

  const residuo = {};
  for (const k of Object.keys(soma)) residuo[k] = soma[k] - total[k];

  for (const g of itens) {
    g.parte = total.proj26 === 0 ? 0 : g.proj26 / total.proj26;
    g.falta = g.proj26 - g.dotacao;
    g.razao = g.dotacao === 0 ? null : g.proj26 / g.dotacao - 1;
  }
  total.parte = 1;
  total.falta = total.proj26 - total.dotacao;
  total.razao = total.dotacao === 0 ? null : total.proj26 / total.dotacao - 1;

  return { itens, total, soma, residuo };
}

function zera(chave, rotulo, ordem) {
  return {
    chave, rotulo, ordem, linhas: 0, dotacao: 0, janAgo: 0, setDez: 0,
    proj26: 0, proj27: 0, t13: 0,
  };
}

function acumula(g, L, r26, r27) {
  g.linhas += 1;
  g.dotacao += r26.dotacao;
  g.janAgo += r26.janAgo;
  g.setDez += r26.setDez;
  g.proj26 += r26.ano;
  g.proj27 += r27.ano;
  g.t13 += r26.t13;
}

/** O ramo que a linha de fato executou em 2026. */
export function ramoExecutado(p26, L) {
  return p26.porLinha.get(L.id)?.ramo ?? 'composicao';
}

/**
 * Todas as agregações do painel, construídas de uma só passada sobre o MESMO
 * conjunto de linhas. Nenhuma delas recalcula a projeção.
 */
export function todasAsAgregacoes(linhas, p26, p27, catalogo = {}) {
  const nomeOrgao = (o) => catalogo.orgaos?.[o] ?? `Órgão ${o}`;
  const nomeUo = (u) => catalogo.unidades?.[u] ?? `Unidade ${u}`;

  return {
    porPoder: agrega(linhas, p26, p27, (L) => {
      const c = poderDaLinha(L);
      return { chave: c, rotulo: nomeDoPoder(c), ordem: c === PODER_NAO_CLASSIFICADO.chave ? 99 : c };
    }),
    porOrgao: agrega(linhas, p26, p27, (L) => ({
      chave: L.orgao, rotulo: `${L.orgao} · ${nomeOrgao(L.orgao)}`,
    })),
    porUnidade: agrega(linhas, p26, p27, (L) => ({
      chave: L.uo, rotulo: `${L.uo} · ${nomeUo(L.uo)}`,
    })),
    porNatureza: agrega(linhas, p26, p27, (L) => ({
      chave: L.nat, rotulo: String(L.nat),
    })),
    porElemento: agrega(linhas, p26, p27, (L) => {
      const e = elemento(L.nat);
      return { chave: e, rotulo: `${String(e).padStart(2, '0')} · ${NOME_ELEMENTO[e] ?? 'Outro'}`, ordem: e };
    }),
    porModalidade: agrega(linhas, p26, p27, (L) => {
      const m = modalidade(L.nat);
      return { chave: m, rotulo: `${m} · ${NOME_MODALIDADE[m] ?? 'Outra'}`, ordem: m };
    }),
    porGnd: agrega(linhas, p26, p27, (L) => {
      const g = gnd(L.nat);
      return { chave: g, rotulo: `${g} · ${NOME_GND[g] ?? 'Outro'}`, ordem: g };
    }),
    porRamo: agrega(linhas, p26, p27, (L) => {
      const r = ramoExecutado(p26, L);
      return { chave: r, rotulo: NOME_RAMO[r], ordem: ['desligada', 'mediana', 'composicao'].indexOf(r) };
    }),
    porClasse27: agrega(linhas, p26, p27, (L) => {
      const c = p27.porLinha.get(L.id)?.classe ?? 'ativo';
      return { chave: c, rotulo: NOME_CLASSE27[c], ordem: ['ativo', 'inativo', 'd4'].indexOf(c) };
    }),
  };
}

/**
 * Crédito a abrir, nas duas leituras.
 *
 * A consulta publicava só a LÍQUIDA — projeção menos dotação no total do Estado.
 * Sobra em um Poder não cobre falta em outro: o crédito que de fato precisa ser
 * aberto é a soma das faltas de quem está descoberto, e a sobra de quem não está
 * é um número que não pode ser transferido. A diferença entre as duas leituras
 * passa de um bilhão, e é a razão declarada para a tabela de Poderes existir.
 */
export function creditoAAbrir(agregados, p26) {
  const bruta = (grupo) => grupo.itens
    .filter((g) => g.falta > 0)
    .reduce((a, g) => a + g.falta, 0);
  const sobra = (grupo) => grupo.itens
    .filter((g) => g.falta < 0)
    .reduce((a, g) => a - g.falta, 0);

  return {
    liquida: p26.ano - p26.dotacao,
    brutaPorPoder: bruta(agregados.porPoder),
    sobraPorPoder: sobra(agregados.porPoder),
    brutaPorUnidade: bruta(agregados.porUnidade),
    sobraPorUnidade: sobra(agregados.porUnidade),
    descobertosPorPoder: agregados.porPoder.itens.filter((g) => g.falta > 0).length,
    descobertosPorUnidade: agregados.porUnidade.itens.filter((g) => g.falta > 0).length,
    cobertosPorPoder: agregados.porPoder.itens.filter((g) => g.falta <= 0).length,
  };
}
