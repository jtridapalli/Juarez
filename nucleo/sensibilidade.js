/**
 * Sensibilidade das premissas — quanto custa cada ponto.
 *
 * A consulta auditada publicava as premissas como texto ("teto de 1,50%",
 * "reajuste de 5,00%") e o resultado como número, sem nada entre as duas coisas.
 * Quem lê não tem como saber se meio ponto de teto vale dez milhões ou um bilhão,
 * e é justamente essa a pergunta de quem decide.
 *
 * Duas advertências que o módulo torna visíveis:
 *
 * 1. Premissa de 2026 move 2027. O ponto de partida de 2027 é dezembro de 2026
 *    projetado (regra D2), então mexer no teto de 2026 desloca os doze meses de
 *    2027 inteiros. Medir o efeito só no exercício corrente subestima a decisão.
 *
 * 2. Há premissas DORMENTES. O reajuste geral de 5,00% vigora em maio, mês já
 *    realizado, e por isso não custa nada na projeção — o custo aparece só se a
 *    vigência se deslocar para um mês em aberto. O caso do mês de vigência está
 *    aqui para que essa dormência seja um número, e não uma nota de pé de página.
 */

import { PARAMETROS_PADRAO } from './regras.js';
import { pct } from './formato.js';
import { projeta2026 } from './projecao2026.js';
import { projeta2027 } from './projecao2027.js';

/**
 * Efeito por ponto percentual. O `+ 0` no fim não é enfeite: dividir zero por uma
 * perturbação negativa — o caso do fator do 13º, que não move 2027 — dá o zero
 * negativo do IEEE 754, e a formatação o escreveria como "−R$ 0,00". Um efeito
 * nulo escrito com sinal de menos faz o leitor procurar uma economia inexistente.
 */
function porPonto(d, pontos) {
  if (!pontos) return null;
  return d / pontos + 0;
}

function medida(linhas, par) {
  const p26 = projeta2026(linhas, par);
  const p27 = projeta2027(linhas, par, p26);
  return {
    proj2026: p26.ano,
    proj2027: p27.ano,
    dotacao: p26.dotacao,
    credito: p26.insuficiencia,
    t13_2026: p26.t13,
    t13_2027: p27.t13,
  };
}

/**
 * Os casos publicados. `pontos` é o tamanho da perturbação em pontos percentuais,
 * e só existe quando a premissa é uma taxa — sem ele o custo por ponto não tem
 * sentido e sai como nulo em vez de sair como número inventado.
 */
