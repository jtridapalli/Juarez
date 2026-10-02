/**
 * Peças compartilhadas pelas abas.
 *
 * O que mora aqui são as convenções de leitura que TODAS as abas têm de respeitar,
 * porque a inconsistência entre elas é o defeito que o painel existe para não
 * repetir: o mesmo número com dois rótulos, ou o mesmo rótulo com duas réguas.
 */

import {
  barra, div, el, indicador, nota, secao, span, tabela,
} from '../ui/dom.js';
import {
  bi, delta, dinheiro, inteiro, pct, pctSinal, reaisMi,
} from '../../nucleo/formato.js';

export {
  barra, div, el, indicador, nota, secao, span, tabela,
  bi, delta, dinheiro, inteiro, pct, pctSinal, reaisMi,
};

/** Faixa de cartões de indicador. */
export function faixa(cartoes) {
  return div('faixa-indicadores', cartoes);
}

/**
 * Cabeçalho de aba: título, o que a aba responde, e o recorte em vigor.
 *
 * O recorte é repetido em TODA aba, de propósito. Ele mora no painel lateral, e um
 * leitor que chega numa aba pelo meio não tem como saber que está olhando um
 * Poder e não o Estado — que é a forma mais fácil de reproduzir o defeito dos
 * quadros 13 e 22.
 */
export function cabecalho(carga, titulo, pergunta) {
  return div('cabecalho-aba', [
    el('h1', { texto: titulo }),
    el('p', { classe: 'pergunta', texto: pergunta }),
    div('tira-recorte', [
      span('tira-rotulo', 'Recorte em vigor'),
      span('tira-valor', descreveRecorte(carga)),
      span('tira-rotulo', 'Linhas'),
      span('tira-valor', `${inteiro(carga.modelo.length)} de ${inteiro(carga.todas.length)}`),
      span('tira-rotulo', 'Premissas'),
      span('tira-valor', carga.premissasAlteradas.length === 0
        ? 'as publicadas em 29/09/2026'
        : `alteradas: ${carga.premissasAlteradas.join(', ')}`),
    ]),
  ]);
}

export function descreveRecorte(carga) {
  const { recorte: r, catalogo: c } = carga;
  if (carga.estadoInteiro) return 'Estado inteiro';
  const partes = [];
  if (r.poder !== null) partes.push(`Poder ${r.poder}`);
  if (r.orgao !== null) partes.push(`${r.orgao} · ${c.orgaos?.[r.orgao] ?? 'órgão'}`);
  if (r.uo !== null) partes.push(`${r.uo} · ${c.unidades?.[r.uo] ?? 'unidade'}`);
  if (r.nat !== null) partes.push(`natureza ${r.nat}`);
  return partes.join(' › ');
}

/**
 * Tabela de agregação, com a coluna de resíduo publicada.
 *
 * O resíduo é zero por construção e é publicado assim mesmo. É o oposto do que a
 * consulta auditada fazia: ela publicava três agregações que não fechavam com o
 * exercício do próprio quadro, e a diferença de R$ 1.385,0 mi cabia no
 * arredondamento da apresentação.
 */
export function tabelaAgregacao(grupo, { mostraDotacao = true, mostra2027 = true } = {}) {
  const colunas = [
    { rotulo: 'Grupo', celula: (g) => g.rotulo },
    {
      rotulo: 'Linhas',
      alinha: 'd',
      celula: (g) => inteiro(g.linhas),
    },
    {
      rotulo: 'Jan–ago realizado',
      alinha: 'd',
      nota: 'liquidação de janeiro a agosto de 2026; não se move sob nenhuma premissa',
      celula: (g) => reaisMi(g.janAgo),
    },
    {
      rotulo: 'Set–dez projetado',
      alinha: 'd',
      nota: 'inclui a provisão do 13º dentro de dezembro',
      celula: (g) => reaisMi(g.setDez),
    },
    {
      rotulo: 'Exercício 2026',
      alinha: 'd',
      nota: 'realizado mais projetado, com o 13º dentro de dezembro',
      celula: (g) => el('strong', { texto: reaisMi(g.proj26) }),
    },
    {
      rotulo: 'Parte',
      alinha: 'd',
      celula: (g) => div('celula-parte', [span('', pct(g.parte, 1)), barra(g.parte)]),
    },
  ];
  if (mostraDotacao) {
    colunas.push({
      rotulo: 'Dotação atualizada',
      alinha: 'd',
      nota: 'coluna de orçamento atualizado do modelo, não a dotação líquida do 8050',
      celula: (g) => reaisMi(g.dotacao),
    }, {
      rotulo: 'Falta',
      alinha: 'd',
      nota: 'projeção menos dotação: positivo é descoberto',
      celula: (g) => span(g.falta > 0 ? 'ruim' : 'bom', delta(g.falta)),
    });
  }
  if (mostra2027) {
    colunas.push({
      rotulo: 'Exercício 2027',
      alinha: 'd',
      nota: 'projeção de 2027 pela leitura anual de D6',
      celula: (g) => reaisMi(g.proj27),
    });
  }

  return div('', [
    tabela({ colunas, linhas: grupo.itens, rodape: grupo.total }),
    residuoDaAgregacao(grupo),
  ]);
}

