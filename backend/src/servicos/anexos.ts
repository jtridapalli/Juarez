import { centavos } from '../lib/money.js';
import {
  baseImpostosETransferencias,
  ehDespesaCapital,
  ehDespesaPessoal,
  FONTES_FUNDEB,
  FONTES_IMPOSTOS_EDUCACAO,
  FONTES_IMPOSTOS_SAUDE,
  FUNCAO_EDUCACAO,
  FUNCAO_SAUDE,
  funcionalProgramatica,
  naturezaDespesa,
} from '../dominio/classificacoes.js';
import type { DotacaoItem, OrcamentoSnapshot, ReceitaItem } from '../dominio/tipos.js';

export type TipoColuna = 'texto' | 'moeda' | 'numero';

export interface Coluna {
  chave: string;
  titulo: string;
  tipo: TipoColuna;
  largura?: number;
}

export interface Tabela {
  codigo: string;
  titulo: string;
  fundamento?: string;
  colunas: Coluna[];
  linhas: Record<string, string | number>[];
}

const soma = (itens: { valor: number }[]) => centavos(itens.reduce((t, i) => t + i.valor, 0));

function agrupar<T>(itens: T[], chave: (item: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const item of itens) {
    const k = chave(item);
    const lista = mapa.get(k);
    if (lista) lista.push(item);
    else mapa.set(k, [item]);
  }
  return mapa;
}

const CATEGORIAS_RECEITA: Record<string, string> = {
  '1': 'Receitas Correntes',
  '2': 'Receitas de Capital',
  '7': 'Receitas Correntes Intraorcamentarias',
  '8': 'Receitas de Capital Intraorcamentarias',
  '9': 'Deducoes da Receita',
};

const ORIGENS_RECEITA: Record<string, string> = {
  '1': 'Impostos, Taxas e Contribuicoes de Melhoria',
  '2': 'Contribuicoes',
  '3': 'Receita Patrimonial',
  '4': 'Receita Agropecuaria',
  '5': 'Receita Industrial',
  '6': 'Receita de Servicos',
  '7': 'Transferencias Correntes',
  '9': 'Outras Receitas Correntes',
};

const ORIGENS_CAPITAL: Record<string, string> = {
  '1': 'Operacoes de Credito',
  '2': 'Alienacao de Bens',
  '3': 'Amortizacao de Emprestimos',
  '4': 'Transferencias de Capital',
  '9': 'Outras Receitas de Capital',
};

function nomeOrigem(receita: ReceitaItem): string {
  if (receita.categoria === '2' || receita.categoria === '8') {
    return ORIGENS_CAPITAL[receita.origem] ?? 'Outras';
  }
  if (receita.categoria === '9') return 'Deducoes da Receita';
  return ORIGENS_RECEITA[receita.origem] ?? 'Outras';
}

