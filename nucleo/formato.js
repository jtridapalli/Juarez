/**
 * Formatação pt-BR. Os valores circulam em reais e só aqui viram texto.
 *
 * A escala é escolhida pela grandeza, não pelo gosto: bilhões nos indicadores de
 * topo, milhões nas tabelas de linha, e o número cru quando a diferença é de
 * centavos — porque uma diferença de R$ 0,40 escrita como "R$ 0,0 mi" é a maneira
 * mais eficiente de esconder um defeito.
 */

const MI = 1e6;
const BI = 1e9;

/**
 * `toLocaleString` devolve o hífen-menos do teclado, e os formatadores com sinal
 * explícito escrevem o sinal de menos tipográfico. Com os dois em circulação a
 * mesma tela mostra "−R$ 232,6 mi" numa coluna e "-0,000004" na outra, e quem
 * varre a tela procurando negativos passa por um dos dois.
 *
 * Além de unificar o sinal, o normalizador o RETIRA quando o que sobrou depois do
 * arredondamento é zero. Duas origens produzem esse caso: o zero negativo do IEEE
 * 754, que nasce de dividir zero por um número negativo, e um negativo pequeno
 * demais para a casa decimal escolhida. Nos dois, "−R$ 0,00" anuncia uma redução
 * que não existe.
 */
const MENOS = '\u2212';

function nbr(v, opcoes) {
  const s = v.toLocaleString('pt-BR', opcoes);
  if (!s.startsWith('-')) return s;
  const resto = s.slice(1);
  return /[1-9]/.test(resto) ? MENOS + resto : resto;
}

export function bi(v, casas = 2) {
  return `R$ ${nbr(v / BI, {
    minimumFractionDigits: casas, maximumFractionDigits: casas,
  })} bi`;
}

export function milhoes(v, casas = 1) {
  return nbr(v / MI, {
    minimumFractionDigits: casas, maximumFractionDigits: casas,
  });
}

export function reaisMi(v, casas = 1) {
  return `R$ ${milhoes(v, casas)} mi`;
}

/** Escolhe bilhão, milhão, mil ou real conforme a grandeza. */
export function dinheiro(v, casas = 2) {
  const a = Math.abs(v);
  if (a >= BI) return bi(v, casas);
  if (a >= MI) return reaisMi(v, casas === 2 ? 1 : casas);
  if (a >= 1000) return `R$ ${nbr(v / 1000, { maximumFractionDigits: 0 })} mil`;
  return `R$ ${nbr(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Diferença com sinal explícito e escala automática. */
export function delta(v, casas = 2) {
  if (Math.abs(v) < 0.005) return 'R$ 0,00';
  const s = v < 0 ? MENOS : '+';
  return s + dinheiro(Math.abs(v), casas);
}

export function pct(v, casas = 2) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${nbr(v * 100, {
    minimumFractionDigits: casas, maximumFractionDigits: casas,
  })}%`;
}

export function pctSinal(v, casas = 2) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const s = v < 0 ? MENOS : '+';
  return s + pct(Math.abs(v), casas);
}

export function fator(v, casas = 6) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return nbr(v, { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function inteiro(v) {
  return nbr(Math.round(v));
}

/**
 * Contagem com sinal explícito. Uma diferença de contagem escrita como "5" não diz
 * se o motor achou cinco linhas a mais ou cinco a menos que a consulta, e é sempre
 * essa a pergunta de quem lê a coluna.
 */
export function inteiroSinal(v) {
  const n = Math.round(v);
  if (n === 0) return '0';
  return (n < 0 ? MENOS : '+') + inteiro(Math.abs(n));
}

export function natureza(nat) {
  const s = String(nat).padStart(6, '0');
  return `${s.slice(0, 1)}.${s.slice(1, 2)}.${s.slice(2, 4)}.${s.slice(4, 6)}`;
}
