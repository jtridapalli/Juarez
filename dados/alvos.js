/**
 * Especificação estrutural do conjunto sintético.
 *
 * O painel precisa de 1.023 linhas que, agregadas, reproduzam os números da
 * consulta. Elas NÃO são a folha do Estado: são um conjunto construído para
 * satisfazer os agregados publicados, de modo que o motor possa ser exercitado e
 * as identidades, provadas. A aba de carga existe para que as linhas reais entrem
 * no lugar destas, e a tela avisa, em todo recorte, que o conjunto é sintético.
 *
 * Tudo que é estrutura — quantos órgãos, quantas unidades, qual natureza em qual
 * elemento, quantas linhas em cada balde — mora aqui. O gerador só resolve os
 * valores.
 */

/**
 * Os 34 órgãos do recorte.
 *
 * `poder` é derivado do código pela tabela de regras e NÃO é declarado aqui, de
 * propósito: duas fontes para a mesma classificação é como se produz um Executivo
 * com dois valores. O órgão 89 cai fora de todas as faixas e vai para o balde
 * "não classificado" — ele existe justamente para que esse balde tenha conteúdo e
 * seja visível, em vez de ser uma linha vazia que ninguém confere.
 */
export const ORGAOS = Object.freeze([
  { codigo: 1, nome: 'Assembleia Legislativa', unidades: 1, arquetipo: 'administrativo', peso: 2.3 },
  { codigo: 3, nome: 'Tribunal de Contas', unidades: 1, arquetipo: 'administrativo', peso: 1.5 },
  { codigo: 5, nome: 'Poder Judiciário', unidades: 2, arquetipo: 'administrativo', peso: 9.6 },
  { codigo: 6, nome: 'Ministério Público', unidades: 1, arquetipo: 'administrativo', peso: 3.5 },
  { codigo: 7, nome: 'Ministério Público de Contas', unidades: 1, arquetipo: 'administrativo', peso: 0.18 },
  { codigo: 11, nome: 'Controladoria Geral', unidades: 1, arquetipo: 'administrativo', peso: 0.14 },
  { codigo: 12, nome: 'Casa Militar', unidades: 1, arquetipo: 'militar', peso: 0.11 },
  { codigo: 13, nome: 'Casa Civil', unidades: 2, arquetipo: 'administrativo', peso: 0.63 },
  { codigo: 15, nome: 'Comunicação', unidades: 1, arquetipo: 'administrativo', peso: 0.17 },
  { codigo: 17, nome: 'Inovação e IA', unidades: 1, arquetipo: 'administrativo', peso: 0.09 },
  { codigo: 19, nome: 'Procuradoria Geral', unidades: 1, arquetipo: 'administrativo', peso: 0.55 },
  { codigo: 21, nome: 'Planejamento', unidades: 2, arquetipo: 'administrativo', peso: 0.20 },
  { codigo: 23, nome: 'Administração e Previdência', unidades: 3, arquetipo: 'administrativo', peso: 0.33 },
  { codigo: 24, nome: 'Justiça e Cidadania', unidades: 3, arquetipo: 'seguranca', peso: 0.42 },
  { codigo: 25, nome: 'Defensoria Pública', unidades: 1, arquetipo: 'administrativo', peso: 0.47 },
  { codigo: 29, nome: 'Fazenda', unidades: 3, arquetipo: 'administrativo', peso: 0.81 },
  { codigo: 35, nome: 'Defesa Civil', unidades: 1, arquetipo: 'seguranca', peso: 0.07 },
  { codigo: 39, nome: 'Segurança Pública', unidades: 6, arquetipo: 'seguranca', peso: 11.6 },
  { codigo: 41, nome: 'Educação', unidades: 5, arquetipo: 'educacao', peso: 23.1 },
  { codigo: 43, nome: 'Turismo e Cultura', unidades: 3, arquetipo: 'administrativo', peso: 0.17 },
  { codigo: 45, nome: 'Ciência, Tecnologia e Ensino Superior', unidades: 6, arquetipo: 'educacao', peso: 7.2 },
  { codigo: 47, nome: 'Saúde', unidades: 4, arquetipo: 'saude', peso: 7.6 },
  { codigo: 61, nome: 'Trabalho, Qualificação e Renda', unidades: 2, arquetipo: 'administrativo', peso: 0.13 },
  { codigo: 63, nome: 'Indústria, Comércio e Serviços', unidades: 2, arquetipo: 'administrativo', peso: 0.09 },
  { codigo: 65, nome: 'Agricultura e do Abastecimento', unidades: 4, arquetipo: 'administrativo', peso: 1.6 },
  { codigo: 67, nome: 'Cidades', unidades: 2, arquetipo: 'administrativo', peso: 0.28 },
  { codigo: 69, nome: 'Desenvolvimento Sustentável', unidades: 4, arquetipo: 'administrativo', peso: 0.51 },
  { codigo: 71, nome: 'Infraestrutura e Logística', unidades: 3, arquetipo: 'administrativo', peso: 0.31 },
  { codigo: 73, nome: 'Desenvolvimento Social e Família', unidades: 2, arquetipo: 'administrativo', peso: 0.12 },
  { codigo: 75, nome: 'Mulher, Igualdade Racial e Pessoa Idosa', unidades: 1, arquetipo: 'administrativo', peso: 0.06 },
  { codigo: 79, nome: 'Meio Ambiente · Conselhos', unidades: 2, arquetipo: 'administrativo', peso: 0.07 },
  { codigo: 87, nome: 'Fundo de Previdência', unidades: 2, arquetipo: 'inativos', peso: 12.3 },
  { codigo: 88, nome: 'Fundo Financeiro', unidades: 2, arquetipo: 'inativos', peso: 20.2 },
  { codigo: 89, nome: 'Fundo Militar', unidades: 1, arquetipo: 'militar', peso: 0.44 },
]);

