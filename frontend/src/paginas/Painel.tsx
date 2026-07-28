import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';
import { api, EXERCICIO, type Painel } from '../api';
import { Aviso, Cartao, Carregando, Etiqueta, Indicador, TituloPagina } from '../componentes/base';
import { formatarDataHora, formatarInteiro, formatarMoeda, formatarPercentual, formatarResumo, rotuloStatus } from '../formato';

const CORES = ['#0b3f8c', '#1256b3', '#1f6fd6', '#4f93e4', '#7cb0ec', '#a7ccf3', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

export function PaginaPainel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['painel', EXERCICIO],
    queryFn: () => api.get<Painel>(`/exercicios/${EXERCICIO}/painel`),
  });

  if (isLoading) return <Carregando />;
  if (error || !data) return <Aviso>Não foi possível carregar o painel do orçamento.</Aviso>;

  const { totais, parametros, exercicio, propostas, ultimaValidacao, ultimaConsolidacao } = data;
  const rcl = parametros.RCL_PROJETADA ?? 0;
  const equilibrado = Math.abs(totais.diferenca) <= 0.01;

  const dadosFuncao = totais.porFuncao.slice(0, 10).map((f) => ({
    nome: `${f.codigo} ${f.nome}`,
    curto: f.nome.length > 18 ? `${f.nome.slice(0, 17)}.` : f.nome,
    valor: f.valor,
  }));
  const dadosGrupo = totais.porGrupo.map((g) => ({ nome: g.nome, valor: g.valor }));
  const dadosOrgao = totais.porOrgao.slice(0, 8).map((o) => ({ nome: o.sigla, valor: o.valor }));

  return (
    <>
      <TituloPagina
        titulo={`Painel do orçamento — exercício ${exercicio.ano}`}
        descricao={`Último exercício do PPA ${exercicio.ppaInicio}-${exercicio.ppaFim}. Situação do ciclo: ${rotuloStatus(exercicio.status)}.`}
        acoes={
          <>
            <Etiqueta tom={equilibrado ? 'positivo' : 'negativo'}>
              {equilibrado ? 'Orçamento equilibrado' : `Desequilíbrio de R$ ${formatarMoeda(totais.diferenca)}`}
            </Etiqueta>
            {ultimaValidacao && (
              <Etiqueta tom={ultimaValidacao.aprovado ? 'positivo' : 'negativo'}>
                Validação: {ultimaValidacao.totalErros} erro(s) · {ultimaValidacao.totalAlertas} alerta(s)
              </Etiqueta>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Receita prevista" valor={formatarResumo(totais.receitaTotal)} detalhe={`R$ ${formatarMoeda(totais.receitaTotal)}`} tom="destaque" />
        <Indicador rotulo="Despesa fixada" valor={formatarResumo(totais.despesaTotal)} detalhe={`R$ ${formatarMoeda(totais.despesaTotal)}`} tom="destaque" />
        <Indicador
          rotulo="Despesa com pessoal"
          valor={formatarResumo(totais.despesaPessoal)}
          detalhe={`${formatarPercentual((totais.despesaPessoal / rcl) * 100)} da RCL projetada · limite de ${formatarPercentual(parametros.PERC_MAX_PESSOAL_TOTAL ?? 60, 0)}`}
          tom={totais.despesaPessoal / rcl > 0.6 ? 'negativo' : 'positivo'}
        />
        <Indicador
          rotulo="Reserva de contingência"
          valor={formatarResumo(totais.reservaContingencia)}
          detalhe={`${formatarPercentual((totais.reservaContingencia / rcl) * 100, 3)} da RCL · mínimo de ${formatarPercentual(parametros.PERC_MIN_RESERVA_CONTINGENCIA ?? 0.5, 1)}`}
          tom="positivo"
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Receitas correntes" valor={formatarResumo(totais.receitasCorrentes)} />
        <Indicador rotulo="Receitas de capital" valor={formatarResumo(totais.receitasCapital)} />
        <Indicador rotulo="Deduções da receita" valor={formatarResumo(totais.deducoesReceita)} detalhe="Transferências constitucionais e FUNDEB" />
        <Indicador
          rotulo="Dotações consolidadas"
          valor={formatarInteiro(totais.quantidadeDotacoes)}
          detalhe={`${formatarInteiro(totais.quantidadeUnidades)} unidades orçamentárias`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Cartao titulo="Despesa por função de governo" descricao="Dez funções com maior dotação" className="xl:col-span-2">
          <div className="h-80 px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosFuncao} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <XAxis type="number" tickFormatter={(v) => formatarResumo(Number(v))} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="curto" width={132} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v) => [`R$ ${formatarMoeda(Number(v))}`, 'Dotação']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.nome ?? ''}
                />
                <Bar dataKey="valor" fill="#1256b3" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Cartao>

        <Cartao titulo="Despesa por grupo de natureza" descricao="Composição econômica da despesa fixada">
          <div className="h-80 px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dadosGrupo} dataKey="valor" nameKey="nome" innerRadius={48} outerRadius={82} paddingAngle={1}>
                  {dadosGrupo.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => `R$ ${formatarMoeda(Number(v))}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Cartao>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Cartao titulo="Maiores órgãos por dotação" className="xl:col-span-2">
          <div className="h-64 px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosOrgao} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => formatarResumo(Number(v))} tick={{ fontSize: 10 }} width={78} />
                <Tooltip formatter={(v) => [`R$ ${formatarMoeda(Number(v))}`, 'Dotação']} />
                <Bar dataKey="valor" fill="#0b3f8c" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Cartao>

        <div className="flex flex-col gap-4">
          <Cartao titulo="Situação das propostas setoriais">
            <ul className="divide-y divide-slate-100">
              {propostas.map((p) => (
                <li key={p.status} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-slate-700">{rotuloStatus(p.status)}</span>
                  <span className="font-semibold tabular-nums text-slate-900">{p.quantidade}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 px-4 py-2">
              <Link to="/propostas" className="text-xs font-semibold text-parana-700 hover:underline">
                Acompanhar propostas
              </Link>
            </div>
          </Cartao>

          <Cartao titulo="Orçamentos fiscal e da seguridade social">
            <table className="tabela-orcamento">
              <thead>
                <tr>
                  <th>Esfera</th>
                  <th className="numero">Receita</th>
                  <th className="numero">Despesa</th>
                </tr>
              </thead>
              <tbody>
                {totais.porEsfera.map((e) => (
                  <tr key={e.esfera}>
                    <td>{e.esfera === 'F' ? 'Fiscal' : 'Seguridade Social'}</td>
                    <td className="numero">{formatarResumo(e.receita)}</td>
                    <td className="numero">{formatarResumo(e.despesa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>

          <Cartao titulo="Última consolidação">
            {ultimaConsolidacao ? (
              <dl className="px-4 py-3 text-xs">
                <div className="flex justify-between py-0.5">
                  <dt className="text-slate-500">Versão</dt>
                  <dd className="font-semibold text-slate-800">{ultimaConsolidacao.versao}</dd>
                </div>
                <div className="flex justify-between py-0.5">
                  <dt className="text-slate-500">Gerada em</dt>
                  <dd className="text-slate-800">{formatarDataHora(ultimaConsolidacao.geradaEm)}</dd>
                </div>
                <div className="flex justify-between py-0.5">
                  <dt className="text-slate-500">Integridade</dt>
                  <dd className="font-mono text-[0.625rem] text-slate-600">{ultimaConsolidacao.hash.slice(0, 16)}…</dd>
                </div>
              </dl>
            ) : (
              <p className="px-4 py-4 text-xs text-slate-500">
                Nenhuma versão consolidada. Execute a consolidação para gerar o projeto de lei.
              </p>
            )}
          </Cartao>
        </div>
      </div>
    </>
  );
}
