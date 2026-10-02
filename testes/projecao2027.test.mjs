import test from 'node:test';
import assert from 'node:assert/strict';

import { PARAMETROS_PADRAO } from '../nucleo/regras.js';
import { projeta2026 } from '../nucleo/projecao2026.js';
import {
  cadeiaDaLinha, composicao2027, decompoeCrescimento2027, fatorD6, fd2027Linha,
  projeta2027,
} from '../nucleo/projecao2027.js';

const par = PARAMETROS_PADRAO;
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

/** Projeta uma linha pelos dois exercícios. */
function dobro(L, p = par) {
  const p26 = projeta2026([L], p);
  const p27 = projeta2027([L], p, p26);
  return { p26, p27, r26: p26.porLinha.get(L.id), r27: p27.porLinha.get(L.id) };
}

test('D6 · lido ao ano, o fator do mês k é (1+v)^(k/12)', () => {
  perto(fatorD6(0.015, 12, 'ano'), 1.015);
  perto(fatorD6(0.015, 6, 'ano'), 1.015 ** 0.5);
  perto(fatorD6(0.015, 1, 'ano'), 1.015 ** (1 / 12));
});

test('D6 · lido ao mês, o mesmo enunciado compõe 19,56% no ano', () => {
  perto(fatorD6(0.015, 12, 'mes'), 1.015 ** 12);
  assert.ok(Math.abs(1.015 ** 12 - 1 - 0.1956) < 0.0001);
});

test('D2 · a âncora é dezembro sem a provisão do 13º', () => {
  const { r26, r27 } = dobro(linha());
  perto(r26.meses[11], 200);
  perto(r26.dezSem13, 100);
  perto(r27.ancora, 100);
  // Ancorar no dezembro publicado dobraria 2027 inteiro.
  assert.ok(r27.meses[0] < 150);
});

test('D3 · janeiro de 2027 é a âncora vezes o fator do mês 1', () => {
  const { r27 } = dobro(linha());
  perto(r27.meses[0], 100 * fatorD6(0.015, 1, 'ano'));
  for (let k = 1; k <= 12; k += 1) {
    perto(r27.meses[k - 1], 100 * fatorD6(0.015, k, 'ano'));
  }
});

test('D6 · inativo cresce a 0,50% e ativo a 1,50%', () => {
  const ativo = dobro(linha({ nat: 319011 }));
  const inativo = dobro(linha({ nat: 319001 }));
  assert.equal(ativo.r27.classe, 'ativo');
  assert.equal(inativo.r27.classe, 'inativo');
  perto(ativo.r27.fatores[11], 1.015);
  perto(inativo.r27.fatores[11], 1.005);
});

test('D6 · órgão de RPPS é inativo mesmo em natureza de vencimento', () => {
  const { r27 } = dobro(linha({ orgao: 87, uo: 8701, nat: 319011 }));
  assert.equal(r27.inativo, true);
  assert.equal(r27.classe, 'inativo');
  perto(r27.fatores[11], 1.005);
});

test('D4 · cada mês de 2027 vale a média de 2026 e o ano vale × 12', () => {
  const { r26, r27 } = dobro(linha({ nat: 319092 }));
  assert.equal(r27.classe, 'd4');
  const media = r26.ano / 12;
  for (const m of r27.meses) perto(m, media);
  perto(r27.ano, media * 12);
  perto(r27.ano, r26.ano, 1e-9);
  assert.equal(r27.t13, 0, 'a cesta D4 não provisiona 13º');
});

test('D4 vence D6: nenhum fator de vegetativo alcança a cesta', () => {
  const normal = dobro(linha({ nat: 319092 }));
  const dobrado = dobro(linha({ nat: 319092 }), {
    ...par, vegetativoAtivo27: 0.10, vegetativoInativo27: 0.10,
  });
  perto(normal.r27.ano, dobrado.r27.ano, 1e-9);
  assert.deepEqual(normal.r27.fatores, new Array(12).fill(1));
});

