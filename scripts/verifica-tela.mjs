#!/usr/bin/env node
/**
 * Verificação da tela, sem dependência.
 *
 * Fala CDP direto no Chrome pelo `WebSocket` global do Node 22. Serve para provar
 * que o painel abre, que as oito abas desenham, que os controles recalculam e que
 * os números da tela são os mesmos que a conferência do núcleo produz — e para
 * capturar as imagens do relato.
 *
 *   node scripts/verifica-tela.mjs [--url http://localhost:8080/] [--saida DIR]
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const pega = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : padrao;
};
const url = pega('url', 'http://localhost:8080/');
const saida = resolve(pega('saida', '/opt/cursor/artifacts'));
const cdp = pega('cdp', 'http://localhost:9222');
mkdirSync(saida, { recursive: true });

async function alvo() {
  const r = await fetch(`${cdp}/json/list`);
  const abas = await r.json();
  const pagina = abas.find((t) => t.type === 'page');
  if (!pagina) throw new Error('nenhuma página aberta no Chrome');
  return pagina.webSocketDebuggerUrl;
}

/** Cliente CDP mínimo: um contador de id e um mapa de promessas pendentes. */
function conecta(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let proximo = 1;
  const pendentes = new Map();
  const eventos = [];

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pendentes.has(msg.id)) {
      const { resolve: ok, reject: nok } = pendentes.get(msg.id);
      pendentes.delete(msg.id);
      if (msg.error) nok(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? '')})`));
      else ok(msg.result);
    } else if (msg.method) {
      eventos.push(msg);
    }
  });

  const pronto = new Promise((ok, nok) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => nok(new Error('WebSocket falhou')), { once: true });
  });

  const envia = (method, params = {}) => new Promise((ok, nok) => {
    const id = proximo;
    proximo += 1;
    pendentes.set(id, { resolve: ok, reject: nok });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pendentes.has(id)) {
        pendentes.delete(id);
        nok(new Error(`tempo esgotado em ${method}`));
      }
    }, 60_000);
  });

  return { ws, pronto, envia, eventos };
}

const dorme = (ms) => new Promise((ok) => { setTimeout(ok, ms); });

const cliente = conecta(await alvo());
await cliente.pronto;
const { envia, eventos } = cliente;

await envia('Runtime.enable');
await envia('Page.enable');
await envia('Log.enable');

/** Avalia no navegador e devolve o valor, estourando se a página estourar. */
async function avalia(expressao) {
  const r = await envia('Runtime.evaluate', {
    expression: expressao,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error(`na página: ${r.exceptionDetails.exception?.description
      ?? r.exceptionDetails.text}`);
  }
  return r.result.value;
}

async function esperaPronto(limite = 25_000) {
  const ate = Date.now() + limite;
  for (;;) {
    const v = await avalia('document.body?.dataset?.pronto ?? ""');
    if (v === '1') return;
    if (v === 'erro') {
      const texto = await avalia('document.body.innerText.slice(0, 900)');
      throw new Error(`o painel reportou falha de carga:\n${texto}`);
    }
    if (Date.now() > ate) throw new Error('a tela não ficou pronta no tempo previsto');
    await dorme(200);
  }
}

async function captura(nome) {
  const altura = await avalia('Math.min(document.documentElement.scrollHeight, 7000)');
  await envia('Emulation.setDeviceMetricsOverride', {
    width: 1680, height: Math.max(900, altura), deviceScaleFactor: 1, mobile: false,
  });
  await dorme(260);
  const { data } = await envia('Page.captureScreenshot', { format: 'webp', quality: 86 });
  const caminho = join(saida, `${nome}.webp`);
  writeFileSync(caminho, Buffer.from(data, 'base64'));
  await envia('Emulation.clearDeviceMetricsOverride');
  return caminho;
}

/**
 * Recorte de um pedaço da tela, em escala 2.
 *
 * As abas longas passam de oito mil pixels de altura, e uma captura inteira delas
 * reduzida à largura de um relato deixa o texto ilegível — o que esconde exatamente
 * o que a captura deveria provar. Aqui o recorte sai no tamanho do elemento, com o
 * dobro da densidade.
 */
async function recorta(nome, seletor, { ate = null, maxAltura = 2000 } = {}) {
  const caixa = await avalia(`(() => {
    const a = document.querySelector(${JSON.stringify(seletor)});
    if (!a) return null;
    const ra = a.getBoundingClientRect();
    const y = ra.top + window.scrollY;
    let fim = y + ra.height;
    ${ate ? `const b = document.querySelector(${JSON.stringify(ate)});
      if (b) { const rb = b.getBoundingClientRect(); fim = rb.top + window.scrollY + rb.height; }` : ''}
    return { x: 0, y, largura: document.documentElement.clientWidth, altura: fim - y };
  })()`);
  if (!caixa) return null;

  const altura = Math.min(caixa.altura, maxAltura);
  await envia('Emulation.setDeviceMetricsOverride', {
    width: 1680,
    height: Math.ceil(caixa.y + altura + 40),
    deviceScaleFactor: 1,
    mobile: false,
  });
  await dorme(260);
  const { data } = await envia('Page.captureScreenshot', {
    format: 'webp',
    quality: 92,
    clip: {
      x: 0, y: caixa.y, width: 1680, height: altura, scale: 2,
    },
  });
  const caminho = join(saida, `${nome}.webp`);
  writeFileSync(caminho, Buffer.from(data, 'base64'));
  await envia('Emulation.clearDeviceMetricsOverride');
  return caminho;
}

const falhas = [];
const relato = [];
function confere(rotulo, condicao, detalhe = '') {
  if (condicao) relato.push(`  ok   ${rotulo}${detalhe ? ` · ${detalhe}` : ''}`);
  else {
    relato.push(`  FALHA ${rotulo}${detalhe ? ` · ${detalhe}` : ''}`);
    falhas.push(rotulo);
  }
}

console.log(`\nAbrindo ${url}`);
await envia('Page.navigate', { url });
await esperaPronto();

// ----------------------------------------------------------- estado inicial
const topo = await avalia(`JSON.parse(JSON.stringify({
  titulo: document.querySelector('.topo h1')?.textContent ?? '',
  valores: [...document.querySelectorAll('.topo-valor')].map((x) => x.textContent),
  selo: document.querySelector('.topo-estado .selo')?.textContent ?? '',
  abas: [...document.querySelectorAll('.aba-botao .aba-rotulo')].map((x) => x.textContent),
  indicadores: [...document.querySelectorAll('.indicador-valor')].map((x) => x.textContent),
  graficos: document.querySelectorAll('svg.grafico').length,
  tabelas: document.querySelectorAll('table.tabela').length,
}))`);

console.log('\nESTADO INICIAL');
console.log(`  título: ${topo.titulo}`);
console.log(`  topo: ${topo.valores.join('  ')}`);
console.log(`  selo: ${topo.selo}`);
console.log(`  abas: ${topo.abas.join(', ')}`);

confere('o painel abre com as oito abas', topo.abas.length === 8, `${topo.abas.length} abas`);
confere('a carga não está travada', /conferida/.test(topo.selo), topo.selo);
confere('a projeção de 2026 publicada está no topo',
  topo.valores[0] === 'R$ 47,39 bi', topo.valores[0]);
confere('a projeção de 2027 publicada está no topo',
  topo.valores[1] === 'R$ 50,31 bi', topo.valores[1]);
confere('o crédito a abrir publicado está no topo',
  topo.valores[2] === 'R$ 2,97 bi', topo.valores[2]);
confere('a aba inicial desenha gráficos', topo.graficos >= 2, `${topo.graficos} svg`);

const capturas = [];
capturas.push(await captura('painel-1-simulacao'));

// ------------------------------------------------------ percorre as oito abas
console.log('\nABAS');
const chaves = ['simulacao', 'projecao', 'abertura', 'ano2027', 'metodos',
  'conferencia', 'regras', 'cargaCsv'];
for (let i = 0; i < chaves.length; i += 1) {
  await avalia(`[...document.querySelectorAll('.aba-botao')][${i}].click()`);
  await dorme(420);
  const medida = await avalia(`JSON.parse(JSON.stringify({
    ativa: document.querySelector('.aba-botao.ativa .aba-rotulo')?.textContent ?? '',
    h1: document.querySelector('.cabecalho-aba h1')?.textContent ?? '',
    svg: document.querySelectorAll('svg.grafico').length,
    tabelas: document.querySelectorAll('table.tabela').length,
    celulas: document.querySelectorAll('table.tabela td').length,
    indefinidos: (document.querySelector('.aba')?.innerText.match(
      /undefined|NaN|\\[object Object\\]|Infinity/g) ?? []).length,
    vazios: document.querySelectorAll('table.tabela td.vazio').length,
    altura: document.documentElement.scrollHeight,
  }))`);
  console.log(`  ${medida.ativa.padEnd(18)} ${String(medida.tabelas).padStart(2)} tabelas · `
    + `${String(medida.celulas).padStart(5)} células · ${medida.svg} gráficos · `
    + `${medida.altura}px`);
  confere(`a aba "${medida.ativa}" desenha conteúdo`,
    medida.celulas > 10, `${medida.celulas} células`);
  confere(`a aba "${medida.ativa}" não publica valor indefinido`,
    medida.indefinidos === 0, `${medida.indefinidos} ocorrências`);
  if (i > 0) capturas.push(await captura(`painel-${i + 1}-${chaves[i]}`));
}

// ------------------------------------------------- os controles recalculam
console.log('\nCONTROLES');
await avalia(`[...document.querySelectorAll('.aba-botao')][0].click()`);
await dorme(350);

const antes = await avalia(`document.querySelectorAll('.topo-valor')[0].textContent`);
// Teto a 4,00%: o deslizante é de passo 0,0005, então o valor vai direto.
await avalia(`(() => {
  const i = document.getElementById('par-teto');
  i.value = '0.04';
  i.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
await dorme(900);
const depoisTeto = await avalia(`JSON.parse(JSON.stringify({
  v2026: document.querySelectorAll('.topo-valor')[0].textContent,
  v2027: document.querySelectorAll('.topo-valor')[1].textContent,
  selo: document.querySelector('.topo-estado .selo').textContent,
  aviso: [...document.querySelectorAll('.nota-aviso')].some(
    (x) => /Premissas alteradas/.test(x.textContent)),
}))`);
console.log(`  teto 1,50% → 4,00%: 2026 ${antes} → ${depoisTeto.v2026}`);
confere('subir o teto aumenta a projeção de 2026', depoisTeto.v2026 !== antes,
  `${antes} → ${depoisTeto.v2026}`);
confere('a premissa de 2026 arrasta 2027', depoisTeto.v2027 !== 'R$ 50,31 bi',
  depoisTeto.v2027);
confere('a tela avisa que as premissas saíram do publicado', depoisTeto.aviso);
confere('as identidades internas continuam fechando com premissa alterada',
  /conferida/.test(depoisTeto.selo), depoisTeto.selo);
capturas.push(await captura('painel-9-teto-alterado'));

// A conferência com premissa alterada: aderência diverge, internas continuam.
await avalia(`[...document.querySelectorAll('.aba-botao')][5].click()`);
await dorme(500);
const conf = await avalia(`JSON.parse(JSON.stringify({
  internas: document.querySelectorAll('.indicador-valor')[0].textContent,
  aderencia: document.querySelectorAll('.indicador-valor')[1].textContent,
  travada: /CARGA TRAVADA/.test(document.querySelector('.estado-carga').textContent),
  divergentes: [...document.querySelectorAll('.selo-aviso')].filter(
    (x) => x.textContent === 'diverge').length,
}))`);
console.log(`  conferência com teto alterado: internas ${conf.internas} · `
  + `aderência ${conf.aderencia} · ${conf.divergentes} divergências não bloqueantes`);
const [passaI, totalI] = conf.internas.split(' de ').map(Number);
confere('premissa alterada NÃO quebra identidade interna', passaI === totalI, conf.internas);
confere('premissa alterada FAZ a aderência divergir', conf.divergentes > 0,
  `${conf.divergentes} divergências`);
confere('a carga continua liberada', conf.travada === false);
capturas.push(await captura('painel-10-conferencia-divergente'));

// Volta ao publicado.
await avalia(`[...document.querySelectorAll('.aba-botao')][0].click()`);
await dorme(300);
await avalia(`[...document.querySelectorAll('.lateral .botao')].find(
  (b) => /Voltar às premissas/.test(b.textContent)).click()`);
await dorme(900);
const voltou = await avalia(`document.querySelectorAll('.topo-valor')[0].textContent`);
confere('voltar às premissas publicadas restaura a projeção', voltou === 'R$ 47,39 bi', voltou);

// O recorte.
await avalia(`(() => {
  const s = document.getElementById('sel-poder');
  s.value = '2';
  s.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
await dorme(900);
const recortado = await avalia(`JSON.parse(JSON.stringify({
  v2026: document.querySelectorAll('.topo-valor')[0].textContent,
  tira: document.querySelector('.tira-valor').textContent,
  linhas: [...document.querySelectorAll('.tira-valor')][1].textContent,
  selo: document.querySelector('.topo-estado .selo').textContent,
  avisoRecorte: [...document.querySelectorAll('.nota-aviso')].some(
    (x) => /Este é um recorte/.test(x.textContent)),
}))`);
console.log(`  recorte no Executivo: ${recortado.tira} · ${recortado.linhas} · ${recortado.v2026}`);
confere('o recorte muda a projeção', recortado.v2026 !== 'R$ 47,39 bi', recortado.v2026);
confere('o recorte aparece na tira de toda aba', /Poder 2/.test(recortado.tira), recortado.tira);
confere('a tela avisa que a aderência diverge por ser recorte', recortado.avisoRecorte);
confere('o recorte não trava a carga', /conferida/.test(recortado.selo), recortado.selo);
capturas.push(await captura('painel-11-recorte-executivo'));

// ------------------------------------------- recortes legíveis para o relato
console.log('\nRECORTES');
await avalia(`[...document.querySelectorAll('.lateral .botao')].find(
  (b) => /Voltar às premissas/.test(b.textContent))?.click()`);
await dorme(400);
await avalia(`(() => {
  const s = document.getElementById('sel-poder');
  s.value = '';
  s.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
await dorme(800);

const recortes = [
  ['simulacao', 0, 'recorte-sensibilidade', '.secao:nth-of-type(2)', null, 1400],
  ['abertura', 2, 'recorte-credito', '.faixa-indicadores', '.secao:nth-of-type(1)', 1500],
  ['ano2027', 3, 'recorte-crescimento-2027', '.faixa-indicadores', '.secao:nth-of-type(1)', 1600],
  ['metodos', 4, 'recorte-backtest', '.secao:nth-of-type(2)', null, 1100],
  ['conferencia', 5, 'recorte-conferencia', '.estado-carga', '.secao:nth-of-type(1)', 1700],
  ['projecao', 1, 'recorte-memoria', '.secao:nth-of-type(4)', null, 1500],
];
for (const [, i, nome, de, ate, maxAltura] of recortes) {
  await avalia(`[...document.querySelectorAll('.aba-botao')][${i}].click()`);
  await dorme(500);
  const c = await recorta(nome, de, { ate, maxAltura });
  if (c) { capturas.push(c); console.log(`  ${c}`); } else confere(`recorte ${nome}`, false);
}

// A lista de divergências, que é a parte do painel que fecha o circuito da auditoria.
await avalia(`[...document.querySelectorAll('.aba-botao')][5].click()`);
await dorme(500);
const divs = await recorta('recorte-divergencias', '.lista-divergencias', { maxAltura: 2400 });
if (divs) { capturas.push(divs); console.log(`  ${divs}`); }

// ------------------------------------------------------- erros do console
const erros = eventos
  .filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
  .map((e) => e.params.entry.text);
const excecoes = eventos
  .filter((e) => e.method === 'Runtime.exceptionThrown')
  .map((e) => e.params.exceptionDetails.exception?.description
    ?? e.params.exceptionDetails.text);

console.log('\nCONSOLE');
if (erros.length === 0 && excecoes.length === 0) console.log('  nenhum erro e nenhuma exceção');
for (const x of [...erros, ...excecoes]) console.log(`  ! ${x}`);
confere('o navegador não registrou erro de console', erros.length === 0,
  erros.slice(0, 3).join(' | '));
confere('o navegador não registrou exceção', excecoes.length === 0,
  excecoes.slice(0, 3).join(' | '));

// ------------------------------------------------------------------ relato
console.log('\nVERIFICAÇÕES');
for (const l of relato) console.log(l);
console.log(`\n${relato.length - falhas.length} de ${relato.length} verificações passaram`);
console.log(`\nimagens em ${saida}:`);
for (const c of capturas) console.log(`  ${c}`);

cliente.ws.close();
process.exit(falhas.length === 0 ? 0 : 1);
