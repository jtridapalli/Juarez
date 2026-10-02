import test from 'node:test';
import assert from 'node:assert/strict';

import { PARAMETROS_PADRAO } from '../nucleo/regras.js';
import { projeta2026 } from '../nucleo/projecao2026.js';
import { projeta2027 } from '../nucleo/projecao2027.js';
import {
  CRITERIO_DO_DOCUMENTO, agrega, creditoAAbrir, ramoExecutado, todasAsAgregacoes,
} from '../nucleo/agregacao.js';

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

function monta(linhas, p = par) {
  const p26 = projeta2026(linhas, p);
  const p27 = projeta2027(linhas, p, p26);
  return { p26, p27, agr: todasAsAgregacoes(linhas, p26, p27) };
}

const CONJUNTO = [
  linha({ id: 1, orgao: 1, uo: 101, nat: 319011, atual: 1500 }),
  linha({ id: 2, orgao: 41, uo: 4101, nat: 319001, atual: 500 }),
  linha({ id: 3, orgao: 41, uo: 4102, nat: 319092, atual: 1300 }),
  linha({ id: 4, orgao: 87, uo: 8701, nat: 319011, atual: 900, jul: 0, ago: 0 }),
  linha({ id: 5, orgao: 99, uo: 9901, nat: 319113, atual: 1400 }),
];

test('toda agregação fecha com o total percorrido', () => {
  const { p26, p27, agr } = monta(CONJUNTO);
  for (const [nome, grupo] of Object.entries(agr)) {
    const soma = grupo.itens.reduce((a, g) => a + g.proj26, 0);
    perto(soma, p26.ano, 1e-6);
    perto(grupo.total.proj26, p26.ano, 1e-6);
    perto(grupo.itens.reduce((a, g) => a + g.proj27, 0), p27.ano, 1e-6);
    // O resíduo é zero por construção, e é por isso que publicá-lo vale a pena.
    for (const k of Object.keys(grupo.residuo)) {
      perto(grupo.residuo[k], 0, 1e-6, `${nome}.${k}`);
    }
  }
});

test('toda agregação conserva a contagem de linhas', () => {
  const { agr } = monta(CONJUNTO);
  for (const grupo of Object.values(agr)) {
    assert.equal(
      grupo.itens.reduce((a, g) => a + g.linhas, 0),
      CONJUNTO.length,
    );
    assert.equal(grupo.total.linhas, CONJUNTO.length);
  }
});

test('chave sem classificação vai para um balde explícito e não desaparece', () => {
  // É o defeito do quadro 28: a linha que não casa com nenhum balde declarado some
  // da soma em silêncio. Aqui ela tem de aparecer.
  const { p26, p27 } = monta(CONJUNTO);
  const g = agrega(CONJUNTO, p26, p27, (L) => (L.id === 3 ? null : {
    chave: 'ok', rotulo: 'Classificada',
  }));
  const vazio = g.itens.find((x) => x.chave === '∅');
  assert.ok(vazio, 'o balde não classificado existe');
  assert.equal(vazio.linhas, 1);
  assert.ok(vazio.proj26 > 0);
  perto(g.itens.reduce((a, x) => a + x.proj26, 0), p26.ano, 1e-6);
  perto(g.residuo.proj26, 0, 1e-6);
});

test('a soma dos grupos não se perde quando TODAS as chaves falham', () => {
  const { p26, p27 } = monta(CONJUNTO);
  const g = agrega(CONJUNTO, p26, p27, () => null);
  assert.equal(g.itens.length, 1);
  assert.equal(g.itens[0].linhas, CONJUNTO.length);
  perto(g.itens[0].proj26, p26.ano, 1e-6);
});

test('as nove agregações do painel existem e são as mesmas linhas', () => {
  const { agr } = monta(CONJUNTO);
  assert.deepEqual(Object.keys(agr).sort(), [
    'porClasse27', 'porElemento', 'porGnd', 'porModalidade', 'porNatureza',
    'porOrgao', 'porPoder', 'porRamo', 'porUnidade',
  ]);
});

test('o órgão fora de toda faixa aparece no Poder 9 em vez de sumir', () => {
  const { agr } = monta(CONJUNTO);
  const g = agr.porPoder.itens.find((x) => String(x.chave) === '9');
  assert.ok(g, 'o balde do não classificado existe');
  assert.equal(g.linhas, 1);
  // E ele vai para o fim da lista, não para o meio da ordenação por valor.
  assert.equal(agr.porPoder.itens.at(-1).chave, 9);
});

