/**
 * Montagem do painel.
 *
 * A regra estrutural está aqui: `montaCarga` roda UMA vez por mudança de premissa ou
 * de recorte, e as oito abas leem o mesmo objeto. Nenhuma aba recalcula nada.
 *
 * É a correção do defeito que motivou o painel. A consulta auditada publicava
 * R$ 24.681,0 mi no quadro 13 e R$ 24.771,0 mi no quadro 22, ambos rotulados como
 * projeção de 2026 do Poder Executivo, porque eram duas posições da mesma grandeza
 * calculadas em momentos diferentes. Com um ancestral só, dois números diferentes
 * para a mesma coisa passam a exigir dois cálculos diferentes, e só existe um.
 */

import { montaCarga } from '../nucleo/carga.js';
import { PARAMETROS_PADRAO } from '../nucleo/regras.js';
import { PUBLICADO } from '../dados/publicado.js';
import { div, el, limpa, span } from './ui/dom.js';
import { painelLateral, premissasAlteradas } from './ui/controles.js';
import { bi, inteiro } from '../nucleo/formato.js';

import * as simulacao from './abas/simulacao.js';
import * as projecao from './abas/projecao.js';
import * as abertura from './abas/abertura.js';
import * as ano2027 from './abas/ano2027.js';
import * as metodos from './abas/metodos.js';
import * as conferencia from './abas/conferencia.js';
import * as regras from './abas/regras.js';
import * as cargaCsv from './abas/cargaCsv.js';

const ABAS = [simulacao, projecao, abertura, ano2027, metodos, conferencia, regras, cargaCsv];

const estado = {
  base: null,
  /** Linhas carregadas pelo usuário, quando houver. Nulo usa a base sintética. */
  substitutas: null,
  par: { ...PARAMETROS_PADRAO },
  recorte: null,
  aba: 'simulacao',
  carga: null,
};

async function carrega() {
  const r = await fetch('../dados/modelo.json', { cache: 'no-store' });
  if (!r.ok) throw new Error(`modelo.json devolveu ${r.status}`);
  return r.json();
}

/**
 * Recalcula a carga. É o ÚNICO lugar do painel que chama `montaCarga`.
 *
 * `premissasAlteradas` é anexado à carga em vez de ser consultado por cada aba: a
 * advertência de que os números deixaram de ser os publicados tem de ser a mesma em
 * toda aba, e calculá-la em oito lugares é convidar oito respostas.
 */
function recalcula() {
  const base = estado.substitutas
    ? { ...estado.base, modelo: estado.substitutas }
    : estado.base;
  const carga = montaCarga(base, estado.par, estado.recorte, PUBLICADO);
  carga.premissasAlteradas = premissasAlteradas(estado.par);
  carga.baseSubstituida = estado.substitutas !== null;
  estado.carga = carga;
  return carga;
}

function desenha() {
  const carga = recalcula();
  const raiz = document.getElementById('painel');
  limpa(raiz);

  const aba = ABAS.find((a) => a.meta.chave === estado.aba) ?? ABAS[0];

  raiz.append(
    topo(carga),
    div('corpo', [
      painelLateral({
        carga,
        mudaRecorte: (parcial) => {
          // Mudar um nível derruba os de baixo. O saneamento do núcleo já faria isso,
          // mas fazê-lo aqui também evita a tela piscar com uma seleção impossível.
          const ordem = ['poder', 'orgao', 'uo', 'nat'];
          const i = ordem.findIndex((k) => k in parcial);
          const novo = { ...(estado.recorte ?? {}), ...parcial };
          for (const k of ordem.slice(i + 1)) novo[k] = null;
          estado.recorte = novo;
          desenha();
        },
        mudaPremissa: (parcial) => {
          estado.par = { ...estado.par, ...parcial };
          desenha();
        },
        reinicia: () => {
          estado.par = { ...PARAMETROS_PADRAO };
          desenha();
        },
      }),
      el('main', { classe: 'principal' }, [
        navegacao(carga),
        aba.desenha(carga, desenha, vaPara, troca),
        rodape(carga),
      ]),
    ]),
  );
}

