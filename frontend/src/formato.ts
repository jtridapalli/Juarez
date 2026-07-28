const moeda = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '-';
  return moeda.format(valor);
}

/** Resumo em bilhoes ou milhoes, usado nos indicadores do painel. */
export function formatarResumo(valor: number): string {
  const absoluto = Math.abs(valor);
  if (absoluto >= 1_000_000_000) return `R$ ${moeda.format(valor / 1_000_000_000)} bi`;
  if (absoluto >= 1_000_000) return `R$ ${moeda.format(valor / 1_000_000)} mi`;
  return `R$ ${moeda.format(valor)}`;
}

export function formatarInteiro(valor: number): string {
  return inteiro.format(valor);
}

export function formatarPercentual(valor: number, casas = 2): string {
  return `${valor.toFixed(casas).replace('.', ',')}%`;
}

export function formatarDataHora(valor: string | null | undefined): string {
  if (!valor) return '-';
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatarData(valor: string | null | undefined): string {
  if (!valor) return '-';
  return new Date(valor).toLocaleDateString('pt-BR');
}

const ROTULOS_STATUS: Record<string, string> = {
  EM_ELABORACAO: 'Em elaboração',
  ENVIADA: 'Enviada',
  EM_ANALISE: 'Em análise',
  DEVOLVIDA: 'Devolvida',
  HOMOLOGADA: 'Homologada',
  PREPARACAO: 'Preparação',
  CAPTACAO: 'Captação',
  ANALISE: 'Análise',
  CONSOLIDACAO: 'Consolidação',
  ENCERRADO: 'Encerrado',
};

export function rotuloStatus(status: string): string {
  return ROTULOS_STATUS[status] ?? status;
}

const ROTULOS_PERFIL: Record<string, string> = {
  ADMIN: 'Administrador',
  ORGAO_CENTRAL: 'Órgão central de orçamento',
  UNIDADE_ORCAMENTARIA: 'Unidade orçamentária',
  CONTROLE_INTERNO: 'Controle interno',
  CONSULTA: 'Consulta',
};

export function rotuloPerfil(perfil: string): string {
  return ROTULOS_PERFIL[perfil] ?? perfil;
}

export function rotuloEsfera(esfera: string): string {
  if (esfera === 'F') return 'Fiscal';
  if (esfera === 'S') return 'Seguridade Social';
  return 'Investimento';
}
