import React from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/ui';

// Gemini replies use light Markdown: paragraphs, "*"/"-" bullets, "1." steps and **bold**.
// Same rules as the web chat.

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <AppText key={i} bold>
        {part.slice(2, -2)}
      </AppText>
    ) : (
      part.replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|[.,!?]|$)/g, '$1$2')
    )
  );
}

type Item = { text: string; children: string[] };
type Block = { kind: 'p'; lines: string[] } | { kind: 'ul' | 'ol'; items: Item[] };

export default function RafaText({ text }: { text: string }) {
  const blocks: Block[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      blocks.push({ kind: 'p', lines: [] });
      continue;
    }
    const nested = /^\s{2,}/.test(line);
    const bullet = line.match(/^\s*[*-]\s+(.*)$/);
    const step = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const kind = bullet ? 'ul' : step ? 'ol' : 'p';
    const last = blocks[blocks.length - 1];

    if (kind === 'p') {
      if (last?.kind === 'p' && last.lines.length) last.lines.push(line.trim());
      else blocks.push({ kind: 'p', lines: [line.trim()] });
    } else {
      const itemText = (bullet ?? step)![1];
      const parent = last && last.kind !== 'p' ? last.items[last.items.length - 1] : undefined;
      // Indented bullets belong to the step above them, so step numbers stay 1, 2, 3
      if (nested && parent) parent.children.push(itemText);
      else if (last && last.kind === kind) last.items.push({ text: itemText, children: [] });
      else blocks.push({ kind, items: [{ text: itemText, children: [] }] });
    }
  }

  return (
    <View style={{ gap: 8 }}>
      {blocks.map((b, i) => {
        if (b.kind === 'p') return b.lines.length ? <AppText key={i}>{inline(b.lines.join(' '))}</AppText> : null;
        return (
          <View key={i} style={{ gap: 4 }}>
            {b.items.map((item, j) => (
              <View key={j} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <AppText style={{ minWidth: 16 }}>{b.kind === 'ol' ? `${j + 1}.` : '•'}</AppText>
                  <AppText style={{ flex: 1 }}>{inline(item.text)}</AppText>
                </View>
                {item.children.map((child, k) => (
                  <View key={k} style={{ flexDirection: 'row', gap: 6, paddingLeft: 22 }}>
                    <AppText tone="fgMuted">◦</AppText>
                    <AppText style={{ flex: 1 }}>{inline(child)}</AppText>
                  </View>
                ))}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
