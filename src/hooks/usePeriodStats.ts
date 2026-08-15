import { useMemo, useState } from "react";
import {
  startOfMonth,
  startOfYear,
  subWeeks,
  subMonths,
  subYears,
  isWithinInterval,
  getHours,
  differenceInCalendarDays,
} from "date-fns";
import type { PeriodOption, ComparisonOption } from "../components/PeriodPicker";

interface Activity {
  id: string;
  activity_date: string;
}

interface PeriodBounds {
  start: Date;
  end: Date;
}

// Nominal length of each period, used only to figure out how many
// equivalent periods fit into the person's whole history - so "All Time
// Average" can divide the all-time total into a genuine per-period
// average, instead of comparing the current period against the raw
// all-time total (which always looks like a huge drop, regardless of how
// the current period actually went).
function getPeriodLengthInDays(period: PeriodOption): number {
  switch (period) {
    case "this-month":
      return 30;
    case "last-8-weeks":
      return 56;
    case "this-year":
      return 365;
    case "all-time":
      return 0; // not applicable - "all-time" has no meaningful average of itself
  }
}

function computeAllTimeAverage(
  activities: Activity[],
  period: PeriodOption,
  now: Date
): { bunnyDays: BunnyDaysStats; timeOfDay: TimeOfDayStats } {
  const periodLengthDays = getPeriodLengthInDays(period);

  const earliestActivity = activities.reduce<Date | null>((earliest, a) => {
    const d = new Date(a.activity_date);
    return !earliest || d < earliest ? d : earliest;
  }, null);

  // No history yet, or "all-time" itself selected (no periods to divide
  // into) - fall back to 1 period, so the average is just the raw total
  // rather than dividing by zero.
  const historyDays = earliestActivity ? Math.max(1, differenceInCalendarDays(now, earliestActivity)) : periodLengthDays;
  const numPeriods = periodLengthDays > 0 ? Math.max(1, historyDays / periodLengthDays) : 1;

  const allTimeBunny = calculateBunnyDays(activities);
  const allTimeTod = calculateTimeOfDay(activities);

  const bunnyDays: BunnyDaysStats = {
    doubleDays: Math.round(allTimeBunny.doubleDays / numPeriods),
    tripleDays: Math.round(allTimeBunny.tripleDays / numPeriods),
  };

  const todKeys = Object.keys(allTimeTod) as (keyof TimeOfDayStats)[];
  const timeOfDay = todKeys.reduce((acc, key) => {
    acc[key] = Math.round(allTimeTod[key] / numPeriods);
    return acc;
  }, {} as TimeOfDayStats);

  return { bunnyDays, timeOfDay };
}

function getPeriodBounds(period: PeriodOption, referenceDate: Date = new Date()): PeriodBounds {
  const now = referenceDate;
  
  switch (period) {
    case "this-month":
      return { start: startOfMonth(now), end: now };
    case "last-8-weeks":
      return { start: subWeeks(now, 8), end: now };
    case "this-year":
      return { start: startOfYear(now), end: now };
    case "all-time":
      return { start: new Date(0), end: now };
  }
}

function getComparisonBounds(
  period: PeriodOption,
  comparison: ComparisonOption,
  allActivities: Activity[]
): PeriodBounds {
  const now = new Date();
  const currentBounds = getPeriodBounds(period, now);

  // "all-time-average" is handled separately via computeAllTimeAverage()
  // (a true per-period average, not a filtered window) - this function is
  // now only ever called for "previous-period" and "same-period-last-year".

  if (comparison === "same-period-last-year") {
    // Elapsed-matched: shift the CURRENT window back exactly one year,
    // instead of always comparing against the entire previous calendar
    // year. If today is Jul 15 and "this-year" is selected, this compares
    // Jan 1-Jul 15 this year against Jan 1-Jul 15 last year - not this
    // year's 196 days against all 365 days of last year.
    return {
      start: subYears(currentBounds.start, 1),
      end: subYears(currentBounds.end, 1),
    };
  }

  // "previous-period": shift the CURRENT window back by one period-length
  // instead of comparing against the previous period's full length. A
  // partial current period (e.g. 15 days into this month) now compares
  // against an equally partial previous period (the first 15 days of last
  // month), so the delta reflects an actual difference in activity, not
  // just "this period isn't over yet".
  switch (period) {
    case "this-month":
      return { start: subMonths(currentBounds.start, 1), end: subMonths(currentBounds.end, 1) };
    case "last-8-weeks":
      return { start: subWeeks(currentBounds.start, 8), end: subWeeks(currentBounds.end, 8) };
    case "this-year":
      return { start: subYears(currentBounds.start, 1), end: subYears(currentBounds.end, 1) };
    case "all-time":
      // No meaningful "previous" for all-time.
      return { start: new Date(0), end: now };
  }
}

function filterActivities(activities: Activity[], bounds: PeriodBounds): Activity[] {
  return activities.filter((a) =>
    isWithinInterval(new Date(a.activity_date), { start: bounds.start, end: bounds.end })
  );
}

