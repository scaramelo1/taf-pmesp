/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { diasEntre, erroDataTreino, formatarData, hojeISO, lerData, mascararData } from '../datas.ts';
import { ENTRADA_VAZIA, lerEntrada, tipoEntrada } from '../entrada.ts';
import { regrasCandidato } from '../regras/candidato.ts';
import type { ExercicioId } from '../tipos.ts';

const masc = regrasCandidato('M', 'oficial');
const fem = regrasCandidato('F', 'soldado');
const regra = (id: ExercicioId, regras = masc) => regras.find((r) => r.exercicio === id)!;
const texto = (t: string) => ({ ...ENTRADA_VAZIA, texto: t });
const minseg = (min: string, seg: string) => ({ ...ENTRADA_VAZIA, min, seg });

describe('tipoEntrada', () => {
  it('escolhe o campo certo para cada exercício', () => {
    assert.equal(tipoEntrada(regra('barra')), 'inteiro');
    assert.equal(tipoEntrada(regra('abdominal')), 'inteiro');
    assert.equal(tipoEntrada(regra('corrida50')), 'decimal');
    assert.equal(tipoEntrada(regra('corrida2400')), 'minseg');
    assert.equal(tipoEntrada(regra('natacao50')), 'minseg');
    assert.equal(tipoEntrada(regra('barra', fem)), 'decimal'); // isometria
  });
});

describe('lerEntrada', () => {
  it('vazio é undefined', () => {
    assert.equal(lerEntrada(regra('barra'), ENTRADA_VAZIA), undefined);
    assert.equal(lerEntrada(regra('corrida2400'), ENTRADA_VAZIA), undefined);
  });

  it('repetições', () => {
    assert.equal(lerEntrada(regra('barra'), texto('4')), 4);
    assert.equal(lerEntrada(regra('barra'), texto('0')), 0);
    assert.equal(lerEntrada(regra('barra'), texto('4,5')), null);
  });

  it('tempo decimal', () => {
    assert.equal(lerEntrada(regra('corrida50'), texto('8,25')), 8.25);
    assert.equal(lerEntrada(regra('corrida50'), texto('8.1')), 8.1);
    assert.equal(lerEntrada(regra('corrida50'), texto('0')), null);
    assert.equal(lerEntrada(regra('barra', fem), texto('7,5')), 7.5);
  });

  it('minutos e segundos', () => {
    assert.equal(lerEntrada(regra('corrida2400'), minseg('12', '30')), 750);
    assert.equal(lerEntrada(regra('corrida2400'), minseg('13', '0')), 780);
    assert.equal(lerEntrada(regra('natacao50'), minseg('', '58')), 58);
    assert.equal(lerEntrada(regra('corrida2400'), minseg('12', '60')), null);
    assert.equal(lerEntrada(regra('corrida2400'), minseg('12', '')), null);
    assert.equal(lerEntrada(regra('corrida2400'), minseg('0', '0')), null);
  });
});

describe('datas', () => {
  it('lerData valida datas reais', () => {
    assert.equal(lerData('28/10/2026'), '2026-10-28');
    assert.equal(lerData('29/02/2028'), '2028-02-29');
    assert.equal(lerData('29/02/2026'), null);
    assert.equal(lerData('31/04/2026'), null);
    assert.equal(lerData('28/10/26'), null);
    assert.equal(lerData(''), null);
  });

  it('erroDataTreino recusa futuro e antes do nascimento', () => {
    assert.equal(erroDataTreino('29/10/2026', '2026-10-29'), undefined);
    assert.equal(erroDataTreino('01/01/2020', '2026-10-29', '1990-05-10'), undefined);
    assert.equal(erroDataTreino('30/10/2026', '2026-10-29'), 'A data não pode estar no futuro');
    assert.equal(erroDataTreino('01/01/1989', '2026-10-29', '1990-05-10'), 'A data é anterior ao seu nascimento');
    assert.equal(erroDataTreino('31/02/2026', '2026-10-29'), 'Data inválida (DD/MM/AAAA)');
  });

  it('formatarData e máscara', () => {
    assert.equal(formatarData('2026-10-28'), '28/10/2026');
    assert.equal(mascararData('2'), '2');
    assert.equal(mascararData('281'), '28/1');
    assert.equal(mascararData('28102026'), '28/10/2026');
    assert.equal(mascararData('28/10/20269'), '28/10/2026');
  });

  it('hojeISO e diasEntre', () => {
    assert.equal(hojeISO(new Date(2026, 0, 5)), '2026-01-05');
    assert.equal(diasEntre('2026-10-28', '2026-11-28'), 31);
    assert.equal(diasEntre('2026-10-28', '2026-10-28'), 0);
    assert.equal(diasEntre('2026-10-28', '2026-10-27'), -1);
  });
});
