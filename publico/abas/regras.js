/**
 * Aba de regras — o catálogo da metodologia, com o lugar do código e a prova.
 *
 * Ela existe para fechar o circuito: cada número da tela aponta para o enunciado que
 * o produziu, e cada enunciado aponta para o lugar do código que o executa e para a
 * aba onde pode ser conferido. Uma regra sem lugar de conferência seria mais uma
 * afirmação não verificável, que é o problema de origem.
 *
 * Onde a consulta NÃO reproduz o enunciado literal, a tela diz isso. Parafrasear e
 * apresentar como citação transformaria a leitura do auditor em fonte primária.
 */

import {
  cabecalho, citaRegra, div, el, faixa, indicador, inteiro, nota, pct, reaisMi,
  secao, span, tabela,
} from './comum.js';
import { FAMILIAS, REGRAS } from '../../dados/regras-texto.js';
import { PARAMETROS_PADRAO } from '../../nucleo/regras.js';
import { natureza } from '../../nucleo/formato.js';
import {
  NAT_13, NAT_MEDIANA, NAT_REAJUSTE, ELEMENTOS_D4, ORGAOS_RPPS, NAT_INATIVO,
} from '../../nucleo/regras.js';

export const meta = {
  chave: 'regras',
  rotulo: 'Regras',
  pergunta: 'Qual enunciado produz cada número, e onde ele é executado?',
};

export function desenha(carga, redesenha, vaPara) {
  const declaradas = REGRAS.length;
  const comEnunciado = REGRAS.filter((r) => r.enunciado !== null).length;
  const totalFamilia = FAMILIAS.reduce((a, f) => a + f.n, 0);

  return div('aba', [
    cabecalho(carga, 'Regras da metodologia', meta.pergunta),

    faixa([
      indicador({
        rotulo: 'Famílias de regras',
        valor: inteiro(FAMILIAS.length),
        nota: `${inteiro(totalFamilia)} regras na metodologia`,
        regua: 'B, E, R, V, X, D e A',
      }),
      indicador({
        rotulo: 'Regras executadas aqui',
        valor: inteiro(declaradas),
        nota: 'cada uma com o lugar do código',
        regua: 'as demais são de processo e não produzem número',
      }),
      indicador({
        rotulo: 'Com enunciado literal',
        valor: `${inteiro(comEnunciado)} de ${inteiro(declaradas)}`,
        nota: `${inteiro(declaradas - comEnunciado)} não foram reproduzidas na consulta`,
        regua: 'onde falta, a tela diz que o resumo é leitura do auditor',
        tom: 'alerta',
      }),
    ]),

    secao('As sete famílias',
      'Cada família governa uma decisão diferente, e misturá-las é o que produz erro '
      + 'de régua: uma pergunta de base de dados respondida com uma regra de estrutura '
      + 'dá uma conta certa com o rótulo errado.',
      [tabelaDasFamilias()]),

    secao('As premissas, e o que cada uma alcança',
      'A premissa publicada como texto não diz o seu alcance. Aqui cada uma vem com o '
      + 'número de meses-linha ou de linhas que de fato toca na carga em tela — é o que '
      + 'separa premissa que governa o resultado de premissa que só está escrita.',
      [tabelaDasPremissas(carga)]),

    secao('As listas de natureza',
      'Elas NÃO são a mesma lista, e a diferença produz resultado. A natureza de '
      + 'pessoal militar provisiona 13º e não é alcançada pelo reajuste geral; as três '
      + 'naturezas de mediana vencem o critério que o documento atribui ao elemento.',
      [tabelaDasListas()]),

    secao('O catálogo, família por família', '',
      FAMILIAS.map((f) => catalogoDaFamilia(f, vaPara))),
  ]);
}

function tabelaDasFamilias() {
  return tabela({
    colunas: [
      { rotulo: 'Família', celula: (f) => el('strong', { texto: `${f.chave} · ${f.nome}` }) },
      { rotulo: 'Regras', alinha: 'd', celula: (f) => inteiro(f.n) },
      {
        rotulo: 'Aqui',
        alinha: 'd',
        nota: 'quantas desta família produzem número neste painel',
        celula: (f) => inteiro(REGRAS.filter((r) => r.familia === f.chave).length),
      },
      { rotulo: 'O que governa', celula: (f) => f.governa },
      { rotulo: 'Onde é executada', celula: (f) => span('etiqueta etiqueta-frio', f.onde) },
    ],
    linhas: FAMILIAS,
  });
}

