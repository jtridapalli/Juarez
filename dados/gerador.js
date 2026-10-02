/**
 * Gerador do conjunto sintético calibrado.
 *
 * O problema: produzir 1.023 linhas que, passadas pelo motor SEM nenhum atalho,
 * reproduzam os agregados publicados. Não é um sorteio com ajuste no fim — é um
 * sistema que se resolve, e cada peça resolve uma família de restrições:
 *
 *   ESTRUTURA   quantas linhas em cada elemento, natureza, órgão e unidade. Vem de
 *               `alvos.js` e é contagem pura, resolvida por maior resto, com um
 *               passe final que garante que nenhuma unidade fique sem linha.
 *
 *   DESLIGADAS  QUAIS linhas recebem julho e agosto zerados. A regra 5.1 desliga
 *               pelo dado, então a escolha das linhas é o que faz os quatro
 *               contadores do quadro 28 fecharem ao mesmo tempo.
 *
 *   NÍVEIS      quanto cada linha vale em cada mês realizado. IPF alternando duas
 *               famílias de restrição: o total de cada mês e o total de cada
 *               elemento no exercício. Converge porque a projeção é LINEAR no
 *               nível da linha — dobrar o realizado dobra o projetado, em
 *               qualquer dos três ramos.
 *
 *   TETO        os coeficientes de variação. Um multiplicador θ por mês projetado
 *               faz o mês fechar; um corte global faz a contagem de meses-linha em
 *               que o teto morde fechar.
 *
 *   13º         um viés ψ entre as naturezas que provisionam 13º e as que não
 *               provisionam, DENTRO de cada elemento. Como o passo por elemento
 *               restaura o total do elemento logo em seguida, ψ move a repartição
 *               interna sem mexer no agregado, e é o que permite acertar a
 *               provisão de dezembro sem estragar a abertura por elemento.
 *
 * Duas advertências que custaram tempo e ficam escritas:
 *
 * 1. A relação entre o corte e a contagem de meses-linha em que o teto morde é
 *    INVERSA do que parece. Subir o corte manda mais sorteios para baixo do teto,
 *    o solver de θ sobe para manter os alvos monetários, e MAIS meses passam a ser
 *    cortados — não menos.
 *
 * 2. Setembro é MENOR que agosto na série publicada, e a regra 5.3 só sabe
 *    crescer. A queda vem das naturezas de mediana: agosto delas é excepcional, a
 *    mediana de jan–ago não é, e trocar um pelo outro derruba o total. É
 *    exatamente a razão de a regra 5.2 existir, e por isso as linhas de mediana
 *    recebem aqui uma forma com agosto fora de escala.
 */

import {
  ARIMA, ARQUETIPOS, CONTADORES, DOTACAO_POR_PODER, ELEMENTOS, MONETARIOS,
  NATUREZAS, ORGAOS, SERIE_8778,
} from './alvos.js';
import {
  CV, CV_VAZIO, PARAMETROS_PADRAO, alcancadoPeloReajuste, ehMediana, elemento,
  mediana, poderDaLinha, provisiona13, somaEspecificos,
} from '../nucleo/regras.js';
import { projeta2026 } from '../nucleo/projecao2026.js';

const MI = 1e6;
const MESES8 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago'];

