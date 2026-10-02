import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMPOS, CAMPOS_CHAVE, casaOrigens, chaveOrcamentaria, leCsv, numeroBr, paraCsv,
} from '../nucleo/csv.js';

test('os 25 campos do documento estão na ordem canônica', () => {
  assert.equal(CAMPOS.length, 25);
  assert.equal(CAMPOS[0], 'orgao');
  assert.equal(CAMPOS.at(-1), 'obs');
  assert.equal(CAMPOS_CHAVE.length, 10);
});

test('número brasileiro, inglês e vazio', () => {
  assert.equal(numeroBr('1.234,56'), 1234.56);
  assert.equal(numeroBr('1234,56'), 1234.56);
  assert.equal(numeroBr('1234.56'), 1234.56);
  assert.equal(numeroBr('1,234.56'), 1234.56);
  assert.equal(numeroBr('R$ 1.234,56'), 1234.56);
  assert.equal(numeroBr('0'), 0);
  assert.equal(numeroBr(''), null, 'vazio não é zero');
  assert.equal(numeroBr('   '), null);
  assert.equal(numeroBr('—'), null);
  assert.equal(numeroBr(null), null);
  assert.equal(numeroBr('abc'), null);
});

test('o sinal de menos tipográfico é aceito', () => {
  // É o que a própria tela escreve. Sem isso, um valor negativo copiado do painel e
  // colado de volta seria lido como texto inválido.
  assert.equal(numeroBr('\u2212123,45'), -123.45);
  assert.equal(numeroBr('-123,45'), -123.45);
  assert.equal(numeroBr('\u2013123,45'), -123.45);
});

const CABECALHO = CAMPOS.join(';');
const UMA = '41;4101;4101;4101;2001;319011;100;0;0;;2;1200,00;'
  + '100,00;100,00;100,00;100,00;100,00;100,00;100,00;100,00;'
  + '0,8;1,2;;0,5;obs livre';

test('lê o CSV com cabeçalho e preserva o vazio do cv', () => {
  const { linhas, avisos } = leCsv(`${CABECALHO}\n${UMA}`);
  assert.equal(linhas.length, 1);
  assert.deepEqual(avisos, []);
  const L = linhas[0];
  assert.equal(L.orgao, 41);
  assert.equal(L.nat, 319011);
  assert.equal(L.atual, 1200);
  assert.equal(L.jan, 100);
  assert.equal(L.cv_set, 0.8);
  assert.equal(L.cv_nov, '', 'célula de cv vazia continua vazia');
  assert.equal(L.obs, 'obs livre');
});

test('sem cabeçalho reconhecível assume a ordem canônica E AVISA', () => {
  const { linhas, avisos } = leCsv(UMA);
  assert.equal(linhas.length, 1);
  assert.match(avisos[0], /sem cabeçalho/);
  assert.equal(linhas[0].orgao, 41);
});

/**
 * Cabeçalho curto mas RECONHECÍVEL.
 *
 * `leCsv` só aceita como cabeçalho a primeira linha com cinco ou mais campos
 * conhecidos. O limiar existe para não ler cabeçalho como dado, e os fixtures têm
 * de respeitá-lo: com menos de cinco colunas conhecidas o leitor assume a ordem
 * canônica dos 25 campos e a linha inteira cai no lugar errado.
 */
const CURTO = 'orgao;uo;nat;atual;jan;ago;cv_set;obs';

test('cabeçalho em ordem diferente é respeitado', () => {
  const texto = 'nat;orgao;uo;ago;jul;atual\n319011;41;4101;200;100;1200';
  const { linhas } = leCsv(texto);
  assert.equal(linhas[0].nat, 319011);
  assert.equal(linhas[0].orgao, 41);
  assert.equal(linhas[0].ago, 200);
  assert.equal(linhas[0].jul, 100);
});

test('a escala converte milhões em reais na carga', () => {
  const texto = `${CURTO}\n41;4101;319011;1200;100;100;;`;
  const reais = leCsv(texto).linhas[0];
  const milhoes = leCsv(texto, { escala: 1e6 }).linhas[0];
  assert.equal(reais.atual, 1200);
  assert.equal(milhoes.atual, 1.2e9);
  assert.equal(milhoes.jan, 1e8);
});

test('a escala NÃO alcança a coluna de cv', () => {
  // cv é taxa, não dinheiro. Escalá-lo multiplicaria o crescimento por um milhão.
  const { linhas } = leCsv(`${CURTO}\n41;4101;319011;1200;100;100;0,8;`, { escala: 1e6 });
  assert.equal(linhas[0].cv_set, 0.8);
  assert.equal(linhas[0].jan, 1e8);
});

test('separador é detectado entre ponto-e-vírgula e vírgula', () => {
  const comVirgula = leCsv(`${CURTO.replace(/;/g, ',')}\n41,4101,319011,1200,100,100,,`);
  assert.equal(comVirgula.separador, ',');
  assert.equal(comVirgula.linhas[0].orgao, 41);
  assert.equal(leCsv(`${CURTO}\n41;4101;319011;1200;100;100;;`).separador, ';');
});

test('campo entre aspas com o separador dentro não é quebrado', () => {
  const { linhas } = leCsv(`${CURTO}\n41;4101;319011;1200;100;100;;"a; b; c"`);
  assert.equal(linhas[0].obs, 'a; b; c');
  assert.equal(linhas[0].atual, 1200);
});

