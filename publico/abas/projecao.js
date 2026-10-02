/**
 * Aba de projeção de 2026 — as regras 5.1 a 5.5 e a memória de cálculo.
 *
 * Ela existe para que a frase "a projeção segue a metodologia" possa ser conferida
 * em vez de aceita. Toda contagem publicada aqui vem com o DENOMINADOR: o quadro 28
 * da consulta publicava 719 ativos e 52 inativos sem dizer que o denominador eram
 * as 771 linhas vivas de um modelo de 1.023, e quem somava os dois concluía que o
 * modelo tinha 771 linhas.
 */

import {
  avisoDePremissa, avisoDeRecorte, bi, cabecalho, delta, div, el, faixa, indicador,
  inteiro, nota, pct, pctSinal, reaisMi, secao, span, tabela, tabelaAgregacao,
  tabelaMensal,
} from './comum.js';
import { serieMensal } from '../ui/graficos.js';
import { CRITERIO_DO_DOCUMENTO, NOME_ELEMENTO, NOME_RAMO } from '../../nucleo/agregacao.js';
import { cadeiaDaLinha } from '../../nucleo/projecao2027.js';
import { natureza } from '../../nucleo/formato.js';
import { MESES } from '../../nucleo/regras.js';

export const meta = {
  chave: 'projecao',
  rotulo: 'Projeção 2026',
  pergunta: 'Como cada regra produz cada mês, linha por linha?',
};

/** Linha escolhida para abrir a cadeia. Mora no módulo porque é estado de tela. */
let linhaAberta = null;

export function desenha(carga, redesenha) {
  const { p26, agregados } = carga;
  const m = p26.memoria;

  return div('aba', [
    cabecalho(carga, 'Projeção de 2026', meta.pergunta),
    avisoDeRecorte(carga),
    avisoDePremissa(carga),
    faixa([
      indicador({
        rotulo: 'Exercício de 2026',
        valor: bi(p26.ano),
        nota: `${reaisMi(p26.t13)} são a provisão do 13º`,
        regua: 'realizado + projetado, 13º dentro de dezembro',
      }),
      indicador({
        rotulo: 'Dezembro sem o 13º',
        valor: reaisMi(p26.dezSem13),
        nota: `publicado como ${reaisMi(p26.meses[11])}`,
        regua: 'é este o valor que ancora 2027 (regra D2)',
      }),
      indicador({
        rotulo: 'Teto mordeu',
        valor: `${inteiro(m.mesesLinhaTeto)} meses-linha`,
        nota: `de ${inteiro(m.mesesLinhaProjetados)} projetados `
          + `(${pct(m.mesesLinhaTeto / Math.max(1, m.mesesLinhaProjetados), 1)})`,
        regua: `${inteiro(m.mesesLinhaCvVazio)} eram célula em branco, tratada como 9,99`,
      }),
      indicador({
        rotulo: 'Reajuste geral alcançou',
        valor: `${inteiro(m.mesesLinhaReajuste)} meses-linha`,
        nota: m.mesesLinhaReajuste === 0 ? 'vigência em mês já liquidado' : '',
        regua: m.mesesLinhaReajuste === 0 ? 'premissa DORMENTE' : '',
        tom: m.mesesLinhaReajuste === 0 ? 'alerta' : '',
      }),
    ]),

    secao('Série de 2026, mês a mês',
      'A composição da regra 5.3 só CRESCE, e ainda assim setembro fica abaixo de '
      + 'agosto. A queda vem das linhas de mediana: o agosto delas é excepcionalmente '
      + 'alto e a mediana de janeiro a agosto não é, então a regra 5.2 as derruba de '
      + 'agosto para setembro.',
      [
        serieMensal({
          valores: p26.meses,
          primeiroProjetado: carga.par.primeiroMesProjetado - 1,
          rotulo: 'série mensal de 2026 em milhões de reais',
        }),
        tabelaMensalDoAno(carga),
      ]),

    secao('Os três ramos da regra',
      'A ordem importa: 5.1 antes de 5.2, e 5.2 antes de 5.3. Uma linha desligada '
      + 'numa natureza de mediana vai a ZERO, e não para a mediana.',
      [
        tabelaAgregacao(agregados.porRamo, { mostra2027: false }),
        nota([
          'As ',
          el('strong', { texto: `${inteiro(m.desligadas)} linhas desligadas` }),
          ' pela regra 5.1 continuam no exercício: jan–ago delas é liquidação e '
          + 'permanece. O que vai a zero são os quatro meses projetados. Elas também '
          + 'continuam no conjunto de 2027, valendo zero — tirá-las mudaria o '
          + 'denominador de toda contagem.',
        ], 'neutro'),
      ]),

    secao('Memória de cálculo',
      'Toda contagem com o denominador explícito. Sem o denominador, "719 ativos" '
      + 'não diz se o modelo tem 771 linhas ou 1.023.',
      [tabelaMemoria(carga)]),

    secao('Aumentos específicos: declarados e aplicados',
      'Quatro premissas declaradas, três aplicadas. A diferença é a vigência: um dos '
      + 'quatro vigora em agosto, mês já liquidado.',
      [tabelaEspecificos(carga)]),

    secao('Critério do documento contra ramo executado',
      'Três elementos recebem no documento um critério e executam outro, porque as '
      + 'naturezas 3.1.90.16, 3.1.90.92 e 3.1.90.94 estão na lista da regra 5.2, que '
      + 'roda antes da composição e vence o critério do elemento.',
      [tabelaCriterios(carga)]),

    secao('Abertura por elemento de despesa', '',
      [tabelaAgregacao(agregados.porElemento)]),

    secao('A cadeia de uma linha',
      'A prova de que a regra vale por linha. Escolha uma linha e o painel abre os '
      + 'quatro passos de 2026 e os doze de 2027, com o fator de cada um.',
      [escolheLinha(carga, redesenha), cadeiaDaLinhaEscolhida(carga)]),
  ]);
}

