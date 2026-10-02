/**
 * Aba de abertura e crédito — o pedido de crédito e as três réguas que o medem.
 *
 * A consulta auditada publicava UMA leitura: projeção menos dotação no total do
 * Estado, R$ 2.974,1 mi. Essa leitura subtrai a sobra de quem está coberto da falta
 * de quem não está, e orçamentariamente a sobra de um Poder não cobre a falta de
 * outro. As três leituras diferem em mais de um bilhão e oitocentos milhões, e é
 * por isso que esta aba existe.
 */

import {
  avisoDePremissa, avisoDeRecorte, bi, cabecalho, delta, div, el, faixa, indicador,
  inteiro, nota, pct, reaisMi, secao, span, tabela, tabelaAgregacao,
} from './comum.js';
import { barrasAgrupadas, barrasHorizontais } from '../ui/graficos.js';

export const meta = {
  chave: 'abertura',
  rotulo: 'Crédito e abertura',
  pergunta: 'Quanto crédito precisa ser aberto, e por qual régua?',
};

export function desenha(carga) {
  const { credito, agregados, p26 } = carga;

  return div('aba', [
    cabecalho(carga, 'Crédito a abrir e abertura orçamentária', meta.pergunta),
    avisoDeRecorte(carga),
    avisoDePremissa(carga),

    faixa([
      indicador({
        rotulo: 'Líquido do recorte',
        valor: bi(credito.liquida),
        nota: 'projeção menos dotação, somadas antes',
        regua: 'é a leitura publicada na consulta',
      }),
      indicador({
        rotulo: 'Bruto por Poder',
        valor: bi(credito.brutaPorPoder),
        nota: `soma da falta dos ${inteiro(credito.descobertosPorPoder)} Poderes descobertos`,
        regua: 'ignora a sobra de quem está coberto',
        tom: 'alerta',
      }),
      indicador({
        rotulo: 'Bruto por unidade',
        valor: bi(credito.brutaPorUnidade),
        nota: `soma da falta das ${inteiro(credito.descobertosPorUnidade)} unidades descobertas`,
        regua: 'é a régua mais fina, e a que a execução exige',
        tom: 'alerta',
      }),
      indicador({
        rotulo: 'Sobra não transferível',
        valor: bi(credito.sobraPorPoder),
        nota: `nos ${inteiro(credito.cobertosPorPoder)} Poderes cobertos`,
        regua: 'é exatamente a diferença entre as duas primeiras leituras',
      }),
    ]),

    secao('As três leituras do mesmo pedido',
      'A identidade que explica a diferença: a leitura bruta MENOS a sobra de quem '
      + 'está coberto é a leitura líquida. A líquida não está errada como conta; ela '
      + 'responde a outra pergunta — quanto falta no agregado, e não quanto precisa '
      + 'ser aberto.',
      [
        barrasAgrupadas({
          categorias: ['Líquido do recorte', 'Bruto por Poder', 'Bruto por unidade'],
          series: [{
            rotulo: 'crédito a abrir, em milhões de reais',
            valores: [credito.liquida, credito.brutaPorPoder, credito.brutaPorUnidade],
          }],
          rotulo: 'as três leituras do crédito a abrir, em milhões de reais',
        }),
        tabelaDasTresLeituras(carga),
      ]),

    secao('Abertura por Poder',
      'É o quadro de insuficiência. Sobra em um Poder não cobre falta em outro, e é '
      + 'ler as duas colunas juntas que mostra por que a leitura líquida subestima.',
      [tabelaAgregacao(agregados.porPoder), graficoDeFalta(agregados.porPoder)]),

    secao('Unidades descobertas',
      `${inteiro(credito.descobertosPorUnidade)} das `
      + `${inteiro(agregados.porUnidade.itens.length)} unidades do recorte projetam acima `
      + 'da própria dotação. A lista é o que um pedido de crédito precisa ter, e é a '
      + 'informação que a leitura agregada apaga.',
      [tabelaDescobertas(carga)]),

    secao('Abertura por órgão', '', [tabelaAgregacao(agregados.porOrgao)]),

    secao('Abertura por natureza, modalidade e grupo',
      'A modalidade separa a aplicação direta da intraorçamentária. A contraparte '
      + 'intraorçamentária é despesa do Estado consigo mesmo: quem compara contra o '
      + 'limite de pessoal da LRF usa a régua líquida, e quem pede crédito usa a '
      + 'bruta. Publicar uma e rotular como a outra é erro de régua, não de conta.',
      [
        tabelaAgregacao(agregados.porModalidade),
        tabelaAgregacao(agregados.porGnd),
        el('details', { classe: 'detalhe' }, [
          el('summary', {
            texto: `Abertura por natureza · ${inteiro(agregados.porNatureza.itens.length)} naturezas`,
          }),
          div('detalhe-corpo', tabelaAgregacao(agregados.porNatureza)),
        ]),
      ]),

    secao('Composição do exercício',
      'De onde sai cada real do exercício de 2026.',
      [composicaoDoExercicio(carga)]),
  ]);
}

