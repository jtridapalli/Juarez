/**
 * Conferência da carga — a trava da regra A4.
 *
 * "A conferência trava a carga se a maior diferença passar de um real."
 *
 * Há três classes de verificação, e a distinção entre elas é o ponto do módulo:
 *
 *   INTERNA    identidades que o cálculo tem de satisfazer contra si mesmo. Um
 *              real de diferença é defeito, e defeito bloqueia a publicação dos
 *              indicadores. É aqui que entram as somas de agregação que o painel
 *              auditado publicava erradas em R$ 1.385,0 mi.
 *
 *   ADERÊNCIA  comparação com os números publicados na consulta de 29/09/2026. A
 *              tolerância é o arredondamento da própria casa publicada. NÃO é
 *              bloqueante: uma carga nova PODE divergir do publicado, e é o que se
 *              quer medir quando a base é reancorada.
 *
 *   FONTE      distância entre as duas origens do painel — o modelo da DOE e a
 *              série do Relatório 8778. Elas não cobrem o mesmo conjunto e a
 *              diferença é informação, não erro. Também não bloqueia.
 *
 * O que NÃO pode acontecer, e o painel auditado fazia: publicar um indicador cuja
 * agregação não fecha, com a diferença diluída no arredondamento da apresentação.
 */

import { delta } from './formato.js';

export const TOL_INTERNA = 1; // R$ 1,00

function item(grupo, rotulo, publicado, recomposto, tolerancia, opcoes = {}) {
  const diferenca = recomposto - publicado;
  return {
    grupo,
    rotulo,
    publicado,
    recomposto,
    diferenca,
    tolerancia,
    passa: Math.abs(diferenca) <= tolerancia,
    bloqueante: grupo === 'interna',
    nota: opcoes.nota ?? '',
  };
}

const rotuloAgr = {
  porPoder: 'por Poder',
  porOrgao: 'por órgão',
  porUnidade: 'por unidade',
  porNatureza: 'por natureza',
  porElemento: 'por elemento',
  porModalidade: 'por modalidade',
  porGnd: 'por GND',
  porRamo: 'por ramo da regra',
  porClasse27: 'por classe de 2027',
};

/**
 * @param {object} carga resultado de `montaCarga`
 * @param {object} [publicado] números da consulta, para a classe de aderência
 */
