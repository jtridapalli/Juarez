import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CV_VAZIO, NAT_13, NAT_MEDIANA, PARAMETROS_PADRAO, alcancadoPeloReajuste,
  cvDoMes, ehD4, ehDesligada, ehInativoRPPS, ehMediana, elemento, gnd, mediana,
  modalidade, nomeDoPoder, numero, poderDaLinha, provisiona13, realizado8,
  somaEspecificos,
} from '../nucleo/regras.js';

test('elemento, modalidade e GND saem dos dígitos da natureza', () => {
  assert.equal(elemento(319011), 11);
  assert.equal(modalidade(319011), 90);
  assert.equal(gnd(319011), 1);
  assert.equal(elemento(319113), 13);
  assert.equal(modalidade(319113), 91);
});

test('natureza com menos de seis dígitos é preenchida à esquerda', () => {
  // Uma natureza lida de planilha perde o zero à esquerda. Sem o preenchimento,
  // `elemento` leria os dígitos errados e a linha cairia no balde errado.
  assert.equal(elemento(31011), 11);
  assert.equal(gnd(31011), 3);
});

test('vazio não é zero', () => {
  assert.equal(numero(''), null);
  assert.equal(numero(null), null);
  assert.equal(numero(undefined), null);
  assert.equal(numero(0), 0);
  assert.equal(numero('1234,5'), null, 'vírgula não é separador de número cru');
  assert.equal(numero('1234.5'), 1234.5);
});

test('realizado8 devolve oito meses e trata vazio como zero na soma', () => {
  const L = { jan: 10, fev: 20, mar: '', abr: 40, mai: 50, jun: 60, jul: 70, ago: 80 };
  assert.deepEqual(realizado8(L), [10, 20, 0, 40, 50, 60, 70, 80]);
});

test('mediana com número par de termos é a média dos dois centrais', () => {
  assert.equal(mediana([1, 2, 3, 4]), 2.5);
  assert.equal(mediana([3, 1, 2]), 2);
  assert.equal(mediana([]), 0);
  assert.equal(mediana([5]), 5);
});

test('regra 5.1 exige julho E agosto zerados', () => {
  assert.equal(ehDesligada({ jul: 0, ago: 0 }), true);
  assert.equal(ehDesligada({ jul: 0, ago: 100 }), false, 'um mês só é atraso de empenho');
  assert.equal(ehDesligada({ jul: 100, ago: 0 }), false);
  assert.equal(ehDesligada({ jul: 100, ago: 100 }), false);
});

test('regra 5.1 não confunde célula vazia com zero declarado', () => {
  // Vazio devolve null, e `numero(null) === 0` é falso. A linha sem julho e agosto
  // DECLARADOS não é desligada: é linha sem dado, e desligá-la a apagaria.
  assert.equal(ehDesligada({ jul: '', ago: '' }), false);
});

test('regra 5.2 alcança as três naturezas de mediana e nenhuma outra', () => {
  for (const n of NAT_MEDIANA) assert.equal(ehMediana(n), true);
  assert.equal(ehMediana(319011), false);
  assert.equal(ehMediana(319091), false);
  assert.equal(NAT_MEDIANA.length, 3);
});

test('regra 5.5 alcança as seis naturezas que provisionam 13º', () => {
  assert.equal(NAT_13.length, 6);
  for (const n of NAT_13) assert.equal(provisiona13(n), true);
  assert.equal(provisiona13(319001), false, 'aposentadoria não provisiona 13º');
  assert.equal(provisiona13(319003), false, 'pensão não provisiona 13º');
  assert.equal(provisiona13(319046), false, 'auxílio-alimentação não provisiona 13º');
});

test('a lista do reajuste não é a lista do 13º', () => {
  // A diferença é a natureza 319012, pessoal militar: provisiona 13º e não é
  // alcançada pelo reajuste geral declarado.
  assert.equal(provisiona13(319012), true);
  assert.equal(alcancadoPeloReajuste(319012), false);
});

test('cesta D4 é reconhecida pelo elemento, não pela natureza inteira', () => {
  assert.equal(ehD4(319091), true);
  assert.equal(ehD4(319092), true);
  assert.equal(ehD4(319093), true);
  assert.equal(ehD4(319094), true);
  assert.equal(ehD4(319191), true, 'a intraorçamentária também está na cesta');
  assert.equal(ehD4(319011), false);
});

test('inativo de RPPS é por órgão OU por natureza', () => {
  assert.equal(ehInativoRPPS({ orgao: 87, nat: 319011 }), true);
  assert.equal(ehInativoRPPS({ orgao: 88, nat: 319011 }), true);
  assert.equal(ehInativoRPPS({ orgao: 41, nat: 319001 }), true, 'aposentadoria fora do RPPS');
  assert.equal(ehInativoRPPS({ orgao: 41, nat: 319011 }), false);
});

