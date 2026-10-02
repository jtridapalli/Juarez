import test from 'node:test';
import assert from 'node:assert/strict';

import { PARAMETROS_PADRAO } from '../nucleo/regras.js';
import { fdLinha, projeta2026 } from '../nucleo/projecao2026.js';

const par = PARAMETROS_PADRAO;

/**
 * Linha de teste: oito meses iguais e cv declarado em cada mês projetado.
 *
 * O trio de órgão, unidade e natureza é DELIBERADAMENTE neutro. Os quatro aumentos
 * específicos das premissas publicadas são amarrados a trios reais, e usar um deles
 * como fixture faz outubro crescer 3,50% a mais sem que o teste o diga — o teste
 * passaria a medir a premissa em vez de medir a regra.
 */
const TRIO_NEUTRO = { orgao: 20, uo: 2001 };

function linha(extra = {}) {
  return {
    id: 1, ...TRIO_NEUTRO, nat: 319011, atual: 1200,
    jan: 100, fev: 100, mar: 100, abr: 100, mai: 100, jun: 100, jul: 100, ago: 100,
    cv_set: 0, cv_out: 0, cv_nov: 0, cv_dez: 0,
    ...extra,
  };
}

const perto = (a, b, tol = 1e-9) => assert.ok(
  Math.abs(a - b) <= tol, `${a} não está a ${tol} de ${b}`,
);

test('composição incide sobre o mês anterior projetado, não sobre agosto', () => {
  const L = linha({ cv_set: 0.01, cv_out: 0.01, cv_nov: 0.01, cv_dez: 0.01 });
  const r = fdLinha(L, par);
  assert.equal(r.ramo, 'composicao');
  perto(r.meses[8], 101);
  perto(r.meses[9], 101 * 1.01);
  perto(r.meses[10], 101 * 1.01 * 1.01);
  // Se o fator incidisse sobre agosto repetido, dezembro valeria 101 e não 104,06.
  perto(r.dezSem13, 100 * 1.01 ** 4);
});

test('o teto corta o cv declarado, e não o fator composto', () => {
  const L = linha({ cv_set: 0.09, cv_out: 0.09, cv_nov: 0.09, cv_dez: 0.09 });
  const r = fdLinha(L, par);
  perto(r.dezSem13, 100 * 1.015 ** 4);
  for (const d of r.detalhe) {
    assert.equal(d.cv, 0.015);
    assert.equal(d.cvDeclarado, 0.09);
    assert.equal(d.corta, true);
  }
});

test('célula de cv em branco vira 9,99 e o teto a corta', () => {
  const vazia = fdLinha(linha({ cv_set: '', cv_out: '', cv_nov: '', cv_dez: '' }), par);
  const cheia = fdLinha(linha({
    cv_set: 0.015, cv_out: 0.015, cv_nov: 0.015, cv_dez: 0.015,
  }), par);
  perto(vazia.dezSem13, cheia.dezSem13);
  assert.equal(vazia.detalhe.every((d) => d.vazio), true);
  assert.equal(cheia.detalhe.every((d) => d.vazio), false);
});

test('zero declarado mantém a linha parada', () => {
  const r = fdLinha(linha(), par);
  perto(r.dezSem13, 100);
  assert.equal(r.detalhe.every((d) => d.corta === false), true);
});

test('regra 5.1 · linha desligada zera os quatro meses projetados', () => {
  const r = fdLinha(linha({ jul: 0, ago: 0, cv_set: 0.01 }), par);
  assert.equal(r.ramo, 'desligada');
  assert.deepEqual(r.meses.slice(8), [0, 0, 0, 0]);
  assert.equal(r.t13, 0, 'sem dezembro não há 13º');
  // Jan–jun continuam no exercício: desligar a linha não a apaga do realizado.
  perto(r.ano, 600);
  perto(r.janAgo, 600);
});

test('regra 5.1 vence a regra 5.2: desligada de natureza de mediana vai a zero', () => {
  const r = fdLinha(linha({ nat: 319016, jul: 0, ago: 0 }), par);
  assert.equal(r.ramo, 'desligada');
  assert.deepEqual(r.meses.slice(8), [0, 0, 0, 0]);
});