/**
 * Perfil de despesa por tipo de órgão: o peso relativo de cada elemento.
 *
 * Os fundos previdenciários são o caso que importa: aposentadorias, pensões e
 * quase nada mais. Nenhuma natureza da lista de 13º entra neles, e é o que o
 * publicado exige — o quadro 28 traz ZERO linha inativa provisionando 13º. O
 * resto é intraorçamentário: despesa de exercício anterior e indenização.
 */
export const ARQUETIPOS = Object.freeze({
  educacao: { 11: 56, 13: 17, 4: 11, 16: 4, 46: 5, 49: 2, 48: 1, 94: 3, 92: 1, 91: 0.2 },
  saude: { 11: 48, 13: 15, 4: 18, 16: 5, 46: 6, 49: 2, 48: 1, 94: 3, 92: 2, 91: 0.2 },
  seguranca: { 11: 30, 12: 32, 13: 18, 16: 7, 17: 1, 46: 6, 49: 2, 48: 1, 92: 2, 94: 1, 91: 0.2 },
  militar: { 12: 72, 13: 14, 17: 4, 46: 5, 49: 2, 92: 2, 94: 1 },
  administrativo: {
    11: 52, 13: 16, 4: 6, 16: 5, 8: 1, 7: 1, 43: 4, 46: 8, 48: 2, 49: 2, 47: 1,
    92: 2, 91: 0.3,
  },
  // Os fundos não recebem natureza da lista de mediana: 319092 entraria na regra
  // 5.2 e contaria como linha de mediana inativa, e o quadro 28 não tem nenhuma.
  inativos: { 1: 82, 3: 17, 93: 1 },
});

/**
 * Quantas linhas cada elemento recebe e quanto ele soma no exercício SEM o 13º.
 *
 * As duas colunas são alvos independentes: a contagem define a estrutura e o valor
 * define a calibração. Somam, respectivamente, as 1.023 linhas e os R$ 45.641,0 mi
 * de janeiro a dezembro sem a provisão — isto é, os oito meses realizados mais os
 * quatro projetados.
 *
 * O alvo é SEM o 13º de propósito. A provisão do 13º não é premissa, é CONSEQUÊNCIA
 * da regra 5.5: dezembro projetado vezes o fator, nas seis naturezas que
 * provisionam. Tratá-la como alvo foi o erro da primeira versão deste arquivo —
 * fixar a provisão em R$ 2.328,6 mi exigia que 60% da massa do exercício estivesse
 * em natureza que provisiona, e com 27% da folha em inativos (que pela regra 5.5
 * NÃO provisionam) e 10% em auxílios e intraorçamentário (que também não), o
 * máximo estrutural ficava abaixo do alvo. O solver então disputava: o passo do 13º
 * empurrava massa para as naturezas que provisionam e o passo por elemento a
 * devolvia, iteração após iteração, e o elemento 01 ficava R$ 600 mi abaixo do alvo
 * em permanência. Com a provisão derivada, a disputa desaparece.
 */