function tabelaMensalDoAno(carga) {
  const { p26, piso } = carga;
  return div('', [
    tabelaMensal({
      series: [
        {
          rotulo: 'Piso a índice zero',
          valores: piso.meses,
          nota: 'agosto repetido até dezembro: o chão de qualquer leitura',
        },
        {
          rotulo: 'Modelo da DOE',
          valores: p26.meses,
          nota: 'regras 5.1 a 5.5, linha por linha',
        },
      ],
      primeiroProjetado: carga.par.primeiroMesProjetado - 1,
    }),
    nota([
      `Setembro (${reaisMi(p26.meses[8])}) fica abaixo de agosto `
      + `(${reaisMi(p26.meses[7])}): ${pctSinal(p26.meses[8] / p26.meses[7] - 1, 2)}. `
      + `Outubro cresce ${pctSinal(p26.meses[9] / p26.meses[8] - 1, 2)} sobre setembro, `
      + `acima do teto de ${pct(carga.par.teto)} — só é possível porque três aumentos `
      + 'específicos vigoram em outubro e se compõem com o vegetativo por produto.',
    ], 'neutro'),
  ]);
}

function tabelaMemoria(carga) {
  const { p26, p27 } = carga;
  const m = p26.memoria;
  const m27 = p27.memoria;
  const n = m.linhas;

  const itens = [
    { rotulo: 'Linhas do modelo', valor: m.linhas, de: null, nota: 'o denominador de tudo' },
    { rotulo: 'Desligadas · regra 5.1', valor: m.desligadas, de: n, nota: 'julho E agosto zerados' },
    { rotulo: 'Natureza de mediana · regra 5.2', valor: m.mediana, de: n, nota: '' },
    { rotulo: 'Composição a partir de agosto · regra 5.3', valor: m.composicao, de: n, nota: '' },
    {
      rotulo: 'Linhas vivas',
      valor: m27.vivas,
      de: n,
      nota: 'é este o denominador que o quadro 28 usa sem declarar',
    },
    { rotulo: 'Vivas · ativos', valor: m27.vivoAtivo, de: m27.vivas, nota: '' },
    { rotulo: 'Vivas · inativos e RPPS', valor: m27.vivoInativo, de: m27.vivas, nota: '' },
    {
      rotulo: 'Linhas que provisionam 13º · regra 5.5',
      valor: m.linhasCom13,
      de: n,
      nota: 'seis naturezas',
    },
    {
      rotulo: 'Meses-linha projetados',
      valor: m.mesesLinhaProjetados,
      de: null,
      nota: `${inteiro(m.linhas)} linhas × 4 meses`,
    },
    {
      rotulo: 'Meses-linha em que o teto mordeu · regra 5.4',
      valor: m.mesesLinhaTeto,
      de: m.mesesLinhaProjetados,
      nota: 'cv declarado acima do teto',
    },
    {
      rotulo: 'Meses-linha com cv em branco',
      valor: m.mesesLinhaCvVazio,
      de: m.mesesLinhaTeto,
      nota: 'branco vale 9,99, que o teto corta: já contados acima',
    },
    {
      rotulo: 'Meses-linha alcançados pelo reajuste geral',
      valor: m.mesesLinhaReajuste,
      de: m.mesesLinhaProjetados,
      nota: m.mesesLinhaReajuste === 0 ? 'vigência em mês já liquidado' : '',
    },
    {
      rotulo: 'Meses-linha com aumento específico',
      valor: m.mesesLinhaEspecifico,
      de: m.mesesLinhaProjetados,
      nota: 'um trio declarado alcança todas as linhas do trio',
    },
    {
      rotulo: 'Cestas de 2027 · ativo',
      valor: m27.ativo,
      de: m27.linhas,
      nota: 'vegetativo de 1,50%',
    },
    {
      rotulo: 'Cestas de 2027 · inativo e RPPS',
      valor: m27.inativo,
      de: m27.linhas,
      nota: 'vegetativo de 0,50%',
    },
    {
      rotulo: 'Cestas de 2027 · D4',
      valor: m27.d4,
      de: m27.linhas,
      nota: 'elementos 91 a 94: média de 2026, sem vegetativo',
    },
  ];

  return tabela({
    colunas: [
      { rotulo: 'Contagem', celula: (x) => x.rotulo },
      { rotulo: 'Valor', alinha: 'd', celula: (x) => el('strong', { texto: inteiro(x.valor) }) },
      {
        rotulo: 'Denominador',
        alinha: 'd',
        nota: 'a contagem sem o denominador não é interpretável',
        celula: (x) => (x.de === null ? '—' : inteiro(x.de)),
      },
      {
        rotulo: 'Proporção',
        alinha: 'd',
        celula: (x) => (x.de ? pct(x.valor / x.de, 1) : '—'),
      },
      { rotulo: 'Observação', celula: (x) => x.nota },
    ],
    linhas: itens,
  });
}