test('regra 5.2 · mediana de jan–ago em cada mês projetado, e o cv é ignorado', () => {
  const L = linha({
    nat: 319016, jan: 10, fev: 20, mar: 30, abr: 40, mai: 50, jun: 60, jul: 70, ago: 400,
    cv_set: 0.09,
  });
  const r = fdLinha(L, par);
  assert.equal(r.ramo, 'mediana');
  // mediana de [10,20,30,40,50,60,70,400] = (40+50)/2 = 45
  for (let i = 8; i < 12; i += 1) {
    perto(r.meses[i] - (i === 11 ? r.t13 : 0), 45);
  }
  assert.equal(r.detalhe[0].cv, null, 'a mediana não aplica cv');
});

test('a mediana pode DERRUBAR a linha em setembro', () => {
  // É o mecanismo que faz setembro ficar abaixo de agosto no total do Estado, num
  // modelo em que a composição da regra 5.3 só cresce.
  const r = fdLinha(linha({
    nat: 319094, jan: 10, fev: 10, mar: 10, abr: 10, mai: 10, jun: 10, jul: 10, ago: 500,
  }), par);
  assert.ok(r.meses[8] < r.meses[7], 'setembro abaixo de agosto');
  perto(r.meses[8], 10);
});

test('regra 5.5 · o 13º fica dentro de dezembro', () => {
  const r = fdLinha(linha({ cv_set: 0, cv_out: 0, cv_nov: 0, cv_dez: 0 }), par);
  perto(r.t13, 100);
  perto(r.dezSem13, 100);
  perto(r.meses[11], 200, 1e-9);
  // Doze meses de 100 mais a provisão de 100: o exercício é 1.300, e sem ela 1.200.
  perto(r.ano, 1300);
  perto(r.anoSem13, 1200);
});

test('natureza que não provisiona não recebe 13º', () => {
  const r = fdLinha(linha({ nat: 319001 }), par);
  assert.equal(r.t13, 0);
  perto(r.meses[11], 100);
  perto(r.ano, r.anoSem13);
});

test('o reajuste geral declarado não alcança mês projetado', () => {
  const com = fdLinha(linha(), par);
  const sem = fdLinha(linha(), { ...par, reajuste: 0 });
  perto(com.ano, sem.ano, 1e-9);
  assert.equal(com.detalhe.every((d) => d.reajuste === 0), true);
});

test('deslocado para setembro, o reajuste passa a custar', () => {
  const base = fdLinha(linha(), par);
  const movido = fdLinha(linha(), { ...par, mesReajuste: 9 });
  assert.ok(movido.ano > base.ano);
  // Setembro leva o reajuste, e os três meses seguintes o herdam pela cadeia.
  perto(movido.meses[8], 105);
  perto(movido.meses[9], 105);
  assert.equal(movido.detalhe[0].reajuste, 0.05);
  assert.equal(movido.detalhe[1].reajuste, 0, 'a vigência é de um mês, o efeito é permanente');
});

test('reajuste e específico se compõem por produto, não por soma', () => {
  const L = linha({ cv_set: 0.015 });
  const r = fdLinha(L, {
    ...par,
    mesReajuste: 9,
    especificos: [{ orgao: 20, uo: 2001, nat: 319011, mes: 9, taxa: 0.035 }],
  });
  perto(r.meses[8], 100 * 1.015 * 1.05 * 1.035);
  // A soma dos três daria 1,10 e o produto dá 1,1033: a diferença é real.
  assert.ok(r.meses[8] > 100 * 1.10);
});

test('o específico de agosto não alcança a projeção', () => {
  const L = linha();
  const r = fdLinha(L, {
    ...par,
    especificos: [{ orgao: 20, uo: 2001, nat: 319011, mes: 8, taxa: 0.022 }],
  });
  perto(r.dezSem13, 100);
  assert.equal(r.detalhe.every((d) => d.especifico === 0), true);
});

