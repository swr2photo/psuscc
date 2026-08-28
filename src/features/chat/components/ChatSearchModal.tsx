import { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import type { ChatMessage, EventMember } from '@/features/chat/api/useChat';
import { expandMentionsForSearch } from '@/features/chat/chatMentions';

type Props = {
  visible: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSelectMessage: (messageId: string) => void;
  resolveSenderLabel: (msg: ChatMessage) => string;
  members?: EventMember[];
  nicknameMap?: Record<string, string>;
  foreground: string;
  mutedForeground: string;
  accent: string;
  surface: string;
  dividerColor: string;
};

export function ChatSearchModal({
  visible,
  onClose,
  messages,
  onSelectMessage,
  resolveSenderLabel,
  members,
  nicknameMap,
  foreground,
  mutedForeground,
  accent,
  surface,
  dividerColor,
}: Props) {
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const out: ChatMessage[] = [];
    const voiceKw = /^เสียง|voice|audio|ไมโครโฟน|mic$/i.test(t);
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const contentPlain = m.content.replace(/\u200b/gi, '').trim();
      const srcForExpand = contentPlain.length > 0 ? contentPlain : m.content;
      const contentSearch =
        members?.length ? expandMentionsForSearch(srcForExpand, members, nicknameMap) : srcForExpand;
      const base = `${contentSearch ?? ''} ${resolveSenderLabel(m)}`.toLowerCase();
      const blob =
        m.audio_url && voiceKw ? `${base} voice audio เสียง ข้อความเสียง` : base;
      if (blob.includes(t)) out.push(m);
      if (out.length >= 80) break;
    }
    return out;
  }, [messages, q, resolveSenderLabel, members, nicknameMap]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { backgroundColor: surface }]}>
              <Text style={[styles.title, { color: foreground }]}>ค้นหาในแชต</Text>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="พิมพ์คีย์เวิร์ด…"
                placeholderTextColor={mutedForeground}
                autoFocus
                style={[
                  styles.input,
                  {
                    color: foreground,
                    borderColor: dividerColor,
                    backgroundColor: surface,
                    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
                  },
                ]}
              />
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      onClose();
                      onSelectMessage(item.id);
                      setQ('');
                    }}
                    style={[styles.hit, { borderBottomColor: dividerColor }]}
                  >
                    <Text style={[styles.sender, { color: accent }]}>
                      {resolveSenderLabel(item)}
                    </Text>
                    <Text style={[styles.preview, { color: foreground }]} numberOfLines={2}>
                      {(() => {
                        const raw = item.content.replace(/\u200b/gi, '').trim();
                        const expanded =
                          members?.length && raw
                            ? expandMentionsForSearch(raw, members, nicknameMap).trim()
                            : raw;
                        if (item.audio_url && !raw) return '[ข้อความเสียง]';
                        return expanded || (item.image_url ? '[รูปภาพ]' : '[ข้อความ]');
                      })()}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={[styles.empty, { color: mutedForeground }]}>
                    {q.trim() ? 'ไม่พบข้อความ' : 'พิมพ์เพื่อค้นหา'}
                  </Text>
                }
              />
              <TouchableOpacity onPress={onClose} style={styles.dismiss}>
                <Text style={{ color: accent, fontWeight: '700' }}>ปิด</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    borderRadius: 20,
    maxHeight: '88%',
    padding: 18,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  list: { maxHeight: 360 },
  hit: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sender: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  preview: { fontSize: 14, lineHeight: 20 },
  empty: { textAlign: 'center', paddingVertical: 24 },
  dismiss: { alignSelf: 'center', marginTop: 12 },
});
