/**
 * Aba de 2027 — as regras D1 a D7 e os dois achados que elas carregam.
 *
 * O primeiro é a decomposição: dos R$ 2.915,1 mi de crescimento de 2027 sobre 2026,
 * 88,6% vêm de ANCORAR em dezembro em vez de na média do ano, e só 11,4% vêm do
 * vegetativo de D6. A consulta publicava os dois exercícios lado a lado e nada entre
 * eles, e a discussão orçamentária se concentrava no décimo menor.
 *
 * O segundo é a ambiguidade de D6: o enunciado traz o percentual e não diz o
 * período. A distância entre as duas leituras da MESMA frase é maior que o crédito a
 * abrir do exercício corrente.
 */

import {
  avisoDePremissa, avisoDeRecorte, bi, cabecalho, delta, div, el, faixa, indicador,
  inteiro, nota, pct, pctSinal, reaisMi, secao, span, tabela, tabelaAgregacao,
  tabelaMensal,
} from './comum.js';
import { barrasAgrupadas, cascata, serieMensal } from '../ui/graficos.js';
import { fatorD6 } from '../../nucleo/projecao2027.js';
import { NOME_CLASSE27 } from '../../nucleo/agregacao.js';

export const meta = {
  chave: 'ano2027',
  rotulo: 'Exercício 2027',
  pergunta: 'De onde vem o crescimento de 2027, e o que D6 quer dizer?',
};

export function desenha(carga) {
  const {
    p26, p27, p27Literal, crescimento, comp27, agregados, par,
  } = carga;

  return div('aba', [
    cabecalho(carga, 'Exercício de 2027', meta.pergunta),
    avisoDeRecorte(carga),
    avisoDePremissa(carga),

    faixa([
      indicador({
        rotulo: 'Projeção de 2027',
        valor: bi(p27.ano),
        nota: `${pctSinal(p27.ano / p26.ano - 1, 2)} sobre 2026`,
        regua: `D6 lido como taxa ao ${par.modoD6 === 'mes' ? 'mês' : 'ano'}`,
      }),
      indicador({
        rotulo: 'Âncora · dezembro de 2026',
        valor: reaisMi(p27.ancora),
        nota: `dezembro publicado é ${reaisMi(p26.meses[11])}`,
        regua: 'regra D2: SEM a provisão do 13º',
      }),
      indicador({
        rotulo: 'Efeito-base',
        valor: bi(crescimento.efeitoBase),
        nota: `${pct(crescimento.parcelaEfeitoBase, 1)} do crescimento`,
        regua: 'custo de ancorar em dezembro, não na média do ano',
        tom: 'alerta',
      }),
      indicador({
        rotulo: 'Vegetativo de D6',
        valor: bi(crescimento.vegetativo),
        nota: `${pct(crescimento.parcelaVegetativo, 1)} do crescimento`,
        regua: 'é a parcela que a discussão tratava como o todo',
      }),
      indicador({
        rotulo: 'D6 lido ao mês',
        valor: bi(p27Literal.ano),
        nota: `${delta(p27Literal.ano - p27.ano)} contra a leitura publicada`,
        regua: 'a mesma frase, o outro período',
        tom: 'alerta',
      }),
    ]),

    secao('De onde vem o crescimento de 2027',
      'A decomposição roda sempre: 2027 é reprojetado com o vegetativo e o nominal em '
      + 'ZERO, e o que sobra de diferença contra 2026 é o efeito-base — o custo do ato '
      + 'de ancorar em dezembro em vez de na média do exercício.',
      [
        cascata({
          partida: { rotulo: 'Exercício 2026', valor: p26.ano },
          parcelas: [
            { rotulo: 'Efeito-base (D2)', valor: crescimento.efeitoBase, tom: 'alerta' },
            { rotulo: 'Vegetativo (D6)', valor: crescimento.vegetativo },
            { rotulo: 'Nominal (D7)', valor: crescimento.nominal },
          ],
          chegada: { rotulo: 'Exercício 2027', valor: p27.ano },
          rotulo: 'decomposição do crescimento de 2027, em milhões de reais',
        }),
        tabelaDecomposicao(carga),
      ]),

    secao('As duas leituras de D6',
      'O enunciado traz 1,50% para ativos e 0,50% para inativos, e NÃO diz o período. '
      + 'Lido como taxa ao ano, o fator do mês k é (1+v)^(k/12). Lido como taxa ao '
      + 'mês, é (1+v)^k, e compõe 19,56% no ano. As duas rodam sempre.',
      [
        barrasAgrupadas({
          categorias: ['Exercício 2026', 'D6 ao ano', 'D6 ao mês'],
          series: [{
            rotulo: 'exercício em milhões de reais',
            valores: [p26.ano, p27.ano, p27Literal.ano],
          }],
          rotulo: 'as duas leituras de D6, em milhões de reais',
        }),
        tabelaDasLeiturasDeD6(carga),
      ]),

    secao('Série de 2027, mês a mês',
      'Doze meses encadeados a partir de dezembro de 2026, com o 13º de D5 dentro de '
      + 'dezembro. A cesta D4 — elementos 91 a 94 — é flat: cada mês dela vale a média '
      + 'de 2026 e nenhum fator de vegetativo a alcança.',
      [
        serieMensal({
          valores: p27.mesesPublicados,
          primeiroProjetado: 0,
          destaque13: 11,
          referencia: p27Literal.mesesPublicados,
          rotuloReferencia: 'D6 lido ao mês',
          rotulo: 'série mensal de 2027 em milhões de reais',
        }),
        tabelaMensal({
          series: [
            { rotulo: 'D6 ao ano · publicado', valores: p27.mesesPublicados },
            { rotulo: 'D6 ao mês · leitura literal', valores: p27Literal.mesesPublicados },
          ],
          primeiroProjetado: 0,
        }),
      ]),

    secao('As três cestas de 2027',
      'Ativos a 1,50%, inativos e RPPS a 0,50%, e a cesta D4 que não se projeta. A '
      + 'cesta D4 é a ÚNICA passagem em que a média de 2026 é usada, e é o documento '
      + 'que manda usá-la — fora dela, D1 proíbe.',
      [tabelaAgregacao(agregados.porClasse27), tabelaDasCestas(carga)]),

    secao('O 13º de 2027 (regra D5)',
      '90% de dezembro para os ativos e 95% para inativos e RPPS, dentro de dezembro '
      + 'como em 2026.',
      [tabelaDoDecimoTerceiro(carga)]),

    secao('Os fatores de D6, mês a mês',
      'O fator acumulado desde dezembro de 2026, nas duas leituras. É aqui que a '
      + 'ambiguidade do enunciado deixa de ser discussão de texto e passa a ser número.',
      [tabelaDosFatores(carga)]),
  ]);
}

