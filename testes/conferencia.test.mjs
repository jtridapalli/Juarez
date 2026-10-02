import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PARAMETROS_PADRAO } from '../nucleo/regras.js';
import { montaCarga } from '../nucleo/carga.js';
import { TOL_INTERNA, confere, formataDiferenca } from '../nucleo/conferencia.js';
import { PUBLICADO } from '../dados/publicado.js';

const base = JSON.parse(readFileSync(new URL('../dados/modelo.json', import.meta.url), 'utf8'));
const carga = montaCarga(base, PARAMETROS_PADRAO, undefined, PUBLICADO);

const internas = (c) => c.conferencia.itens.filter((x) => x.grupo === 'interna');
const aderencia = (c) => c.conferencia.itens.filter((x) => x.grupo === 'aderência');

test('a tolerância interna é um real, porque os valores circulam em reais', () => {
  assert.equal(TOL_INTERNA, 1);
  // Se circulassem em milhões, a mesma constante seria um milhão de reais. A prova
  // de que circulam em reais é a ordem de grandeza do exercício.
  assert.ok(carga.p26.ano > 1e10, 'o exercício está em reais, não em milhões');
});

test('a carga do modelo publicado passa em todas as internas', () => {
  const falhas = internas(carga).filter((x) => !x.passa);
  assert.deepEqual(
    falhas.map((x) => `${x.rotulo}: ${formataDiferenca(x.diferenca)}`),
    [],
  );
  assert.equal(carga.conferencia.travada, false);
});

test('a pior diferença interna é de centavos', () => {
  assert.ok(carga.conferencia.pior <= TOL_INTERNA, `pior = ${carga.conferencia.pior}`);
});

test('a carga do modelo publicado passa em todas as aderências', () => {
  const falhas = aderencia(carga).filter((x) => !x.passa);
  assert.deepEqual(falhas.map((x) => x.rotulo), []);
});

test('as três classes de verificação existem e só uma bloqueia', () => {
  const r = carga.conferencia.resumo;
  assert.ok(r.interna.total >= 30, `internas: ${r.interna.total}`);
  assert.ok(r.aderencia.total >= 100, `aderências: ${r.aderencia.total}`);
  assert.ok(r.fonte >= 3);
  for (const x of carga.conferencia.itens) {
    assert.equal(x.bloqueante, x.grupo === 'interna');
  }
});

test('as nove agregações são conferidas em três identidades cada', () => {
  const agr = internas(carga).filter((x) => /^Agregação/.test(x.rotulo));
  assert.equal(agr.length, 27);
  for (const x of agr) assert.equal(x.passa, true);
});

test('a conferência de fonte nunca bloqueia, mesmo divergindo', () => {
  const fonte = carga.conferencia.itens.filter((x) => x.grupo === 'fonte');
  for (const x of fonte) {
    assert.equal(x.passa, true);
    assert.equal(x.bloqueante, false);
  }
  // E ela de fato diverge: as duas origens não cobrem o mesmo conjunto.
  const dot = fonte.find((x) => /Dotação de pessoal/.test(x.rotulo));
  assert.ok(Math.abs(dot.diferenca) > 1e6, 'as réguas são diferentes por construção');
});

test('a trava dispara quando uma identidade interna quebra', () => {
  // Uma agregação que perde massa é exatamente o defeito do quadro 28. Aqui ela é
  // simulada corrompendo o agregado depois do cálculo.
  const falsa = {
    ...carga,
    agregados: {
      ...carga.agregados,
      porPoder: {
        ...carga.agregados.porPoder,
        itens: carga.agregados.porPoder.itens.slice(1),
      },
    },
  };
  const c = confere(falsa, PUBLICADO);
  assert.equal(c.travada, true);
  assert.ok(c.falhas.length > 0);
  assert.ok(c.falhas.every((x) => x.grupo === 'interna'));
  assert.ok(c.pior > 1e6, 'a diferença é grande e a trava a vê');
});

test('uma diferença de um real e um centavo já trava', () => {
  const falsa = { ...carga, p26: { ...carga.p26, ano: carga.p26.ano + 1.01 } };
  const c = confere(falsa, PUBLICADO);
  assert.equal(c.travada, true);
});

