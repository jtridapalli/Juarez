/**
 * Regras e premissas do modelo da DOE/SEFA-PR.
 *
 * Tudo que é decisão de metodologia mora aqui, em um lugar só, para que mudar uma
 * premissa não exija caçar constantes em seis arquivos. Os valores monetários
 * circulam em REAIS no sistema inteiro: a conversão para milhões e bilhões é
 * assunto da apresentação, e misturar as duas escalas no cálculo é exatamente o
 * que faz uma tolerância de "um real" virar uma tolerância de um milhão.
 */

/** Premissas publicadas na consulta de 29/09/2026, mais os acréscimos da tela. */
export const PARAMETROS_PADRAO = Object.freeze({
  // --------------------------------------------------------------- 2026
  /** Reajuste geral declarado. */
  reajuste: 0.05,
  /** Mês de vigência do reajuste geral. Maio é mês JÁ REALIZADO: premissa dormente. */
  mesReajuste: 5,
  /** Teto do crescimento vegetativo mensal de 2026. */
  teto: 0.015,
  /** Primeiro mês projetado: setembro. Jan–ago é realizado e não se move. */
  primeiroMesProjetado: 9,
  /** Fator do 13º de 2026: 100% de dezembro projetado. */
  fator13: 1.0,

  // --------------------------------------------------------------- 2027
  vegetativoAtivo27: 0.015,
  vegetativoInativo27: 0.005,
  fator13Ativo27: 0.90,
  fator13Inativo27: 0.95,
  /**
   * Leitura de D6. O enunciado traz o percentual e NÃO diz o período.
   * 'ano' distribui pelos doze meses; 'mes' compõe mês a mês e dá 19,56% no ano.
   */
  modoD6: 'ano',
  /** Acréscimo da tela: aumento nominal de 2027. Nasce em zero. */
  aumentoNominal27: 0,
  mesNominal27: 1,

  // ------------------------------------------- premissa só de comparação
  /** Vegetativo sazonal desta tela, usado como leitura alternativa. */
  vegetativoTela: 0.02,

  /**
   * Aumentos específicos por trio de órgão, unidade e natureza.
   *
   * O de agosto é o caso que importa: vigora em mês JÁ REALIZADO e por isso não
   * incide na projeção. A consulta contava os quatro como aplicados.
   */
  especificos: Object.freeze([
    Object.freeze({ orgao: 41, uo: 4101, nat: 319011, mes: 10, taxa: 0.0350 }),
    Object.freeze({ orgao: 39, uo: 3901, nat: 319011, mes: 10, taxa: 0.0280 }),
    Object.freeze({ orgao: 45, uo: 4501, nat: 319011, mes: 10, taxa: 0.0190 }),
    Object.freeze({ orgao: 65, uo: 6501, nat: 319011, mes: 8, taxa: 0.0220 }),
  ]),
});

/** Nome dos meses, janeiro = índice 0. */
export const MESES = Object.freeze([
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez',
]);

/** Colunas de coeficiente de variação, uma por mês projetado. */
export const CV = Object.freeze(['cv_set', 'cv_out', 'cv_nov', 'cv_dez']);

/**
 * Regra 5.4 — célula de cv em branco.
 *
 * Em branco NÃO é zero. Zero declarado afirma que a linha não cresce; branco
 * afirma que não há histórico de crescimento declarado, e o documento manda tratar
 * como 9,99, que o teto corta. Virar zero apagaria a distinção, e são resultados
 * opostos a partir da mesma célula.
 */
export const CV_VAZIO = 9.99;

/** Regra 5.2 — naturezas projetadas pela MEDIANA de janeiro a agosto. */
export const NAT_MEDIANA = Object.freeze([319016, 319092, 319094]);

/** Regra 5.5 — naturezas que provisionam 13º. */
export const NAT_13 = Object.freeze([319004, 319011, 319012, 319013, 319016, 319113]);

/** Regra R2 — naturezas alcançadas pelo reajuste geral. */
export const NAT_REAJUSTE = Object.freeze([319004, 319011, 319013, 319016, 319113]);

/** Elementos da cesta D4: cada mês de 2027 vale a média de 2026. */
export const ELEMENTOS_D4 = Object.freeze([91, 92, 93, 94]);

/** Órgãos e naturezas do regime previdenciário, para a taxa de vegetativo de D6. */
export const ORGAOS_RPPS = Object.freeze([87, 88]);
export const NAT_INATIVO = Object.freeze([319001, 319003, 319101, 319103]);

