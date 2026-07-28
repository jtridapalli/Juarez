import { describe, expect, it } from 'vitest';
import { validarOrcamento, validarUnidade } from '../src/dominio/validacao.js';
import type { DotacaoItem, OrcamentoSnapshot, ReceitaItem } from '../src/dominio/tipos.js';

const PARAMETROS = {
  RCL_PROJETADA: 1_000_000,
  PERC_MIN_EDUCACAO: 25,
  PERC_MIN_SAUDE: 12,
  PERC_MIN_FUNDEB_PROFISSIONAIS: 70,
  PERC_MIN_RESERVA_CONTINGENCIA: 0.5,
  PERC_MAX_PESSOAL_TOTAL: 60,
  PERC_MAX_PESSOAL_EXECUTIVO: 49,
  PERC_MAX_PESSOAL_LEGISLATIVO: 3,
  PERC_MAX_PESSOAL_JUDICIARIO: 6,
  PERC_MAX_PESSOAL_MP: 2,
  PERC_LIMITE_EMENDAS: 0.5,
  TOLERANCIA_EQUILIBRIO: 0.01,
};

function receita(parcial: Partial<ReceitaItem> = {}): ReceitaItem {
  return {
    id: 1,
    natureza: '1.1.1.8.01.1.1',
    naturezaNome: 'ICMS',
    categoria: '1',
    origem: '1',
    especie: '1',
    deducao: false,
    fonte: '500',
    fonteNome: 'Recursos nao Vinculados de Impostos',
    fonteOrigem: 'TESOURO',
    fonteVinculacao: null,
    esfera: 'F',
    valor: 100_000,
    ...parcial,
  };
}

function dotacao(parcial: Partial<DotacaoItem> = {}): DotacaoItem {
  return {
    id: 1,
    unidade: '4000.4001',
    unidadeNome: 'Secretaria de Estado da Educacao',
    unidadeSigla: 'SEED',
    orgao: '4000',
    orgaoNome: 'Secretaria de Estado da Educacao',
    orgaoSigla: 'SEED',
    poder: 'EXECUTIVO',
    funcao: '12',
    funcaoNome: 'Educacao',
    subfuncao: '368',
    subfuncaoNome: 'Educacao Basica',
    programa: '1001',
    programaNome: 'Educacao Basica de Qualidade',
    programaPpaFim: 2027,
    programaAtivo: true,
    acao: '2101',
    acaoNome: 'Manutencao da Rede Estadual',
    acaoTipo: 'ATIVIDADE',
    subtitulo: '0000',
    esfera: 'F',
    categoria: '3',
    grupo: '3',
    grupoNome: 'Outras Despesas Correntes',
    modalidade: '90',
    modalidadeNome: 'Aplicacoes Diretas',
    elemento: '39',
    elementoNome: 'Outros Servicos de Terceiros - PJ',
    elementoGrupos: '3',
    fonte: '500',
    fonteNome: 'Recursos nao Vinculados de Impostos',
    fonteOrigem: 'TESOURO',
    fonteVinculacao: null,
    rp: '2',
    valor: 100_000,
    propostaStatus: 'HOMOLOGADA',
    ...parcial,
  };
}

