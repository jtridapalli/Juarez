import { centavos, formatarBRL } from '../lib/money.js';
import {
  baseImpostosETransferencias,
  ehDespesaCapital,
  ehDespesaPessoal,
  FONTES_FUNDEB,
  FONTES_IMPOSTOS_EDUCACAO,
  FONTES_IMPOSTOS_SAUDE,
  FUNCAO_EDUCACAO,
  FUNCAO_RESERVA_CONTINGENCIA,
  FUNCAO_SAUDE,
  FUNCOES_SEGURIDADE_SOCIAL,
  funcionalProgramatica,
  naturezaDespesa,
} from './classificacoes.js';
import type { DotacaoItem, OrcamentoSnapshot, ResultadoRegra } from './tipos.js';

type Regra = (o: OrcamentoSnapshot) => ResultadoRegra;

const pct = (valor: number, base: number) => (base === 0 ? 0 : (valor / base) * 100);
const soma = (itens: { valor: number }[]) => centavos(itens.reduce((t, i) => t + i.valor, 0));
const brl = (v: number) => `R$ ${formatarBRL(v)}`;

function parametro(o: OrcamentoSnapshot, chave: string, padrao: number): number {
  const valor = o.parametros[chave];
  return valor === undefined || Number.isNaN(valor) ? padrao : valor;
}

// ---------------------------------------------------------------------------
// LOA-001 Equilibrio orcamentario
// ---------------------------------------------------------------------------
const equilibrioGlobal: Regra = (o) => {
  const receita = soma(o.receitas);
  const despesa = soma(o.dotacoes);
  const diferenca = centavos(receita - despesa);
  const tolerancia = parametro(o, 'TOLERANCIA_EQUILIBRIO', 0.01);
  const aprovado = Math.abs(diferenca) <= tolerancia;
  return {
    regra: 'LOA-001',
    titulo: 'Equilibrio entre receita prevista e despesa fixada',
    severidade: 'ERRO',
    aprovado,
    valorApurado: despesa,
    valorReferencia: receita,
    fundamento: 'Art. 2o da Lei 4.320/1964 e art. 4o, I, a, da LC 101/2000',
    mensagem: aprovado
      ? `Orcamento equilibrado: receita prevista e despesa fixada em ${brl(receita)}.`
      : `Desequilibrio de ${brl(diferenca)}: receita prevista de ${brl(receita)} contra despesa fixada de ${brl(despesa)}.`,
  };
};

// ---------------------------------------------------------------------------
// LOA-002 Equilibrio por fonte de recursos
// ---------------------------------------------------------------------------
const equilibrioPorFonte: Regra = (o) => {
  const tolerancia = Math.max(parametro(o, 'TOLERANCIA_EQUILIBRIO', 0.01), 0.01);
  const fontes = new Map<string, { fonte: string; nome: string; receita: number; despesa: number }>();

  for (const r of o.receitas) {
    const item = fontes.get(r.fonte) ?? { fonte: r.fonte, nome: r.fonteNome, receita: 0, despesa: 0 };
    item.receita = centavos(item.receita + r.valor);
    fontes.set(r.fonte, item);
  }
  for (const d of o.dotacoes) {
    const item = fontes.get(d.fonte) ?? { fonte: d.fonte, nome: d.fonteNome, receita: 0, despesa: 0 };
    item.despesa = centavos(item.despesa + d.valor);
    fontes.set(d.fonte, item);
  }

  const divergentes = [...fontes.values()]
    .map((f) => ({ ...f, diferenca: centavos(f.receita - f.despesa) }))
    .filter((f) => Math.abs(f.diferenca) > tolerancia)
    .sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca));

  return {
    regra: 'LOA-002',
    titulo: 'Equilibrio da despesa por fonte de recursos',
    severidade: 'ERRO',
    aprovado: divergentes.length === 0,
    valorApurado: divergentes.length,
    valorReferencia: 0,
    fundamento: 'Art. 8o, paragrafo unico, da LC 101/2000',
    mensagem:
      divergentes.length === 0
        ? `As ${fontes.size} fontes de recursos utilizadas estao equilibradas.`
        : `${divergentes.length} fonte(s) de recursos com divergencia entre receita e despesa. Maior divergencia: fonte ${divergentes[0].fonte} (${brl(divergentes[0].diferenca)}).`,
    detalhes: divergentes.slice(0, 20),
  };
};

