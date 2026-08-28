import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { EventMember } from '@/features/chat/api/useChat';
import { memberMentionLabel, splitMessageWithMentions } from '@/features/chat/chatMentions';

export function FormattedChatMessageBody({
  content,
  baseColor,
  mentionColor,
  members,
  nicknameMap,
}: {
  content: string;
  baseColor: string;
  mentionColor: string;
  members: EventMember[];
  nicknameMap?: Record<string, string>;
}) {
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const resolveDisplay = (userId: string) => {
    const row = memberById.get(userId);
    return row ? memberMentionLabel(row, nicknameMap, members) : 'สมาชิก';
  };

  const stripped = content.replace(/\u200B/g, '');
  const parts = splitMessageWithMentions(stripped, resolveDisplay);

  return (
    <Text style={[styles.plain, { color: baseColor }]} selectable>
      {parts.map((p, idx) =>
        p.type === 'text' ? (
          p.text
        ) : (
          <Text key={`m-${idx}`} style={[styles.plain, styles.mentionHit, { color: mentionColor }]}>
            {p.label}
          </Text>
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  plain: { fontSize: 15, lineHeight: 20 },
  mentionHit: { fontWeight: '700' },
});