/** Orcamento minimo equilibrado que satisfaz todas as regras. */
function orcamentoConforme(): OrcamentoSnapshot {
  return {
    exercicio: 2027,
    parametros: PARAMETROS,
    receitas: [
      receita({ id: 1, valor: 800_000 }),
      receita({ id: 2, natureza: '1.7.5.8.01.1.1', naturezaNome: 'FUNDEB', categoria: '1', origem: '7', fonte: '540', fonteVinculacao: 'FUNDEB', fonteOrigem: 'TRANSFERENCIA', valor: 100_000 }),
      receita({ id: 3, natureza: '2.1.1.8.01.1.1', naturezaNome: 'Operacoes de Credito', categoria: '2', origem: '1', fonte: '750', fonteVinculacao: 'OPERACAO_CREDITO', fonteOrigem: 'OPERACAO_CREDITO', valor: 50_000 }),
      receita({ id: 4, natureza: '1.2.1.0.02.1.1', naturezaNome: 'Contribuicao RPPS', categoria: '1', origem: '2', fonte: '701', fonteVinculacao: 'PREVIDENCIA', fonteOrigem: 'PROPRIA', esfera: 'S', valor: 60_000 }),
    ],
    dotacoes: [
      // Educacao: 25% de 800.000 = 200.000
      dotacao({ id: 1, valor: 210_000 }),
      // Saude: 12% de 800.000 = 96.000
      dotacao({ id: 2, funcao: '10', funcaoNome: 'Saude', subfuncao: '302', programa: '1101', acao: '2301', valor: 100_000, esfera: 'S' }),
      // FUNDEB com 100% em remuneracao de profissionais
      dotacao({ id: 3, fonte: '540', fonteVinculacao: 'FUNDEB', fonteOrigem: 'TRANSFERENCIA', grupo: '1', grupoNome: 'Pessoal e Encargos Sociais', elemento: '11', elementoNome: 'Vencimentos', elementoGrupos: '1', valor: 100_000 }),
      // Operacao de credito aplicada em investimento
      dotacao({ id: 4, fonte: '750', fonteVinculacao: 'OPERACAO_CREDITO', fonteOrigem: 'OPERACAO_CREDITO', categoria: '4', grupo: '4', grupoNome: 'Investimentos', elemento: '51', elementoNome: 'Obras e Instalacoes', elementoGrupos: '4', valor: 50_000 }),
      // Previdencia custeada pelo RPPS
      dotacao({ id: 5, funcao: '09', funcaoNome: 'Previdencia Social', subfuncao: '272', programa: '0200', acao: '0201', esfera: 'S', fonte: '701', fonteVinculacao: 'PREVIDENCIA', fonteOrigem: 'PROPRIA', grupo: '1', grupoNome: 'Pessoal e Encargos Sociais', elemento: '01', elementoNome: 'Aposentadorias', elementoGrupos: '1', valor: 60_000 }),
      // Precatorios
      dotacao({ id: 6, funcao: '28', funcaoNome: 'Encargos Especiais', subfuncao: '846', programa: '0300', acao: '0303', elemento: '91', elementoNome: 'Sentencas Judiciais', elementoGrupos: '3,4', valor: 480_000 }),
      // Reserva de contingencia: 0,5% de 1.000.000 = 5.000
      dotacao({ id: 7, funcao: '99', funcaoNome: 'Reserva de Contingencia', subfuncao: '999', programa: '0001', acao: '9999', acaoTipo: 'RESERVA_CONTINGENCIA', categoria: '9', grupo: '9', grupoNome: 'Reserva de Contingencia', modalidade: '99', elemento: '99', elementoNome: 'A Classificar', elementoGrupos: '1,2,3,4,5,6,9', valor: 10_000 }),
    ],
    limites: [
      { unidade: '4000.4001', unidadeNome: 'SEED', escopo: 'TOTAL', valor: 2_000_000 },
    ],
    emendas: [{ numero: '2027/0001', autor: 'Deputado', valor: 1_000, status: 'PROPOSTA' }],
  };
}

const resultado = (relatorio: ReturnType<typeof validarOrcamento>, regra: string) =>
  relatorio.resultados.find((r) => r.regra === regra)!;

