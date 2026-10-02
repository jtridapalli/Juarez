/**
 * Aba de carga de CSV — reancorar a base, com a cardinalidade exigida.
 *
 * O ponto delicado é um, e é o mais barato de errar: a planilha de projeção guarda
 * código como número e perde o zero à esquerda; o relatório do SIAFIC guarda como
 * texto e o mantém. Comparar texto com texto acha zero correspondências em mil
 * linhas, e zero correspondências é o tipo de resultado que alguém "resolve"
 * afrouxando a chave.
 *
 * Afrouxar a chave é a pior saída: chave parcial casa uma linha com várias e faz o
 * fator de crescimento incidir na linha errada. Por isso a carga PARA quando a
 * cardinalidade quebra, em vez de prosseguir com o que casou.
 */

import {
  cabecalho, delta, div, el, faixa, indicador, inteiro, nota, pct, reaisMi, secao,
  span, tabela,
} from './comum.js';
import { CAMPOS, CAMPOS_CHAVE, casaOrigens, leCsv } from '../../nucleo/csv.js';

export const meta = {
  chave: 'cargaCsv',
  rotulo: 'Carga de CSV',
  pergunta: 'Como reancorar a base, e o que a carga exige para não mentir?',
};

/** Estado da aba. Mora no módulo porque é estado de tela, não de domínio. */
const estado = {
  planilha: null,
  relatorio: null,
  escala: 1,
  resultado: null,
  erro: null,
};

export function desenha(carga, redesenha, vaPara, troca) {
  return div('aba', [
    cabecalho(carga, 'Carga de CSV e casamento de origens', meta.pergunta),

    faixa([
      indicador({
        rotulo: 'Base em uso',
        valor: carga.base.origem?.sintetica === false ? 'carregada' : 'sintética',
        nota: `${inteiro(carga.todas.length)} linhas · `
          + `${inteiro(new Set(carga.todas.map((L) => L.uo)).size)} unidades`,
        regua: 'o conjunto que reproduz os números da consulta de 29/09/2026',
      }),
      indicador({
        rotulo: 'Campos do documento',
        valor: inteiro(CAMPOS.length),
        nota: `${inteiro(CAMPOS_CHAVE.length)} formam a chave orçamentária`,
        regua: 'regra A1 e B2',
      }),
      indicador({
        rotulo: 'Cardinalidade exigida',
        valor: '1 : 1',
        nota: 'uma linha do relatório para uma da planilha',
        regua: 'regra B5 · a carga PARA se quebrar',
      }),
    ]),

    secao('A chave orçamentária',
      'Dez campos. Os nove códigos normalizam como INTEIRO, para que 041 e 41 sejam a '
      + 'mesma coisa; o marcador fica como texto, porque é ele que distingue a linha de '
      + 'mediana da linha comum na mesma natureza, e normalizá-lo como número apagaria '
      + 'a distinção que ele existe para fazer.',
      [tabelaDosCampos()]),

    secao('Carregar os dois arquivos',
      'A planilha de projeção traz os 25 campos e as colunas de cv; o relatório do '
      + 'SIAFIC traz a execução. Os dois são casados pela chave, e janeiro a julho têm '
      + 'de bater ao centavo — é o que prova que são a mesma série lida em dias '
      + 'diferentes, e não duas séries parecidas.',
      [formulario(redesenha, troca)]),

    estado.erro ? nota(estado.erro, 'erro') : null,
    estado.resultado ? resultadoDoCasamento(estado.resultado, redesenha, troca) : null,

    secao('O que a carga aceita e o que ela recusa',
      'A lista é curta de propósito: cada recusa corresponde a um modo de a carga '
      + 'produzir número errado em silêncio.',
      [tabelaDasRegras()]),
  ]);
}

