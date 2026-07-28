import { useQuery } from '@tanstack/react-query';
import { api, type RegistroAuditoria } from '../api';
import { Aviso, Cartao, Carregando, Etiqueta, TituloPagina, Vazio } from '../componentes/base';
import { formatarDataHora, rotuloPerfil } from '../formato';

const TOM_ACAO = (acao: string) => {
  if (acao.startsWith('EXCLUIR')) return 'negativo' as const;
  if (acao.startsWith('INCLUIR')) return 'positivo' as const;
  if (acao.startsWith('PROPOSTA') || acao.startsWith('CONSOLIDAR')) return 'info' as const;
  return 'neutro' as const;
};

export function PaginaAuditoria() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['auditoria'],
    queryFn: () => api.get<RegistroAuditoria[]>('/auditoria?limite=200'),
  });

  if (isLoading) return <Carregando />;
  if (error) return <Aviso>Não foi possível carregar a trilha de auditoria.</Aviso>;

  return (
    <>
      <TituloPagina
        titulo="Trilha de auditoria"
        descricao="Registro das operações realizadas no sistema, com identificação do usuário responsável, para fins de controle interno e externo."
      />

      <Cartao titulo={`Últimos ${data?.length ?? 0} registros`}>
        <div className="max-h-[40rem] overflow-auto">
          <table className="tabela-orcamento">
            <thead>
              <tr>
                <th>Data e hora</th>
                <th>Operação</th>
                <th>Entidade</th>
                <th>Identificador</th>
                <th>Usuário</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((registro) => (
                <tr key={registro.id}>
                  <td className="whitespace-nowrap">{formatarDataHora(registro.criadoEm)}</td>
                  <td>
                    <Etiqueta tom={TOM_ACAO(registro.acao)}>{registro.acao}</Etiqueta>
                  </td>
                  <td>{registro.entidade}</td>
                  <td className="font-mono">{registro.entidadeId ?? '-'}</td>
                  <td>
                    {registro.usuario ? (
                      <>
                        {registro.usuario.nome}
                        <p className="text-[0.6875rem] text-slate-500">{rotuloPerfil(registro.usuario.perfil)}</p>
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="max-w-96">
                    {registro.detalhes ? (
                      <code className="block truncate text-[0.625rem] text-slate-600">{JSON.stringify(registro.detalhes)}</code>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!data || data.length === 0) && <Vazio mensagem="Nenhuma operação registrada." />}
        </div>
      </Cartao>
    </>
  );
}
