import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { LinhaAdmin, ResumoAdmin } from '../api/cliente';
import { Botao, Cartao, Erro, estilos, Rotulo, TextoSuave, Titulo } from '../componentes/ui';
import { useConta } from '../hooks/useConta';
import { cores, espaco } from '../tema';

/** Painel do admin: quantas pessoas se cadastraram e se estão lançando treinos. */
export default function AdminTela() {
  const { lerResumoAdmin } = useConta();
  const [resumo, setResumo] = useState<ResumoAdmin | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setResumo(await lerResumoAdmin());
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [lerResumoAdmin]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!resumo) {
    return (
      <View style={[estilos.tela, { justifyContent: 'center', alignItems: 'center', padding: espaco.m, gap: espaco.m }]}>
        {carregando ? <ActivityIndicator color={cores.destaque} /> : null}
        {erro ? <Erro>{erro}</Erro> : null}
        {erro ? <Botao titulo="Tentar de novo" onPress={carregar} /> : null}
      </View>
    );
  }

  const r = resumo;
  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={estilos.conteudo}
      refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} />}
    >
      <TextoSuave>{`Atualizado em ${dataHora(r.agora)}. Puxe para baixo para atualizar.`}</TextoSuave>
      {erro ? <Erro>{erro}</Erro> : null}

      <Titulo>Cadastros</Titulo>
      <View style={s.grade}>
        <Numero nome="Pessoas cadastradas" valor={r.contas} extra={`${r.novas7} em 7 dias, ${r.novas30} em 30`} />
        {r.downloads !== null ? <Numero nome="Downloads do APK" valor={r.downloads} /> : null}
        <Numero nome="Abriram hoje" valor={r.ativos1} extra="últimas 24 horas" />
        <Numero nome="Ativos em 7 dias" valor={r.ativos7} extra={`${pct(r.ativos7, r.contas)} dos cadastrados`} />
        <Numero nome="Ativos em 30 dias" valor={r.ativos30} extra={`${pct(r.ativos30, r.contas)} dos cadastrados`} />
      </View>

      <Titulo>Treinos</Titulo>
      <View style={s.grade}>
        <Numero nome="Treinos lançados" valor={r.treinos} extra={`${r.treinos30} em 30 dias`} />
        <Numero nome="Treinos em 7 dias" valor={r.treinos7} />
        <Numero nome="Já lançaram treino" valor={r.comTreino} extra={`${pct(r.comTreino, r.contas)} dos cadastrados`} />
        <Numero nome="Lançaram em 7 dias" valor={r.lancaram7} extra={`${pct(r.lancaram7, r.contas)} dos cadastrados`} />
        <Numero nome="Candidatos" valor={r.modos.candidato} extra={`${r.modos.efetivo} policiais, ${r.modos.semPerfil} sem perfil`} />
      </View>

      <Barras titulo="Treinos lançados por dia (30 dias)" dias={r.dias} campo="treinos" />
      <Barras titulo="Cadastros por dia (30 dias)" dias={r.dias} campo="cadastros" />

      <Titulo>{`Pessoas (${r.contas})`}</Titulo>
      {r.linhas.map((l, i) => (
        <Pessoa key={`${l.email ?? l.nome}-${i}`} linha={l} agora={r.agora} />
      ))}
      <TextoSuave>Os treinos vêm do backup: um treino feito sem internet aparece quando o celular sincroniza.</TextoSuave>
    </ScrollView>
  );
}

function Numero({ nome, valor, extra }: { nome: string; valor: number; extra?: string }) {
  return (
    <View style={s.numero}>
      <Text style={s.valor}>{valor}</Text>
      <Text style={s.nomeNumero}>{nome}</Text>
      {extra ? <Text style={s.extra}>{extra}</Text> : null}
    </View>
  );
}