describe('motor de validacao da LOA', () => {
  it('aprova um orcamento equilibrado e conforme', () => {
    const relatorio = validarOrcamento(orcamentoConforme());
    const reprovadas = relatorio.resultados.filter((r) => !r.aprovado);
    expect(reprovadas.map((r) => `${r.regra}: ${r.mensagem}`)).toEqual([]);
    expect(relatorio.aprovado).toBe(true);
    expect(relatorio.totalRegras).toBe(18);
  });

  it('LOA-001 reprova desequilibrio entre receita e despesa', () => {
    const o = orcamentoConforme();
    o.dotacoes[0].valor += 1;
    const r = resultado(validarOrcamento(o), 'LOA-001');
    expect(r.aprovado).toBe(false);
    expect(r.mensagem).toContain('Desequilibrio');
  });

  it('LOA-002 reprova despesa em fonte sem receita correspondente', () => {
    const o = orcamentoConforme();
    o.dotacoes[0].fonte = '501';
    o.dotacoes[0].fonteNome = 'Outros Recursos nao Vinculados';
    const r = resultado(validarOrcamento(o), 'LOA-002');
    expect(r.aprovado).toBe(false);
    expect(r.detalhes).toHaveLength(2);
  });

  it('LOA-003 reprova proposta que excede o teto da unidade', () => {
    const o = orcamentoConforme();
    o.limites = [{ unidade: '4000.4001', unidadeNome: 'SEED', escopo: 'TOTAL', valor: 1_000 }];
    const r = resultado(validarOrcamento(o), 'LOA-003');
    expect(r.aprovado).toBe(false);
    expect(r.valorApurado).toBe(1);
  });

  it('LOA-004 reprova aplicacao em educacao abaixo de 25%', () => {
    const o = orcamentoConforme();
    o.dotacoes[0].valor = 50_000;
    o.dotacoes[5].valor = 640_000;
    const r = resultado(validarOrcamento(o), 'LOA-004');
    expect(r.aprovado).toBe(false);
    // 50.000 da fonte 500 somados a 100.000 do FUNDEB (fonte 540).
    expect(r.valorApurado).toBe(150_000);
    expect(r.valorReferencia).toBe(200_000);
  });

  it('LOA-005 reprova aplicacao em saude abaixo de 12%', () => {
    const o = orcamentoConforme();
    o.dotacoes[1].valor = 10_000;
    o.dotacoes[5].valor = 570_000;
    const r = resultado(validarOrcamento(o), 'LOA-005');
    expect(r.aprovado).toBe(false);
    expect(r.valorApurado).toBe(10_000);
    expect(r.valorReferencia).toBe(96_000);
  });

  it('LOA-006 reprova FUNDEB com menos de 70% em remuneracao', () => {
    const o = orcamentoConforme();
    o.dotacoes[2].grupo = '3';
    o.dotacoes[2].grupoNome = 'Outras Despesas Correntes';
    o.dotacoes[2].elemento = '39';
    o.dotacoes[2].elementoGrupos = '3';
    const r = resultado(validarOrcamento(o), 'LOA-006');
    expect(r.aprovado).toBe(false);
    expect(r.valorApurado).toBe(0);
    expect(r.valorReferencia).toBe(70_000);
  });

  it('LOA-007 reprova reserva de contingencia insuficiente', () => {
    const o = orcamentoConforme();
    o.dotacoes[6].valor = 1_000;
    o.dotacoes[5].valor = 489_000;
    const r = resultado(validarOrcamento(o), 'LOA-007');
    expect(r.aprovado).toBe(false);
    expect(r.valorReferencia).toBe(5_000);
  });

  it('LOA-008 reprova despesa com pessoal acima do limite do Poder', () => {
    const o = orcamentoConforme();
    o.dotacoes[2].poder = 'JUDICIARIO';
    o.dotacoes[2].orgao = '0300';
    o.dotacoes[2].orgaoSigla = 'TJPR';
    const r = resultado(validarOrcamento(o), 'LOA-008');
    expect(r.aprovado).toBe(false);
    expect(r.mensagem).toContain('Poder Judiciario');
  });

  it('LOA-008 exclui aposentadorias e pensoes da despesa com pessoal', () => {
    const r = resultado(validarOrcamento(orcamentoConforme()), 'LOA-008');
    // Apenas a dotacao de vencimentos do FUNDEB e computada (100.000).
    expect(r.valorApurado).toBe(100_000);
  });

  it('LOA-009 reprova operacoes de credito acima das despesas de capital', () => {
    const o = orcamentoConforme();
    o.dotacoes[3].categoria = '3';
    o.dotacoes[3].grupo = '3';
    o.dotacoes[3].elemento = '39';
    o.dotacoes[3].elementoGrupos = '3';
    const relatorio = validarOrcamento(o);
    expect(resultado(relatorio, 'LOA-009').aprovado).toBe(false);
    expect(resultado(relatorio, 'LOA-016').aprovado).toBe(false);
  });

  it('LOA-010 reprova elemento incompativel com o grupo de natureza', () => {
    const o = orcamentoConforme();
    o.dotacoes[0].grupo = '1';
    o.dotacoes[0].grupoNome = 'Pessoal e Encargos Sociais';
    const r = resultado(validarOrcamento(o), 'LOA-010');
    expect(r.aprovado).toBe(false);
    expect(r.mensagem).toContain('3.1.90.39');
  });

  it('LOA-011 alerta sobre classificacoes genericas fora da reserva', () => {
    const o = orcamentoConforme();
    o.dotacoes[0].elemento = '99';
    o.dotacoes[0].elementoGrupos = '1,2,3,4,5,6,9';
    const r = resultado(validarOrcamento(o), 'LOA-011');
    expect(r.aprovado).toBe(false);
    expect(r.severidade).toBe('ALERTA');
  });

  it('LOA-012 reprova dotacao vinculada a programa fora do PPA vigente', () => {
    const o = orcamentoConforme();
    o.dotacoes[0].programaPpaFim = 2023;
    const r = resultado(validarOrcamento(o), 'LOA-012');
    expect(r.aprovado).toBe(false);
  });

  it('LOA-013 reprova ausencia de dotacao para precatorios', () => {
    const o = orcamentoConforme();
    o.dotacoes[5].elemento = '39';
    o.dotacoes[5].elementoGrupos = '3';
    const r = resultado(validarOrcamento(o), 'LOA-013');
    expect(r.aprovado).toBe(false);
  });

  it('LOA-014 alerta sobre propostas nao homologadas', () => {
    const o = orcamentoConforme();
    o.dotacoes[0].propostaStatus = 'ENVIADA';
    const r = resultado(validarOrcamento(o), 'LOA-014');
    expect(r.aprovado).toBe(false);
    expect(r.severidade).toBe('ALERTA');
    expect(r.valorApurado).toBe(1);
  });

  it('LOA-015 alerta sobre emendas acima do limite da LDO', () => {
    const o = orcamentoConforme();
    o.emendas = [{ numero: '2027/0001', autor: 'Deputado', valor: 100_000, status: 'PROPOSTA' }];
    const r = resultado(validarOrcamento(o), 'LOA-015');
    expect(r.aprovado).toBe(false);
    expect(r.valorReferencia).toBe(5_000);
  });

  it('LOA-017 informa o aporte do orcamento fiscal a seguridade social', () => {
    const r = resultado(validarOrcamento(orcamentoConforme()), 'LOA-017');
    expect(r.severidade).toBe('INFO');
    // Despesa da seguridade (saude 100.000 + previdencia 60.000) menos receitas proprias (60.000).
    expect(r.valorApurado).toBe(100_000);
  });

  it('LOA-018 reprova dotacao com valor nao positivo', () => {
    const o = orcamentoConforme();
    o.dotacoes[0].valor = 0;
    o.dotacoes[5].valor = 690_000;
    const r = resultado(validarOrcamento(o), 'LOA-018');
    expect(r.aprovado).toBe(false);
  });

  it('valida apenas o recorte da unidade orcamentaria informada', () => {
    const o = orcamentoConforme();
    o.dotacoes.push(
      dotacao({
        id: 99,
        unidade: '3000.3001',
        unidadeSigla: 'SESA',
        grupo: '1',
        grupoNome: 'Pessoal e Encargos Sociais',
        valor: 1_000,
      }),
    );
    const relatorio = validarUnidade(o, '3000.3001');
    expect(relatorio.totalRegras).toBe(5);
    expect(resultado(relatorio, 'LOA-010').aprovado).toBe(false);

    const outra = validarUnidade(o, '4000.4001');
    expect(resultado(outra, 'LOA-010').aprovado).toBe(true);
  });
});
