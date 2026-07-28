import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, guardarToken, obterToken, type Usuario } from './api';

interface ContextoAutenticacao {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => void;
  podeEditar: boolean;
}

const Contexto = createContext<ContextoAutenticacao | null>(null);

const PERFIS_EDICAO = ['ADMIN', 'ORGAO_CENTRAL', 'UNIDADE_ORCAMENTARIA'];

export function ProvedorAutenticacao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!obterToken()) {
      setCarregando(false);
      return;
    }
    api
      .get<Usuario>('/auth/eu')
      .then(setUsuario)
      .catch(() => guardarToken(null))
      .finally(() => setCarregando(false));
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const resposta = await api.post<{ token: string; usuario: Usuario }>('/auth/login', { email, senha });
    guardarToken(resposta.token);
    setUsuario(resposta.usuario);
  }, []);

  const sair = useCallback(() => {
    guardarToken(null);
    setUsuario(null);
  }, []);

  const valor = useMemo<ContextoAutenticacao>(
    () => ({
      usuario,
      carregando,
      entrar,
      sair,
      podeEditar: usuario ? PERFIS_EDICAO.includes(usuario.perfil) : false,
    }),
    [usuario, carregando, entrar, sair],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAutenticacao(): ContextoAutenticacao {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useAutenticacao deve ser usado dentro do ProvedorAutenticacao.');
  return contexto;
}