function Barras({ titulo, dias, campo }: { titulo: string; dias: ResumoAdmin['dias']; campo: 'treinos' | 'cadastros' }) {
  const maior = Math.max(1, ...dias.map((d) => d[campo]));
  const [tocado, setTocado] = useState<number | null>(null);
  const escolhido = tocado === null ? null : dias[tocado];
  return (
    <Cartao>
      <Rotulo>{titulo}</Rotulo>
      <TextoSuave>
        {escolhido
          ? `${diaCurto(escolhido.dia)}: ${escolhido[campo]}`
          : `Maior dia: ${Math.max(0, ...dias.map((d) => d[campo]))}. Toque numa barra para ver o dia.`}
      </TextoSuave>
      <View style={s.barras}>
        {dias.map((d, i) => {
          const v = d[campo];
          return (
            <Pressable
              key={d.dia}
              onPress={() => setTocado(tocado === i ? null : i)}
              style={s.colunaToque}
              accessibilityLabel={`${diaCurto(d.dia)}: ${v}`}
            >
              <View style={s.coluna}>
                <View
                  style={[
                    s.barra,
                    { height: `${v ? Math.max(3, (v / maior) * 100) : 0}%` },
                    tocado === i ? { backgroundColor: cores.laranja } : null,
                  ]}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={s.eixo}>
        <Text style={s.extra}>{diaCurto(dias[0].dia)}</Text>
        <Text style={s.extra}>hoje</Text>
      </View>
    </Cartao>
  );
}

const MODOS: Record<string, string> = { candidato: 'Candidato', efetivo: 'Policial' };

function Pessoa({ linha: l, agora }: { linha: LinhaAdmin; agora: number }) {
  return (
    <Cartao>
      <View style={s.pessoa}>
        {l.foto ? (
          <Image source={{ uri: l.foto }} style={s.foto} />
        ) : (
          <View style={[s.foto, s.semFoto]}>
            <Text style={s.inicial}>{(l.nome || '?').trim().charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.nomePessoa}>{l.nome}</Text>
          <TextoSuave>{l.email ?? 'e-mail após o próximo login'}</TextoSuave>
        </View>
        <Text style={s.selo}>{l.modo ? (MODOS[l.modo] ?? l.modo) : 'sem perfil'}</Text>
      </View>
      <TextoSuave>{`${l.treinos} treinos (${l.treinos7} em 7 dias). Último treino: ${ha(l.ultimoTreino, agora)}.`}</TextoSuave>
      <TextoSuave>{`Último acesso: ${ha(l.ultimoAcesso, agora)}. Cadastro: ${dataHora(l.criadaEm)}.`}</TextoSuave>
    </Cartao>
  );
}

const pct = (parte: number, total: number) => (total ? `${Math.round((parte / total) * 100)}%` : '0%');
const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const dois = (n: number) => String(n).padStart(2, '0');

function dataHora(ms: number) {
  const d = new Date(ms);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

function ha(ms: number | null, agora: number) {
  if (!ms) return 'nunca';
  const min = Math.max(0, Math.round((agora - ms) / 60_000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

const s = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.p },
  numero: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: cores.cartao,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: 12,
  },
  valor: { fontSize: 26, fontWeight: '700', color: cores.texto },
  nomeNumero: { fontSize: 13, color: cores.textoSuave },
  extra: { fontSize: 11, color: cores.textoSuave, marginTop: 2 },
  barras: { flexDirection: 'row', height: 120, gap: 2, borderBottomWidth: 1, borderColor: cores.borda },
  colunaToque: { flex: 1 },
  coluna: { height: 120, width: '100%', justifyContent: 'flex-end' },
  barra: { width: '100%', backgroundColor: cores.destaque, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  eixo: { flexDirection: 'row', justifyContent: 'space-between' },
  pessoa: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  foto: { width: 40, height: 40, borderRadius: 20 },
  semFoto: { backgroundColor: cores.borda, alignItems: 'center', justifyContent: 'center' },
  inicial: { fontWeight: '700', color: cores.textoSuave },
  nomePessoa: { fontSize: 15, fontWeight: '600', color: cores.texto },
  selo: {
    fontSize: 12,
    color: cores.textoSuave,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
});
