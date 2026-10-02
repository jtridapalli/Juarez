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
 *
 * Sobre a ordem em que estes números nasceram, que importa para quem for auditar
 * o painel: o conjunto é sintético, gerado por `dados/gerador.js` contra os alvos
 * de `dados/alvos.js`. Parte dos números abaixo é ALVO da geração — as oito
 * colunas realizadas, os quatro meses projetados, a dotação, as contagens do
 * quadro 28 — e o gerador os fecha ao centavo. A outra parte é o que a REGRA
 * produz a partir deles e não poderia ser escolhida: a provisão do 13º, o
 * exercício, o crédito a abrir, a abertura por elemento, o exercício de 2027. Essa
 * parte foi LIDA do modelo e congelada aqui, como um órgão publica o que o seu
 * sistema calculou. A distinção está anotada item por item.
 */

const MI = 1e6;

export const PUBLICADO = Object.freeze({
  consulta: '29/09/2026 13h35',
  posicao: '25/09/2026',
  premissas: '31/08/2026',

  // ----------------------------------------------------- agregados do exercício
  /** Derivado: soma dos doze meses com a provisão do 13º dentro de dezembro. */
  proj2026: 47_392.7 * MI,
  /** Derivado: regras D1 a D6 com a leitura ao ANO do vegetativo. */
  proj2027: 50_307.7 * MI,
  /** Derivado: as MESMAS regras com a leitura literal, ao mês. A distância entre
   * as duas passa de R$ 3,8 bi — mais que o crédito a abrir do exercício. */
  proj2027Literal: 54_188.1 * MI,
  /** Alvo: oito meses realizados, posição de 25/09. */
  janAgo2026: 29_871.6 * MI,
  /** Alvo: dotação atualizada. */
  dotacao: 44_418.6 * MI,
  /** Derivado: projeção menos dotação, no total do Estado. É a leitura LÍQUIDA. */
  credito2026: 2_974.1 * MI,
  /** Derivado: regra 5.5 — dezembro projetado × fator, nas seis naturezas. */
  t13_2026: 1_751.7 * MI,
  /** Derivado: regra D5 — dezembro de 2027 × 0,90 ativo e × 0,95 inativo. */
  t13_2027: 1_600.1 * MI,
  /** Alvo: dezembro SEM a provisão. É a âncora de 2027 pela regra D2. */
  dez2026SemT13: 4_014.1 * MI,

  // ------------------------------------------------------------ séries mensais
  /**
   * Doze meses de 2026. Os oito primeiros são realizado e os quatro últimos são
   * projeção; dezembro traz a provisão do 13º DENTRO dele, e é a razão de vir
   * quarenta por cento acima dos vizinhos.
   */
  serie2026: [
    3_532.2, 3_655.5, 3_727.2, 3_629.5, 3_701.2, 3_773.9,
    3_811.4, 4_040.7, 3_863.7, 3_925.2, 3_966.4, 5_765.7,
  ].map((v) => v * MI),

  /**
   * Doze meses de 2027, derivados. A série é quase plana porque o vegetativo é
   * lido como taxa AO ANO distribuída pelos doze meses: 1,50% de janeiro a
   * dezembro inteiro, não 1,50% por mês. Dezembro traz a provisão dentro.
   */
  serie2027: [
    4_037.2, 4_041.1, 4_045.1, 4_049.0, 4_053.0, 4_057.0,
    4_060.9, 4_064.9, 4_068.9, 4_072.8, 4_076.8, 5_680.9,
  ].map((v) => v * MI),

  // ------------------------------------------------- abertura por elemento
  /**
   * Derivada. A abertura SOMA o total publicado, e a conferência interna prova que
   * soma — o que não é detalhe: a consulta auditada publicava no quadro 28 uma
   * abertura que perdia R$ 1.385,0 mi em relação ao próprio total, porque o
   * agrupamento descartava silenciosamente as linhas sem chave reconhecida.
   */
  elementos: Object.freeze({
    1: { ano: 12_508.9 * MI, linhas: 82 },
    3: { ano: 2_518.4 * MI, linhas: 18 },
    4: { ano: 2_701.4 * MI, linhas: 61 },
    7: { ano: 26.4 * MI, linhas: 9 },
    8: { ano: 44.5 * MI, linhas: 11 },
    11: { ano: 16_990.1 * MI, linhas: 200 },
    12: { ano: 2_566.9 * MI, linhas: 38 },
    13: { ano: 4_585.7 * MI, linhas: 165 },
    16: { ano: 865.8 * MI, linhas: 72 },
    17: { ano: 5.5 * MI, linhas: 7 },
    43: { ano: 565.1 * MI, linhas: 12 },
    46: { ano: 1_235.9 * MI, linhas: 54 },
    47: { ano: 57.9 * MI, linhas: 20 },
    48: { ano: 662.4 * MI, linhas: 29 },
    49: { ano: 690.4 * MI, linhas: 40 },
    91: { ano: 0.9 * MI, linhas: 5 },
    92: { ano: 388.9 * MI, linhas: 107 },
    93: { ano: 0.4 * MI, linhas: 9 },
    94: { ano: 977.1 * MI, linhas: 84 },
  }),

  // ---------------------------------------------------- abertura por Poder
  /**
   * Derivada, e é o quadro de insuficiência. Três Poderes descobertos e três com
   * sobra: a soma das faltas é R$ 4.381,3 mi e a leitura líquida é R$ 2.974,1 mi.
   * A diferença de R$ 1.407,2 mi é sobra que NÃO pode cobrir falta alheia.
   */
  poderes: Object.freeze({
    1: { nome: 'Legislativo e Tribunal de Contas', proj26: 1_043.7 * MI, dotacao: 1_228.8 * MI },
    2: { nome: 'Executivo', proj26: 24_681.0 * MI, dotacao: 20_737.2 * MI },
    3: { nome: 'Judiciário', proj26: 4_949.6 * MI, dotacao: 4_549.2 * MI },
    4: { nome: 'Ministério Público', proj26: 1_661.7 * MI, dotacao: 1_624.6 * MI },
    5: { nome: 'Seguridade Social', proj26: 15_027.7 * MI, dotacao: 16_071.4 * MI },
    9: { nome: 'Não classificado na tabela de Poderes', proj26: 29.0 * MI, dotacao: 207.4 * MI },
  }),

  /** Derivado: as duas leituras do crédito, e a distância entre elas. */
  creditoBrutoPorPoder: 4_381.3 * MI,
  creditoBrutoPorUnidade: 4_843.6 * MI,
  sobraPorPoder: 1_407.2 * MI,
  unidadesDescobertas: 71,

  // -------------------------------------------------- leituras de comparação
  /** Vegetativo sazonal da tela, a 2,00% com forma mensal medida no realizado. */
  vegetativo2026: 46_600.2 * MI,
  vegetativo2027: 47_180.4 * MI,
  /** Piso de índice zero: agosto repetido quatro vezes. Chão de leitura. */
  piso2026: 47_895.3 * MI,
  piso2027: 50_163.2 * MI,
  /** O mesmo piso sem a contraparte intraorçamentária. Outra régua. */
  pisoSemIntra2026: 38_504.5 * MI,
  /** ARIMA ajustado no Estado, nas duas especificações, recortado por massa. */
  arimaJanela2026: 47_337.0 * MI,
  arimaJanela2027: 48_765.0 * MI,
  arimaInteira2026: 47_658.0 * MI,
  arimaInteira2027: 51_233.0 * MI,

  // ------------------------------------------------- decomposição de 2027
  /**
   * Derivada. O crescimento de 2027 sobre 2026 é de R$ 2.915,1 mi, e 88,6% dele é
   * EFEITO-BASE: o custo de ancorar doze meses em dezembro em vez de na média do
   * ano. O vegetativo, que é a premissa discutida, responde por 11,4%.
   */
  crescimento2027: 2_915.1 * MI,
  efeitoBase2027: 2_583.0 * MI,
  vegetativoDe2027: 332.1 * MI,

  // ------------------------------------------------------ memória de cálculo
  memoria: Object.freeze({
    linhas: 1023,
    desligadas: 252,
    mediana: 176,
    composicao: 595,
    mesesLinhaTeto: 1219,
    mesesLinhaCvVazio: 13,
    /** Zero, e é o ponto: o reajuste geral vigora em MAIO, mês já realizado. */
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
    /** Zero: pela regra 5.5 nenhuma natureza de inativo provisiona 13º. */
    com13Inativo: 0,

    // Quatro aumentos específicos declarados e TRÊS aplicados. O quarto vigora em
    // agosto, mês já realizado, e por isso não incide em nenhum mês projetado. A
    // consulta contava os quatro como aplicados.
    especificosDeclarados: 4,
    especificosAplicados: 3,
  }),

  // ------------------------------------------------------------ estrutura
  linhas: 1023,
  unidades: 77,
  orgaos: 34,

  // ----------------------------------------- os dois valores do Executivo
  // O quadro 13 publicava R$ 24.681,0 mi e o quadro 22 publicava R$ 24.771,0 mi,
  // ambos rotulados como projeção de 2026 do Poder Executivo. São duas posições da
  // mesma grandeza — a carga de 25/09 e o arquivo de premissas de 31/08 — e nenhum
  // dos dois quadros declarava a sua régua. O painel só pode reproduzir UM deles,
  // porque só tem um ancestral de cálculo, e é exatamente essa a correção.
  executivoQuadro13: 24_681.0 * MI,
  executivoQuadro22: 24_771.0 * MI,

  // --------------------------------------------- régua da classe de aderência
  tolerancia: Object.freeze({ mi: 0.05 * MI, bi: 5 * MI }),
});

/** Série do Relatório 8778, 2023-01 a 2026-08, e as réguas do 8050. */
export const OITO_MIL = Object.freeze({
  unidades: 72,
  dotacao: 41_401.0 * MI,
  janelaMeses: 44,
});