function tabelaDasPremissas(carga) {
  const { par, p26, p27 } = carga;
  const m = p26.memoria;
  const linhas = [
    {
      premissa: 'Teto do vegetativo mensal de 2026',
      valor: pct(par.teto),
      regra: '5.4 · V1',
      alcance: `${inteiro(m.mesesLinhaTeto)} de ${inteiro(m.mesesLinhaProjetados)} meses-linha`,
      vivo: m.mesesLinhaTeto > 0,
      doDocumento: true,
    },
    {
      premissa: 'Reajuste geral de 2026',
      valor: `${pct(par.reajuste)} · vigência no mês ${par.mesReajuste}`,
      regra: 'R1 · R2',
      alcance: `${inteiro(m.mesesLinhaReajuste)} meses-linha`,
      vivo: m.mesesLinhaReajuste > 0,
      doDocumento: true,
    },
    {
      premissa: 'Aumentos específicos por trio',
      valor: `${inteiro(par.especificos.length)} declarados`,
      regra: 'R4',
      alcance: `${inteiro(m.especificosAplicados)} aplicados · `
        + `${inteiro(m.mesesLinhaEspecifico)} meses-linha`,
      vivo: m.especificosAplicados > 0,
      doDocumento: true,
    },
    {
      premissa: 'Célula de cv em branco',
      valor: '9,99',
      regra: '5.4',
      alcance: `${inteiro(m.mesesLinhaCvVazio)} meses-linha, todos cortados pelo teto`,
      vivo: m.mesesLinhaCvVazio > 0,
      doDocumento: true,
    },
    {
      premissa: 'Fator do 13º de 2026',
      valor: pct(par.fator13, 0),
      regra: '5.5',
      alcance: `${inteiro(m.linhasCom13)} linhas · ${reaisMi(p26.t13)}`,
      vivo: p26.t13 > 0,
      doDocumento: true,
    },
    {
      premissa: 'Vegetativo de 2027 · ativos',
      valor: pct(par.vegetativoAtivo27),
      regra: 'D6',
      alcance: `${inteiro(p27.memoria.ativo)} linhas`,
      vivo: p27.memoria.ativo > 0,
      doDocumento: true,
    },
    {
      premissa: 'Vegetativo de 2027 · inativos e RPPS',
      valor: pct(par.vegetativoInativo27),
      regra: 'D6',
      alcance: `${inteiro(p27.memoria.inativo)} linhas`,
      vivo: p27.memoria.inativo > 0,
      doDocumento: true,
    },
    {
      premissa: 'Leitura de D6',
      valor: par.modoD6 === 'mes' ? 'taxa ao mês' : 'taxa ao ano',
      regra: 'D6',
      alcance: 'o enunciado não declara o período: a escolha é da tela',
      vivo: true,
      doDocumento: false,
    },
    {
      premissa: 'Fator do 13º de 2027',
      valor: `${pct(par.fator13Ativo27, 0)} ativos · ${pct(par.fator13Inativo27, 0)} inativos`,
      regra: 'D5',
      alcance: `${inteiro(p27.memoria.com13Ativo)} ativos · `
        + `${inteiro(p27.memoria.com13Inativo)} inativos · ${reaisMi(p27.t13)}`,
      vivo: p27.t13 > 0,
      doDocumento: true,
    },
    {
      premissa: 'Aumento nominal de 2027',
      valor: pct(par.aumentoNominal27),
      regra: 'D7',
      alcance: par.aumentoNominal27 === 0 ? 'em zero: nenhum número publicado o contém'
        : `a partir do mês ${par.mesNominal27}`,
      vivo: par.aumentoNominal27 > 0,
      doDocumento: false,
    },
    {
      premissa: 'Vegetativo sazonal da tela',
      valor: pct(par.vegetativoTela),
      regra: 'V2',
      alcance: 'só a leitura alternativa; não toca a projeção da DOE',
      vivo: true,
      doDocumento: false,
    },
  ];

  return div('', [
    tabela({
      colunas: [
        { rotulo: 'Premissa', celula: (x) => x.premissa },
        { rotulo: 'Valor em vigor', alinha: 'd', celula: (x) => el('strong', { texto: x.valor }) },
        { rotulo: 'Regra', celula: (x) => span('etiqueta', x.regra) },
        {
          rotulo: 'Alcance na carga em tela',
          nota: 'o que a premissa de fato toca; é o que separa premissa viva de dormente',
          celula: (x) => x.alcance,
        },
        {
          rotulo: 'Situação',
          celula: (x) => (x.vivo
            ? span('selo selo-ok', 'viva')
            : span('selo selo-aviso', 'DORMENTE')),
        },
        {
          rotulo: 'Origem',
          celula: (x) => (x.doDocumento
            ? span('', 'documento')
            : span('selo selo-frio', 'desta tela')),
        },
      ],
      linhas,
    }),
    nota([
      'Três premissas são acréscimo DESTA TELA e não constam do documento: a leitura '
      + 'de D6 (o enunciado traz o percentual e não o período), o aumento nominal de '
      + '2027 e o vegetativo sazonal de comparação. As duas últimas nascem em valores '
      + 'que não contaminam nenhum número publicado.',
    ], 'neutro'),
  ]);
}