/** Gerador congruente linear: mesma semente, mesmo conjunto, sempre. */
function aleatorio(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Reparte `total` unidades inteiras entre pesos pelo método do MAIOR RESTO.
 *
 * Arredondar cada parcela e somar perde ou ganha linhas, e uma contagem que não
 * fecha é exatamente a classe de defeito que o painel existe para não cometer.
 */
export function maiorResto(pesos, total) {
  const soma = pesos.reduce((a, b) => a + b, 0);
  if (soma <= 0 || total <= 0) return pesos.map(() => 0);
  const exato = pesos.map((p) => (p / soma) * total);
  const base = exato.map(Math.floor);
  let falta = total - base.reduce((a, b) => a + b, 0);
  const ordem = exato
    .map((v, i) => ({ i, resto: v - Math.floor(v) }))
    .sort((a, b) => b.resto - a.resto);
  for (let k = 0; falta > 0; k += 1, falta -= 1) base[ordem[k % ordem.length].i] += 1;
  return base;
}

/** Bisseção sobre função monótona; devolve o argumento, não o valor. */
function bisseca(f, lo, hi, alvo, passos = 40) {
  let a = lo;
  let b = hi;
  const cresce = f(b) >= f(a);
  for (let i = 0; i < passos; i += 1) {
    const m = (a + b) / 2;
    if ((f(m) < alvo) === cresce) a = m; else b = m;
  }
  return (a + b) / 2;
}

/**
 * Forma mensal de jan–ago.
 *
 * Duas formas, e a diferença entre elas é o que torna a série publicada possível:
 * a folha comum sobe devagar até agosto, e as naturezas de mediana têm em agosto
 * um pagamento fora de escala. Sem isso, setembro não pode cair abaixo de agosto
 * — e na série publicada ele cai.
 */
function formaDaLinha(rnd, arquetipo, ehMed) {
  if (ehMed) {
    const base = [1, 1.02, 0.98, 1.03, 0.99, 1.01, 1.0, 2.20];
    return base.map((v, i) => v * (1 + (rnd() - 0.5) * (i === 7 ? 0.10 : 0.22)));
  }
  const sazonal = [0.955, 0.988, 1.008, 0.981, 1.001, 1.021, 1.031, 1.047];
  const escala = arquetipo === 'inativos' ? 0.35 : 1;
  return sazonal.map((v) => v * (1 + (rnd() - 0.5) * 0.09 * escala));
}

/**
 * Monta a estrutura: uma linha por (elemento, natureza, órgão, unidade).
 *
 * O passe final de cobertura existe porque o maior resto, aplicado elemento a
 * elemento, deixa as unidades pequenas com zero linha em todos eles — e uma
 * unidade sem linha nenhuma some do seletor de recorte sem que nada avise. Ele
 * realoca uma linha da unidade mais povoada para cada unidade vazia, preservando
 * todas as contagens de elemento e de natureza.
 */
function montaEstrutura(rnd) {
  const unidades = [];
  for (const o of ORGAOS) {
    for (let k = 0; k < o.unidades; k += 1) {
      unidades.push({
        uo: o.codigo * 100 + k + 1,
        orgao: o.codigo,
        nome: k === 0 ? `${o.nome} · administração direta` : `${o.nome} · unidade ${k + 1}`,
        arquetipo: o.arquetipo,
        peso: o.peso / o.unidades,
      });
    }
  }
  const porUo = new Map(unidades.map((u) => [u.uo, u]));

  const linhas = [];
  let id = 0;

  for (const e of ELEMENTOS) {
    const candidatas = unidades
      .map((u) => ({ u, w: (ARQUETIPOS[u.arquetipo][e.elemento] ?? 0) * u.peso }))
      .filter((x) => x.w > 0);
    if (candidatas.length === 0) continue;

    for (const nt of NATUREZAS[e.elemento]) {
      const repartido = maiorResto(candidatas.map((x) => x.w), nt.linhas);
      candidatas.forEach((c, i) => {
        for (let k = 0; k < repartido[i]; k += 1) {
          id += 1;
          linhas.push({
            id,
            orgao: c.u.orgao,
            uo: c.u.uo,
            nat: nt.nat,
            acao: 4000 + ((id * 7) % 90) + 1,
            fonte: [100, 131, 135, 144, 281][id % 5],
            det: 0,
            idex: 1,
          });
        }
      });
    }
  }

  // Cobertura: nenhuma unidade sem linha.
  const conta = new Map();
  for (const L of linhas) conta.set(L.uo, (conta.get(L.uo) ?? 0) + 1);
  const vazias = unidades.filter((u) => !conta.has(u.uo));
  for (const u of vazias) {
    const compativeis = linhas.filter((L) => (ARQUETIPOS[u.arquetipo][elemento(L.nat)] ?? 0) > 0
      && (conta.get(L.uo) ?? 0) > 1);
    const alvo = compativeis.length ? compativeis : linhas.filter((L) => (conta.get(L.uo) ?? 0) > 1);
    // Tira da unidade mais povoada: é a que menos sente a perda de uma linha.
    alvo.sort((a, b) => (conta.get(b.uo) ?? 0) - (conta.get(a.uo) ?? 0));
    const L = alvo[0];
    conta.set(L.uo, conta.get(L.uo) - 1);
    L.orgao = u.orgao;
    L.uo = u.uo;
    conta.set(u.uo, 1);
  }

  for (const L of linhas) {
    const u = porUo.get(L.uo);
    L.uge = L.uo * 10 + 1;
    L.ugr = L.uo * 10 + 1;
    L.poder = poderDaLinha(L);
    L.arquetipo = u.arquetipo;
    L.peso = u.peso;
    L.med = ehMediana(L.nat);
    L.com13 = provisiona13(L.nat);
    // Linha alcançada por algum aumento específico declarado, em QUALQUER mês. O
    // solver dimensiona a massa dessas linhas, e por isso ela é marcada aqui: um
    // trio sem linha nenhuma deixaria a premissa sem efeito e sem registro, que é
    // precisamente o defeito do aumento de agosto.
    L.especifica = PARAMETROS_PADRAO.especificos.some((e) => Number(e.orgao) === L.orgao
      && Number(e.uo) === L.uo && Number(e.nat) === Number(L.nat));
    L.forma = formaDaLinha(rnd, u.arquetipo, L.med);
    L.formaSoma = L.forma.reduce((a, b) => a + b, 0);
    L.nivel = u.peso * (0.55 + rnd() * 0.9);
  }

  const semLinha = PARAMETROS_PADRAO.especificos.filter((e) => !linhas.some(
    (L) => Number(e.orgao) === L.orgao && Number(e.uo) === L.uo
      && Number(e.nat) === Number(L.nat),
  ));
  if (semLinha.length > 0) {
    throw new Error(`trio de aumento específico sem linha: ${
      semLinha.map((e) => `${e.orgao}/${e.uo}/${e.nat}`).join(', ')}`);
  }

  return { linhas, unidades };
}

/**
 * Escolhe QUAIS linhas são desligadas.
 *
 * A regra 5.1 desliga pelo dado, nunca por decreto: a escolha aqui é a de quais
 * linhas receberão julho e agosto zerados. Os quatro contadores do quadro 28 —
 * mediana viva, com 13º viva, inativa viva e ativa viva — têm de fechar ao mesmo
 * tempo, e a álgebra que amarra os quatro está escrita abaixo.
 */
function escolheDesligadas(linhas) {
  const inativo = (L) => [87, 88].includes(Number(L.orgao))
    || [319001, 319003, 319101, 319103].includes(Number(L.nat));

  const balde = (L) => {
    if (inativo(L)) return 'b5';
    if (L.med && L.com13) return 'b1';
    if (L.med) return 'b2';
    if (L.com13) return 'b3';
    return 'b4';
  };

  const baldes = { b1: [], b2: [], b3: [], b4: [], b5: [] };
  for (const L of linhas) baldes[balde(L)].push(L);
  const s = Object.fromEntries(Object.entries(baldes).map(([k, v]) => [k, v.length]));

  // Sejam a, b, c, d as SOBREVIVENTES de cada balde de ativas:
  //   a + b         = mediana viva
  //   a     + c     = com 13º viva
  //   a + b + c + d = ativa viva
  // Um grau de liberdade sobra — `a` — e ele se escolhe no meio da faixa viável,
  // para que nenhum balde fique vazio e trave o sistema.
  const { medianaViva, com13Vivo, ativoVivo, inativoVivo, desligadas: alvoDesl } = CONTADORES;
  const viavel = (a) => {
    const b = medianaViva - a;
    const c = com13Vivo - a;
    const d = ativoVivo - medianaViva - c;
    return a >= 0 && a <= s.b1 && b >= 0 && b <= s.b2
      && c >= 0 && c <= s.b3 && d >= 0 && d <= s.b4;
  };
  const faixa = [];
  for (let a = 0; a <= Math.min(s.b1, medianaViva, com13Vivo); a += 1) if (viavel(a)) faixa.push(a);
  if (faixa.length === 0) {
    throw new Error(`contadores inviáveis com esta estrutura: ${JSON.stringify(s)}`);
  }
  const a = faixa[Math.floor(faixa.length / 2)];

  const vivas = {
    b1: a,
    b2: medianaViva - a,
    b3: com13Vivo - a,
    b4: ativoVivo - medianaViva - (com13Vivo - a),
    b5: inativoVivo,
  };
  if (s.b5 < inativoVivo) {
    throw new Error(`inativas insuficientes: ${s.b5} contra ${inativoVivo} vivas pedidas`);
  }

  const desligadas = new Set();
  for (const k of Object.keys(baldes)) {
    const pool = baldes[k];
    const mortas = pool.length - vivas[k];
    if (mortas < 0) throw new Error(`balde ${k} tem ${pool.length} para ${vivas[k]} vivas`);
    // Espalha pelo passo do balde, para que as desligadas não fiquem concentradas
    // num órgão só — uma unidade inteira desligada seria um artefato visível.
    for (let i = 0; i < mortas; i += 1) {
      desligadas.add(pool[Math.round((i * (pool.length - 1)) / Math.max(1, mortas - 1 || 1))].id);
    }
    // O passo pode colidir; completa em ordem até fechar a conta do balde.
    for (let j = 0; pool.filter((L) => desligadas.has(L.id)).length < mortas; j += 1) {
      desligadas.add(pool[j].id);
    }
  }

  const total = desligadas.size;
  if (total !== alvoDesl) {
    throw new Error(`desligadas ${total} contra ${alvoDesl} pedidas`);
  }
  return { desligadas, baldes: s, vivas, grauDeLiberdade: a };
}

/**
 * Sorteios de cv, células em branco e a ordem de corte.
 *
 * Duas famílias de sorteio por célula, e separá-las é o que permite resolver
 * contagem e dinheiro sem que um estrague o outro:
 *
 *   `u`  ORDENA. Decide QUAIS células do mês ficam acima do teto: tomam-se as `n`
 *        de maior `u`. A contagem de meses-linha cortados passa a ser ESCOLHIDA, e
 *        por isso fecha no inteiro, não por aproximação.
 *
 *   `v`  DIMENSIONA. Decide QUANTO vale o cv da célula dentro da faixa em que ela
 *        já caiu. É o que o solver de `w` move para fechar o total do mês.
 *
 * A primeira versão usava um sorteio só e um limiar único para os quatro meses, e
 * não fechava: o mínimo que o conjunto alcançava eram 1.870 meses-linha cortados
 * contra os 1.219 publicados. A razão é que os quatro meses projetados pedem
 * crescimentos médios muito diferentes — outubro pede MAIS que o teto, setembro
 * pede menos da metade dele — e um limiar comum obriga os quatro à mesma proporção
 * de células cortadas. Com um limiar por mês, a soma das quatro proporções tem
 * folga de sobra para pousar em 1.219.
 */
function montaSorteios(linhas, semente, vazios) {
  const rnd = aleatorio(semente);
  const u = new Map();
  const v = new Map();
  for (const L of linhas) {
    u.set(L.id, [rnd(), rnd(), rnd(), rnd()]);
    v.set(L.id, [rnd(), rnd(), rnd(), rnd()]);
  }

  // As células em branco ficam em linhas DISTINTAS, para que a contagem de
  // meses-linha com cv vazio seja também uma contagem de linhas afetadas.
  const alvos = linhas.filter((L) => !L.desligada && !L.med);
  const vaziasEm = new Set();
  for (let i = 0; i < vazios && alvos.length > 0; i += 1) {
    const L = alvos[Math.floor((i * (alvos.length - 1)) / Math.max(1, vazios - 1))];
    vaziasEm.add(`${L.id}:${i % 4}`);
  }

  const cv = {
    u,
    v,
    vaziasEm,
    /** Ids cortados pelo teto em cada mês projetado. */
    cortados: [new Set(), new Set(), new Set(), new Set()],
    /** Dispersão dos NÃO cortados em cada mês projetado. Um por mês. */
    w: [1, 1, 1, 1],
    /** Candidatas de cada mês, da maior ordenadora para a menor. */
    ordem: [[], [], [], []],
    /** Quantas candidatas cada mês tem, descontadas as células em branco. */
    candidatas: [0, 0, 0, 0],
  };

  for (let k = 0; k < 4; k += 1) {
    const fila = alvos
      .filter((L) => !vaziasEm.has(`${L.id}:${k}`))
      .map((L) => ({ id: L.id, u: u.get(L.id)[k] }))
      .sort((a, b) => b.u - a.u)
      .map((x) => x.id);
    cv.ordem[k] = fila;
    cv.candidatas[k] = fila.length;
  }
  return cv;
}

/** Marca como cortadas as `n[k]` candidatas de maior ordenadora em cada mês. */
function defineCortes(cv, n) {
  for (let k = 0; k < 4; k += 1) {
    const s = new Set();
    for (let i = 0; i < n[k]; i += 1) s.add(cv.ordem[k][i]);
    cv.cortados[k] = s;
  }
}

/**
 * Reparte a contagem publicada de meses-linha cortados entre os quatro meses.
 *
 * O limite de cada mês é a sua própria razão: um mês que precisa crescer a 40% do
 * teto não pode ter mais de 40% das células cortadas, porque cada célula cortada já
 * entrega o teto cheio e as outras não entregam menos de zero. Reparte-se por maior
 * resto dentro desses limites, e o que não couber num mês transborda para os
 * outros até a contagem fechar no inteiro publicado.
 */
function alocaCortes(cv, razoes, estrito = false) {
  const alvo = CONTADORES.mesesLinhaTeto - CONTADORES.mesesLinhaCvVazio;
  let limite = razoes.map((r, k) => Math.max(
    0, Math.min(cv.candidatas[k], Math.floor(Math.min(r, 1) * cv.candidatas[k] * 0.985)),
  ));
  let capacidade = limite.reduce((a, b) => a + b, 0);
  let provisoria = false;
  if (capacidade < alvo) {
    // Dentro do laço as razões são medidas sobre um estado ainda em movimento, e um
    // mês pode medir razão negativa só porque o passo anterior o deixou acima do
    // publicado. Abortar aí seria confundir transitório com inviabilidade: a
    // repartição fica PROVISÓRIA e a iteração seguinte a refaz. No fecho, não — ali
    // o estado já é o definitivo e capacidade insuficiente é defeito de
    // especificação, que tem de aparecer.
    if (estrito) {
      throw new Error(`meses-linha cortados inalcançáveis: cabem ${capacidade} de ${alvo}`
        + ` · razões ${razoes.map((r) => r.toFixed(3)).join(' ')}`
        + ` · limites ${limite.join(' ')} de ${cv.candidatas.join(' ')}`);
    }
    provisoria = true;
    limite = cv.candidatas.map((n) => n);
    capacidade = limite.reduce((a, b) => a + b, 0);
  }

  const n = maiorResto(limite, alvo);
  // Transborda o excesso dos meses que estouraram o próprio limite.
  let sobra = 0;
  for (let k = 0; k < 4; k += 1) {
    if (n[k] > limite[k]) { sobra += n[k] - limite[k]; n[k] = limite[k]; }
  }
  for (let k = 0; sobra > 0; k = (k + 1) % 4) {
    const cabe = Math.min(sobra, limite[k] - n[k]);
    n[k] += cabe;
    sobra -= cabe;
  }
  return { n, limite, provisoria };
}

/**
 * Coeficiente de variação declarado de uma linha num mês projetado.
 *
 * Quem foi cortado recebe um valor estritamente acima do teto; quem não foi recebe
 * um valor na faixa `[max(0, teto(1−w)), teto]`. Com `w = 0` a faixa degenera no
 * próprio teto — que NÃO conta como corte, porque a regra corta em `declarado >
 * teto` — e com `w` grande a faixa desce até zero. É o que dá ao solver uma escala
 * monótona de crescimento médio sem mexer em quem está cortado.
 *
 * O valor sai QUANTIZADO em quatro casas da fração, isto é, duas casas do por
 * cento — a casa em que a consulta publica o cv ("9,99"). A quantização acontece
 * AQUI, e não na gravação, e a ordem importa: a primeira versão arredondava na
 * gravação, depois de o solver já ter fechado, e um cv de 1,48% virava 1,00% no
 * arquivo. A carga lida do disco projetava então um ano inteiro diferente do que o
 * solver havia acertado. Quantizando antes, o solver resolve sobre o número que vai
 * ser gravado.
 */
function cvDeclarado(cv, L, k, teto) {
  if (cv.vaziasEm.has(`${L.id}:${k}`)) return null;
  const x = cv.v.get(L.id)[k];
  const bruto = cv.cortados[k].has(L.id)
    ? teto + 0.0005 + x * 0.085
    : Math.max(0, teto * (1 - cv.w[k] * x));
  return Math.round(bruto * 1e4) / 1e4;
}

/** O cv já cortado pelo teto, com a possibilidade de forçar o mês. */
function cvAplicado(cv, L, k, par, forca) {
  if (forca && forca[k] !== null && forca[k] !== undefined) return forca[k];
  const d = cvDeclarado(cv, L, k, par.teto);
  return Math.min(d === null ? CV_VAZIO : d, par.teto);
}

function aplicaCv(linhas, cv, teto) {
  for (const L of linhas) {
    for (let k = 0; k < 4; k += 1) {
      const v = cvDeclarado(cv, L, k, teto);
      L[CV[k]] = v === null ? '' : v;
    }
  }
}

/**
 * Núcleo rápido dos quatro meses projetados.
 *
 * Reproduz a regra exatamente — é conferido contra `projeta2026` no fim — e existe
 * só para que as bisseções possam rodar milhares de vezes sem alocar um objeto por
 * linha a cada passo.
 */
function projetaRapido(linhas, cv, par, forca) {
  const tot = [0, 0, 0, 0];
  let t13 = 0;
  let dezSem13 = 0;
  for (const L of linhas) {
    if (L.desligada) continue;
    if (L.med) {
      const m = mediana(MESES8.map((n) => L[n]));
      for (let k = 0; k < 4; k += 1) tot[k] += m;
      dezSem13 += m;
      if (L.com13) t13 += m * par.fator13;
      continue;
    }
    let base = L.ago;
    const reajuste = alcancadoPeloReajuste(L.nat) ? par.reajuste : 0;
    for (let k = 0; k < 4; k += 1) {
      const mes = par.primeiroMesProjetado + k;
      const r = mes === Number(par.mesReajuste) ? reajuste : 0;
      const esp = somaEspecificos(L, mes, par.especificos);
      base *= (1 + cvAplicado(cv, L, k, par, forca)) * (1 + r) * (1 + esp);
      tot[k] += base;
    }
    dezSem13 += base;
    if (L.com13) t13 += base * par.fator13;
  }
  return { tot, t13, dezSem13, dez: dezSem13 + t13 };
}

/**
 * Total do mês projetado `k`, SEM a provisão do 13º.
 *
 * Dezembro é o mês em que o 13º entra, e o alvo de dezembro aqui é a despesa do
 * MÊS, não a despesa do mês mais a provisão. A provisão é consequência da regra
 * 5.5 e sai do próprio dezembro projetado; perseguir o total com ela embutida
 * faria o solver mover dezembro para cobrir um alvo que ele mesmo gera.
 */
function totalDoMes(linhas, cv, par, k, forca) {
  const r = projetaRapido(linhas, cv, par, forca);
  return k === 3 ? r.dezSem13 : r.tot[k];
}

/**
 * Razão do mês: que fração do teto o mês precisa crescer, em média ponderada.
 *
 * Mede, não estima. O total do mês é AFIM no vetor de cv aplicado — cada linha
 * entra como valor do mês anterior vezes (1+cv) — então basta avaliar o mês com
 * todo cv em zero e com todo cv no teto, e a razão é onde o alvo publicado cai
 * entre os dois. Razão acima de um significa mês inalcançável pela regra, e é o
 * caso de outubro: ele só cabe porque os aumentos específicos daquele mês incidem
 * por cima do teto.
 */
function razaoDoMes(linhas, cv, par, k, alvoMes) {
  const forca = [null, null, null, null];
  forca[k] = 0;
  const piso = totalDoMes(linhas, cv, par, k, forca);
  forca[k] = par.teto;
  const topo = totalDoMes(linhas, cv, par, k, forca);
  if (topo <= piso) return 1;
  return (alvoMes[8 + k] - piso) / (topo - piso);
}

function contaTeto(linhas, cv, par) {
  let teto = 0;
  let vazios = 0;
  for (const L of linhas) {
    if (L.desligada || L.med) continue;
    for (let k = 0; k < 4; k += 1) {
      const d = cvDeclarado(cv, L, k, par.teto);
      if (d === null) { vazios += 1; teto += 1; continue; }
      if (d > par.teto) teto += 1;
    }
  }
  return { teto, vazios };
}

function aplicaNivel(linhas) {
  for (const L of linhas) {
    for (let m = 0; m < 8; m += 1) L[MESES8[m]] = L.nivel * L.forma[m];
    if (L.desligada) {
      // Desligada não é linha vazia: ela TEM histórico até junho e para em julho.
      // Zerar o ano inteiro apagaria a informação de que a despesa existiu, e é a
      // existência dela que distingue desligamento de linha que nunca houve.
      L.jul = 0;
      L.ago = 0;
    }
  }
}

function normalizaMeses(linhas, alvo) {
  for (let m = 0; m < 8; m += 1) {
    const nome = MESES8[m];
    let soma = 0;
    for (const L of linhas) soma += L[nome];
    if (soma <= 0) continue;
    const k = alvo[m] / soma;
    for (const L of linhas) L[nome] *= k;
  }
}

/**
 * Exercício de 2026 de uma linha SEM a provisão do 13º.
 *
 * É a grandeza que o passo por elemento persegue. Incluir a provisão faria o alvo
 * de cada elemento depender de quantas das suas linhas provisionam, e o passo por
 * elemento passaria a competir com a regra 5.5 em vez de repartir massa.
 */
function anoDaLinha(L, cv, par) {
  let janAgo = 0;
  for (const n of MESES8) janAgo += L[n];
  if (L.desligada) return janAgo;
  if (L.med) {
    const m = mediana(MESES8.map((n) => L[n]));
    return janAgo + 4 * m;
  }
  let base = L.ago;
  let setDez = 0;
  const reajuste = alcancadoPeloReajuste(L.nat) ? par.reajuste : 0;
  for (let k = 0; k < 4; k += 1) {
    const mes = par.primeiroMesProjetado + k;
    const r = mes === Number(par.mesReajuste) ? reajuste : 0;
    base *= (1 + cvAplicado(cv, L, k, par, null))
      * (1 + r) * (1 + somaEspecificos(L, mes, par.especificos));
    setDez += base;
  }
  return janAgo + setDez;
}

/**
 * Razão-alvo de outubro.
 *
 * Outubro cresce 1,59% sobre setembro na série publicada, e o teto é 1,50%. Como
 * as linhas de mediana ficam constantes de setembro a dezembro, a parte que compõe
 * tem de crescer AINDA MAIS que 1,59% — acima do teto, para qualquer massa de
 * mediana. Logo outubro é impossível sem os aumentos específicos daquele mês, e é
 * por isso que eles existem na premissa.
 *
 * Deixar outubro EXATAMENTE no teto resolveria o dinheiro, mas custaria as 591
 * células cortadas do mês e estouraria a contagem publicada. Então o gerador
 * dimensiona a massa dos trios com aumento específico até outubro caber sob o teto
 * com uma folga estreita: 97% do teto vem do cv e 3% dos aumentos específicos.
 *
 * A folga é estreita de propósito. Folga larga pede massa enorme nos três trios —
 * numa tentativa com alvo de 90% o impulso chegou a sessenta vezes, e três linhas
 * passariam a responder por metade do elemento 11. Estreita, ela pede pouco.
 */
const RAZAO_ALVO_OUTUBRO = 0.97;

/** Teto do impulso. Saturar aqui é erro de especificação, não de convergência. */
const IMPULSO_MAXIMO = 14;

/**
 * Resolve níveis, cortes, dispersão, impulso e o viés do 13º.
 *
 * Seis famílias de restrição, e cada passo cuida de uma:
 *
 *   níveis      `aplicaNivel` + `normalizaMeses` — os oito meses realizados, exatos
 *               por escala de coluna.
 *   impulso     a massa dos trios com aumento específico, para outubro caber sob o
 *               teto.
 *   cortes      quantas células de cada mês ficam acima do teto, repartindo a
 *               contagem publicada dentro do limite de cada mês.
 *   dispersão   `w` de cada mês projetado, por bisseção, para fechar o mês.
 *   13º         o viés `ψ` entre quem provisiona e quem não provisiona, DENTRO do
 *               elemento.
 *   elementos   o total de cada elemento no exercício.
 *
 * Os três últimos se perturbam: resolver a dispersão move o total do elemento,
 * ajustar o elemento move o 13º, e corrigir o 13º move a dispersão. Então o laço
 * não termina num passo — ele itera até o ponto fixo, e a conferência interna é
 * quem diz se chegou.
 */
function resolve(linhas, semente, par, opcoes = {}) {
  const cv = montaSorteios(linhas, semente + 7, CONTADORES.mesesLinhaCvVazio);
  const alvoMes = MONETARIOS.meses.map((v) => v * MI);
  const alvoElem = new Map(ELEMENTOS.map((e) => [e.elemento, e.anoSem13 * MI]));
  const iteracoes = opcoes.iteracoes ?? 10;
  const trace = opcoes.trace ? [] : null;

  let impulso = 1;
  let razoes = [1, 1, 1, 1];
  let alocacao = alocaCortes(cv, [1, 1, 1, 1]);
  defineCortes(cv, alocacao.n);

  /** Avalia `f` e devolve níveis e dispersão ao que eram. Para as bisseções. */
  const comEstado = (f) => {
    const nivel = linhas.map((L) => L.nivel);
    const w = [...cv.w];
    const r = f();
    linhas.forEach((L, i) => { L.nivel = nivel[i]; });
    cv.w = w;
    return r;
  };

  const realizados = () => { aplicaNivel(linhas); normalizaMeses(linhas, alvoMes); };

  const fechaMes = (k, passos = 36) => {
    cv.w[k] = bisseca((w) => {
      cv.w[k] = w;
      return totalDoMes(linhas, cv, par, k, null);
    }, 0, 600, alvoMes[8 + k], passos);
  };

  /**
   * Mede as quatro razões, cada uma sobre base correta.
   *
   * A medição é SEQUENCIAL e fecha o mês antes de medir o seguinte. Medir os quatro
   * de uma vez, sobre a dispersão da iteração anterior, foi o que fez a primeira
   * versão abortar: outubro saía meio bilhão acima do alvo, novembro media razão
   * 0,124 e dezembro media razão NEGATIVA, porque já estavam acima do publicado
   * antes de crescer qualquer coisa. A capacidade de corte somava 822 contra as
   * 1.206 células que a consulta publica.
   */
  const mede = () => {
    const r = [];
    for (let k = 0; k < 4; k += 1) {
      r.push(razaoDoMes(linhas, cv, par, k, alvoMes));
      fechaMes(k, 30);
    }
    return r;
  };

  /** Dimensiona a massa dos trios com aumento específico. */
  const passoImpulso = () => {
    const b = bisseca((x) => comEstado(() => {
      for (const L of linhas) if (L.especifica) L.nivel *= x;
      realizados();
      fechaMes(0, 28);
      return razaoDoMes(linhas, cv, par, 1, alvoMes);
    }), 0.25, IMPULSO_MAXIMO, RAZAO_ALVO_OUTUBRO, 28);
    impulso *= b;
    for (const L of linhas) if (L.especifica) L.nivel *= b;
    realizados();
  };

  const recortaCortes = (estrito = false) => {
    razoes = mede();
    alocacao = alocaCortes(cv, razoes, estrito);
    defineCortes(cv, alocacao.n);
    for (let k = 0; k < 4; k += 1) fechaMes(k);
  };

  for (let it = 0; it < iteracoes; it += 1) {
    realizados();
    for (let k = 0; k < 4; k += 1) fechaMes(k, 30);
    passoImpulso();
    recortaCortes();
    const movimento = resolveElementos(
      linhas, cv, par, alvoElem, alvoMes, fechaMes, realizados,
    );
    if (trace) {
      const r = projetaRapido(linhas, cv, par, null);
      trace.push({
        it, movimento, impulso, razoes: [...razoes],
        provisoria: alocacao.provisoria,
        t13: r.t13, dezSem13: r.dezSem13 - alvoMes[11],
        piorElem: piorElemento(linhas, cv, par, alvoElem),
      });
    }
    if (movimento < 1e-13) break;
  }

  // Fecho. A ordem é a inversa da dependência: elemento já ajustado no laço,
  // colunas realizadas depois, que são exatas por escala, e dispersão por último,
  // com mais passos de bisseção, porque é ela que põe os quatro meses projetados na
  // casa do centavo.
  realizados();
  razoes = mede();
  alocacao = alocaCortes(cv, razoes, true);
  defineCortes(cv, alocacao.n);
  for (let k = 0; k < 4; k += 1) fechaMes(k, 56);
  // Os cortes definitivos mudam a repartição de setembro a dezembro entre as
  // linhas, e portanto o exercício de cada elemento. Resolver os elementos ANTES
  // de fixar os cortes deixaria o resíduo que o laço tinha zerado voltar no fim.
  const residuoElemento = resolveElementos(
    linhas, cv, par, alvoElem, alvoMes, fechaMes, realizados, { passos: 8 },
  );
  for (let k = 0; k < 4; k += 1) fechaMes(k, 56);
  aplicaCv(linhas, cv, par.teto);

  return {
    cv, impulso, razoes, alocacao, trace, residuoElemento,
    contagem: contaTeto(linhas, cv, par),
  };
}

/** Bisseta a dispersão de cada mês projetado, na ordem da cadeia. */
function resolveDispersao(linhas, cv, par, alvoMes, passos = 40) {
  for (let k = 0; k < 4; k += 1) {
    cv.w[k] = bisseca((w) => {
      cv.w[k] = w;
      return totalDoMes(linhas, cv, par, k, null);
    }, 0, 600, alvoMes[8 + k], passos);
  }
}

/** Maior distância entre o exercício de um elemento e o alvo publicado dele. */
function piorElemento(linhas, cv, par, alvoElem) {
  const soma = new Map();
  for (const L of linhas) {
    const e = elemento(L.nat);
    soma.set(e, (soma.get(e) ?? 0) + anoDaLinha(L, cv, par));
  }
  let pior = 0;
  for (const [e, alvo] of alvoElem) pior = Math.max(pior, Math.abs((soma.get(e) ?? 0) - alvo));
  return pior;
}

/**
 * Resolve os totais de elemento por NEWTON em dezenove incógnitas.
 *
 * Por que não por escala iterativa, que é o que um IPF faria. Porque não converge:
 * medido, o passo de escala fechava 37% da distância no primeiro passo e 11% nos
 * seguintes, uma contração de 0,89 por passo que precisaria de mais de duzentas
 * iterações para chegar ao centavo. A razão é que as linhas NÃO têm todas a mesma
 * forma mensal — a desligada tem julho e agosto em zero, a de mediana tem agosto
 * fora de escala — e essas formas estão concentradas em elementos específicos. A
 * tabela cruzada de elemento por mês tem estrutura de verdade, e escalar uma
 * margem de cada vez anda devagar justamente por isso.
 *
 * Então resolve-se o sistema. São dezenove incógnitas: um expoente por elemento,
 * multiplicando o nível de todas as linhas dele. A resposta é medida de verdade,
 * rodando a normalização de coluna e a bisseção da dispersão a cada avaliação, de
 * modo que o jacobiano já inclui o efeito de o mês ser recolocado no alvo.
 *
 * Duas sutilezas:
 *
 * 1. O sistema é SINGULAR na direção do deslocamento uniforme. Somar a mesma
 *    constante aos dezenove expoentes multiplica todas as linhas pelo mesmo fator,
 *    a normalização de coluna desfaz, e nada muda. A incógnita do primeiro elemento
 *    fica então fixa em zero, e sobram dezoito — o que também torna a vigésima
 *    equação redundante, resolvida por mínimos quadrados.
 *
 * 2. Trabalha-se em LOGARITMO, dos dois lados. O desvio de um elemento é
 *    `log(obtido/alvo)`, e a incógnita é o log do fator. É o que deixa o problema
 *    quase linear: dobrar o nível dobra o exercício, e em log isso é uma soma.
 */
function resolveElementos(linhas, cv, par, alvoElem, alvoMes, fechaMes, realizados, opcoes = {}) {
  const chaves = [...alvoElem.keys()];
  const n = chaves.length;
  const indice = new Map(chaves.map((e, i) => [e, i]));
  const base = linhas.map((L) => L.nivel);
  const doElemento = linhas.map((L) => indice.get(elemento(L.nat)));

  const desvio = (s) => {
    linhas.forEach((L, i) => { L.nivel = base[i] * Math.exp(s[doElemento[i]]); });
    realizados();
    for (let k = 0; k < 4; k += 1) fechaMes(k, 38);
    const soma = new Array(n).fill(0);
    linhas.forEach((L, i) => { soma[doElemento[i]] += anoDaLinha(L, cv, par); });
    return soma.map((v, i) => Math.log(Math.max(v, 1) / alvoElem.get(chaves[i])));
  };

  let s = new Array(n).fill(0);
  let g = desvio(s);
  const h = 1e-3;

  // Jacobiano UMA vez. O sistema é quase linear em logaritmo — dobrar o nível de um
  // elemento dobra o exercício dele, e em log isso é uma soma — então a matriz
  // medida no ponto de partida serve para todos os passos. Remedir a cada passo
  // custava dezoito avaliações extras por passo e gastava nove segundos por
  // iteração do laço externo para ganhar casas decimais que já estavam fechadas.
  const J = [];
  for (let j = 1; j < n; j += 1) {
    const sj = [...s];
    sj[j] += h;
    const gj = desvio(sj);
    J.push(gj.map((v, i) => (v - g[i]) / h));
  }
  const m = n - 1;

  const norma = (x) => Math.max(...x.map(Math.abs));
  const direcao = (gAtual) => {
    const A = [];
    for (let a = 0; a < m; a += 1) {
      const linha = new Array(m + 1).fill(0);
      for (let b = 0; b < m; b += 1) {
        let v = 0;
        for (let i = 0; i < n; i += 1) v += J[a][i] * J[b][i];
        linha[b] = v;
      }
      let r = 0;
      for (let i = 0; i < n; i += 1) r -= J[a][i] * gAtual[i];
      linha[m] = r;
      A.push(linha);
    }
    return resolveSistema(A, m);
  };

  for (let passo = 0; passo < (opcoes.passos ?? 6) && norma(g) > 1e-13; passo += 1) {
    const d = direcao(g);
    if (!d) break;
    // Busca de passo: aceita o inteiro se melhora, e encurta até melhorar.
    let escala = 1;
    let melhor = null;
    for (let tentativa = 0; tentativa < 7; tentativa += 1) {
      const sn = [...s];
      for (let j = 1; j < n; j += 1) sn[j] += d[j - 1] * escala;
      const gn = desvio(sn);
      if (norma(gn) < norma(g)) { melhor = { sn, gn }; break; }
      escala /= 2;
    }
    if (!melhor) break;
    s = melhor.sn;
    g = melhor.gn;
  }

  desvio(s);
  linhas.forEach((L, i) => { base[i] = L.nivel; });
  return norma(g);
}

/** Eliminação de Gauss com pivotamento parcial. `A` é `m × (m+1)`, aumentada. */
function resolveSistema(A, m) {
  for (let c = 0; c < m; c += 1) {
    let p = c;
    for (let r = c + 1; r < m; r += 1) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-18) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = c + 1; r < m; r += 1) {
      const k = A[r][c] / A[c][c];
      if (k === 0) continue;
      for (let j = c; j <= m; j += 1) A[r][j] -= k * A[c][j];
    }
  }
  const x = new Array(m).fill(0);
  for (let r = m - 1; r >= 0; r -= 1) {
    let v = A[r][m];
    for (let j = r + 1; j < m; j += 1) v -= A[r][j] * x[j];
    x[r] = v / A[r][r];
  }
  return x;
}

