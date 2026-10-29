import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { MessageSquareHeart, Send } from 'lucide-react-native';
import { DOCK_SPACE } from '@/components/Dock';
import RafaText from '@/components/RafaText';
import { AppText } from '@/components/ui';
import { API_BASE } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, size, type as typeScale } from '@/theme/tokens';

type Message = { id: string; sender: 'rafa' | 'user'; text: string; time: string; offline?: boolean };

const CHIPS = [
  { label: 'Bleeding', en: 'How do I stop the bleeding safely?', fil: 'Paano pigilan ang pagdugo ng sugat nang ligtas?' },
  { label: 'Moving animal', en: 'Can I move an injured animal, and how do I lift it safely?', fil: 'Nasugatan o nabangga ang hayop, paano ilipat nang ligtas?' },
  { label: 'Scared dog', en: 'A dog is growling and scared. How do I approach safely?', fil: 'Galit o natatakot ang aso, paano lalapitan nang ligtas?' },
  { label: 'Keep warm', en: 'The animal is in shock and shaking. How do I keep it warm?', fil: 'Nanginginig at giniginaw sa shock ang hayop, paano papainitin?' },
  { label: 'Animal bit me', en: 'An animal bit or scratched me, what should I do right now?', fil: 'Kinagat o kinalmot ako ng hayop, ano ang dapat kong gawin ngayon?' },
  { label: 'While waiting', en: 'What should I do while waiting for responders to arrive?', fil: 'Ano ang dapat kong gawin habang naghihintay ng responder?' },
];

const GREETING = {
  en: "Hello, I'm Rafa. Keep a safe distance so the animal does not feel cornered. Are they bleeding, having trouble breathing, or trapped?",
  fil: 'Kumusta, ako si Rafa. Manatili sa ligtas na distansya para hindi matakot ang hayop. Nagdurugo ba sila, nahihirapang huminga, o naipit?',
};

const timeNow = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function RafaScreen() {
  const { colors } = useTheme();
  const [language, setLanguage] = useState<'en' | 'fil'>('en');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ id: 'm1', sender: 'rafa', text: GREETING.en, time: 'Just now' }]);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const nextId = useRef(0);

  const switchLanguage = (lang: 'en' | 'fil') => {
    setLanguage(lang);
    // Greeting follows the toggle until the conversation starts
    setMessages((prev) => (prev.length === 1 && prev[0].id === 'm1' ? [{ ...prev[0], text: GREETING[lang] }] : prev));
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    const userMsg: Message = { id: `u-${++nextId.current}`, sender: 'user', text: trimmed, time: timeNow() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          language,
          history: next.slice(-6).map((m) => ({ role: m.sender === 'rafa' ? 'model' : 'user', text: m.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get a response from Rafa.');
      setMessages((prev) => [
        ...prev,
        { id: `r-${++nextId.current}`, sender: 'rafa', text: data.response, time: timeNow(), offline: data.isMock === true },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error reaching Rafa. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <MessageSquareHeart size={16} color={colors.rafa} />
          </View>
          <View>
            <AppText variant="brand" accessibilityRole="header">
              Rafa
            </AppText>
            <AppText variant="caption" tone="fgMuted">
              First-aid guidance
            </AppText>
          </View>
        </View>
        <View accessibilityRole="radiogroup" style={[styles.toggle, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          {(['en', 'fil'] as const).map((l) => (
            <Pressable
              key={l}
              accessibilityRole="radio"
              accessibilityState={{ selected: language === l }}
              accessibilityLabel={l === 'en' ? 'English' : 'Filipino'}
              onPress={() => switchLanguage(l)}
              style={[styles.toggleItem, language === l && { backgroundColor: colors.surface }]}
            >
              <AppText variant="caption" bold tone={language === l ? 'fg' : 'fgMuted'}>
                {l.toUpperCase()}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.map((m) => {
          const rafa = m.sender === 'rafa';
          return (
            <View key={m.id} style={{ alignItems: rafa ? 'flex-start' : 'flex-end', gap: 4 }}>
              <View
                style={[
                  styles.bubble,
                  rafa
                    ? { backgroundColor: colors.surface, borderColor: colors.border }
                    : { backgroundColor: colors.action, borderColor: colors.action },
                ]}
              >
                {rafa ? <RafaText text={m.text} /> : <AppText style={{ color: colors.actionFg }}>{m.text}</AppText>}
              </View>
              <AppText variant="caption" tone="fgMuted">
                {m.offline
                  ? `${m.time} · ${language === 'fil' ? 'Offline na sagot, basic na gabay lang' : 'Offline answer, basic guidance only'}`
                  : m.time}
              </AppText>
            </View>
          );
        })}
        {loading && (
          <View style={[styles.bubble, styles.loading, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ActivityIndicator color={colors.rafa} />
            <AppText tone="fgMuted">Rafa is thinking…</AppText>
          </View>
        )}
        {error && (
          <AppText variant="caption" tone="reportedFg" accessibilityRole="alert">
            {error}
          </AppText>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, gap: 8, paddingBottom: DOCK_SPACE }}>
        <AppText variant="caption" tone="fgMuted">
          Tap for immediate emergency guidance:
        </AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CHIPS.map((c) => (
            <Pressable
              key={c.label}
              disabled={loading}
              onPress={() => send(language === 'fil' ? c.fil : c.en)}
              accessibilityRole="button"
              style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border, opacity: loading ? 0.5 : 1 }]}
            >
              <AppText variant="caption" bold>
                {c.label}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            editable={!loading}
            placeholder={language === 'fil' ? 'Magtanong kay Rafa (hal. nagdurugo ang pusa)…' : 'Ask Rafa (e.g. dog bleeding from leg)…'}
            placeholderTextColor={colors.fgMuted}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            accessibilityLabel="Message to Rafa"
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.fg }]}
          />
          <Pressable
            onPress={() => send(input)}
            disabled={loading || !input.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={[styles.send, { backgroundColor: colors.action, opacity: loading || !input.trim() ? 0.4 : 1 }]}
          >
            <Send size={18} color={colors.actionFg} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  toggle: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.md, padding: 2 },
  toggleItem: { minWidth: size.tap, minHeight: size.tap, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, borderWidth: 1, padding: 14 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { minHeight: size.tap, paddingHorizontal: 16, borderRadius: radius.full, borderWidth: 1, justifyContent: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minHeight: size.primary, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 16, fontSize: typeScale.body },
  send: { width: size.primary, height: size.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
