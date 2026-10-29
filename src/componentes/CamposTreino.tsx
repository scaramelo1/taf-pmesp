import { mascararData } from '../dominio/datas';
import { Campo, Cartao, TextoSuave } from './ui';

export function CartaoData({ data, onChange, valida }: { data: string; onChange: (d: string) => void; valida: boolean }) {
  return (
    <Cartao>
      <Campo
        rotulo="Data do treino"
        value={data}
        onChangeText={(t) => onChange(mascararData(t))}
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        maxLength={10}
        erro={valida ? undefined : 'Data inválida (DD/MM/AAAA)'}
      />
      <TextoSuave>Preencha só os testes que fez hoje.</TextoSuave>
    </Cartao>
  );
}

export function CartaoObservacao({ valor, onChange }: { valor: string; onChange: (t: string) => void }) {
  return (
    <Cartao>
      <Campo
        rotulo="Observação (opcional)"
        value={valor}
        onChangeText={onChange}
        placeholder="Ex.: pista molhada, pouco sono…"
        multiline
      />
    </Cartao>
  );
}
