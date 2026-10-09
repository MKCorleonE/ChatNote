import { expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { I18nProvider } from './I18nProvider';
import { MessageTime, messageTimeLabel, useMessageClock } from './MessageTime';

const local = (day:number,hour=0,minute=0) => new Date(2026,9,day,hour,minute).getTime();
test('Today uses HH:mm; earlier dates this Monday-based week use weekdays; older dates use month/day', () => {
  const now=local(9,12);
  expect(messageTimeLabel(local(9,0,5),'zh-Hans',now)).toBe('00:05');
  expect(messageTimeLabel(local(8,23,9),'zh-Hans',now)).toBe('星期四 23:09');
  expect(messageTimeLabel(local(5,9,3),'zh-Hant',now)).toBe('星期一 09:03');
  expect(messageTimeLabel(local(4,9,3),'zh-Hans',now)).toBe('10月4日 09:03');
  expect(messageTimeLabel(local(8,23,9),'en',now)).toBe('Thursday 23:09');
  expect(messageTimeLabel(local(4,9,3),'en',now)).toBe('Oct 4 09:03');
});
test('Monday/Sunday boundaries, previous years, future dates and invalid timestamps are handled by calendar dates', () => {
  expect(messageTimeLabel(local(11,0,5),'zh-Hans',local(12,0,1))).toBe('10月11日 00:05');
  expect(messageTimeLabel(local(5,0,5),'zh-Hans',local(11,23,59))).toBe('星期一 00:05');
  expect(messageTimeLabel(new Date(2025,9,9,0,5).getTime(),'zh-Hans',local(9))).toBe('10月9日 00:05');
  expect(messageTimeLabel(local(10,0,5),'zh-Hans',local(9))).toBe('10月10日 00:05');
  expect(messageTimeLabel(Number.NaN,'en',local(9))).toBe('');
});
test('An open conversation refreshes date prefixes across midnight and preserves the original ISO timestamp', () => {
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,9,8,23,59,59,900));
  function Clock(){const now=useMessageClock();return <MessageTime timestamp={local(8,12,34)} now={now}/>;}
  try {
    const view=render(<I18nProvider language="zh-Hans"><Clock/></I18nProvider>);
    expect(screen.getByText('12:34')).toBeDefined();
    act(()=>vi.advanceTimersByTime(200));
    const time=screen.getByText('星期四 12:34');expect(time.getAttribute('datetime')).toBe(new Date(local(8,12,34)).toISOString());
    view.unmount();expect(vi.getTimerCount()).toBe(0);
  } finally {vi.useRealTimers();}
});