// ---------------------------------------------------------------------------
// LOA-003 Observancia dos tetos das unidades orcamentarias
// ---------------------------------------------------------------------------
const tetosUnidades: Regra = (o) => {
  const porUnidade = new Map<string, { unidade: string; nome: string; despesa: number }>();
  for (const d of o.dotacoes) {
    const item = porUnidade.get(d.unidade) ?? { unidade: d.unidade, nome: d.unidadeNome, despesa: 0 };
    item.despesa = centavos(item.despesa + d.valor);
    porUnidade.set(d.unidade, item);
  }

  const excedidos: Record<string, unknown>[] = [];
  const semTeto: string[] = [];
  for (const item of porUnidade.values()) {
    const limite = o.limites.find((l) => l.unidade === item.unidade && l.escopo === 'TOTAL');
    if (!limite) {
      semTeto.push(item.unidade);
      continue;
    }
    if (centavos(item.despesa - limite.valor) > 0.01) {
      excedidos.push({
        unidade: item.unidade,
        nome: item.nome,
        teto: limite.valor,
        proposto: item.despesa,
        excesso: centavos(item.despesa - limite.valor),
      });
    }
  }

  const aprovado = excedidos.length === 0;
  return {
    regra: 'LOA-003',
    titulo: 'Propostas dentro dos tetos comunicados as unidades orcamentarias',
    severidade: 'ERRO',
    aprovado,
    valorApurado: excedidos.length,
    valorReferencia: 0,
    fundamento: 'LDO do exercicio e art. 4o da LC 101/2000',
    mensagem: aprovado
      ? `As ${porUnidade.size} unidades orcamentarias com proposta observam os tetos comunicados${semTeto.length > 0 ? ` (${semTeto.length} sem teto cadastrado)` : ''}.`
      : `${excedidos.length} unidade(s) orcamentaria(s) excederam o teto, com destaque para ${excedidos[0].unidade} (excesso de ${brl(excedidos[0].excesso as number)}).`,
    detalhes: excedidos.slice(0, 20),
  };
};

// ---------------------------------------------------------------------------
// LOA-004 Aplicacao minima em manutencao e desenvolvimento do ensino
// ---------------------------------------------------------------------------
const minimoEducacao: Regra = (o) => {
  const base = baseImpostosETransferencias(o.receitas);
  const percentual = parametro(o, 'PERC_MIN_EDUCACAO', 25);
  const exigido = centavos((base * percentual) / 100);
  const aplicado = soma(
    o.dotacoes.filter((d) => d.funcao === FUNCAO_EDUCACAO && FONTES_IMPOSTOS_EDUCACAO.includes(d.fonte)),
  );
  const aprovado = aplicado >= exigido;
  return {
    regra: 'LOA-004',
    titulo: 'Aplicacao minima em manutencao e desenvolvimento do ensino',
    severidade: 'ERRO',
    aprovado,
    valorApurado: aplicado,
    valorReferencia: exigido,
    fundamento: 'Art. 212 da CF e art. 69 da Lei 9.394/1996',
    mensagem: aprovado
      ? `Aplicacao de ${brl(aplicado)} em educacao, equivalente a ${pct(aplicado, base).toFixed(2)}% da base de ${brl(base)} (minimo de ${percentual}%).`
      : `Aplicacao em educacao insuficiente: ${brl(aplicado)} (${pct(aplicado, base).toFixed(2)}%), faltam ${brl(centavos(exigido - aplicado))} para atingir o minimo de ${percentual}%.`,
    detalhes: { base, percentualApurado: pct(aplicado, base), fontesConsideradas: FONTES_IMPOSTOS_EDUCACAO },
  };
};

