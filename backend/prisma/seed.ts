/**
 * Carga inicial do Sistema de Elaboracao da LOA 2027 - Governo do Estado do Parana.
 *
 * Executa:
 *  1. carga das tabelas de referencia (classificacoes orcamentarias e estrutura institucional);
 *  2. abertura do ciclo do exercicio de 2027 e dos parametros macrofiscais da LDO;
 *  3. projecao da receita para 2027;
 *  4. geracao das propostas de despesa das unidades orcamentarias, equilibradas por fonte de recursos;
 *  5. definicao dos tetos, das emendas parlamentares e dos usuarios de acesso.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerCsv } from '../src/lib/csv.js';
import { centavos, distribuir, formatarBRL } from '../src/lib/money.js';
import { FOLGA_TETO, PLANO_DESPESA, PLANO_RECEITA, PROJECAO } from './dados/plano-loa2027.js';

const prisma = new PrismaClient();
const dadosDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const MILHAO = 1_000_000;

async function limpar() {
  await prisma.resultadoValidacao.deleteMany();
  await prisma.execucaoValidacao.deleteMany();
  await prisma.consolidacao.deleteMany();
  await prisma.auditoria.deleteMany();
  await prisma.emendaParlamentar.deleteMany();
  await prisma.dotacao.deleteMany();
  await prisma.propostaUO.deleteMany();
  await prisma.receitaPrevista.deleteMany();
  await prisma.limiteOrcamentario.deleteMany();
  await prisma.parametroFiscal.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.acao.deleteMany();
  await prisma.programa.deleteMany();
  await prisma.subfuncao.deleteMany();
  await prisma.funcao.deleteMany();
  await prisma.naturezaReceita.deleteMany();
  await prisma.elementoDespesa.deleteMany();
  await prisma.modalidadeAplicacao.deleteMany();
  await prisma.grupoNaturezaDespesa.deleteMany();
  await prisma.fonteRecurso.deleteMany();
  await prisma.unidadeOrcamentaria.deleteMany();
  await prisma.orgao.deleteMany();
  await prisma.exercicio.deleteMany();
}

async function carregarClassificacoes() {
  for (const f of lerCsv(join(dadosDir, 'funcoes.csv'))) {
    await prisma.funcao.create({ data: { codigo: f.codigo, nome: f.nome } });
  }
  const funcoes = await prisma.funcao.findMany();
  const idFuncao = new Map(funcoes.map((f) => [f.codigo, f.id]));

  for (const s of lerCsv(join(dadosDir, 'subfuncoes.csv'))) {
    await prisma.subfuncao.create({
      data: { codigo: s.codigo, nome: s.nome, funcaoId: idFuncao.get(s.funcao) ?? null },
    });
  }

  for (const g of lerCsv(join(dadosDir, 'grupos-natureza-despesa.csv'))) {
    await prisma.grupoNaturezaDespesa.create({ data: { codigo: g.codigo, nome: g.nome, categoria: g.categoria } });
  }
  for (const m of lerCsv(join(dadosDir, 'modalidades-aplicacao.csv'))) {
    await prisma.modalidadeAplicacao.create({ data: { codigo: m.codigo, nome: m.nome } });
  }
  for (const e of lerCsv(join(dadosDir, 'elementos-despesa.csv'))) {
    await prisma.elementoDespesa.create({ data: { codigo: e.codigo, nome: e.nome, grupos: e.grupos } });
  }
  for (const f of lerCsv(join(dadosDir, 'fontes-recurso.csv'))) {
    await prisma.fonteRecurso.create({
      data: { codigo: f.codigo, nome: f.nome, tipo: f.tipo, vinculacao: f.vinculacao || null, origem: f.origem },
    });
  }
  for (const n of lerCsv(join(dadosDir, 'naturezas-receita.csv'))) {
    const digitos = n.codigo.split('.');
    await prisma.naturezaReceita.create({
      data: {
        codigo: n.codigo,
        nome: n.nome,
        categoria: digitos[0],
        origem: digitos[1],
        especie: digitos[2],
        deducao: n.deducao === 'true',
      },
    });
  }
}

async function carregarEstrutura() {
  for (const o of lerCsv(join(dadosDir, 'orgaos.csv'))) {
    await prisma.orgao.create({
      data: { codigo: o.codigo, nome: o.nome, sigla: o.sigla, poder: o.poder, tipoAdministracao: o.tipoAdministracao },
    });
  }
  const orgaos = await prisma.orgao.findMany();
  const idOrgao = new Map(orgaos.map((o) => [o.codigo, o.id]));

  for (const u of lerCsv(join(dadosDir, 'unidades-orcamentarias.csv'))) {
    await prisma.unidadeOrcamentaria.create({
      data: { codigo: u.codigo, nome: u.nome, sigla: u.sigla, orgaoId: idOrgao.get(u.orgao)! },
    });
  }
}

async function carregarPrograma(exercicioAno: number) {
  for (const p of lerCsv(join(dadosDir, 'programas.csv'))) {
    await prisma.programa.create({
      data: {
        codigo: p.codigo,
        nome: p.nome,
        tipo: p.tipo,
        objetivo: p.objetivo || null,
        publicoAlvo: p.publicoAlvo || null,
        ppaInicio: exercicioAno - 3,
        ppaFim: exercicioAno,
      },
    });
  }
  const programas = await prisma.programa.findMany();
  const idPrograma = new Map(programas.map((p) => [p.codigo, p.id]));

  for (const a of lerCsv(join(dadosDir, 'acoes.csv'))) {
    await prisma.acao.create({
      data: {
        codigo: a.codigo,
        nome: a.nome,
        tipo: a.tipo,
        programaId: idPrograma.get(a.programa)!,
        produto: a.produto || null,
        unidadeMedida: a.unidadeMedida || null,
        metaFisica: a.metaFisica ? Number(a.metaFisica) : null,
      },
    });
  }
}

async function main() {
  console.log('Limpando base...');
  await limpar();

  console.log('Carregando tabelas de referencia (classificacoes orcamentarias)...');
  await carregarClassificacoes();
  await carregarEstrutura();
  await carregarPrograma(PROJECAO.exercicio);

  console.log('Abrindo o ciclo do exercicio de %d...', PROJECAO.exercicio);
  const exercicio = await prisma.exercicio.create({
    data: {
      ano: PROJECAO.exercicio,
      status: 'CONSOLIDACAO',
      ppaInicio: PROJECAO.exercicio - 3,
      ppaFim: PROJECAO.exercicio,
      ldoLei: `Lei de Diretrizes Orcamentarias para ${PROJECAO.exercicio}`,
      dataLimiteUO: new Date(`${PROJECAO.exercicio - 1}-07-31T23:59:59Z`),
      dataEnvioAlep: new Date(`${PROJECAO.exercicio - 1}-09-30T23:59:59Z`),
      observacao: `Ultimo exercicio do PPA ${PROJECAO.exercicio - 3}-${PROJECAO.exercicio}.`,
    },
  });

  const parametros = [
    { chave: 'RCL_PROJETADA', descricao: 'Receita Corrente Liquida projetada para o exercicio', valor: centavos(54000 * PROJECAO.fator * MILHAO), unidade: 'BRL', fundamento: 'Art. 2o, IV, da LC 101/2000' },
    { chave: 'PERC_MIN_EDUCACAO', descricao: 'Aplicacao minima na manutencao e desenvolvimento do ensino', valor: 25, unidade: 'PERCENTUAL', fundamento: 'Art. 212 da CF' },
    { chave: 'PERC_MIN_SAUDE', descricao: 'Aplicacao minima em acoes e servicos publicos de saude', valor: 12, unidade: 'PERCENTUAL', fundamento: 'Art. 6o da LC 141/2012 e art. 198, §2o, II, da CF' },
    { chave: 'PERC_MIN_FUNDEB_PROFISSIONAIS', descricao: 'Parcela minima do FUNDEB destinada a remuneracao dos profissionais da educacao basica', valor: 70, unidade: 'PERCENTUAL', fundamento: 'Art. 212-A, XI, da CF' },
    { chave: 'PERC_MIN_RESERVA_CONTINGENCIA', descricao: 'Reserva de contingencia minima em relacao a RCL', valor: 0.5, unidade: 'PERCENTUAL', fundamento: 'Art. 5o, III, da LC 101/2000 e LDO' },
    { chave: 'PERC_MAX_PESSOAL_TOTAL', descricao: 'Limite total de despesa com pessoal em relacao a RCL', valor: 60, unidade: 'PERCENTUAL', fundamento: 'Art. 19, II, da LC 101/2000' },
    { chave: 'PERC_MAX_PESSOAL_EXECUTIVO', descricao: 'Limite de despesa com pessoal do Poder Executivo', valor: 49, unidade: 'PERCENTUAL', fundamento: 'Art. 20, II, c, da LC 101/2000' },
    { chave: 'PERC_MAX_PESSOAL_LEGISLATIVO', descricao: 'Limite de despesa com pessoal do Poder Legislativo, incluido o Tribunal de Contas', valor: 3, unidade: 'PERCENTUAL', fundamento: 'Art. 20, II, a, da LC 101/2000' },
    { chave: 'PERC_MAX_PESSOAL_JUDICIARIO', descricao: 'Limite de despesa com pessoal do Poder Judiciario', valor: 6, unidade: 'PERCENTUAL', fundamento: 'Art. 20, II, b, da LC 101/2000' },
    { chave: 'PERC_MAX_PESSOAL_MP', descricao: 'Limite de despesa com pessoal do Ministerio Publico', valor: 2, unidade: 'PERCENTUAL', fundamento: 'Art. 20, II, d, da LC 101/2000' },
    { chave: 'PERC_LIMITE_EMENDAS', descricao: 'Limite das emendas parlamentares em relacao a RCL', valor: 0.5, unidade: 'PERCENTUAL', fundamento: 'LDO do exercicio' },
    { chave: 'IPCA_PROJETADO', descricao: 'Deflator implicito projetado para o exercicio', valor: PROJECAO.deflatorAnual * 100, unidade: 'PERCENTUAL', fundamento: 'Anexo de Metas Fiscais da LDO' },
    { chave: 'PIB_REAL_PROJETADO', descricao: 'Crescimento real projetado do PIB estadual', valor: PROJECAO.crescimentoRealAnual * 100, unidade: 'PERCENTUAL', fundamento: 'Anexo de Metas Fiscais da LDO' },
    { chave: 'TOLERANCIA_EQUILIBRIO', descricao: 'Tolerancia admitida na verificacao do equilibrio orcamentario', valor: 0.01, unidade: 'BRL', fundamento: 'Art. 2o da Lei 4.320/1964' },
  ];
  for (const p of parametros) {
    await prisma.parametroFiscal.create({ data: { ...p, exercicioId: exercicio.id } });
  }

  const fontes = await prisma.fonteRecurso.findMany();
  const idFonte = new Map(fontes.map((f) => [f.codigo, f.id]));
  const naturezas = await prisma.naturezaReceita.findMany();
  const idNatureza = new Map(naturezas.map((n) => [n.codigo, n.id]));
  const unidades = await prisma.unidadeOrcamentaria.findMany();
  const idUnidade = new Map(unidades.map((u) => [u.codigo, u.id]));
  const funcoes = await prisma.funcao.findMany();
  const idFuncao = new Map(funcoes.map((f) => [f.codigo, f.id]));
  const subfuncoes = await prisma.subfuncao.findMany();
  const idSubfuncao = new Map(subfuncoes.map((s) => [s.codigo, s.id]));
  const programas = await prisma.programa.findMany();
  const idPrograma = new Map(programas.map((p) => [p.codigo, p.id]));
  const acoes = await prisma.acao.findMany();
  const idAcao = new Map(acoes.map((a) => [`${a.programaId}:${a.codigo}`, a.id]));
  const grupos = await prisma.grupoNaturezaDespesa.findMany();
  const grupoPorCodigo = new Map(grupos.map((g) => [g.codigo, g]));
  const modalidades = await prisma.modalidadeAplicacao.findMany();
  const idModalidade = new Map(modalidades.map((m) => [m.codigo, m.id]));
  const elementos = await prisma.elementoDespesa.findMany();
  const idElemento = new Map(elementos.map((e) => [e.codigo, e.id]));

  console.log('Projetando a receita de %d (fator %s)...', PROJECAO.exercicio, PROJECAO.fator.toFixed(4));
  const receitaPorFonte = new Map<string, number>();
  for (const linha of PLANO_RECEITA) {
    const valor = centavos(linha.base * PROJECAO.fator * MILHAO);
    await prisma.receitaPrevista.create({
      data: {
        exercicioId: exercicio.id,
        naturezaId: idNatureza.get(linha.natureza)!,
        fonteId: idFonte.get(linha.fonte)!,
        esfera: linha.esfera,
        valor,
        memoriaCalculo: `${linha.memoria} Base ${PROJECAO.exercicioBase}: R$ ${formatarBRL(linha.base)} milhoes; fator de projecao ${PROJECAO.fator.toFixed(4)}.`,
      },
    });
    receitaPorFonte.set(linha.fonte, centavos((receitaPorFonte.get(linha.fonte) ?? 0) + valor));
  }

  const receitaTotal = centavos([...receitaPorFonte.values()].reduce((t, v) => t + v, 0));
  console.log('Receita liquida prevista: R$ %s', formatarBRL(receitaTotal));

  console.log('Gerando as propostas de despesa das unidades orcamentarias...');
  // A despesa de cada fonte e escalonada para consumir exatamente a receita
  // liquida prevista naquela fonte, assegurando o equilibrio por fonte.
  const linhasComValor: { linha: (typeof PLANO_DESPESA)[number]; valor: number }[] = [];
  for (const [codigoFonte, receitaFonte] of receitaPorFonte) {
    const linhasFonte = PLANO_DESPESA.filter((l) => l.fonte === codigoFonte);
    if (linhasFonte.length === 0) {
      throw new Error(`Fonte ${codigoFonte} possui receita prevista sem despesa correspondente no plano.`);
    }
    const valores = distribuir(
      receitaFonte,
      linhasFonte.map((l) => l.peso),
    );
    linhasFonte.forEach((linha, i) => linhasComValor.push({ linha, valor: valores[i] }));
  }

  const fonteSemReceita = PLANO_DESPESA.filter((l) => !receitaPorFonte.has(l.fonte));
  if (fonteSemReceita.length > 0) {
    throw new Error(`Despesa prevista em fonte sem receita: ${[...new Set(fonteSemReceita.map((l) => l.fonte))].join(', ')}`);
  }

  const propostaPorUnidade = new Map<number, number>();
  const totalPorUnidade = new Map<number, number>();
  const naoHomologadas = new Set(['7300.7301', '7400.7401', '7200.7201']);

  for (const { linha, valor } of linhasComValor) {
    const unidadeId = idUnidade.get(linha.uo);
    if (!unidadeId) throw new Error(`Unidade orcamentaria desconhecida: ${linha.uo}`);

    let propostaId = propostaPorUnidade.get(unidadeId);
    if (!propostaId) {
      const status = naoHomologadas.has(linha.uo) ? 'ENVIADA' : 'HOMOLOGADA';
      const proposta = await prisma.propostaUO.create({
        data: {
          exercicioId: exercicio.id,
          unidadeId,
          status,
          enviadaEm: new Date(`${PROJECAO.exercicio - 1}-07-25T12:00:00Z`),
          analisadaEm: status === 'HOMOLOGADA' ? new Date(`${PROJECAO.exercicio - 1}-08-20T12:00:00Z`) : null,
          parecer: status === 'HOMOLOGADA' ? 'Proposta compativel com o teto e com as diretrizes da LDO.' : null,
        },
      });
      propostaId = proposta.id;
      propostaPorUnidade.set(unidadeId, propostaId);
    }

    const programaId = idPrograma.get(linha.programa)!;
    const grupo = grupoPorCodigo.get(linha.grupo)!;
    await prisma.dotacao.create({
      data: {
        propostaId,
        unidadeId,
        funcaoId: idFuncao.get(linha.funcao)!,
        subfuncaoId: idSubfuncao.get(linha.subfuncao)!,
        programaId,
        acaoId: idAcao.get(`${programaId}:${linha.acao}`)!,
        subtitulo: linha.subtitulo ?? '0000',
        localizador: linha.localizador ?? 'Estado do Parana',
        esfera: ['08', '09', '10'].includes(linha.funcao) ? 'S' : 'F',
        categoria: grupo.categoria,
        grupoId: grupo.id,
        modalidadeId: idModalidade.get(linha.modalidade)!,
        elementoId: idElemento.get(linha.elemento)!,
        fonteId: idFonte.get(linha.fonte)!,
        rp: linha.rp ?? '2',
        valor,
        justificativa: linha.justificativa ?? null,
      },
    });
    totalPorUnidade.set(unidadeId, centavos((totalPorUnidade.get(unidadeId) ?? 0) + valor));
  }

  console.log('Definindo os tetos das unidades orcamentarias...');
  for (const [unidadeId, total] of totalPorUnidade) {
    await prisma.limiteOrcamentario.create({
      data: {
        exercicioId: exercicio.id,
        unidadeId,
        escopo: 'TOTAL',
        valor: centavos(total * FOLGA_TETO),
        observacao: `Teto comunicado pela SEPL/SEFA com folga de ${((FOLGA_TETO - 1) * 100).toFixed(0)}% sobre a proposta preliminar.`,
      },
    });
  }

  console.log('Registrando emendas parlamentares...');
  const emendas = [
    { numero: '2027/0001', autor: 'Deputado Estadual - Bancada do Norte Pioneiro', uo: '3000.3002', acao: '1305', objeto: 'Ampliacao de hospital regional', municipio: 'Cornelio Procopio', valor: 8_500_000 },
    { numero: '2027/0002', autor: 'Deputada Estadual - Comissao de Educacao', uo: '4000.4002', acao: '1106', objeto: 'Reforma de escolas estaduais', municipio: 'Londrina', valor: 6_200_000 },
    { numero: '2027/0003', autor: 'Deputado Estadual - Bancada do Oeste', uo: '6000.6002', acao: '1702', objeto: 'Pavimentacao de rodovia estadual', municipio: 'Cascavel', valor: 12_000_000 },
    { numero: '2027/0004', autor: 'Deputado Estadual - Comissao de Seguranca', uo: '5000.5001', acao: '1505', objeto: 'Aquisicao de viaturas policiais', municipio: 'Curitiba', valor: 4_800_000 },
    { numero: '2027/0005', autor: 'Deputada Estadual - Bancada dos Campos Gerais', uo: '7500.7502', acao: '3101', objeto: 'Estruturacao de centros de convivencia', municipio: 'Ponta Grossa', valor: 3_100_000 },
  ];
  for (const e of emendas) {
    const unidadeId = idUnidade.get(e.uo)!;
    const acao = acoes.find((a) => a.codigo === e.acao);
    await prisma.emendaParlamentar.create({
      data: {
        exercicioId: exercicio.id,
        numero: e.numero,
        autor: e.autor,
        unidadeId,
        acaoId: acao?.id ?? null,
        objeto: e.objeto,
        municipio: e.municipio,
        valor: e.valor,
        status: 'PROPOSTA',
      },
    });
  }

  console.log('Criando usuarios de acesso...');
  const senha = await bcrypt.hash('loa2027', 10);
  const usuarios = [
    { nome: 'Administrador do Sistema', email: 'admin@sepl.pr.gov.br', perfil: 'ADMIN', uo: null },
    { nome: 'Coordenacao de Orcamento - SEPL', email: 'orcamento@sepl.pr.gov.br', perfil: 'ORGAO_CENTRAL', uo: null },
    { nome: 'Diretoria de Contabilidade - SEFA', email: 'contabilidade@sefa.pr.gov.br', perfil: 'ORGAO_CENTRAL', uo: null },
    { nome: 'Grupo Orcamentario Setorial - SESA', email: 'gos@sesa.pr.gov.br', perfil: 'UNIDADE_ORCAMENTARIA', uo: '3000.3001' },
    { nome: 'Grupo Orcamentario Setorial - SEED', email: 'gos@seed.pr.gov.br', perfil: 'UNIDADE_ORCAMENTARIA', uo: '4000.4001' },
    { nome: 'Grupo Orcamentario Setorial - SESP', email: 'gos@sesp.pr.gov.br', perfil: 'UNIDADE_ORCAMENTARIA', uo: '5000.5001' },
    { nome: 'Controle Interno - CGE', email: 'auditoria@cge.pr.gov.br', perfil: 'CONTROLE_INTERNO', uo: null },
    { nome: 'Consulta Publica', email: 'consulta@pr.gov.br', perfil: 'CONSULTA', uo: null },
  ];
  for (const u of usuarios) {
    await prisma.usuario.create({
      data: {
        nome: u.nome,
        email: u.email,
        senhaHash: senha,
        perfil: u.perfil,
        unidadeId: u.uo ? idUnidade.get(u.uo)! : null,
      },
    });
  }

  const despesaTotal = centavos([...totalPorUnidade.values()].reduce((t, v) => t + v, 0));
  const dotacoes = await prisma.dotacao.count();
  console.log('---');
  console.log('Receita prevista .....: R$ %s', formatarBRL(receitaTotal));
  console.log('Despesa fixada .......: R$ %s', formatarBRL(despesaTotal));
  console.log('Diferenca ............: R$ %s', formatarBRL(centavos(receitaTotal - despesaTotal)));
  console.log('Unidades com proposta : %d', propostaPorUnidade.size);
  console.log('Dotacoes geradas .....: %d', dotacoes);
  console.log('Usuarios .............: %d (senha padrao: loa2027)', usuarios.length);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (erro) => {
    console.error(erro);
    await prisma.$disconnect();
    process.exit(1);
  });
