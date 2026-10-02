/**
 * Construção de DOM sem biblioteca.
 *
 * Tudo é criado por `createElement` e preenchido por `textContent`. Nenhum ponto do
 * painel monta HTML por concatenação de texto: os dados vêm de planilha carregada
 * pelo usuário, e um rótulo de órgão com um sinal de menor dentro quebraria a tela
 * no melhor caso e executaria no pior.
 */

export function el(tag, atrib = {}, filhos = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(atrib)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'classe') n.className = v;
    else if (k === 'texto') n.textContent = String(v);
    else if (k === 'html') throw new Error('html cru não é permitido: use texto');
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'dados') for (const [d, dv] of Object.entries(v)) n.dataset[d] = dv;
    else n.setAttribute(k, String(v));
  }
  for (const f of [filhos].flat(Infinity)) {
    if (f === null || f === undefined || f === false) continue;
    n.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return n;
}

export const div = (classe, filhos) => el('div', { classe }, filhos);
export const span = (classe, texto) => el('span', { classe, texto });
export const p = (texto, classe) => el('p', { classe, texto });

export function limpa(no) {
  while (no.firstChild) no.firstChild.remove();
  return no;
}

/**
 * Tabela com cabeçalho, corpo e rodapé opcional.
 *
 * `colunas` traz, por coluna, o rótulo, o alinhamento e a função que extrai a
 * célula. A célula pode devolver texto ou um nó, e devolver nó é o que permite uma
 * coluna carregar marca de divergência sem a tabela saber o que é divergência.
 *
 * `nota` de coluna vira `title`: é onde mora a régua de cada número, e é a única
 * forma de o cabeçalho caber na largura e ainda declarar o que mede.
 */
export function tabela({
  colunas, linhas, rodape = null, classe = '', vazio = 'sem linhas neste recorte',
}) {
  const t = el('table', { classe: `tabela ${classe}`.trim() });
  const thead = el('thead');
  thead.append(el('tr', {}, colunas.map((c) => el('th', {
    classe: c.alinha === 'd' ? 'num' : '',
    title: c.nota ?? null,
    scope: 'col',
  }, [c.rotulo, c.nota ? span('marca-nota', '*') : null]))));
  t.append(thead);

  const tbody = el('tbody');
  if (linhas.length === 0) {
    tbody.append(el('tr', {}, el('td', {
      colspan: colunas.length, classe: 'vazio', texto: vazio,
    })));
  }
  for (const L of linhas) {
    const tr = el('tr', { classe: L.classe ?? null, title: L.nota ?? null });
    colunas.forEach((c, i) => {
      const v = c.celula(L);
      const td = el(i === 0 && c.cabeca !== false ? 'th' : 'td', {
        classe: c.alinha === 'd' ? 'num' : null,
        scope: i === 0 && c.cabeca !== false ? 'row' : null,
      }, [v instanceof Node ? v : String(v ?? '')]);
      tr.append(td);
    });
    tbody.append(tr);
  }
  t.append(tbody);

  if (rodape) {
    t.append(el('tfoot', {}, el('tr', {}, colunas.map((c, i) => el(i === 0 ? 'th' : 'td', {
      classe: c.alinha === 'd' ? 'num' : null,
      scope: i === 0 ? 'row' : null,
    }, [(() => {
      const v = c.celula(rodape);
      return v instanceof Node ? v : String(v ?? '');
    })()])))));
  }
  return t;
}

/** Cartão de indicador: valor grande, rótulo, e a régua embaixo. */
export function indicador({
  rotulo, valor, nota = '', regua = '', tom = '',
}) {
  return div(`indicador ${tom}`.trim(), [
    span('indicador-rotulo', rotulo),
    span('indicador-valor', valor),
    nota ? span('indicador-nota', nota) : null,
    regua ? span('indicador-regua', regua) : null,
  ]);
}

/** Bloco com título, subtítulo e conteúdo. */
export function secao(titulo, subtitulo, filhos) {
  return el('section', { classe: 'secao' }, [
    el('h2', { texto: titulo }),
    subtitulo ? p(subtitulo, 'subtitulo') : null,
    ...[filhos].flat(Infinity),
  ]);
}

/**
 * Nota de leitura.
 *
 * O painel tem muita nota, de propósito: quase todo número publicado aqui tem uma
 * régua que o número sozinho não declara, e foi exatamente a ausência dessas notas
 * que permitiu a consulta auditada publicar duas grandezas diferentes com o mesmo
 * rótulo. `tom` separa o que é advertência do que é só contexto.
 */
export function nota(texto, tom = 'neutro') {
  return div(`nota nota-${tom}`, [texto].flat(Infinity));
}

export function detalhe(resumo, filhos, aberto = false) {
  return el('details', { classe: 'detalhe', open: aberto ? '' : null }, [
    el('summary', { texto: resumo }),
    div('detalhe-corpo', filhos),
  ]);
}

/** Barra horizontal de proporção, para ler composição sem contar dígitos. */
export function barra(parte, tom = '') {
  const pc = Math.max(0, Math.min(1, parte || 0)) * 100;
  return div('barra', el('div', {
    classe: `barra-cheia ${tom}`.trim(),
    style: `width:${pc}%`,
  }));
}

/** Marca de passa ou falha, com o texto ao lado para não depender só da cor. */
export function selo(passa, textoPassa = 'confere', textoFalha = 'divergente') {
  return span(`selo ${passa ? 'selo-ok' : 'selo-erro'}`, passa ? textoPassa : textoFalha);
}

export function aviso(titulo, corpo) {
  return div('aviso', [el('strong', { texto: titulo }), ' ', corpo]);
}
