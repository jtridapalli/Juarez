/**
 * Leituras alternativas — e o que elas servem para responder.
 *
 * O modelo da DOE é a referência: é dele que sai o pedido de crédito. As outras
 * quatro leituras existem para medir a distância até ele, e cada uma responde a
 * uma pergunta diferente:
 *
 *   LITERAL DE D6     a mesma frase do documento lida como taxa ao mês. Não é um
 *                     método rival; é a outra leitura do MESMO enunciado.
 *   ARIMA             o que a série histórica, sozinha, projetaria. Serve de
 *                     contraprova ao modelo por linha.
 *   VEGETATIVO        continuação sazonal a uma taxa declarada. Serve para separar
 *                     o que é sazonalidade do que é crescimento.
 *   PISO              continuação a índice zero: o quanto a folha custa em doze
 *                     meses sem crescer nenhum. É o chão de qualquer leitura.
 *
 * Duas advertências que o módulo torna explícitas:
 *
 * 1. O painel NÃO ajusta o ARIMA. O ajuste é feito no Estado inteiro, por grupo de
 *    natureza, e aqui ele é apenas RECORTADO na proporção da massa do recorte.
 *    Apresentar um ARIMA "do órgão" ajustado sobre doze pontos seria pior que não
 *    apresentar nenhum.
 * 2. O backtest está publicado junto. Um método que subestimou sistematicamente o
 *    que de fato se liquidou não pode servir de referência de suficiência
 *    orçamentária, e é isso que o backtest mostra.
 */

import { MESES, PARAMETROS_PADRAO, realizado8 } from './regras.js';

/**
 * Forma sazonal de um conjunto: o peso de cada mês do ano na massa anual, medido
 * sobre o realizado. Dezembro pesa mais porque leva o 13º, e usar média simples no
 * lugar da forma empurraria massa de dezembro para os outros onze meses.
 */
export function formaSazonal(linhas) {
  const soma = new Array(8).fill(0);
  for (const L of linhas) {
    const r = realizado8(L);
    for (let i = 0; i < 8; i += 1) soma[i] += r[i];
  }
  const total = soma.reduce((a, b) => a + b, 0);
  if (total === 0) return new Array(8).fill(1 / 8);
  return soma.map((v) => v / total);
}

/**
 * Vegetativo sazonal desta tela.
 *
 * Continua os quatro meses em aberto pela forma de jan–ago, corrigida pela taxa
 * declarada ao ano, e provisiona o 13º pela mesma regra 5.5. É uma leitura de
 * continuação, não de composição por linha: por construção ela não enxerga teto,
 * mediana nem desligamento, e por isso fica ABAIXO do modelo da DOE.
 */
export function vegetativoDaTela(linhas, par = PARAMETROS_PADRAO, p26 = null) {
  const v = par.vegetativoTela;
  const forma = formaSazonal(linhas);
  const mediaMensal = forma.reduce((a, b) => a + b, 0) / 8;

  let janAgo = 0;
  const meses = new Array(12).fill(0);
  for (const L of linhas) {
    const r = realizado8(L);
    for (let i = 0; i < 8; i += 1) { meses[i] += r[i]; janAgo += r[i]; }
  }

  // Cada mês projetado vale a massa de jan–ago escalada pela forma do mês
  // correspondente do ano anterior — aqui aproximada pela forma média — crescida
  // pela taxa ao ano distribuída desde agosto.
  for (let k = 0; k < 4; k += 1) {
    const fator = (1 + v) ** ((k + 1) / 12);
    meses[8 + k] = janAgo * mediaMensal * fator;
  }

  // O 13º segue a mesma regra do modelo: dezembro × fator13, dentro de dezembro,
  // e só nas naturezas que provisionam. A massa com 13º vem do próprio p26 quando
  // disponível, para que as duas leituras usem a mesma lista de naturezas.
  const fracao13 = p26 && p26.ano > 0 ? p26.t13 / (p26.ano - p26.t13) * 12 : 1;
  const t13 = meses[11] * Math.min(1, Math.max(0, fracao13)) * par.fator13;
  meses[11] += t13;

  const ano2026 = meses.reduce((a, b) => a + b, 0);
  // 2027 continua a mesma lógica: doze meses à taxa declarada desde dezembro.
  const ancora = meses[11] - t13;
  const meses27 = [];
  for (let k = 1; k <= 12; k += 1) meses27.push(ancora * (1 + v) ** (k / 12));
  const t1327 = meses27[11] * Math.min(1, Math.max(0, fracao13)) * par.fator13Ativo27;
  const ano2027 = meses27.reduce((a, b) => a + b, 0) + t1327;

  return { meses, meses27, t13, t1327, ano2026, ano2027, janAgo };
}

/**
 * Piso: continuação a índice zero.
 *
 * Nenhuma projeção devolve menos que isto sem afirmar que a folha ENCOLHE. Serve
 * de chão de leitura: se um método entrega menos que o piso, o que ele está
 * dizendo é que haverá redução de quadro, e isso é decisão administrativa, não
 * tendência.
 */
