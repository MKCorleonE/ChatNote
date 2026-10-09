import { useEffect, useState } from 'react';
import { useI18n } from './I18nProvider';
import { localeTag, type Language } from './i18n';
import { questionTime } from './message-history';

export function messageTimeLabel(timestamp: number, language: Language, now = Date.now()): string {
  const time = questionTime(timestamp);
  if (!time || !Number.isFinite(now)) return '';
  const sent = new Date(timestamp), today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const nextDay = new Date(today); nextDay.setDate(nextDay.getDate() + 1);
  if (sent >= today && sent < nextDay) return time;
  const monday = new Date(today); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const options: Intl.DateTimeFormatOptions = sent >= monday && sent < today ? { weekday: 'long' } : { month: 'short', day: 'numeric' };
  return `${new Intl.DateTimeFormat(localeTag(language), options).format(sent)} ${time}`;
}

// One timer for the whole conversation; update date labels after midnight or returning to the app.
export function useMessageClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function refresh() {
      clearTimeout(timer);
      const current = Date.now(); setNow(current);
      const next = new Date(current); next.setDate(next.getDate() + 1); next.setHours(0, 0, 0, 0);
      timer = setTimeout(refresh, Math.max(100, next.getTime() - current + 50));
    }
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearTimeout(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  return now;
}

export function MessageTime({ timestamp, now, className = '' }: { timestamp: number; now: number; className?: string }) {
  const { language, date } = useI18n();
  const label = messageTimeLabel(timestamp, language, now);
  return label ? <time className={`message-time ${className}`} dateTime={new Date(timestamp).toISOString()} title={date(timestamp, true)}>{label}</time> : null;
}