function calculateTimeOfDay(activities: Activity[]) {
  const stats = {
    nightOwl: 0,
    earlyBird: 0,
    lazyMorning: 0,
    nooner: 0,
    afternoon: 0,
    evening: 0,
  };

  activities.forEach((activity) => {
    const hour = getHours(new Date(activity.activity_date));

    if (hour >= 22 || hour < 4) {
      stats.nightOwl++;
    } else if (hour >= 4 && hour < 8) {
      stats.earlyBird++;
    } else if (hour >= 8 && hour < 12) {
      stats.lazyMorning++;
    } else if (hour >= 12 && hour < 15) {
      stats.nooner++;
    } else if (hour >= 15 && hour < 18) {
      stats.afternoon++;
    } else if (hour >= 18 && hour < 22) {
      stats.evening++;
    }
  });

  return stats;
}

function calculateBunnyDays(activities: Activity[]) {
  const dayActivityCounts = new Map<string, number>();

  activities.forEach((activity) => {
    const dayKey = new Date(activity.activity_date).toISOString().split('T')[0];
    dayActivityCounts.set(dayKey, (dayActivityCounts.get(dayKey) || 0) + 1);
  });

  let doubleDays = 0;
  let tripleDays = 0;

  dayActivityCounts.forEach((count) => {
    if (count === 2) doubleDays++;
    else if (count >= 3) tripleDays++;
  });

  return { doubleDays, tripleDays };
}

export type TimeOfDayStats = ReturnType<typeof calculateTimeOfDay>;
export type BunnyDaysStats = ReturnType<typeof calculateBunnyDays>;

export interface PeriodStatsResult {
  period: PeriodOption;
  comparison: ComparisonOption;
  setPeriod: (p: PeriodOption) => void;
  setComparison: (c: ComparisonOption) => void;
  
  // Current period stats
  timeOfDay: TimeOfDayStats;
  bunnyDays: BunnyDaysStats;
  
  // Comparison stats
  comparisonTimeOfDay: TimeOfDayStats;
  comparisonBunnyDays: BunnyDaysStats;
  
  // Deltas
  bunnyDaysDelta: { doubleDays: number; tripleDays: number };
  dominantTimeOfDay: string | null;
  dominantTimeOfDayDelta: { label: string; diff: number; pct: number } | null;
}

const timeOfDayLabels: Record<keyof TimeOfDayStats, string> = {
  nightOwl: "Night Owl",
  earlyBird: "Early Bird",
  lazyMorning: "Lazy Morning",
  nooner: "Nooner",
  afternoon: "Afternoon Delight",
  evening: "Evening Bliss",
};

export function usePeriodStats(activities: Activity[]): PeriodStatsResult {
  const [period, setPeriod] = useState<PeriodOption>("last-8-weeks");
  const [comparison, setComparison] = useState<ComparisonOption>("previous-period");

  const result = useMemo(() => {
    const now = new Date();
    const currentBounds = getPeriodBounds(period, now);
    const currentActivities = filterActivities(activities, currentBounds);

    const timeOfDay = calculateTimeOfDay(currentActivities);
    const bunnyDays = calculateBunnyDays(currentActivities);

    let comparisonTimeOfDay: TimeOfDayStats;
    let comparisonBunnyDays: BunnyDaysStats;

    if (comparison === "all-time-average") {
      const avg = computeAllTimeAverage(activities, period, now);
      comparisonTimeOfDay = avg.timeOfDay;
      comparisonBunnyDays = avg.bunnyDays;
    } else {
      const comparisonBounds = getComparisonBounds(period, comparison, activities);
      const comparisonActivities = filterActivities(activities, comparisonBounds);
      comparisonTimeOfDay = calculateTimeOfDay(comparisonActivities);
      comparisonBunnyDays = calculateBunnyDays(comparisonActivities);
    }

    // Calculate deltas
    const bunnyDaysDelta = {
      doubleDays: bunnyDays.doubleDays - comparisonBunnyDays.doubleDays,
      tripleDays: bunnyDays.tripleDays - comparisonBunnyDays.tripleDays,
    };

    // Find dominant time of day
    const todEntries = Object.entries(timeOfDay) as [keyof TimeOfDayStats, number][];
    const sortedTod = todEntries.sort((a, b) => b[1] - a[1]);
    const dominant = sortedTod[0];
    const dominantTimeOfDay = dominant[1] > 0 ? timeOfDayLabels[dominant[0]] : null;

    // Calculate dominant ToD delta
    let dominantTimeOfDayDelta: { label: string; diff: number; pct: number } | null = null;
    if (dominant[1] > 0 && dominantTimeOfDay) {
      const compValue = comparisonTimeOfDay[dominant[0]];
      const diff = dominant[1] - compValue;
      const pct = compValue > 0 ? Math.round((diff / compValue) * 100) : 0;
      if (diff !== 0) {
        dominantTimeOfDayDelta = { label: dominantTimeOfDay, diff, pct };
      }
    }

    return {
      timeOfDay,
      bunnyDays,
      comparisonTimeOfDay,
      comparisonBunnyDays,
      bunnyDaysDelta,
      dominantTimeOfDay,
      dominantTimeOfDayDelta,
    };
  }, [activities, period, comparison]);

  return {
    period,
    comparison,
    setPeriod,
    setComparison,
    ...result,
  };
}

export function getDeltaMessage(
  label: string,
  diff: number,
  isCount: boolean = false
): string {
  if (diff === 0) return "";
  
  const direction = diff > 0 ? "More" : "Fewer";
  const value = isCount ? `${diff > 0 ? "+" : ""}${diff}` : `${diff > 0 ? "+" : ""}${diff}%`;
  
  return `${direction} ${label} than last period (${value})`;
}