test('aspas duplicadas dentro do campo viram uma aspa', () => {
  const { linhas } = leCsv(`${CURTO}\n41;4101;319011;1200;100;100;;"diz ""assim"" aqui"`);
  assert.equal(linhas[0].obs, 'diz "assim" aqui');
});

test('linha sem natureza é descartada e o descarte é avisado', () => {
  const { linhas, avisos } = leCsv(`${CURTO}\n41;4101;319011;1;1;1;;\n`
    + '41;4101;;1;1;1;;\n41;4101;319012;1;1;1;;');
  assert.equal(linhas.length, 2);
  assert.match(avisos.join(' '), /1 linha\(s\) sem natureza/);
});

test('cabeçalho com menos de cinco campos conhecidos NÃO é cabeçalho', () => {
  // E o leitor avisa, em vez de ler a linha de títulos como se fosse dado.
  const { avisos } = leCsv('nat;atual;jan\n319011;1200;100');
  assert.match(avisos.join(' '), /sem cabeçalho/);
});

test('arquivo vazio devolve lista vazia em vez de quebrar', () => {
  assert.deepEqual(leCsv('').linhas, []);
  assert.deepEqual(leCsv('\n\n  \n').linhas, []);
});

test('a chave normaliza código como inteiro e mantém o marcador como texto', () => {
  // É o ponto mais barato de errar: a planilha perde o zero à esquerda e o
  // relatório o mantém. Comparar texto com texto acha zero correspondências.
  const planilha = {
    orgao: 41, uge: 4101, ugr: 4101, uo: 4101, acao: 2001,
    nat: 319011, fonte: 100, det: 0, idex: 0, marcador: 'MED',
  };
  const relatorio = {
    orgao: '041', uge: '04101', ugr: '04101', uo: '04101', acao: '2001',
    nat: '319011', fonte: '0100', det: '00', idex: '0', marcador: 'MED',
  };
  assert.equal(chaveOrcamentaria(planilha), chaveOrcamentaria(relatorio));
});

test('marcador diferente é chave diferente', () => {
  // O marcador é o que distingue a linha de mediana da linha comum na mesma
  // natureza. Normalizá-lo como número apagaria a distinção.
  const a = { orgao: 41, uo: 4101, nat: 319016, marcador: 'MED' };
  const b = { orgao: 41, uo: 4101, nat: 319016, marcador: '' };
  assert.notEqual(chaveOrcamentaria(a), chaveOrcamentaria(b));
});

test('casamento um para um aceita divergência de agosto e de dotação', () => {
  const chave = {
    orgao: 41, uge: 1, ugr: 1, uo: 4101, acao: 1, nat: 319011,
    fonte: 100, det: 0, idex: 0, marcador: '',
  };
  const rel = [{ ...chave, jan: 100, jul: 100, ago: 100, atual: 1000 }];
  const pla = [{ ...chave, jan: 100, jul: 100, ago: 120, atual: 1200 }];
  const r = casaOrigens(rel, pla);
  assert.equal(r.cardinalidade1a1, true);
  assert.equal(r.podeCarregar, true, 'agosto pode divergir: é movimento');
  assert.equal(r.divergenciaJanJul.length, 0);
  assert.equal(r.divergenciaAgosto.length, 1);
  assert.equal(r.divergenciaAgosto[0].diferenca, 20);
});

test('divergência em jan–jul impede a carga', () => {
  const chave = {
    orgao: 41, uge: 1, ugr: 1, uo: 4101, acao: 1, nat: 319011,
    fonte: 100, det: 0, idex: 0, marcador: '',
  };
  const r = casaOrigens(
    [{ ...chave, jan: 100, jul: 100 }],
    [{ ...chave, jan: 150, jul: 100 }],
  );
  assert.equal(r.cardinalidade1a1, true);
  assert.equal(r.podeCarregar, false, 'as duas origens não são a mesma série');
  assert.equal(r.divergenciaJanJul.length, 1);
  assert.equal(r.divergenciaJanJul[0].mes, 'jan');
});

test('chave duplicada quebra a cardinalidade e PARA a carga', () => {
  // Afrouxar a chave é a pior saída: ela casa uma linha com várias e faz o fator
  // de crescimento incidir na linha errada.
  const chave = {
    orgao: 41, uge: 1, ugr: 1, uo: 4101, acao: 1, nat: 319011,
    fonte: 100, det: 0, idex: 0, marcador: '',
  };
  const r = casaOrigens([chave, { ...chave }], [chave]);
  assert.equal(r.cardinalidade1a1, false);
  assert.equal(r.podeCarregar, false);
  assert.equal(r.duplicadas.length, 1);
});

test('linha só numa das origens aparece nominalmente', () => {
  const a = {
    orgao: 41, uge: 1, ugr: 1, uo: 4101, acao: 1, nat: 319011,
    fonte: 100, det: 0, idex: 0, marcador: '',
  };
  const b = { ...a, nat: 319012 };
  const r = casaOrigens([a], [b]);
  assert.equal(r.pares.length, 0);
  assert.equal(r.soRelatorio.length, 1);
  assert.equal(r.soPlanilha.length, 1);
  assert.equal(r.cardinalidade1a1, false);
});

test('a volta pelo CSV preserva os valores', () => {
  const { linhas } = leCsv(`${CABECALHO}\n${UMA}`);
  const ida = leCsv(paraCsv(linhas)).linhas[0];
  assert.equal(ida.nat, 319011);
  assert.equal(ida.atual, 1200);
  assert.equal(ida.cv_set, 0.8);
  assert.equal(ida.cv_nov, '', 'o vazio sobrevive à ida e à volta');
});
