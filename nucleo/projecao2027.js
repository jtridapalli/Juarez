/**
 * Projeção de 2027 — regras D1 a D7, linha a linha.
 *
 * D1 é princípio e não se executa: proíbe partir da média de 2026. O código a
 * obedece por construção — 2027 parte de dezembro de 2026 e em lugar nenhum existe
 * uma média de 2026 sendo multiplicada por doze, salvo em D4, onde o documento
 * manda exatamente isso.
 *
 * D2  mês de referência = DEZEMBRO DE 2026 PROJETADO, sem a provisão do 13º.
 * D3  2027 se projeta a partir desse dezembro, doze meses encadeados.
 * D4  elementos 91 a 94: cada mês de 2027 vale a MÉDIA de 2026, e o ano vale × 12.
 * D5  13º de 2027 = dezembro de 2027 × 0,90 (ativos) ou × 0,95 (inativos e RPPS).
 * D6  vegetativo de 1,50% para ativos e 0,50% para inativos e RPPS.
 * D7  aumento nominal: parâmetro próprio, com mês de vigência. Não consta do
 *     documento — é acréscimo declarado do painel, e nasce em zero.
 *
 * Sobre D6: o enunciado traz o percentual e não diz "ao mês". A leitura publicada é
 * TAXA AO ANO distribuída pelos doze meses, fator do mês k = (1+v)^(k/12), porque
 * vegetativo de folha é taxa de ano — é o que progressões, promoções e anuênios
 * acrescentam ao longo de doze meses. A leitura literal, ao mês, compõe 19,56% no
 * ano e continua disponível em `modoD6: 'mes'` para comparação. A distância entre
 * as duas leituras é maior que o crédito a abrir do exercício corrente, e por isso
 * as duas rodam sempre.
 */

import {
  PARAMETROS_PADRAO, alcancadoPeloReajuste, ehD4, ehInativoRPPS, provisiona13,
} from './regras.js';
import { fator, pctSinal } from './formato.js';

/**
 * Fator de crescimento de 2027 no mês k (1 a 12), desde dezembro de 2026.
 * @param {number} v taxa declarada
 * @param {number} k mês, de 1 a 12
 * @param {'ano'|'mes'} modo leitura do enunciado de D6
 */
export function fatorD6(v, k, modo = 'ano') {
  return modo === 'mes' ? (1 + v) ** k : (1 + v) ** (k / 12);
}

/**
 * Projeta UMA linha para 2027 a partir do resultado de 2026 dela.
 *
 * @param {object} L linha do modelo
 * @param {object} par premissas
 * @param {object} r26 resultado de `fdLinha` para a mesma linha
 */
export function fd2027Linha(L, par, r26) {
  const inativo = ehInativoRPPS(L);
  const classe = ehD4(L.nat) ? 'd4' : (inativo ? 'inativo' : 'ativo');

  if (classe === 'd4') {
    // D4: a cesta que não se projeta. Cada mês vale a média de 2026 e o ano vale
    // essa média × 12. Nenhum fator de D6 a alcança, e é o que o documento manda.
    const media = r26.ano / 12;
    const meses = new Array(12).fill(media);
    return {
      id: L.id,
      classe,
      inativo,
      ancora: r26.dezSem13,
      meses,
      fatores: new Array(12).fill(1),
      t13: 0,
      ano: media * 12,
      anoSem13: media * 12,
    };
  }

  const v = inativo ? par.vegetativoInativo27 : par.vegetativoAtivo27;
  const ancora = r26.dezSem13;
  const meses = [];
  const fatores = [];
  const nominalAlcanca = par.aumentoNominal27 > 0 && alcancadoPeloReajuste(L.nat);

  for (let k = 1; k <= 12; k += 1) {
    let f = fatorD6(v, k, par.modoD6);
    if (nominalAlcanca && k >= Number(par.mesNominal27)) f *= (1 + par.aumentoNominal27);
    fatores.push(f);
    meses.push(ancora * f);
  }

  const dez = meses[11];
  const t13 = provisiona13(L.nat)
    ? dez * (inativo ? par.fator13Inativo27 : par.fator13Ativo27)
    : 0;
  const anoSem13 = meses.reduce((a, b) => a + b, 0);

  return {
    id: L.id, classe, inativo, ancora, meses, fatores, t13,
    ano: anoSem13 + t13, anoSem13,
  };
}