test('o agregado do exercício é a soma dos agregados das linhas', () => {
  const linhas = [
    linha({ id: 1 }),
    linha({ id: 2, nat: 319016, ago: 300 }),
    linha({ id: 3, jul: 0, ago: 0 }),
    linha({ id: 4, nat: 319001, cv_set: 0.09 }),
  ];
  const p = projeta2026(linhas, par);
  const somaLinhas = linhas.reduce((a, L) => a + p.porLinha.get(L.id).ano, 0);
  perto(p.ano, somaLinhas, 1e-6);
  perto(p.ano, p.meses.reduce((a, b) => a + b, 0), 1e-6);
  perto(p.ano, p.janAgo + p.setDez, 1e-6);
  perto(p.meses[11], p.dezSem13 + p.t13, 1e-6);
});

test('os ramos particionam as linhas', () => {
  const linhas = [
    linha({ id: 1 }),
    linha({ id: 2, nat: 319016 }),
    linha({ id: 3, jul: 0, ago: 0 }),
  ];
  const p = projeta2026(linhas, par);
  assert.equal(p.memoria.desligadas, 1);
  assert.equal(p.memoria.mediana, 1);
  assert.equal(p.memoria.composicao, 1);
  assert.equal(
    p.memoria.desligadas + p.memoria.mediana + p.memoria.composicao,
    linhas.length,
  );
});

test('premissa declarada e premissa aplicada são contadores diferentes', () => {
  const linhas = [linha({ id: 1 }), linha({ id: 2 })];
  const p = projeta2026(linhas, {
    ...par,
    especificos: [
      { orgao: 20, uo: 2001, nat: 319011, mes: 10, taxa: 0.03 },
      { orgao: 20, uo: 2001, nat: 319011, mes: 8, taxa: 0.02 },
      { orgao: 99, uo: 9901, nat: 319011, mes: 10, taxa: 0.05 },
    ],
  });
  // Três declaradas: uma não tem linha no trio e não conta; uma vigora em agosto e
  // conta como declarada mas não como aplicada.
  assert.equal(p.memoria.especificosDeclarados, 2);
  assert.equal(p.memoria.especificosAplicados, 1);
  // DUAS linhas no mesmo trio: o alcance é de dois meses-linha, não de um.
  assert.equal(p.memoria.mesesLinhaEspecifico, 2);
});

test('o contador de teto é por mês-linha', () => {
  const p = projeta2026([
    linha({ id: 1, cv_set: 0.09, cv_out: 0.09, cv_nov: 0, cv_dez: 0 }),
    linha({ id: 2, cv_set: '', cv_out: 0, cv_nov: 0, cv_dez: 0 }),
  ], par);
  assert.equal(p.memoria.mesesLinhaTeto, 3, 'dois cortes declarados mais um branco');
  assert.equal(p.memoria.mesesLinhaCvVazio, 1);
  assert.equal(p.memoria.mesesLinhaProjetados, 8);
});

test('a dotação vem da coluna de orçamento atualizado, não da projeção', () => {
  const p = projeta2026([linha({ atual: 5000 })], par);
  assert.equal(p.dotacao, 5000);
  perto(p.insuficiencia, p.ano - 5000, 1e-9);
});

test('conjunto vazio devolve zeros e não quebra', () => {
  const p = projeta2026([], par);
  assert.equal(p.ano, 0);
  assert.equal(p.memoria.linhas, 0);
  assert.deepEqual(p.meses, new Array(12).fill(0));
});

test('aumentar o teto nunca reduz o exercício', () => {
  const linhas = [
    linha({ id: 1, cv_set: 0.002, cv_out: 0.02, cv_nov: '', cv_dez: 0.01 }),
    linha({ id: 2, nat: 319012, cv_set: 0.05, cv_out: 0, cv_nov: 0.03, cv_dez: '' }),
  ];
  let anterior = -Infinity;
  for (const teto of [0, 0.005, 0.01, 0.015, 0.02, 0.05]) {
    const p = projeta2026(linhas, { ...par, teto });
    assert.ok(p.ano >= anterior - 1e-9, `teto ${teto} reduziu o exercício`);
    anterior = p.ano;
  }
});
