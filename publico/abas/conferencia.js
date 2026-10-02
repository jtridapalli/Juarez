/**
 * Aba de conferência — a trava da regra A4, em tela.
 *
 * É a aba que torna o painel auditável em vez de confiável. Ela publica as três
 * classes de verificação com a distinção entre elas explícita, porque a distinção é
 * o ponto: uma identidade interna que não fecha é defeito e BLOQUEIA; divergir dos
 * números publicados é o que se quer medir; e a distância entre as duas fontes do
 * painel é informação sobre conceitos diferentes, não erro.
 */

import {
  avisoDePremissa, bi, cabecalho, delta, div, el, faixa, indicador, inteiro, nota,
  pct, reaisMi, secao, span, tabela,
} from './comum.js';
import { formataDiferenca } from '../../nucleo/conferencia.js';
import { DIVERGENCIAS, GRAVIDADES, REGRA_POR_CODIGO } from '../../dados/regras-texto.js';

export const meta = {
  chave: 'conferencia',
  rotulo: 'Conferência',
  pergunta: 'A carga fecha? E onde ela diverge do que foi publicado?',
};

export function desenha(carga) {
  const c = carga.conferencia;
  const r = c.resumo;

  return div('aba', [
    cabecalho(carga, 'Conferência da carga', meta.pergunta),
    estadoDaCarga(carga),
    avisoDePremissa(carga),

    faixa([
      indicador({
        rotulo: 'Identidades internas',
        valor: `${inteiro(r.interna.passa)} de ${inteiro(r.interna.total)}`,
        nota: `pior diferença ${formataDiferenca(c.pior)}`,
        regua: 'tolerância de R$ 1,00 · BLOQUEIA a carga',
        tom: r.interna.passa === r.interna.total ? 'bom' : 'erro',
      }),
      indicador({
        rotulo: 'Aderência ao publicado',
        valor: `${inteiro(r.aderencia.passa)} de ${inteiro(r.aderencia.total)}`,
        nota: 'comparação com a consulta de 29/09/2026',
        regua: 'tolerância do arredondamento publicado · não bloqueia',
        tom: r.aderencia.passa === r.aderencia.total ? 'bom' : 'alerta',
      }),
      indicador({
        rotulo: 'Distância entre fontes',
        valor: `${inteiro(r.fonte)} leituras`,
        nota: 'modelo da DOE contra o relatório 8778',
        regua: 'conceitos diferentes · nunca bloqueia',
      }),
      indicador({
        rotulo: 'Ancestral da tela',
        valor: '1 carga',
        nota: 'todas as abas leem o mesmo objeto',
        regua: 'regra A9: nenhuma aba recalcula nada',
        tom: 'bom',
      }),
    ]),

    secao('As três classes, e por que só uma bloqueia',
      'A classificação não é burocrática. Tratar aderência como bloqueante impediria '
      + 'reancorar a base; tratar identidade interna como informativa é exatamente o '
      + 'que permitiu a consulta publicar um quadro cujas agregações somavam '
      + 'R$ 1.385,0 mi menos que o exercício do próprio quadro.',
      [tabelaDasClasses(carga)]),

    secao('Identidades internas',
      'Cada uma é uma conta que o modelo tem de satisfazer contra si mesmo. Elas '
      + 'fecham ao centavo por construção, e são publicadas justamente por isso: se '
      + 'alguma deixar de fechar, a tela trava em vez de arredondar a diferença.',
      [tabelaDeVerificacoes(c.itens.filter((x) => x.grupo === 'interna'), true)]),

    secao('Aderência aos números publicados',
      carga.estadoInteiro
        ? 'Comparação item a item com a consulta de 29/09/2026. Divergência aqui não '
          + 'bloqueia: ela mede o quanto a carga saiu do publicado.'
        : 'ESTE É UM RECORTE. Os números publicados são do Estado inteiro, e a '
          + 'divergência abaixo é esperada por construção.',
      [tabelaDeVerificacoes(c.itens.filter((x) => x.grupo === 'aderência'), false)]),

    secao('Distância entre as duas fontes',
      'O modelo da DOE e a série do relatório 8778 não cobrem o mesmo conjunto, e a '
      + 'distância entre eles é informação sobre o que cada um mede.',
      [tabelaDeVerificacoes(c.itens.filter((x) => x.grupo === 'fonte'), false)]),

    secao('O que a auditoria encontrou',
      'Os achados da leitura dos 28 quadros, com o lugar onde esta reimplementação os '
      + 'corrige e a aba em que a correção pode ser conferida.',
      [listaDeDivergencias(carga)]),
  ]);
}

/**
 * O estado da carga, no topo e em destaque.
 *
 * Quando a trava dispara, a tela diz que os indicadores NÃO estão publicados. É a
 * diferença entre um painel que avisa e um painel que arredonda.
 */
function estadoDaCarga(carga) {
  const c = carga.conferencia;
  if (!c.travada) {
    return div('estado-carga estado-ok', [
      span('estado-marca', '✓'),
      div('', [
        el('strong', { texto: 'Carga liberada. ' }),
        `As ${inteiro(c.resumo.interna.total)} identidades internas fecham, com pior `
        + `diferença de ${formataDiferenca(c.pior)} contra a tolerância de R$ 1,00.`,
      ]),
    ]);
  }
  return div('estado-carga estado-erro', [
    span('estado-marca', '!'),
    div('', [
      el('strong', { texto: 'CARGA TRAVADA. ' }),
      `${inteiro(c.falhas.length)} identidade(s) interna(s) não fecham. Os indicadores `
      + 'desta tela NÃO estão publicados, e a diferença não foi diluída no '
      + 'arredondamento da apresentação.',
      el('ul', { classe: 'lista-notas' }, c.falhas.slice(0, 10).map((f) => el('li', {}, [
        el('strong', { texto: `${f.rotulo}: ` }), formataDiferenca(f.diferenca),
      ]))),
    ]),
  ]);
}