// ---------------------------------------------------------------------------
// LOA-005 Aplicacao minima em acoes e servicos publicos de saude
// ---------------------------------------------------------------------------
const minimoSaude: Regra = (o) => {
  const base = baseImpostosETransferencias(o.receitas);
  const percentual = parametro(o, 'PERC_MIN_SAUDE', 12);
  const exigido = centavos((base * percentual) / 100);
  const aplicado = soma(o.dotacoes.filter((d) => d.funcao === FUNCAO_SAUDE && FONTES_IMPOSTOS_SAUDE.includes(d.fonte)));
  const aprovado = aplicado >= exigido;
  return {
    regra: 'LOA-005',
    titulo: 'Aplicacao minima em acoes e servicos publicos de saude',
    severidade: 'ERRO',
    aprovado,
    valorApurado: aplicado,
    valorReferencia: exigido,
    fundamento: 'Art. 198, §2o, II, da CF e art. 6o da LC 141/2012',
    mensagem: aprovado
      ? `Aplicacao de ${brl(aplicado)} em saude, equivalente a ${pct(aplicado, base).toFixed(2)}% da base de ${brl(base)} (minimo de ${percentual}%).`
      : `Aplicacao em saude insuficiente: ${brl(aplicado)} (${pct(aplicado, base).toFixed(2)}%), faltam ${brl(centavos(exigido - aplicado))} para atingir o minimo de ${percentual}%.`,
    detalhes: { base, percentualApurado: pct(aplicado, base), fontesConsideradas: FONTES_IMPOSTOS_SAUDE },
  };
};

// ---------------------------------------------------------------------------
// LOA-006 Parcela minima do FUNDEB para remuneracao dos profissionais
// ---------------------------------------------------------------------------
const minimoFundebProfissionais: Regra = (o) => {
  const dotacoesFundeb = o.dotacoes.filter((d) => FONTES_FUNDEB.includes(d.fonte));
  const total = soma(dotacoesFundeb);
  const remuneracao = soma(dotacoesFundeb.filter((d) => d.grupo === '1'));
  const percentual = parametro(o, 'PERC_MIN_FUNDEB_PROFISSIONAIS', 70);
  const exigido = centavos((total * percentual) / 100);
  const aprovado = total === 0 || remuneracao >= exigido;
  return {
    regra: 'LOA-006',
    titulo: 'Parcela minima do FUNDEB destinada a remuneracao dos profissionais da educacao basica',
    severidade: 'ERRO',
    aprovado,
    valorApurado: remuneracao,
    valorReferencia: exigido,
    fundamento: 'Art. 212-A, XI, da CF',
    mensagem: aprovado
      ? `${brl(remuneracao)} do FUNDEB destinados a remuneracao dos profissionais, ${pct(remuneracao, total).toFixed(2)}% do total de ${brl(total)} (minimo de ${percentual}%).`
      : `Apenas ${pct(remuneracao, total).toFixed(2)}% do FUNDEB estao destinados a remuneracao dos profissionais; faltam ${brl(centavos(exigido - remuneracao))}.`,
    detalhes: { totalFundeb: total, fontes: FONTES_FUNDEB },
  };
};

// ---------------------------------------------------------------------------
// LOA-007 Reserva de contingencia
// ---------------------------------------------------------------------------
const reservaContingencia: Regra = (o) => {
  const rcl = parametro(o, 'RCL_PROJETADA', 0);
  const percentual = parametro(o, 'PERC_MIN_RESERVA_CONTINGENCIA', 0.5);
  const exigido = centavos((rcl * percentual) / 100);
  const reserva = soma(o.dotacoes.filter((d) => d.funcao === FUNCAO_RESERVA_CONTINGENCIA || d.grupo === '9'));
  const aprovado = reserva >= exigido;
  return {
    regra: 'LOA-007',
    titulo: 'Reserva de contingencia minima',
    severidade: 'ERRO',
    aprovado,
    valorApurado: reserva,
    valorReferencia: exigido,
    fundamento: 'Art. 5o, III, da LC 101/2000 e LDO do exercicio',
    mensagem: aprovado
      ? `Reserva de contingencia de ${brl(reserva)}, equivalente a ${pct(reserva, rcl).toFixed(3)}% da RCL projetada (minimo de ${percentual}%).`
      : `Reserva de contingencia de ${brl(reserva)} inferior ao minimo de ${brl(exigido)} (${percentual}% da RCL projetada).`,
  };
};

