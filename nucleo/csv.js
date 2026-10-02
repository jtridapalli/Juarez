/**
 * Carga de CSV e casamento entre as duas origens.
 *
 * O ponto delicado é UM, e é o mais barato de errar: a planilha de projeção guarda
 * código como número e perde o zero à esquerda; o relatório do SIAFIC guarda como
 * texto e o mantém. Comparar texto com texto acha zero correspondências, e zero
 * correspondências num casamento de mil linhas é o tipo de resultado que alguém
 * "resolve" afrouxando a chave.
 *
 * Afrouxar a chave é a pior saída possível: chave parcial casa uma linha com
 * várias e faz o fator de crescimento incidir na linha errada. Por isso a carga
 * PARA quando a cardinalidade quebra, em vez de prosseguir com o que casou.
 */

/** Os 25 campos do documento, na ordem canônica. */
export const CAMPOS = Object.freeze([
  'orgao', 'uge', 'ugr', 'uo', 'acao', 'nat', 'fonte', 'det', 'idex', 'marcador',
  'poder', 'atual',
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago',
  'cv_set', 'cv_out', 'cv_nov', 'cv_dez', 'obs',
]);

/** Regra A1 — os dez campos da chave orçamentária. */
export const CAMPOS_CHAVE = Object.freeze([
  'orgao', 'uge', 'ugr', 'uo', 'acao', 'nat', 'fonte', 'det', 'idex', 'marcador',
]);

const MONETARIOS = Object.freeze([
  'atual', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago',
]);

/**
 * A chave, com os nove códigos normalizados como INTEIRO e o marcador como texto.
 *
 * O marcador fica como está porque é texto livre: ele é o que distingue a linha de
 * mediana da linha comum na mesma natureza, e normalizá-lo como número apagaria a
 * distinção que ele existe para fazer.
 */
export function chaveOrcamentaria(L) {
  return CAMPOS_CHAVE.map((c) => {
    if (c === 'marcador') return String(L[c] ?? '').trim();
    const n = Number(L[c]);
    return Number.isFinite(n) ? String(Math.trunc(n)) : String(L[c] ?? '').trim();
  }).join('|');
}

function separa(linha, sep) {
  const saida = [];
  let atual = '';
  let dentro = false;
  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i];
    if (c === '"') {
      if (dentro && linha[i + 1] === '"') { atual += '"'; i += 1; } else dentro = !dentro;
    } else if (c === sep && !dentro) { saida.push(atual); atual = ''; } else atual += c;
  }
  saida.push(atual);
  return saida;
}

/**
 * Número em formato brasileiro ou inglês; vazio devolve null, não zero.
 *
 * Aceita o sinal de menos tipográfico além do hífen do teclado, porque é o que a
 * tela escreve: um valor negativo copiado de uma tabela do painel e colado aqui
 * seria lido como texto inválido se só o hífen valesse.
 */
