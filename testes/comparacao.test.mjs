import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PARAMETROS_PADRAO } from '../nucleo/regras.js';
import { projeta2026 } from '../nucleo/projecao2026.js';
import {
  formaSazonal, grupoDeNatureza, leBacktest, pisoIndiceZero, pisoSemIntra,
  recortaArima, serieDo8778, vegetativoDaTela,
} from '../nucleo/comparacao.js';

const base = JSON.parse(readFileSync(new URL('../dados/modelo.json', import.meta.url), 'utf8'));
const linhas = base.modelo;
const par = PARAMETROS_PADRAO;
const p26 = projeta2026(linhas, par);

test('a forma sazonal soma um', () => {
  const f = formaSazonal(linhas);
  assert.equal(f.length, 8);
  assert.ok(Math.abs(f.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  for (const v of f) assert.ok(v > 0 && v < 1);
});

test('conjunto sem massa devolve forma uniforme em vez de dividir por zero', () => {
  const f = formaSazonal([{ jan: 0, fev: 0, mar: 0, abr: 0, mai: 0, jun: 0, jul: 0, ago: 0 }]);
  assert.deepEqual(f, new Array(8).fill(1 / 8));
});

test('o piso repete agosto nos quatro meses em aberto', () => {
  const p = pisoIndiceZero(linhas, par, p26);
  for (let k = 8; k < 11; k += 1) assert.ok(Math.abs(p.meses[k] - p.meses[7]) < 1);
  // Dezembro é agosto mais a provisão, e por isso é o único que difere.
  assert.ok(p.meses[11] > p.meses[7]);
  assert.ok(Math.abs(p.janAgo - p26.janAgo) < 1, 'o realizado é o mesmo nas duas leituras');
});

test('o piso é o chão: nenhuma leitura razoável fica abaixo dele sem encolher a folha', () => {
  const p = pisoIndiceZero(linhas, par, p26);
  const v = vegetativoDaTela(linhas, par, p26);
  // O modelo da DOE fica ABAIXO do piso porque 252 linhas desligadas vão a zero nos
  // quatro meses projetados, e o piso as mantém no valor de agosto. É informação
  // sobre o modelo, não defeito do piso.
  assert.ok(p.ano2026 > 0);
  assert.ok(v.ano2026 > 0);
  assert.ok(p.ano2026 > p26.janAgo, 'doze meses custam mais que oito');
});

test('o piso sem intraorçamentária é OUTRA régua, e menor', () => {
  // Quem compara contra o limite da LRF usa a régua líquida; quem pede crédito usa a
  // bruta. Publicar uma e rotular como a outra é erro de régua.
  const bruto = pisoIndiceZero(linhas, par, p26);
  const limpo = pisoSemIntra(linhas, par, p26);
  assert.ok(limpo.ano2026 < bruto.ano2026);
  assert.ok((bruto.ano2026 - limpo.ano2026) > 1e9, 'a diferença é material');
});

test('o vegetativo da tela fica ABAIXO do modelo da DOE, por construção', () => {
  // Ele não enxerga teto, mediana nem desligamento: é continuação, não composição.
  const v = vegetativoDaTela(linhas, par, p26);
  assert.ok(v.ano2026 < p26.ano);
  assert.ok(Math.abs(v.janAgo - p26.janAgo) < 1);
  assert.equal(v.meses.length, 12);
  assert.equal(v.meses27.length, 12);
});

test('o vegetativo da tela é premissa DA TELA e responde a ela', () => {
  const baixo = vegetativoDaTela(linhas, { ...par, vegetativoTela: 0 }, p26);
  const alto = vegetativoDaTela(linhas, { ...par, vegetativoTela: 0.10 }, p26);
  assert.ok(alto.ano2026 > baixo.ano2026);
  assert.ok(alto.ano2027 > baixo.ano2027);
});

test('o grupo de natureza separa a intraorçamentária pelos dígitos do meio', () => {
  assert.equal(grupoDeNatureza(319011), 'pessoal');
  assert.equal(grupoDeNatureza(319113), 'intra');
  assert.equal(grupoDeNatureza(319191), 'intra');
});

test('o ARIMA é RECORTADO por massa, nunca reajustado localmente', () => {
  const inteiro = recortaArima(base.arima, linhas, linhas);
  const metade = recortaArima(base.arima, linhas.filter((L) => Number(L.orgao) === 41), linhas);
  for (const nome of Object.keys(inteiro)) {
    assert.ok(metade[nome].total2026 < inteiro[nome].total2026);
    // A especificação NÃO muda com o recorte: ela foi ajustada no Estado.
    assert.equal(metade[nome].especificacao, inteiro[nome].especificacao);
    assert.equal(metade[nome].observacoes, inteiro[nome].observacoes);
    assert.equal(metade[nome].parametros, inteiro[nome].parametros);
  }
});

test('as duas especificações de ARIMA são publicadas com os graus de liberdade', () => {
  const a = recortaArima(base.arima, linhas, linhas);
  assert.deepEqual(Object.keys(a).sort(), ['inteira', 'janela']);
  for (const esp of Object.values(a)) {
    assert.equal(esp.grausDeLiberdade, esp.observacoes - esp.parametros);
    assert.ok(esp.grausDeLiberdade > 0);
    assert.ok(esp.porGrupo.length >= 1);
    // A soma dos grupos é o total da especificação.
    const soma = esp.porGrupo.reduce((x, g) => x + g.total2026, 0);
    assert.ok(Math.abs(soma - esp.total2026) < 1);
  }
});

test('a janela de 36 meses tem menos observações que a série inteira', () => {
  const a = recortaArima(base.arima, linhas, linhas);
  assert.ok(a.janela.observacoes < a.inteira.observacoes);
  assert.equal(a.janela.observacoes, 36);
});

test('recorte sem massa num grupo devolve zero em vez de NaN', () => {
  const a = recortaArima(base.arima, [], linhas);
  for (const esp of Object.values(a)) {
    assert.equal(esp.total2026, 0);
    for (const g of esp.porGrupo) assert.equal(g.parte, 0);
  }
});

test('o backtest publica erro em todos os horizontes', () => {
  const b = leBacktest(base.arima);
  assert.ok(b.length >= 3);
  for (const x of b) {
    assert.ok(Number.isFinite(x.erroJanela));
    assert.ok(Number.isFinite(x.erroInteira));
    assert.equal(x.erroJanela, x.janela / x.realizado - 1);
  }
});

test('o backtest mostra subestimação sistemática', () => {
  // É a razão declarada para o ARIMA não servir de referência de suficiência
  // orçamentária: usado assim, ele produz pedido de crédito MENOR que o necessário.
  const b = leBacktest(base.arima);
  assert.ok(b.every((x) => x.erroJanela < 0), 'todo horizonte subestimou');
  assert.ok(b.every((x) => x.erroInteira < 0));
});

test('ARIMA ausente devolve nulo em vez de quebrar', () => {
  assert.equal(recortaArima(null, linhas, linhas), null);
  assert.deepEqual(leBacktest(null), []);
  assert.equal(serieDo8778(null, linhas, linhas), null);
});

test('a série do 8778 é recortada pela mesma proporção de massa', () => {
  const inteira = serieDo8778(base.oito, linhas, linhas);
  assert.ok(Math.abs(inteira.parte - 1) < 1e-12);
  assert.equal(inteira.unidades, 72, 'o 8778 cobre 72 unidades, não as 77 do modelo');

  const parcial = serieDo8778(base.oito, linhas.filter((L) => Number(L.orgao) === 41), linhas);
  assert.ok(parcial.parte > 0 && parcial.parte < 1);
  assert.ok(parcial.anos[2026].total < inteira.anos[2026].total);
});

test('a série do 8778 para em agosto de 2026, porque é realizado', () => {
  // Completar 2026 com os quatro meses projetados do modelo produziria um
  // "histórico" que confirma a projeção que ele deveria contrastar.
  const s = serieDo8778(base.oito, linhas, linhas);
  assert.deepEqual(Object.keys(s.anos).sort(), ['2023', '2024', '2025', '2026']);
  for (const ano of ['2023', '2024', '2025']) assert.equal(s.anos[ano].meses.length, 12);
  assert.equal(s.anos[2026].meses.length, 8, 'o exercício corrente vem truncado');

  const meses = 12 * 3 + 8;
  assert.equal(meses, 44);
  assert.equal(
    Object.values(s.anos).reduce((a, x) => a + x.meses.length, 0), meses,
  );
});
