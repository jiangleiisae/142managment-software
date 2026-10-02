import type { ShiftType } from '@prisma/client';

export const CN_OFFSET_MS = 8 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

type TimedShift = Pick<ShiftType, 'startTime' | 'endTime' | 'endsNextDay'>;

export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/// 工作班次的总时长(分钟, 含休息); 非工作班次为 0
export function shiftGrossMinutes(s: TimedShift): number {
  if (!s.startTime || !s.endTime) return 0;
  return toMinutes(s.endTime) - toMinutes(s.startTime) + (s.endsNextDay ? 1440 : 0);
}

/// 日期(@db.Date, 当日 00:00 UTC 表示北京时间的该日历日)对应的北京时间 00:00 的 UTC 毫秒
export const dayStartMs = (date: Date) => date.getTime() - CN_OFFSET_MS;

/// 工作班次在某个北京时间日历日上的 [开始, 结束) UTC 时刻; 非工作班次返回 null
export function shiftWindow(date: Date, s: TimedShift): { start: Date; end: Date } | null {
  const gross = shiftGrossMinutes(s);
  if (!s.startTime || gross <= 0) return null;
  const start = dayStartMs(date) + toMinutes(s.startTime) * 60_000;
  return { start: new Date(start), end: new Date(start + gross * 60_000) };
}

/// 紧接在 (date, current) 之后的下一个工作班次: 开始时刻不早于当前班次结束、且最早的那个
/// (同一时刻开始的取 sortOrder 小者, 再按代码)。E晚班(次日08:30结束) → 次日 M白班; M → 当日 E。
export function nextShiftSlot<T extends TimedShift & { id: string; sortOrder: number; code: string }>(
  shifts: T[],
  date: Date,
  current: TimedShift,
): { date: Date; shift: T; startAt: Date } | null {
  const window = shiftWindow(date, current);
  if (!window) return null;
  let best: { date: Date; shift: T; startMs: number } | null = null;
  for (let offset = 0; offset <= 2; offset += 1) {
    const day = new Date(date.getTime() + offset * DAY_MS);
    for (const s of shifts) {
      const w = shiftWindow(day, s);
      if (!w || w.start.getTime() < window.end.getTime()) continue;
      const better =
        !best ||
        w.start.getTime() < best.startMs ||
        (w.start.getTime() === best.startMs && (s.sortOrder < best.shift.sortOrder || (s.sortOrder === best.shift.sortOrder && s.code < best.shift.code)));
      if (better) best = { date: day, shift: s, startMs: w.start.getTime() };
    }
  }
  return best ? { date: best.date, shift: best.shift, startAt: new Date(best.startMs) } : null;
}