function tabelaEspecificos(carga) {
  const { par, p26, catalogo } = carga;
  const linhas = par.especificos.map((e) => {
    const alcancadas = carga.modelo.filter((L) => Number(L.orgao) === Number(e.orgao)
      && Number(L.uo) === Number(e.uo) && Number(L.nat) === Number(e.nat));
    const aplicado = e.mes >= par.primeiroMesProjetado && e.mes <= 12;
    return {
      ...e, alcancadas: alcancadas.length, aplicado, catalogo,
    };
  });

  return div('', [
    tabela({
      colunas: [
        {
          rotulo: 'Órgão e unidade',
          celula: (e) => `${e.orgao} · ${catalogo.orgaos?.[e.orgao] ?? ''} › ${e.uo}`,
        },
        { rotulo: 'Natureza', celula: (e) => natureza(e.nat) },
        { rotulo: 'Taxa', alinha: 'd', celula: (e) => pct(e.taxa) },
        {
          rotulo: 'Vigência',
          alinha: 'd',
          celula: (e) => `${MESES[e.mes - 1]} (${e.mes})`,
        },
        {
          rotulo: 'Linhas alcançadas',
          alinha: 'd',
          nota: 'um trio declarado alcança todas as linhas daquele trio',
          celula: (e) => inteiro(e.alcancadas),
        },
        {
          rotulo: 'Situação',
          celula: (e) => (e.aplicado
            ? span('selo selo-ok', 'aplicado')
            : span('selo selo-aviso', 'declarado, não aplicado')),
        },
      ],
      linhas,
    }),
    nota([
      el('strong', {
        texto: `${inteiro(p26.memoria.especificosDeclarados)} declarados, `
          + `${inteiro(p26.memoria.especificosAplicados)} aplicados. `,
      }),
      'A consulta contava os quatro como aplicados. O contador de premissas é '
      + 'diferente do contador de meses-linha alcançados: um trio alcança todas as '
      + 'linhas daquele trio, que podem ser várias.',
    ], 'aviso'),
  ]);
}

