#!/usr/bin/env node
/**
 * Gravação de um percurso pelo painel, sem dependência.
 *
 * Mesmo cliente CDP da verificação, só que em vez de medir ele encena: conduz o
 * painel por um roteiro, liga o `Page.screencast` e guarda cada quadro com a hora
 * em que chegou. O screencast só emite quadro quando a tela muda, então a duração
 * de cada um é a distância até o próximo — é isso que o demuxer `concat` do ffmpeg
 * consome. Uma pausa de leitura vira um quadro longo, e não trezentos iguais.
 *
 *   node scripts/grava-demo.mjs [--url ...] [--saida ARQUIVO.mp4]
 */

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const pega = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : padrao;
};
const url = pega('url', 'http://localhost:8080/');
const cdp = pega('cdp', 'http://localhost:9222');
const saida = resolve(pega('saida', '/opt/cursor/artifacts/painel_folha_pr_demo.mp4'));
const quadros = resolve(pega('quadros', '/tmp/demo-quadros'));

const LARGURA = 1440;
const ALTURA = 900;

rmSync(quadros, { recursive: true, force: true });
mkdirSync(quadros, { recursive: true });
mkdirSync(dirname(saida), { recursive: true });

async function alvo() {
  const r = await fetch(`${cdp}/json/list`);
  const abas = await r.json();
  const pagina = abas.find((t) => t.type === 'page');
  if (!pagina) throw new Error('nenhuma página aberta no Chrome');
  return pagina.webSocketDebuggerUrl;
}

function conecta(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let proximo = 1;
  const pendentes = new Map();
  const ouvintes = new Map();

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pendentes.has(msg.id)) {
      const { resolve: ok, reject: nok } = pendentes.get(msg.id);
      pendentes.delete(msg.id);
      if (msg.error) nok(new Error(msg.error.message));
      else ok(msg.result);
    } else if (msg.method && ouvintes.has(msg.method)) {
      ouvintes.get(msg.method)(msg.params);
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
      if (pendentes.has(id)) { pendentes.delete(id); nok(new Error(`tempo esgotado em ${method}`)); }
    }, 60_000);
  });

  const escuta = (method, fn) => ouvintes.set(method, fn);
  return { ws, pronto, envia, escuta };
}

const dorme = (ms) => new Promise((ok) => { setTimeout(ok, ms); });

const cliente = conecta(await alvo());
await cliente.pronto;
const { envia, escuta } = cliente;

await envia('Runtime.enable');
await envia('Page.enable');

