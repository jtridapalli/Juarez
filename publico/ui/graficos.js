/**
 * Gráficos em SVG escrito à mão. Sem biblioteca.
 *
 * As decisões de escala são as que importam para não enganar o leitor:
 *
 * 1. O eixo de valor começa em ZERO em todo gráfico de dinheiro. Cortar a base é a
 *    maneira clássica de fazer 3% de variação parecer 300%, e a série mensal da
 *    folha varia pouco entre meses vizinhos — exatamente o caso em que o corte de
 *    base mais engana.
 * 2. Dezembro é marcado, porque ele carrega o 13º dentro e por isso é cinquenta por
 *    cento mais alto que os vizinhos. Sem a marca, o salto parece tendência.
 * 3. A fronteira entre realizado e projetado é desenhada. Sem ela, oito meses de
 *    liquidação e quatro de premissa parecem a mesma coisa.
 */

const MI = 1e6;

const NS = 'http://www.w3.org/2000/svg';

function s(tag, atrib = {}, filhos = []) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(atrib)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'texto') n.textContent = String(v);
    else n.setAttribute(k, String(v));
  }
  for (const f of [filhos].flat(Infinity)) {
    if (f === null || f === undefined || f === false) continue;
    n.append(f);
  }
  return n;
}

function svg(largura, altura, filhos, rotulo) {
  return s('svg', {
    viewBox: `0 0 ${largura} ${altura}`,
    class: 'grafico',
    role: 'img',
    'aria-label': rotulo ?? '',
    preserveAspectRatio: 'xMidYMid meet',
  }, filhos);
}

/**
 * Passo de eixo "bonito": 1, 1,5, 2, 2,5, 3, 4, 5 ou 10 vezes uma potência de dez.
 *
 * O 2,5 e o 1,5 estão na lista porque sem eles uma faixa de 0 a 6.000 recebe passo
 * de 1.000 (seis marcas) ou de 5.000 (duas marcas), e nenhuma das duas lê bem.
 */
function passoBonito(faixa, alvoDeMarcas = 5) {
  if (!(faixa > 0)) return 1;
  const cru = faixa / alvoDeMarcas;
  const potencia = 10 ** Math.floor(Math.log10(cru));
  const normalizado = cru / potencia;
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 10]) {
    if (normalizado <= m) return m * potencia;
  }
  return 10 * potencia;
}

/**
 * As marcas do eixo de valor.
 *
 * O `- 1e-9` no teto não é enfeite. `max/passo` cai em cima de um inteiro quando o
 * máximo é múltiplo exato do passo — e é o caso comum, porque o máximo costuma ser
 * um número redondo. Sem a folga, `Math.ceil` devolve esse mesmo inteiro e o
 * desenho ganha uma marca a mais no topo, fora da área útil.
 */