// ---------------------------------------------------------------------------
// LOA-008 Limites de despesa com pessoal por Poder e orgao
// ---------------------------------------------------------------------------
const limitesPessoal: Regra = (o) => {
  const rcl = parametro(o, 'RCL_PROJETADA', 0);
  const pessoal = o.dotacoes.filter(ehDespesaPessoal);
  const total = soma(pessoal);

  const grupos: { rotulo: string; poderes: string[]; parametro: string; padrao: number }[] = [
    { rotulo: 'Poder Legislativo (inclui o Tribunal de Contas)', poderes: ['LEGISLATIVO', 'TRIBUNAL_CONTAS'], parametro: 'PERC_MAX_PESSOAL_LEGISLATIVO', padrao: 3 },
    { rotulo: 'Poder Judiciario', poderes: ['JUDICIARIO'], parametro: 'PERC_MAX_PESSOAL_JUDICIARIO', padrao: 6 },
    { rotulo: 'Ministerio Publico', poderes: ['MINISTERIO_PUBLICO'], parametro: 'PERC_MAX_PESSOAL_MP', padrao: 2 },
    { rotulo: 'Poder Executivo (inclui a Defensoria Publica)', poderes: ['EXECUTIVO', 'DEFENSORIA'], parametro: 'PERC_MAX_PESSOAL_EXECUTIVO', padrao: 49 },
  ];

  const apuracao = grupos.map((g) => {
    const valor = soma(pessoal.filter((d) => g.poderes.includes(d.poder)));
    const limitePercentual = parametro(o, g.parametro, g.padrao);
    const limite = centavos((rcl * limitePercentual) / 100);
    return {
      rotulo: g.rotulo,
      valor,
      percentual: pct(valor, rcl),
      limitePercentual,
      limite,
      excedido: valor > limite,
    };
  });

  const limiteTotalPercentual = parametro(o, 'PERC_MAX_PESSOAL_TOTAL', 60);
  const limiteTotal = centavos((rcl * limiteTotalPercentual) / 100);
  const excedidos = apuracao.filter((a) => a.excedido);
  const aprovado = excedidos.length === 0 && total <= limiteTotal;

  return {
    regra: 'LOA-008',
    titulo: 'Limites de despesa com pessoal por Poder',
    severidade: 'ERRO',
    aprovado,
    valorApurado: total,
    valorReferencia: limiteTotal,
    fundamento: 'Arts. 19 e 20 da LC 101/2000',
    mensagem: aprovado
      ? `Despesa com pessoal de ${brl(total)}, equivalente a ${pct(total, rcl).toFixed(2)}% da RCL projetada (limite de ${limiteTotalPercentual}%), com todos os Poderes dentro dos respectivos limites.`
      : `Limite de pessoal excedido: ${excedidos.map((e) => `${e.rotulo} com ${e.percentual.toFixed(2)}% (limite ${e.limitePercentual}%)`).join('; ') || `total de ${pct(total, rcl).toFixed(2)}% da RCL`}.`,
    detalhes: { rcl, limiteTotalPercentual, apuracao },
  };
};

// ---------------------------------------------------------------------------
// LOA-009 Regra de ouro
// ---------------------------------------------------------------------------
const regraDeOuro: Regra = (o) => {
  const operacoesCredito = soma(o.receitas.filter((r) => r.fonteOrigem === 'OPERACAO_CREDITO' && !r.deducao));
  const despesaCapital = soma(o.dotacoes.filter(ehDespesaCapital));
  const aprovado = operacoesCredito <= despesaCapital;
  return {
    regra: 'LOA-009',
    titulo: 'Regra de ouro: operacoes de credito limitadas as despesas de capital',
    severidade: 'ERRO',
    aprovado,
    valorApurado: operacoesCredito,
    valorReferencia: despesaCapital,
    fundamento: 'Art. 167, III, da CF',
    mensagem: aprovado
      ? `Operacoes de credito de ${brl(operacoesCredito)} inferiores as despesas de capital de ${brl(despesaCapital)}.`
      : `Operacoes de credito de ${brl(operacoesCredito)} excedem as despesas de capital de ${brl(despesaCapital)} em ${brl(centavos(operacoesCredito - despesaCapital))}.`,
  };
};

// ---------------------------------------------------------------------------
// LOA-010 Compatibilidade entre elemento e grupo de natureza da despesa
// ---------------------------------------------------------------------------
const compatibilidadeNatureza: Regra = (o) => {
  const incompativeis = o.dotacoes
    .filter((d) => {
      const permitidos = d.elementoGrupos.split(',').map((g) => g.trim());
      return !permitidos.includes(d.grupo);
    })
    .map((d) => ({
      dotacao: d.id,
      unidade: d.unidade,
      natureza: naturezaDespesa(d),
      elemento: `${d.elemento} - ${d.elementoNome}`,
      grupo: `${d.grupo} - ${d.grupoNome}`,
      valor: d.valor,
    }));

  return {
    regra: 'LOA-010',
    titulo: 'Compatibilidade entre grupo de natureza e elemento de despesa',
    severidade: 'ERRO',
    aprovado: incompativeis.length === 0,
    valorApurado: incompativeis.length,
    valorReferencia: 0,
    fundamento: 'Portaria Interministerial STN/SOF 163/2001',
    mensagem:
      incompativeis.length === 0
        ? `As ${o.dotacoes.length} dotacoes utilizam elementos compativeis com o respectivo grupo de natureza da despesa.`
        : `${incompativeis.length} dotacao(oes) com elemento incompativel com o grupo de natureza, a exemplo da natureza ${incompativeis[0].natureza} na unidade ${incompativeis[0].unidade}.`,
    detalhes: incompativeis.slice(0, 20),
  };
};