async function avalia(expressao) {
  const r = await envia('Runtime.evaluate', {
    expression: expressao, returnByValue: true, awaitPromise: true,
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
    if (v === 'erro') throw new Error('o painel reportou falha de carga');
    if (Date.now() > ate) throw new Error('a tela não ficou pronta');
    await dorme(200);
  }
}

// ---------------------------------------------------------------- a legenda
/*
 * A faixa de legenda é do filme, não do painel. Ela entra por injeção e sai no
 * fim, para que nenhuma captura do relato a herde.
 */
const LEGENDA = `(texto, tom) => {
  let d = document.getElementById('legenda-demo');
  if (!d) {
    d = document.createElement('div');
    d.id = 'legenda-demo';
    document.body.appendChild(d);
    Object.assign(d.style, {
      position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: '99999',
      padding: '16px 28px', color: '#fff', textAlign: 'center',
      font: '600 18px/1.45 ui-sans-serif, system-ui, sans-serif',
      boxShadow: '0 -10px 30px rgba(0,0,0,0.25)', transition: 'background 180ms',
    });
  }
  d.style.background = tom === 'bom' ? 'rgba(6,78,59,0.96)'
    : tom === 'atencao' ? 'rgba(120,53,15,0.96)' : 'rgba(15,23,42,0.96)';
  d.textContent = texto;
}`;

const legenda = async (texto, tom = 'neutro') => {
  await avalia(`(${LEGENDA})(${JSON.stringify(texto)}, ${JSON.stringify(tom)})`);
};

// ------------------------------------------------------------ movimentações
/** Rolagem em passos, porque o screencast só gera quadro quando a tela muda. */
async function rola(ate, passos = 26) {
  const de = await avalia('window.scrollY');
  for (let i = 1; i <= passos; i += 1) {
    const y = de + ((ate - de) * i) / passos;
    await avalia(`window.scrollTo(0, ${Math.round(y)})`);
    await dorme(26);
  }
  await dorme(140);
}

async function rolaAte(seletor, folga = 120) {
  const y = await avalia(`(() => {
    const a = document.querySelector(${JSON.stringify(seletor)});
    if (!a) return window.scrollY;
    return a.getBoundingClientRect().top + window.scrollY - ${folga};
  })()`);
  await rola(Math.max(0, y));
}

async function aba(indice) {
  await avalia(`[...document.querySelectorAll('.aba-botao')][${indice}].click()`);
  await avalia('window.scrollTo(0, 0)');
  await dorme(520);
}

/**
 * Arrasto de verdade no deslizante, com eventos de mouse.
 *
 * Dava para atribuir `value` e disparar `change`, que é o que a verificação faz —
 * mas aí o polegar salta sem que a gravação mostre a mão. Num filme, o movimento
 * é a prova de que o controle é o que recalcula.
 */
async function arrasta(id, fracao) {
  const r = await avalia(`(() => {
    const i = document.getElementById(${JSON.stringify(id)});
    i.scrollIntoView({ block: 'center' });
    const b = i.getBoundingClientRect();
    return { x: b.left, y: b.top + b.height / 2, w: b.width, atual: Number(i.value),
      min: Number(i.min), max: Number(i.max) };
  })()`);
  await dorme(260);

  const fx = (r.atual - r.min) / (r.max - r.min);
  const x0 = r.x + 8 + (r.w - 16) * fx;
  const x1 = r.x + 8 + (r.w - 16) * fracao;

  await envia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: r.y });
  await dorme(220);
  await envia('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: x0, y: r.y, button: 'left', clickCount: 1,
  });
  const passos = 22;
  for (let i = 1; i <= passos; i += 1) {
    await envia('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: x0 + ((x1 - x0) * i) / passos, y: r.y, button: 'left',
    });
    await dorme(34);
  }
  await envia('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: x1, y: r.y, button: 'left', clickCount: 1,
  });
  await dorme(700);
}

async function clicaTexto(seletor, padrao) {
  const r = await avalia(`(() => {
    const a = [...document.querySelectorAll(${JSON.stringify(seletor)})]
      .find((x) => ${padrao}.test(x.textContent));
    if (!a) return null;
    a.scrollIntoView({ block: 'center' });
    const b = a.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  })()`);
  if (!r) throw new Error(`não achei ${padrao} em ${seletor}`);
  await dorme(260);
  await envia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
  await dorme(160);
  await envia('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1,
  });
  await envia('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1,
  });
  await dorme(800);
}

// -------------------------------------------------------------- a gravação
console.log(`Abrindo ${url}`);
await envia('Emulation.setDeviceMetricsOverride', {
  width: LARGURA, height: ALTURA, deviceScaleFactor: 1, mobile: false,
});
await envia('Page.navigate', { url });
await esperaPronto();
await dorme(600);