/** Classificação de Poder, pela faixa de órgão. */
export const PODERES = Object.freeze([
  { chave: 1, nome: 'Legislativo e Tribunal de Contas', orgaos: [1, 2, 3] },
  { chave: 2, nome: 'Executivo', faixa: [10, 79] },
  { chave: 3, nome: 'Judiciário', orgaos: [4, 5] },
  { chave: 4, nome: 'Ministério Público', orgaos: [6, 7] },
  { chave: 5, nome: 'Seguridade Social', orgaos: [87, 88] },
]);

export const PODER_NAO_CLASSIFICADO = Object.freeze({
  chave: 9, nome: 'Não classificado na tabela de Poderes',
});

export function poderDaLinha(L) {
  const o = Number(L.orgao);
  for (const p of PODERES) {
    if (p.orgaos && p.orgaos.includes(o)) return p.chave;
    if (p.faixa && o >= p.faixa[0] && o <= p.faixa[1]) return p.chave;
  }
  return PODER_NAO_CLASSIFICADO.chave;
}

export function nomeDoPoder(chave) {
  if (chave === PODER_NAO_CLASSIFICADO.chave) return PODER_NAO_CLASSIFICADO.nome;
  return PODERES.find((p) => p.chave === chave)?.nome ?? String(chave);
}

/** Elemento de despesa: os dois dígitos finais da natureza. */
export function elemento(nat) {
  return Number(String(nat).padStart(6, '0').slice(4, 6));
}

/** Modalidade de aplicação: os dois dígitos do meio. */
export function modalidade(nat) {
  return Number(String(nat).padStart(6, '0').slice(2, 4));
}

/** Grupo de natureza de despesa: o segundo dígito. */
export function gnd(nat) {
  return Number(String(nat).padStart(6, '0').slice(1, 2));
}

export function ehMediana(nat) {
  return NAT_MEDIANA.includes(Number(nat));
}

export function provisiona13(nat) {
  return NAT_13.includes(Number(nat));
}

export function alcancadoPeloReajuste(nat) {
  return NAT_REAJUSTE.includes(Number(nat));
}

export function ehD4(nat) {
  return ELEMENTOS_D4.includes(elemento(nat));
}

export function ehInativoRPPS(L) {
  return ORGAOS_RPPS.includes(Number(L.orgao)) || NAT_INATIVO.includes(Number(L.nat));
}

/**
 * Regra 5.1 — linha desligada.
 *
 * Julho E agosto zerados levam os quatro meses projetados a zero. É o "e", e não o
 * "ou": um mês zerado sozinho é atraso de empenho, não desligamento, e tratar como
 * desligamento apagaria a linha do exercício.
 */
export function ehDesligada(L) {
  return numero(L.jul) === 0 && numero(L.ago) === 0;
}

/** Converte célula para número; vazio vira null, e null não é zero. */
export function numero(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Os oito meses realizados da linha, em reais. */
export function realizado8(L) {
  return MESES.slice(0, 8).map((m) => numero(L[m]) ?? 0);
}

/** Mediana de uma lista de números. */
export function mediana(xs) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const meio = Math.floor(s.length / 2);
  return s.length % 2 ? s[meio] : (s[meio - 1] + s[meio]) / 2;
}

/**
 * Regra 5.4 — o fator de crescimento do mês, já cortado pelo teto.
 * Devolve também se o teto mordeu e se a célula estava em branco, porque as duas
 * coisas são contadas na memória de cálculo e publicadas.
 */
export function cvDoMes(L, i, teto) {
  const bruto = numero(L[CV[i]]);
  const vazio = bruto === null;
  const declarado = vazio ? CV_VAZIO : bruto;
  const corta = declarado > teto;
  return { declarado, aplicado: Math.min(declarado, teto), vazio, corta };
}

/** Soma das taxas de aumento específico que alcançam a linha naquele mês. */
export function somaEspecificos(L, mes, especificos) {
  let s = 0;
  for (const e of especificos) {
    if (Number(e.mes) !== Number(mes)) continue;
    if (Number(e.orgao) !== Number(L.orgao)) continue;
    if (Number(e.uo) !== Number(L.uo)) continue;
    if (Number(e.nat) !== Number(L.nat)) continue;
    s += e.taxa;
  }
  return s;
}