export function residuoDaAgregacao(grupo) {
  const r = grupo.residuo;
  const pior = Math.max(...Object.values(r).map((v) => Math.abs(v)));
  return nota([
    `Soma dos ${inteiro(grupo.itens.length)} grupos contra o total percorrido: `,
    el('strong', { texto: delta(r.proj26) }),
    ` no exercício, ${delta(r.dotacao)} na dotação, ${delta(r.proj27)} em 2027, `,
    `${inteiro(r.linhas)} na contagem de linhas. `,
    pior <= 1
      ? 'Fecha ao centavo, e é publicado justamente por isso: se algum dia deixar de '
        + 'fechar, a conferência trava a carga em vez de arredondar a diferença.'
      : 'NÃO FECHA. A conferência interna bloqueou a publicação dos indicadores.',
  ], pior <= 1 ? 'neutro' : 'erro');
}

/** Tabela mês a mês de uma série de doze valores. */
export function tabelaMensal({
  series, primeiroProjetado = 8, rodape = true,
}) {
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
    'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const linhas = MESES.map((nome, i) => ({
    mes: nome,
    i,
    classe: i >= primeiroProjetado ? 'linha-projetada' : '',
    valores: series.map((s) => s.valores[i] ?? 0),
  }));

  const colunas = [
    {
      rotulo: 'Mês',
      celula: (L) => div('celula-mes', [
        L.mes,
        L.i >= primeiroProjetado ? span('etiqueta', 'projetado') : span('etiqueta etiqueta-frio', 'realizado'),
        L.i === 11 ? span('etiqueta etiqueta-13', '13º dentro') : null,
      ]),
    },
    ...series.map((s, j) => ({
      rotulo: s.rotulo,
      alinha: 'd',
      nota: s.nota,
      celula: (L) => reaisMi(L.valores[j]),
    })),
  ];

  if (series.length === 2) {
    colunas.push({
      rotulo: 'Diferença',
      alinha: 'd',
      celula: (L) => delta(L.valores[1] - L.valores[0]),
    });
  }

  const total = rodape ? {
    mes: 'Exercício',
    i: -1,
    valores: series.map((s) => s.valores.reduce((a, b) => a + b, 0)),
  } : null;

  return tabela({ colunas, linhas, rodape: total });
}

/**
 * Advertência de recorte.
 *
 * Os números publicados na consulta são do Estado inteiro. Num recorte eles TÊM de
 * divergir, e a tela precisa dizer isso antes de o leitor comparar.
 */
export function avisoDeRecorte(carga) {
  if (carga.estadoInteiro) return null;
  return nota([
    'Este é um recorte. Os números publicados na consulta de 29/09/2026 são do '
    + 'Estado inteiro, e a comparação de aderência diverge por construção — ela '
    + 'não bloqueia a carga, e não é defeito.',
  ], 'aviso');
}

/** Advertência de premissa alterada. */
export function avisoDePremissa(carga) {
  if (carga.premissasAlteradas.length === 0) return null;
  return nota([
    'Premissas alteradas (',
    el('strong', { texto: carga.premissasAlteradas.join(', ') }),
    '). Os números desta tela são de simulação e não são os publicados.',
  ], 'aviso');
}

/** Citação de regra, com o lugar do código que a executa. */
export function citaRegra(regra) {
  return div('cita-regra', [
    div('cita-cabeca', [
      span('cita-codigo', regra.codigo),
      span('cita-titulo', regra.titulo),
    ]),
    regra.enunciado
      ? el('blockquote', { classe: 'enunciado', texto: `“${regra.enunciado}”` })
      : nota('A consulta não reproduz o enunciado literal desta regra. O resumo '
        + 'abaixo é leitura do auditor, e está marcado como tal.', 'neutro'),
    el('p', { texto: regra.resumo }),
    regra.nota ? nota(regra.nota, 'aviso') : null,
    div('cita-pe', [span('etiqueta etiqueta-frio', regra.onde)]),
  ]);
}
