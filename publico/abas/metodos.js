/**
 * Aba de métodos — as leituras alternativas e o que cada uma responde.
 *
 * O modelo da DOE é a referência: é dele que sai o pedido de crédito. As outras
 * leituras existem para medir a distância até ele, e a aba publica o BACKTEST junto
 * com o ARIMA de propósito: um método que subestimou sistematicamente o que de fato
 * se liquidou não pode servir de referência de suficiência orçamentária, porque
 * usado assim ele produz pedido de crédito MENOR que o necessário.
 */

import {
  avisoDePremissa, avisoDeRecorte, bi, cabecalho, delta, div, el, faixa, indicador,
  inteiro, nota, pct, pctSinal, reaisMi, secao, span, tabela,
} from './comum.js';
import { barrasAgrupadas, serieMensal } from '../ui/graficos.js';
import { NOME_GRUPO_NATUREZA } from '../../nucleo/comparacao.js';

export const meta = {
  chave: 'metodos',
  rotulo: 'Métodos',
  pergunta: 'O que cada leitura projetaria, e qual delas serve de referência?',
};

export function desenha(carga) {
  const {
    p26, p27, p27Literal, veg, piso, pisoLimpo, arima, backtest, oito,
  } = carga;

  return div('aba', [
    cabecalho(carga, 'Métodos e leituras alternativas', meta.pergunta),
    avisoDeRecorte(carga),
    avisoDePremissa(carga),

    faixa([
      indicador({
        rotulo: 'Modelo da DOE · 2026',
        valor: bi(p26.ano),
        nota: 'regras 5.1 a 5.5, linha por linha',
        regua: 'é dele que sai o pedido de crédito',
      }),
      indicador({
        rotulo: 'ARIMA · janela de 36 meses',
        valor: bi(arima.janela.total2026),
        nota: delta(arima.janela.total2026 - p26.ano),
        regua: 'ajustado no Estado, recortado por massa',
      }),
      indicador({
        rotulo: 'ARIMA · série inteira',
        valor: bi(arima.inteira.total2026),
        nota: delta(arima.inteira.total2026 - p26.ano),
        regua: `${inteiro(arima.inteira.observacoes)} observações`,
      }),
      indicador({
        rotulo: 'Vegetativo sazonal da tela',
        valor: bi(veg.ano2026),
        nota: delta(veg.ano2026 - p26.ano),
        regua: 'não enxerga teto, mediana nem desligamento',
      }),
      indicador({
        rotulo: 'Piso a índice zero',
        valor: bi(piso.ano2026),
        nota: delta(piso.ano2026 - p26.ano),
        regua: 'agosto repetido: o chão de qualquer leitura',
      }),
    ]),

    secao('As cinco leituras, lado a lado',
      'Elas NÃO são rivais equivalentes. O modelo da DOE é o único que roda por linha '
      + 'e o único que enxerga as regras de exceção; os outros medem a distância até '
      + 'ele, cada um respondendo a uma pergunta diferente.',
      [
        barrasAgrupadas({
          categorias: ['Modelo da DOE', 'ARIMA 36m', 'ARIMA inteira', 'Vegetativo', 'Piso'],
          series: [
            {
              rotulo: 'exercício de 2026, em milhões de reais',
              valores: [p26.ano, arima.janela.total2026, arima.inteira.total2026,
                veg.ano2026, piso.ano2026],
            },
            {
              rotulo: 'exercício de 2027, em milhões de reais',
              valores: [p27.ano, arima.janela.total2027, arima.inteira.total2027,
                veg.ano2027, piso.ano2027],
            },
          ],
          rotulo: 'as cinco leituras nos dois exercícios, em milhões de reais',
        }),
        tabelaDosMetodos(carga),
      ]),

    secao('O backtest: o ARIMA subestima em todos os horizontes',
      'Cada especificação foi reprojetada em três pontos de corte e comparada com o '
      + 'que de fato se liquidou depois. Erro negativo em todo horizonte é '
      + 'subestimação sistemática, e um método que subestima não serve de referência '
      + 'de suficiência orçamentária.',
      [tabelaBacktest(backtest)]),

    secao('As duas especificações de ARIMA',
      'O painel NÃO ajusta o ARIMA. O ajuste é feito no Estado inteiro, por grupo de '
      + 'natureza, e aqui ele é apenas RECORTADO na proporção da massa do recorte. '
      + 'Apresentar um ARIMA "do órgão" ajustado sobre doze pontos seria pior que não '
      + 'apresentar nenhum.',
      [tabelaEspecificacoes(carga)]),

    secao('Série realizada do relatório 8778',
      'Quarenta e quatro meses de liquidação, de janeiro de 2023 a agosto de 2026. Ela '
      + 'PARA em agosto porque é realizado: completá-la com os quatro meses projetados '
      + 'produziria um histórico que confirma a projeção que ele deveria contrastar.',
      [serieDoOitoMilSetecentos(carga)]),

    secao('As duas réguas do piso',
      'A contraparte intraorçamentária é despesa do Estado consigo mesmo. Quem compara '
      + 'contra o limite de despesa com pessoal da LRF usa a régua líquida; quem pede '
      + 'crédito usa a bruta. Publicar uma e rotular como a outra é erro de régua, não '
      + 'de conta.',
      [tabelaDasReguas(carga)]),
  ]);
}

