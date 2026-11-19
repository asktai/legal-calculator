/** 数值与格式化工具（纯函数，无框架依赖） */

/** 四舍五入到指定小数位 */
export function round(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return 0;
  const f = Math.pow(10, digits);
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** 金额千分位，保留 2 位 */
export function money(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return round(value, 2).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 金额转中文大写（用于裁判文书表述） */
const CN_DIGITS = '零壹贰叁肆伍陆柒捌玖';
const CN_UNITS = ['', '拾', '佰', '仟'];
const CN_GROUPS = ['', '万', '亿', '万亿'];

export function moneyToChinese(value: number): string {
  if (!Number.isFinite(value)) return '';
  const neg = value < 0;
  let n = Math.abs(round(value, 2));
  const yuan = Math.floor(n);
  const jiao = Math.floor((n - yuan) * 10);
  const fen = Math.round((n - yuan) * 100) % 10;

  if (yuan === 0 && jiao === 0 && fen === 0) return '零元整';

  let intPart = '';
  let rest = yuan;
  let groupIdx = 0;
  let hasZeroTail = false;

  if (rest === 0) {
    intPart = '零';
  }
  while (rest > 0) {
    const group = rest % 10000;
    rest = Math.floor(rest / 10000);
    let gStr = '';
    let zeroFlag = false;
    let g = group;
    for (let i = 0; i < 4; i++) {
      const d = g % 10;
      g = Math.floor(g / 10);
      if (d === 0) {
        if (gStr !== '' && !gStr.startsWith('零')) zeroFlag = true;
      } else {
        if (zeroFlag) {
          gStr = '零' + gStr;
          zeroFlag = false;
        }
        gStr = CN_DIGITS[d] + CN_UNITS[i] + gStr;
      }
    }
    if (group > 0) {
      intPart = gStr + CN_GROUPS[groupIdx] + intPart;
      if (group < 1000 && groupIdx > 0) intPart = '零' + intPart;
      hasZeroTail = false;
    } else if (groupIdx > 0 && !hasZeroTail && intPart) {
      intPart = '零' + intPart;
      hasZeroTail = true;
    }
    groupIdx++;
  }
  intPart = intPart.replace(/零+/g, '零').replace(/^零/, '').replace(/零$/, '');

  let result = intPart ? intPart + '元' : '';
  if (jiao === 0 && fen === 0) {
    result += '整';
  } else {
    if (jiao > 0) result += CN_DIGITS[jiao] + '角';
    else if (fen > 0 && result) result += '零';
    if (fen > 0) result += CN_DIGITS[fen] + '分';
  }
  return (neg ? '负' : '') + result;
}

/** 百分比格式化 */
export function percent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return round(value, digits).toFixed(digits);
}

/** 通用数字格式化 */
export function num(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return round(value, digits).toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
  });
}

/** 安全取数：把输入值转成有限数字，非法则回落默认值 */
export function toNum(v: unknown, fallback = 0): number {
  if (v === '' || v === undefined || v === null) return fallback;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,，\s]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

/** 安全取布尔 */
export function toBool(v: unknown, fallback = false): boolean {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  return v === 'true' || v === 1 || v === '1';
}

/** 安全取字符串 */
export function toStr(v: unknown, fallback = ''): string {
  if (v === undefined || v === null) return fallback;
  return String(v);
}