function tabelaDasTresLeituras(carga) {
  const { credito } = carga;
  const linhas = [
    {
      rotulo: 'Líquido do recorte',
      valor: credito.liquida,
      regua: 'projeção menos dotação, somadas antes de comparar',
      responde: 'quanto falta no agregado',
      publicada: true,
    },
    {
      rotulo: 'Bruto por Poder',
      valor: credito.brutaPorPoder,
      regua: `soma da falta dos ${inteiro(credito.descobertosPorPoder)} Poderes descobertos`,
      responde: 'quanto precisa ser aberto se a remanejamento vale dentro do Poder',
      publicada: false,
    },
    {
      rotulo: 'Bruto por unidade orçamentária',
      valor: credito.brutaPorUnidade,
      regua: `soma da falta das ${inteiro(credito.descobertosPorUnidade)} unidades descobertas`,
      responde: 'quanto precisa ser aberto se cada unidade se resolve sozinha',
      publicada: false,
    },
  ];

  return div('', [
    tabela({
      colunas: [
        { rotulo: 'Leitura', celula: (x) => x.rotulo },
        { rotulo: 'Valor', alinha: 'd', celula: (x) => el('strong', { texto: bi(x.valor) }) },
        {
          rotulo: 'Contra a líquida',
          alinha: 'd',
          celula: (x) => (x.publicada ? '—' : delta(x.valor - credito.liquida)),
        },
        { rotulo: 'Régua', celula: (x) => x.regua },
        { rotulo: 'Responde', celula: (x) => x.responde },
        {
          rotulo: 'Na consulta',
          celula: (x) => (x.publicada
            ? span('selo selo-aviso', 'é a publicada')
            : span('', 'não publicada')),
        },
      ],
      linhas,
    }),
    nota([
      'Identidade: bruto por Poder ',
      el('strong', { texto: bi(credito.brutaPorPoder) }),
      ' menos a sobra de quem está coberto ',
      el('strong', { texto: bi(credito.sobraPorPoder) }),
      ' é o líquido ',
      el('strong', { texto: bi(credito.liquida) }),
      `. A diferença entre a leitura publicada e a mais fina é de ${
        bi(credito.brutaPorUnidade - credito.liquida)}.`,
    ], 'aviso'),
  ]);
}

function graficoDeFalta(grupo) {
  const itens = grupo.itens
    .filter((g) => Math.abs(g.falta) > 0)
    .sort((a, b) => b.falta - a.falta)
    .map((g) => ({
      rotulo: g.rotulo.length > 34 ? `${g.rotulo.slice(0, 32)}…` : g.rotulo,
      valor: g.falta,
      descoberto: g.falta > 0,
    }));
  if (itens.length === 0) return null;

  return div('', [
    barrasHorizontais({
      itens,
      tom: (x) => (x.descoberto ? 'ruim' : 'bom'),
      rotulo: 'falta por Poder, em milhões de reais',
    }),
    nota('A barra mostra o MÓDULO da diferença. O tom separa quem está descoberto de '
      + 'quem tem sobra: as duas coisas não se somam, e é essa a questão.', 'neutro'),
  ]);
}

