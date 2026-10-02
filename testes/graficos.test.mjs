import test from 'node:test';
import assert from 'node:assert/strict';

import { marcasDeValor, passoBonito } from '../publico/ui/graficos.js';

test('o passo do eixo é sempre um número redondo', () => {
  for (const faixa of [1, 7, 93, 480, 6000, 47_392.7, 1e9, 5.5e10]) {
    const p = passoBonito(faixa);
    const mantissa = p / 10 ** Math.floor(Math.log10(p));
    assert.ok(
      [1, 1.5, 2, 2.5, 3, 4, 5, 10].some((m) => Math.abs(mantissa - m) < 1e-9),
      `faixa ${faixa} deu passo ${p} (mantissa ${mantissa})`,
    );
  }
});

test('faixa de 0 a 6.000 recebe passo que lê bem', () => {
  // Sem 1,5 e 2,5 na lista, a escolha fica entre seis marcas de 1.000 e duas de
  // 5.000, e nenhuma das duas lê bem.
  const p = passoBonito(6000);
  const n = Math.ceil(6000 / p - 1e-9);
  assert.ok(n >= 3 && n <= 6, `${n} marcas com passo ${p}`);
});

test('faixa não positiva não quebra nem devolve zero', () => {
  for (const faixa of [0, -5, NaN, undefined]) {
    assert.equal(passoBonito(faixa), 1);
  }
});

test('o número de marcas fica perto do alvo em qualquer ordem de grandeza', () => {
  for (const max of [3, 48, 517, 4040.7, 47_392.7, 5.0e10, 1.2345e12]) {
    const { marcas } = marcasDeValor(max);
    // A primeira marca é sempre zero: gráfico de dinheiro não corta a base.
    assert.equal(marcas[0], 0);
    assert.ok(marcas.length >= 3 && marcas.length <= 8, `${max} deu ${marcas.length} marcas`);
  }
});

test('o topo cobre o máximo, e por pouco', () => {
  for (const max of [1, 3, 48, 517, 4040.7, 47_392.7, 5.0e10]) {
    const { topo, marcas } = marcasDeValor(max);
    assert.ok(topo >= max, `topo ${topo} abaixo do máximo ${max}`);
    assert.equal(marcas.at(-1), topo);
    const passo = marcas[1] - marcas[0];
    assert.ok(topo - max < passo, `topo ${topo} sobra mais que um passo sobre ${max}`);
  }
});

test('máximo múltiplo exato do passo NÃO ganha marca sobrando no topo', () => {
  // É o caso comum, porque o máximo costuma ser redondo. Sem a folga de 1e-9 no
  // arredondamento, `Math.ceil` devolve um inteiro a mais e o desenho ganha uma
  // marca fora da área útil.
  for (const max of [1000, 5000, 20_000, 50_000, 1e6, 2.5e9]) {
    const { topo, marcas } = marcasDeValor(max);
    assert.equal(topo, max, `topo ${topo} para máximo redondo ${max}`);
    assert.equal(marcas.at(-1), max);
  }
});

test('o alvo de marcas é respeitado quando mudado', () => {
  const cinco = marcasDeValor(1e6, 5);
  const tres = marcasDeValor(1e6, 3);
  assert.ok(tres.marcas.length <= cinco.marcas.length);
});

test('máximo zero devolve topo não nulo, para não dividir por zero no desenho', () => {
  const { topo } = marcasDeValor(0);
  assert.ok(topo > 0);
});