/** Soma da forma nos meses em que a linha desligada ainda tem valor. */
function somaParcial(L) {
  return L.forma.slice(0, 6).reduce((a, b) => a + b, 0);
}

/**
 * Gera o conjunto e devolve o modelo mais o relatório de calibração.
 *
 * @param {{semente?:number, iteracoes?:number, trace?:boolean}} [opcoes]
 */
export function geraModelo(opcoes = {}) {
  const semente = opcoes.semente ?? 20260929;
  const par = PARAMETROS_PADRAO;
  const rnd = aleatorio(semente);

  const { linhas, unidades } = montaEstrutura(rnd);
  const { desligadas, baldes, vivas } = escolheDesligadas(linhas);
  for (const L of linhas) L.desligada = desligadas.has(L.id);

  const resolvido = resolve(linhas, semente, par, opcoes);
  const {
    impulso, razoes, alocacao, contagem, residuoElemento,
  } = resolvido;

  // ------------------------------------------------------------- dotação
  // Reparte por Poder segundo os alvos e, dentro do Poder, pela massa projetada
  // de cada linha. É o que produz o quadro de insuficiência: alguns Poderes
  // descobertos, outros com sobra, e a sobra que não pode cobrir a falta alheia.
  // A cobertura varia POR UNIDADE dentro do Poder, e não de modo uniforme. Sem
  // essa dispersão a leitura por unidade repete exatamente a leitura por Poder:
  // todas as unidades de um Poder teriam a mesma razão entre dotação e projeção, e
  // ou todas estariam descobertas ou nenhuma estaria. O painel existe em parte para
  // mostrar que a leitura mais fina revela mais falta que a leitura agregada, e isso
  // exige que a dotação de cada unidade tenha história própria — o que ela tem, na
  // folha de verdade: cada unidade negociou a sua dotação na lei orçamentária.
  const p = projeta2026(linhas, par);
  const sorteio = aleatorio(semente + 991);
  const coberturaDaUo = new Map();
  for (const L of linhas) {
    if (!coberturaDaUo.has(L.uo)) coberturaDaUo.set(L.uo, 0.74 + sorteio() * 0.46);
  }

  const massaPoder = new Map();
  for (const L of linhas) {
    const q = poderDaLinha(L);
    const peso = p.porLinha.get(L.id).ano * coberturaDaUo.get(L.uo);
    massaPoder.set(q, (massaPoder.get(q) ?? 0) + peso);
  }
  for (const L of linhas) {
    const q = poderDaLinha(L);
    const alvo = (DOTACAO_POR_PODER[q] ?? 0) * MI;
    const massa = massaPoder.get(q) ?? 0;
    const peso = p.porLinha.get(L.id).ano * coberturaDaUo.get(L.uo);
    L.atual = massa > 0 ? alvo * (peso / massa) : 0;
  }

  // O marcador é o décimo campo da chave. Ele distingue a linha de mediana da
  // linha comum na mesma natureza: sem ele, duas linhas idênticas em tudo o mais
  // colidiriam, e a chave casaria uma com a outra.
  for (const L of linhas) L.marcador = L.med ? 'MED' : (L.desligada ? 'ENC' : '');

  const modelo = linhas.map(limpa);
  const pFinal = projeta2026(modelo, par);

  return {
    modelo,
    uos: unidades.map((u) => u.uo),
    catalogo: {
      orgaos: Object.fromEntries(ORGAOS.map((o) => [o.codigo, o.nome])),
      unidades: Object.fromEntries(unidades.map((u) => [u.uo, u.nome])),
    },
    arima: emReais(ARIMA),
    oito: {
      unidades: SERIE_8778.unidades,
      dotacao: SERIE_8778.dotacao * MI,
      anos: {
        2023: { meses: SERIE_8778[2023].map((v) => v * MI) },
        2024: { meses: SERIE_8778[2024].map((v) => v * MI) },
        2025: { meses: SERIE_8778[2025].map((v) => v * MI) },
        2026: { meses: SERIE_8778[2026].map((v) => v * MI) },
      },
    },
    origem: {
      sintetico: true,
      consulta: '29/09/2026 13h35',
      semente,
      impulso,
      razoes,
      cortesPorMes: alocacao.n,
      limitePorMes: alocacao.limite,
      residuoElemento,
      dispersao: [...resolvido.cv.w],
      trace: resolvido.trace,
      contagem,
      baldes,
      vivas,
      calibracao: relatorio(modelo, pFinal),
      derivados: derivados(modelo, pFinal),
    },
  };
}