test('D5 · o 13º de 2027 é 90% de dezembro para ativo e 95% para inativo', () => {
  const ativo = dobro(linha({ nat: 319011 }));
  perto(ativo.r27.t13, ativo.r27.meses[11] * 0.90);

  // A natureza tem de provisionar 13º E ser de inativo: 319113 é intraorçamentária
  // de obrigação patronal, está na lista do 13º, e no RPPS vira inativa.
  const inativo = dobro(linha({ orgao: 88, uo: 8801, nat: 319113 }));
  assert.equal(inativo.r27.inativo, true);
  perto(inativo.r27.t13, inativo.r27.meses[11] * 0.95);
});

test('aposentadoria e pensão não provisionam 13º em 2027', () => {
  for (const nat of [319001, 319003]) {
    const { r27 } = dobro(linha({ nat }));
    assert.equal(r27.t13, 0, `natureza ${nat}`);
    perto(r27.ano, r27.anoSem13);
  }
});

test('o 13º de 2027 entra dentro de dezembro na série publicada', () => {
  const { p27 } = dobro(linha());
  perto(p27.mesesPublicados[11], p27.meses[11] + p27.t13, 1e-9);
  perto(p27.ano, p27.mesesPublicados.reduce((a, b) => a + b, 0), 1e-9);
  perto(p27.ano, p27.anoSem13 + p27.t13, 1e-9);
});

test('D1 · linha desligada continua no exercício de 2027 valendo zero', () => {
  // Ela NÃO sai do conjunto. Tirá-la mudaria o denominador de toda contagem.
  const { r26, r27, p27 } = dobro(linha({ jul: 0, ago: 0 }));
  assert.equal(r26.ramo, 'desligada');
  perto(r27.ancora, 0);
  perto(r27.ano, 0);
  assert.equal(p27.memoria.linhas, 1);
  assert.equal(p27.memoria.desligadas, 1);
  assert.equal(p27.memoria.vivas, 0);
});

test('as classes de 2027 particionam as linhas', () => {
  const linhas = [
    linha({ id: 1, nat: 319011 }),
    linha({ id: 2, nat: 319001 }),
    linha({ id: 3, nat: 319092 }),
    linha({ id: 4, nat: 319011, jul: 0, ago: 0 }),
  ];
  const p26 = projeta2026(linhas, par);
  const p27 = projeta2027(linhas, par, p26);
  assert.equal(p27.memoria.ativo + p27.memoria.inativo + p27.memoria.d4, linhas.length);
  assert.equal(p27.memoria.vivas + p27.memoria.desligadas, linhas.length);
  assert.equal(p27.memoria.vivas, 3, 'o denominador das vivas não é o do modelo');
});

test('as cestas somam o exercício de 2027', () => {
  const linhas = [
    linha({ id: 1, nat: 319011 }),
    linha({ id: 2, nat: 319001 }),
    linha({ id: 3, nat: 319094 }),
  ];
  const p26 = projeta2026(linhas, par);
  const p27 = projeta2027(linhas, par, p26);
  const soma = ['ativo', 'inativo', 'd4'].reduce((a, c) => a
    + p27.porCesta[c].reduce((x, y) => x + y, 0) + p27.t13PorCesta[c], 0);
  perto(p27.ano, soma, 1e-9);

  const comp = composicao2027(p27);
  perto(comp.exercicio.total, p27.ano, 1e-9);
  assert.equal(comp.linhasMes.length, 12);
  perto(comp.linhasMes[11].total, p27.mesesPublicados[11], 1e-9);
});

test('D7 nasce em zero e não contamina nenhum número publicado', () => {
  const sem = dobro(linha());
  const com = dobro(linha(), { ...par, aumentoNominal27: 0.05 });
  assert.equal(par.aumentoNominal27, 0);
  assert.ok(com.r27.ano > sem.r27.ano);
  perto(com.r27.ano / sem.r27.ano, 1.05, 1e-9);
});

test('D7 só alcança as naturezas do reajuste', () => {
  const alcancada = dobro(linha({ nat: 319011 }), { ...par, aumentoNominal27: 0.05 });
  const fora = dobro(linha({ nat: 319001 }), { ...par, aumentoNominal27: 0.05 });
  const foraSem = dobro(linha({ nat: 319001 }));
  perto(fora.r27.ano, foraSem.r27.ano, 1e-9);
  assert.ok(alcancada.r27.ano > 0);
});