test('uma diferença de noventa centavos não trava', () => {
  const falsa = { ...carga, p26: { ...carga.p26, ano: carga.p26.ano + 0.9 } };
  const c = confere(falsa, PUBLICADO);
  assert.equal(c.travada, false);
});

test('aderência que falha NÃO trava a carga', () => {
  // Divergir do publicado é o que se quer medir quando a base é reancorada.
  const c = confere(carga, { ...PUBLICADO, proj2026: 1 });
  const falha = c.itens.find((x) => x.rotulo === 'Projeção da DOE · 2026');
  assert.equal(falha.passa, false);
  assert.equal(falha.bloqueante, false);
  assert.equal(c.travada, false);
});

test('sem números publicados a conferência roda só as internas e as de fonte', () => {
  const c = confere(carga, null);
  assert.equal(c.resumo.aderencia.total, 0);
  assert.ok(c.resumo.interna.total >= 30);
  assert.equal(c.travada, false);
});

test('a conferência de contagem usa tolerância zero', () => {
  const contagens = aderencia(carga).filter((x) => x.nota === 'contagem');
  assert.ok(contagens.length >= 20);
  for (const x of contagens) assert.equal(x.tolerancia, 0);
});

test('a memória publicada bate linha por linha', () => {
  for (const [chave, alvo] of Object.entries(PUBLICADO.memoria)) {
    const obtido = carga.p26.memoria[chave] ?? carga.p27.memoria[chave] ?? 0;
    assert.equal(obtido, alvo, `memória ${chave}`);
  }
});

test('a diferença é formatada com a unidade escrita, em qualquer escala', () => {
  assert.equal(formataDiferenca(0), 'R$ 0,00');
  assert.match(formataDiferenca(0.4), /R\$ 0,40/);
  assert.match(formataDiferenca(-0.4), /^\u2212R\$ 0,40/);
  assert.match(formataDiferenca(2.705e6), /mi$/);
  assert.match(formataDiferenca(-199_999.93), /mil$/);
  assert.match(formataDiferenca(3.1e9), /bi$/);
});

test('o recorte não quebra nenhuma identidade interna', () => {
  // A trava tem de valer para a tela recortada, não só para o Estado inteiro.
  for (const sel of [
    { poder: 2 }, { poder: 5 }, { poder: 9 },
    { orgao: 41 }, { nat: 319011 }, { nat: 319092 },
  ]) {
    const c = montaCarga(base, PARAMETROS_PADRAO, sel, PUBLICADO);
    assert.equal(
      c.conferencia.travada, false,
      `recorte ${JSON.stringify(sel)} travou: ${c.conferencia.falhas
        .map((x) => `${x.rotulo} ${formataDiferenca(x.diferenca)}`).join(' | ')}`,
    );
  }
});

test('nenhuma premissa plausível quebra uma identidade interna', () => {
  for (const par of [
    { ...PARAMETROS_PADRAO, teto: 0 },
    { ...PARAMETROS_PADRAO, teto: 0.10 },
    { ...PARAMETROS_PADRAO, mesReajuste: 9 },
    { ...PARAMETROS_PADRAO, fator13: 0 },
    { ...PARAMETROS_PADRAO, modoD6: 'mes' },
    { ...PARAMETROS_PADRAO, aumentoNominal27: 0.08, mesNominal27: 6 },
    { ...PARAMETROS_PADRAO, vegetativoAtivo27: 0, vegetativoInativo27: 0 },
  ]) {
    const c = montaCarga(base, par, undefined, PUBLICADO);
    assert.equal(
      c.conferencia.travada, false,
      `premissa travou: ${c.conferencia.falhas.map((x) => x.rotulo).join(' | ')}`,
    );
  }
});

test('a tela recortada publica aderência que NÃO bate, e isso é correto', () => {
  // Os números publicados são do Estado inteiro. Num recorte eles têm de divergir, e
  // a divergência não pode bloquear: é informação, não defeito.
  const c = montaCarga(base, PARAMETROS_PADRAO, { poder: 2 }, PUBLICADO);
  const falhas = c.conferencia.itens.filter((x) => x.grupo === 'aderência' && !x.passa);
  assert.ok(falhas.length > 0, 'o recorte diverge do publicado');
  assert.equal(c.conferencia.travada, false);
});
