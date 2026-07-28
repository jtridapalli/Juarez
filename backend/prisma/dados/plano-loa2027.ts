/**
 * Proposta base da LOA 2027 - Governo do Estado do Parana.
 *
 * Os valores estao expressos em R$ milhoes na base do exercicio de referencia
 * (2025) e sao projetados para 2027 pelo fator definido em PROJECAO, que
 * combina a variacao real do PIB estadual com o deflator implicito adotado
 * na LDO. A rotina de carga escalona a despesa de cada fonte de recursos para
 * que a soma seja exatamente igual a receita liquida prevista naquela fonte,
 * garantindo o equilibrio exigido pelo art. 2o da Lei 4.320/1964 e a
 * observancia das vinculacoes constitucionais.
 *
 * Esta e uma carga de referencia para operacao do sistema. Antes do uso
 * oficial, as tabelas devem ser substituidas pelas extracoes da SEFA/SEPL.
 */

export const PROJECAO = {
  exercicioBase: 2025,
  exercicio: 2027,
  crescimentoRealAnual: 0.031,
  deflatorAnual: 0.042,
  get fator(): number {
    return Math.pow(1 + this.crescimentoRealAnual + this.deflatorAnual, this.exercicio - this.exercicioBase);
  },
};

export interface LinhaReceita {
  natureza: string;
  fonte: string;
  esfera: 'F' | 'S';
  /** Valor base em R$ milhoes (exercicio de referencia). */
  base: number;
  unidade?: string;
  memoria: string;
}