function tabelaDosMetodos(carga) {
  const {
    p26, p27, p27Literal, veg, piso, arima,
  } = carga;

  const linhas = [
    {
      metodo: 'Modelo da DOE',
      a2026: p26.ano,
      a2027: p27.ano,
      porLinha: true,
      responde: 'quanto custa a folha pelas regras publicadas',
      advertencia: 'é a referência: é dele que sai o pedido de crédito',
    },
    {
      metodo: 'Modelo da DOE · D6 lido ao mês',
      a2026: p26.ano,
      a2027: p27Literal.ano,
      porLinha: true,
      responde: 'quanto custa a OUTRA leitura do mesmo enunciado',
      advertencia: 'não é método rival: é a mesma frase lida com o outro período',
    },
    {
      metodo: 'ARIMA · janela de 36 meses',
      a2026: arima.janela.total2026,
      a2027: arima.janela.total2027,
      porLinha: false,
      responde: 'o que a série recente, sozinha, projetaria',
      advertencia: 'ajustado no Estado e recortado por massa; subestima no backtest',
    },
    {
      metodo: 'ARIMA · série inteira',
      a2026: arima.inteira.total2026,
      a2027: arima.inteira.total2027,
      porLinha: false,
      responde: 'o que a série longa projetaria',
      advertencia: 'mais observações e mais memória de regime antigo',
    },
    {
      metodo: 'Vegetativo sazonal da tela',
      a2026: veg.ano2026,
      a2027: veg.ano2027,
      porLinha: false,
      responde: 'quanto a folha custa continuando a forma do ano a taxa declarada',
      advertencia: 'premissa DESTA TELA; por construção fica abaixo do modelo',
    },
    {
      metodo: 'Piso a índice zero',
      a2026: piso.ano2026,
      a2027: piso.ano2027,
      porLinha: false,
      responde: 'o chão: doze meses de agosto, sem crescer nenhum',
      advertencia: 'quem entrega menos que o piso afirma que a folha ENCOLHE',
    },
  ];

  return div('', [
    tabela({
      colunas: [
        { rotulo: 'Leitura', celula: (x) => x.metodo },
        { rotulo: '2026', alinha: 'd', celula: (x) => bi(x.a2026) },
        {
          rotulo: 'Contra a DOE · 2026',
          alinha: 'd',
          celula: (x) => (x.metodo === 'Modelo da DOE' ? '—' : delta(x.a2026 - p26.ano)),
        },
        { rotulo: '2027', alinha: 'd', celula: (x) => bi(x.a2027) },
        {
          rotulo: 'Contra a DOE · 2027',
          alinha: 'd',
          celula: (x) => (x.metodo === 'Modelo da DOE' ? '—' : delta(x.a2027 - p27.ano)),
        },
        {
          rotulo: 'Roda por linha',
          alinha: 'd',
          nota: 'só o modelo da DOE enxerga as regras de exceção por linha',
          celula: (x) => (x.porLinha ? span('selo selo-ok', 'sim') : span('', 'não')),
        },
        { rotulo: 'Responde', celula: (x) => x.responde },
      ],
      linhas,
    }),
    el('ul', { classe: 'lista-notas' }, linhas.map((x) => el('li', {}, [
      el('strong', { texto: `${x.metodo}: ` }), x.advertencia,
    ]))),
  ]);
}

