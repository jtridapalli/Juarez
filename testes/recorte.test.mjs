import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PARAMETROS_PADRAO, poderDaLinha } from '../nucleo/regras.js';
import { aplicaRecorte, dimensoes, ehEstadoInteiro, saneia } from '../nucleo/recorte.js';
import { montaCarga } from '../nucleo/carga.js';
import { PUBLICADO } from '../dados/publicado.js';

const base = JSON.parse(readFileSync(new URL('../dados/modelo.json', import.meta.url), 'utf8'));
const linhas = base.modelo;

test('recorte vazio é o Estado inteiro', () => {
  assert.equal(aplicaRecorte(linhas).length, linhas.length);
  assert.equal(aplicaRecorte(linhas, {}).length, linhas.length);
  assert.equal(aplicaRecorte(linhas, null).length, linhas.length);
  assert.equal(ehEstadoInteiro({}), true);
  assert.equal(ehEstadoInteiro({ poder: 2 }), false);
});

test('os recortes por Poder particionam o modelo', () => {
  // Nenhuma linha fica fora e nenhuma é contada duas vezes.
  const poderes = [...new Set(linhas.map(poderDaLinha))];
  const soma = poderes.reduce((a, p) => a + aplicaRecorte(linhas, { poder: p }).length, 0);
  assert.equal(soma, linhas.length);
});

test('o recorte é hierárquico e cada nível restringe o seguinte', () => {
  const porOrgao = aplicaRecorte(linhas, { orgao: 41 });
  const porUo = aplicaRecorte(linhas, { orgao: 41, uo: porOrgao[0].uo });
  assert.ok(porUo.length > 0);
  assert.ok(porUo.length <= porOrgao.length);
  assert.ok(porOrgao.length < linhas.length);
  assert.equal(porUo.every((L) => Number(L.orgao) === 41), true);
});

test('as dimensões de um nível já vêm restritas pelos níveis acima', () => {
  // Oferecer as 77 unidades do Estado depois de escolhido um órgão com três produz
  // 74 escolhas que devolvem tela vazia, e tela vazia é indistinguível de defeito.
  const todas = dimensoes(linhas, {}, base.catalogo);
  const doPoder = dimensoes(linhas, { poder: 1 }, base.catalogo);
  assert.ok(doPoder.orgaos.length < todas.orgaos.length);
  assert.ok(doPoder.unidades.length < todas.unidades.length);

  const umOrgao = doPoder.orgaos[0].valor;
  const doOrgao = dimensoes(linhas, { poder: 1, orgao: umOrgao }, base.catalogo);
  assert.ok(doOrgao.unidades.length <= doPoder.unidades.length);
  // A lista de Poderes nunca se restringe: é o nível de cima.
  assert.deepEqual(doPoder.poderes, todas.poderes);
});

test('as dimensões carregam o nome do catálogo', () => {
  const d = dimensoes(linhas, {}, base.catalogo);
  assert.equal(d.orgaos.length, 34);
  assert.equal(d.unidades.length, 77);
  for (const o of d.orgaos) assert.match(o.rotulo, /^\d+ · .+/);
  assert.ok(!d.orgaos.some((o) => /^\d+ · Órgão \d+$/.test(o.rotulo)), 'todo órgão tem nome');
});

test('nível incompatível com o de cima é descartado em vez de dar tela vazia', () => {
  // Trocar o Poder tem de derrubar o órgão que não lhe pertence, e não devolver uma
  // seleção que não existe.
  const s = saneia(linhas, { poder: 1, orgao: 41, uo: 4101, nat: 319011 });
  assert.equal(s.orgao, null, 'o órgão 41 não é do Poder 1');
  assert.equal(s.uo, null);
  assert.equal(s.nat, null);
});

test('o saneamento preserva a seleção coerente', () => {
  const umOrgao = dimensoes(linhas, { poder: 2 }, {}).orgaos[0].valor;
  const s = saneia(linhas, { poder: 2, orgao: umOrgao });
  assert.equal(s.poder, 2);
  assert.equal(s.orgao, umOrgao);
});

test('natureza que não existe na unidade é descartada', () => {
  const s = saneia(linhas, { orgao: 41, nat: 999999 });
  assert.equal(s.nat, null);
  assert.equal(s.orgao, 41, 'o nível de cima sobrevive');
});

test('a carga recortada soma menos que a do Estado e nunca mais', () => {
  const inteira = montaCarga(base, PARAMETROS_PADRAO, undefined, PUBLICADO);
  let soma = 0;
  for (const p of dimensoes(linhas, {}, {}).poderes) {
    const c = montaCarga(base, PARAMETROS_PADRAO, { poder: p }, PUBLICADO);
    assert.ok(c.p26.ano <= inteira.p26.ano + 1);
    assert.equal(c.estadoInteiro, false);
    soma += c.p26.ano;
  }
  // E a soma dos recortes por Poder reconstrói o Estado: o recorte não perde linha.
  assert.ok(Math.abs(soma - inteira.p26.ano) < 1, `resíduo de ${soma - inteira.p26.ano}`);
});

test('recorte que não casa com nada devolve tela vazia sem quebrar', () => {
  // `saneia` descarta a seleção impossível, então a carga volta ao Estado inteiro em
  // vez de publicar zeros rotulados como projeção.
  const c = montaCarga(base, PARAMETROS_PADRAO, { orgao: 99999 }, PUBLICADO);
  assert.equal(c.recorte.orgao, null);
  assert.equal(c.modelo.length, linhas.length);
  assert.equal(c.conferencia.travada, false);
});

test('o recorte alcança todas as leituras alternativas, não só a projeção', () => {
  const c = montaCarga(base, PARAMETROS_PADRAO, { poder: 5 }, PUBLICADO);
  const inteira = montaCarga(base, PARAMETROS_PADRAO, undefined, PUBLICADO);
  assert.ok(c.veg.ano2026 < inteira.veg.ano2026);
  assert.ok(c.piso.ano2026 < inteira.piso.ano2026);
  assert.ok(c.oito.parte < 1, 'a série do 8778 também é recortada');
  // O ARIMA é recortado por massa, nunca reajustado localmente.
  assert.ok(c.arima.janela.total2026 < inteira.arima.janela.total2026);
});
