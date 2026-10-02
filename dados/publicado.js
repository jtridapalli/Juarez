/**
 * Os números publicados na consulta de 29/09/2026, 13h35.
 *
 * Tudo aqui é ALVO, não resultado: é contra estes números que a classe de
 * aderência da conferência compara. Eles estão em REAIS, como todo o resto do
 * sistema, e a tolerância é o arredondamento da casa em que a consulta publicou —
 * uma casa decimal em milhões significa meio décimo de milhão, isto é, R$ 50 mil.
 *
 * Divergir daqui NÃO é defeito. A conferência de aderência não bloqueia nada: uma
 * carga nova pode legitimamente divergir da publicada, e medir essa distância é
 * justamente para o que ela serve.
 */

import { ELEMENTOS } from './alvos.js';

const MI = 1e6;

export const PUBLICADO = Object.freeze({
  consulta: '29/09/2026 13h35',
  posicao: '25/09/2026',
  premissas: '31/08/2026',

  // ----------------------------------------------------- agregados do exercício
  proj2026: 47_969.5 * MI,
  proj2027: 50_956.5 * MI,
  proj2027Literal: 54_803.0 * MI,
  janAgo2026: 29_871.6 * MI,
  dotacao: 44_418.6 * MI,
  credito2026: 3_551.0 * MI,
  t13_2026: 2_328.6 * MI,
  t13_2027: 2_127.2 * MI,
  dez2026SemT13: 4_014.1 * MI,

  // ------------------------------------------------------------ séries mensais
  serie2026: [
    3_532.2, 3_655.5, 3_727.2, 3_629.5, 3_701.2, 3_773.9,
    3_811.4, 4_040.7, 3_863.7, 3_925.2, 3_966.4, 6_342.7,
  ].map((v) => v * MI),

  serie2027: [
    4_048.1, 4_051.9, 4_055.7, 4_059.5, 4_063.4, 4_067.2,
    4_071.0, 4_074.8, 4_078.7, 4_082.5, 4_086.4, 6_217.4,
  ].map((v) => v * MI),

  // ------------------------------------------------- abertura por elemento
  //
  // Vem de `alvos.js` em vez de ser transcrita outra vez aqui. A primeira versão
  // deste arquivo tinha a abertura digitada à mão duas vezes, e as duas cópias
  // divergiram: faltava o elemento 47 numa delas, e o 94 aparecia com R$ 36,3 mi
  // onde a outra trazia R$ 977,1 mi. O resultado era uma abertura por elemento que
  // somava R$ 46.970,4 mi contra um total publicado de R$ 47.969,5 mi — a mesma
  // classe de defeito que este painel existe para não cometer. Agora há UMA tabela,
  // e a conferência interna prova que ela soma o total.
  elementos: Object.freeze(Object.fromEntries(
    ELEMENTOS.map((e) => [e.elemento, { ano: e.ano * MI, linhas: e.linhas }]),
  )),

  // -------------------------------------------------- leituras de comparação
  vegetativo2026: 45_999.4 * MI,
  vegetativo2027: 46_756.8 * MI,
  piso2026: 45_919.4 * MI,
  arimaJanela2027: 48_765.3 * MI,
  arimaInteira2027: 51_233.0 * MI,
  arimaJanela2026: 47_337.0 * MI,
  arimaInteira2026: 47_658.0 * MI,

  // ------------------------------------------------------ memória de cálculo
  memoria: Object.freeze({
    linhas: 1023,
    desligadas: 252,
    mediana: 176,
    composicao: 595,
    mesesLinhaTeto: 1219,
    mesesLinhaCvVazio: 13,
    mesesLinhaReajuste: 0,
    linhasCom13: 302,

    // O quadro 28 publica 719 ativos e 52 inativos. Os dois somam 771, e 771 é
    // 1.023 menos as 252 linhas desligadas: o contador exclui as desligadas sem
    // declarar que exclui. Quem soma as duas linhas do quadro conclui que o modelo
    // tem 771 linhas; ele tem 1.023, e a projeção de 2027 roda sobre todas. Por
    // isso a comparação é contra os contadores de linhas VIVAS, e não contra os
    // contadores sobre o conjunto inteiro.
    vivoAtivo: 719,
    vivoInativo: 52,
    vivas: 771,
    com13Inativo: 0,

    especificosDeclarados: 4,
    especificosAplicados: 3,
  }),

  // ------------------------------------------------------------ estrutura
  linhas: 1023,
  unidades: 77,
  orgaos: 34,

  // ----------------------------------------- os dois valores do Executivo
  // O quadro 13 publicava R$ 25,41 bi e o quadro 22 publicava R$ 25,50 bi, ambos
  // rotulados como projeção de 2026 do Poder Executivo. São duas posições da mesma
  // grandeza, e nenhum dos dois quadros declarava a sua régua.
  executivoQuadro13: 25_410.0 * MI,
  executivoQuadro22: 25_500.0 * MI,

  // --------------------------------------------- régua da classe de aderência
  tolerancia: Object.freeze({ mi: 0.05 * MI, bi: 5 * MI }),
});

/** Série do Relatório 8778, 2023-01 a 2026-08, e as réguas do 8050. */
export const OITO_MIL = Object.freeze({
  unidades: 72,
  dotacao: 41_401.0 * MI,
  janelaMeses: 44,
});