// ---------------------------------------------------------------------------
// Anexo 1 - Resumo Geral da Receita e da Despesa por Categoria Economica
// ---------------------------------------------------------------------------
export function anexo1(o: OrcamentoSnapshot): Tabela {
  const receitasCorrentes = soma(o.receitas.filter((r) => ['1', '7'].includes(r.categoria)));
  const receitasCapital = soma(o.receitas.filter((r) => ['2', '8'].includes(r.categoria)));
  const deducoes = soma(o.receitas.filter((r) => r.categoria === '9'));
  const despesasCorrentes = soma(o.dotacoes.filter((d) => d.categoria === '3'));
  const despesasCapital = soma(o.dotacoes.filter((d) => d.categoria === '4'));
  const reserva = soma(o.dotacoes.filter((d) => d.categoria === '9'));

  const linhas = [
    { discriminacao: 'RECEITAS CORRENTES', receita: receitasCorrentes, despesa: 0, discriminacaoDespesa: 'DESPESAS CORRENTES', valorDespesa: despesasCorrentes },
    { discriminacao: 'RECEITAS DE CAPITAL', receita: receitasCapital, despesa: 0, discriminacaoDespesa: 'DESPESAS DE CAPITAL', valorDespesa: despesasCapital },
    { discriminacao: '(-) DEDUCOES DA RECEITA', receita: deducoes, despesa: 0, discriminacaoDespesa: 'RESERVA DE CONTINGENCIA', valorDespesa: reserva },
    {
      discriminacao: 'TOTAL DA RECEITA',
      receita: centavos(receitasCorrentes + receitasCapital + deducoes),
      despesa: 0,
      discriminacaoDespesa: 'TOTAL DA DESPESA',
      valorDespesa: centavos(despesasCorrentes + despesasCapital + reserva),
    },
  ].map(({ discriminacao, receita, discriminacaoDespesa, valorDespesa }) => ({
    discriminacao,
    receita,
    discriminacaoDespesa,
    valorDespesa,
  }));

  return {
    codigo: 'anexo-01',
    titulo: 'Anexo I - Resumo Geral da Receita e da Despesa por Categoria Economica',
    fundamento: 'Art. 2o, §1o, I, e Anexo 1 da Lei 4.320/1964',
    colunas: [
      { chave: 'discriminacao', titulo: 'Receita', tipo: 'texto', largura: 42 },
      { chave: 'receita', titulo: 'Valor (R$)', tipo: 'moeda', largura: 22 },
      { chave: 'discriminacaoDespesa', titulo: 'Despesa', tipo: 'texto', largura: 42 },
      { chave: 'valorDespesa', titulo: 'Valor (R$)', tipo: 'moeda', largura: 22 },
    ],
    linhas,
  };
}

// ---------------------------------------------------------------------------
// Anexo 2 - Receita por natureza
// ---------------------------------------------------------------------------
export function anexo2Receita(o: OrcamentoSnapshot): Tabela {
  const linhas = [...agrupar(o.receitas, (r) => `${r.natureza}|${r.fonte}`).entries()]
    .map(([, itens]) => {
      const r = itens[0];
      return {
        natureza: r.natureza,
        especificacao: r.naturezaNome,
        categoria: CATEGORIAS_RECEITA[r.categoria] ?? r.categoria,
        origem: nomeOrigem(r),
        fonte: r.fonte,
        esfera: r.esfera === 'S' ? 'Seguridade Social' : 'Fiscal',
        valor: soma(itens),
      };
    })
    .sort((a, b) => a.natureza.localeCompare(b.natureza));

  return {
    codigo: 'anexo-02-receita',
    titulo: 'Anexo II - Receita por Categoria Economica, Natureza e Fonte de Recursos',
    fundamento: 'Anexo 3 da Lei 4.320/1964',
    colunas: [
      { chave: 'natureza', titulo: 'Natureza', tipo: 'texto', largura: 18 },
      { chave: 'especificacao', titulo: 'Especificacao', tipo: 'texto', largura: 60 },
      { chave: 'categoria', titulo: 'Categoria Economica', tipo: 'texto', largura: 34 },
      { chave: 'origem', titulo: 'Origem', tipo: 'texto', largura: 40 },
      { chave: 'fonte', titulo: 'Fonte', tipo: 'texto', largura: 8 },
      { chave: 'esfera', titulo: 'Esfera', tipo: 'texto', largura: 18 },
      { chave: 'valor', titulo: 'Valor (R$)', tipo: 'moeda', largura: 22 },
    ],
    linhas,
  };
}

