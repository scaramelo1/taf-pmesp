import type { Cargo, RegraMinimo, Sexo } from '../tipos.ts';
import { regrasCandidato } from './candidato.ts';
import { EDITAL_TAF3 } from './taf3.ts';

export { EDITAL_CANDIDATO } from './candidato.ts';
export { EDITAL_TAF3, TABELAS_TAF3 } from './taf3.ts';

/** Treinos do efetivo são avaliados por pontos (TAF-3); os de candidato, por índice mínimo. */
export const ehEfetivo = (edital: string) => edital === EDITAL_TAF3.M.id || edital === EDITAL_TAF3.F.id;

/** Regras de índice mínimo com que um treino de candidato deve ser avaliado. */
export function regrasDoTreino(t: { edital: string; sexo: Sexo; cargo: Cargo }): RegraMinimo[] {
  return regrasCandidato(t.sexo, t.cargo);
}
