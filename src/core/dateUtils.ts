/**
 * 法定期间计算工具
 * 依据《民法典》第200条—第204条：
 *  - 期间按公历年、月、日、小时计算；
 *  - 按日计算期间的，开始当日不计入，自次日起算；
 *  - 期间最后一日为法定休假日的，以休假日结束的次日为期间届满日；
 *  - 期间不包括在途时间，诉讼文书交邮后届满前交邮的不算过期。
 */

/** 内置法定节假日（含调休形成的连休日）。2024—2026 为官方安排；2027 放假日为官方已公布（2026-11 发布），
 *  调休上班日为按放假办法规则的推定——以国办通知原文为准。 */
const HOLIDAYS: Record<number, string[]> = {
  2024: [
    '2024-01-01',
    '2024-02-10','2024-02-11','2024-02-12','2024-02-13','2024-02-14','2024-02-15','2024-02-16','2024-02-17',
    '2024-04-04','2024-04-05','2024-04-06',
    '2024-05-01','2024-05-02','2024-05-03','2024-05-04','2024-05-05',
    '2024-06-08','2024-06-09','2024-06-10',
    '2024-09-15','2024-09-16','2024-09-17',
    '2024-10-01','2024-10-02','2024-10-03','2024-10-04','2024-10-05','2024-10-06','2024-10-07',
  ],
  2025: [
    '2025-01-01',
    '2025-01-28','2025-01-29','2025-01-30','2025-01-31','2025-02-01','2025-02-02','2025-02-03','2025-02-04',
    '2025-04-04','2025-04-05','2025-04-06',
    '2025-05-01','2025-05-02','2025-05-03','2025-05-04','2025-05-05',
    '2025-05-31','2025-06-01','2025-06-02',
    '2025-10-01','2025-10-02','2025-10-03','2025-10-04','2025-10-05','2025-10-06','2025-10-07','2025-10-08',
  ],
  2026: [
    '2026-01-01','2026-01-02','2026-01-03',
    '2026-02-15','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20','2026-02-21','2026-02-22',
    '2026-04-04','2026-04-05','2026-04-06',
    '2026-05-01','2026-05-02','2026-05-03','2026-05-04','2026-05-05',
    '2026-06-19','2026-06-20','2026-06-21',
    '2026-09-25','2026-09-26','2026-09-27',
    '2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-10-05','2026-10-06','2026-10-07',
  ],
  2027: [
    // 元旦 1/1（五）—1/3（日）3 天，不调休
    '2027-01-01','2027-01-02','2027-01-03',
    // 春节：除夕 2/5（周五）起放假调休 8 天，顺连周末实际连休 9 天（2/13 为周六）
    '2027-02-05','2027-02-06','2027-02-07','2027-02-08','2027-02-09','2027-02-10','2027-02-11','2027-02-12',
    // 清明 4/3（六）—4/5（一）3 天，不调休
    '2027-04-03','2027-04-04','2027-04-05',
    // 劳动节 4/30（五）—5/4（二）5 天，调休 1 天
    '2027-04-30','2027-05-01','2027-05-02','2027-05-03','2027-05-04',
    // 端午 6/9（周三）仅 1 天，不调休
    '2027-06-09',
    // 中秋 9/15（周三）仅 1 天，不调休
    '2027-09-15',
    // 国庆 10/1（五）—10/7（四）7 天，调休 2 天
    '2027-10-01','2027-10-02','2027-10-03','2027-10-04','2027-10-05','2027-10-06','2027-10-07',
  ],
};

/** 调休上班日：名义上是周末但需上班，不算休假日。
 *  2027 年为按放假办法规则的**推定**（官方新闻稿未列补班日）：
 *  春节借 4 个工作日 → 补 2（2/20 六、2/21 日）；劳动节借 1 → 补 5/8（六）；
 *  国庆借 2 → 补 10/9（六）、10/10（日）。以国办通知原文为准。 */
const WORKDAY_OVERRIDE: Record<number, string[]> = {
  2025: ['2025-01-26','2025-02-08','2025-04-27','2025-09-28','2025-10-11'],
  2026: ['2026-02-14','2026-02-28','2026-09-20','2026-10-10'],
  2027: ['2027-02-20','2027-02-21','2027-05-08','2027-10-09','2027-10-10'],
};

export function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const WEEKDAY_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export function weekdayCn(d: Date): string {
  return WEEKDAY_CN[d.getDay()];
}

export function parseDate(input: unknown): Date | null {
  if (input === undefined || input === null || input === '') return null;
  const s = String(input).trim();
  const m = /^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 是否为法定休假日（含周末，扣除调休上班日） */
export function isHoliday(d: Date): boolean {
  const key = ymd(d);
  const year = d.getFullYear();
  if (WORKDAY_OVERRIDE[year]?.includes(key)) return false;
  if (HOLIDAYS[year]?.includes(key)) return true;
  const wd = d.getDay();
  return wd === 0 || wd === 6;
}

/** 加天数 */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

/** 加月份：到期月对应日；无对应日则取月末 */
export function addMonths(d: Date, n: number): Date {
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target;
}

export function addYears(d: Date, n: number): Date {
  return addMonths(d, n * 12);
}

export interface PeriodResult {
  /** 起算日：开始当日不计入，次日为第一日 */
  startFrom: Date;
  /** 未考虑顺延的届满日 */
  rawEnd: Date;
  /** 实际届满日（休假日顺延后） */
  finalEnd: Date;
  /** 是否发生了顺延 */
  postponed: boolean;
  /** 顺延经过的休假日列表 */
  postponedDays: string[];
  /** 期间总自然日数（起算次日到最终届满日） */
  totalDays: number;
}

/**
 * 计算法定期间。
 * @param base 起算基准日（如送达日、判决作出日）
 * @param value 期间长度
 * @param unit 单位
 */
export function calcPeriod(base: Date, value: number, unit: 'day' | 'month' | 'year'): PeriodResult {
  const startFrom = addDays(base, 1); // 开始当日不计入，次日起算
  let rawEnd: Date;
  if (unit === 'day') {
    // 第 n 日：起算日 + (n - 1) 天
    rawEnd = addDays(startFrom, Math.max(0, value - 1));
  } else if (unit === 'month') {
    rawEnd = addMonths(base, value);
  } else {
    rawEnd = addYears(base, value);
  }

  const postponedDays: string[] = [];
  let finalEnd = rawEnd;
  let guard = 0;
  while (isHoliday(finalEnd) && guard < 30) {
    postponedDays.push(`${ymd(finalEnd)}(${weekdayCn(finalEnd)})`);
    finalEnd = addDays(finalEnd, 1);
    guard++;
  }

  const totalDays = Math.round((finalEnd.getTime() - startFrom.getTime()) / 86400000) + 1;
  return {
    startFrom,
    rawEnd,
    finalEnd,
    postponed: postponedDays.length > 0,
    postponedDays,
    totalDays,
  };
}