function tabelaDecomposicao(carga) {
  const { crescimento: c, p26, p27 } = carga;
  const linhas = [
    {
      rotulo: 'Efeito-base · regra D2',
      valor: c.efeitoBase,
      parte: c.parcelaEfeitoBase,
      causa: 'ancorar em dezembro de 2026 em vez de na média do exercício',
      decisao: 'é escolha de metodologia, não de política salarial',
    },
    {
      rotulo: 'Vegetativo · regra D6',
      valor: c.vegetativo,
      parte: c.parcelaVegetativo,
      causa: `${pct(carga.par.vegetativoAtivo27)} nos ativos e `
        + `${pct(carga.par.vegetativoInativo27)} nos inativos`,
      decisao: 'é a premissa que a discussão orçamentária tratava como o todo',
    },
    {
      rotulo: 'Aumento nominal · D7',
      valor: c.nominal,
      parte: c.parcelaNominal,
      causa: carga.par.aumentoNominal27 === 0
        ? 'em zero: não consta do documento'
        : `${pct(carga.par.aumentoNominal27)} a partir do mês ${carga.par.mesNominal27}`,
      decisao: 'premissa DESTA TELA, não do documento',
    },
  ];

  return div('', [
    tabela({
      colunas: [
        { rotulo: 'Parcela', celula: (x) => x.rotulo },
        { rotulo: 'Valor', alinha: 'd', celula: (x) => el('strong', { texto: reaisMi(x.valor) }) },
        { rotulo: 'Parte do crescimento', alinha: 'd', celula: (x) => pct(x.parte, 1) },
        { rotulo: 'De onde vem', celula: (x) => x.causa },
        { rotulo: 'Natureza da decisão', celula: (x) => x.decisao },
      ],
      linhas,
      rodape: {
        rotulo: 'Crescimento total',
        valor: c.total,
        parte: 1,
        causa: `${reaisMi(p26.ano)} → ${reaisMi(p27.ano)}`,
        decisao: pctSinal(c.relativo, 2),
      },
    }),
    nota([
      el('strong', { texto: `${pct(c.parcelaEfeitoBase, 1)} do crescimento de 2027 ` }),
      'não vem de nenhuma premissa de taxa: vem da escolha do mês de referência. '
      + 'Reduzir o vegetativo a zero deixaria ',
      el('strong', { texto: reaisMi(c.efeitoBase) }),
      ' do crescimento de pé.',
    ], 'aviso'),
  ]);
}