/**
 * Converte o bloco do ARIMA de milhões para REAIS.
 *
 * `alvos.js` escreve em milhões, porque é a casa em que a especificação foi lida e
 * digitá-la em reais seria digitar seis zeros por célula. O sistema inteiro
 * circula em reais, e deixar um bloco em outra escala é exatamente o que faz uma
 * tolerância de um real virar uma tolerância de um milhão. A conversão fica aqui,
 * na fronteira entre a especificação e a carga, e é a única.
 */
function emReais(arima) {
  const especificacoes = {};
  for (const [nome, esp] of Object.entries(arima.especificacoes)) {
    const porGrupo = {};
    for (const [grupo, v] of Object.entries(esp.porGrupo)) {
      porGrupo[grupo] = { total2026: v.total2026 * MI, total2027: v.total2027 * MI };
    }
    especificacoes[nome] = { ...esp, porGrupo };
  }
  return {
    especificacoes,
    backtest: arima.backtest.map((b) => ({
      ...b,
      realizado: b.realizado * MI,
      janela: b.janela * MI,
      inteira: b.inteira * MI,
    })),
  };
}

const CAMPOS_SAIDA = ['id', 'orgao', 'uge', 'ugr', 'uo', 'acao', 'nat', 'fonte',
  'det', 'idex', 'marcador', 'poder', 'atual', 'jan', 'fev', 'mar', 'abr', 'mai',
  'jun', 'jul', 'ago', 'cv_set', 'cv_out', 'cv_nov', 'cv_dez'];