test('D7 respeita o mês de vigência', () => {
  const { r27 } = dobro(linha(), { ...par, aumentoNominal27: 0.05, mesNominal27: 7 });
  perto(r27.fatores[5], fatorD6(0.015, 6, 'ano'), 1e-12);
  perto(r27.fatores[6], fatorD6(0.015, 7, 'ano') * 1.05, 1e-12);
});

test('premissa de 2026 arrasta 2027 pela âncora de D2', () => {
  // É a consequência de D2 que a sensibilidade publica: mexer no teto de 2026
  // desloca os doze meses de 2027 inteiros.
  const baixo = dobro(linha({ cv_set: 0.09, cv_out: 0.09, cv_nov: 0.09, cv_dez: 0.09 }),
    { ...par, teto: 0.005 });
  const alto = dobro(linha({ cv_set: 0.09, cv_out: 0.09, cv_nov: 0.09, cv_dez: 0.09 }),
    { ...par, teto: 0.02 });
  assert.ok(alto.r27.ano > baixo.r27.ano);
  assert.ok(alto.p26.ano > baixo.p26.ano);
});

test('a decomposição do crescimento de 2027 fecha', () => {
  const linhas = [
    linha({ id: 1, nat: 319011, cv_set: 0.01 }),
    linha({ id: 2, nat: 319001 }),
    linha({ id: 3, nat: 319092 }),
  ];
  const p26 = projeta2026(linhas, par);
  const p27 = projeta2027(linhas, par, p26);
  const d = decompoeCrescimento2027(linhas, par, p26, p27);
  perto(d.total, p27.ano - p26.ano, 1e-9);
  perto(d.efeitoBase + d.vegetativo + d.nominal, d.total, 1e-9);
  perto(d.parcelaEfeitoBase + d.parcelaVegetativo + d.parcelaNominal, 1, 1e-12);
  assert.equal(d.nominal, 0, 'D7 em zero não contribui');
});

test('o efeito-base existe mesmo com vegetativo zerado', () => {
  // É o ponto do achado: o crescimento vem de ancorar em dezembro, não da taxa.
  const linhas = [linha({ cv_set: 0.015, cv_out: 0.015, cv_nov: 0.015, cv_dez: 0.015 })];
  const p = { ...par, vegetativoAtivo27: 0, vegetativoInativo27: 0 };
  const p26 = projeta2026(linhas, p);
  const p27 = projeta2027(linhas, p, p26);
  const d = decompoeCrescimento2027(linhas, p, p26, p27);
  assert.ok(d.efeitoBase > 0);
  perto(d.vegetativo, 0, 1e-9);
  perto(d.efeitoBase, d.total, 1e-9);
});

test('a cadeia da linha cobre agosto de 2026 a dezembro de 2027', () => {
  const L = linha();
  const { r26, r27 } = dobro(L);
  const passos = cadeiaDaLinha(L, par, r26, r27);
  // 1 agosto + 4 de 2026 + 13º + âncora + 12 de 2027 + 13º + exercício = 21
  assert.equal(passos.length, 21);
  assert.match(passos[0].rotulo, /Agosto de 2026/);
  perto(passos[0].valor, 100);
  const ancora = passos.find((x) => /D2/.test(x.rotulo));
  perto(ancora.valor, r26.dezSem13);
  assert.equal(passos.at(-1).valor, r27.ano);
});

test('projeta2027 exige o resultado de 2026', () => {
  assert.throws(() => projeta2027([linha()], par, null), /exige o resultado de 2026/);
});

test('a leitura literal de D6 custa mais que a anual', () => {
  const linhas = [linha({ id: 1 }), linha({ id: 2, nat: 319001 })];
  const p26 = projeta2026(linhas, par);
  const anual = projeta2027(linhas, par, p26);
  const mensal = projeta2027(linhas, { ...par, modoD6: 'mes' }, p26);
  assert.ok(mensal.ano > anual.ano);
  // A distância entre as duas leituras do MESMO enunciado é material.
  assert.ok(mensal.ano / anual.ano > 1.05);
});
