/**
 * Aba de simulação — a que responde "quanto custa cada ponto".
 *
 * A consulta auditada publicava as premissas como texto ("teto de 1,50%", "reajuste
 * de 5,00%") e o resultado como número, sem nada entre as duas coisas. Quem lê não
 * tinha como saber se meio ponto de teto vale dez milhões ou um bilhão, e é
 * justamente essa a pergunta de quem decide.
 */

import {
  avisoDePremissa, avisoDeRecorte, bi, cabecalho, delta, dinheiro, div, el, faixa,
  indicador, inteiro, nota, pct, reaisMi, secao, span, tabela,
} from './comum.js';
import { curvaDePremissa, serieMensal } from '../ui/graficos.js';
import { curva } from '../../nucleo/sensibilidade.js';

export const meta = {
  chave: 'simulacao',
  rotulo: 'Simulação',
  pergunta: 'Quanto custa cada ponto de cada premissa?',
};

export function desenha(carga) {
  const { p26, p27, sens, credito } = carga;

  const topo = faixa([
    indicador({
      rotulo: 'Projeção de 2026',
      valor: bi(p26.ano),
      nota: `${reaisMi(p26.janAgo)} realizados + ${reaisMi(p26.setDez)} projetados`,
      regua: 'com o 13º dentro de dezembro',
    }),
    indicador({
      rotulo: 'Dotação atualizada',
      valor: bi(p26.dotacao),
      nota: 'coluna de orçamento atualizado do modelo',
      regua: 'não é a dotação líquida do relatório 8050',
    }),
    indicador({
      rotulo: 'Crédito a abrir · líquido',
      valor: bi(credito.liquida),
      nota: 'projeção menos dotação, no total do recorte',
      regua: 'sobra de um Poder compensa falta de outro',
      tom: credito.liquida > 0 ? 'alerta' : '',
    }),
    indicador({
      rotulo: 'Crédito a abrir · bruto por unidade',
      valor: bi(credito.brutaPorUnidade),
      nota: `soma da falta das ${inteiro(credito.descobertosPorUnidade)} unidades descobertas`,
      regua: 'é esta a leitura que a execução exige',
      tom: 'alerta',
    }),
    indicador({
      rotulo: 'Projeção de 2027',
      valor: bi(p27.ano),
      nota: `${pct(p27.ano / p26.ano - 1, 2)} sobre 2026`,
      regua: `leitura de D6 ${carga.par.modoD6 === 'mes' ? 'ao mês' : 'ao ano'}`,
    }),
  ]);

  return div('aba', [
    cabecalho(carga, 'Simulação de premissas', meta.pergunta),
    avisoDeRecorte(carga),
    avisoDePremissa(carga),
    topo,
    secao('Série mensal de 2026',
      'Oito meses de liquidação e quatro de premissa. A fronteira é desenhada porque '
      + 'sem ela as duas coisas parecem a mesma, e dezembro é marcado porque leva o '
      + '13º dentro — sem a marca, o salto de cinquenta por cento parece tendência.',
      [
        serieMensal({
          valores: p26.meses,
          primeiroProjetado: carga.par.primeiroMesProjetado - 1,
          destaque13: 11,
          referencia: carga.piso.meses,
          rotuloReferencia: 'piso a índice zero',
          rotulo: 'série mensal de 2026 em milhões de reais',
        }),
        nota('O contorno é o piso a índice zero: o que a folha custaria se agosto se '
          + 'repetisse até dezembro. Onde a barra fica ABAIXO do contorno, o modelo '
          + 'projeta redução — e redução vem das 252 linhas que a regra 5.1 desliga, '
          + 'não de tendência.', 'neutro'),
      ]),
    secao('O que cada premissa custa',
      'Efeito no exercício de 2026, no de 2027 e no crédito a abrir. A coluna de '
      + 'arrasto marca as premissas de 2026 que movem 2027: o ponto de partida de '
      + '2027 é dezembro de 2026 projetado (regra D2), então mexer no teto de 2026 '
      + 'desloca os doze meses de 2027 inteiros.',
      [tabelaSensibilidade(sens), notaDeDormencia(carga)]),
    secao('A curva do teto não é uma reta',
      'Cada linha só passa a sentir o teto a partir do ponto em que ele corta o '
      + 'histórico dela. Por isso a curva tem joelho, e por isso "meio ponto" custa '
      + 'valores diferentes em pontos diferentes da faixa.',
      [curvaDoTeto(carga)]),
  ]);
}

function tabelaSensibilidade(sens) {
  const colunas = [
    { rotulo: 'Premissa', celula: (c) => c.rotulo },
    {
      rotulo: 'De',
      alinha: 'd',
      celula: (c) => c.de,
    },
    {
      rotulo: 'Para',
      alinha: 'd',
      celula: (c) => c.para,
    },
    {
      rotulo: 'Efeito em 2026',
      alinha: 'd',
      celula: (c) => span(efeitoTom(c.d2026), delta(c.d2026)),
    },
    {
      rotulo: 'Efeito em 2027',
      alinha: 'd',
      nota: 'premissa de 2026 move 2027 pela âncora de D2',
      celula: (c) => span(efeitoTom(c.d2027), delta(c.d2027)),
    },
    {
      rotulo: 'Por ponto · 2026',
      alinha: 'd',
      nota: 'só existe quando a premissa é uma taxa',
      celula: (c) => (c.porPonto2026 === null ? '—' : dinheiro(c.porPonto2026)),
    },
    {
      rotulo: 'Efeito no crédito',
      alinha: 'd',
      celula: (c) => span(efeitoTom(c.dCredito), delta(c.dCredito)),
    },
    {
      rotulo: 'Arrasta 2027',
      alinha: 'd',
      nota: 'a premissa é de 2026 e move 2027 também',
      celula: (c) => (c.arrasta ? span('selo selo-aviso', 'sim') : span('', '—')),
    },
  ];
  return div('', [
    tabela({ colunas, linhas: sens.casos }),
    el('ul', { classe: 'lista-notas' }, sens.casos
      .filter((c) => c.nota)
      .map((c) => el('li', {}, [el('strong', { texto: `${c.rotulo}: ` }), c.nota]))),
  ]);
}