test('regra 5.4 corta o declarado pelo teto e diz que cortou', () => {
  const L = { cv_set: 0.008, cv_out: 0.03, cv_nov: 0.015, cv_dez: '' };
  const a = cvDoMes(L, 0, 0.015);
  assert.equal(a.aplicado, 0.008);
  assert.equal(a.corta, false);
  assert.equal(a.vazio, false);

  const b = cvDoMes(L, 1, 0.015);
  assert.equal(b.declarado, 0.03);
  assert.equal(b.aplicado, 0.015);
  assert.equal(b.corta, true);
});

test('cv exatamente igual ao teto não conta como corte', () => {
  // `corta` existe para contar quantos meses-linha o teto de fato restringiu. Um cv
  // igual ao teto não foi restringido, e contá-lo inflaria o contador publicado.
  const c = cvDoMes({ cv_set: 0.015 }, 0, 0.015);
  assert.equal(c.aplicado, 0.015);
  assert.equal(c.corta, false);
});

test('regra 5.4 · célula em branco vale 9,99 e o teto a corta', () => {
  const d = cvDoMes({ cv_set: '' }, 0, 0.015);
  assert.equal(d.vazio, true);
  assert.equal(d.declarado, CV_VAZIO);
  assert.equal(d.aplicado, 0.015, 'o teto corta o 9,99');
  assert.equal(d.corta, true);
});

test('regra 5.4 · zero declarado é diferente de branco', () => {
  const zero = cvDoMes({ cv_set: 0 }, 0, 0.015);
  const branco = cvDoMes({ cv_set: '' }, 0, 0.015);
  assert.equal(zero.aplicado, 0);
  assert.equal(branco.aplicado, 0.015);
  assert.notEqual(zero.aplicado, branco.aplicado);
});

test('aumento específico exige os três códigos E o mês', () => {
  const esp = [{ orgao: 41, uo: 4101, nat: 319011, mes: 10, taxa: 0.035 }];
  const L = { orgao: 41, uo: 4101, nat: 319011 };
  assert.equal(somaEspecificos(L, 10, esp), 0.035);
  assert.equal(somaEspecificos(L, 9, esp), 0, 'mês diferente não alcança');
  assert.equal(somaEspecificos({ ...L, uo: 4102 }, 10, esp), 0, 'unidade diferente');
  assert.equal(somaEspecificos({ ...L, nat: 319013 }, 10, esp), 0, 'natureza diferente');
  assert.equal(somaEspecificos({ ...L, orgao: 42 }, 10, esp), 0, 'órgão diferente');
});

test('aumentos específicos do mesmo trio e mês se somam', () => {
  const esp = [
    { orgao: 41, uo: 4101, nat: 319011, mes: 10, taxa: 0.02 },
    { orgao: 41, uo: 4101, nat: 319011, mes: 10, taxa: 0.01 },
  ];
  assert.equal(somaEspecificos({ orgao: 41, uo: 4101, nat: 319011 }, 10, esp), 0.03);
});

test('Poder sai da faixa de órgão e o que não casa vai para o balde 9', () => {
  assert.equal(poderDaLinha({ orgao: 1 }), 1);
  assert.equal(poderDaLinha({ orgao: 3 }), 1);
  assert.equal(poderDaLinha({ orgao: 41 }), 2);
  assert.equal(poderDaLinha({ orgao: 4 }), 3);
  assert.equal(poderDaLinha({ orgao: 6 }), 4);
  assert.equal(poderDaLinha({ orgao: 87 }), 5);
  assert.equal(poderDaLinha({ orgao: 99 }), 9, 'órgão fora de toda faixa não desaparece');
  assert.equal(poderDaLinha({ orgao: 8 }), 9, 'a lacuna entre 7 e 10 também cai no 9');
  assert.match(nomeDoPoder(9), /não classificado/i);
});

test('as premissas publicadas estão congeladas', () => {
  assert.equal(PARAMETROS_PADRAO.teto, 0.015);
  assert.equal(PARAMETROS_PADRAO.reajuste, 0.05);
  assert.equal(PARAMETROS_PADRAO.mesReajuste, 5);
  assert.equal(PARAMETROS_PADRAO.primeiroMesProjetado, 9);
  assert.equal(PARAMETROS_PADRAO.aumentoNominal27, 0, 'D7 nasce em zero');
  assert.equal(PARAMETROS_PADRAO.modoD6, 'ano');
  assert.equal(PARAMETROS_PADRAO.especificos.length, 4);
  assert.equal(Object.isFrozen(PARAMETROS_PADRAO), true);
});

test('a vigência do reajuste declarado é mês já realizado', () => {
  // É o fato que torna a premissa dormente, e ele é verificável a partir dos
  // próprios parâmetros: não depende de leitura do documento.
  assert.ok(PARAMETROS_PADRAO.mesReajuste < PARAMETROS_PADRAO.primeiroMesProjetado);
});

test('um dos quatro aumentos específicos vigora em mês já realizado', () => {
  const aplicados = PARAMETROS_PADRAO.especificos
    .filter((e) => e.mes >= PARAMETROS_PADRAO.primeiroMesProjetado);
  assert.equal(PARAMETROS_PADRAO.especificos.length, 4);
  assert.equal(aplicados.length, 3);
});