export const PLANO_RECEITA: LinhaReceita[] = [
  // --- Impostos ---------------------------------------------------------
  {
    natureza: '1.1.1.8.01.1.1',
    fonte: '500',
    esfera: 'F',
    base: 55000,
    memoria: 'Projecao do ICMS pela serie historica de arrecadacao ajustada pela variacao do PIB estadual e do IPCA, liquida de incentivos.',
  },
  { natureza: '1.1.1.8.01.1.3', fonte: '500', esfera: 'F', base: 900, memoria: 'Recuperacao de credito inscrito em divida ativa de ICMS.' },
  {
    natureza: '1.1.1.8.02.1.1',
    fonte: '500',
    esfera: 'F',
    base: 8200,
    memoria: 'IPVA calculado sobre a frota tributada projetada e o valor venal medio das tabelas FIPE.',
  },
  { natureza: '1.1.1.8.02.1.3', fonte: '500', esfera: 'F', base: 260, memoria: 'Divida ativa de IPVA.' },
  { natureza: '1.1.1.8.03.1.1', fonte: '500', esfera: 'F', base: 1150, memoria: 'ITCMD segundo a serie de declaracoes homologadas.' },
  { natureza: '1.1.1.3.03.1.1', fonte: '500', esfera: 'F', base: 3400, memoria: 'IRRF sobre a folha de pagamento dos servidores estaduais (art. 157, I, da CF).' },

  // --- Taxas ------------------------------------------------------------
  { natureza: '1.1.2.8.01.1.1', fonte: '501', esfera: 'F', base: 950, memoria: 'Taxas de servicos administrativos e cartorarios.' },
  { natureza: '1.1.2.8.01.1.1', fonte: '765', esfera: 'F', base: 300, memoria: 'Taxa judiciaria vinculada ao FUNREJUS.' },
  { natureza: '1.1.2.8.02.1.1', fonte: '766', esfera: 'F', base: 780, memoria: 'Taxas de poder de policia, incluidas as de transito arrecadadas pelo DETRAN.' },

  // --- Contribuicoes previdenciarias -----------------------------------
  { natureza: '1.2.1.0.02.1.1', fonte: '701', esfera: 'S', base: 2100, memoria: 'Contribuicao de servidores ativos, aliquota de 14% sobre a base de calculo projetada.' },
  { natureza: '1.2.1.0.05.1.1', fonte: '701', esfera: 'S', base: 620, memoria: 'Contribuicao de aposentados e pensionistas sobre a parcela que excede o teto do RGPS.' },
  { natureza: '7.2.1.0.01.1.1', fonte: '701', esfera: 'S', base: 4300, memoria: 'Contribuicao patronal intraorcamentaria dos orgaos e entidades do Estado.' },

  // --- Receitas patrimoniais e de servicos ------------------------------
  { natureza: '1.3.1.0.00.1.1', fonte: '764', esfera: 'F', base: 95, memoria: 'Receita imobiliaria de autarquias e fundacoes.' },
  { natureza: '1.3.2.0.00.1.1', fonte: '501', esfera: 'F', base: 1850, memoria: 'Remuneracao de disponibilidades financeiras pela taxa Selic media projetada.' },
  { natureza: '1.6.1.0.00.1.1', fonte: '764', esfera: 'F', base: 640, memoria: 'Servicos prestados por autarquias, fundacoes e fundos estaduais.' },

  // --- Transferencias correntes ----------------------------------------
  { natureza: '1.7.1.8.01.2.1', fonte: '500', esfera: 'F', base: 4100, memoria: 'Cota-parte do FPE conforme coeficiente do Parana e projecao da STN.' },
  { natureza: '1.7.1.8.01.3.1', fonte: '799', esfera: 'F', base: 45, memoria: 'Desoneracao das exportacoes - LC 87/1996.' },
  { natureza: '1.7.1.8.02.1.1', fonte: '600', esfera: 'S', base: 3250, memoria: 'Transferencias fundo a fundo do SUS pelos blocos de custeio e investimento.' },
  { natureza: '1.7.1.8.03.1.1', fonte: '550', esfera: 'F', base: 1180, memoria: 'Quota estadual do salario-educacao repassada pelo FNDE.' },
  { natureza: '1.7.1.8.04.1.1', fonte: '660', esfera: 'S', base: 210, memoria: 'Transferencias do FNAS para os servicos socioassistenciais.' },
  { natureza: '1.7.1.8.05.1.1', fonte: '759', esfera: 'F', base: 520, memoria: 'Convenios e instrumentos congeneres celebrados com a Uniao - custeio.' },
  { natureza: '1.7.1.8.05.1.1', fonte: '602', esfera: 'S', base: 180, memoria: 'Convenios com a Uniao vinculados a acoes e servicos publicos de saude.' },
  { natureza: '1.7.1.8.06.1.1', fonte: '500', esfera: 'F', base: 620, memoria: 'Cota-parte do IPI - Estados exportadores.' },
  { natureza: '1.7.1.8.07.1.1', fonte: '799', esfera: 'F', base: 130, memoria: 'Cota-parte da CIDE-Combustiveis, vinculada a infraestrutura de transportes.' },
  { natureza: '1.7.1.8.08.1.1', fonte: '761', esfera: 'F', base: 210, memoria: 'Compensacao financeira pela utilizacao de recursos hidricos e royalties.' },
  { natureza: '1.7.5.8.01.1.1', fonte: '540', esfera: 'F', base: 4900, memoria: 'Retorno da parcela estadual do FUNDEB apurada pelo VAAF.' },
  { natureza: '1.7.5.8.02.1.1', fonte: '542', esfera: 'F', base: 780, memoria: 'Complementacao da Uniao ao FUNDEB - VAAT.' },
  { natureza: '1.7.5.8.03.1.1', fonte: '543', esfera: 'F', base: 190, memoria: 'Complementacao da Uniao ao FUNDEB - VAAR.' },

  // --- Outras receitas correntes ---------------------------------------
  { natureza: '1.9.0.8.01.1.1', fonte: '500', esfera: 'F', base: 850, memoria: 'Multas e juros de mora dos tributos estaduais.' },
  { natureza: '1.9.0.8.02.1.1', fonte: '501', esfera: 'F', base: 430, memoria: 'Indenizacoes, restituicoes e ressarcimentos.' },
  { natureza: '1.9.0.8.99.1.1', fonte: '501', esfera: 'F', base: 1320, memoria: 'Demais receitas correntes diversas.' },

  // --- Receitas de capital ----------------------------------------------
  { natureza: '2.1.1.8.01.1.1', fonte: '750', esfera: 'F', base: 1900, memoria: 'Operacoes de credito internas contratadas com instituicoes financeiras nacionais, com autorizacao legislativa vigente.' },
  { natureza: '2.1.2.8.01.1.1', fonte: '750', esfera: 'F', base: 1100, memoria: 'Operacoes de credito externas com organismos multilaterais, garantia da Uniao.' },
  { natureza: '2.2.1.8.01.1.1', fonte: '752', esfera: 'F', base: 60, memoria: 'Alienacao de bens moveis inserviveis.' },
  { natureza: '2.2.2.8.01.1.1', fonte: '752', esfera: 'F', base: 240, memoria: 'Alienacao de bens imoveis nao afetados ao servico publico.' },
  { natureza: '2.4.1.8.01.1.1', fonte: '759', esfera: 'F', base: 480, memoria: 'Transferencias de capital da Uniao decorrentes de convenios e transferencias especiais.' },

  // --- Deducoes da receita ----------------------------------------------
  {
    natureza: '9.1.1.8.03.1.1',
    fonte: '500',
    esfera: 'F',
    base: -13975,
    memoria: 'Cota-parte de 25% do ICMS pertencente aos municipios (art. 158, IV, da CF).',
  },
  {
    natureza: '9.1.1.8.04.1.1',
    fonte: '500',
    esfera: 'F',
    base: -4230,
    memoria: 'Cota-parte de 50% do IPVA pertencente aos municipios (art. 158, III, da CF).',
  },
  {
    natureza: '9.1.1.8.01.1.1',
    fonte: '500',
    esfera: 'F',
    base: -8385,
    memoria: 'Deducao de 20% do ICMS liquido para formacao do FUNDEB (art. 212-A da CF).',
  },
  {
    natureza: '9.1.1.8.02.1.1',
    fonte: '500',
    esfera: 'F',
    base: -846,
    memoria: 'Deducao de 20% do IPVA liquido para formacao do FUNDEB (art. 212-A da CF).',
  },
  {
    natureza: '9.1.7.8.01.1.1',
    fonte: '500',
    esfera: 'F',
    base: -944,
    memoria: 'Deducao de 20% do FPE e da cota-parte do IPI-Exportacao para formacao do FUNDEB.',
  },
  { natureza: '9.1.9.8.99.1.1', fonte: '500', esfera: 'F', base: -1100, memoria: 'Restituicoes de tributos e demais deducoes de receita.' },
];

