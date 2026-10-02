/**
 * Painel lateral: recorte e premissas.
 *
 * Os dois moram FORA das abas, e é decisão estrutural. O recorte vale para a tela
 * inteira, e dois quadros com recortes diferentes e rótulos iguais foi exatamente o
 * que fez o Executivo aparecer com duas projeções diferentes na consulta auditada.
 *
 * Cada premissa traz ao lado o que ela ALCANÇA — quantos meses-linha, quantas
 * linhas. Sem isso o reajuste geral de 5,00% é lido como se governasse o resultado,
 * quando o seu alcance é zero.
 */

import { el, div, nota, span } from './dom.js';
import { PARAMETROS_PADRAO } from '../../nucleo/regras.js';
import { inteiro, pct } from '../../nucleo/formato.js';

const MESES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function campo(rotulo, controle, auxilio) {
  return div('campo', [
    el('label', { texto: rotulo, for: controle.id }),
    controle,
    auxilio ? span('campo-auxilio', auxilio) : null,
  ]);
}

function seletor(id, opcoes, valor, ao) {
  const sel = el('select', { id, onchange: (e) => ao(e.target.value) });
  for (const o of opcoes) {
    sel.append(el('option', {
      value: o.valor === null ? '' : String(o.valor),
      texto: o.rotulo,
      selected: String(o.valor ?? '') === String(valor ?? '') ? '' : null,
    }));
  }
  return sel;
}

function deslizante(id, {
  min, max, passo, valor, ao, formata,
}) {
  const saida = span('deslizante-valor', formata(valor));
  const entrada = el('input', {
    id,
    type: 'range',
    min,
    max,
    step: passo,
    value: valor,
    oninput: (e) => { saida.textContent = formata(Number(e.target.value)); },
    onchange: (e) => ao(Number(e.target.value)),
  });
  return div('deslizante', [entrada, saida]);
}

/**
 * @param {object} opcoes
 * @param {object} opcoes.carga carga corrente
 * @param {(parcial:object)=>void} opcoes.mudaRecorte
 * @param {(parcial:object)=>void} opcoes.mudaPremissa
 * @param {()=>void} opcoes.reinicia
 */