export const ELEMENTOS = Object.freeze([
  { elemento: 1, linhas: 82, anoSem13: 12_508.9 },
  { elemento: 3, linhas: 18, anoSem13: 2_518.4 },
  { elemento: 4, linhas: 61, anoSem13: 2_460.6 },
  { elemento: 7, linhas: 9, anoSem13: 26.4 },
  { elemento: 8, linhas: 11, anoSem13: 44.5 },
  { elemento: 11, linhas: 200, anoSem13: 15_984.9 },
  { elemento: 12, linhas: 38, anoSem13: 2_331.0 },
  { elemento: 13, linhas: 165, anoSem13: 4_351.8 },
  { elemento: 16, linhas: 72, anoSem13: 830.0 },
  { elemento: 17, linhas: 7, anoSem13: 5.5 },
  { elemento: 43, linhas: 12, anoSem13: 565.1 },
  { elemento: 46, linhas: 54, anoSem13: 1_235.9 },
  { elemento: 47, linhas: 20, anoSem13: 57.9 },
  { elemento: 48, linhas: 29, anoSem13: 662.4 },
  { elemento: 49, linhas: 40, anoSem13: 690.4 },
  { elemento: 91, linhas: 5, anoSem13: 0.9 },
  { elemento: 92, linhas: 107, anoSem13: 388.9 },
  { elemento: 93, linhas: 9, anoSem13: 0.4 },
  { elemento: 94, linhas: 84, anoSem13: 977.1 },
]);

/**
 * Qual natureza cada elemento recebe, e em que proporção de LINHAS.
 *
 * A repartição não é decorativa: ela é o que determina quantas linhas caem na
 * lista de mediana da regra 5.2 e quantas provisionam 13º pela regra 5.5. Mexer
 * nela muda os contadores publicados no quadro 28.
 */
export const NATUREZAS = Object.freeze({
  1: [{ nat: 319001, linhas: 68 }, { nat: 319101, linhas: 14 }],
  3: [{ nat: 319003, linhas: 15 }, { nat: 319103, linhas: 3 }],
  4: [{ nat: 319004, linhas: 61 }],
  7: [{ nat: 319007, linhas: 9 }],
  8: [{ nat: 319008, linhas: 11 }],
  11: [{ nat: 319011, linhas: 120 }, { nat: 319111, linhas: 80 }],
  12: [{ nat: 319012, linhas: 38 }],
  13: [{ nat: 319013, linhas: 50 }, { nat: 319113, linhas: 31 }, { nat: 339013, linhas: 84 }],
  16: [{ nat: 319016, linhas: 60 }, { nat: 319116, linhas: 12 }],
  17: [{ nat: 319017, linhas: 7 }],
  43: [{ nat: 339043, linhas: 12 }],
  46: [{ nat: 339046, linhas: 54 }],
  47: [{ nat: 339047, linhas: 20 }],
  48: [{ nat: 339048, linhas: 29 }],
  49: [{ nat: 339049, linhas: 40 }],
  91: [{ nat: 319091, linhas: 5 }],
  92: [{ nat: 319092, linhas: 95 }, { nat: 339092, linhas: 12 }],
  93: [{ nat: 339093, linhas: 9 }],
  94: [{ nat: 319094, linhas: 70 }, { nat: 339094, linhas: 14 }],
});

/**
 * Os contadores que o quadro 28 publica e que o conjunto tem de reproduzir.
 *
 * `medianaViva`, `com13Vivo`, `inativoVivo` e `ativoVivo` são alvos sobre as
 * linhas VIVAS, e é o sistema que determina quais linhas são desligadas: a regra
 * 5.1 desliga pelo dado (julho e agosto zerados), então o gerador escolhe QUAIS
 * linhas receberão julho e agosto zerados para que os quatro contadores fechem.
 */
export const CONTADORES = Object.freeze({
  linhas: 1023,
  desligadas: 252,
  medianaViva: 176,
  com13Vivo: 302,
  inativoVivo: 52,
  ativoVivo: 719,
  mesesLinhaTeto: 1219,
  mesesLinhaCvVazio: 13,
});

/**
 * Alvos monetários da geração, em R$ milhões.
 *
 * Doze meses, e o décimo segundo é dezembro SEM a provisão do 13º. A provisão sai
 * da regra e entra dentro de dezembro depois; o que o gerador persegue é a despesa
 * do mês. A série publicada, com a provisão embutida em dezembro, está em
 * `publicado.js`, que é onde moram os números da consulta e não os da calibração.
 */
export const MONETARIOS = Object.freeze({
  meses: [
    3_532.2, 3_655.5, 3_727.2, 3_629.5, 3_701.2, 3_773.9,
    3_811.4, 4_040.7, 3_863.7, 3_925.2, 3_966.4, 4_014.1,
  ],
  dotacao: 44_418.6,
});

