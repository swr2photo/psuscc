/** Shared rules for listing + detail (registration window, capacity, event dates). */
export type EventPublicStatusTone = 'success' | 'danger' | 'muted' | 'info' | 'brand';

export interface EventPublicLike {
  status: 'open' | 'closed';
  capacity: number;
  current_participants?: number;
  reg_start_date?: string | null;
  reg_end_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface PublicEventStatus {
  label: string;
  active: boolean;
  tone: EventPublicStatusTone;
}

export function getPublicEventStatus(now: Date, event: EventPublicLike): PublicEventStatus {
  const regStart = event.reg_start_date ? new Date(event.reg_start_date) : null;
  const regEnd = event.reg_end_date ? new Date(event.reg_end_date) : null;
  const eventStart = event.start_date ? new Date(event.start_date) : null;
  const eventEnd = event.end_date ? new Date(event.end_date) : null;

  const isFull =
    event.current_participants !== undefined &&
    event.capacity > 0 &&
    event.current_participants >= event.capacity;

  if (eventEnd && now > eventEnd) {
    return { label: 'สิ้นสุดกิจกรรมแล้ว', active: false, tone: 'muted' };
  }
  if (eventStart && eventEnd && now >= eventStart && now <= eventEnd) {
    return { label: 'กำลังจัดกิจกรรม', active: false, tone: 'brand' };
  }
  if (isFull) {
    return { label: 'ผู้เข้าร่วมเต็มแล้ว', active: false, tone: 'danger' };
  }
  if (regEnd && now > regEnd) {
    return { label: 'ปิดรับสมัครแล้ว', active: false, tone: 'danger' };
  }
  if (regStart && now < regStart) {
    return { label: 'เปิดรับเร็วๆ นี้', active: false, tone: 'info' };
  }
  if (regStart && regEnd && now >= regStart && now <= regEnd) {
    return { label: 'เปิดรับสมัคร', active: true, tone: 'success' };
  }

  return {
    label: event.status === 'open' ? 'เปิดรับสมัคร' : 'ปิดรับสมัคร',
    active: event.status === 'open',
    tone: event.status === 'open' ? 'success' : 'danger',
  };
}

/** Map tone → color; `info` uses fixed blue so list/detail stay aligned with prior UI. */
export function publicStatusToneColor(
  theme: { success: string; error: string; primary: string; mutedForeground?: string },
  tone: EventPublicStatusTone,
): string {
  switch (tone) {
    case 'success':
      return theme.success;
    case 'danger':
      return theme.error;
    case 'muted':
      return theme.mutedForeground ?? '#64748B';
    case 'info':
      return '#3B82F6';
    case 'brand':
      return '#6366F1';
    default:
      return theme.primary;
  }
}
