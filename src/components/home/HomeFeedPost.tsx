import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Bookmark, Heart, MessageCircle, Send } from 'lucide-react-native';
import type { Event } from '@/features/activities/api/useActivities';
import { getPublicEventStatus, publicStatusToneColor } from '@/features/activities/event-status';
import type { AppTheme } from '@/hooks/use-theme';

type Props = {
  event: Event;
  theme: AppTheme;
  formatDate: (iso?: string) => string;
  isRegistered?: boolean;
};

export const HomeFeedPost = memo(
  function HomeFeedPost({ event, theme, formatDate, isRegistered }: Props) {
    const router = useRouter();
    const status = getPublicEventStatus(new Date(), event);
    const statusColor = publicStatusToneColor(theme, status.tone);
    const imageUri =
      event.cover_url || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800';

    const openDetail = () => router.push({ pathname: '/event-detail', params: { id: event.id } });

    return (
      <View style={[styles.card, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.header} onPress={openDetail} activeOpacity={0.8}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>PS</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.username, { color: theme.text }]} numberOfLines={1}>
              psu_scc
            </Text>
            <Text style={[styles.location, { color: theme.mutedForeground }]} numberOfLines={1}>
              {event.location || 'PSU SCC'} · {formatDate(event.start_date)}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{status.label}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.98} onPress={openDetail}>
          <Image source={imageUri} style={[styles.media, { backgroundColor: theme.secondary }]} contentFit="cover" transition={200} />
        </TouchableOpacity>

        <View style={styles.actions}>
          <View style={styles.actionsLeft}>
            <TouchableOpacity hitSlop={10} onPress={openDetail}>
              <Heart size={26} color={theme.text} strokeWidth={1.75} />
            </TouchableOpacity>
            <TouchableOpacity hitSlop={10} onPress={openDetail} style={styles.actionGap}>
              <MessageCircle size={26} color={theme.text} strokeWidth={1.75} />
            </TouchableOpacity>
            <TouchableOpacity hitSlop={10} onPress={openDetail} style={styles.actionGap}>
              <Send size={24} color={theme.text} strokeWidth={1.75} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity hitSlop={10} onPress={openDetail}>
            <Bookmark size={24} color={theme.text} strokeWidth={1.75} />
          </TouchableOpacity>
        </View>

        <View style={styles.caption}>
          <Text style={[styles.likes, { color: theme.text }]}>
            {event.current_participants > 0 ?
              `${event.current_participants} คนสนใจ`
            : 'กิจกรรมใหม่'}
            {isRegistered ? ' · ลงทะเบียนแล้ว' : ''}
          </Text>
          <Text style={[styles.captionBody, { color: theme.text }]}>
            <Text style={styles.captionUser}>psu_scc </Text>
            <Text style={styles.captionTitle}>{event.title}</Text>
            {event.description ?
              <Text style={{ color: theme.text }}>
                {' '}
                {event.description.length > 120 ?
                  `${event.description.slice(0, 120)}… `
                : `${event.description} `}
                <Text style={{ color: theme.mutedForeground }}>ดูเพิ่มเติม</Text>
              </Text>
            : null}
          </Text>
          <Text style={[styles.time, { color: theme.mutedForeground }]}>
            {formatDate(event.start_date)}
          </Text>
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.isRegistered === nextProps.isRegistered &&
      prevProps.theme === nextProps.theme &&
      prevProps.event.current_participants === nextProps.event.current_participants &&
      prevProps.event.title === nextProps.event.title &&
      prevProps.event.description === nextProps.event.description &&
      prevProps.event.cover_url === nextProps.event.cover_url &&
      prevProps.event.location === nextProps.event.location &&
      prevProps.event.start_date === nextProps.event.start_date &&
      prevProps.event.end_date === nextProps.event.end_date
    );
  }
);

const styles = StyleSheet.create({
  card: {
    marginBottom: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  username: {
    fontSize: 14,
    fontWeight: '700',
  },
  location: {
    fontSize: 12,
    marginTop: 1,
    fontWeight: '500',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  media: {
    width: '100%',
    aspectRatio: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionGap: {
    marginLeft: 14,
  },
  caption: {
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  likes: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  captionBody: {
    fontSize: 14,
    lineHeight: 19,
  },
  captionUser: {
    fontWeight: '700',
  },
  captionTitle: {
    fontWeight: '700',
  },
  time: {
    fontSize: 11,
    marginTop: 8,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