function efeitoTom(v) {
  if (Math.abs(v) < 1) return 'neutro-num';
  return v > 0 ? 'ruim' : 'bom';
}

/**
 * A nota da premissa dormente.
 *
 * É o achado que não aparece em nenhum número publicado: o reajuste geral de 5,00%
 * vigora em maio, mês já liquidado, e por isso custa exatamente zero na projeção. O
 * custo aparece só se a vigência se deslocar para um mês em aberto.
 */
function notaDeDormencia(carga) {
  const { par, p26, sens } = carga;
  const dormente = par.mesReajuste < par.primeiroMesProjetado;
  const deslocado = sens.casos.find((c) => c.chave === 'mesReajuste');
  const umPonto = sens.casos.find((c) => c.chave === 'reajuste+');

  if (!dormente) {
    return nota([
      `A vigência do reajuste está no mês ${par.mesReajuste}, que é mês projetado: a `
      + 'premissa incide e alcança ',
      el('strong', { texto: `${inteiro(p26.memoria.mesesLinhaReajuste)} meses-linha` }),
      '.',
    ], 'aviso');
  }

  return nota([
    el('strong', { texto: 'Premissa dormente. ' }),
    `O reajuste geral de ${pct(par.reajuste)} vigora no mês ${par.mesReajuste}, já `
    + 'liquidado. Ele alcança ',
    el('strong', { texto: `${inteiro(p26.memoria.mesesLinhaReajuste)} meses-linha` }),
    ` da projeção, e um ponto a mais nele custa ${delta(umPonto.d2026)}. Deslocar a `
    + 'vigência para o primeiro mês em aberto custa ',
    el('strong', { texto: delta(deslocado.d2026) }),
    ' — e é essa a diferença que a premissa publicada como texto esconde.',
  ], 'aviso');
}

/**
 * A curva do teto, desenhada como CUSTO ACUMULADO e não como nível do exercício.
 *
 * É a única forma de respeitar as duas exigências ao mesmo tempo. O eixo de valor
 * tem de começar em zero, e o exercício de 2026 vale cerca de R$ 47 bi enquanto a
 * faixa inteira do teto move menos de R$ 1 bi: desenhado como nível, com base em
 * zero, o gráfico é uma reta horizontal e não mostra o joelho que a seção afirma
 * existir. Desenhar o nível com base cortada mostraria o joelho e mentiria sobre a
 * magnitude.
 *
 * O custo acumulado — exercício ao teto t menos exercício a teto zero — começa em
 * zero de VERDADE, e a base em zero deixa de ser uma convenção e passa a ser o
 * próprio dado.
 */
function curvaDoTeto(carga) {
  const valores = [];
  for (let v = 0; v <= 0.0401; v += 0.0025) valores.push(Number(v.toFixed(5)));
  const medidas = curva(carga.modelo, carga.par, { campo: 'teto', valores });
  const piso = medidas[0].proj2026;
  const pontos = medidas.map((x) => ({ x: x.valor, y: x.proj2026 - piso }));

  // O joelho, medido: a inclinação do primeiro trecho contra a do último.
  const inclinacao = (i) => (pontos[i].y - pontos[i - 1].y)
    / (pontos[i].x - pontos[i - 1].x);
  const primeira = inclinacao(1);
  const ultima = inclinacao(pontos.length - 1);

  return div('', [
    curvaDePremissa({
      pontos,
      declarado: carga.par.teto,
      eixoX: (v) => pct(v, 1),
      rotulo: 'custo acumulado do teto sobre o exercício de 2026, em milhões de reais',
    }),
    nota([
      'O eixo vertical é o CUSTO ACUMULADO do teto — o exercício ao teto escolhido '
      + 'menos o exercício a teto zero — e não o nível do exercício. A troca é '
      + 'deliberada: o exercício vale cerca de ',
      el('strong', { texto: bi(carga.p26.ano) }),
      ` e a faixa inteira do teto move ${reaisMi(pontos.at(-1).y)}, então o nível `
      + 'desenhado com base em zero seria uma reta horizontal. Cortar a base mostraria '
      + 'o joelho e mentiria sobre a magnitude; medir o custo mostra o joelho e mantém '
      + 'o zero como dado, e não como convenção.',
    ], 'neutro'),
    nota([
      el('strong', { texto: 'O joelho. ' }),
      `No primeiro meio ponto de teto, cada ponto percentual custa ${dinheiro(primeira / 100)}`
      + ` por ponto; no último, ${dinheiro(ultima / 100)}. `
      + `A razão entre os dois é de ${(primeira / Math.max(1, ultima)).toLocaleString('pt-BR', {
        maximumFractionDigits: 1,
      })} vezes: no fim da faixa quase toda linha já está com o cv declarado abaixo do `
      + 'teto, e subi-lo mais deixa de alcançar linha nova. "Meio ponto de teto" não é '
      + 'um valor; é um valor por ponto de partida.',
    ], 'aviso'),
  ]);
}