/** Projeta o conjunto para 2027. */
export function projeta2027(linhas, par = PARAMETROS_PADRAO, p26 = null) {
  const base = p26 ?? null;
  if (!base) throw new Error('projeta2027 exige o resultado de 2026');

  const mesesSem13 = new Array(12).fill(0);
  const porCesta = {
    ativo: new Array(12).fill(0),
    inativo: new Array(12).fill(0),
    d4: new Array(12).fill(0),
  };
  const t13PorCesta = { ativo: 0, inativo: 0, d4: 0 };
  const porLinha = new Map();
  const memoria = memoria2027();

  let t13 = 0;
  let ancora = 0;

  for (const L of linhas) {
    const r26 = base.porLinha.get(L.id);
    const r = fd2027Linha(L, par, r26);
    porLinha.set(L.id, r);
    for (let k = 0; k < 12; k += 1) {
      mesesSem13[k] += r.meses[k];
      porCesta[r.classe][k] += r.meses[k];
    }
    t13 += r.t13;
    t13PorCesta[r.classe] += r.t13;
    ancora += r.ancora;

    memoria.linhas += 1;
    memoria[r.classe] += 1;
    if (r.t13 > 0) memoria[`com13${r.inativo ? 'Inativo' : 'Ativo'}`] += 1;

    // Os mesmos contadores restritos às linhas VIVAS — as que não foram desligadas
    // pela regra 5.1. É o denominador que o quadro 28 usa sem declarar: ele publica
    // 719 ativos e 52 inativos, que somam 771, e 771 é 1.023 menos as 252
    // desligadas. Quem soma as duas linhas do quadro conclui que o modelo tem 771
    // linhas; ele tem 1.023, e a projeção de 2027 roda sobre todas.
    if (r26.ramo === 'desligada') {
      memoria.desligadas += 1;
    } else {
      memoria.vivas += 1;
      memoria[r.inativo ? 'vivoInativo' : 'vivoAtivo'] += 1;
      if (r.classe === 'd4') memoria.vivoD4 += 1;
    }
  }

  // O 13º de 2027 entra dentro de dezembro, como em 2026.
  const mesesPublicados = mesesSem13.map((v, k) => (k === 11 ? v + t13 : v));
  const anoSem13 = mesesSem13.reduce((a, b) => a + b, 0);

  return {
    meses: mesesSem13,
    mesesPublicados,
    porCesta,
    t13PorCesta,
    t13,
    ancora,
    anoSem13,
    ano: anoSem13 + t13,
    porLinha,
    memoria,
  };
}

export function memoria2027() {
  return {
    linhas: 0, ativo: 0, inativo: 0, d4: 0,
    com13Ativo: 0, com13Inativo: 0,
    vivoAtivo: 0, vivoInativo: 0, vivoD4: 0, vivas: 0, desligadas: 0,
  };
}

/**
 * Decompõe o crescimento de 2027 sobre 2026.
 *
 * A consulta publicava os dois exercícios lado a lado e nada entre eles. A
 * decomposição reprojeta 2027 com o vegetativo e o nominal em ZERO: o que sobra de
 * diferença contra 2026 é o efeito-base, isto é, o custo do ato de ancorar em
 * dezembro em vez de na média do ano. É cerca de nove décimos do crescimento, e a
 * discussão orçamentária se concentrava no outro décimo.
 */
export function decompoeCrescimento2027(linhas, par, p26, p27) {
  const zerado = projeta2027(linhas, {
    ...par, vegetativoAtivo27: 0, vegetativoInativo27: 0, aumentoNominal27: 0,
  }, p26);
  const semNominal = projeta2027(linhas, { ...par, aumentoNominal27: 0 }, p26);

  const total = p27.ano - p26.ano;
  const efeitoBase = zerado.ano - p26.ano;
  const vegetativo = semNominal.ano - zerado.ano;
  const nominal = p27.ano - semNominal.ano;

  return {
    base2026: p26.ano,
    total2027: p27.ano,
    total,
    efeitoBase,
    vegetativo,
    nominal,
    parcelaEfeitoBase: total === 0 ? 0 : efeitoBase / total,
    parcelaVegetativo: total === 0 ? 0 : vegetativo / total,
    parcelaNominal: total === 0 ? 0 : nominal / total,
    relativo: p26.ano === 0 ? 0 : total / p26.ano,
  };
}