function tabelaDosCampos() {
  const linhas = CAMPOS.map((c) => ({
    campo: c,
    chave: CAMPOS_CHAVE.includes(c),
    tipo: ['atual', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago'].includes(c)
      ? 'monetário'
      : (c.startsWith('cv_') ? 'taxa' : (c === 'marcador' || c === 'obs' ? 'texto' : 'código')),
  }));

  return div('', [
    tabela({
      classe: 'tabela-estreita',
      colunas: [
        { rotulo: 'Campo', celula: (x) => span('mono', x.campo) },
        {
          rotulo: 'Tipo',
          celula: (x) => x.tipo,
          nota: 'o tipo decide a normalização, e normalizar errado apaga informação',
        },
        {
          rotulo: 'Na chave',
          celula: (x) => (x.chave ? span('selo selo-ok', 'sim') : span('', '—')),
        },
        {
          rotulo: 'Normalização',
          celula: (x) => {
            if (x.tipo === 'código') return 'inteiro: perde o zero à esquerda de propósito';
            if (x.tipo === 'monetário') return 'número, multiplicado pela escala declarada';
            if (x.tipo === 'taxa') return 'número; VAZIO continua vazio, e não vira zero';
            return 'texto, como está';
          },
        },
      ],
      linhas,
    }),
    nota('A coluna de cv vazia continua VAZIA. Virar zero apagaria a informação de que '
      + 'a linha não tem crescimento declarado — e pela regra 5.4 branco vale 9,99, que '
      + 'o teto corta. São resultados opostos a partir da mesma célula.', 'aviso'),
  ]);
}

function formulario(redesenha, troca) {
  const arquivo = (rotulo, campo) => div('campo', [
    el('label', { for: `csv-${campo}`, texto: rotulo }),
    el('input', {
      id: `csv-${campo}`,
      type: 'file',
      accept: '.csv,.txt,text/csv',
      onchange: async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        try {
          const texto = await f.text();
          const lido = leCsv(texto, { escala: estado.escala });
          estado[campo] = { ...lido, nome: f.name, bytes: f.size };
          estado.erro = null;
        } catch (erro) {
          estado.erro = `Falha ao ler ${f.name}: ${erro.message}`;
        }
        redesenha();
      },
    }),
    estado[campo]
      ? span('campo-auxilio', `${estado[campo].nome} · `
        + `${inteiro(estado[campo].linhas.length)} linhas · `
        + `separador "${estado[campo].separador}" · `
        + `${estado[campo].temCabecalho ? 'com cabeçalho' : 'SEM cabeçalho reconhecível'}`)
      : span('campo-auxilio', 'nenhum arquivo'),
    ...(estado[campo]?.avisos ?? []).map((a) => nota(a, 'aviso')),
  ]);

  return div('', [
    div('formulario', [
      arquivo('Planilha de projeção (25 campos, com as colunas de cv)', 'planilha'),
      arquivo('Relatório de execução do SIAFIC', 'relatorio'),
      div('campo', [
        el('label', { for: 'csv-escala', texto: 'Escala dos valores monetários' }),
        el('select', {
          id: 'csv-escala',
          onchange: (e) => { estado.escala = Number(e.target.value); redesenha(); },
        }, [
          el('option', { value: '1', texto: 'em reais', selected: estado.escala === 1 ? '' : null }),
          el('option', { value: '1000000', texto: 'em milhões', selected: estado.escala === 1e6 ? '' : null }),
        ]),
        span('campo-auxilio', 'o painel circula tudo em REAIS: a tolerância de um real '
          + 'da conferência é um real de verdade'),
      ]),
    ]),
    div('acoes', [
      el('button', {
        classe: 'botao',
        texto: 'Casar as duas origens',
        disabled: (estado.planilha && estado.relatorio) ? null : '',
        onclick: () => {
          estado.resultado = casaOrigens(estado.relatorio.linhas, estado.planilha.linhas);
          estado.erro = null;
          redesenha();
        },
      }),
      el('button', {
        classe: 'botao botao-magro',
        texto: 'Voltar à base sintética',
        onclick: () => {
          estado.planilha = null;
          estado.relatorio = null;
          estado.resultado = null;
          troca(null);
        },
      }),
    ]),
  ]);
}

