/**
 * Projeção de 2026 — regras 5.1 a 5.5, linha a linha.
 *
 * Três ramos, nesta ordem, e a ordem importa:
 *
 *   5.1  DESLIGADA     julho E agosto zerados: os quatro meses projetados vão a
 *                      zero. É "e", não "ou".
 *   5.2  MEDIANA       naturezas 319016, 319092 e 319094: cada mês projetado
 *                      recebe a MEDIANA de janeiro a agosto.
 *   5.3  COMPOSIÇÃO    o resto compõe a partir de agosto, mês a mês.
 *
 * A composição é:
 *
 *   valor(m) = valor(m−1) × (1 + min(cv_m, teto))
 *                         × (1 + reajuste, se m é o mês de vigência e a natureza
 *                            está na lista alcançada)
 *                         × (1 + soma dos aumentos específicos daquele mês)
 *
 * O fator incide sobre o MÊS ANTERIOR PROJETADO, nunca sobre agosto repetido e
 * nunca sobre o total. Cada linha compõe a sua própria cadeia.
 *
 * O 13º de 2026 é dezembro projetado × fator13, lançado DENTRO de dezembro, e não
 * como décima terceira parcela. A consulta publica dezembro já com ele embutido, e
 * essa é a razão de dezembro vir cinquenta por cento acima dos vizinhos.
 */

import {
  CV, PARAMETROS_PADRAO, alcancadoPeloReajuste, cvDoMes, ehDesligada, ehMediana,
  mediana, provisiona13, realizado8, somaEspecificos,
} from './regras.js';

/**
 * Projeta UMA linha. Devolve os doze meses, os quatro fatores, o 13º e o ramo.
 *
 * @param {object} L linha do modelo
 * @param {object} par premissas
 */
export function fdLinha(L, par = PARAMETROS_PADRAO) {
  const oito = realizado8(L);
  const meses = [...oito, 0, 0, 0, 0];
  const fatores = [null, null, null, null];
  const detalhe = [];

  let ramo;
  if (ehDesligada(L)) {
    ramo = 'desligada';
    for (let i = 0; i < 4; i += 1) {
      fatores[i] = 0;
      detalhe.push({
        mes: par.primeiroMesProjetado + i, base: 0, cv: 0, cvDeclarado: 0,
        reajuste: 0, especifico: 0, fator: 0, valor: 0, vazio: false, corta: false,
      });
    }
  } else if (ehMediana(L.nat)) {
    ramo = 'mediana';
    const med = mediana(oito);
    for (let i = 0; i < 4; i += 1) {
      meses[8 + i] = med;
      // O fator implícito existe para a memória de cálculo: a mediana NÃO é um
      // fator aplicado ao mês anterior, e publicar um fator aqui sem dizer que é
      // implícito seria afirmar que a regra 5.3 rodou nesta linha.
      const base = i === 0 ? oito[7] : med;
      fatores[i] = base === 0 ? null : med / base;
      detalhe.push({
        mes: par.primeiroMesProjetado + i, base, cv: null, cvDeclarado: null,
        reajuste: 0, especifico: 0, fator: fatores[i], valor: med,
        vazio: false, corta: false,
      });
    }
  } else {
    ramo = 'composicao';
    let base = oito[7];
    for (let i = 0; i < 4; i += 1) {
      const mes = par.primeiroMesProjetado + i;
      const cv = cvDoMes(L, i, par.teto);
      const reaj = (mes === Number(par.mesReajuste) && alcancadoPeloReajuste(L.nat))
        ? par.reajuste : 0;
      const esp = somaEspecificos(L, mes, par.especificos);
      const f = (1 + cv.aplicado) * (1 + reaj) * (1 + esp);
      const valor = base * f;
      meses[8 + i] = valor;
      fatores[i] = f;
      detalhe.push({
        mes, base, cv: cv.aplicado, cvDeclarado: cv.declarado, reajuste: reaj,
        especifico: esp, fator: f, valor, vazio: cv.vazio, corta: cv.corta,
      });
      base = valor;
    }
  }

  const dezSem13 = meses[11];
  const t13 = provisiona13(L.nat) ? dezSem13 * par.fator13 : 0;
  // O 13º entra DENTRO de dezembro. A consulta publica dezembro assim, e separar
  // as duas parcelas aqui é o que permite D2 ancorar 2027 no dezembro puro.
  meses[11] = dezSem13 + t13;

  const ano = meses.reduce((a, b) => a + b, 0);
  return {
    id: L.id, ramo, meses, fatores, detalhe, dezSem13, t13, ano,
    anoSem13: ano - t13,
    janAgo: oito.reduce((a, b) => a + b, 0),
    setDez: meses.slice(8).reduce((a, b) => a + b, 0),
    dotacao: Number(L.atual) || 0,
  };
}

/**
 * Projeta o conjunto. Devolve os agregados do exercício e a memória de cálculo
 * com as contagens que a consulta publica.
 */
export function projeta2026(linhas, par = PARAMETROS_PADRAO) {
  const meses = new Array(12).fill(0);
  const porLinha = new Map();
  const memoria = {
    linhas: linhas.length,
    desligadas: 0,
    mediana: 0,
    composicao: 0,
    linhasCom13: 0,
    mesesLinhaTeto: 0,
    mesesLinhaCvVazio: 0,
    mesesLinhaReajuste: 0,
    mesesLinhaEspecifico: 0,
    especificosDeclarados: 0,
    especificosAplicados: 0,
    mesesLinhaProjetados: 0,
  };

  let ano = 0;
  let t13 = 0;
  let janAgo = 0;
  let setDez = 0;
  let dotacao = 0;
  let dezSem13 = 0;

  for (const L of linhas) {
    const r = fdLinha(L, par);
    porLinha.set(L.id, r);
    for (let i = 0; i < 12; i += 1) meses[i] += r.meses[i];
    ano += r.ano;
    t13 += r.t13;
    janAgo += r.janAgo;
    setDez += r.setDez;
    dotacao += r.dotacao;
    dezSem13 += r.dezSem13;

    memoria[r.ramo === 'desligada' ? 'desligadas' : r.ramo] += 1;
    if (r.t13 > 0) memoria.linhasCom13 += 1;
    memoria.mesesLinhaProjetados += CV.length;
    for (const d of r.detalhe) {
      if (d.corta) memoria.mesesLinhaTeto += 1;
      if (d.vazio) memoria.mesesLinhaCvVazio += 1;
      if (d.reajuste > 0) memoria.mesesLinhaReajuste += 1;
      if (d.especifico > 0) memoria.mesesLinhaEspecifico += 1;
    }
  }

  // O contador de PREMISSAS aplicadas é diferente do de meses-linha alcançados: um
  // aumento declarado para um trio de órgão, unidade e natureza alcança todas as
  // linhas daquele trio, que podem ser várias. Publicar o número de meses-linha no
  // lugar do número de premissas faz aparecer "4 aplicados" onde só 3 vigoram.
  for (const e of par.especificos) {
    const existe = linhas.some((L) => Number(L.orgao) === Number(e.orgao)
      && Number(L.uo) === Number(e.uo) && Number(L.nat) === Number(e.nat));
    if (!existe) continue;
    memoria.especificosDeclarados += 1;
    if (e.mes >= par.primeiroMesProjetado && e.mes <= 12) memoria.especificosAplicados += 1;
  }

  return {
    meses,
    ano,
    t13,
    janAgo,
    setDez,
    dotacao,
    dezSem13,
    anoSem13: ano - t13,
    insuficiencia: ano - dotacao,
    porLinha,
    memoria,
  };
}