function tabelaDasListas() {
  const lista = (xs) => xs.map((n) => natureza(n)).join('  ');
  const linhas = [
    {
      nome: 'Naturezas de mediana · regra 5.2',
      conteudo: lista(NAT_MEDIANA),
      n: NAT_MEDIANA.length,
      consequencia: 'vencem o critério que o documento atribui aos elementos 16, 92 e 94',
    },
    {
      nome: 'Naturezas que provisionam 13º · regra 5.5',
      conteudo: lista(NAT_13),
      n: NAT_13.length,
      consequencia: 'aposentadorias, pensões e auxílios NÃO provisionam',
    },
    {
      nome: 'Naturezas alcançadas pelo reajuste geral · R2',
      conteudo: lista(NAT_REAJUSTE),
      n: NAT_REAJUSTE.length,
      consequencia: 'pessoal militar provisiona 13º e não recebe o reajuste geral',
    },
    {
      nome: 'Elementos da cesta D4',
      conteudo: ELEMENTOS_D4.map((e) => String(e)).join('  '),
      n: ELEMENTOS_D4.length,
      consequencia: 'cada mês de 2027 vale a média de 2026; nenhum vegetativo os alcança',
    },
    {
      nome: 'Órgãos do RPPS',
      conteudo: ORGAOS_RPPS.map((o) => String(o)).join('  '),
      n: ORGAOS_RPPS.length,
      consequencia: 'vegetativo de 0,50% e fator de 13º de 95%',
    },
    {
      nome: 'Naturezas de inativo fora do RPPS',
      conteudo: lista(NAT_INATIVO),
      n: NAT_INATIVO.length,
      consequencia: 'a classificação de inativo é por órgão OU por natureza',
    },
  ];

  return tabela({
    colunas: [
      { rotulo: 'Lista', celula: (x) => x.nome },
      { rotulo: 'Itens', alinha: 'd', celula: (x) => inteiro(x.n) },
      { rotulo: 'Conteúdo', celula: (x) => span('mono', x.conteudo) },
      { rotulo: 'Consequência', celula: (x) => x.consequencia },
    ],
    linhas,
  });
}

function catalogoDaFamilia(familia, vaPara) {
  const regras = REGRAS.filter((r) => r.familia === familia.chave);
  if (regras.length === 0) return null;

  return el('details', { classe: 'detalhe detalhe-familia' }, [
    el('summary', {}, [
      el('strong', { texto: `${familia.chave} · ${familia.nome}` }),
      span('', ` — ${regras.length} de ${familia.n} regras produzem número aqui`),
    ]),
    div('detalhe-corpo', regras.map((r) => div('regra-cartao', [
      citaRegra(r),
      el('button', {
        classe: 'botao botao-magro',
        texto: `Conferir na aba ${r.prova}`,
        onclick: () => vaPara(r.prova),
      }),
    ]))),
  ]);
}