const capturados = [];
let n = 0;
escuta('Page.screencastFrame', (p) => {
  const nome = join(quadros, `q${String(n).padStart(5, '0')}.jpg`);
  writeFileSync(nome, Buffer.from(p.data, 'base64'));
  capturados.push({ nome, t: Date.now() });
  n += 1;
  envia('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {});
});

await envia('Page.startScreencast', {
  format: 'jpeg', quality: 86, maxWidth: LARGURA, maxHeight: ALTURA, everyNthFrame: 1,
});

// 1. abertura
await legenda('Projeção da folha do Paraná · reimplementação da consulta de 29/09/2026');
await dorme(2600);
await legenda('O topo carrega os três números publicados: 2026, 2027 e o crédito a abrir.');
await dorme(3400);

// 2. a premissa dormente
await legenda('Cada premissa publicada ao lado do que ela realmente custa.');
await rolaAte('.secao:nth-of-type(2)');
await dorme(3200);
await legenda('O reajuste geral de 5% vigora em maio, mês já liquidado: alcança 0 mês-linha '
  + 'e custa R$ 0,00. É premissa dormente.', 'atencao');
await dorme(5200);

// 3. a conferência
await aba(5);
await legenda('A conferência separa três classes — e só uma bloqueia.');
await dorme(3200);
await legenda('39 identidades internas fecham com diferença de R$ 0,00. '
  + 'Esta é a classe que TRAVA a carga.', 'bom');
await dorme(4200);
await legenda('Aderência ao publicado e distância entre fontes informam, mas nunca bloqueiam: '
  + 'uma base nova PODE divergir do publicado.');
await rolaAte('.secao:nth-of-type(1)', 90);
await dorme(4600);

// 4. as divergências da auditoria
await legenda('As nove divergências da auditoria, cada uma com achado, causa e a correção '
  + 'estrutural que entrou no código.');
await rolaAte('.lista-divergencias', 90);
await dorme(4200);
await legenda('A primeira é o defeito do quadro 28: três agregações somavam R$ 1.385,0 mi '
  + 'a menos que o exercício do próprio quadro.', 'atencao');
await dorme(5200);

// 5. mexer no teto
await aba(0);
await legenda('Agora a simulação. O teto do vegetativo mensal está em 1,50%.');
await dorme(2800);
await legenda('Subindo o teto de 1,50% para 4,00%…');
// O deslizante vai de 0 a 0,05, então 4,00% é a fração 0,8 do curso.
await arrasta('par-teto', 0.8);
await dorme(600);
await rola(0);
await legenda('2026 vai de R$ 47,39 bi a R$ 47,91 bi — e 2027 sobe junto, para R$ 52,51 bi.',
  'atencao');
await dorme(4600);
await legenda('2027 se move porque sua âncora é dezembro de 2026 projetado (regra D2). '
  + 'Mexer numa premissa de 2026 desloca os doze meses de 2027.');
await dorme(5000);

// 6. a prova estrutural: premissa alterada não trava a carga
await aba(5);
await legenda('Com a premissa fora do publicado, a conferência é o teste decisivo.');
await dorme(3000);
await legenda('As 39 identidades internas continuam fechando. A aderência diverge em 57 '
  + 'verificações — e a carga segue liberada, porque aderência não bloqueia.', 'bom');
await dorme(5400);

// 7. voltar ao publicado
await aba(0);
await legenda('Voltar às premissas publicadas.');
await clicaTexto('.lateral .botao', '/Voltar às premissas/');
await rola(0);
await legenda('R$ 47,39 bi outra vez: o estado publicado é sempre recuperável.', 'bom');
await dorme(3600);

// 8. o recorte
await legenda('O recorte vale para o painel inteiro, não só para a aba aberta.');
await avalia(`(() => {
  const s = document.getElementById('sel-poder');
  s.scrollIntoView({ block: 'center' });
})()`);
await dorme(900);
await avalia(`(() => {
  const s = document.getElementById('sel-poder');
  s.value = '2';
  s.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
await dorme(1100);
await rola(0);
await legenda('Poder Executivo: R$ 24,68 bi em 700 das 1.023 linhas — o valor do quadro 13.',
  'bom');
await dorme(4600);
await legenda('Todo número da tela vem de uma única montagem de carga. '
  + 'Nenhuma aba recalcula nada por conta própria (regra A9).');
await dorme(4400);

await envia('Page.stopScreencast');
await dorme(300);
await avalia(`document.getElementById('legenda-demo')?.remove()`);
await envia('Emulation.clearDeviceMetricsOverride');
cliente.ws.close();

// ------------------------------------------------------------- a montagem
console.log(`${capturados.length} quadros capturados`);
if (capturados.length < 10) throw new Error('quadros de menos para montar o vídeo');

const fim = Date.now();
const linhas = [];
for (let i = 0; i < capturados.length; i += 1) {
  const ate = i + 1 < capturados.length ? capturados[i + 1].t : fim;
  const dur = Math.max(0.033, (ate - capturados[i].t) / 1000);
  linhas.push(`file '${capturados[i].nome}'`, `duration ${dur.toFixed(3)}`);
}
linhas.push(`file '${capturados[capturados.length - 1].nome}'`);
const lista = join(quadros, 'lista.txt');
writeFileSync(lista, `${linhas.join('\n')}\n`);

const r = spawnSync('ffmpeg', [
  '-y', '-f', 'concat', '-safe', '0', '-i', lista,
  '-vf', `fps=24,scale=${LARGURA}:${ALTURA}:force_original_aspect_ratio=decrease,`
    + `pad=${LARGURA}:${ALTURA}:(ow-iw)/2:(oh-ih)/2:white,format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-movflags', '+faststart',
  saida,
], { encoding: 'utf8' });
if (r.status !== 0) {
  console.error(r.stderr?.slice(-3000));
  throw new Error('ffmpeg falhou');
}
console.log(`vídeo em ${saida}`);
