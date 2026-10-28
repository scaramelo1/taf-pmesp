import { lerValor } from './formato.ts';
import type { RegraMinimo } from './tipos.ts';

/**
 * Como o valor é digitado:
 * - inteiro: repetições
 * - decimal: tempos curtos com centésimos (50 m, isometria) → "8,25"
 * - minseg: tempos longos em dois campos (2400 m, natação) → 12 : 30
 */
export type TipoEntrada = 'inteiro' | 'decimal' | 'minseg';

export interface Entrada {
  texto: string;
  min: string;
  seg: string;
}

export const ENTRADA_VAZIA: Entrada = { texto: '', min: '', seg: '' };

export function tipoEntrada(regra: RegraMinimo): TipoEntrada {
  if (regra.unidade === 'reps') return 'inteiro';
  return regra.minimo >= 60 ? 'minseg' : 'decimal';
}

/** undefined = campo vazio; null = preenchido com valor inválido. */
export function lerEntrada(regra: RegraMinimo, e: Entrada): number | null | undefined {
  let valor: number | null;

  if (tipoEntrada(regra) === 'minseg') {
    const min = e.min.trim();
    const seg = e.seg.trim();
    if (!min && !seg) return undefined;
    if (!/^\d*$/.test(min) || !/^\d{1,2}$/.test(seg) || Number(seg) >= 60) return null;
    valor = Number(min || 0) * 60 + Number(seg);
  } else {
    if (!e.texto.trim()) return undefined;
    valor = lerValor(regra.unidade, e.texto);
  }

  // Tempo de corrida/natação zerado não existe.
  if (valor !== null && regra.direcao === 'menor' && valor <= 0) return null;
  return valor;
}