export function painelLateral({
  carga, mudaRecorte, mudaPremissa, reinicia,
}) {
  const { dimensoes: d, recorte: r, par, p26 } = carga;

  const recorte = div('bloco-controle', [
    el('h3', { texto: 'Recorte' }),
    nota('O recorte vale para a tela inteira. Nenhuma aba filtra por conta própria.',
      'neutro'),
    campo('Poder', seletor('sel-poder', [
      { valor: null, rotulo: 'Todos os Poderes' },
      ...d.poderes.map((x) => ({ valor: x, rotulo: nomePoderCurto(x) })),
    ], r.poder, (v) => mudaRecorte({ poder: v === '' ? null : Number(v) }))),
    campo('Órgão', seletor('sel-orgao', [
      { valor: null, rotulo: `Todos os ${d.orgaos.length} órgãos` },
      ...d.orgaos,
    ], r.orgao, (v) => mudaRecorte({ orgao: v === '' ? null : Number(v) }))),
    campo('Unidade orçamentária', seletor('sel-uo', [
      { valor: null, rotulo: `Todas as ${d.unidades.length} unidades` },
      ...d.unidades,
    ], r.uo, (v) => mudaRecorte({ uo: v === '' ? null : Number(v) }))),
    campo('Natureza da despesa', seletor('sel-nat', [
      { valor: null, rotulo: `Todas as ${d.naturezas.length} naturezas` },
      ...d.naturezas,
    ], r.nat, (v) => mudaRecorte({ nat: v === '' ? null : Number(v) }))),
    div('resumo-recorte', [
      span('', `${inteiro(carga.modelo.length)} de ${inteiro(carga.todas.length)} linhas`),
      carga.estadoInteiro ? span('selo selo-ok', 'Estado inteiro')
        : span('selo selo-aviso', 'recorte ativo'),
    ]),
  ]);

  // O alcance de cada premissa, medido na carga corrente. É o que separa premissa
  // que governa o resultado de premissa que só está escrita.
  const m = p26.memoria;
  const alcanceReajuste = m.mesesLinhaReajuste === 0
    ? 'alcança 0 mês-linha: premissa DORMENTE'
    : `alcança ${inteiro(m.mesesLinhaReajuste)} meses-linha`;

  const premissas2026 = div('bloco-controle', [
    el('h3', { texto: 'Premissas de 2026' }),
    campo('Teto do vegetativo mensal', deslizante('par-teto', {
      min: 0, max: 0.05, passo: 0.0005, valor: par.teto, formata: (v) => pct(v),
      ao: (v) => mudaPremissa({ teto: v }),
    }), `corta ${inteiro(m.mesesLinhaTeto)} dos ${inteiro(m.mesesLinhaProjetados)} meses-linha projetados`),
    campo('Reajuste geral', deslizante('par-reajuste', {
      min: 0, max: 0.20, passo: 0.0025, valor: par.reajuste, formata: (v) => pct(v),
      ao: (v) => mudaPremissa({ reajuste: v }),
    }), alcanceReajuste),
    campo('Vigência do reajuste', seletor('par-mes-reajuste',
      MESES_LONGO.map((nome, i) => ({
        valor: i + 1,
        rotulo: i + 1 < par.primeiroMesProjetado ? `${nome} · já realizado` : nome,
      })), par.mesReajuste, (v) => mudaPremissa({ mesReajuste: Number(v) })),
    par.mesReajuste < par.primeiroMesProjetado
      ? 'mês já liquidado: o reajuste não incide na projeção'
      : 'mês em aberto: o reajuste incide'),
    campo('Fator do 13º', deslizante('par-fator13', {
      min: 0, max: 1.2, passo: 0.05, valor: par.fator13, formata: (v) => pct(v, 0),
      ao: (v) => mudaPremissa({ fator13: v }),
    }), `${inteiro(m.linhasCom13)} linhas provisionam, dentro de dezembro`),
  ]);

  const premissas2027 = div('bloco-controle', [
    el('h3', { texto: 'Premissas de 2027' }),
    campo('Vegetativo · ativos (D6)', deslizante('par-veg-ativo', {
      min: 0, max: 0.06, passo: 0.0005, valor: par.vegetativoAtivo27, formata: (v) => pct(v),
      ao: (v) => mudaPremissa({ vegetativoAtivo27: v }),
    }), `${inteiro(carga.p27.memoria.ativo)} linhas na cesta de ativos`),
    campo('Vegetativo · inativos e RPPS (D6)', deslizante('par-veg-inativo', {
      min: 0, max: 0.06, passo: 0.0005, valor: par.vegetativoInativo27, formata: (v) => pct(v),
      ao: (v) => mudaPremissa({ vegetativoInativo27: v }),
    }), `${inteiro(carga.p27.memoria.inativo)} linhas na cesta de inativos`),
    campo('Leitura de D6', seletor('par-modo-d6', [
      { valor: 'ano', rotulo: 'taxa ao ano · (1+v)^(k/12)' },
      { valor: 'mes', rotulo: 'taxa ao mês · (1+v)^k' },
    ], par.modoD6, (v) => mudaPremissa({ modoD6: v })),
    'o enunciado traz o percentual e não diz o período'),
    campo('Aumento nominal (D7)', deslizante('par-nominal', {
      min: 0, max: 0.15, passo: 0.0025, valor: par.aumentoNominal27, formata: (v) => pct(v),
      ao: (v) => mudaPremissa({ aumentoNominal27: v }),
    }), par.aumentoNominal27 === 0
      ? 'em zero: NÃO consta do documento, é acréscimo desta tela'
      : 'premissa DESTA TELA, não do documento'),
    campo('Vigência do nominal', seletor('par-mes-nominal',
      MESES_LONGO.map((nome, i) => ({ valor: i + 1, rotulo: nome })),
      par.mesNominal27, (v) => mudaPremissa({ mesNominal27: Number(v) }))),
  ]);

  const alterada = premissasAlteradas(par);
  const rodape = div('bloco-controle', [
    el('button', {
      classe: 'botao',
      texto: 'Voltar às premissas publicadas',
      disabled: alterada.length === 0 ? '' : null,
      onclick: reinicia,
    }),
    alterada.length === 0
      ? nota('As premissas são as publicadas na consulta de 29/09/2026.', 'neutro')
      : nota([
        'Premissas alteradas: ',
        el('strong', { texto: alterada.join(', ') }),
        '. Os números desta tela deixaram de ser os publicados.',
      ], 'aviso'),
  ]);

  return el('aside', { classe: 'lateral' }, [
    recorte, premissas2026, premissas2027, rodape,
  ]);
}

function nomePoderCurto(chave) {
  return {
    1: 'Legislativo e TCE',
    2: 'Executivo',
    3: 'Judiciário',
    4: 'Ministério Público',
    5: 'Seguridade Social',
    9: 'Não classificado',
  }[chave] ?? `Poder ${chave}`;
}

/** Quais premissas saíram do publicado. É o que justifica a advertência da tela. */
export function premissasAlteradas(par) {
  const nomes = {
    teto: 'teto',
    reajuste: 'reajuste geral',
    mesReajuste: 'vigência do reajuste',
    fator13: 'fator do 13º',
    vegetativoAtivo27: 'vegetativo de ativos',
    vegetativoInativo27: 'vegetativo de inativos',
    modoD6: 'leitura de D6',
    aumentoNominal27: 'aumento nominal',
    mesNominal27: 'vigência do nominal',
    vegetativoTela: 'vegetativo da tela',
  };
  return Object.keys(nomes)
    .filter((k) => par[k] !== PARAMETROS_PADRAO[k])
    .map((k) => nomes[k]);
}