// ---------------------------------------------------------------------------
// Anexo 2 - Despesa por orgao e natureza
// ---------------------------------------------------------------------------
export function anexo2Despesa(o: OrcamentoSnapshot): Tabela {
  const linhas = [...agrupar(o.dotacoes, (d) => `${d.orgao}|${d.categoria}${d.grupo}`).entries()]
    .map(([, itens]) => {
      const d = itens[0];
      return {
        orgao: d.orgao,
        nomeOrgao: `${d.orgaoSigla} - ${d.orgaoNome}`,
        categoria: d.categoria === '3' ? 'Despesas Correntes' : d.categoria === '4' ? 'Despesas de Capital' : 'Reserva de Contingencia',
        grupo: `${d.grupo} - ${d.grupoNome}`,
        valor: soma(itens),
      };
    })
    .sort((a, b) => a.orgao.localeCompare(b.orgao) || a.grupo.localeCompare(b.grupo));

  return {
    codigo: 'anexo-02-despesa',
    titulo: 'Anexo II - Despesa por Orgao, Categoria Economica e Grupo de Natureza',
    fundamento: 'Anexo 4 da Lei 4.320/1964',
    colunas: [
      { chave: 'orgao', titulo: 'Orgao', tipo: 'texto', largura: 10 },
      { chave: 'nomeOrgao', titulo: 'Denominacao', tipo: 'texto', largura: 62 },
      { chave: 'categoria', titulo: 'Categoria Economica', tipo: 'texto', largura: 26 },
      { chave: 'grupo', titulo: 'Grupo de Natureza da Despesa', tipo: 'texto', largura: 36 },
      { chave: 'valor', titulo: 'Valor (R$)', tipo: 'moeda', largura: 22 },
    ],
    linhas,
  };
}

// ---------------------------------------------------------------------------
// Anexo 6 - Programa de Trabalho
// ---------------------------------------------------------------------------
export function anexo6(o: OrcamentoSnapshot): Tabela {
  const linhas = [...agrupar(o.dotacoes, (d) => `${d.unidade}|${d.programa}|${d.acao}`).entries()]
    .map(([, itens]) => {
      const d = itens[0];
      const correntes = soma(itens.filter((i) => i.categoria === '3'));
      const capital = soma(itens.filter((i) => i.categoria === '4'));
      const reserva = soma(itens.filter((i) => i.categoria === '9'));
      return {
        unidade: d.unidade,
        nomeUnidade: d.unidadeNome,
        programa: `${d.programa} - ${d.programaNome}`,
        acao: `${d.acao} - ${d.acaoNome}`,
        tipoAcao: d.acaoTipo,
        correntes,
        capital,
        reserva,
        total: centavos(correntes + capital + reserva),
      };
    })
    .sort((a, b) => a.unidade.localeCompare(b.unidade) || a.programa.localeCompare(b.programa) || a.acao.localeCompare(b.acao));

  return {
    codigo: 'anexo-06',
    titulo: 'Anexo VI - Programa de Trabalho por Unidade Orcamentaria',
    fundamento: 'Anexo 6 da Lei 4.320/1964',
    colunas: [
      { chave: 'unidade', titulo: 'U.O.', tipo: 'texto', largura: 12 },
      { chave: 'nomeUnidade', titulo: 'Unidade Orcamentaria', tipo: 'texto', largura: 52 },
      { chave: 'programa', titulo: 'Programa', tipo: 'texto', largura: 52 },
      { chave: 'acao', titulo: 'Acao', tipo: 'texto', largura: 62 },
      { chave: 'tipoAcao', titulo: 'Tipo', tipo: 'texto', largura: 20 },
      { chave: 'correntes', titulo: 'Correntes (R$)', tipo: 'moeda', largura: 20 },
      { chave: 'capital', titulo: 'Capital (R$)', tipo: 'moeda', largura: 20 },
      { chave: 'total', titulo: 'Total (R$)', tipo: 'moeda', largura: 20 },
    ],
    linhas,
  };
}