function tabelaBacktest(backtest) {
  if (backtest.length === 0) return nota('Sem backtest nesta carga.', 'neutro');

  return div('', [
    tabela({
      colunas: [
        { rotulo: 'Ponto de corte', celula: (b) => b.corte },
        { rotulo: 'Horizonte', alinha: 'd', celula: (b) => `${b.horizonte} meses` },
        { rotulo: 'Realizado depois', alinha: 'd', celula: (b) => reaisMi(b.realizado) },
        { rotulo: 'ARIMA 36m projetou', alinha: 'd', celula: (b) => reaisMi(b.janela) },
        {
          rotulo: 'Erro',
          alinha: 'd',
          celula: (b) => span(b.erroJanela < 0 ? 'ruim' : 'bom', pctSinal(b.erroJanela, 2)),
        },
        { rotulo: 'ARIMA inteira projetou', alinha: 'd', celula: (b) => reaisMi(b.inteira) },
        {
          rotulo: 'Erro',
          alinha: 'd',
          celula: (b) => span(b.erroInteira < 0 ? 'ruim' : 'bom', pctSinal(b.erroInteira, 2)),
        },
      ],
      linhas: backtest,
    }),
    nota([
      el('strong', { texto: 'Subestimação sistemática. ' }),
      'As duas especificações erraram para BAIXO em todos os horizontes testados. Um '
      + 'método com esse viés usado como referência de suficiência orçamentária produz '
      + 'pedido de crédito menor que o necessário — que é exatamente o erro que não se '
      + 'pode aceitar num pedido de crédito. O ARIMA entra aqui como contraprova da '
      + 'ordem de grandeza, e não como alternativa ao modelo por linha.',
    ], 'erro'),
  ]);
}

function tabelaEspecificacoes(carga) {
  const esps = Object.values(carga.arima);
  return div('', [
    tabela({
      colunas: [
        { rotulo: 'Especificação', celula: (e) => (e.nome === 'janela' ? 'Janela de 36 meses' : 'Série inteira') },
        { rotulo: 'Modelo', celula: (e) => e.especificacao },
        { rotulo: 'Observações', alinha: 'd', celula: (e) => inteiro(e.observacoes) },
        { rotulo: 'Parâmetros', alinha: 'd', celula: (e) => inteiro(e.parametros) },
        {
          rotulo: 'Graus de liberdade',
          alinha: 'd',
          nota: 'observações menos parâmetros: é o que limita a confiança do ajuste',
          celula: (e) => inteiro(e.grausDeLiberdade),
        },
        { rotulo: '2026', alinha: 'd', celula: (e) => bi(e.total2026) },
        { rotulo: '2027', alinha: 'd', celula: (e) => bi(e.total2027) },
      ],
      linhas: esps,
    }),
    ...esps.map((e) => el('details', { classe: 'detalhe' }, [
      el('summary', { texto: `${e.nome === 'janela' ? 'Janela de 36 meses' : 'Série inteira'} · recorte por grupo de natureza` }),
      div('detalhe-corpo', [
        el('p', { texto: e.descricao }),
        tabela({
          classe: 'tabela-estreita',
          colunas: [
            { rotulo: 'Grupo de natureza', celula: (g) => (NOME_GRUPO_NATUREZA[g.grupo] ?? g.grupo) },
            {
              rotulo: 'Massa do recorte',
              alinha: 'd',
              nota: 'proporção da massa realizada de jan–ago do grupo',
              celula: (g) => pct(g.parte, 2),
            },
            { rotulo: '2026', alinha: 'd', celula: (g) => reaisMi(g.total2026) },
            { rotulo: '2027', alinha: 'd', celula: (g) => reaisMi(g.total2027) },
          ],
          linhas: e.porGrupo,
        }),
        e.observacoes ? el('ul', { classe: 'lista-notas' },
          (e.observacoesTexto ?? []).map((o) => el('li', { texto: o }))) : null,
      ]),
    ])),
    nota('O recorte é PROPORCIONAL à massa realizada do grupo de natureza, e é a única '
      + 'operação honesta disponível: o modelo foi ajustado sobre a série do Estado, e '
      + 'dividi-lo por massa diz "esta é a parcela desta leitura que cabe a este '
      + 'recorte", sem fingir que houve ajuste local.', 'neutro'),
  ]);
}