function marcasDeValor(max, alvoDeMarcas = 5) {
  const passo = passoBonito(max, alvoDeMarcas);
  const n = Math.ceil(max / passo - 1e-9);
  const marcas = [];
  for (let i = 0; i <= n; i += 1) marcas.push(i * passo);
  return { marcas, topo: n * passo || 1 };
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const fmtMi = (v) => (v / MI).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

/**
 * Série mensal em barras, com a fronteira de realizado e projetado.
 *
 * @param {object} opcoes
 * @param {number[]} opcoes.valores doze meses, em reais
 * @param {number} [opcoes.primeiroProjetado] índice do primeiro mês projetado
 * @param {number} [opcoes.destaque13] índice do mês que leva o 13º dentro
 * @param {number[]} [opcoes.referencia] segunda série, desenhada como contorno
 */
export function serieMensal({
  valores, primeiroProjetado = 8, destaque13 = 11, referencia = null,
  rotuloReferencia = 'referência', rotulo = 'série mensal', altura = 240,
}) {
  const L = 760;
  const margem = {
    cima: 18, baixo: 34, esquerda: 54, direita: 10,
  };
  const largura = L - margem.esquerda - margem.direita;
  const alturaUtil = altura - margem.cima - margem.baixo;

  const max = Math.max(...valores, ...(referencia ?? [0]));
  const { marcas, topo } = marcasDeValor(max);
  const y = (v) => margem.cima + alturaUtil * (1 - v / topo);
  const passoX = largura / valores.length;
  const largBarra = passoX * 0.62;

  const grade = marcas.map((m) => s('g', {}, [
    s('line', {
      x1: margem.esquerda, x2: L - margem.direita, y1: y(m), y2: y(m), class: 'grade',
    }),
    s('text', {
      x: margem.esquerda - 8, y: y(m) + 4, class: 'eixo', 'text-anchor': 'end', texto: fmtMi(m),
    }),
  ]));

  const barras = valores.map((v, i) => {
    const alto = Math.max(0, alturaUtil * (v / topo));
    const projetado = i >= primeiroProjetado;
    return s('rect', {
      x: margem.esquerda + i * passoX + (passoX - largBarra) / 2,
      y: y(v),
      width: largBarra,
      height: alto,
      class: `barra-serie ${projetado ? 'projetado' : 'realizado'}`
        + (i === destaque13 ? ' com-decimo-terceiro' : ''),
      role: 'presentation',
    });
  });

  const contorno = referencia
    ? referencia.map((v, i) => s('line', {
      x1: margem.esquerda + i * passoX + (passoX - largBarra) / 2,
      x2: margem.esquerda + i * passoX + (passoX + largBarra) / 2,
      y1: y(v),
      y2: y(v),
      class: 'linha-referencia',
    }))
    : [];

  const fronteira = primeiroProjetado > 0 && primeiroProjetado < valores.length
    ? s('g', {}, [
      s('line', {
        x1: margem.esquerda + primeiroProjetado * passoX,
        x2: margem.esquerda + primeiroProjetado * passoX,
        y1: margem.cima - 6,
        y2: altura - margem.baixo,
        class: 'fronteira',
      }),
      s('text', {
        x: margem.esquerda + primeiroProjetado * passoX + 4,
        y: margem.cima - 8,
        class: 'eixo-marca',
        texto: 'projetado →',
      }),
    ])
    : null;

  const rotulos = valores.map((v, i) => s('text', {
    x: margem.esquerda + i * passoX + passoX / 2,
    y: altura - margem.baixo + 15,
    class: `eixo ${i >= primeiroProjetado ? 'eixo-projetado' : ''}`,
    'text-anchor': 'middle',
    texto: MESES[i] ?? String(i + 1),
  }));

  // A marca do 13º vai DENTRO da barra quando ela é alta: dezembro é o mês mais alto
  // da série justamente por levar a provisão, e escrever o rótulo acima dele o
  // empilha em cima da legenda da série de referência, que mora no mesmo canto.
  //
  // Dentro, o texto é só "13º". O rótulo inteiro é mais largo que a barra, e um texto
  // branco que transborda a barra fica branco sobre o fundo branco do gráfico — o
  // leitor vê os caracteres do meio e conclui que a tela truncou o rótulo.
  const alturaDez = destaque13 >= 0 ? alturaUtil * (valores[destaque13] / topo) : 0;
  const dentro = alturaDez > alturaUtil * 0.75;
  const legenda13 = destaque13 >= 0 && destaque13 < valores.length
    ? s('text', {
      x: margem.esquerda + destaque13 * passoX + passoX / 2,
      y: dentro ? y(valores[destaque13]) + 13 : y(valores[destaque13]) - 6,
      class: `eixo-marca ${dentro ? 'marca-dentro' : ''}`.trim(),
      'text-anchor': 'middle',
      texto: dentro ? '13º' : '13º dentro',
    })
    : null;

  return svg(L, altura, [
    grade,
    barras,
    contorno,
    fronteira,
    rotulos,
    legenda13,
    referencia ? s('text', {
      x: L - margem.direita,
      y: margem.cima - 8,
      class: 'eixo-marca',
      'text-anchor': 'end',
      texto: `— ${rotuloReferencia}`,
    }) : null,
  ], rotulo);
}

/**
 * Barras agrupadas: uma categoria por grupo, várias séries por categoria.
 *
 * O rótulo de valor é escrito em cima da barra quando ela é alta o bastante para o
 * texto caber DENTRO da área do desenho; abaixo dessa altura ele vai para dentro da
 * barra. Sem isso, a barra pequena empurra o seu rótulo para fora da moldura.
 */
export function barrasAgrupadas({
  categorias, series, altura = 280, rotulo = 'comparação', formata = fmtMi,
}) {
  const L = 760;
  const margem = {
    cima: 26, baixo: 48, esquerda: 54, direita: 10,
  };
  const largura = L - margem.esquerda - margem.direita;
  const alturaUtil = altura - margem.cima - margem.baixo;

  const max = Math.max(...series.flatMap((x) => x.valores));
  const { marcas, topo } = marcasDeValor(max);
  const y = (v) => margem.cima + alturaUtil * (1 - v / topo);
  const passoGrupo = largura / categorias.length;
  const largBarra = (passoGrupo * 0.74) / series.length;

  /** Altura mínima, em pixels, para o rótulo caber acima da barra. */
  const faixaReferencia = 15;

  const grade = marcas.map((m) => s('g', {}, [
    s('line', {
      x1: margem.esquerda, x2: L - margem.direita, y1: y(m), y2: y(m), class: 'grade',
    }),
    s('text', {
      x: margem.esquerda - 8, y: y(m) + 4, class: 'eixo', 'text-anchor': 'end', texto: fmtMi(m),
    }),
  ]));

  const grupos = categorias.map((cat, i) => {
    const base = margem.esquerda + i * passoGrupo + passoGrupo * 0.13;
    const barras = series.map((serie, j) => {
      const v = serie.valores[i] ?? 0;
      const alto = Math.max(0, alturaUtil * (v / topo));
      const x = base + j * largBarra;
      const acima = alto > faixaReferencia;
      return s('g', {}, [
        s('rect', {
          x, y: y(v), width: largBarra * 0.9, height: alto, class: `barra-serie serie-${j}`,
        }),
        s('text', {
          x: x + (largBarra * 0.9) / 2,
          y: acima ? y(v) - 4 : y(v) + 12,
          class: `valor-barra ${acima ? '' : 'valor-dentro'}`,
          'text-anchor': 'middle',
          texto: formata(v),
        }),
      ]);
    });
    return s('g', {}, [
      barras,
      s('text', {
        x: margem.esquerda + i * passoGrupo + passoGrupo / 2,
        y: altura - margem.baixo + 16,
        class: 'eixo',
        'text-anchor': 'middle',
        texto: cat,
      }),
    ]);
  });

  const legenda = series.map((serie, j) => s('g', {}, [
    s('rect', {
      x: margem.esquerda + j * 180, y: altura - 16, width: 10, height: 10, class: `barra-serie serie-${j}`,
    }),
    s('text', {
      x: margem.esquerda + j * 180 + 15, y: altura - 7, class: 'eixo', texto: serie.rotulo,
    }),
  ]));

  return svg(L, altura, [grade, grupos, legenda], rotulo);
}

/**
 * Barras horizontais ordenadas, com rótulo longo à esquerda.
 *
 * É a forma de ler uma abertura por órgão ou por unidade: vinte rótulos de nome
 * próprio não cabem num eixo horizontal sem girar o texto, e texto girado não se lê.
 */
export function barrasHorizontais({
  itens, altura = null, rotulo = 'abertura', formata = fmtMi, tom = () => '',
}) {
  const L = 760;
  const alturaLinha = 22;
  const margem = {
    cima: 10, baixo: 24, esquerda: 230, direita: 70,
  };
  const h = altura ?? margem.cima + margem.baixo + itens.length * alturaLinha;
  const largura = L - margem.esquerda - margem.direita;

  const max = Math.max(...itens.map((x) => Math.abs(x.valor)), 1);
  const { marcas, topo } = marcasDeValor(max, 4);
  const x = (v) => margem.esquerda + largura * (Math.abs(v) / topo);

  const grade = marcas.map((m) => s('g', {}, [
    s('line', {
      x1: x(m), x2: x(m), y1: margem.cima, y2: h - margem.baixo, class: 'grade',
    }),
    s('text', {
      x: x(m), y: h - margem.baixo + 14, class: 'eixo', 'text-anchor': 'middle', texto: fmtMi(m),
    }),
  ]));

  const linhas = itens.map((item, i) => {
    const y = margem.cima + i * alturaLinha;
    return s('g', {}, [
      s('text', {
        x: margem.esquerda - 8,
        y: y + alturaLinha / 2 + 4,
        class: 'eixo rotulo-longo',
        'text-anchor': 'end',
        texto: item.rotulo,
      }),
      s('rect', {
        x: margem.esquerda,
        y: y + 3,
        width: Math.max(1, x(item.valor) - margem.esquerda),
        height: alturaLinha - 7,
        class: `barra-serie ${tom(item)}`.trim(),
      }),
      s('text', {
        x: L - margem.direita + 6,
        y: y + alturaLinha / 2 + 4,
        class: 'valor-barra',
        texto: formata(item.valor),
      }),
    ]);
  });

  return svg(L, h, [grade, linhas], rotulo);
}

/**
 * Curva de uma premissa, com o ponto declarado marcado.
 *
 * A marca do ponto declarado é o que torna a curva legível como decisão: sem ela, o
 * leitor vê uma função e não vê onde o Estado está hoje dentro dela.
 */
export function curvaDePremissa({
  pontos, declarado, altura = 240, rotulo = 'curva', eixoX = (v) => String(v),
}) {
  const L = 760;
  const margem = {
    cima: 18, baixo: 38, esquerda: 54, direita: 14,
  };
  const largura = L - margem.esquerda - margem.direita;
  const alturaUtil = altura - margem.cima - margem.baixo;

  const max = Math.max(...pontos.map((x) => x.y));
  const { marcas, topo } = marcasDeValor(max);
  const minX = Math.min(...pontos.map((x) => x.x));
  const maxX = Math.max(...pontos.map((x) => x.x));
  const px = (v) => margem.esquerda + (maxX === minX ? 0 : largura * ((v - minX) / (maxX - minX)));
  const py = (v) => margem.cima + alturaUtil * (1 - v / topo);

  const grade = marcas.map((m) => s('g', {}, [
    s('line', {
      x1: margem.esquerda, x2: L - margem.direita, y1: py(m), y2: py(m), class: 'grade',
    }),
    s('text', {
      x: margem.esquerda - 8, y: py(m) + 4, class: 'eixo', 'text-anchor': 'end', texto: fmtMi(m),
    }),
  ]));

  const caminho = pontos.map((pt, i) => `${i === 0 ? 'M' : 'L'}${px(pt.x)},${py(pt.y)}`).join(' ');

  const marcaX = pontos.map((pt) => s('text', {
    x: px(pt.x),
    y: altura - margem.baixo + 15,
    class: 'eixo',
    'text-anchor': 'middle',
    texto: eixoX(pt.x),
  }));

  const ondeEstamos = declarado === null || declarado === undefined ? null : (() => {
    const perto = pontos.reduce((a, b) => (Math.abs(b.x - declarado) < Math.abs(a.x - declarado) ? b : a));
    return s('g', {}, [
      s('line', {
        x1: px(perto.x), x2: px(perto.x), y1: margem.cima, y2: altura - margem.baixo, class: 'fronteira',
      }),
      s('circle', { cx: px(perto.x), cy: py(perto.y), r: 4, class: 'ponto-declarado' }),
      s('text', {
        x: px(perto.x) + 6,
        y: margem.cima + 10,
        class: 'eixo-marca',
        texto: 'declarado',
      }),
    ]);
  })();

  return svg(L, altura, [
    grade,
    s('path', { d: caminho, class: 'curva' }),
    pontos.map((pt) => s('circle', { cx: px(pt.x), cy: py(pt.y), r: 2.5, class: 'ponto' })),
    marcaX,
    ondeEstamos,
  ], rotulo);
}

/**
 * Cascata: de onde sai cada parcela de uma diferença.
 *
 * É o desenho da decomposição do crescimento de 2027. O total de partida e o de
 * chegada são barras cheias; as parcelas no meio flutuam, e é a flutuação que
 * mostra que elas se somam para fechar a diferença.
 */
export function cascata({
  partida, parcelas, chegada, altura = 260, rotulo = 'decomposição', formata = fmtMi,
}) {
  const L = 760;
  const margem = {
    cima: 28, baixo: 46, esquerda: 54, direita: 10,
  };
  const largura = L - margem.esquerda - margem.direita;
  const alturaUtil = altura - margem.cima - margem.baixo;

  const colunas = [partida, ...parcelas, chegada];
  let acumulado = 0;
  const caixas = colunas.map((c, i) => {
    const cheia = i === 0 || i === colunas.length - 1;
    const de = cheia ? 0 : acumulado;
    const ate = cheia ? c.valor : acumulado + c.valor;
    if (!cheia) acumulado = ate;
    else acumulado = c.valor;
    return {
      rotulo: c.rotulo, de, ate, cheia, valor: c.valor, tom: c.tom ?? '',
    };
  });

  const max = Math.max(...caixas.map((c) => Math.max(c.de, c.ate)));
  const { marcas, topo } = marcasDeValor(max);
  const y = (v) => margem.cima + alturaUtil * (1 - v / topo);
  const passo = largura / caixas.length;
  const larg = passo * 0.6;

  const grade = marcas.map((m) => s('g', {}, [
    s('line', {
      x1: margem.esquerda, x2: L - margem.direita, y1: y(m), y2: y(m), class: 'grade',
    }),
    s('text', {
      x: margem.esquerda - 8, y: y(m) + 4, class: 'eixo', 'text-anchor': 'end', texto: fmtMi(m),
    }),
  ]));

  const desenho = caixas.map((c, i) => {
    const x = margem.esquerda + i * passo + (passo - larg) / 2;
    const alto = Math.max(1, Math.abs(y(c.ate) - y(c.de)));
    return s('g', {}, [
      s('rect', {
        x,
        y: Math.min(y(c.de), y(c.ate)),
        width: larg,
        height: alto,
        class: `barra-serie ${c.cheia ? 'cheia' : 'parcela'} ${c.tom}`.trim(),
      }),
      s('text', {
        x: x + larg / 2,
        y: Math.min(y(c.de), y(c.ate)) - 5,
        class: 'valor-barra',
        'text-anchor': 'middle',
        texto: formata(c.valor),
      }),
      s('text', {
        x: x + larg / 2,
        y: altura - margem.baixo + 16,
        class: 'eixo',
        'text-anchor': 'middle',
        texto: c.rotulo,
      }),
    ]);
  });

  return svg(L, altura, [grade, desenho], rotulo);
}

export { marcasDeValor, passoBonito };