function tabelaDasLeiturasDeD6(carga) {
  const { p27, p27Literal, par, p26 } = carga;
  const v = par.vegetativoAtivo27;
  const linhas = [
    {
      leitura: 'Taxa ao ano · publicada',
      formula: '(1 + v)^(k/12)',
      fator12: fatorD6(v, 12, 'ano'),
      anual: fatorD6(v, 12, 'ano') - 1,
      exercicio: p27.ano,
      razao: 'vegetativo de folha é taxa de ano: é o que progressões, promoções e '
        + 'anuênios acrescentam ao longo de doze meses',
    },
    {
      leitura: 'Taxa ao mês · leitura literal',
      formula: '(1 + v)^k',
      fator12: fatorD6(v, 12, 'mes'),
      anual: fatorD6(v, 12, 'mes') - 1,
      exercicio: p27Literal.ano,
      razao: 'é a leitura que a frase admite ao pé da letra, sem o período declarado',
    },
  ];

  return div('', [
    tabela({
      colunas: [
        { rotulo: 'Leitura do enunciado', celula: (x) => x.leitura },
        { rotulo: 'Fator do mês k', celula: (x) => x.formula },
        {
          rotulo: 'Fator em dezembro',
          alinha: 'd',
          celula: (x) => x.fator12.toFixed(6).replace('.', ','),
        },
        { rotulo: 'Taxa no ano', alinha: 'd', celula: (x) => pct(x.anual, 2) },
        {
          rotulo: 'Exercício de 2027',
          alinha: 'd',
          celula: (x) => el('strong', { texto: bi(x.exercicio) }),
        },
        { rotulo: 'Argumento', celula: (x) => x.razao },
      ],
      linhas,
    }),
    nota([
      'A distância entre as duas leituras da mesma frase é ',
      el('strong', { texto: bi(p27Literal.ano - p27.ano) }),
      `, contra um crédito a abrir de ${bi(p26.insuficiencia)} no exercício corrente. `
      + 'É por isso que as duas rodam sempre, e não sob demanda num menu: a escolha '
      + 'de leitura é mais cara que o pedido de crédito que ela deveria informar.',
    ], 'aviso'),
  ]);
}