test('a dotação agregada é a soma da coluna de orçamento atualizado', () => {
  const { agr } = monta(CONJUNTO);
  const esperado = CONJUNTO.reduce((a, L) => a + L.atual, 0);
  perto(agr.porPoder.total.dotacao, esperado);
  perto(agr.porUnidade.itens.reduce((a, g) => a + g.dotacao, 0), esperado);
});

test('o ramo executado pode divergir do critério do documento', () => {
  // Elementos 16, 92 e 94 recebem no documento a régua de base geral ou de
  // orçamento atualizado e executam pela mediana da regra 5.2.
  const { p26 } = monta(CONJUNTO);
  const L = CONJUNTO.find((x) => x.nat === 319092);
  assert.equal(ramoExecutado(p26, L), 'mediana');
  assert.equal(CRITERIO_DO_DOCUMENTO[92], 'orçamento atualizado');
  assert.notEqual(CRITERIO_DO_DOCUMENTO[92], 'mediana de jan–ago');
});

test('a parte de cada grupo soma um', () => {
  const { agr } = monta(CONJUNTO);
  perto(agr.porPoder.itens.reduce((a, g) => a + g.parte, 0), 1, 1e-12);
});

test('falta é projeção menos dotação, grupo por grupo', () => {
  const { agr } = monta(CONJUNTO);
  for (const g of agr.porPoder.itens) perto(g.falta, g.proj26 - g.dotacao, 1e-9);
});

test('as três leituras do crédito diferem, e a líquida é a menor', () => {
  const { p26, agr } = monta(CONJUNTO);
  const c = creditoAAbrir(agr, p26);
  perto(c.liquida, p26.ano - p26.dotacao, 1e-9);
  assert.ok(c.brutaPorPoder >= c.liquida);
  assert.ok(c.brutaPorUnidade >= c.brutaPorPoder);
  // A identidade que explica a diferença: bruta menos sobra é a líquida.
  perto(c.brutaPorPoder - c.sobraPorPoder, c.liquida, 1e-6);
  perto(c.brutaPorUnidade - c.sobraPorUnidade, c.liquida, 1e-6);
});

test('a leitura bruta por unidade é mais fina que a por Poder', () => {
  // Duas unidades do mesmo Poder, uma sobrando e outra faltando: por Poder elas se
  // cancelam, por unidade não. É a razão de as duas réguas serem publicadas.
  const linhas = [
    linha({ id: 1, orgao: 41, uo: 4101, atual: 1e9 }),
    linha({ id: 2, orgao: 41, uo: 4102, atual: 0 }),
  ];
  const { p26, agr } = monta(linhas);
  const c = creditoAAbrir(agr, p26);
  assert.equal(c.descobertosPorPoder, 0, 'o Poder está coberto no agregado');
  assert.equal(c.descobertosPorUnidade, 1, 'uma unidade está descoberta');
  assert.ok(c.brutaPorUnidade > c.brutaPorPoder);
});

test('conjunto coberto não produz crédito bruto', () => {
  const linhas = [linha({ atual: 1e9 })];
  const { p26, agr } = monta(linhas);
  const c = creditoAAbrir(agr, p26);
  assert.equal(c.brutaPorPoder, 0);
  assert.equal(c.brutaPorUnidade, 0);
  assert.ok(c.liquida < 0, 'a líquida pode ser negativa; a bruta não');
});

test('os ramos da regra de 2026 aparecem na agregação por ramo', () => {
  const { agr } = monta(CONJUNTO);
  const chaves = agr.porRamo.itens.map((x) => x.chave);
  assert.ok(chaves.includes('desligada'));
  assert.ok(chaves.includes('mediana'));
  assert.ok(chaves.includes('composicao'));
  // Na ordem da regra, não na ordem de valor.
  assert.deepEqual(chaves, ['desligada', 'mediana', 'composicao']);
});

test('as classes de 2027 aparecem na ordem ativo, inativo, D4', () => {
  const { agr } = monta(CONJUNTO);
  assert.deepEqual(agr.porClasse27.itens.map((x) => x.chave), ['ativo', 'inativo', 'd4']);
});

test('conjunto vazio agrega sem grupos e sem resíduo', () => {
  const { agr } = monta([]);
  for (const grupo of Object.values(agr)) {
    assert.equal(grupo.itens.length, 0);
    assert.equal(grupo.total.proj26, 0);
    perto(grupo.residuo.proj26, 0);
  }
});