export function confere(carga, publicado = null) {
  const {
    modelo, p26, p27, p27Literal, agregados, veg, piso, arima, oito,
  } = carga;
  const itens = [];

  const I = (rotulo, pub, rec, nota) => itens.push(
    item('interna', rotulo, pub, rec, TOL_INTERNA, { nota }),
  );
  const A = (rotulo, pub, rec, tol, nota) => itens.push(
    item('aderência', rotulo, pub, rec, tol, { nota }),
  );
  const F = (rotulo, a, b, nota) => itens.push({
    ...item('fonte', rotulo, a, b, Infinity, { nota }), passa: true,
  });

  // ------------------------------------------------------------- internas
  I('Soma dos 12 meses de 2026 mais o 13º = exercício',
    p26.ano, p26.meses.reduce((a, b) => a + b, 0));
  I('Dezembro publicado = dezembro puro + provisão do 13º',
    p26.meses[11], p26.dezSem13 + p26.t13);
  I('Jan–ago = soma dos oito meses realizados',
    p26.janAgo, p26.meses.slice(0, 8).reduce((a, b) => a + b, 0));
  I('Memória (set–dez recompostos) = agregado do exercício',
    p26.setDez, p26.meses.slice(8).reduce((a, b) => a + b, 0));
  I('Exercício = jan–ago + set–dez + 13º',
    p26.ano, p26.janAgo + p26.setDez);
  I('Soma dos 12 meses de 2027 mais o 13º = exercício de 2027',
    p27.ano, p27.mesesPublicados.reduce((a, b) => a + b, 0));
  I('2027 sem o 13º + 13º de 2027 = 2027 publicado',
    p27.ano, p27.anoSem13 + p27.t13);
  I('Cestas de 2027 (ativo + inativo + D4) = exercício de 2027',
    p27.ano,
    ['ativo', 'inativo', 'd4'].reduce((a, c) => a
      + p27.porCesta[c].reduce((x, y) => x + y, 0) + p27.t13PorCesta[c], 0));

  // As nove agregações. É AQUI que o painel auditado perdia R$ 1.385,0 mi.
  for (const [chave, grupo] of Object.entries(agregados)) {
    const soma = grupo.itens.reduce((a, g) => a + g.proj26, 0);
    const somaDot = grupo.itens.reduce((a, g) => a + g.dotacao, 0);
    const soma27 = grupo.itens.reduce((a, g) => a + g.proj27, 0);
    const n = grupo.itens.length;
    I(`Agregação ${rotuloAgr[chave] ?? chave}: soma das linhas = exercício`,
      p26.ano, soma, `${n} grupos · ${modelo.length} linhas`);
    I(`Agregação ${rotuloAgr[chave] ?? chave}: soma das dotações = dotação`,
      p26.dotacao, somaDot);
    I(`Agregação ${rotuloAgr[chave] ?? chave}: soma de 2027 = exercício de 2027`,
      p27.ano, soma27);
  }

  // Partições de contagem: toda linha passa por exatamente um ramo e uma classe.
  I('Ramos da regra de 2026 particionam as linhas',
    0, p26.memoria.desligadas + p26.memoria.mediana + p26.memoria.composicao - modelo.length);
  I('Classes de 2027 particionam as linhas',
    0, p27.memoria.ativo + p27.memoria.inativo + p27.memoria.d4 - modelo.length);

  // As três últimas são verificações POR LINHA, e publicam o pior caso: conferir
  // só o agregado deixaria passar erro de sinal que se cancela entre linhas.
  let piorD2 = 0;
  let piorD4 = 0;
  let linhaD2 = null;
  let linhaD4 = null;
  for (const L of modelo) {
    const r26 = p26.porLinha.get(L.id);
    const r27 = p27.porLinha.get(L.id);
    if (r27.classe === 'd4') {
      const d = Math.abs(r27.ano - (r26.ano / 12) * 12);
      if (d > piorD4) { piorD4 = d; linhaD4 = L.id; }
    } else {
      const esperado = r26.dezSem13 * r27.fatores[0];
      const d = Math.abs(r27.meses[0] - esperado);
      if (d > piorD2) { piorD2 = d; linhaD2 = L.id; }
    }
  }
  I('D2/D3 · janeiro de 2027 = dezembro de 2026 × fator do mês 1 (pior linha)',
    0, piorD2, linhaD2 === null ? '—' : `pior caso na linha ${linhaD2}`);
  I('D4 · ano de 2027 = média de 2026 × 12 (pior linha)',
    0, piorD4, linhaD4 === null ? '—' : `pior caso na linha ${linhaD4}`);

  // ------------------------------------------------------------ aderência
  if (publicado) {
    const t = publicado.tolerancia ?? { mi: 50_000, bi: 5_000_000 };
    A('Projeção da DOE · 2026', publicado.proj2026, p26.ano, t.mi);
    A('Projeção da DOE · 2027', publicado.proj2027, p27.ano, t.mi);
    A('Liquidado jan–ago de 2026', publicado.janAgo2026, p26.janAgo, t.mi);
    A('Dotação atualizada do modelo', publicado.dotacao, p26.dotacao, t.mi);
    A('Crédito a abrir em 2026', publicado.credito2026, p26.insuficiencia, t.mi);
    A('13º dentro de dezembro de 2026', publicado.t13_2026, p26.t13, t.mi);
    A('13º dentro de dezembro de 2027', publicado.t13_2027, p27.t13, t.mi);
    A('Dezembro de 2026 sem o 13º', publicado.dez2026SemT13, p26.dezSem13, t.mi);
    if (p27Literal) {
      A('2027 pela leitura literal de D6 (ao mês)',
        publicado.proj2027Literal, p27Literal.ano, t.mi, 'só comparação');
    }
    (publicado.serie2026 ?? []).forEach((v, i) => {
      A(`Série de 2026 · ${NOMES[i]}`, v, p26.meses[i], t.mi);
    });
    (publicado.serie2027 ?? []).forEach((v, i) => {
      A(`Série de 2027 · ${NOMES[i]}`, v, p27.mesesPublicados[i], t.mi);
    });
    for (const [elem, alvo] of Object.entries(publicado.elementos ?? {})) {
      const g = agregados.porElemento.itens.find((x) => String(x.chave) === String(Number(elem)));
      A(`Elemento ${String(elem).padStart(2, '0')} · exercício de 2026`,
        alvo.ano, g ? g.proj26 : 0, t.mi);
      A(`Elemento ${String(elem).padStart(2, '0')} · linhas`,
        alvo.linhas, g ? g.linhas : 0, 0, 'contagem');
    }
    if (publicado.vegetativo2026) {
      A('Vegetativo da tela · 2026', publicado.vegetativo2026, veg.ano2026, t.mi);
    }
    if (publicado.vegetativo2027) {
      A('Vegetativo da tela · 2027', publicado.vegetativo2027, veg.ano2027, t.mi);
    }
    if (publicado.piso2026) A('Piso · 2026', publicado.piso2026, piso.ano2026, t.mi);
    if (arima && publicado.arimaJanela2027) {
      A('ARIMA · janela de 36 meses · 2027',
        publicado.arimaJanela2027, arima.janela.total2027, t.mi, 'só comparação');
    }
    if (arima && publicado.arimaInteira2027) {
      A('ARIMA · série inteira · 2027',
        publicado.arimaInteira2027, arima.inteira.total2027, t.mi, 'só comparação');
    }
    for (const [chave, alvo] of Object.entries(publicado.memoria ?? {})) {
      A(`Memória · ${chave}`, alvo, p26.memoria[chave] ?? p27.memoria[chave] ?? 0,
        0, 'contagem');
    }
  }

  // ---------------------------------------------------------------- fonte
  if (oito) {
    const grupo1 = modelo
      .filter((L) => Number(String(L.nat).padStart(6, '0').slice(2, 4)) !== 91)
      .reduce((a, L) => a + p26.porLinha.get(L.id).janAgo, 0);
    F('Grupo 1 jan–ago · modelo da DOE contra a série do 8778',
      grupo1, oito.anos[2026].meses.slice(0, 8).reduce((a, b) => a + b, 0),
      'conceitos iguais, extrações de dias diferentes');
    F('Unidades orçamentárias · modelo contra 8778',
      new Set(modelo.map((L) => String(L.uo))).size, oito.unidades, 'contagem');
    F('Dotação de pessoal · modelo (atualizada) contra 8050 (líquida)',
      p26.dotacao, oito.dotacao, 'réguas diferentes por construção');
  }

  const falhas = itens.filter((x) => x.bloqueante && !x.passa);
  const internas = itens.filter((x) => x.grupo === 'interna');
  const pior = internas.reduce((m, x) => Math.max(m, Math.abs(x.diferenca)), 0);

  return {
    itens,
    travada: falhas.length > 0,
    falhas,
    pior,
    resumo: {
      interna: resumoDe(itens, 'interna'),
      aderencia: resumoDe(itens, 'aderência'),
      fonte: itens.filter((x) => x.grupo === 'fonte').length,
    },
  };
}

const NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
  'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function resumoDe(itens, grupo) {
  const g = itens.filter((x) => x.grupo === grupo);
  return { total: g.length, passa: g.filter((x) => x.passa).length };
}

/**
 * Diferença de uma verificação.
 *
 * A escala é a do resto do painel, com a unidade sempre escrita: bilhão, milhão,
 * mil ou o real cru quando a diferença é de centavos — que é o caso das
 * identidades internas, onde esconder centavos esconderia o defeito. Uma coluna
 * cuja única função é ordenar divergências por tamanho não pode misturar escalas:
 * "−R$ 199.999,93" ao lado de "−R$ 2,705 mi" parece treze vezes maior sendo treze
 * vezes menor.
 */
export function formataDiferenca(v) {
  return delta(v);
}