function serieDoOitoMilSetecentos(carga) {
  const { oito, p26 } = carga;
  if (!oito) return nota('Sem série do 8778 nesta carga.', 'neutro');

  const anos = Object.keys(oito.anos).sort();
  return div('', [
    ...anos.map((ano) => div('bloco-serie', [
      el('h3', { texto: `${ano} · ${reaisMi(oito.anos[ano].total)}` }),
      serieMensal({
        valores: [...oito.anos[ano].meses, ...new Array(12 - oito.anos[ano].meses.length).fill(0)],
        primeiroProjetado: oito.anos[ano].meses.length,
        destaque13: oito.anos[ano].meses.length >= 12 ? 11 : -1,
        rotulo: `série realizada de ${ano} em milhões de reais`,
      }),
    ])),
    nota([
      `O recorte em tela corresponde a ${pct(oito.parte, 2)} da massa do relatório. `
      + `O 8778 cobre ${inteiro(oito.unidades)} unidades orçamentárias contra `
      + `${inteiro(new Set(carga.todas.map((L) => L.uo)).size)} no modelo da DOE: os `
      + 'dois conjuntos NÃO são o mesmo, e a diferença é conceito, não erro.',
    ], 'neutro'),
    nota([
      `Jan–ago de 2026 pelo modelo da DOE é ${reaisMi(p26.janAgo)}; a mesma janela pela `
      + `série do 8778 é ${reaisMi(oito.anos[2026].meses.reduce((a, b) => a + b, 0))}. A `
      + 'diferença é de extrações feitas em dias diferentes da mesma execução, e está '
      + 'publicada na aba de conferência como distância entre FONTES — classe que não '
      + 'bloqueia a carga.',
    ], 'neutro'),
  ]);
}

function tabelaDasReguas(carga) {
  const { piso, pisoLimpo, p26 } = carga;
  const linhas = [
    {
      regua: 'Bruta · com a intraorçamentária',
      v2026: piso.ano2026,
      v2027: piso.ano2027,
      usa: 'pedido de crédito e execução orçamentária',
    },
    {
      regua: 'Líquida · sem a intraorçamentária',
      v2026: pisoLimpo.ano2026,
      v2027: pisoLimpo.ano2027,
      usa: 'comparação contra o limite de despesa com pessoal da LRF',
    },
  ];

  return div('', [
    tabela({
      colunas: [
        { rotulo: 'Régua do piso', celula: (x) => x.regua },
        { rotulo: '2026', alinha: 'd', celula: (x) => bi(x.v2026) },
        { rotulo: '2027', alinha: 'd', celula: (x) => bi(x.v2027) },
        { rotulo: 'Quem usa', celula: (x) => x.usa },
      ],
      linhas,
      rodape: {
        regua: 'Diferença',
        v2026: piso.ano2026 - pisoLimpo.ano2026,
        v2027: piso.ano2027 - pisoLimpo.ano2027,
        usa: 'é a contraparte intraorçamentária',
      },
    }),
    nota(`A diferença entre as duas réguas é de ${bi(piso.ano2026 - pisoLimpo.ano2026)} `
      + `em 2026, contra um crédito a abrir de ${bi(p26.insuficiencia)}. Trocar uma pela `
      + 'outra sem declarar muda a conclusão sobre o limite da LRF.', 'aviso'),
  ]);
}