function tabelaDasCestas(carga) {
  const { comp27, p27 } = carga;
  const e = comp27.exercicio;
  const linhas = [
    {
      cesta: NOME_CLASSE27.ativo,
      linhasN: p27.memoria.ativo,
      valor: e.ativo,
      t13: comp27.t13.ativo,
      regra: 'D3 e D6 · cadeia de doze meses desde dezembro de 2026',
    },
    {
      cesta: NOME_CLASSE27.inativo,
      linhasN: p27.memoria.inativo,
      valor: e.inativo,
      t13: comp27.t13.inativo,
      regra: 'D3 e D6 · mesma cadeia, taxa menor',
    },
    {
      cesta: NOME_CLASSE27.d4,
      linhasN: p27.memoria.d4,
      valor: e.d4,
      t13: 0,
      regra: 'D4 · cada mês vale a média de 2026, nenhum fator a alcança',
    },
  ];

  return tabela({
    colunas: [
      { rotulo: 'Cesta', celula: (x) => x.cesta },
      { rotulo: 'Linhas', alinha: 'd', celula: (x) => inteiro(x.linhasN) },
      { rotulo: 'Exercício 2027', alinha: 'd', celula: (x) => reaisMi(x.valor) },
      { rotulo: 'Parte', alinha: 'd', celula: (x) => pct(x.valor / e.total, 1) },
      {
        rotulo: 'Dentro: 13º',
        alinha: 'd',
        nota: 'regra D5, lançado dentro de dezembro',
        celula: (x) => (x.t13 === 0 ? '—' : reaisMi(x.t13)),
      },
      { rotulo: 'Regra', celula: (x) => x.regra },
    ],
    linhas,
    rodape: {
      cesta: 'Exercício de 2027',
      linhasN: p27.memoria.linhas,
      valor: e.total,
      t13: comp27.t13.total,
      regra: '',
    },
  });
}

function tabelaDoDecimoTerceiro(carga) {
  const { p27, par, comp27 } = carga;
  const linhas = [
    {
      grupo: 'Ativos',
      fator: par.fator13Ativo27,
      dez: p27.porCesta.ativo[11],
      t13: comp27.t13.ativo,
      n: p27.memoria.com13Ativo,
    },
    {
      grupo: 'Inativos e RPPS',
      fator: par.fator13Inativo27,
      dez: p27.porCesta.inativo[11],
      t13: comp27.t13.inativo,
      n: p27.memoria.com13Inativo,
    },
  ];

  return div('', [
    tabela({
      colunas: [
        { rotulo: 'Grupo', celula: (x) => x.grupo },
        { rotulo: 'Linhas que provisionam', alinha: 'd', celula: (x) => inteiro(x.n) },
        { rotulo: 'Fator de D5', alinha: 'd', celula: (x) => pct(x.fator, 0) },
        { rotulo: 'Dezembro de 2027', alinha: 'd', celula: (x) => reaisMi(x.dez) },
        { rotulo: 'Provisão', alinha: 'd', celula: (x) => reaisMi(x.t13) },
      ],
      linhas,
      rodape: {
        grupo: 'Total',
        n: p27.memoria.com13Ativo + p27.memoria.com13Inativo,
        fator: null,
        dez: p27.meses[11],
        t13: p27.t13,
      },
    }),
    p27.memoria.com13Inativo === 0
      ? nota('Nenhuma linha de inativo provisiona 13º neste recorte: as naturezas de '
        + 'aposentadoria e pensão não estão na lista da regra 5.5, e o fator de 95% '
        + 'fica sem aplicação. A premissa é declarada e dormente.', 'aviso')
      : null,
  ]);
}

function tabelaDosFatores(carga) {
  const v = carga.par.vegetativoAtivo27;
  const vi = carga.par.vegetativoInativo27;
  const linhas = [];
  for (let k = 1; k <= 12; k += 1) {
    linhas.push({
      k,
      ativoAno: fatorD6(v, k, 'ano'),
      ativoMes: fatorD6(v, k, 'mes'),
      inativoAno: fatorD6(vi, k, 'ano'),
      inativoMes: fatorD6(vi, k, 'mes'),
    });
  }
  const f = (x) => x.toFixed(6).replace('.', ',');

  return tabela({
    classe: 'tabela-estreita',
    colunas: [
      { rotulo: 'Mês de 2027', celula: (x) => x.k },
      { rotulo: 'Ativo · ao ano', alinha: 'd', celula: (x) => f(x.ativoAno) },
      { rotulo: 'Ativo · ao mês', alinha: 'd', celula: (x) => f(x.ativoMes) },
      {
        rotulo: 'Distância',
        alinha: 'd',
        celula: (x) => pct(x.ativoMes / x.ativoAno - 1, 2),
      },
      { rotulo: 'Inativo · ao ano', alinha: 'd', celula: (x) => f(x.inativoAno) },
      { rotulo: 'Inativo · ao mês', alinha: 'd', celula: (x) => f(x.inativoMes) },
    ],
    linhas,
  });
}