// ---------------------------------------------------------------------------
// LOA-011 Vedacao de classificacoes genericas
// ---------------------------------------------------------------------------
const classificacoesGenericas: Regra = (o) => {
  const genericas = o.dotacoes
    .filter((d) => d.funcao !== FUNCAO_RESERVA_CONTINGENCIA && (d.modalidade === '99' || d.elemento === '99'))
    .map((d) => ({ dotacao: d.id, unidade: d.unidade, natureza: naturezaDespesa(d), valor: d.valor }));

  return {
    regra: 'LOA-011',
    titulo: 'Vedacao do uso de modalidade a definir e elemento a classificar',
    severidade: 'ALERTA',
    aprovado: genericas.length === 0,
    valorApurado: soma(genericas.map((g) => ({ valor: g.valor }))),
    valorReferencia: 0,
    fundamento: 'Portaria Interministerial STN/SOF 163/2001 e LDO do exercicio',
    mensagem:
      genericas.length === 0
        ? 'Nenhuma dotacao utiliza modalidade de aplicacao a definir ou elemento a classificar fora da reserva de contingencia.'
        : `${genericas.length} dotacao(oes) classificadas de forma generica, totalizando ${brl(soma(genericas.map((g) => ({ valor: g.valor }))))}.`,
    detalhes: genericas.slice(0, 20),
  };
};

// ---------------------------------------------------------------------------
// LOA-012 Compatibilidade com o PPA
// ---------------------------------------------------------------------------
const compatibilidadePpa: Regra = (o) => {
  const incompativeis = o.dotacoes
    .filter((d) => !d.programaAtivo || d.programaPpaFim < o.exercicio)
    .map((d) => ({
      dotacao: d.id,
      unidade: d.unidade,
      programa: `${d.programa} - ${d.programaNome}`,
      ppaFim: d.programaPpaFim,
      valor: d.valor,
    }));

  return {
    regra: 'LOA-012',
    titulo: 'Compatibilidade das acoes com os programas vigentes do PPA',
    severidade: 'ERRO',
    aprovado: incompativeis.length === 0,
    valorApurado: incompativeis.length,
    valorReferencia: 0,
    fundamento: 'Art. 165, §7o, da CF e art. 5o da LC 101/2000',
    mensagem:
      incompativeis.length === 0
        ? `Todas as dotacoes estao vinculadas a programas vigentes do PPA no exercicio de ${o.exercicio}.`
        : `${incompativeis.length} dotacao(oes) vinculadas a programas encerrados ou inativos no PPA.`,
    detalhes: incompativeis.slice(0, 20),
  };
};

// ---------------------------------------------------------------------------
// LOA-013 Previsao de precatorios e sentencas judiciais
// ---------------------------------------------------------------------------
const precatorios: Regra = (o) => {
  const valor = soma(o.dotacoes.filter((d) => ['91', '92'].includes(d.elemento)));
  const aprovado = valor > 0;
  return {
    regra: 'LOA-013',
    titulo: 'Previsao de dotacao para precatorios e sentencas judiciais',
    severidade: 'ERRO',
    aprovado,
    valorApurado: valor,
    valorReferencia: 0,
    fundamento: 'Art. 100, §5o, da CF',
    mensagem: aprovado
      ? `Dotacao de ${brl(valor)} prevista para o cumprimento de sentencas judiciais e precatorios.`
      : 'Nao ha dotacao prevista para o cumprimento de sentencas judiciais e precatorios.',
  };
};