// ---------------------------------------------------------------------------
// Anexo 7 - Demonstrativo funcional-programatico
// ---------------------------------------------------------------------------
export function anexo7(o: OrcamentoSnapshot): Tabela {
  const linhas = [...agrupar(o.dotacoes, (d) => funcionalProgramatica(d)).entries()]
    .map(([codigo, itens]) => {
      const d = itens[0];
      return {
        codigo,
        funcao: `${d.funcao} - ${d.funcaoNome}`,
        subfuncao: `${d.subfuncao} - ${d.subfuncaoNome}`,
        programa: `${d.programa} - ${d.programaNome}`,
        acao: `${d.acao} - ${d.acaoNome}`,
        valor: soma(itens),
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  return {
    codigo: 'anexo-07',
    titulo: 'Anexo VII - Demonstrativo do Programa de Trabalho de Governo (Funcional-Programatico)',
    fundamento: 'Anexo 7 da Lei 4.320/1964',
    colunas: [
      { chave: 'codigo', titulo: 'Classificacao', tipo: 'texto', largura: 26 },
      { chave: 'funcao', titulo: 'Funcao', tipo: 'texto', largura: 32 },
      { chave: 'subfuncao', titulo: 'Subfuncao', tipo: 'texto', largura: 44 },
      { chave: 'programa', titulo: 'Programa', tipo: 'texto', largura: 52 },
      { chave: 'acao', titulo: 'Acao', tipo: 'texto', largura: 62 },
      { chave: 'valor', titulo: 'Valor (R$)', tipo: 'moeda', largura: 22 },
    ],
    linhas,
  };
}

// ---------------------------------------------------------------------------
// Anexo 8 - Despesa por funcao, subfuncao e programa
// ---------------------------------------------------------------------------
export function anexo8(o: OrcamentoSnapshot): Tabela {
  const linhas = [...agrupar(o.dotacoes, (d) => `${d.funcao}|${d.subfuncao}|${d.programa}`).entries()]
    .map(([, itens]) => {
      const d = itens[0];
      return {
        funcao: `${d.funcao} - ${d.funcaoNome}`,
        subfuncao: `${d.subfuncao} - ${d.subfuncaoNome}`,
        programa: `${d.programa} - ${d.programaNome}`,
        ordinarios: soma(itens.filter((i) => i.fonteVinculacao === null)),
        vinculados: soma(itens.filter((i) => i.fonteVinculacao !== null)),
        valor: soma(itens),
      };
    })
    .sort((a, b) => a.funcao.localeCompare(b.funcao) || a.subfuncao.localeCompare(b.subfuncao));

  return {
    codigo: 'anexo-08',
    titulo: 'Anexo VIII - Demonstrativo da Despesa por Funcao, Subfuncao e Programa, conforme o Vinculo com os Recursos',
    fundamento: 'Anexo 8 da Lei 4.320/1964',
    colunas: [
      { chave: 'funcao', titulo: 'Funcao', tipo: 'texto', largura: 32 },
      { chave: 'subfuncao', titulo: 'Subfuncao', tipo: 'texto', largura: 44 },
      { chave: 'programa', titulo: 'Programa', tipo: 'texto', largura: 52 },
      { chave: 'ordinarios', titulo: 'Recursos Ordinarios (R$)', tipo: 'moeda', largura: 24 },
      { chave: 'vinculados', titulo: 'Recursos Vinculados (R$)', tipo: 'moeda', largura: 24 },
      { chave: 'valor', titulo: 'Total (R$)', tipo: 'moeda', largura: 22 },
    ],
    linhas,
  };
}

// ---------------------------------------------------------------------------
// Anexo 9 - Despesa por orgao e funcao
// ---------------------------------------------------------------------------
export function anexo9(o: OrcamentoSnapshot): Tabela {
  const linhas = [...agrupar(o.dotacoes, (d) => `${d.orgao}|${d.funcao}`).entries()]
    .map(([, itens]) => {
      const d = itens[0];
      return {
        orgao: d.orgao,
        nomeOrgao: `${d.orgaoSigla} - ${d.orgaoNome}`,
        funcao: `${d.funcao} - ${d.funcaoNome}`,
        valor: soma(itens),
      };
    })
    .sort((a, b) => a.orgao.localeCompare(b.orgao) || a.funcao.localeCompare(b.funcao));

  return {
    codigo: 'anexo-09',
    titulo: 'Anexo IX - Demonstrativo da Despesa por Orgao e Funcao',
    fundamento: 'Anexo 9 da Lei 4.320/1964',
    colunas: [
      { chave: 'orgao', titulo: 'Orgao', tipo: 'texto', largura: 10 },
      { chave: 'nomeOrgao', titulo: 'Denominacao', tipo: 'texto', largura: 62 },
      { chave: 'funcao', titulo: 'Funcao', tipo: 'texto', largura: 34 },
      { chave: 'valor', titulo: 'Valor (R$)', tipo: 'moeda', largura: 22 },
    ],
    linhas,
  };
}

// ---------------------------------------------------------------------------
// Quadro de Detalhamento da Despesa
// ---------------------------------------------------------------------------
export function quadroDetalhamentoDespesa(o: OrcamentoSnapshot): Tabela {
  const linhas = o.dotacoes
    .map((d) => ({
      unidade: d.unidade,
      nomeUnidade: d.unidadeSigla,
      funcionalProgramatica: funcionalProgramatica(d),
      acao: d.acaoNome,
      natureza: naturezaDespesa(d),
      naturezaNome: `${d.grupoNome} / ${d.elementoNome}`,
      modalidade: d.modalidade,
      fonte: d.fonte,
      esfera: d.esfera,
      rp: d.rp,
      valor: d.valor,
    }))
    .sort(
      (a, b) =>
        a.unidade.localeCompare(b.unidade) ||
        a.funcionalProgramatica.localeCompare(b.funcionalProgramatica) ||
        a.natureza.localeCompare(b.natureza) ||
        a.fonte.localeCompare(b.fonte),
    );

  return {
    codigo: 'qdd',
    titulo: 'Quadro de Detalhamento da Despesa (QDD)',
    fundamento: 'Art. 15 da Lei 4.320/1964',
    colunas: [
      { chave: 'unidade', titulo: 'U.O.', tipo: 'texto', largura: 12 },
      { chave: 'nomeUnidade', titulo: 'Sigla', tipo: 'texto', largura: 14 },
      { chave: 'funcionalProgramatica', titulo: 'Funcional-Programatica', tipo: 'texto', largura: 28 },
      { chave: 'acao', titulo: 'Acao', tipo: 'texto', largura: 62 },
      { chave: 'natureza', titulo: 'Natureza', tipo: 'texto', largura: 14 },
      { chave: 'naturezaNome', titulo: 'Especificacao da Natureza', tipo: 'texto', largura: 70 },
      { chave: 'fonte', titulo: 'Fonte', tipo: 'texto', largura: 8 },
      { chave: 'esfera', titulo: 'Esfera', tipo: 'texto', largura: 8 },
      { chave: 'rp', titulo: 'RP', tipo: 'texto', largura: 6 },
      { chave: 'valor', titulo: 'Valor (R$)', tipo: 'moeda', largura: 22 },
    ],
    linhas,
  };
}

// ---------------------------------------------------------------------------
// Demonstrativos complementares
// ---------------------------------------------------------------------------
export function demonstrativoFontes(o: OrcamentoSnapshot): Tabela {
  const codigos = new Set([...o.receitas.map((r) => r.fonte), ...o.dotacoes.map((d) => d.fonte)]);
  const linhas = [...codigos]
    .map((codigo) => {
      const receitas = o.receitas.filter((r) => r.fonte === codigo);
      const dotacoes = o.dotacoes.filter((d) => d.fonte === codigo);
      const nome = receitas[0]?.fonteNome ?? dotacoes[0]?.fonteNome ?? '';
      const receita = soma(receitas);
      const despesa = soma(dotacoes);
      return { fonte: codigo, nome, receita, despesa, diferenca: centavos(receita - despesa) };
    })
    .sort((a, b) => a.fonte.localeCompare(b.fonte));

  return {
    codigo: 'demonstrativo-fontes',
    titulo: 'Demonstrativo da Receita e da Despesa por Fonte de Recursos',
    fundamento: 'Art. 8o, paragrafo unico, da LC 101/2000',
    colunas: [
      { chave: 'fonte', titulo: 'Fonte', tipo: 'texto', largura: 8 },
      { chave: 'nome', titulo: 'Denominacao', tipo: 'texto', largura: 72 },
      { chave: 'receita', titulo: 'Receita (R$)', tipo: 'moeda', largura: 22 },
      { chave: 'despesa', titulo: 'Despesa (R$)', tipo: 'moeda', largura: 22 },
      { chave: 'diferenca', titulo: 'Diferenca (R$)', tipo: 'moeda', largura: 20 },
    ],
    linhas,
  };
}

export function demonstrativoVinculacoes(o: OrcamentoSnapshot): Tabela {
  const base = baseImpostosETransferencias(o.receitas);
  const rcl = o.parametros['RCL_PROJETADA'] ?? 0;
  const educacao = soma(o.dotacoes.filter((d) => d.funcao === FUNCAO_EDUCACAO && FONTES_IMPOSTOS_EDUCACAO.includes(d.fonte)));
  const saude = soma(o.dotacoes.filter((d) => d.funcao === FUNCAO_SAUDE && FONTES_IMPOSTOS_SAUDE.includes(d.fonte)));
  const fundeb = o.dotacoes.filter((d) => FONTES_FUNDEB.includes(d.fonte));
  const pessoal = soma(o.dotacoes.filter(ehDespesaPessoal));
  const capital = soma(o.dotacoes.filter(ehDespesaCapital));
  const operacoesCredito = soma(o.receitas.filter((r) => r.fonteOrigem === 'OPERACAO_CREDITO'));

  const linhas = [
    { indicador: 'Base de calculo: receita liquida de impostos e transferencias de impostos', valor: base, referencia: 0, percentual: 100, limite: '' },
    { indicador: 'Aplicacao em manutencao e desenvolvimento do ensino', valor: educacao, referencia: base, percentual: base ? (educacao / base) * 100 : 0, limite: 'Minimo de 25% (art. 212 da CF)' },
    { indicador: 'Aplicacao em acoes e servicos publicos de saude', valor: saude, referencia: base, percentual: base ? (saude / base) * 100 : 0, limite: 'Minimo de 12% (LC 141/2012)' },
    {
      indicador: 'FUNDEB aplicado na remuneracao dos profissionais da educacao basica',
      valor: soma(fundeb.filter((d) => d.grupo === '1')),
      referencia: soma(fundeb),
      percentual: soma(fundeb) ? (soma(fundeb.filter((d) => d.grupo === '1')) / soma(fundeb)) * 100 : 0,
      limite: 'Minimo de 70% (art. 212-A, XI, da CF)',
    },
    { indicador: 'Despesa total com pessoal', valor: pessoal, referencia: rcl, percentual: rcl ? (pessoal / rcl) * 100 : 0, limite: 'Maximo de 60% da RCL (art. 19 da LC 101/2000)' },
    { indicador: 'Operacoes de credito frente as despesas de capital', valor: operacoesCredito, referencia: capital, percentual: capital ? (operacoesCredito / capital) * 100 : 0, limite: 'Maximo de 100% (art. 167, III, da CF)' },
  ];

  return {
    codigo: 'demonstrativo-vinculacoes',
    titulo: 'Demonstrativo do Cumprimento dos Minimos Constitucionais e dos Limites Legais',
    fundamento: 'Arts. 167, 198 e 212 da CF e LC 101/2000',
    colunas: [
      { chave: 'indicador', titulo: 'Indicador', tipo: 'texto', largura: 76 },
      { chave: 'valor', titulo: 'Valor Apurado (R$)', tipo: 'moeda', largura: 22 },
      { chave: 'referencia', titulo: 'Base de Referencia (R$)', tipo: 'moeda', largura: 24 },
      { chave: 'percentual', titulo: 'Percentual (%)', tipo: 'numero', largura: 16 },
      { chave: 'limite', titulo: 'Parametro Legal', tipo: 'texto', largura: 48 },
    ],
    linhas,
  };
}

export function demonstrativoEsferas(o: OrcamentoSnapshot): Tabela {
  const esferas: { chave: string; nome: string }[] = [
    { chave: 'F', nome: 'Orcamento Fiscal' },
    { chave: 'S', nome: 'Orcamento da Seguridade Social' },
  ];
  const linhas = esferas.map((e) => {
    const receita = soma(o.receitas.filter((r) => r.esfera === e.chave));
    const despesa = soma(o.dotacoes.filter((d) => d.esfera === e.chave));
    return { esfera: e.nome, receita, despesa, resultado: centavos(receita - despesa) };
  });
  const totalReceita = soma(linhas.map((l) => ({ valor: l.receita })));
  const totalDespesa = soma(linhas.map((l) => ({ valor: l.despesa })));
  linhas.push({ esfera: 'TOTAL CONSOLIDADO', receita: totalReceita, despesa: totalDespesa, resultado: centavos(totalReceita - totalDespesa) });

  return {
    codigo: 'demonstrativo-esferas',
    titulo: 'Demonstrativo Consolidado dos Orcamentos Fiscal e da Seguridade Social',
    fundamento: 'Art. 165, §5o, da CF',
    colunas: [
      { chave: 'esfera', titulo: 'Esfera Orcamentaria', tipo: 'texto', largura: 44 },
      { chave: 'receita', titulo: 'Receita (R$)', tipo: 'moeda', largura: 22 },
      { chave: 'despesa', titulo: 'Despesa (R$)', tipo: 'moeda', largura: 22 },
      { chave: 'resultado', titulo: 'Resultado (R$)', tipo: 'moeda', largura: 22 },
    ],
    linhas,
  };
}

export function demonstrativoPoderes(o: OrcamentoSnapshot): Tabela {
  const rotulos: Record<string, string> = {
    LEGISLATIVO: 'Poder Legislativo',
    TRIBUNAL_CONTAS: 'Tribunal de Contas',
    JUDICIARIO: 'Poder Judiciario',
    MINISTERIO_PUBLICO: 'Ministerio Publico',
    DEFENSORIA: 'Defensoria Publica',
    EXECUTIVO: 'Poder Executivo',
  };
  const linhas = [...agrupar(o.dotacoes, (d) => d.poder).entries()]
    .map(([poder, itens]) => ({
      poder: rotulos[poder] ?? poder,
      pessoal: soma(itens.filter(ehDespesaPessoal)),
      outrasCorrentes: soma(itens.filter((i) => i.categoria === '3' && !ehDespesaPessoal(i))),
      capital: soma(itens.filter(ehDespesaCapital)),
      total: soma(itens),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    codigo: 'demonstrativo-poderes',
    titulo: 'Demonstrativo da Despesa por Poder e Orgao Autonomo',
    fundamento: 'Art. 20 da LC 101/2000',
    colunas: [
      { chave: 'poder', titulo: 'Poder / Orgao', tipo: 'texto', largura: 34 },
      { chave: 'pessoal', titulo: 'Pessoal e Encargos (R$)', tipo: 'moeda', largura: 24 },
      { chave: 'outrasCorrentes', titulo: 'Outras Correntes (R$)', tipo: 'moeda', largura: 24 },
      { chave: 'capital', titulo: 'Capital (R$)', tipo: 'moeda', largura: 22 },
      { chave: 'total', titulo: 'Total (R$)', tipo: 'moeda', largura: 22 },
    ],
    linhas,
  };
}

export interface AnexoDisponivel {
  codigo: string;
  titulo: string;
  gerar: (o: OrcamentoSnapshot) => Tabela;
}

export const ANEXOS: AnexoDisponivel[] = [
  { codigo: 'anexo-01', titulo: 'Anexo I - Resumo Geral da Receita e da Despesa', gerar: anexo1 },
  { codigo: 'anexo-02-receita', titulo: 'Anexo II - Receita por Natureza', gerar: anexo2Receita },
  { codigo: 'anexo-02-despesa', titulo: 'Anexo II - Despesa por Orgao e Natureza', gerar: anexo2Despesa },
  { codigo: 'anexo-06', titulo: 'Anexo VI - Programa de Trabalho', gerar: anexo6 },
  { codigo: 'anexo-07', titulo: 'Anexo VII - Demonstrativo Funcional-Programatico', gerar: anexo7 },
  { codigo: 'anexo-08', titulo: 'Anexo VIII - Despesa por Funcao, Subfuncao e Programa', gerar: anexo8 },
  { codigo: 'anexo-09', titulo: 'Anexo IX - Despesa por Orgao e Funcao', gerar: anexo9 },
  { codigo: 'qdd', titulo: 'Quadro de Detalhamento da Despesa', gerar: quadroDetalhamentoDespesa },
  { codigo: 'demonstrativo-fontes', titulo: 'Demonstrativo por Fonte de Recursos', gerar: demonstrativoFontes },
  { codigo: 'demonstrativo-vinculacoes', titulo: 'Demonstrativo dos Minimos Constitucionais', gerar: demonstrativoVinculacoes },
  { codigo: 'demonstrativo-esferas', titulo: 'Demonstrativo dos Orcamentos Fiscal e da Seguridade Social', gerar: demonstrativoEsferas },
  { codigo: 'demonstrativo-poderes', titulo: 'Demonstrativo da Despesa por Poder', gerar: demonstrativoPoderes },
];

export function gerarAnexo(codigo: string, orcamento: OrcamentoSnapshot): Tabela {
  const anexo = ANEXOS.find((a) => a.codigo === codigo);
  if (!anexo) throw new Error(`Anexo desconhecido: ${codigo}`);
  return anexo.gerar(orcamento);
}

/** Totalizacoes usadas pelo painel e pelo texto do projeto de lei. */
export function totalizacoes(o: OrcamentoSnapshot) {
  const receitaTotal = soma(o.receitas);
  const despesaTotal = soma(o.dotacoes);
  const porFuncao = [...agrupar(o.dotacoes, (d) => d.funcao).entries()]
    .map(([codigo, itens]) => ({ codigo, nome: itens[0].funcaoNome, valor: soma(itens) }))
    .sort((a, b) => b.valor - a.valor);
  const porOrgao = [...agrupar(o.dotacoes, (d) => d.orgao).entries()]
    .map(([codigo, itens]) => ({ codigo, sigla: itens[0].orgaoSigla, nome: itens[0].orgaoNome, valor: soma(itens) }))
    .sort((a, b) => b.valor - a.valor);
  const porGrupo = [...agrupar(o.dotacoes, (d) => d.grupo).entries()]
    .map(([codigo, itens]) => ({ codigo, nome: itens[0].grupoNome, valor: soma(itens) }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const porFonte = [...agrupar(o.dotacoes, (d) => d.fonte).entries()]
    .map(([codigo, itens]) => ({ codigo, nome: itens[0].fonteNome, valor: soma(itens) }))
    .sort((a, b) => b.valor - a.valor);
  const porEsfera = ['F', 'S'].map((esfera) => ({
    esfera,
    receita: soma(o.receitas.filter((r) => r.esfera === esfera)),
    despesa: soma(o.dotacoes.filter((d: DotacaoItem) => d.esfera === esfera)),
  }));

  return {
    receitaTotal,
    despesaTotal,
    diferenca: centavos(receitaTotal - despesaTotal),
    receitasCorrentes: soma(o.receitas.filter((r) => ['1', '7'].includes(r.categoria))),
    receitasCapital: soma(o.receitas.filter((r) => ['2', '8'].includes(r.categoria))),
    deducoesReceita: soma(o.receitas.filter((r) => r.categoria === '9')),
    despesasCorrentes: soma(o.dotacoes.filter((d) => d.categoria === '3')),
    despesasCapital: soma(o.dotacoes.filter((d) => d.categoria === '4')),
    reservaContingencia: soma(o.dotacoes.filter((d) => d.categoria === '9')),
    despesaPessoal: soma(o.dotacoes.filter(ehDespesaPessoal)),
    porFuncao,
    porOrgao,
    porGrupo,
    porFonte,
    porEsfera,
    quantidadeDotacoes: o.dotacoes.length,
    quantidadeUnidades: new Set(o.dotacoes.map((d) => d.unidade)).size,
  };
}
