import type { DotacaoItem, ReceitaItem } from './tipos.js';

/**
 * Regras de enquadramento das classificacoes orcamentarias usadas na
 * apuracao dos limites constitucionais e legais.
 */

/** Prefixos das naturezas de receita de impostos proprios do Estado. */
const PREFIXOS_IMPOSTOS = ['1.1.1'];

/**
 * Transferencias da Uniao que compoem a base de calculo dos minimos
 * constitucionais de educacao (art. 212 da CF) e saude (LC 141/2012):
 * FPE, cota-parte do IPI-Exportacao e desoneracao das exportacoes (LC 87/1996).
 */
const PREFIXOS_TRANSFERENCIAS_IMPOSTOS = ['1.7.1.8.01.2', '1.7.1.8.01.3', '1.7.1.8.06'];

/**
 * Deducoes que reduzem a base de calculo: parcelas do ICMS e do IPVA
 * pertencentes aos municipios (art. 158 da CF). As deducoes destinadas a
 * formacao do FUNDEB nao reduzem a base, pois o proprio aporte ao fundo e
 * computado como aplicacao em educacao.
 */
const PREFIXOS_DEDUCOES_BASE = ['9.1.1.8.03', '9.1.1.8.04'];

/** Fontes cujos recursos derivam de impostos e transferencias de impostos. */
export const FONTES_IMPOSTOS_EDUCACAO = ['500', '540', '569'];
export const FONTES_IMPOSTOS_SAUDE = ['500', '659'];
/** Fontes que compoem o FUNDEB (parcela estadual e complementacao da Uniao). */
export const FONTES_FUNDEB = ['540', '541', '542', '543'];

export const FUNCAO_EDUCACAO = '12';
export const FUNCAO_SAUDE = '10';
export const FUNCAO_RESERVA_CONTINGENCIA = '99';
export const FUNCOES_SEGURIDADE_SOCIAL = ['08', '09', '10'];
/** Grupos de natureza da despesa classificados como despesa de capital. */
export const GRUPOS_CAPITAL = ['4', '5', '6'];
/** Elementos de despesa de natureza previdenciaria, excluidos da despesa com pessoal (art. 19, §1o, VI, da LC 101/2000). */
export const ELEMENTOS_PREVIDENCIARIOS = ['01', '03', '05'];

function temPrefixo(codigo: string, prefixos: string[]): boolean {
  return prefixos.some((p) => codigo.startsWith(p));
}

/** Indica se a receita compoe a base de calculo dos minimos constitucionais. */
export function compoeBaseImpostos(receita: ReceitaItem): boolean {
  if (temPrefixo(receita.natureza, PREFIXOS_DEDUCOES_BASE)) return true;
  if (receita.deducao) return false;
  return temPrefixo(receita.natureza, [...PREFIXOS_IMPOSTOS, ...PREFIXOS_TRANSFERENCIAS_IMPOSTOS]);
}

/** Base de calculo da receita liquida de impostos e transferencias de impostos. */
export function baseImpostosETransferencias(receitas: ReceitaItem[]): number {
  return receitas.filter(compoeBaseImpostos).reduce((total, r) => total + r.valor, 0);
}

/** Despesa com pessoal para fins do art. 19 da LC 101/2000. */
export function ehDespesaPessoal(d: DotacaoItem): boolean {
  return d.grupo === '1' && !ELEMENTOS_PREVIDENCIARIOS.includes(d.elemento);
}

export function ehDespesaCapital(d: DotacaoItem): boolean {
  return GRUPOS_CAPITAL.includes(d.grupo);
}

/** Codigo completo da natureza da despesa, ex. 3.3.90.39. */
export function naturezaDespesa(d: DotacaoItem): string {
  return `${d.categoria}.${d.grupo}.${d.modalidade}.${d.elemento}`;
}

/** Classificacao funcional-programatica completa, ex. 12.368.1001.2101.0000. */
export function funcionalProgramatica(d: DotacaoItem): string {
  return `${d.funcao}.${d.subfuncao}.${d.programa}.${d.acao}.${d.subtitulo}`;
}
