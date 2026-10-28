import type { Cargo, RegraMinimo, Sexo } from '../tipos.ts';
import { regrasCandidato } from './candidato.ts';

export { EDITAL_CANDIDATO } from './candidato.ts';

/** Regras com que um treino deve ser avaliado (por enquanto só existe o edital de candidato). */
export function regrasDoTreino(t: { edital: string; sexo: Sexo; cargo: Cargo }): RegraMinimo[] {
  return regrasCandidato(t.sexo, t.cargo);
}
