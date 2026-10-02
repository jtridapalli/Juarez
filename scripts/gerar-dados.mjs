#!/usr/bin/env node
/**
 * Gera o conjunto sintético calibrado e grava `dados/modelo.json`, que é o que a
 * interface abre ao carregar. Imprime o relatório de calibração: alvo publicado,
 * valor obtido e resíduo de cada um.
 *
 *   node scripts/gerar-dados.mjs [--semente N] [--json caminho] [--iteracoes N]
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { geraModelo } from '../dados/gerador.js';
import { montaCarga } from '../nucleo/carga.js';
import { PUBLICADO } from '../dados/publicado.js';
import { PARAMETROS_PADRAO } from '../nucleo/regras.js';
import {
  delta, dinheiro, fator, inteiro, inteiroSinal, pct, reaisMi,
} from '../nucleo/formato.js';

const args = process.argv.slice(2);
const pega = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : padrao;
};
const semente = Number(pega('semente', 20260929));
const iteracoes = pega('iteracoes', null);
const destino = resolve(process.cwd(), pega('json', 'dados/modelo.json'));

const t0 = Date.now();
const base = geraModelo({
  semente,
  iteracoes: iteracoes === null ? undefined : Number(iteracoes),
});
const ms = Date.now() - t0;

const carga = montaCarga(base, PARAMETROS_PADRAO, undefined, PUBLICADO);

const larg = [48, 15, 15, 14];
const linha = (c) => c.map((x, i) => String(x).padEnd(larg[i])).join(' ');
const num = (v, u) => (u === 'contagem' ? inteiro(v) : reaisMi(v, 1).replace('R$ ', ''));

console.log(`\nConjunto sintético gerado em ${ms} ms · semente ${semente}`);
const o = base.origem;
console.log(`Linhas: ${base.modelo.length} · unidades do 8778: ${base.oito.unidades}`);
console.log(`Razão de cada mês projetado: ${o.razoes.map((r) => pct(r, 1)).join('  ')}`);
console.log(`Cortes por mês: ${o.cortesPorMes.join('  ')}`
  + `   (limite ${o.limitePorMes.join('  ')})`);
console.log(`Dispersão por mês: ${o.dispersao.map((w) => fator(w, 3)).join('  ')}`);
console.log(`Impulso dos trios específicos: ${fator(o.impulso, 3)}\n`);
console.log('RELATÓRIO DE CALIBRAÇÃO');
console.log(linha(['alvo', 'publicado', 'obtido', 'resíduo']));
console.log('-'.repeat(larg.reduce((a, b) => a + b + 1, 0)));

let pior = { alvo: '—', rel: 0 };
for (const c of base.origem.calibracao) {
  const rel = c.publicado === 0
    ? (Math.abs(c.residuo) < 1 ? 0 : 1)
    : Math.abs(c.residuo / c.publicado);
  if (rel > pior.rel) pior = { alvo: c.alvo, rel };
  const marca = rel < 0.0005 ? ' ' : (rel < 0.01 ? '~' : '!');
  console.log(`${marca}${linha([c.alvo, num(c.publicado, c.unidade),
    num(c.obtido, c.unidade),
    c.unidade === 'contagem' ? inteiroSinal(c.residuo) : num(c.residuo, c.unidade)])}`);
}
console.log(`\npior resíduo relativo: ${pct(pior.rel, 3)} em "${pior.alvo}"`);

const conf = carga.conferencia;
console.log('\nCONFERÊNCIA');
console.log(`internas   ${conf.resumo.interna.passa}/${conf.resumo.interna.total}`
  + `   pior diferença: ${dinheiro(conf.pior, 2)}`);
console.log(`aderência  ${conf.resumo.aderencia.passa}/${conf.resumo.aderencia.total}`);
console.log(`carga ${conf.travada ? 'TRAVADA' : 'liberada'}`);
if (conf.travada) {
  for (const f of conf.falhas.slice(0, 12)) {
    console.log(`  ! ${f.rotulo}: ${delta(f.diferenca, 2)}`);
  }
}

const reprovadas = conf.itens.filter((x) => x.grupo === 'aderência' && !x.passa);
if (reprovadas.length > 0) {
  console.log(`\naderência fora da tolerância (${reprovadas.length}):`);
  // Nem toda aderência é dinheiro: as de memória e de contagem de linhas são
  // CONTAGEM. Dividir uma contagem por um milhão publica "307 contra 302" como
  // "0,0 contra 0,0" — o relatório apagaria justamente o resíduo que sobrou.
  for (const f of reprovadas.slice(0, 40)) {
    const conta = f.nota === 'contagem';
    const v = conta ? inteiro : (x) => reaisMi(x, 1);
    console.log(`  · ${f.rotulo}: publicado ${v(f.publicado)}`
      + ` · obtido ${v(f.recomposto)}`
      + ` · resíduo ${conta ? inteiroSinal(f.diferenca) : delta(f.diferenca, 2)}`);
  }
}

console.log('\nINDICADORES');
const mi = (v) => reaisMi(v, 1);
console.log(`jan–ago 2026       ${mi(carga.p26.janAgo)}`);
console.log(`projeção 2026      ${mi(carga.p26.ano)}   (publicado ${mi(PUBLICADO.proj2026)})`);
console.log(`dotação            ${mi(carga.p26.dotacao)}`);
console.log(`crédito a abrir    ${mi(carga.p26.insuficiencia)}   (publicado ${mi(PUBLICADO.credito2026)})`);
console.log(`13º de 2026        ${mi(carga.p26.t13)}   (publicado ${mi(PUBLICADO.t13_2026)})`);
console.log(`projeção 2027      ${mi(carga.p27.ano)}   (publicado ${mi(PUBLICADO.proj2027)})`);
console.log(`2027 literal       ${mi(carga.p27Literal.ano)}   (publicado ${mi(PUBLICADO.proj2027Literal)})`);
console.log(`bruto por Poder    ${mi(carga.credito.brutaPorPoder)}`);
console.log(`bruto por unidade  ${mi(carga.credito.brutaPorUnidade)}`);
console.log(`efeito-base 2027   ${mi(carga.crescimento.efeitoBase)}`
  + ` (${pct(carga.crescimento.parcelaEfeitoBase, 1)})`);
console.log(`vegetativo 2027    ${mi(carga.crescimento.vegetativo)}`
  + ` (${pct(carga.crescimento.parcelaVegetativo, 1)})`);

mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, JSON.stringify({
  modelo: base.modelo,
  uos: base.uos,
  arima: base.arima,
  oito: base.oito,
  catalogo: base.catalogo,
  origem: base.origem,
}), 'utf8');
console.log(`\ngravado em ${destino}`);
