import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bi, delta, dinheiro, fator, inteiro, inteiroSinal, milhoes, natureza, pct,
  pctSinal, reaisMi,
} from '../nucleo/formato.js';

const MENOS = '\u2212';

test('bilhão e milhão com separador pt-BR', () => {
  assert.equal(bi(47_392_700_000), 'R$ 47,39 bi');
  assert.equal(bi(47_392_700_000, 3), 'R$ 47,393 bi');
  assert.equal(reaisMi(47_392_700_000), 'R$ 47.392,7 mi');
  assert.equal(milhoes(1_234_500_000), '1.234,5');
});

test('a escala é escolhida pela grandeza', () => {
  assert.match(dinheiro(3.1e9), /bi$/);
  assert.match(dinheiro(2.7e6), /mi$/);
  assert.match(dinheiro(200_000), /mil$/);
  assert.equal(dinheiro(0.4), 'R$ 0,40');
  assert.equal(dinheiro(0), 'R$ 0,00');
});

test('diferença de centavos NÃO é escondida em milhões', () => {
  // "R$ 0,0 mi" é a maneira mais eficiente de esconder um defeito de centavos, e as
  // identidades internas são justamente onde a diferença é de centavos.
  assert.equal(delta(0.4), '+R$ 0,40');
  assert.equal(delta(-0.4), `${MENOS}R$ 0,40`);
  assert.equal(delta(0), 'R$ 0,00');
  assert.equal(delta(0.001), 'R$ 0,00', 'abaixo de meio centavo é zero');
});

test('o sinal de menos é sempre o tipográfico', () => {
  // Com o hífen do teclado e o menos tipográfico em circulação, quem varre a tela
  // procurando negativos passa por um dos dois.
  assert.ok(!pctSinal(-0.05).includes('-'));
  assert.ok(!delta(-1e6).includes('-'));
  assert.ok(!inteiroSinal(-5).includes('-'));
  assert.ok(!pct(-0.05).includes('-'));
  assert.ok(!milhoes(-1e6).includes('-'));
  assert.ok(!fator(-1.5).includes('-'));
});

test('negativo pequeno demais para a casa decimal perde o sinal', () => {
  // "−R$ 0,00" e "−0,00%" anunciam uma redução que não existe.
  assert.equal(pct(-0.000001, 2), '0,00%');
  assert.equal(milhoes(-0.004, 1), '0,0');
  assert.equal(fator(-1e-9, 3), '0,000');
});

test('o zero negativo do IEEE 754 não vaza para a tela', () => {
  const zeroNegativo = 0 / -5;
  assert.ok(Object.is(zeroNegativo, -0), 'o caso existe');
  assert.equal(milhoes(zeroNegativo, 1), '0,0');
  assert.equal(pct(zeroNegativo), '0,00%');
  assert.equal(inteiro(zeroNegativo), '0');
  assert.equal(inteiroSinal(zeroNegativo), '0');
});

test('percentual com e sem sinal explícito', () => {
  assert.equal(pct(0.015), '1,50%');
  assert.equal(pct(0.015, 1), '1,5%');
  assert.equal(pct(0.886, 1), '88,6%');
  assert.equal(pctSinal(0.05), '+5,00%');
  assert.equal(pctSinal(-0.05), `${MENOS}5,00%`);
});

test('percentual indefinido sai como travessão, não como NaN', () => {
  // Uma razão sobre dotação zero é indefinida. "NaN%" na tela é pior que o travessão.
  for (const v of [null, undefined, NaN, Infinity]) {
    assert.equal(pct(v), '—');
    assert.equal(pctSinal(v), '—');
    assert.equal(fator(v), '—');
  }
});

test('fator com as casas que a memória de cálculo exige', () => {
  assert.equal(fator(1.015), '1,015000');
  assert.equal(fator(1.015, 3), '1,015');
  assert.equal(fator(1.0150000001, 6), '1,015000');
});

test('contagem com sinal diz se sobrou ou faltou', () => {
  assert.equal(inteiro(1023), '1.023');
  assert.equal(inteiroSinal(5), '+5');
  assert.equal(inteiroSinal(-5), `${MENOS}5`);
  assert.equal(inteiroSinal(0), '0');
  assert.equal(inteiroSinal(0.4), '0', 'arredonda antes de olhar o sinal');
});

test('natureza é escrita com os pontos da classificação', () => {
  assert.equal(natureza(319011), '3.1.90.11');
  assert.equal(natureza(319113), '3.1.91.13');
  assert.equal(natureza('319092'), '3.1.90.92');
});

test('natureza curta é preenchida à esquerda em vez de quebrar', () => {
  assert.equal(natureza(31011), '0.3.10.11');
});
