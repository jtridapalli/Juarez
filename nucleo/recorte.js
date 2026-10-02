/**
 * Recorte — filtro hierárquico sobre as linhas.
 *
 * O recorte vale para a tela INTEIRA. Nenhuma aba filtra por conta própria, e é
 * por isso que o seletor mora no painel lateral e não dentro de um quadro: dois
 * quadros com recortes diferentes e rótulos iguais foi exatamente o que fez o
 * Executivo aparecer com R$ 25,41 bi num quadro e R$ 25,50 bi em outro.
 */

import { poderDaLinha } from './regras.js';

export const RECORTE_VAZIO = Object.freeze({
  poder: null, orgao: null, uo: null, nat: null,
});

export function aplicaRecorte(linhas, sel = RECORTE_VAZIO) {
  const s = { ...RECORTE_VAZIO, ...(sel ?? {}) };
  return linhas.filter((L) => {
    if (s.poder !== null && s.poder !== undefined && poderDaLinha(L) !== Number(s.poder)) return false;
    if (s.orgao !== null && s.orgao !== undefined && Number(L.orgao) !== Number(s.orgao)) return false;
    if (s.uo !== null && s.uo !== undefined && Number(L.uo) !== Number(s.uo)) return false;
    if (s.nat !== null && s.nat !== undefined && Number(L.nat) !== Number(s.nat)) return false;
    return true;
  });
}

/**
 * As opções de cada nível, já restritas pelos níveis acima.
 *
 * Restringir importa: oferecer as 77 unidades do Estado depois de o usuário ter
 * escolhido um órgão com três produz 74 escolhas que devolvem tela vazia, e tela
 * vazia sem explicação é indistinguível de defeito.
 */
export function dimensoes(linhas, sel = RECORTE_VAZIO, catalogo = {}) {
  const s = { ...RECORTE_VAZIO, ...(sel ?? {}) };
  const nomeOrgao = (o) => catalogo.orgaos?.[o] ?? `Órgão ${o}`;
  const nomeUo = (u) => catalogo.unidades?.[u] ?? `Unidade ${u}`;

  const noPoder = s.poder === null || s.poder === undefined
    ? linhas : linhas.filter((L) => poderDaLinha(L) === Number(s.poder));
  const noOrgao = s.orgao === null || s.orgao === undefined
    ? noPoder : noPoder.filter((L) => Number(L.orgao) === Number(s.orgao));
  const naUo = s.uo === null || s.uo === undefined
    ? noOrgao : noOrgao.filter((L) => Number(L.uo) === Number(s.uo));

  const unicos = (xs, f) => [...new Set(xs.map(f))].sort((a, b) => a - b);

  return {
    poderes: unicos(linhas, poderDaLinha),
    orgaos: unicos(noPoder, (L) => Number(L.orgao)).map((o) => ({
      valor: o, rotulo: `${o} · ${nomeOrgao(o)}`,
    })),
    unidades: unicos(noOrgao, (L) => Number(L.uo)).map((u) => ({
      valor: u, rotulo: `${u} · ${nomeUo(u)}`,
    })),
    naturezas: unicos(naUo, (L) => Number(L.nat)).map((n) => ({
      valor: n, rotulo: String(n),
    })),
  };
}

/** O recorte, saneado: um nível só vale se os de cima o admitirem. */
export function saneia(linhas, sel) {
  const s = { ...RECORTE_VAZIO, ...(sel ?? {}) };
  const d = dimensoes(linhas, { poder: s.poder }, {});
  if (s.orgao !== null && !d.orgaos.some((o) => o.valor === Number(s.orgao))) {
    s.orgao = null; s.uo = null; s.nat = null;
  }
  const d2 = dimensoes(linhas, { poder: s.poder, orgao: s.orgao }, {});
  if (s.uo !== null && !d2.unidades.some((u) => u.valor === Number(s.uo))) {
    s.uo = null; s.nat = null;
  }
  const d3 = dimensoes(linhas, { poder: s.poder, orgao: s.orgao, uo: s.uo }, {});
  if (s.nat !== null && !d3.naturezas.some((n) => n.valor === Number(s.nat))) s.nat = null;
  return s;
}

export function ehEstadoInteiro(sel) {
  const s = { ...RECORTE_VAZIO, ...(sel ?? {}) };
  return s.poder === null && s.orgao === null && s.uo === null && s.nat === null;
}