// ---------------------------------------------------------------------------
// LOA-014 Situacao das propostas das unidades orcamentarias
// ---------------------------------------------------------------------------
const propostasHomologadas: Regra = (o) => {
  const pendentes = new Map<string, { unidade: string; nome: string; status: string; valor: number }>();
  for (const d of o.dotacoes) {
    if (d.propostaStatus === 'HOMOLOGADA') continue;
    const item = pendentes.get(d.unidade) ?? { unidade: d.unidade, nome: d.unidadeNome, status: d.propostaStatus, valor: 0 };
    item.valor = centavos(item.valor + d.valor);
    pendentes.set(d.unidade, item);
  }
  const lista = [...pendentes.values()];
  return {
    regra: 'LOA-014',
    titulo: 'Homologacao das propostas das unidades orcamentarias',
    severidade: 'ALERTA',
    aprovado: lista.length === 0,
    valorApurado: lista.length,
    valorReferencia: 0,
    fundamento: 'Cronograma da LDO e rotina de consolidacao do orgao central',
    mensagem:
      lista.length === 0
        ? 'Todas as propostas incluidas na consolidacao estao homologadas pelo orgao central.'
        : `${lista.length} proposta(s) ainda nao homologada(s), totalizando ${brl(soma(lista))}.`,
    detalhes: lista,
  };
};

// ---------------------------------------------------------------------------
// LOA-015 Limite das emendas parlamentares
// ---------------------------------------------------------------------------
const limiteEmendas: Regra = (o) => {
  const rcl = parametro(o, 'RCL_PROJETADA', 0);
  const percentual = parametro(o, 'PERC_LIMITE_EMENDAS', 0.5);
  const limite = centavos((rcl * percentual) / 100);
  const total = soma(o.emendas.filter((e) => e.status !== 'REJEITADA'));
  const aprovado = total <= limite;
  return {
    regra: 'LOA-015',
    titulo: 'Limite global das emendas parlamentares',
    severidade: 'ALERTA',
    aprovado,
    valorApurado: total,
    valorReferencia: limite,
    fundamento: 'LDO do exercicio e art. 166 da CF',
    mensagem: aprovado
      ? `Emendas parlamentares em analise somam ${brl(total)}, dentro do limite de ${brl(limite)} (${percentual}% da RCL projetada).`
      : `Emendas parlamentares somam ${brl(total)} e excedem o limite de ${brl(limite)} em ${brl(centavos(total - limite))}.`,
  };
};

// ---------------------------------------------------------------------------
// LOA-016 Destinacao das operacoes de credito
// ---------------------------------------------------------------------------
const destinacaoOperacoesCredito: Regra = (o) => {
  const correntes = o.dotacoes
    .filter((d) => d.fonteOrigem === 'OPERACAO_CREDITO' && !ehDespesaCapital(d))
    .map((d) => ({ dotacao: d.id, unidade: d.unidade, natureza: naturezaDespesa(d), fonte: d.fonte, valor: d.valor }));

  return {
    regra: 'LOA-016',
    titulo: 'Aplicacao das operacoes de credito exclusivamente em despesas de capital',
    severidade: 'ERRO',
    aprovado: correntes.length === 0,
    valorApurado: soma(correntes.map((c) => ({ valor: c.valor }))),
    valorReferencia: 0,
    fundamento: 'Art. 167, III, da CF e art. 12, §2o, da LC 101/2000',
    mensagem:
      correntes.length === 0
        ? 'Todas as dotacoes custeadas por operacoes de credito estao classificadas como despesas de capital.'
        : `${correntes.length} dotacao(oes) de natureza corrente custeadas por operacoes de credito, totalizando ${brl(soma(correntes.map((c) => ({ valor: c.valor }))))}.`,
    detalhes: correntes.slice(0, 20),
  };
};

// ---------------------------------------------------------------------------
// LOA-017 Transferencia do orcamento fiscal para a seguridade social
// ---------------------------------------------------------------------------
const orcamentoSeguridade: Regra = (o) => {
  const receitaSeguridade = soma(o.receitas.filter((r) => r.esfera === 'S'));
  const despesaSeguridade = soma(o.dotacoes.filter((d) => FUNCOES_SEGURIDADE_SOCIAL.includes(d.funcao)));
  const transferencia = centavos(despesaSeguridade - receitaSeguridade);
  return {
    regra: 'LOA-017',
    titulo: 'Aporte do orcamento fiscal ao orcamento da seguridade social',
    severidade: 'INFO',
    aprovado: true,
    valorApurado: transferencia,
    valorReferencia: despesaSeguridade,
    fundamento: 'Art. 165, §5o, da CF e art. 195, §1o, da CF',
    mensagem: `A seguridade social apresenta despesa de ${brl(despesaSeguridade)} e receitas proprias de ${brl(receitaSeguridade)}, exigindo aporte de ${brl(transferencia)} do orcamento fiscal.`,
    detalhes: { receitaSeguridade, despesaSeguridade, transferencia },
  };
};