export function pisoIndiceZero(linhas, par = PARAMETROS_PADRAO, p26 = null) {
  let janAgo = 0;
  const meses = new Array(12).fill(0);
  for (const L of linhas) {
    const r = realizado8(L);
    for (let i = 0; i < 8; i += 1) { meses[i] += r[i]; janAgo += r[i]; }
  }
  const agosto = meses[7];
  for (let k = 8; k < 12; k += 1) meses[k] = agosto;

  const fracao13 = p26 && p26.ano > 0 ? p26.t13 / (p26.ano - p26.t13) * 12 : 1;
  const t13 = agosto * Math.min(1, Math.max(0, fracao13)) * par.fator13;
  meses[11] += t13;

  const ano2026 = meses.reduce((a, b) => a + b, 0);
  const ano2027 = agosto * 12 + agosto * Math.min(1, Math.max(0, fracao13)) * par.fator13Ativo27;
  return { meses, t13, ano2026, ano2027, janAgo };
}

/**
 * Piso sem as intraorçamentárias.
 *
 * É outra régua, e a diferença entre as duas é grande. A contraparte
 * intraorçamentária é despesa do Estado consigo mesmo: quem compara contra o
 * limite de despesa com pessoal da LRF usa a régua líquida, e quem pede crédito
 * usa a bruta. Publicar uma e rotular como a outra é erro de régua, não de conta.
 */
export function pisoSemIntra(linhas, par = PARAMETROS_PADRAO, p26 = null) {
  const limpas = linhas.filter((L) => Number(String(L.nat).padStart(6, '0').slice(2, 4)) !== 91);
  return pisoIndiceZero(limpas, par, p26);
}

/**
 * Recorta o ARIMA ajustado no Estado para o conjunto de linhas em tela.
 *
 * O recorte é PROPORCIONAL à massa realizada de jan–ago do grupo de natureza a que
 * a linha pertence. É a única operação honesta disponível: o modelo foi ajustado
 * sobre a série do Estado, e dividi-lo por massa diz "esta é a parcela desta
 * leitura que cabe a este recorte", sem fingir que houve ajuste local.
 */
export function recortaArima(arima, linhas, todasAsLinhas) {
  if (!arima) return null;
  const massa = (xs, grupo) => xs
    .filter((L) => grupoDeNatureza(L.nat) === grupo)
    .reduce((a, L) => a + realizado8(L).reduce((x, y) => x + y, 0), 0);

  const saida = {};
  for (const [nome, esp] of Object.entries(arima.especificacoes)) {
    let p2026 = 0;
    let p2027 = 0;
    const porGrupo = [];
    for (const [grupo, valores] of Object.entries(esp.porGrupo)) {
      const m = massa(linhas, grupo);
      const mTotal = massa(todasAsLinhas, grupo);
      const parte = mTotal === 0 ? 0 : m / mTotal;
      p2026 += valores.total2026 * parte;
      p2027 += valores.total2027 * parte;
      porGrupo.push({
        grupo,
        rotulo: NOME_GRUPO_NATUREZA[grupo] ?? grupo,
        parte,
        total2026: valores.total2026 * parte,
        total2027: valores.total2027 * parte,
      });
    }
    saida[nome] = {
      nome,
      especificacao: esp.especificacao,
      descricao: esp.descricao,
      observacoes: esp.observacoes,
      parametros: esp.parametros,
      grausDeLiberdade: esp.observacoes - esp.parametros,
      total2026: p2026,
      total2027: p2027,
      porGrupo,
    };
  }
  return saida;
}

/** Grupos de natureza usados no ajuste do ARIMA. */
export const NOME_GRUPO_NATUREZA = Object.freeze({
  pessoal: 'Pessoal',
  intra: 'Intraorçamentária',
});

export function grupoDeNatureza(nat) {
  return Number(String(nat).padStart(6, '0').slice(2, 4)) === 91 ? 'intra' : 'pessoal';
}

/**
 * Backtest: o que cada especificação teria projetado em três pontos de corte, e o
 * que de fato se liquidou depois.
 *
 * Erro negativo em todos os horizontes é subestimação sistemática. Um método que
 * subestima não serve de referência de suficiência orçamentária: usado assim, ele
 * produz pedido de crédito MENOR que o necessário, que é exatamente o erro que não
 * se pode aceitar num pedido de crédito.
 */
export function leBacktest(arima) {
  if (!arima?.backtest) return [];
  return arima.backtest.map((b) => ({
    ...b,
    erroJanela: b.realizado === 0 ? null : b.janela / b.realizado - 1,
    erroInteira: b.realizado === 0 ? null : b.inteira / b.realizado - 1,
  }));
}

/**
 * Série realizada do relatório 8778: 44 meses, de janeiro de 2023 a agosto de 2026.
 *
 * Ela PARA em agosto de 2026 porque é liquidação, e não projeção. O exercício de
 * 2026 vem truncado em oito meses de propósito: completá-lo com os quatro meses
 * projetados do modelo da DOE misturaria realizado com projetado numa série
 * rotulada como realizada, que é a forma mais direta de produzir um "histórico" que
 * confirma a projeção que ele deveria contrastar.
 */
export function serieDo8778(oito, linhas, todasAsLinhas) {
  if (!oito) return null;
  const massa = (xs) => xs.reduce((a, L) => a + realizado8(L).reduce((x, y) => x + y, 0), 0);
  const parte = massa(todasAsLinhas) === 0 ? 0 : massa(linhas) / massa(todasAsLinhas);
  const saida = {};
  for (const [ano, dados] of Object.entries(oito.anos)) {
    saida[ano] = {
      meses: dados.meses.map((v) => v * parte),
      total: dados.meses.reduce((a, b) => a + b, 0) * parte,
    };
  }
  return { parte, anos: saida, unidades: oito.unidades, dotacao: oito.dotacao * parte };
}

export const NOMES_MES = MESES;