export const CASOS = [
  {
    chave: 'teto+',
    rotulo: 'Teto do vegetativo de 2026',
    de: (p) => pct(p.teto),
    para: (p) => pct(p.teto + 0.005),
    nota: 'meio ponto a mais no teto que corta o histórico de cada linha',
    pontos: 0.5,
    aplica: (p) => ({ ...p, teto: p.teto + 0.005 }),
  },
  {
    chave: 'teto-',
    rotulo: 'Teto do vegetativo de 2026',
    de: (p) => pct(p.teto),
    para: (p) => pct(Math.max(0, p.teto - 0.005)),
    nota: 'meio ponto a menos',
    pontos: -0.5,
    aplica: (p) => ({ ...p, teto: Math.max(0, p.teto - 0.005) }),
  },
  {
    chave: 'reajuste+',
    rotulo: 'Reajuste geral de 2026',
    de: (p) => pct(p.reajuste),
    para: (p) => pct(p.reajuste + 0.01),
    nota: 'um ponto a mais, mantida a vigência declarada',
    pontos: 1,
    aplica: (p) => ({ ...p, reajuste: p.reajuste + 0.01 }),
  },
  {
    chave: 'mesReajuste',
    rotulo: 'Vigência do reajuste de 2026',
    de: (p) => `mês ${p.mesReajuste}`,
    para: (p) => `mês ${Math.max(p.mesReajuste, p.primeiroMesProjetado)}`,
    nota: 'desloca a vigência para o primeiro mês em aberto: é o que revela o custo dormente',
    pontos: null,
    aplica: (p) => ({
      ...p, mesReajuste: Math.max(p.mesReajuste, p.primeiroMesProjetado),
    }),
  },
  {
    chave: 'fator13',
    rotulo: 'Fator do 13º de 2026',
    de: (p) => pct(p.fator13, 0),
    para: (p) => pct(p.fator13 - 0.1, 0),
    nota: 'dez pontos a menos na provisão de dezembro',
    pontos: -10,
    aplica: (p) => ({ ...p, fator13: p.fator13 - 0.1 }),
  },
  {
    chave: 'vegAtivo27',
    rotulo: 'Vegetativo de 2027 · ativos',
    de: (p) => pct(p.vegetativoAtivo27),
    para: (p) => pct(p.vegetativoAtivo27 + 0.005),
    nota: 'meio ponto ao ano',
    pontos: 0.5,
    aplica: (p) => ({ ...p, vegetativoAtivo27: p.vegetativoAtivo27 + 0.005 }),
  },
  {
    chave: 'vegInativo27',
    rotulo: 'Vegetativo de 2027 · inativos e RPPS',
    de: (p) => pct(p.vegetativoInativo27),
    para: (p) => pct(p.vegetativoInativo27 + 0.005),
    nota: 'meio ponto ao ano',
    pontos: 0.5,
    aplica: (p) => ({ ...p, vegetativoInativo27: p.vegetativoInativo27 + 0.005 }),
  },
  {
    chave: 'nominal27',
    rotulo: 'Aumento nominal de 2027 (D7)',
    de: (p) => pct(p.aumentoNominal27),
    para: (p) => pct(p.aumentoNominal27 + 0.01),
    nota: 'um ponto a partir do mês de vigência, só nas naturezas de vencimento',
    pontos: 1,
    aplica: (p) => ({ ...p, aumentoNominal27: p.aumentoNominal27 + 0.01 }),
  },
  {
    chave: 'modoD6',
    rotulo: 'Leitura de D6',
    de: (p) => (p.modoD6 === 'mes' ? 'ao mês' : 'ao ano'),
    para: (p) => (p.modoD6 === 'mes' ? 'ao ano' : 'ao mês'),
    nota: 'a ambiguidade do enunciado: a mesma frase lida como taxa de ano ou de mês',
    pontos: null,
    aplica: (p) => ({ ...p, modoD6: p.modoD6 === 'mes' ? 'ano' : 'mes' }),
  },
];

/**
 * @param {object[]} linhas linhas do modelo já recortadas
 * @param {object} [par] premissas de referência
 */
export function sensibilidade(linhas, par = PARAMETROS_PADRAO) {
  const base = medida(linhas, par);
  const casos = CASOS.map((c) => {
    const alterado = medida(linhas, c.aplica({ ...par }));
    const d2026 = alterado.proj2026 - base.proj2026;
    const d2027 = alterado.proj2027 - base.proj2027;
    return {
      chave: c.chave,
      rotulo: c.rotulo,
      de: c.de(par),
      para: c.para(par),
      nota: c.nota,
      pontos: c.pontos,
      proj2026: alterado.proj2026,
      proj2027: alterado.proj2027,
      credito: alterado.credito,
      d2026,
      d2027,
      dCredito: alterado.credito - base.credito,
      // Efeito de arrasto: a parcela de 2027 que vem de mexer numa premissa de
      // 2026, e não de mexer numa premissa de 2027.
      arrasta: Math.abs(d2026) > 1 && Math.abs(d2027) > 1,
      porPonto2026: porPonto(d2026, c.pontos),
      porPonto2027: porPonto(d2027, c.pontos),
      relativo2026: base.proj2026 === 0 ? null : d2026 / base.proj2026,
      relativo2027: base.proj2027 === 0 ? null : d2027 / base.proj2027,
    };
  });
  return { base, casos };
}

/**
 * Curva de uma premissa: o exercício de 2026 e de 2027 ao longo de uma faixa de
 * valores. Serve para mostrar que a resposta ao teto NÃO é linear — cada linha só
 * sente o teto a partir do ponto em que ele passa a cortar o histórico dela, e por
 * isso a curva tem joelho.
 */
export function curva(linhas, par, { campo, valores }) {
  return valores.map((v) => {
    const m = medida(linhas, { ...par, [campo]: v });
    return {
      valor: v, proj2026: m.proj2026, proj2027: m.proj2027, credito: m.credito,
    };
  });
}