// ---------------------------------------------------------------------------
// LOA-018 Consistencia dos valores das dotacoes
// ---------------------------------------------------------------------------
const valoresConsistentes: Regra = (o) => {
  const invalidas = o.dotacoes
    .filter((d) => d.valor <= 0)
    .map((d) => ({ dotacao: d.id, unidade: d.unidade, funcionalProgramatica: funcionalProgramatica(d), valor: d.valor }));

  const invalidasReceita = o.receitas.filter((r) => (r.deducao ? r.valor > 0 : r.valor <= 0)).length;

  const aprovado = invalidas.length === 0 && invalidasReceita === 0;
  return {
    regra: 'LOA-018',
    titulo: 'Consistencia dos valores lancados',
    severidade: 'ERRO',
    aprovado,
    valorApurado: invalidas.length + invalidasReceita,
    valorReferencia: 0,
    fundamento: 'Art. 15 da Lei 4.320/1964',
    mensagem: aprovado
      ? 'Nao ha dotacoes com valor nulo ou negativo nem receitas com sinal incompativel com a natureza.'
      : `${invalidas.length} dotacao(oes) com valor nulo ou negativo e ${invalidasReceita} receita(s) com sinal incompativel com a natureza.`,
    detalhes: invalidas.slice(0, 20),
  };
};

export const REGRAS: Regra[] = [
  equilibrioGlobal,
  equilibrioPorFonte,
  tetosUnidades,
  minimoEducacao,
  minimoSaude,
  minimoFundebProfissionais,
  reservaContingencia,
  limitesPessoal,
  regraDeOuro,
  compatibilidadeNatureza,
  classificacoesGenericas,
  compatibilidadePpa,
  precatorios,
  propostasHomologadas,
  limiteEmendas,
  destinacaoOperacoesCredito,
  orcamentoSeguridade,
  valoresConsistentes,
];

export interface RelatorioValidacao {
  exercicio: number;
  executadaEm: string;
  totalRegras: number;
  totalErros: number;
  totalAlertas: number;
  aprovado: boolean;
  resultados: ResultadoRegra[];
}

/** Executa todas as regras de validacao sobre o retrato do orcamento. */
export function validarOrcamento(orcamento: OrcamentoSnapshot): RelatorioValidacao {
  const resultados = REGRAS.map((regra) => regra(orcamento));
  const totalErros = resultados.filter((r) => !r.aprovado && r.severidade === 'ERRO').length;
  const totalAlertas = resultados.filter((r) => !r.aprovado && r.severidade === 'ALERTA').length;
  return {
    exercicio: orcamento.exercicio,
    executadaEm: new Date().toISOString(),
    totalRegras: resultados.length,
    totalErros,
    totalAlertas,
    aprovado: totalErros === 0,
    resultados,
  };
}

/** Validacao restrita a uma unidade orcamentaria, usada na captacao das propostas. */
export function validarUnidade(orcamento: OrcamentoSnapshot, unidade: string): RelatorioValidacao {
  const recorte: OrcamentoSnapshot = {
    ...orcamento,
    dotacoes: orcamento.dotacoes.filter((d: DotacaoItem) => d.unidade === unidade),
    limites: orcamento.limites.filter((l) => l.unidade === unidade),
  };
  const regrasUnidade: Regra[] = [
    tetosUnidades,
    compatibilidadeNatureza,
    classificacoesGenericas,
    compatibilidadePpa,
    valoresConsistentes,
  ];
  const resultados = regrasUnidade.map((regra) => regra(recorte));
  const totalErros = resultados.filter((r) => !r.aprovado && r.severidade === 'ERRO').length;
  const totalAlertas = resultados.filter((r) => !r.aprovado && r.severidade === 'ALERTA').length;
  return {
    exercicio: orcamento.exercicio,
    executadaEm: new Date().toISOString(),
    totalRegras: resultados.length,
    totalErros,
    totalAlertas,
    aprovado: totalErros === 0,
    resultados,
  };
}