/**
 * A cadeia inteira de UMA linha, de agosto de 2026 a dezembro de 2027, com o fator
 * de cada passo. É a prova de que a regra vale por linha: sem ela, a memória de
 * cálculo do exercício é uma afirmação sem lastro.
 */
export function cadeiaDaLinha(L, par, r26, r27) {
  const passos = [];
  passos.push({
    rotulo: 'Agosto de 2026 · último mês realizado',
    fator: null, valor: r26.meses[7], nota: 'ponto de partida',
  });
  const nomes = ['Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  for (let i = 0; i < 4; i += 1) {
    passos.push({
      rotulo: `${nomes[i]} de 2026`,
      fator: r26.fatores[i],
      valor: r26.meses[8 + i] - (i === 3 ? r26.t13 : 0),
      nota: r26.ramo === 'mediana' ? 'mediana de jan–ago (regra 5.2)'
        : r26.ramo === 'desligada' ? 'linha desligada (regra 5.1)'
          : `histórico ${pctSinal(r26.fatores[i] - 1)}`,
    });
  }
  if (r26.t13 > 0) {
    passos.push({
      rotulo: '13º de 2026 · lançado dentro de dezembro',
      fator: null, valor: r26.t13, nota: 'regra 5.5',
    });
  }
  passos.push({
    rotulo: 'Ponto de partida de 2027 (D2) · dezembro sem o 13º',
    fator: null, valor: r26.dezSem13, nota: '',
  });
  const nomes27 = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  for (let k = 1; k <= 12; k += 1) {
    passos.push({
      rotulo: `${nomes27[k - 1]} de 2027`,
      fator: k === 1 ? r27.fatores[0] : r27.fatores[k - 1] / r27.fatores[k - 2],
      valor: r27.meses[k - 1],
      nota: r27.classe === 'd4' ? 'cesta D4: média de 2026 (regra D4)'
        : `desde dez/26: × ${fator(r27.fatores[k - 1], 5)}`,
    });
  }
  passos.push({
    rotulo: '13º de 2027 · lançado em dezembro',
    fator: null,
    valor: r27.t13,
    nota: r27.t13 === 0 ? `natureza ${L.nat} não provisiona 13º`
      : `dez/27 × ${fator(r27.inativo ? par.fator13Inativo27 : par.fator13Ativo27, 2)} (D5)`,
  });
  passos.push({
    rotulo: 'Exercício de 2027 desta linha', fator: null, valor: r27.ano, nota: '',
  });
  return passos;
}

/** Série de 2027 por cesta, mês a mês, para o quadro de composição. */
export function composicao2027(p27) {
  const linhasMes = [];
  for (let k = 1; k <= 12; k += 1) {
    linhasMes.push({
      mes: k,
      ativo: p27.porCesta.ativo[k - 1] + (k === 12 ? p27.t13PorCesta.ativo : 0),
      inativo: p27.porCesta.inativo[k - 1] + (k === 12 ? p27.t13PorCesta.inativo : 0),
      d4: p27.porCesta.d4[k - 1],
      total: p27.mesesPublicados[k - 1],
    });
  }
  return {
    linhasMes,
    exercicio: {
      ativo: p27.porCesta.ativo.reduce((a, b) => a + b, 0) + p27.t13PorCesta.ativo,
      inativo: p27.porCesta.inativo.reduce((a, b) => a + b, 0) + p27.t13PorCesta.inativo,
      d4: p27.porCesta.d4.reduce((a, b) => a + b, 0),
      total: p27.ano,
    },
    t13: {
      ativo: p27.t13PorCesta.ativo, inativo: p27.t13PorCesta.inativo, total: p27.t13,
    },
  };
}
