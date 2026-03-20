import { addDays, endOfWeek, isAfter, isBefore, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { hr } from "date-fns/locale";

export const CALENDAR_LOCALE = hr;
export const CALENDAR_VISIBLE_WEEKS = 2;
export const CALENDAR_WINDOW_DAYS = 14;
export const WORKDAY_START_HOUR = 8;
export const WORKDAY_END_HOUR = 18;

export function getCalendarWeekStart(date: Date): Date {
  return startOfWeek(date, { locale: CALENDAR_LOCALE, weekStartsOn: 1 });
}

export function getCalendarWindowStart(date: Date = new Date()): Date {
  return startOfDay(getCalendarWeekStart(date));
}

export function getCalendarWindowEnd(date: Date = new Date()): Date {
  return endOfWeek(addDays(getCalendarWindowStart(date), 7), {
    locale: CALENDAR_LOCALE,
    weekStartsOn: 1,
  });
}

export function getTwoWeekWindowDays(date: Date = new Date()): Date[] {
  const start = getCalendarWindowStart(date);
  return Array.from({ length: CALENDAR_WINDOW_DAYS }, (_, index) => addDays(start, index));
}

export function isPastDay(date: Date, now: Date = new Date()): boolean {
  return startOfDay(date).getTime() < startOfDay(now).getTime();
}

export function isPastEvent(end: Date, now: Date = new Date()): boolean {
  return end.getTime() < now.getTime();
}

export function isOutsideCalendarWindow(date: Date, now: Date = new Date()): boolean {
  return isBefore(startOfDay(date), getCalendarWindowStart(now)) || isAfter(startOfDay(date), getCalendarWindowEnd(now));
}

export function clampCalendarDate(date: Date, now: Date = new Date()): Date {
  const windowStart = getCalendarWindowStart(now);
  const windowEnd = getCalendarWindowEnd(now);

  if (isBefore(date, windowStart)) {
    return windowStart;
  }

  if (isAfter(date, windowEnd)) {
    return windowEnd;
  }

  return date;
}

export function isSameCalendarDay(left: Date, right: Date): boolean {
  return isSameDay(left, right);
}