/**
 * Dotação por Poder, em R$ milhões.
 *
 * É o que produz o quadro de insuficiência: Executivo, Ministério Público e
 * Legislativo descobertos; Judiciário e Seguridade com sobra. A soma das faltas
 * passa de um bilhão a soma líquida, e é a razão de o crédito aparecer nas duas
 * leituras.
 */
export const DOTACAO_POR_PODER = Object.freeze({
  1: 1_228.8,
  2: 20_737.2,
  3: 4_549.2,
  4: 1_624.6,
  5: 16_071.4,
  9: 207.4,
});

/** Série do Relatório 8778: 2023-01 a 2026-08, em R$ milhões. */
export const SERIE_8778 = Object.freeze({
  unidades: 72,
  dotacao: 41_401.0,
  2023: [
    2_849.1, 2_903.4, 2_960.8, 2_918.6, 2_975.1, 3_029.7,
    3_061.0, 3_238.4, 3_098.2, 3_146.9, 3_178.5, 5_064.2,
  ],
  2024: [
    3_065.9, 3_124.2, 3_186.1, 3_141.0, 3_201.7, 3_260.4,
    3_293.9, 3_484.9, 3_334.1, 3_386.4, 3_420.4, 5_450.0,
  ],
  2025: [
    3_289.4, 3_352.1, 3_418.5, 3_370.1, 3_435.2, 3_498.2,
    3_534.1, 3_738.9, 3_577.6, 3_633.7, 3_670.2, 5_848.1,
  ],
  2026: [
    3_353.0, 3_470.0, 3_538.1, 3_445.3, 3_513.4, 3_582.3,
    3_617.9, 3_835.4,
  ],
});

/**
 * ARIMA ajustado no Estado, por grupo de natureza, nas duas especificações.
 *
 * O painel NÃO ajusta o modelo: ele recorta este resultado na proporção da massa.
 * A janela de 36 meses tem 24 graus de liberdade contra 3 parâmetros, e a série
 * inteira tem 31 contra 3 — e é por isso que as duas especificações aparecem
 * juntas, em vez de a tela escolher uma e apresentá-la como "o ARIMA".
 */
export const ARIMA = Object.freeze({
  especificacoes: {
    janela: {
      especificacao: '(1,0,1)(0,1,1)₁₂ · janela de 36 meses',
      descricao: 'janela de 36 meses · lido já ajustado',
      observacoes: 36,
      parametros: 3,
      porGrupo: {
        pessoal: { total2026: 41_906.0, total2027: 43_334.0 },
        intra: { total2026: 5_431.0, total2027: 5_431.0 },
      },
    },
    inteira: {
      especificacao: '(0,1,1)(1,1,0)₁₂ · série inteira do 8778',
      descricao: 'série inteira do 8778 · lido já ajustado',
      observacoes: 44,
      parametros: 3,
      porGrupo: {
        pessoal: { total2026: 42_117.0, total2027: 45_692.0 },
        intra: { total2026: 5_541.0, total2027: 5_541.0 },
      },
    },
  },
  /**
   * Backtest em três pontos de corte. Erro negativo em todos os horizontes é
   * subestimação sistemática: usado como referência de suficiência, o método
   * produz pedido de crédito MENOR que o necessário.
   */
  backtest: [
    { corte: '02/2026', linha: 'Folha com intra', horizonte: 6, realizado: 22_400.0, janela: 21_188.0, inteira: 21_048.0 },
    { corte: '02/2026', linha: 'Pessoal', horizonte: 6, realizado: 19_420.0, janela: 18_121.0, inteira: 18_128.0 },
    { corte: '02/2026', linha: 'Intra', horizonte: 6, realizado: 2_980.0, janela: 2_327.0, inteira: 2_305.0 },
    { corte: '04/2026', linha: 'Folha com intra', horizonte: 4, realizado: 15_429.0, janela: 14_361.0, inteira: 14_291.0 },
    { corte: '04/2026', linha: 'Pessoal', horizonte: 4, realizado: 13_116.0, janela: 12_222.0, inteira: 12_231.0 },
    { corte: '04/2026', linha: 'Intra', horizonte: 4, realizado: 2_313.0, janela: 1_392.0, inteira: 1_533.0 },
    { corte: '06/2026', linha: 'Folha com intra', horizonte: 2, realizado: 8_109.0, janela: 7_278.0, inteira: 7_287.0 },
    { corte: '06/2026', linha: 'Pessoal', horizonte: 2, realizado: 6_704.0, janela: 6_629.0, inteira: 6_676.0 },
    { corte: '06/2026', linha: 'Intra', horizonte: 2, realizado: 1_405.0, janela: 603.0, inteira: 682.0 },
  ],
});
