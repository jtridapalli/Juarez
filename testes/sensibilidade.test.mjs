import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PARAMETROS_PADRAO } from '../nucleo/regras.js';
import { CASOS, curva, sensibilidade } from '../nucleo/sensibilidade.js';

const base = JSON.parse(readFileSync(new URL('../dados/modelo.json', import.meta.url), 'utf8'));
const linhas = base.modelo;
const s = sensibilidade(linhas, PARAMETROS_PADRAO);
const caso = (chave) => s.casos.find((c) => c.chave === chave);

test('todos os casos publicados são medidos', () => {
  assert.equal(s.casos.length, CASOS.length);
  assert.ok(s.casos.length >= 9);
  for (const c of s.casos) {
    assert.equal(typeof c.proj2026, 'number');
    assert.equal(typeof c.proj2027, 'number');
    assert.ok(Number.isFinite(c.d2026));
    assert.ok(Number.isFinite(c.d2027));
  }
});

test('a base da sensibilidade é a projeção publicada', () => {
  assert.ok(Math.abs(s.base.proj2026 - 47_392.7e6) < 50_000);
  assert.ok(Math.abs(s.base.proj2027 - 50_307.7e6) < 50_000);
});

test('meio ponto de teto a mais custa, e a meio ponto a menos economiza', () => {
  assert.ok(caso('teto+').d2026 > 0);
  assert.ok(caso('teto-').d2026 < 0);
});

test('o custo por ponto é positivo nas duas direções do teto', () => {
  // `porPonto` divide pela perturbação COM SINAL. Um custo por ponto negativo na
  // redução significaria que reduzir o teto aumenta a despesa.
  assert.ok(caso('teto+').porPonto2026 > 0);
  assert.ok(caso('teto-').porPonto2026 > 0);
});

test('o reajuste geral declarado é premissa DORMENTE', () => {
  // Um ponto a mais num reajuste que vigora em mês já realizado não custa nada.
  const c = caso('reajuste+');
  assert.ok(Math.abs(c.d2026) < 1, `custou ${c.d2026}`);
  assert.ok(Math.abs(c.d2027) < 1);
});

test('deslocar a vigência revela o custo que a dormência esconde', () => {
  // A premissa custa zero onde está declarada e centenas de milhões no primeiro mês
  // em aberto. É a diferença entre as duas medidas que torna a dormência um número.
  const c = caso('mesReajuste');
  assert.ok(Math.abs(caso('reajuste+').d2026) < 1);
  assert.ok(c.d2026 > 3e8, `deslocar a vigência custou ${c.d2026}`);
  assert.ok(c.d2026 < 1e9);
  assert.equal(c.pontos, null, 'não é taxa: não tem custo por ponto');
  assert.equal(c.porPonto2026, null);
});

test('premissa de 2026 arrasta 2027', () => {
  // É a consequência de D2, e medir o efeito só no exercício corrente subestima a
  // decisão. O teto de 2026 desloca os doze meses de 2027 inteiros.
  const c = caso('teto+');
  assert.equal(c.arrasta, true);
  assert.ok(c.d2027 > c.d2026, 'doze meses sentem mais que quatro');
});

test('o fator do 13º de 2026 NÃO arrasta 2027', () => {
  // Porque D2 ancora no dezembro SEM a provisão. Se arrastasse, a âncora estaria
  // sendo lida com o 13º dentro.
  const c = caso('fator13');
  assert.ok(Math.abs(c.d2026) > 1e8, 'ele move 2026');
  assert.ok(Math.abs(c.d2027) < 1, `moveu 2027 em ${c.d2027}`);
  assert.equal(c.arrasta, false);
});

test('efeito nulo não é escrito com sinal de menos', () => {
  // O zero negativo do IEEE 754 nasce de dividir zero por perturbação negativa.
  const c = caso('fator13');
  assert.ok(!Object.is(c.porPonto2027, -0), 'zero negativo vazaria para a tela');
});

test('o vegetativo de 2027 não move 2026', () => {
  for (const chave of ['vegAtivo27', 'vegInativo27', 'nominal27']) {
    const c = caso(chave);
    assert.ok(Math.abs(c.d2026) < 1, `${chave} moveu 2026 em ${c.d2026}`);
    assert.ok(c.d2027 > 0, `${chave} não moveu 2027`);
  }
});

test('meio ponto nos ativos custa mais que meio ponto nos inativos', () => {
  // A massa de ativos é maior, e é essa a informação que a tabela existe para dar.
  assert.ok(caso('vegAtivo27').d2027 > caso('vegInativo27').d2027);
});

test('a leitura literal de D6 é o caso mais caro da tabela', () => {
  const d6 = caso('modoD6');
  assert.ok(d6.d2027 > 3e9, `a distância entre as duas leituras é ${d6.d2027}`);
  // E ela é maior que o crédito a abrir do exercício corrente.
  assert.ok(d6.d2027 > s.base.credito);
  for (const c of s.casos) {
    if (c.chave !== 'modoD6') assert.ok(c.d2027 <= d6.d2027, `${c.chave} é maior`);
  }
});

test('o crédito a abrir se move junto com a projeção de 2026', () => {
  const c = caso('teto+');
  assert.ok(Math.abs(c.dCredito - c.d2026) < 1, 'a dotação não muda com a premissa');
});

test('o caso não altera as premissas de referência', () => {
  // `aplica` recebe uma cópia. Se mutasse o original, o segundo caso mediria em
  // cima do primeiro e a tabela inteira sairia errada.
  assert.equal(PARAMETROS_PADRAO.teto, 0.015);
  assert.equal(PARAMETROS_PADRAO.modoD6, 'ano');
  const outra = sensibilidade(linhas, PARAMETROS_PADRAO);
  assert.equal(outra.base.proj2026, s.base.proj2026);
});

test('a curva do teto é monótona e tem joelho', () => {
  // Cada linha só sente o teto a partir do ponto em que ele corta o histórico dela,
  // e por isso a resposta do exercício NÃO é linear.
  const c = curva(linhas, PARAMETROS_PADRAO, {
    campo: 'teto',
    valores: [0, 0.005, 0.01, 0.015, 0.02, 0.03, 0.05, 0.10],
  });
  assert.equal(c.length, 8);
  for (let i = 1; i < c.length; i += 1) {
    assert.ok(c[i].proj2026 >= c[i - 1].proj2026 - 1, 'a curva não pode descer');
  }
  const inclinacao = (i) => (c[i].proj2026 - c[i - 1].proj2026) / (c[i].valor - c[i - 1].valor);
  // A inclinação cai: no fim da faixa quase toda linha já está no teto, e subi-lo
  // mais deixa de alcançar linha nova.
  assert.ok(inclinacao(7) < inclinacao(1), 'sem joelho a curva seria uma reta');
});

test('um recorte vazio não quebra a sensibilidade', () => {
  const vazia = sensibilidade([], PARAMETROS_PADRAO);
  assert.equal(vazia.base.proj2026, 0);
  for (const c of vazia.casos) {
    assert.equal(c.d2026, 0);
    assert.equal(c.relativo2026, null, 'divisão por zero não vira número');
  }
});
