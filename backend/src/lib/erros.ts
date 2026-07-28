export class ErroAplicacao extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
    readonly detalhes?: unknown,
  ) {
    super(mensagem);
  }
}

export const naoEncontrado = (mensagem: string) => new ErroAplicacao(404, mensagem);
export const requisicaoInvalida = (mensagem: string, detalhes?: unknown) => new ErroAplicacao(400, mensagem, detalhes);
export const naoAutorizado = (mensagem = 'Credenciais invalidas.') => new ErroAplicacao(401, mensagem);
export const proibido = (mensagem = 'Perfil sem permissao para a operacao.') => new ErroAplicacao(403, mensagem);
export const conflito = (mensagem: string, detalhes?: unknown) => new ErroAplicacao(409, mensagem, detalhes);