function vaPara(chave) {
  if (!ABAS.some((a) => a.meta.chave === chave)) return;
  estado.aba = chave;
  desenha();
  document.querySelector('.principal')?.scrollTo({ top: 0 });
}

function troca(linhas) {
  estado.substitutas = linhas;
  estado.recorte = null;
  desenha();
}

function topo(carga) {
  const c = carga.conferencia;
  return el('header', { classe: 'topo' }, [
    div('topo-marca', [
      el('h1', { texto: 'Projeção da folha de pagamento · Estado do Paraná' }),
      span('topo-sub', 'Reimplementação conferida do modelo da DOE/SEFA-PR · '
        + 'consulta de 29/09/2026, 13h35'),
    ]),
    div('topo-estado', [
      div('topo-numero', [
        span('topo-rotulo', '2026'),
        span('topo-valor', bi(carga.p26.ano)),
      ]),
      div('topo-numero', [
        span('topo-rotulo', '2027'),
        span('topo-valor', bi(carga.p27.ano)),
      ]),
      div('topo-numero', [
        span('topo-rotulo', 'Crédito a abrir'),
        span('topo-valor', bi(carga.credito.liquida)),
      ]),
      span(`selo ${c.travada ? 'selo-erro' : 'selo-ok'}`,
        c.travada
          ? `CARGA TRAVADA · ${inteiro(c.falhas.length)} identidades não fecham`
          : `carga conferida · ${inteiro(c.resumo.interna.total)} identidades fecham`),
    ]),
  ]);
}

function navegacao(carga) {
  return el('nav', { classe: 'abas' }, ABAS.map((a) => el('button', {
    classe: `aba-botao ${a.meta.chave === estado.aba ? 'ativa' : ''}`.trim(),
    onclick: () => vaPara(a.meta.chave),
    title: a.meta.pergunta,
  }, [
    span('aba-rotulo', a.meta.rotulo),
    a.meta.chave === 'conferencia' && carga.conferencia.travada
      ? span('aba-marca', '!') : null,
  ])));
}

function rodape(carga) {
  return el('footer', { classe: 'rodape' }, [
    el('p', {
      texto: 'Os valores circulam em reais no sistema inteiro; a conversão para '
        + 'milhões e bilhões acontece só na apresentação. É por isso que a tolerância '
        + 'de um real da conferência é um real de verdade.',
    }),
    el('p', {
      texto: `Esta carga vem de um conjunto ${carga.baseSubstituida ? 'CARREGADO pelo usuário'
        : 'sintético calibrado'} de ${inteiro(carga.todas.length)} linhas, construído `
        + 'para reproduzir os números publicados na consulta. Ele não é a base real da '
        + 'SEFA-PR: serve para que cada número da tela possa ser conferido contra a '
        + 'regra que o produziu.',
    }),
  ]);
}

function falha(erro) {
  const raiz = document.getElementById('painel');
  limpa(raiz);
  raiz.append(div('estado-carga estado-erro', [
    span('estado-marca', '!'),
    div('', [
      el('strong', { texto: 'O painel não carregou. ' }),
      String(erro?.message ?? erro),
      el('p', {
        texto: 'Rode `node scripts/gerar-dados.mjs` para gerar dados/modelo.json e '
          + 'sirva o repositório com `node servidor.mjs`.',
      }),
    ]),
  ]));
}

try {
  estado.base = await carrega();
  desenha();
  // A tela só é marcada como pronta depois do primeiro desenho. É o que a verificação
  // automatizada espera, em vez de dormir um tempo arbitrário.
  document.body.dataset.pronto = '1';
} catch (erro) {
  falha(erro);
  document.body.dataset.pronto = 'erro';
  throw erro;
}