function tabelaCriterios(carga) {
  const { p26, agregados } = carga;
  const porElemento = new Map(agregados.porElemento.itens.map((g) => [Number(g.chave), g]));

  // Para cada elemento, qual ramo as linhas dele de fato executaram.
  const ramoPorElemento = new Map();
  for (const L of carga.modelo) {
    const e = Number(String(L.nat).padStart(6, '0').slice(4, 6));
    const r = p26.porLinha.get(L.id).ramo;
    if (!ramoPorElemento.has(e)) ramoPorElemento.set(e, new Map());
    const conta = ramoPorElemento.get(e);
    conta.set(r, (conta.get(r) ?? 0) + 1);
  }

  const linhas = [...porElemento.keys()].sort((a, b) => a - b).map((e) => {
    const conta = ramoPorElemento.get(e) ?? new Map();
    const dominante = [...conta.entries()].sort((a, b) => b[1] - a[1])[0];
    const doc = CRITERIO_DO_DOCUMENTO[e] ?? null;
    const executado = dominante ? dominante[0] : 'composicao';
    // O conflito que importa: o documento manda uma régua e a regra 5.2 vence.
    const conflito = executado === 'mediana' && doc !== null && doc !== 'mediana de jan–ago';
    return {
      e, doc, executado, conta, conflito, grupo: porElemento.get(e),
      classe: conflito ? 'linha-conflito' : '',
    };
  });

  return div('', [
    tabela({
      colunas: [
        {
          rotulo: 'Elemento',
          celula: (x) => `${String(x.e).padStart(2, '0')} · ${NOME_ELEMENTO[x.e] ?? 'Outro'}`,
        },
        {
          rotulo: 'Critério do documento',
          nota: 'o que o quadro de critérios atribui ao elemento',
          celula: (x) => (x.doc ?? span('neutro-num', 'não atribuído')),
        },
        {
          rotulo: 'Ramo executado',
          nota: 'o que a linha de fato executou em 2026',
          celula: (x) => NOME_RAMO[x.executado] ?? x.executado,
        },
        {
          rotulo: 'Linhas',
          alinha: 'd',
          celula: (x) => inteiro(x.grupo.linhas),
        },
        {
          rotulo: 'Exercício',
          alinha: 'd',
          celula: (x) => reaisMi(x.grupo.proj26),
        },
        {
          rotulo: 'Divergência',
          celula: (x) => (x.conflito
            ? span('selo selo-erro', 'régua diferente')
            : span('selo selo-ok', 'confere')),
        },
      ],
      linhas,
    }),
    nota([
      el('strong', { texto: `${linhas.filter((x) => x.conflito).length} elementos ` }),
      'recebem no documento uma régua e executam outra. A consulta publicava só a '
      + 'coluna do documento e tirava dela conclusão sobre o comportamento do modelo.',
    ], 'aviso'),
  ]);
}

function escolheLinha(carga, redesenha) {
  // As maiores linhas primeiro: é o que um auditor abre primeiro, e uma lista de mil
  // itens em ordem de identificador não serve para nada.
  const ordenadas = [...carga.modelo]
    .map((L) => ({ L, r: carga.p26.porLinha.get(L.id) }))
    .sort((a, b) => b.r.ano - a.r.ano)
    .slice(0, 150);

  if (linhaAberta !== null && !carga.modelo.some((L) => L.id === linhaAberta)) {
    linhaAberta = null;
  }
  const escolhida = linhaAberta ?? ordenadas[0]?.L.id ?? null;
  linhaAberta = escolhida;

  const sel = el('select', {
    id: 'sel-linha',
    onchange: (e) => { linhaAberta = Number(e.target.value); redesenha(); },
  });
  for (const { L, r } of ordenadas) {
    sel.append(el('option', {
      value: String(L.id),
      selected: L.id === escolhida ? '' : null,
      texto: `${L.orgao}/${L.uo} · ${natureza(L.nat)} · ${NOME_RAMO[r.ramo].split(' ·')[0]}`
        + ` · ${reaisMi(r.ano)}`,
    }));
  }
  return div('campo campo-largo', [
    el('label', { for: 'sel-linha', texto: 'Linha orçamentária (150 maiores do recorte)' }),
    sel,
  ]);
}

