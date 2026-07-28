import { readFileSync } from 'node:fs';

/**
 * Leitor de tabelas de referencia em CSV delimitado por ponto-e-virgula,
 * formato usado pelas extracoes da STN/SEFA-PR.
 */
export function lerCsv(caminho: string): Record<string, string>[] {
  const bruto = readFileSync(caminho, 'utf-8').replace(/^\uFEFF/, '');
  const linhas = bruto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (linhas.length === 0) return [];

  const cabecalho = linhas[0].split(';').map((c) => c.trim());
  return linhas.slice(1).map((linha) => {
    const colunas = linha.split(';');
    const registro: Record<string, string> = {};
    cabecalho.forEach((coluna, i) => {
      registro[coluna] = (colunas[i] ?? '').trim();
    });
    return registro;
  });
}