function tabelaDescobertas(carga) {
  const descobertas = carga.agregados.porUnidade.itens
    .filter((g) => g.falta > 0)
    .sort((a, b) => b.falta - a.falta);
  const cobertas = carga.agregados.porUnidade.itens.filter((g) => g.falta <= 0);

  return div('', [
    tabela({
      colunas: [
        { rotulo: 'Unidade orçamentária', celula: (g) => g.rotulo },
        { rotulo: 'Linhas', alinha: 'd', celula: (g) => inteiro(g.linhas) },
        { rotulo: 'Projeção 2026', alinha: 'd', celula: (g) => reaisMi(g.proj26) },
        { rotulo: 'Dotação', alinha: 'd', celula: (g) => reaisMi(g.dotacao) },
        {
          rotulo: 'Falta',
          alinha: 'd',
          celula: (g) => el('strong', { classe: 'ruim', texto: reaisMi(g.falta) }),
        },
        {
          rotulo: 'Cobertura',
          alinha: 'd',
          nota: 'dotação sobre projeção',
          celula: (g) => (g.proj26 === 0 ? '—' : pct(g.dotacao / g.proj26, 1)),
        },
      ],
      linhas: descobertas,
      rodape: {
        rotulo: `${inteiro(descobertas.length)} unidades descobertas`,
        linhas: descobertas.reduce((a, g) => a + g.linhas, 0),
        proj26: descobertas.reduce((a, g) => a + g.proj26, 0),
        dotacao: descobertas.reduce((a, g) => a + g.dotacao, 0),
        falta: descobertas.reduce((a, g) => a + g.falta, 0),
      },
      vazio: 'nenhuma unidade descoberta neste recorte',
    }),
    nota([
      `${inteiro(cobertas.length)} unidades têm sobra, somando `,
      el('strong', { texto: reaisMi(cobertas.reduce((a, g) => a - g.falta, 0)) }),
      '. Essa sobra não é transferível entre unidades sem ato próprio, e somá-la '
      + 'contra a falta das outras é o que produz a leitura líquida.',
    ], 'neutro'),
  ]);
}

function composicaoDoExercicio(carga) {
  const { p26 } = carga;
  const itens = [
    {
      rotulo: 'Realizado jan–ago',
      valor: p26.janAgo,
      nota: 'liquidação: não se move sob nenhuma premissa',
    },
    {
      rotulo: 'Projetado set–nov',
      valor: p26.meses.slice(8, 11).reduce((a, b) => a + b, 0),
      nota: 'regras 5.1 a 5.4',
    },
    {
      rotulo: 'Dezembro sem o 13º',
      valor: p26.dezSem13,
      nota: 'é este o valor que ancora 2027 (regra D2)',
    },
    {
      rotulo: 'Provisão do 13º',
      valor: p26.t13,
      nota: 'regra 5.5, lançada DENTRO de dezembro',
    },
  ];
  const total = itens.reduce((a, x) => a + x.valor, 0);

  return div('', [
    tabela({
      colunas: [
        { rotulo: 'Parcela', celula: (x) => x.rotulo },
        { rotulo: 'Valor', alinha: 'd', celula: (x) => reaisMi(x.valor) },
        {
          rotulo: 'Parte',
          alinha: 'd',
          celula: (x) => pct(x.valor / total, 1),
        },
        { rotulo: 'Régua', celula: (x) => x.nota },
      ],
      linhas: itens,
      rodape: {
        rotulo: 'Exercício de 2026', valor: total, nota: '',
      },
    }),
    nota(`A soma das parcelas é ${reaisMi(total)} contra ${reaisMi(p26.ano)} no `
      + `exercício: diferença de ${delta(total - p26.ano)}. A conferência interna `
      + 'trava a carga se ela passar de um real.', 'neutro'),
  ]);
}