export interface LinhaDespesa {
  uo: string;
  programa: string;
  acao: string;
  funcao: string;
  subfuncao: string;
  grupo: string;
  modalidade: string;
  elemento: string;
  fonte: string;
  /** Peso relativo em R$ milhoes na base do exercicio de referencia. */
  peso: number;
  subtitulo?: string;
  localizador?: string;
  rp?: string;
  justificativa?: string;
}

const d = (
  uo: string,
  programa: string,
  acao: string,
  funcao: string,
  subfuncao: string,
  grupo: string,
  modalidade: string,
  elemento: string,
  fonte: string,
  peso: number,
  extra: Partial<LinhaDespesa> = {},
): LinhaDespesa => ({ uo, programa, acao, funcao, subfuncao, grupo, modalidade, elemento, fonte, peso, ...extra });

export const PLANO_DESPESA: LinhaDespesa[] = [
  // ===================== Fonte 500 - recursos nao vinculados de impostos
  // Poderes e orgaos autonomos
  d('0100.0101', '2301', '3801', '01', '031', '1', '90', '11', '500', 780, { rp: '1' }),
  d('0100.0101', '2301', '3801', '01', '031', '3', '90', '39', '500', 210),
  d('0200.0201', '2301', '3802', '01', '032', '1', '90', '11', '500', 520, { rp: '1' }),
  d('0200.0201', '2301', '3802', '01', '032', '3', '90', '39', '500', 95),
  d('0300.0301', '2301', '3803', '02', '061', '1', '90', '11', '500', 3400, { rp: '1' }),
  d('0300.0301', '2301', '3803', '02', '061', '3', '90', '39', '500', 480),
  d('0300.0301', '2301', '3803', '02', '061', '4', '90', '52', '500', 60),
  d('0400.0401', '2301', '3804', '03', '091', '1', '90', '11', '500', 1180, { rp: '1' }),
  d('0400.0401', '2301', '3804', '03', '091', '3', '90', '39', '500', 140),
  d('0500.0501', '2301', '3805', '03', '091', '1', '90', '11', '500', 330, { rp: '1' }),
  d('0500.0501', '2301', '3805', '03', '091', '3', '90', '39', '500', 55),
  d('1300.1301', '2301', '3806', '03', '092', '1', '90', '11', '500', 260, { rp: '1' }),
  d('1300.1301', '0100', '2002', '03', '092', '3', '90', '39', '500', 45),

  // Administracao geral do Executivo
  d('1000.1001', '0100', '2001', '04', '122', '1', '90', '11', '500', 190, { rp: '1' }),
  d('1000.1001', '0100', '2002', '04', '122', '3', '90', '39', '500', 130),
  d('1000.1002', '0100', '2002', '04', '121', '3', '90', '39', '500', 38),
  d('1100.1101', '1201', '2503', '06', '182', '3', '90', '39', '500', 120),
  d('1200.1201', '2201', '3703', '04', '124', '1', '90', '11', '500', 85, { rp: '1' }),
  d('2000.2001', '2201', '3702', '04', '121', '1', '90', '11', '500', 70, { rp: '1' }),
  d('2000.2001', '2201', '3702', '04', '121', '3', '90', '39', '500', 210),
  d('2100.2101', '2201', '3701', '04', '129', '1', '90', '11', '500', 950, { rp: '1' }),
  d('2100.2101', '2201', '3701', '04', '129', '3', '90', '39', '500', 380),
  d('2200.2201', '0100', '2001', '04', '122', '1', '90', '11', '500', 240, { rp: '1' }),
  d('2200.2201', '0100', '2002', '04', '122', '3', '90', '39', '500', 320),
  d('7600.7601', '2101', '3601', '04', '126', '3', '90', '39', '500', 180),
  d('7600.7602', '2101', '3602', '04', '126', '3', '91', '39', '500', 420),
  d('7600.7601', '2101', '3601', '04', '126', '4', '90', '52', '500', 95),

  // Educacao custeada com recursos de impostos
  d('4000.4001', '1001', '2101', '12', '368', '1', '90', '11', '500', 5600, { rp: '1' }),
  d('4000.4001', '1001', '2101', '12', '368', '3', '90', '39', '500', 760),
  d('4000.4001', '1001', '2102', '12', '368', '3', '90', '30', '500', 240),
  d('4000.4001', '1001', '2104', '12', '367', '3', '50', '43', '500', 320, {
    justificativa: 'Subvencao social as instituicoes conveniadas de educacao especial.',
  }),
  d('4000.4002', '1001', '1106', '12', '368', '4', '90', '51', '500', 280),
  d('4100.4102', '1002', '2201', '12', '364', '1', '90', '11', '500', 880, { rp: '1' }),
  d('4100.4103', '1002', '2201', '12', '364', '1', '90', '11', '500', 820, { rp: '1' }),
  d('4100.4104', '1002', '2201', '12', '364', '1', '90', '11', '500', 480, { rp: '1' }),
  d('4100.4105', '1002', '2201', '12', '364', '1', '90', '11', '500', 430, { rp: '1' }),
  d('4100.4106', '1002', '2201', '12', '364', '1', '90', '11', '500', 470, { rp: '1' }),
  d('4100.4107', '1002', '2201', '12', '364', '1', '90', '11', '500', 360, { rp: '1' }),
  d('4100.4108', '1002', '2201', '12', '364', '1', '90', '11', '500', 190, { rp: '1' }),
  d('4100.4101', '1002', '2202', '12', '363', '3', '90', '39', '500', 210),
  d('4100.4101', '1002', '1204', '12', '364', '4', '90', '51', '500', 160),

  // Saude custeada com recursos proprios do Estado (base do minimo de 12%)
  d('3000.3001', '1101', '2301', '10', '302', '1', '90', '11', '500', 2100, { rp: '1' }),
  d('3000.3002', '1101', '2301', '10', '302', '3', '90', '39', '500', 3200),
  d('3000.3002', '1101', '2302', '10', '301', '3', '41', '41', '500', 1250, {
    justificativa: 'Transferencia fundo a fundo aos municipios para custeio da atencao primaria.',
  }),
  d('3000.3003', '1101', '2303', '10', '303', '3', '90', '30', '500', 1150),
  d('3000.3001', '1101', '2304', '10', '302', '3', '90', '39', '500', 380),
  d('3000.3001', '1101', '1305', '10', '302', '4', '90', '51', '500', 320),
  d('3000.3001', '1102', '2401', '10', '305', '3', '90', '30', '500', 200),

  // Aporte do Tesouro ao regime proprio de previdencia
  d('2200.2203', '0200', '0201', '09', '272', '1', '90', '01', '500', 2600, { rp: '1' }),
  d('2200.2203', '0200', '0202', '09', '272', '1', '90', '03', '500', 900, { rp: '1' }),

  // Seguranca publica e sistema penal
  d('5000.5002', '1201', '2501', '06', '181', '1', '90', '12', '500', 3900, { rp: '1' }),
  d('5000.5003', '1201', '2502', '06', '181', '1', '90', '11', '500', 1650, { rp: '1' }),
  d('5000.5004', '1201', '2502', '06', '183', '1', '90', '11', '500', 240, { rp: '1' }),
  d('5000.5005', '1201', '2503', '06', '182', '1', '90', '12', '500', 980, { rp: '1' }),
  d('5000.5001', '1201', '2501', '06', '181', '3', '90', '39', '500', 620),
  d('5100.5102', '1202', '2601', '14', '421', '1', '90', '11', '500', 420, { rp: '1' }),
  d('5100.5102', '1202', '2601', '14', '421', '3', '90', '39', '500', 190),

  // Encargos especiais
  d('8000.8001', '0300', '0301', '28', '843', '6', '90', '71', '500', 1750, { rp: '1' }),
  d('8000.8001', '0300', '0301', '28', '843', '2', '90', '21', '500', 1250, { rp: '1' }),
  d('8000.8001', '0300', '0302', '28', '844', '6', '90', '71', '500', 260, { rp: '1' }),
  d('8000.8001', '0300', '0303', '28', '846', '3', '90', '91', '500', 900, {
    rp: '1',
    justificativa: 'Precatorios e requisicoes de pequeno valor inscritos ate 2 de abril, na forma do art. 100 da CF.',
  }),
  d('8000.8001', '0300', '0305', '28', '846', '3', '91', '13', '500', 340, { rp: '1' }),

  // Demais politicas publicas
  d('6000.6002', '1301', '2701', '26', '782', '3', '90', '39', '500', 720),
  d('6000.6002', '1301', '1702', '26', '782', '4', '90', '51', '500', 480),
  d('6000.6001', '1302', '2801', '26', '782', '3', '90', '39', '500', 95),
  d('6000.6001', '1302', '1803', '15', '453', '4', '40', '42', '500', 210),
  d('7000.7001', '1401', '2902', '08', '244', '3', '90', '32', '500', 140),
  d('7000.7003', '1401', '2901', '20', '606', '1', '90', '11', '500', 320, { rp: '1' }),
  d('7000.7002', '1402', '2911', '20', '604', '1', '90', '11', '500', 210, { rp: '1' }),
  d('7000.7001', '1401', '1903', '20', '605', '4', '40', '42', '500', 130),
  d('7100.7102', '1501', '3001', '18', '542', '1', '90', '11', '500', 190, { rp: '1' }),
  d('7100.7101', '1501', '3002', '18', '544', '3', '90', '39', '500', 85),
  d('7100.7101', '1501', '1003', '18', '541', '4', '90', '51', '500', 60),
  d('7500.7501', '1601', '3101', '08', '244', '3', '90', '39', '500', 180),
  d('7500.7502', '1601', '3102', '08', '244', '3', '41', '41', '500', 260),
  d('7500.7501', '1601', '3103', '14', '422', '3', '90', '39', '500', 95),
  d('7400.7401', '1901', '3401', '13', '392', '3', '90', '39', '500', 130),
  d('7300.7301', '1901', '3402', '27', '812', '3', '90', '39', '500', 120),
  d('7300.7301', '1901', '3403', '23', '695', '3', '90', '39', '500', 85),
  d('4100.4110', '1701', '3201', '19', '571', '3', '90', '20', '500', 180),
  d('4100.4109', '1701', '3202', '19', '572', '3', '90', '39', '500', 95),
  d('7200.7201', '1801', '3301', '22', '661', '3', '90', '39', '500', 110),
  d('7200.7201', '1801', '3302', '11', '333', '3', '90', '39', '500', 90),
  d('6100.6101', '2001', '1502', '15', '451', '4', '40', '42', '500', 350),
  d('6100.6102', '2001', '3501', '16', '482', '3', '90', '39', '500', 160),
  d('2100.2102', '1801', '3301', '23', '694', '5', '90', '65', '500', 120),

  // Reserva de contingencia (art. 5o, III, da LC 101/2000)
  d('8000.8002', '0001', '9999', '99', '999', '9', '99', '99', '500', 450, {
    justificativa: 'Reserva destinada ao atendimento de passivos contingentes e outros riscos fiscais imprevistos.',
  }),

  // ===================== Fonte 501 - outros recursos nao vinculados
  d('2100.2101', '0100', '2002', '04', '122', '3', '90', '39', '501', 620),
  d('2200.2201', '0100', '2003', '04', '128', '3', '90', '36', '501', 180),
  d('1000.1001', '0100', '2004', '04', '126', '3', '90', '39', '501', 240),
  d('0300.0301', '2301', '3803', '02', '061', '3', '90', '30', '501', 210),
  d('3000.3001', '1101', '2301', '10', '302', '3', '90', '39', '501', 900),
  d('4000.4001', '1001', '2101', '12', '368', '3', '90', '39', '501', 780),
  d('5000.5001', '1201', '2501', '06', '181', '3', '90', '30', '501', 420),
  d('6000.6002', '1301', '2701', '26', '782', '3', '90', '39', '501', 560),
  d('8000.8001', '0300', '0303', '28', '846', '3', '90', '92', '501', 240, { rp: '1' }),
  d('2200.2201', '0100', '1005', '04', '122', '4', '90', '51', '501', 400),

  // ===================== Fonte 764 - receitas proprias de autarquias e fundos
  d('5000.5006', '1201', '2504', '06', '181', '1', '90', '11', '764', 260, { rp: '1' }),
  d('7000.7002', '1402', '2911', '20', '604', '3', '90', '39', '764', 120),
  d('7100.7102', '1501', '3001', '18', '542', '3', '90', '39', '764', 145),
  d('4100.4109', '1701', '3202', '19', '572', '3', '90', '39', '764', 90),
  d('2200.2202', '0200', '2203', '09', '272', '3', '90', '39', '764', 120),

  // ===================== Fonte 765 - FUNREJUS
  d('0300.0302', '2301', '3803', '02', '061', '4', '90', '52', '765', 180),
  d('0300.0302', '2301', '3803', '02', '061', '3', '90', '39', '765', 120),

  // ===================== Fonte 766 - seguranca publica e transito
  d('5000.5006', '1201', '2504', '06', '181', '3', '90', '39', '766', 300),
  d('5000.5001', '1201', '1505', '06', '181', '4', '90', '52', '766', 320),
  d('5000.5001', '1201', '1506', '06', '183', '4', '90', '51', '766', 160),

  // ===================== Fonte 540 - FUNDEB (parcela estadual)
  d('4000.4003', '1001', '2101', '12', '368', '1', '90', '11', '540', 4200, {
    rp: '1',
    justificativa: 'Remuneracao dos profissionais da educacao basica em efetivo exercicio - art. 212-A, XI, da CF.',
  }),
  d('4000.4003', '1001', '2105', '12', '368', '3', '90', '39', '540', 420),
  d('4000.4003', '1001', '2103', '12', '368', '3', '90', '39', '540', 280),
  d('4000.4003', '1001', '1107', '12', '368', '4', '90', '52', '540', 300),

  // ===================== Fonte 542 - FUNDEB VAAT
  d('4000.4003', '1001', '2101', '12', '368', '1', '90', '11', '542', 400, {
    rp: '1',
    justificativa: 'Remuneracao dos profissionais da educacao basica custeada com a complementacao VAAT.',
  }),
  d('4000.4003', '1001', '2101', '12', '368', '3', '90', '39', '542', 120),
  d('4000.4003', '1001', '1107', '12', '368', '4', '90', '52', '542', 260),

  // ===================== Fonte 543 - FUNDEB VAAR
  d('4000.4003', '1001', '2105', '12', '368', '3', '90', '39', '543', 190),

  // ===================== Fonte 550 - salario-educacao
  d('4000.4001', '1001', '2102', '12', '368', '3', '90', '30', '550', 560),
  d('4000.4002', '1001', '1106', '12', '368', '4', '90', '51', '550', 420),
  d('4000.4001', '1001', '2103', '12', '368', '3', '90', '39', '550', 200),

  // ===================== Fonte 600 - transferencias do SUS
  d('3000.3002', '1101', '2301', '10', '302', '3', '90', '39', '600', 1850),
  d('3000.3002', '1101', '2302', '10', '301', '3', '41', '41', '600', 620),
  d('3000.3003', '1101', '2303', '10', '303', '3', '90', '30', '600', 480),
  d('3000.3001', '1102', '2401', '10', '305', '3', '90', '30', '600', 180),
  d('3000.3001', '1101', '1306', '10', '302', '4', '90', '52', '600', 120),

  // ===================== Fonte 602 - convenios de saude
  d('3000.3001', '1101', '1305', '10', '302', '4', '90', '51', '602', 180),

  // ===================== Fonte 660 - FNAS
  d('7500.7502', '1601', '3101', '08', '244', '3', '90', '39', '660', 130),
  d('7500.7502', '1601', '3102', '08', '244', '3', '41', '41', '660', 80),

  // ===================== Fonte 701 - RPPS em reparticao
  d('2200.2203', '0200', '0201', '09', '272', '1', '90', '01', '701', 5400, { rp: '1' }),
  d('2200.2203', '0200', '0202', '09', '272', '1', '90', '03', '701', 1400, { rp: '1' }),
  d('2200.2202', '0200', '2203', '09', '272', '3', '90', '39', '701', 220),

  // ===================== Fonte 750 - operacoes de credito (somente capital)
  d('6000.6002', '1301', '1702', '26', '782', '4', '90', '51', '750', 1250),
  d('6000.6002', '1301', '1703', '26', '782', '4', '90', '51', '750', 320),
  d('6100.6101', '2001', '1502', '15', '451', '4', '40', '42', '750', 380),
  d('4000.4002', '1001', '1106', '12', '368', '4', '90', '51', '750', 420),
  d('3000.3001', '1101', '1305', '10', '302', '4', '90', '51', '750', 350),
  d('6000.6001', '1302', '1802', '26', '783', '4', '90', '51', '750', 280),

  // ===================== Fonte 752 - alienacao de bens
  d('2200.2201', '0100', '1005', '04', '122', '4', '90', '51', '752', 180),
  d('5000.5001', '1201', '1505', '06', '181', '4', '90', '52', '752', 120),

  // ===================== Fonte 759 - convenios com a Uniao
  d('6000.6002', '1301', '1702', '26', '782', '4', '90', '51', '759', 380),
  d('6100.6101', '2001', '1502', '15', '451', '4', '40', '42', '759', 220),
  d('7000.7001', '1401', '1903', '20', '605', '4', '90', '51', '759', 150),
  d('5000.5001', '1201', '1505', '06', '181', '4', '90', '52', '759', 130),
  d('7100.7101', '1501', '1003', '18', '541', '4', '90', '51', '759', 120),

  // ===================== Fonte 761 - royalties e recursos hidricos
  d('7100.7101', '1501', '3002', '18', '544', '3', '90', '39', '761', 130),
  d('7100.7103', '1501', '1003', '18', '541', '4', '90', '51', '761', 80),

  // ===================== Fonte 799 - outras vinculacoes legais
  d('6000.6002', '1301', '2701', '26', '782', '3', '90', '39', '799', 130),
  d('8000.8001', '0300', '0304', '28', '845', '3', '40', '81', '799', 45, { rp: '1' }),
];

/** Limites (tetos) enviados as unidades orcamentarias, em percentual da despesa proposta. */
export const FOLGA_TETO = 1.05;