function limpa(L) {
  const saida = {};
  for (const c of CAMPOS_SAIDA) {
    const v = L[c];
    if (typeof v !== 'number') { saida[c] = v ?? ''; continue; }
    // Dinheiro em CENTAVOS, como o SIAFIC. Gravar o flutuante cru faria o JSON
    // carregar dezessete dígitos de ruído por célula e, pior, faria a mesma carga
    // reaberta somar diferente do que somou antes de ser gravada.
    //
    // O cv NÃO passa por aqui: ele já saiu quantizado de `cvDeclarado`, em quatro
    // casas da fração. Arredondá-lo a duas o reduziria a 0,01 ou 0,02, e a régua
    // do teto é 0,015 — bem no meio dos dois.
    saida[c] = CV.includes(c) ? v : Math.round(v * 100) / 100;
  }
  return saida;
}

/**
 * Relatório de calibração: alvo, valor obtido e resíduo de cada um.
 *
 * Só entra aqui o que é ALVO da geração. A provisão do 13º, o exercício de 2026 e
 * o crédito a abrir não são alvos — são o que a regra produz a partir dos alvos, e
 * aparecem no bloco de derivados, sem resíduo, porque não há do que divergir.
 */
function relatorio(modelo, p) {
  const linhas = [];
  const add = (alvo, publicado, obtido, unidade = 'R$ mi') => linhas.push({
    alvo, publicado, obtido, residuo: obtido - publicado, unidade,
  });
  const NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  add('linhas do modelo', CONTADORES.linhas, modelo.length, 'contagem');
  add('unidades do modelo', 77, new Set(modelo.map((L) => L.uo)).size, 'contagem');
  add('órgãos do recorte', 34, new Set(modelo.map((L) => L.orgao)).size, 'contagem');
  add('liquidado jan–ago de 2026',
    MONETARIOS.meses.slice(0, 8).reduce((a, b) => a + b, 0) * MI, p.janAgo);
  add('dotação atualizada', MONETARIOS.dotacao * MI, p.dotacao);
  MONETARIOS.meses.forEach((v, i) => {
    // Dezembro é comparado SEM a provisão: é o alvo que o gerador persegue.
    add(`mês de 2026 · ${NOMES[i]}`, v * MI, i === 11 ? p.dezSem13 : p.meses[i]);
  });
  add('memória · desligadas', CONTADORES.desligadas, p.memoria.desligadas, 'contagem');
  add('memória · mediana viva', CONTADORES.medianaViva, p.memoria.mediana, 'contagem');
  add('memória · composição', 1023 - CONTADORES.desligadas - CONTADORES.medianaViva,
    p.memoria.composicao, 'contagem');
  add('memória · linhas com 13º', CONTADORES.com13Vivo, p.memoria.linhasCom13, 'contagem');
  add('memória · meses-linha em que o teto mordeu',
    CONTADORES.mesesLinhaTeto, p.memoria.mesesLinhaTeto, 'contagem');
  add('memória · meses-linha com cv vazio',
    CONTADORES.mesesLinhaCvVazio, p.memoria.mesesLinhaCvVazio, 'contagem');
  for (const e of ELEMENTOS) {
    const doElemento = modelo.filter((L) => elemento(L.nat) === e.elemento);
    add(`elemento ${String(e.elemento).padStart(2, '0')} · exercício sem 13º`,
      e.anoSem13 * MI,
      doElemento.reduce((a, L) => a + p.porLinha.get(L.id).anoSem13, 0));
    add(`elemento ${String(e.elemento).padStart(2, '0')} · linhas`,
      e.linhas, doElemento.length, 'contagem');
  }
  return linhas;
}

/**
 * O que a regra PRODUZ a partir dos alvos. Não há resíduo: é publicação.
 *
 * É daqui que saem os números que `publicado.js` congela — a provisão do 13º, o
 * dezembro cheio, o exercício, o crédito a abrir e a abertura por elemento com a
 * provisão dentro. Gerar e publicar nesta ordem é o que impede que a abertura por
 * elemento deixe de somar o total, que foi o defeito do quadro 28 da consulta.
 */
function derivados(modelo, p) {
  const porElemento = {};
  for (const e of ELEMENTOS) {
    const doElemento = modelo.filter((L) => elemento(L.nat) === e.elemento);
    porElemento[e.elemento] = {
      ano: doElemento.reduce((a, L) => a + p.porLinha.get(L.id).ano, 0),
      t13: doElemento.reduce((a, L) => a + p.porLinha.get(L.id).t13, 0),
      linhas: doElemento.length,
    };
  }
  return {
    meses: [...p.meses],
    ano: p.ano,
    t13: p.t13,
    dezSem13: p.dezSem13,
    janAgo: p.janAgo,
    dotacao: p.dotacao,
    insuficiencia: p.insuficiencia,
    memoria: { ...p.memoria },
    porElemento,
  };
}