function resultadoDoCasamento(r, redesenha, troca) {
  const total = r.pares.length + r.soRelatorio.length + r.soPlanilha.length;

  return secao('Resultado do casamento',
    r.podeCarregar
      ? 'Cardinalidade um para um e janeiro a julho idênticos nas duas origens. A base '
        + 'pode ser carregada.'
      : 'A carga está BLOQUEADA. Prosseguir com o que casou faria o fator de '
        + 'crescimento incidir na linha errada.',
    [
      faixa([
        indicador({
          rotulo: 'Pares casados',
          valor: inteiro(r.pares.length),
          nota: total === 0 ? '' : `${pct(r.pares.length / total, 1)} do universo`,
          tom: r.cardinalidade1a1 ? 'bom' : 'alerta',
        }),
        indicador({
          rotulo: 'Só no relatório',
          valor: inteiro(r.soRelatorio.length),
          nota: 'linha executada que a planilha não projeta',
          tom: r.soRelatorio.length === 0 ? 'bom' : 'erro',
        }),
        indicador({
          rotulo: 'Só na planilha',
          valor: inteiro(r.soPlanilha.length),
          nota: 'linha projetada que o relatório não executa',
          tom: r.soPlanilha.length === 0 ? 'bom' : 'erro',
        }),
        indicador({
          rotulo: 'Chaves duplicadas',
          valor: inteiro(r.duplicadas.length),
          nota: 'uma chave casando com mais de uma linha',
          regua: 'regra B5 · PARA a carga',
          tom: r.duplicadas.length === 0 ? 'bom' : 'erro',
        }),
        indicador({
          rotulo: 'Divergência jan–jul',
          valor: inteiro(r.divergenciaJanJul.length),
          nota: 'os dois meses têm de bater ao centavo',
          regua: 'é o que prova que são a mesma série',
          tom: r.divergenciaJanJul.length === 0 ? 'bom' : 'erro',
        }),
        indicador({
          rotulo: 'Divergência em agosto',
          valor: inteiro(r.divergenciaAgosto.length),
          nota: 'agosto PODE divergir: é movimento, não erro',
          tom: '',
        }),
      ]),
      r.divergenciaJanJul.length > 0 ? tabela({
        classe: 'tabela-estreita',
        colunas: [
          { rotulo: 'Chave orçamentária', celula: (x) => span('mono', x.chave) },
          { rotulo: 'Mês', celula: (x) => x.mes },
          { rotulo: 'Diferença', alinha: 'd', celula: (x) => delta(x.diferenca) },
        ],
        linhas: r.divergenciaJanJul.slice(0, 40),
      }) : null,
      r.duplicadas.length > 0 ? nota([
        el('strong', { texto: 'Chave duplicada. ' }),
        'A carga PARA aqui. Afrouxar a chave para fazer o casamento fechar é a pior '
        + 'saída possível: chave parcial casa uma linha com várias e faz o fator de '
        + 'crescimento incidir na linha errada.',
        el('ul', { classe: 'lista-notas' },
          r.duplicadas.slice(0, 10).map((k) => el('li', {}, span('mono', k)))),
      ], 'erro') : null,
      div('acoes', [
        el('button', {
          classe: 'botao',
          texto: r.podeCarregar ? 'Carregar esta base no painel'
            : 'Carga bloqueada pela conferência de cardinalidade',
          disabled: r.podeCarregar ? null : '',
          onclick: () => troca(estado.planilha.linhas),
        }),
      ]),
      nota('Carregar uma base nova muda os números da tela, e a aba de conferência '
        + 'passará a mostrar a aderência ao publicado DIVERGINDO — o que é correto: é '
        + 'exatamente o que se quer medir quando a base é reancorada. A divergência de '
        + 'aderência não bloqueia; as identidades internas continuam bloqueando.',
      'neutro'),
    ]);
}

function tabelaDasRegras() {
  const linhas = [
    {
      situacao: 'Cabeçalho com cinco ou mais campos conhecidos',
      acao: 'usa o cabeçalho, em qualquer ordem',
      porque: 'a ordem das colunas varia entre extrações',
      tom: 'ok',
    },
    {
      situacao: 'Sem cabeçalho reconhecível',
      acao: 'assume a ordem canônica dos 25 campos E AVISA',
      porque: 'ler cabeçalho como dado troca natureza por órgão em silêncio',
      tom: 'aviso',
    },
    {
      situacao: 'Código com zero à esquerda',
      acao: 'normaliza como inteiro nas duas origens',
      porque: 'comparar "041" com 41 como texto acha zero correspondências',
      tom: 'ok',
    },
    {
      situacao: 'Célula de cv vazia',
      acao: 'mantém vazia',
      porque: 'pela regra 5.4 branco vale 9,99; zero afirma que a linha não cresce',
      tom: 'ok',
    },
    {
      situacao: 'Linha sem natureza',
      acao: 'descarta e avisa quantas',
      porque: 'sem natureza não há elemento, nem regra aplicável',
      tom: 'aviso',
    },
    {
      situacao: 'Chave casando com mais de uma linha',
      acao: 'PARA a carga',
      porque: 'chave parcial faz o fator incidir na linha errada',
      tom: 'erro',
    },
    {
      situacao: 'Divergência em janeiro a julho',
      acao: 'PARA a carga',
      porque: 'as duas origens não são a mesma série lida em dias diferentes',
      tom: 'erro',
    },
    {
      situacao: 'Divergência em agosto ou na dotação',
      acao: 'aceita e publica a diferença',
      porque: 'é alteração orçamentária: movimento, não erro',
      tom: 'ok',
    },
  ];

  return tabela({
    colunas: [
      { rotulo: 'Situação', celula: (x) => x.situacao },
      {
        rotulo: 'O que a carga faz',
        celula: (x) => span(`selo selo-${x.tom === 'ok' ? 'ok' : (x.tom === 'erro' ? 'erro' : 'aviso')}`,
          x.acao),
      },
      { rotulo: 'Por quê', celula: (x) => x.porque },
    ],
    linhas,
  });
}