function tabelaDasClasses(carga) {
  const r = carga.conferencia.resumo;
  const linhas = [
    {
      classe: 'Interna',
      n: r.interna.total,
      passa: r.interna.passa,
      tolerancia: 'R$ 1,00',
      bloqueia: true,
      mede: 'identidades que o cálculo tem de satisfazer contra si mesmo',
      porque: 'um real de diferença é defeito, e defeito não pode ser publicado',
    },
    {
      classe: 'Aderência',
      n: r.aderencia.total,
      passa: r.aderencia.passa,
      tolerancia: 'o arredondamento da casa publicada',
      bloqueia: false,
      mede: 'comparação com os números da consulta de 29/09/2026',
      porque: 'uma carga nova PODE divergir do publicado, e é o que se quer medir',
    },
    {
      classe: 'Fonte',
      n: r.fonte,
      passa: r.fonte,
      tolerancia: 'nenhuma',
      bloqueia: false,
      mede: 'distância entre o modelo da DOE e a série do relatório 8778',
      porque: 'as duas origens não cobrem o mesmo conjunto: a diferença é conceito',
    },
  ];

  return tabela({
    colunas: [
      { rotulo: 'Classe', celula: (x) => el('strong', { texto: x.classe }) },
      { rotulo: 'Verificações', alinha: 'd', celula: (x) => inteiro(x.n) },
      {
        rotulo: 'Passam',
        alinha: 'd',
        celula: (x) => span(x.passa === x.n ? 'bom' : 'ruim', inteiro(x.passa)),
      },
      { rotulo: 'Tolerância', celula: (x) => x.tolerancia },
      {
        rotulo: 'Bloqueia',
        celula: (x) => (x.bloqueia
          ? span('selo selo-erro', 'sim')
          : span('selo selo-ok', 'não')),
      },
      { rotulo: 'O que mede', celula: (x) => x.mede },
      { rotulo: 'Por quê', celula: (x) => x.porque },
    ],
    linhas,
  });
}

function tabelaDeVerificacoes(itens, ordenaPorDiferenca) {
  const linhas = [...itens];
  if (ordenaPorDiferenca) {
    linhas.sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca));
  } else {
    // Divergentes primeiro: numa lista de cento e treze, o que importa é o que não
    // bate, e deixá-lo na ordem de construção o esconde no meio.
    linhas.sort((a, b) => (a.passa === b.passa
      ? Math.abs(b.diferenca) - Math.abs(a.diferenca)
      : Number(a.passa) - Number(b.passa)));
  }

  const conta = (x) => x.nota === 'contagem';
  const v = (x, valor) => (conta(x) ? inteiro(valor) : reaisMi(valor));

  return tabela({
    classe: 'tabela-conferencia',
    colunas: [
      { rotulo: 'Verificação', celula: (x) => x.rotulo },
      {
        rotulo: 'Publicado',
        alinha: 'd',
        celula: (x) => v(x, x.publicado),
      },
      {
        rotulo: 'Recomposto',
        alinha: 'd',
        nota: 'o que este painel calcula',
        celula: (x) => v(x, x.recomposto),
      },
      {
        rotulo: 'Diferença',
        alinha: 'd',
        // A escala é sempre a mesma e a unidade é sempre escrita: uma coluna cuja
        // única função é ordenar divergências não pode misturar escalas.
        celula: (x) => span(x.passa ? '' : 'ruim',
          conta(x) ? inteiro(x.diferenca) : formataDiferenca(x.diferenca)),
      },
      {
        rotulo: 'Tolerância',
        alinha: 'd',
        celula: (x) => (x.tolerancia === Infinity ? 'nenhuma'
          : (conta(x) ? inteiro(x.tolerancia) : reaisMi(x.tolerancia, 2))),
      },
      {
        rotulo: 'Situação',
        celula: (x) => (x.grupo === 'fonte'
          ? span('selo selo-frio', 'informativo')
          : span(`selo ${x.passa ? 'selo-ok' : (x.bloqueante ? 'selo-erro' : 'selo-aviso')}`,
            x.passa ? 'confere' : (x.bloqueante ? 'BLOQUEIA' : 'diverge'))),
      },
      { rotulo: 'Observação', celula: (x) => (x.nota === 'contagem' ? '' : x.nota) },
    ],
    linhas,
  });
}

function listaDeDivergencias(carga) {
  return div('lista-divergencias', DIVERGENCIAS.map((d) => {
    const g = GRAVIDADES[d.gravidade];
    return el('article', { classe: `divergencia divergencia-${d.gravidade}` }, [
      div('divergencia-cabeca', [
        span(`selo selo-${d.gravidade === 'defeito' ? 'erro' : 'aviso'}`, g.rotulo),
        el('h3', { texto: d.titulo }),
      ]),
      el('dl', { classe: 'divergencia-corpo' }, [
        el('dt', { texto: 'Achado' }), el('dd', { texto: d.achado }),
        el('dt', { texto: 'Causa' }), el('dd', { texto: d.causa }),
        el('dt', { texto: 'Nesta reimplementação' }), el('dd', { texto: d.correcao }),
      ]),
      div('divergencia-pe', [
        span('etiqueta etiqueta-frio', d.onde),
        ...d.regras.map((codigo) => span('etiqueta',
          `${codigo} · ${REGRA_POR_CODIGO[codigo]?.titulo ?? ''}`)),
        span('etiqueta etiqueta-prova', `confira na aba: ${d.prova}`),
      ]),
    ]);
  }));
}