export function numeroBr(txt) {
  if (txt === null || txt === undefined) return null;
  const s = String(txt).trim().replace(/R\$\s*/i, '').replace(/\s/g, '')
    .replace(/[\u2212\u2013\u2014]/g, '-');
  if (s === '' || s === '-' || s === '—') return null;
  // Com os dois separadores presentes, o DECIMAL é o que aparece por último e o
  // outro é de milhar. É a única leitura que não depende de adivinhar a origem do
  // arquivo: "1.234,56" e "1,234.56" são o mesmo valor escrito em duas convenções,
  // e assumir sempre a brasileira leria o segundo como 1,23456.
  const ultimaVirgula = s.lastIndexOf(',');
  const ultimoPonto = s.lastIndexOf('.');
  let limpo = s;
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    limpo = ultimaVirgula > ultimoPonto
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (ultimaVirgula >= 0) {
    limpo = s.replace(',', '.');
  }
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lê o CSV do modelo. Aceita cabeçalho com os nomes dos campos em qualquer ordem;
 * sem cabeçalho reconhecível, assume a ordem canônica do documento E AVISA —
 * porque ler cabeçalho como dado troca natureza por órgão em silêncio, que é o
 * pior resultado possível de uma carga.
 *
 * @param {string} texto
 * @param {{escala?:number}} [opcoes] escala aplicada aos valores monetários: use
 *   1e6 quando o arquivo vier em milhões, 1 quando vier em reais.
 */
export function leCsv(texto, opcoes = {}) {
  const escala = opcoes.escala ?? 1;
  const avisos = [];
  const cruas = String(texto).split(/\r?\n/).filter((l) => l.trim() !== '');
  if (cruas.length === 0) return { linhas: [], avisos: ['arquivo vazio'] };

  const sep = (cruas[0].match(/;/g) ?? []).length >= (cruas[0].match(/,/g) ?? []).length ? ';' : ',';
  const primeira = separa(cruas[0], sep).map((x) => x.trim().toLowerCase());
  const reconhecidos = primeira.filter((x) => CAMPOS.includes(x)).length;
  const temCabecalho = reconhecidos >= 5;

  let ordem;
  if (temCabecalho) {
    ordem = primeira;
    const faltam = CAMPOS_CHAVE.filter((c) => !ordem.includes(c));
    if (faltam.length) avisos.push(`campos da chave ausentes no cabeçalho: ${faltam.join(', ')}`);
  } else {
    ordem = [...CAMPOS];
    avisos.push('sem cabeçalho reconhecível: assumida a ordem canônica dos 25 campos');
  }

  const corpo = temCabecalho ? cruas.slice(1) : cruas;
  const linhas = [];
  let descartadas = 0;

  corpo.forEach((crua, i) => {
    const partes = separa(crua, sep);
    const L = { id: i + 1 };
    ordem.forEach((campo, j) => {
      if (!CAMPOS.includes(campo)) return;
      const bruto = partes[j];
      if (MONETARIOS.includes(campo)) {
        const n = numeroBr(bruto);
        L[campo] = n === null ? 0 : n * escala;
      } else if (campo.startsWith('cv_')) {
        // Célula de cv vazia continua VAZIA. Virar zero apagaria a informação de
        // que a linha não tem teto próprio declarado, e são resultados opostos.
        const n = numeroBr(bruto);
        L[campo] = n === null ? '' : n;
      } else {
        L[campo] = (bruto ?? '').trim();
      }
    });
    for (const c of ['orgao', 'uge', 'ugr', 'uo', 'acao', 'nat', 'fonte', 'det', 'idex']) {
      const n = Number(L[c]);
      L[c] = Number.isFinite(n) ? n : 0;
    }
    L.poder = Number(L.poder) || 0;
    if (!L.nat) { descartadas += 1; return; }
    linhas.push(L);
  });

  if (descartadas) avisos.push(`${descartadas} linha(s) sem natureza descartada(s)`);
  return { linhas, avisos, separador: sep, temCabecalho };
}

export function paraCsv(linhas) {
  const cab = ['id', ...CAMPOS].join(';');
  const corpo = linhas.map((L) => ['id', ...CAMPOS].map((c) => {
    const v = L[c];
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return String(v).replace('.', ',');
    return String(v);
  }).join(';'));
  return [cab, ...corpo].join('\n');
}

/**
 * Casa duas origens pela chave orçamentária e exige cardinalidade 1:1.
 *
 * Devolve também a conferência mês a mês: janeiro a julho têm de bater ao centavo
 * nas duas origens — é o que prova que são a mesma série lida em dias diferentes,
 * e não duas séries parecidas. Agosto pode diferir, e a dotação também, por
 * alteração orçamentária: as duas coisas são movimento, não erro.
 */
export function casaOrigens(relatorio, planilha, opcoes = {}) {
  const tol = opcoes.tolerancia ?? 0.005;
  const indexa = (xs) => {
    const m = new Map();
    const dup = [];
    for (const L of xs) {
      const k = chaveOrcamentaria(L);
      if (m.has(k)) dup.push(k); else m.set(k, L);
    }
    return { m, dup };
  };

  const a = indexa(relatorio);
  const b = indexa(planilha);

  const pares = [];
  const soRelatorio = [];
  for (const [k, L] of a.m) {
    if (b.m.has(k)) pares.push({ chave: k, relatorio: L, planilha: b.m.get(k) });
    else soRelatorio.push(L);
  }
  const soPlanilha = [];
  for (const [k, L] of b.m) if (!a.m.has(k)) soPlanilha.push(L);

  const divergenciaJanJul = [];
  const divergenciaAgosto = [];
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul'];
  for (const p of pares) {
    for (const m of meses) {
      const d = (Number(p.planilha[m]) || 0) - (Number(p.relatorio[m]) || 0);
      if (Math.abs(d) > tol) divergenciaJanJul.push({ chave: p.chave, mes: m, diferenca: d });
    }
    const dAgo = (Number(p.planilha.ago) || 0) - (Number(p.relatorio.ago) || 0);
    if (Math.abs(dAgo) > tol) divergenciaAgosto.push({ chave: p.chave, mes: 'ago', diferenca: dAgo });
  }

  const duplicadas = [...new Set([...a.dup, ...b.dup])];
  const cardinalidade1a1 = duplicadas.length === 0
    && soRelatorio.length === 0 && soPlanilha.length === 0;

  return {
    pares,
    soRelatorio,
    soPlanilha,
    duplicadas,
    divergenciaJanJul,
    divergenciaAgosto,
    cardinalidade1a1,
    podeCarregar: cardinalidade1a1 && divergenciaJanJul.length === 0,
  };
}