function cadeiaDaLinhaEscolhida(carga) {
  const L = carga.modelo.find((x) => x.id === linhaAberta);
  if (!L) return nota('Nenhuma linha neste recorte.', 'neutro');
  const r26 = carga.p26.porLinha.get(L.id);
  const r27 = carga.p27.porLinha.get(L.id);
  const passos = cadeiaDaLinha(L, carga.par, r26, r27);

  return div('', [
    div('ficha-linha', [
      ficha('Órgão', `${L.orgao} · ${carga.catalogo.orgaos?.[L.orgao] ?? ''}`),
      ficha('Unidade', `${L.uo} · ${carga.catalogo.unidades?.[L.uo] ?? ''}`),
      ficha('Natureza', natureza(L.nat)),
      ficha('Ramo de 2026', NOME_RAMO[r26.ramo]),
      ficha('Classe de 2027', r27.classe),
      ficha('Dotação', reaisMi(r26.dotacao)),
    ]),
    tabela({
      colunas: [
        { rotulo: 'Passo', celula: (x) => x.rotulo },
        {
          rotulo: 'Fator',
          alinha: 'd',
          nota: 'o fator do passo, não o acumulado',
          celula: (x) => (x.fator === null ? '—' : x.fator.toFixed(6).replace('.', ',')),
        },
        { rotulo: 'Valor', alinha: 'd', celula: (x) => reaisMi(x.valor, 3) },
        { rotulo: 'Por quê', celula: (x) => x.nota },
      ],
      linhas: passos,
    }),
    tabelaDetalheDoCv(carga, r26),
  ]);
}

function ficha(rotulo, valor) {
  return div('ficha-item', [span('ficha-rotulo', rotulo), span('ficha-valor', valor)]);
}

function tabelaDetalheDoCv(carga, r26) {
  if (r26.ramo !== 'composicao') {
    return nota(`Esta linha executou pelo ramo "${NOME_RAMO[r26.ramo]}": a regra 5.4 `
      + 'não roda nela, e por isso não há coeficiente de variação a mostrar.', 'neutro');
  }
  return tabela({
    classe: 'tabela-estreita',
    colunas: [
      { rotulo: 'Mês', celula: (d) => `${MESES[d.mes - 1]} (${d.mes})` },
      { rotulo: 'Base', alinha: 'd', celula: (d) => reaisMi(d.base, 3) },
      {
        rotulo: 'cv declarado',
        alinha: 'd',
        nota: 'célula em branco vale 9,99 pela regra 5.4',
        celula: (d) => (d.vazio
          ? span('ruim', `${pct(d.cvDeclarado, 0)} · em branco`)
          : pct(d.cvDeclarado, 2)),
      },
      {
        rotulo: 'cv aplicado',
        alinha: 'd',
        celula: (d) => (d.corta
          ? span('ruim', `${pct(d.cv)} · teto`)
          : pct(d.cv)),
      },
      { rotulo: 'Reajuste', alinha: 'd', celula: (d) => (d.reajuste ? pct(d.reajuste) : '—') },
      { rotulo: 'Específico', alinha: 'd', celula: (d) => (d.especifico ? pct(d.especifico) : '—') },
      {
        rotulo: 'Fator',
        alinha: 'd',
        nota: 'produto dos três, nunca a soma',
        celula: (d) => d.fator.toFixed(6).replace('.', ','),
      },
      { rotulo: 'Valor', alinha: 'd', celula: (d) => reaisMi(d.valor, 3) },
    ],
    linhas: r26.detalhe,
  });
}
