// 由 skill/scripts/build-skill-bundles.mjs 自开发侧生成，随技能包分发；请勿手改。

// src/core/format.ts
function round(value, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  const f = Math.pow(10, digits);
  return Math.round((value + Number.EPSILON) * f) / f;
}
function money(value) {
  if (!Number.isFinite(value)) return "\u2014";
  return round(value, 2).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
var CN_DIGITS = "\u96F6\u58F9\u8D30\u53C1\u8086\u4F0D\u9646\u67D2\u634C\u7396";
var CN_UNITS = ["", "\u62FE", "\u4F70", "\u4EDF"];
var CN_GROUPS = ["", "\u4E07", "\u4EBF", "\u4E07\u4EBF"];
function moneyToChinese(value) {
  if (!Number.isFinite(value)) return "";
  const neg = value < 0;
  let n = Math.abs(round(value, 2));
  const yuan = Math.floor(n);
  const jiao = Math.floor((n - yuan) * 10);
  const fen = Math.round((n - yuan) * 100) % 10;
  if (yuan === 0 && jiao === 0 && fen === 0) return "\u96F6\u5143\u6574";
  let intPart = "";
  let rest = yuan;
  let groupIdx = 0;
  let hasZeroTail = false;
  if (rest === 0) {
    intPart = "\u96F6";
  }
  while (rest > 0) {
    const group = rest % 1e4;
    rest = Math.floor(rest / 1e4);
    let gStr = "";
    let zeroFlag = false;
    let g = group;
    for (let i = 0; i < 4; i++) {
      const d = g % 10;
      g = Math.floor(g / 10);
      if (d === 0) {
        if (gStr !== "" && !gStr.startsWith("\u96F6")) zeroFlag = true;
      } else {
        if (zeroFlag) {
          gStr = "\u96F6" + gStr;
          zeroFlag = false;
        }
        gStr = CN_DIGITS[d] + CN_UNITS[i] + gStr;
      }
    }
    if (group > 0) {
      intPart = gStr + CN_GROUPS[groupIdx] + intPart;
      if (group < 1e3 && groupIdx > 0) intPart = "\u96F6" + intPart;
      hasZeroTail = false;
    } else if (groupIdx > 0 && !hasZeroTail && intPart) {
      intPart = "\u96F6" + intPart;
      hasZeroTail = true;
    }
    groupIdx++;
  }
  intPart = intPart.replace(/零+/g, "\u96F6").replace(/^零/, "").replace(/零$/, "");
  let result = intPart ? intPart + "\u5143" : "";
  if (jiao === 0 && fen === 0) {
    result += "\u6574";
  } else {
    if (jiao > 0) result += CN_DIGITS[jiao] + "\u89D2";
    else if (fen > 0 && result) result += "\u96F6";
    if (fen > 0) result += CN_DIGITS[fen] + "\u5206";
  }
  return (neg ? "\u8D1F" : "") + result;
}
function toNum(v, fallback = 0) {
  if (v === "" || v === void 0 || v === null) return fallback;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,，\s]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}
function toStr(v, fallback = "") {
  if (v === void 0 || v === null) return fallback;
  return String(v);
}

// src/core/progressive.ts
function progressive(amount, tiers) {
  const lines = [];
  let total = 0;
  let lower = 0;
  for (const t of tiers) {
    if (amount <= lower) break;
    const base = Math.min(amount, t.upTo) - lower;
    if (base <= 0) {
      lower = t.upTo;
      continue;
    }
    const seg = t.rate > 0 ? base * t.rate : t.flat ?? 0;
    total += seg;
    lines.push({
      desc: t.desc ?? `\u8D85\u8FC7 ${lower} \u5143\u90E8\u5206`,
      base,
      rateText: t.rate > 0 ? `\xD7 ${(t.rate * 100).toFixed(t.rate * 100 % 1 === 0 ? 0 : 2)}%` : "\u5B9A\u989D",
      amount: seg
    });
    lower = t.upTo;
  }
  return { total, lines };
}
var CIVIL_FEE_TIERS = [
  { upTo: 1e4, rate: 0, flat: 50, desc: "1 \u4E07\u5143\u4EE5\u4E0B" },
  { upTo: 1e5, rate: 0.025, desc: "1 \u4E07\u201410 \u4E07\u5143\u90E8\u5206" },
  { upTo: 2e5, rate: 0.02, desc: "10 \u4E07\u201420 \u4E07\u5143\u90E8\u5206" },
  { upTo: 5e5, rate: 0.015, desc: "20 \u4E07\u201450 \u4E07\u5143\u90E8\u5206" },
  { upTo: 1e6, rate: 0.01, desc: "50 \u4E07\u2014100 \u4E07\u5143\u90E8\u5206" },
  { upTo: 2e6, rate: 9e-3, desc: "100 \u4E07\u2014200 \u4E07\u5143\u90E8\u5206" },
  { upTo: 5e6, rate: 8e-3, desc: "200 \u4E07\u2014500 \u4E07\u5143\u90E8\u5206" },
  { upTo: 1e7, rate: 7e-3, desc: "500 \u4E07\u20141000 \u4E07\u5143\u90E8\u5206" },
  { upTo: 2e7, rate: 6e-3, desc: "1000 \u4E07\u20142000 \u4E07\u5143\u90E8\u5206" },
  { upTo: Infinity, rate: 5e-3, desc: "2000 \u4E07\u5143\u4EE5\u4E0A\u90E8\u5206" }
];
var PRESERVATION_TIERS = [
  { upTo: 1e3, rate: 0, flat: 30, desc: "1000 \u5143\u4EE5\u4E0B\u6216\u4E0D\u6D89\u53CA\u8D22\u4EA7\u6570\u989D" },
  { upTo: 1e5, rate: 0.01, desc: "1000 \u5143\u201410 \u4E07\u5143\u90E8\u5206" },
  { upTo: Infinity, rate: 5e-3, desc: "10 \u4E07\u5143\u4EE5\u4E0A\u90E8\u5206" }
];
var PRESERVATION_CAP = 5e3;
var EXECUTION_TIERS = [
  { upTo: 1e4, rate: 0, flat: 50, desc: "1 \u4E07\u5143\u4EE5\u4E0B" },
  { upTo: 5e5, rate: 0.015, desc: "1 \u4E07\u201450 \u4E07\u5143\u90E8\u5206" },
  { upTo: 5e6, rate: 0.01, desc: "50 \u4E07\u2014500 \u4E07\u5143\u90E8\u5206" },
  { upTo: 1e7, rate: 5e-3, desc: "500 \u4E07\u20141000 \u4E07\u5143\u90E8\u5206" },
  { upTo: Infinity, rate: 1e-3, desc: "1000 \u4E07\u5143\u4EE5\u4E0A\u90E8\u5206" }
];
var BANKRUPTCY_CAP = 3e5;
var ASSET_APPRAISAL_TIERS = [
  { upTo: 1e6, rate: 6e-3, desc: "100 \u4E07\u5143\u4EE5\u4E0B\u90E8\u5206" },
  { upTo: 1e7, rate: 25e-4, desc: "100 \u4E07\u20141000 \u4E07\u5143\u90E8\u5206" },
  { upTo: 5e7, rate: 8e-4, desc: "1000 \u4E07\u20145000 \u4E07\u5143\u90E8\u5206" },
  { upTo: 1e8, rate: 5e-4, desc: "5000 \u4E07\u20141 \u4EBF\u5143\u90E8\u5206" },
  { upTo: Infinity, rate: 1e-4, desc: "1 \u4EBF\u5143\u4EE5\u4E0A\u90E8\u5206" }
];
var REAL_ESTATE_TIERS = [
  { upTo: 1e6, rate: 5e-3, desc: "100 \u4E07\u5143\u4EE5\u4E0B\u90E8\u5206" },
  { upTo: 1e7, rate: 25e-4, desc: "100 \u4E07\u20141000 \u4E07\u5143\u90E8\u5206" },
  { upTo: 2e7, rate: 15e-4, desc: "1000 \u4E07\u20142000 \u4E07\u5143\u90E8\u5206" },
  { upTo: 5e7, rate: 8e-4, desc: "2000 \u4E07\u20145000 \u4E07\u5143\u90E8\u5206" },
  { upTo: 1e8, rate: 5e-4, desc: "5000 \u4E07\u20141 \u4EBF\u5143\u90E8\u5206" },
  { upTo: Infinity, rate: 1e-4, desc: "1 \u4EBF\u5143\u4EE5\u4E0A\u90E8\u5206" }
];
var LAND_APPRAISAL_TIERS = [
  { upTo: 1e6, rate: 4e-3, desc: "100 \u4E07\u5143\u4EE5\u4E0B\u90E8\u5206" },
  { upTo: 2e6, rate: 3e-3, desc: "100 \u4E07\u2014200 \u4E07\u5143\u90E8\u5206" },
  { upTo: 1e7, rate: 2e-3, desc: "200 \u4E07\u20141000 \u4E07\u5143\u90E8\u5206" },
  { upTo: 2e7, rate: 15e-4, desc: "1000 \u4E07\u20142000 \u4E07\u5143\u90E8\u5206" },
  { upTo: 5e7, rate: 8e-4, desc: "2000 \u4E07\u20145000 \u4E07\u5143\u90E8\u5206" },
  { upTo: 1e8, rate: 4e-4, desc: "5000 \u4E07\u20141 \u4EBF\u5143\u90E8\u5206" },
  { upTo: Infinity, rate: 2e-4, desc: "1 \u4EBF\u5143\u4EE5\u4E0A\u90E8\u5206" }
];
var NOTARY_INHERITANCE_TIERS = [
  { upTo: 2e5, rate: 0.012, desc: "20 \u4E07\u5143\u4EE5\u4E0B\u90E8\u5206" },
  { upTo: 5e5, rate: 0.01, desc: "20 \u4E07\u201450 \u4E07\u5143\u90E8\u5206" },
  { upTo: 5e6, rate: 8e-3, desc: "50 \u4E07\u2014500 \u4E07\u5143\u90E8\u5206" },
  { upTo: 1e7, rate: 5e-3, desc: "500 \u4E07\u20141000 \u4E07\u5143\u90E8\u5206" },
  { upTo: Infinity, rate: 1e-3, desc: "1000 \u4E07\u5143\u4EE5\u4E0A\u90E8\u5206" }
];
var NOTARY_CONTRACT_TIERS = [
  { upTo: 5e5, rate: 3e-3, desc: "50 \u4E07\u5143\u4EE5\u4E0B\u90E8\u5206" },
  { upTo: 5e6, rate: 25e-4, desc: "50 \u4E07\u2014500 \u4E07\u5143\u90E8\u5206" },
  { upTo: 1e7, rate: 2e-3, desc: "500 \u4E07\u20141000 \u4E07\u5143\u90E8\u5206" },
  { upTo: 1e8, rate: 5e-4, desc: "1000 \u4E07\u20141 \u4EBF\u5143\u90E8\u5206" },
  { upTo: Infinity, rate: 1e-4, desc: "1 \u4EBF\u5143\u4EE5\u4E0A\u90E8\u5206" }
];

// src/core/calculators/litigation.ts
var HALF_OPTIONS = [
  { label: "\u4E0D\u9002\u7528\u51CF\u534A", value: "none" },
  { label: "\u9002\u7528\u7B80\u6613\u7A0B\u5E8F\uFF08\u51CF\u534A\u4EA4\u7EB3\uFF09", value: "simple" },
  { label: "\u8C03\u89E3\u7ED3\u6848\u6216\u64A4\u8BC9\uFF08\u51CF\u534A\u4EA4\u7EB3\uFF09", value: "mediate" },
  { label: "\u53CD\u8BC9/\u6709\u72EC\u7ACB\u8BF7\u6C42\u6743\u7B2C\u4E09\u4EBA\uFF08\u51CF\u534A\u4EA4\u7EB3\uFF09", value: "counterclaim" }
];
var COMMON_BASIS = [
  {
    law: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B",
    article: "\u7B2C\u5341\u4E09\u6761",
    text: "\u6848\u4EF6\u53D7\u7406\u8D39\u5206\u522B\u6309\u7167\u8D22\u4EA7\u6848\u4EF6\u4E0E\u975E\u8D22\u4EA7\u6848\u4EF6\u7684\u6807\u51C6\u5206\u6BB5\u7D2F\u8BA1\u4EA4\u7EB3\u3002"
  },
  {
    law: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B",
    article: "\u7B2C\u5341\u516D\u6761",
    text: "\u9002\u7528\u7B80\u6613\u7A0B\u5E8F\u5BA1\u7406\u7684\u6848\u4EF6\u51CF\u534A\u4EA4\u7EB3\u6848\u4EF6\u53D7\u7406\u8D39\u3002"
  },
  {
    law: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B",
    article: "\u7B2C\u5341\u4E94\u6761",
    text: "\u4EE5\u8C03\u89E3\u65B9\u5F0F\u7ED3\u6848\u6216\u8005\u5F53\u4E8B\u4EBA\u7533\u8BF7\u64A4\u8BC9\u7684\uFF0C\u51CF\u534A\u4EA4\u7EB3\u6848\u4EF6\u53D7\u7406\u8D39\u3002"
  }
];
var litigationCalculators = [
  /* ── 财产案件受理费 ── */
  {
    id: "civil-fee",
    name: "\u8D22\u4EA7\u6848\u4EF6\u53D7\u7406\u8D39",
    category: "litigation",
    glyph: "\u8BC9",
    summary: "\u6309\u8BC9\u8BBC\u8BF7\u6C42\u91D1\u989D\u8D85\u989D\u7D2F\u8FDB\u8BA1\u7B97\u4E00\u3001\u4E8C\u5BA1\u6848\u4EF6\u53D7\u7406\u8D39",
    keywords: ["\u53D7\u7406\u8D39", "\u8BC9\u8BBC\u8D39", "\u6807\u7684\u989D", "\u8D22\u4EA7\u6848\u4EF6"],
    fields: [
      {
        key: "amount",
        label: "\u8BC9\u8BBC\u8BF7\u6C42\u91D1\u989D",
        type: "money",
        unit: "\u5143",
        defaultValue: 5e5,
        placeholder: "\u5982 500000",
        hint: "\u4EE5\u8D77\u8BC9\u72B6\u4E3B\u5F20\u7684\u91D1\u94B1\u7ED9\u4ED8\u603B\u989D\u4E3A\u51C6",
        shared: true
      },
      { key: "half", label: "\u51CF\u534A\u60C5\u5F62", type: "select", options: HALF_OPTIONS, defaultValue: "none" },
      {
        key: "instance",
        label: "\u5BA1\u7EA7",
        type: "select",
        defaultValue: "first",
        options: [
          { label: "\u4E00\u5BA1", value: "first" },
          { label: "\u4E8C\u5BA1\uFF08\u4E0A\u8BC9\uFF0C\u6309\u4E00\u5BA1\u6807\u51C6\u4EA4\u7EB3\uFF09", value: "second" }
        ]
      }
    ],
    calc(values) {
      const amount = toNum(values.amount);
      const half = toStr(values.half, "none");
      const instance = toStr(values.instance, "first");
      const { total, lines } = progressive(amount, CIVIL_FEE_TIERS);
      const discounted = half !== "none" ? round(total / 2, 2) : total;
      const steps = lines.map((l) => ({
        label: l.desc,
        value: `${money(l.base)} \xD7 ${l.rateText.replace("\xD7 ", "")} = ${money(l.amount)} \u5143`
      }));
      steps.push({
        label: "\u5206\u6BB5\u7D2F\u8BA1\u5408\u8BA1",
        value: `${money(total)} \u5143`,
        emphasis: true
      });
      if (half !== "none") {
        const reason = half === "simple" ? "\u9002\u7528\u7B80\u6613\u7A0B\u5E8F" : half === "mediate" ? "\u8C03\u89E3\u7ED3\u6848 / \u64A4\u8BC9" : "\u53CD\u8BC9\u6216\u7B2C\u4E09\u4EBA\u63D0\u51FA\u72EC\u7ACB\u8BF7\u6C42";
        steps.push({
          label: `\u51CF\u534A\uFF08${reason}\uFF09`,
          value: `${money(total)} \xF7 2 = ${money(discounted)} \u5143`,
          note: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B\u7B2C\u5341\u4E94\u6761\u3001\u7B2C\u5341\u516D\u6761"
        });
      }
      if (instance === "second") {
        steps.push({
          label: "\u5BA1\u7EA7\u8BF4\u660E",
          value: "\u4E0A\u8BC9\u6848\u4EF6\u53D7\u7406\u8D39\u6309\u4E00\u5BA1\u6807\u51C6\u4EA4\u7EB3",
          note: "\u5BF9\u4E0D\u4E88\u53D7\u7406\u3001\u9A73\u56DE\u8D77\u8BC9\u3001\u7BA1\u8F96\u6743\u5F02\u8BAE\u88C1\u5B9A\u4E0A\u8BC9\u7684\uFF0C\u4E0D\u4EA4\u7EB3\u53D7\u7406\u8D39"
        });
      }
      return {
        main: {
          label: half !== "none" ? "\u5E94\u4EA4\u7EB3\u6848\u4EF6\u53D7\u7406\u8D39\uFF08\u5DF2\u51CF\u534A\uFF09" : "\u5E94\u4EA4\u7EB3\u6848\u4EF6\u53D7\u7406\u8D39",
          value: money(discounted),
          unit: "\u5143",
          sub: moneyToChinese(discounted)
        },
        blocks: [
          { label: "\u539F\u59CB\u6807\u51C6\u91D1\u989D", value: money(total), unit: "\u5143" },
          { label: "\u6709\u6548\u8D39\u7387", value: `${(discounted / Math.max(amount, 1) * 100).toFixed(3)}%`, sub: "\u5360\u6807\u7684\u989D\u6BD4\u4F8B" }
        ],
        steps,
        basis: COMMON_BASIS,
        tips: [
          "\u539F\u544A\u81EA\u63A5\u5230\u7F34\u8D39\u901A\u77E5\u6B21\u65E5\u8D77 7 \u65E5\u5185\u4EA4\u7EB3\uFF1B\u903E\u671F\u6309\u81EA\u52A8\u64A4\u8BC9\u5904\u7406\u3002",
          "\u6848\u4EF6\u5BA1\u7406\u4E2D\u589E\u52A0\u8BC9\u8BBC\u8BF7\u6C42\u91D1\u989D\u7684\uFF0C\u6309\u589E\u52A0\u540E\u7684\u91D1\u989D\u8865\u4EA4\u5DEE\u989D\u3002",
          '\u6807\u7684\u989D\u8DE8\u6863\u65F6\u52A1\u5FC5\u6309"\u5206\u6BB5\u7D2F\u8BA1"\u8BA1\u7B97\uFF0C\u5207\u52FF\u7528\u603B\u989D\u4E58\u5355\u4E00\u8D39\u7387\u3002'
        ]
      };
    }
  },
  /* ── 非财产案件受理费 ── */
  {
    id: "non-property-fee",
    name: "\u975E\u8D22\u4EA7\u6848\u4EF6\u53D7\u7406\u8D39",
    category: "litigation",
    glyph: "\u975E",
    summary: "\u79BB\u5A5A\u3001\u4EBA\u683C\u6743\u3001\u52B3\u52A8\u4E89\u8BAE\u7B49\u975E\u8D22\u4EA7\u6848\u4EF6\u7684\u53D7\u7406\u8D39\u6807\u51C6",
    keywords: ["\u79BB\u5A5A", "\u540D\u8A89\u6743", "\u52B3\u52A8\u4E89\u8BAE", "\u975E\u8D22\u4EA7"],
    fields: [
      {
        key: "caseType",
        label: "\u6848\u4EF6\u7C7B\u578B",
        type: "select",
        defaultValue: "divorce",
        options: [
          { label: "\u79BB\u5A5A\u6848\u4EF6", value: "divorce" },
          { label: "\u4FB5\u5BB3\u4EBA\u683C\u6743\u6848\u4EF6", value: "personality" },
          { label: "\u77E5\u8BC6\u4EA7\u6743\u6C11\u4E8B\u6848\u4EF6\uFF08\u65E0\u4E89\u8BAE\u91D1\u989D\uFF09", value: "ip" },
          { label: "\u52B3\u52A8\u4E89\u8BAE\u6848\u4EF6", value: "labor" },
          { label: "\u5176\u4ED6\u975E\u8D22\u4EA7\u6848\u4EF6", value: "other" }
        ]
      },
      {
        key: "propertyAmount",
        label: "\u6D89\u53CA\u8D22\u4EA7\u4E89\u8BAE\u91D1\u989D",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        hint: "\u79BB\u5A5A\u6848\u4EF6\u4E3A\u5F85\u5206\u5272\u8D22\u4EA7\u603B\u989D\uFF1B\u4EBA\u683C\u6743\u6848\u4EF6\u4E3A\u8D54\u507F\u8BF7\u6C42\u989D",
        visibleWhen: (v) => toStr(v.caseType) === "divorce" || toStr(v.caseType) === "personality"
      },
      {
        key: "ipAmount",
        label: "\u77E5\u8BC6\u4EA7\u6743\u4E89\u8BAE\u91D1\u989D",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        hint: "\u6709\u4E89\u8BAE\u91D1\u989D\u7684\u6309\u8D22\u4EA7\u6848\u4EF6\u6807\u51C6\u4EA4\u7EB3\uFF1B\u65E0\u4E89\u8BAE\u91D1\u989D\u586B 0",
        visibleWhen: (v) => toStr(v.caseType) === "ip"
      }
    ],
    calc(values) {
      const type = toStr(values.caseType, "divorce");
      const pa = toNum(values.propertyAmount);
      const ipa = toNum(values.ipAmount);
      const steps = [];
      let total = 0;
      let mainLabel = "\u5E94\u4EA4\u7EB3\u6848\u4EF6\u53D7\u7406\u8D39";
      if (type === "divorce") {
        total = 200;
        steps.push({ label: "\u57FA\u7840\u53D7\u7406\u8D39", value: "50 ~ 300 \u5143\uFF08\u5404\u7701\u5728\u6B64\u5E45\u5EA6\u5185\u786E\u5B9A\uFF09", note: "\u672C\u5DE5\u5177\u6309\u4E2D\u4F4D\u503C 200 \u5143\u4F30\u7B97" });
        if (pa > 2e5) {
          const extra = round((pa - 2e5) * 5e-3, 2);
          total = round(total + extra, 2);
          steps.push({
            label: "\u8D22\u4EA7\u5206\u5272\u8D85\u8FC7 20 \u4E07\u5143\u90E8\u5206",
            value: `${money(pa - 2e5)} \xD7 0.5% = ${money(extra)} \u5143`
          });
        } else if (pa > 0) {
          steps.push({ label: "\u8D22\u4EA7\u5206\u5272\u672A\u8D85 20 \u4E07\u5143", value: "\u4E0D\u53E6\u884C\u52A0\u6536", note: "\u4ECD\u6309\u4EF6\u6536\u53D6\u57FA\u7840\u53D7\u7406\u8D39" });
        }
        mainLabel = "\u79BB\u5A5A\u6848\u4EF6\u53D7\u7406\u8D39\uFF08\u4F30\u7B97\uFF09";
      } else if (type === "personality") {
        total = 300;
        steps.push({ label: "\u57FA\u7840\u53D7\u7406\u8D39", value: "100 ~ 500 \u5143\uFF08\u5404\u7701\u5728\u6B64\u5E45\u5EA6\u5185\u786E\u5B9A\uFF09", note: "\u672C\u5DE5\u5177\u6309\u4E2D\u4F4D\u503C 300 \u5143\u4F30\u7B97" });
        if (pa > 1e5) {
          const s1 = round(5e4 * 0.01, 2);
          const s2 = round((pa - 1e5) * 5e-3, 2);
          total = round(total + s1 + s2, 2);
          steps.push({ label: "\u635F\u5BB3\u8D54\u507F 5 \u4E07\u201410 \u4E07\u5143\u90E8\u5206", value: `50,000 \xD7 1% = ${money(s1)} \u5143` });
          steps.push({ label: "\u635F\u5BB3\u8D54\u507F\u8D85\u8FC7 10 \u4E07\u5143\u90E8\u5206", value: `${money(pa - 1e5)} \xD7 0.5% = ${money(s2)} \u5143` });
        } else if (pa > 5e4) {
          const s1 = round((pa - 5e4) * 0.01, 2);
          total = round(total + s1, 2);
          steps.push({ label: "\u635F\u5BB3\u8D54\u507F\u8D85\u8FC7 5 \u4E07\u5143\u90E8\u5206", value: `${money(pa - 5e4)} \xD7 1% = ${money(s1)} \u5143` });
        }
        mainLabel = "\u4EBA\u683C\u6743\u6848\u4EF6\u53D7\u7406\u8D39\uFF08\u4F30\u7B97\uFF09";
      } else if (type === "labor") {
        total = 10;
        steps.push({ label: "\u52B3\u52A8\u4E89\u8BAE\u6848\u4EF6", value: "\u6BCF\u4EF6 10 \u5143", note: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B\u7B2C\u5341\u4E09\u6761\u7B2C\uFF08\u56DB\uFF09\u9879" });
        mainLabel = "\u52B3\u52A8\u4E89\u8BAE\u6848\u4EF6\u53D7\u7406\u8D39";
      } else if (type === "ip") {
        if (ipa > 0) {
          const r = progressive(ipa, CIVIL_FEE_TIERS);
          total = r.total;
          steps.push({ label: "\u6709\u4E89\u8BAE\u91D1\u989D\uFF0C\u6309\u8D22\u4EA7\u6848\u4EF6\u6807\u51C6", value: `\u6807\u7684 ${money(ipa)} \u5143 \u2192 ${money(total)} \u5143` });
          r.lines.forEach(
            (l) => steps.push({ label: l.desc, value: `${money(l.base)} ${l.rateText} = ${money(l.amount)} \u5143` })
          );
        } else {
          total = 750;
          steps.push({ label: "\u65E0\u4E89\u8BAE\u91D1\u989D", value: "500 ~ 1000 \u5143\uFF08\u6309\u4E2D\u4F4D\u503C 750 \u5143\u4F30\u7B97\uFF09" });
        }
        mainLabel = "\u77E5\u8BC6\u4EA7\u6743\u6848\u4EF6\u53D7\u7406\u8D39\uFF08\u4F30\u7B97\uFF09";
      } else {
        total = 75;
        steps.push({ label: "\u5176\u4ED6\u975E\u8D22\u4EA7\u6848\u4EF6", value: "50 ~ 100 \u5143\uFF08\u6309\u4E2D\u4F4D\u503C 75 \u5143\u4F30\u7B97\uFF09" });
        mainLabel = "\u5176\u4ED6\u975E\u8D22\u4EA7\u6848\u4EF6\u53D7\u7406\u8D39\uFF08\u4F30\u7B97\uFF09";
      }
      return {
        main: { label: mainLabel, value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        steps,
        basis: [
          {
            law: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u4E09\u6761\u7B2C\uFF08\u4E8C\uFF09\u9879",
            text: "\u975E\u8D22\u4EA7\u6848\u4EF6\u6309\u7167\u4E0B\u5217\u6807\u51C6\u4EA4\u7EB3\uFF1A\u79BB\u5A5A\u6848\u4EF6\u6BCF\u4EF6\u4EA4\u7EB350\u5143\u81F3300\u5143\u3002\u6D89\u53CA\u8D22\u4EA7\u5206\u5272\uFF0C\u8D22\u4EA7\u603B\u989D\u4E0D\u8D85\u8FC720\u4E07\u5143\u7684\uFF0C\u4E0D\u53E6\u884C\u4EA4\u7EB3\uFF1B\u8D85\u8FC720\u4E07\u5143\u7684\u90E8\u5206\uFF0C\u6309\u71670.5%\u4EA4\u7EB3\u3002"
          },
          {
            law: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u4E09\u6761\u7B2C\uFF08\u4E09\uFF09\u9879",
            text: "\u4FB5\u5BB3\u59D3\u540D\u6743\u3001\u540D\u79F0\u6743\u3001\u8096\u50CF\u6743\u3001\u540D\u8A89\u6743\u3001\u8363\u8A89\u6743\u4EE5\u53CA\u5176\u4ED6\u4EBA\u683C\u6743\u7684\u6848\u4EF6\uFF0C\u6BCF\u4EF6\u4EA4\u7EB3100\u5143\u81F3500\u5143\u3002\u6D89\u53CA\u635F\u5BB3\u8D54\u507F\uFF0C\u8D54\u507F\u91D1\u989D\u4E0D\u8D85\u8FC75\u4E07\u5143\u7684\uFF0C\u4E0D\u53E6\u884C\u4EA4\u7EB3\uFF1B\u8D85\u8FC75\u4E07\u5143\u81F310\u4E07\u5143\u7684\u90E8\u5206\uFF0C\u6309\u71671%\u4EA4\u7EB3\uFF1B\u8D85\u8FC710\u4E07\u5143\u7684\u90E8\u5206\uFF0C\u6309\u71670.5%\u4EA4\u7EB3\u3002"
          },
          {
            law: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u4E09\u6761\u7B2C\uFF08\u56DB\uFF09\u9879",
            text: "\u52B3\u52A8\u4E89\u8BAE\u6848\u4EF6\u6BCF\u4EF6\u4EA4\u7EB310\u5143\u3002"
          }
        ],
        tips: [
          "\u6309\u4EF6\u6536\u53D6\u7684\u5177\u4F53\u6570\u989D\u7531\u5404\u7701\u3001\u81EA\u6CBB\u533A\u3001\u76F4\u8F96\u5E02\u4EBA\u6C11\u653F\u5E9C\u5728\u6CD5\u5B9A\u5E45\u5EA6\u5185\u786E\u5B9A\uFF0C\u529E\u7406\u524D\u8BF7\u6838\u5BF9\u5F53\u5730\u6807\u51C6\u3002",
          "\u52B3\u52A8\u4E89\u8BAE\u6848\u4EF6\u6BCF\u4EF6\u4EC5 10 \u5143\uFF0C\u4EF2\u88C1\u9636\u6BB5\u4E0D\u6536\u8D39\uFF0C\u7EF4\u6743\u6210\u672C\u6781\u4F4E\u3002"
        ]
      };
    }
  },
  /* ── 财产保全申请费（法院收） ── */
  {
    id: "preservation-fee",
    name: "\u8D22\u4EA7\u4FDD\u5168\u8D39",
    category: "litigation",
    glyph: "\u4FDD",
    summary: "\u5411\u6CD5\u9662\u7533\u8BF7\u67E5\u5C01\u3001\u6263\u62BC\u3001\u51BB\u7ED3\u5E94\u4EA4\u7684\u4FDD\u5168\u7533\u8BF7\u8D39\uFF0C\u6309\u5B9E\u9645\u4FDD\u5168\u8D22\u4EA7\u6570\u989D\u7D2F\u8FDB\uFF0C5,000 \u5143\u5C01\u9876",
    keywords: ["\u4FDD\u5168\u8D39", "\u4FDD\u5168\u7533\u8BF7\u8D39", "\u67E5\u5C01", "\u51BB\u7ED3", "\u8BC9\u524D\u4FDD\u5168", "\u8BC9\u4E2D\u4FDD\u5168"],
    fields: [
      {
        key: "amount",
        label: "\u8BF7\u6C42\u4FDD\u5168\u7684\u8D22\u4EA7\u6570\u989D",
        type: "money",
        unit: "\u5143",
        defaultValue: 1e6,
        hint: "\u4EE5\u7533\u8BF7\u4FDD\u5168\u7684\u8D22\u4EA7\u4EF7\u503C\u6216\u8BF7\u6C42\u91D1\u989D\u4E3A\u9650",
        shared: true
      },
      {
        key: "type",
        label: "\u4FDD\u5168\u7C7B\u578B",
        type: "select",
        defaultValue: "normal",
        options: [
          { label: "\u4E00\u822C\u8D22\u4EA7\u4FDD\u5168", value: "normal" },
          { label: "\u8BC9\u524D\u884C\u4E3A\u4FDD\u5168\uFF08\u5982\u7981\u4EE4\uFF09", value: "conduct" },
          { label: "\u8BC1\u636E\u4FDD\u5168", value: "evidence" }
        ],
        hint: "\u884C\u4E3A\u4FDD\u5168\u4E0E\u8BC1\u636E\u4FDD\u5168\u65E0\u8D22\u4EA7\u6570\u989D\uFF0C\u5B9E\u52A1\u4E2D\u6309\u4EF6\u6536\u8D39\uFF0C\u4EE5\u6CD5\u9662\u901A\u77E5\u4E3A\u51C6"
      }
    ],
    calc(values) {
      const amount = toNum(values.amount);
      const type = toStr(values.type, "normal");
      const { total, lines } = progressive(amount, PRESERVATION_TIERS);
      const capped = Math.min(total, PRESERVATION_CAP);
      const steps = lines.map((l) => ({
        label: l.desc,
        value: `${money(l.base)} ${l.rateText} = ${money(l.amount)} \u5143`
      }));
      steps.push({ label: "\u5206\u6BB5\u7D2F\u8BA1", value: `${money(total)} \u5143`, emphasis: true });
      if (total > PRESERVATION_CAP) {
        steps.push({
          label: "\u9002\u7528\u5C01\u9876",
          value: `\u8D85\u51FA ${money(PRESERVATION_CAP)} \u5143\uFF0C\u6309 ${money(PRESERVATION_CAP)} \u5143\u4EA4\u7EB3`,
          note: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B\u7B2C\u5341\u56DB\u6761\u7B2C\uFF08\u4E09\uFF09\u9879",
          emphasis: true
        });
        steps.push({
          label: "\u5C01\u9876\u51CF\u8D1F",
          value: `${money(total)} \u2212 ${money(PRESERVATION_CAP)} = \u5C11\u4EA4 ${money(round(total - PRESERVATION_CAP, 2))} \u5143`
        });
      }
      if (type !== "normal") {
        steps.push({
          label: type === "evidence" ? "\u8BC1\u636E\u4FDD\u5168" : "\u884C\u4E3A\u4FDD\u5168",
          value: "\u65E0\u8D22\u4EA7\u6570\u989D\u53EF\u6BD4\uFF0C\u5B9E\u52A1\u4E2D\u6309\u4EF6\u6536\u53D6\uFF0C\u4EE5\u6CD5\u9662\u901A\u77E5\u4E3A\u51C6",
          note: "\u5982\u6CD5\u9662\u6309\u4EF6\u6536\u8D39\uFF0C\u672C\u7ED3\u679C\u4EC5\u4F9B\u53C2\u8003"
        });
      }
      return {
        main: {
          label: "\u4FDD\u5168\u7533\u8BF7\u8D39\uFF08\u6CD5\u9662\uFF09",
          value: money(capped),
          unit: "\u5143",
          sub: moneyToChinese(capped)
        },
        blocks: [
          { label: "\u4FDD\u5168\u8D22\u4EA7\u6570\u989D", value: money(amount), unit: "\u5143" },
          { label: "\u5206\u6BB5\u7D2F\u8BA1\uFF08\u672A\u5C01\u9876\uFF09", value: money(total), unit: "\u5143" },
          {
            label: "\u662F\u5426\u9700\u8981\u62C5\u4FDD",
            value: "\u9700\u8981",
            sub: "\u62C5\u4FDD\u8D39\u7528\u53E6\u8BA1\uFF0C\u89C1\u300C\u8D22\u4EA7\u4FDD\u5168\u62C5\u4FDD\u8D39\u300D"
          }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u56DB\u6761\u7B2C\uFF08\u4E09\uFF09\u9879",
            text: "\u7533\u8BF7\u4FDD\u5168\u63AA\u65BD\u7684\uFF0C\u6839\u636E\u5B9E\u9645\u4FDD\u5168\u7684\u8D22\u4EA7\u6570\u989D\u6309\u7167\u4E0B\u5217\u6807\u51C6\u4EA4\u7EB3\uFF1A\u8D22\u4EA7\u6570\u989D\u4E0D\u8D85\u8FC71000\u5143\u6216\u8005\u4E0D\u6D89\u53CA\u8D22\u4EA7\u6570\u989D\u7684\uFF0C\u6BCF\u4EF6\u4EA4\u7EB330\u5143\uFF1B\u8D85\u8FC71000\u5143\u81F310\u4E07\u5143\u7684\u90E8\u5206\uFF0C\u6309\u71671%\u4EA4\u7EB3\uFF1B\u8D85\u8FC710\u4E07\u5143\u7684\u90E8\u5206\uFF0C\u6309\u71670.5%\u4EA4\u7EB3\u3002\u4F46\u662F\uFF0C\u5F53\u4E8B\u4EBA\u7533\u8BF7\u4FDD\u5168\u63AA\u65BD\u4EA4\u7EB3\u7684\u8D39\u7528\u6700\u591A\u4E0D\u8D85\u8FC75000\u5143\u3002"
          },
          {
            law: "\u300A\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u300B",
            article: "\u7B2C\u4E00\u767E\u96F6\u4E09\u6761",
            text: "\u4EBA\u6C11\u6CD5\u9662\u5BF9\u4E8E\u53EF\u80FD\u56E0\u5F53\u4E8B\u4EBA\u4E00\u65B9\u7684\u884C\u4E3A\u6216\u8005\u5176\u4ED6\u539F\u56E0\uFF0C\u4F7F\u5224\u51B3\u96BE\u4EE5\u6267\u884C\u6216\u8005\u9020\u6210\u5F53\u4E8B\u4EBA\u5176\u4ED6\u635F\u5BB3\u7684\u6848\u4EF6\uFF0C\u6839\u636E\u5BF9\u65B9\u5F53\u4E8B\u4EBA\u7684\u7533\u8BF7\uFF0C\u53EF\u4EE5\u88C1\u5B9A\u5BF9\u5176\u8D22\u4EA7\u8FDB\u884C\u4FDD\u5168\u3001\u8D23\u4EE4\u5176\u4F5C\u51FA\u4E00\u5B9A\u884C\u4E3A\u6216\u8005\u7981\u6B62\u5176\u4F5C\u51FA\u4E00\u5B9A\u884C\u4E3A\uFF1B\u5F53\u4E8B\u4EBA\u6CA1\u6709\u63D0\u51FA\u7533\u8BF7\u7684\uFF0C\u4EBA\u6C11\u6CD5\u9662\u5728\u5FC5\u8981\u65F6\u4E5F\u53EF\u4EE5\u88C1\u5B9A\u91C7\u53D6\u4FDD\u5168\u63AA\u65BD\u3002\u4EBA\u6C11\u6CD5\u9662\u91C7\u53D6\u4FDD\u5168\u63AA\u65BD\uFF0C\u53EF\u4EE5\u8D23\u4EE4\u7533\u8BF7\u4EBA\u63D0\u4F9B\u62C5\u4FDD\uFF0C\u7533\u8BF7\u4EBA\u4E0D\u63D0\u4F9B\u62C5\u4FDD\u7684\uFF0C\u88C1\u5B9A\u9A73\u56DE\u7533\u8BF7\u3002"
          }
        ],
        tips: [
          "\u4FDD\u5168\u7533\u8BF7\u8D39 5,000 \u5143\u5C01\u9876\uFF1A\u6807\u7684\u989D\u8D85\u8FC7\u7EA6 89 \u4E07\u5143\u540E\u5373\u5C01\u9876\uFF0C\u6B64\u540E\u589E\u52A0\u6807\u7684\u989D\u4E0D\u518D\u591A\u4EA4\u7533\u8BF7\u8D39\u3002",
          "\u7533\u8BF7\u8D39\u7531\u7533\u8BF7\u4EBA\u5728\u63D0\u51FA\u7533\u8BF7\u65F6\u9884\u4EA4\uFF0C\u6700\u7EC8\u7531\u8D25\u8BC9\u65B9\u8D1F\u62C5\uFF1B\u90E8\u5206\u64A4\u8BC9\u6216\u4FDD\u5168\u9519\u8BEF\u7684\u60C5\u5F62\u6309\u5B9E\u9645\u60C5\u51B5\u5206\u62C5\u3002",
          "\u8D85\u6807\u7684\u4FDD\u5168\u53EF\u80FD\u88AB\u8BA4\u5B9A\u4E3A\u4FDD\u5168\u9519\u8BEF\uFF0C\u9700\u627F\u62C5\u8D54\u507F\u8D23\u4EFB\uFF0C\u8BF7\u6C42\u4FDD\u5168\u7684\u6570\u989D\u5E94\u4E0E\u503A\u6743\u989D\u76F8\u5F53\u3002",
          "\u4FDD\u5168\u7684\u5B9E\u9645\u6210\u672C\u5927\u5934\u5F80\u5F80\u662F\u62C5\u4FDD\u8D39\u800C\u975E\u7533\u8BF7\u8D39\u2014\u2014\u62C5\u4FDD\u8D39\u8BF7\u7528\u300C\u8D22\u4EA7\u4FDD\u5168\u62C5\u4FDD\u8D39\u300D\u5355\u72EC\u6D4B\u7B97\u3002"
        ]
      };
    }
  },
  /* ── 财产保全担保费（保险公司 / 银行收） ── */
  {
    id: "preservation-guarantee-fee",
    name: "\u8D22\u4EA7\u4FDD\u5168\u62C5\u4FDD\u8D39",
    category: "litigation",
    glyph: "\u62C5",
    summary: "\u6CD5\u9662\u8981\u6C42\u63D0\u4F9B\u62C5\u4FDD\u65F6\uFF0C\u8D2D\u4E70\u4FDD\u5168\u8D23\u4EFB\u4FDD\u9669\u6216\u94F6\u884C\u4FDD\u51FD\u6240\u4ED8\u7684\u8D39\u7528\uFF08\u975E\u6CD5\u9662\u6536\u53D6\uFF09",
    keywords: ["\u4FDD\u5168\u62C5\u4FDD\u8D39", "\u4FDD\u5168\u4FDD\u9669\u8D39", "\u4FDD\u51FD\u8D39", "\u4FDD\u5168\u8D23\u4EFB\u4FDD\u9669", "\u62C5\u4FDD"],
    fields: [
      {
        key: "amount",
        label: "\u9700\u62C5\u4FDD\u7684\u4FDD\u5168\u8D22\u4EA7\u6570\u989D",
        type: "money",
        unit: "\u5143",
        defaultValue: 1e6,
        hint: "\u901A\u5E38\u4E0E\u4FDD\u5168\u8D22\u4EA7\u6570\u989D\u4E00\u81F4\uFF1B\u6CD5\u9662\u964D\u4F4E\u62C5\u4FDD\u6BD4\u4F8B\u65F6\u6309\u6CD5\u9662\u8981\u6C42\u586B",
        shared: true,
        emphasis: true
      },
      {
        key: "guarantee",
        label: "\u62C5\u4FDD\u65B9\u5F0F",
        type: "select",
        defaultValue: "insurance",
        options: [
          { label: "\u4FDD\u9669\u516C\u53F8\u4FDD\u5168\u8D23\u4EFB\u4FDD\u9669\uFF08\u6700\u5E38\u89C1\uFF09", value: "insurance" },
          { label: "\u94F6\u884C\u4FDD\u51FD\uFF08\u9700\u4ED8\u624B\u7EED\u8D39\uFF09", value: "bank" },
          { label: "\u73B0\u91D1\u62C5\u4FDD\uFF08\u5168\u989D\u51BB\u7ED3\uFF0C\u65E0\u8D39\u7528\uFF09", value: "cash" },
          { label: "\u65E0\u9700\u62C5\u4FDD\uFF08\u5982\u6CD5\u9662\u51C6\u8BB8\u514D\u62C5\u4FDD\uFF09", value: "none" }
        ]
      },
      {
        key: "guaranteeRate",
        label: "\u4FDD\u51FD\u8D39\u7387",
        type: "number",
        unit: "\u2030/\u5E74",
        defaultValue: 0.8,
        step: 0.1,
        hint: "\u5E02\u573A\u5E38\u89C1\u533A\u95F4 0.5\u2030\u20141.5\u2030/\u5E74\uFF0C\u6309\u4FDD\u9669\u516C\u53F8\u5B9E\u9645\u62A5\u4EF7\u586B\u5199",
        visibleWhen: (v) => ["insurance", "bank"].includes(toStr(v.guarantee))
      },
      {
        key: "years",
        label: "\u62C5\u4FDD\u671F\u9650",
        type: "number",
        unit: "\u5E74",
        defaultValue: 1,
        step: 0.5,
        hint: "\u8BC9\u524D\u4FDD\u5168 30 \u65E5\u5185\u987B\u8D77\u8BC9\uFF1B\u8BC9\u4E2D\u4FDD\u5168\u4E00\u822C\u81F3\u5224\u51B3\u751F\u6548\uFF0C\u6309\u5B9E\u9645\u9700\u8981\u51FA\u5177\u4FDD\u51FD\u7684\u5E74\u9650\u586B\u5199",
        visibleWhen: (v) => ["insurance", "bank"].includes(toStr(v.guarantee))
      },
      {
        key: "minPremium",
        label: "\u6700\u4F4E\u4FDD\u8D39",
        type: "money",
        unit: "\u5143",
        defaultValue: 500,
        hint: "\u591A\u6570\u4FDD\u9669\u516C\u53F8\u8BBE\u6709\u5355\u7B14\u6700\u4F4E\u4FDD\u8D39\uFF0C\u586B 0 \u8868\u793A\u4E0D\u8BBE\u4E0B\u9650",
        visibleWhen: (v) => ["insurance", "bank"].includes(toStr(v.guarantee))
      },
      {
        key: "lpr",
        label: "\u73B0\u91D1\u62C5\u4FDD\u7684\u8D44\u91D1\u6210\u672C\u5229\u7387",
        type: "percent",
        unit: "%",
        defaultValue: 3.1,
        step: 0.05,
        hint: "\u73B0\u91D1\u88AB\u5168\u989D\u51BB\u7ED3\u7684\u673A\u4F1A\u6210\u672C\uFF0C\u6309\u540C\u671F\u4E00\u5E74\u671F LPR \u4F30\u7B97\uFF1B\u975E\u73B0\u91D1\u62C5\u4FDD\u65F6\u4E0D\u751F\u6548",
        visibleWhen: (v) => toStr(v.guarantee) === "cash"
      }
    ],
    calc(values) {
      const amount = toNum(values.amount);
      const guarantee = toStr(values.guarantee, "insurance");
      const rate = toNum(values.guaranteeRate, 0.8);
      const years = Math.max(0, toNum(values.years, 1));
      const minPremium = toNum(values.minPremium);
      const lpr = toNum(values.lpr, 3.1) / 100;
      const label = guarantee === "bank" ? "\u94F6\u884C\u4FDD\u51FD\u624B\u7EED\u8D39" : "\u4FDD\u5168\u4FDD\u9669\u8D39";
      const steps = [
        { label: "\u9700\u62C5\u4FDD\u7684\u4FDD\u5168\u8D22\u4EA7\u6570\u989D", value: `${money(amount)} \u5143` }
      ];
      if (guarantee === "insurance" || guarantee === "bank") {
        const raw = round(amount * rate * years / 1e3, 2);
        const premium = Math.max(raw, minPremium);
        steps.push({
          label: `${label}\uFF08\u6309 ${rate}\u2030/\u5E74 \xD7 ${years} \u5E74\uFF09`,
          value: `${money(amount)} \xD7 ${rate}\u2030 \xD7 ${years} \u5E74 = ${money(raw)} \u5143`,
          note: "\u8D39\u7387\u4EE5\u627F\u4FDD\u673A\u6784\u5B9E\u9645\u62A5\u4EF7\u4E3A\u51C6"
        });
        if (minPremium > 0 && raw < minPremium) {
          steps.push({
            label: "\u4F4E\u4E8E\u6700\u4F4E\u4FDD\u8D39\uFF0C\u6309\u6700\u4F4E\u4FDD\u8D39\u8BA1\u6536",
            value: `${money(minPremium)} \u5143`,
            emphasis: true
          });
        }
        steps.push({
          label: "\u6298\u7B97\u8D39\u7387",
          value: `\u5360\u4FDD\u5168\u6570\u989D ${round(premium / Math.max(amount, 1) * 100, 3)}%`,
          emphasis: true
        });
        return {
          main: { label, value: money(premium), unit: "\u5143", sub: moneyToChinese(premium) },
          blocks: [
            { label: "\u6309\u8D39\u7387\u8BA1\u7B97", value: money(raw), unit: "\u5143" },
            { label: "\u9700\u62C5\u4FDD\u7684\u4FDD\u5168\u8D22\u4EA7\u6570\u989D", value: money(amount), unit: "\u5143" },
            { label: "\u6298\u7B97\u8D39\u7387", value: `${round(premium / Math.max(amount, 1) * 100, 3)}%`, sub: "\u5360\u4FDD\u5168\u6570\u989D" }
          ],
          steps,
          basis: [
            {
              law: "\u300A\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u300B",
              article: "\u7B2C\u4E00\u767E\u96F6\u4E09\u6761",
              text: "\u4EBA\u6C11\u6CD5\u9662\u91C7\u53D6\u4FDD\u5168\u63AA\u65BD\uFF0C\u53EF\u4EE5\u8D23\u4EE4\u7533\u8BF7\u4EBA\u63D0\u4F9B\u62C5\u4FDD\uFF0C\u7533\u8BF7\u4EBA\u4E0D\u63D0\u4F9B\u62C5\u4FDD\u7684\uFF0C\u88C1\u5B9A\u9A73\u56DE\u7533\u8BF7\u3002"
            },
            {
              law: "\u300A\u6700\u9AD8\u4EBA\u6C11\u6CD5\u9662\u5173\u4E8E\u4EBA\u6C11\u6CD5\u9662\u529E\u7406\u8D22\u4EA7\u4FDD\u5168\u6848\u4EF6\u82E5\u5E72\u95EE\u9898\u7684\u89C4\u5B9A\u300B",
              article: "\u7B2C\u4E94\u6761",
              text: "\u4EBA\u6C11\u6CD5\u9662\u4F9D\u7167\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u7B2C\u4E00\u767E\u6761\u3001\u7B2C\u4E00\u767E\u96F6\u4E00\u6761\u89C4\u5B9A\u8D23\u4EE4\u7533\u8BF7\u4FDD\u5168\u4EBA\u63D0\u4F9B\u8D22\u4EA7\u4FDD\u5168\u62C5\u4FDD\u7684\uFF0C\u62C5\u4FDD\u6570\u989D\u4E0D\u8D85\u8FC7\u8BF7\u6C42\u4FDD\u5168\u6570\u989D\u7684\u767E\u5206\u4E4B\u4E09\u5341\uFF1B\u7533\u8BF7\u4FDD\u5168\u7684\u8D22\u4EA7\u7CFB\u4E89\u8BAE\u6807\u7684\u7684\uFF0C\u62C5\u4FDD\u6570\u989D\u4E0D\u8D85\u8FC7\u4E89\u8BAE\u6807\u7684\u4EF7\u503C\u7684\u767E\u5206\u4E4B\u4E09\u5341\u3002"
            },
            {
              law: "\u300A\u6700\u9AD8\u4EBA\u6C11\u6CD5\u9662\u5173\u4E8E\u4EBA\u6C11\u6CD5\u9662\u529E\u7406\u8D22\u4EA7\u4FDD\u5168\u6848\u4EF6\u82E5\u5E72\u95EE\u9898\u7684\u89C4\u5B9A\u300B",
              article: "\u7B2C\u516B\u6761",
              text: "\u91D1\u878D\u76D1\u7BA1\u90E8\u95E8\u6279\u51C6\u8BBE\u7ACB\u7684\u91D1\u878D\u673A\u6784\u4EE5\u72EC\u7ACB\u4FDD\u51FD\u5F62\u5F0F\u4E3A\u8D22\u4EA7\u4FDD\u5168\u63D0\u4F9B\u62C5\u4FDD\u7684\uFF0C\u4EBA\u6C11\u6CD5\u9662\u5E94\u5F53\u4F9D\u6CD5\u51C6\u8BB8\u3002"
            }
          ],
          tips: [
            "\u62C5\u4FDD\u8D39\u4E0D\u662F\u6CD5\u9662\u6536\u53D6\u7684\u8BC9\u8BBC\u8D39\uFF0C\u800C\u662F\u4ED8\u7ED9\u4FDD\u9669\u516C\u53F8\u6216\u94F6\u884C\u7684\u8D39\u7528\uFF0C\u4E00\u822C\u4E0D\u5217\u5165\u6848\u4EF6\u53D7\u7406\u8D39\u3002",
            "\u62C5\u4FDD\u6570\u989D\u6CD5\u5B9A\u4E0A\u9650\u4E3A\u8BF7\u6C42\u4FDD\u5168\u6570\u989D\u7684 30%\uFF08\u4E89\u8BAE\u6807\u7684\u4E3A\u6807\u7684\u4EF7\u503C\u7684 30%\uFF09\uFF0C\u4FDD\u51FD\u6309\u5B9E\u9645\u62C5\u4FDD\u6570\u989D\u51FA\u5177\u5373\u53EF\uFF0C\u4E0D\u5FC5\u6309\u5168\u989D\u3002",
            "\u4FDD\u5168\u8D23\u4EFB\u4FDD\u9669\u8D39\u5C5E\u4E3A\u5B9E\u73B0\u503A\u6743\u652F\u51FA\u7684\u5408\u7406\u8D39\u7528\uFF0C\u90E8\u5206\u6CD5\u9662\u652F\u6301\u7531\u8D25\u8BC9\u65B9\u8D1F\u62C5\uFF0C\u4F46\u53E3\u5F84\u4E0D\u4E00\uFF0C\u4E3B\u5F20\u65F6\u5E94\u4E00\u5E76\u5217\u5165\u8BC9\u8BBC\u8BF7\u6C42\u3002",
            "\u8BC9\u524D\u4FDD\u5168\u987B\u5728\u91C7\u53D6\u63AA\u65BD\u540E 30 \u65E5\u5185\u8D77\u8BC9\uFF0C\u903E\u671F\u89E3\u9664\u4FDD\u5168\u4E14\u4FDD\u8D39\u4E00\u822C\u4E0D\u9000\uFF0C\u6295\u4FDD\u524D\u5148\u786E\u8BA4\u8D77\u8BC9\u65F6\u70B9\u3002"
          ]
        };
      }
      if (guarantee === "cash") {
        const cost = round(amount * lpr * years, 2);
        steps.push({
          label: "\u73B0\u91D1\u62C5\u4FDD",
          value: `${money(amount)} \u5143\u5168\u989D\u51BB\u7ED3`,
          note: "\u4E0D\u4EA7\u751F\u5916\u90E8\u8D39\u7528\uFF0C\u4F46\u5360\u7528\u8D44\u91D1"
        });
        steps.push({
          label: "\u8D44\u91D1\u5360\u7528\u6210\u672C\uFF08\u673A\u4F1A\u6210\u672C\uFF09",
          value: `${money(amount)} \xD7 ${round(lpr * 100, 2)}% \xD7 ${years} \u5E74 = ${money(cost)} \u5143`,
          note: "\u6309\u540C\u671F LPR \u4F30\u7B97\uFF0C\u975E\u5B9E\u9645\u652F\u51FA",
          emphasis: true
        });
        return {
          main: { label: "\u73B0\u91D1\u62C5\u4FDD\uFF08\u5916\u90E8\u8D39\u7528 0 \u5143\uFF09", value: "0.00", unit: "\u5143", sub: `\u51BB\u7ED3 ${money(amount)} \u5143\uFF0C\u5360\u7528\u6210\u672C\u7EA6 ${money(cost)} \u5143` },
          blocks: [
            { label: "\u51BB\u7ED3\u91D1\u989D", value: money(amount), unit: "\u5143" },
            { label: "\u8D44\u91D1\u5360\u7528\u6210\u672C", value: money(cost), unit: "\u5143", sub: `\u6309 LPR ${round(lpr * 100, 2)}% \u4F30\u7B97` }
          ],
          steps,
          basis: [
            {
              law: "\u300A\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u300B",
              article: "\u7B2C\u4E00\u767E\u96F6\u4E09\u6761",
              text: "\u4EBA\u6C11\u6CD5\u9662\u91C7\u53D6\u4FDD\u5168\u63AA\u65BD\uFF0C\u53EF\u4EE5\u8D23\u4EE4\u7533\u8BF7\u4EBA\u63D0\u4F9B\u62C5\u4FDD\uFF0C\u7533\u8BF7\u4EBA\u4E0D\u63D0\u4F9B\u62C5\u4FDD\u7684\uFF0C\u88C1\u5B9A\u9A73\u56DE\u7533\u8BF7\u3002"
            }
          ],
          tips: [
            "\u73B0\u91D1\u62C5\u4FDD\u4E0D\u4EA7\u751F\u652F\u4ED8\u7ED9\u5916\u90E8\u7684\u8D39\u7528\uFF0C\u4F46\u8D44\u91D1\u88AB\u5168\u989D\u51BB\u7ED3\uFF0C\u673A\u4F1A\u6210\u672C\u5F80\u5F80\u9AD8\u4E8E\u4E70\u4FDD\u51FD\u3002",
            "\u8D44\u91D1\u5360\u7528\u6210\u672C\u6309\u540C\u671F LPR \u4F30\u7B97\uFF0C\u4EC5\u4F5C\u51B3\u7B56\u53C2\u8003\uFF0C\u4E0D\u662F\u5B9E\u9645\u652F\u51FA\u3002",
            "\u73B0\u91D1\u62C5\u4FDD\u89E3\u4FDD\u540E\u53EF\u5168\u989D\u9000\u56DE\uFF0C\u4FDD\u51FD\u8D39\u5219\u4E0D\u4E88\u9000\u8FD8\u3002"
          ]
        };
      }
      steps.push({ label: "\u62C5\u4FDD\u65B9\u5F0F", value: "\u65E0\u9700\u62C5\u4FDD\uFF0C\u4E0D\u4EA7\u751F\u8D39\u7528" });
      return {
        main: { label: "\u62C5\u4FDD\u8D39", value: "0.00", unit: "\u5143", sub: "\u6CD5\u9662\u51C6\u8BB8\u514D\u62C5\u4FDD" },
        blocks: [{ label: "\u9700\u62C5\u4FDD\u7684\u4FDD\u5168\u8D22\u4EA7\u6570\u989D", value: money(amount), unit: "\u5143" }],
        steps,
        basis: [
          {
            law: "\u300A\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u300B",
            article: "\u7B2C\u4E00\u767E\u96F6\u4E09\u6761",
            text: "\u4EBA\u6C11\u6CD5\u9662\u91C7\u53D6\u4FDD\u5168\u63AA\u65BD\uFF0C\u53EF\u4EE5\u8D23\u4EE4\u7533\u8BF7\u4EBA\u63D0\u4F9B\u62C5\u4FDD\u2014\u2014\u5373\u62C5\u4FDD\u5E76\u975E\u4E00\u5F8B\u5F3A\u5236\uFF0C\u6CD5\u9662\u53EF\u88C1\u91CF\u514D\u9664\u3002"
          }
        ],
        tips: ["\u514D\u62C5\u4FDD\u591A\u4E3A\u8FFD\u7D22\u8D61\u517B\u8D39\u3001\u629A\u517B\u8D39\u3001\u629A\u6064\u91D1\u3001\u533B\u7597\u8D39\u7528\u3001\u52B3\u52A8\u62A5\u916C\u7B49\u60C5\u5F62\uFF0C\u662F\u5426\u51C6\u8BB8\u7531\u6CD5\u9662\u88C1\u91CF\u3002"]
      };
    }
  },
  /* ── 执行申请费 ── */
  {
    id: "execution-fee",
    name: "\u6267\u884C\u7533\u8BF7\u8D39",
    category: "litigation",
    glyph: "\u6267",
    summary: "\u6309\u6267\u884C\u91D1\u989D\u8BA1\u7B97\u7533\u8BF7\u5F3A\u5236\u6267\u884C\u5E94\u4EA4\u8D39\u7528\uFF08\u6267\u884C\u540E\u7531\u88AB\u6267\u884C\u4EBA\u8D1F\u62C5\uFF09",
    keywords: ["\u6267\u884C\u8D39", "\u5F3A\u5236\u6267\u884C", "\u7533\u8BF7\u6267\u884C"],
    fields: [
      {
        key: "amount",
        label: "\u7533\u8BF7\u6267\u884C\u91D1\u989D",
        type: "money",
        unit: "\u5143",
        defaultValue: 1e6,
        hint: "\u542B\u672C\u91D1\u3001\u5DF2\u786E\u5B9A\u5229\u606F\u53CA\u8FDF\u5EF6\u5C65\u884C\u5229\u606F"
      },
      {
        key: "hasAmount",
        label: "\u662F\u5426\u6709\u660E\u786E\u6267\u884C\u91D1\u989D",
        type: "switch",
        defaultValue: true,
        hint: "\u884C\u4E3A\u7ED9\u4ED8\u7C7B\u6267\u884C\u65E0\u91D1\u989D\uFF0C\u6309\u4EF6\u6536\u53D6 50\u2014500 \u5143"
      },
      {
        key: "recovered",
        label: "\u9884\u8BA1\u5B9E\u9645\u6267\u884C\u5230\u4F4D\u91D1\u989D",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        hint: "\u7528\u4E8E\u4F30\u7B97\u5B9E\u9645\u56DE\u6536\u7387\uFF0C\u586B 0 \u8868\u793A\u4E0D\u8BA1"
      }
    ],
    calc(values) {
      const hasAmount = values.hasAmount !== false && values.hasAmount !== "false";
      const amount = toNum(values.amount);
      const recovered = toNum(values.recovered);
      const steps = [];
      let total = 0;
      if (hasAmount) {
        const { total: t, lines } = progressive(amount, EXECUTION_TIERS);
        total = t;
        lines.forEach(
          (l) => steps.push({ label: l.desc, value: `${money(l.base)} ${l.rateText} = ${money(l.amount)} \u5143` })
        );
        steps.push({ label: "\u5206\u6BB5\u7D2F\u8BA1\u5408\u8BA1", value: `${money(total)} \u5143`, emphasis: true });
      } else {
        total = 200;
        steps.push({ label: "\u65E0\u6267\u884C\u91D1\u989D", value: "\u6BCF\u4EF6 50 ~ 500 \u5143\uFF08\u6309\u4E2D\u4F4D\u503C 200 \u5143\u4F30\u7B97\uFF09" });
      }
      steps.push({
        label: "\u8D39\u7528\u8D1F\u62C5",
        value: "\u65E0\u9700\u7533\u8BF7\u4EBA\u9884\u4EA4\uFF0C\u6267\u884C\u540E\u7531\u88AB\u6267\u884C\u4EBA\u8D1F\u62C5",
        note: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B\u7B2C\u4E8C\u5341\u6761"
      });
      const blocks = [{ label: "\u7533\u8BF7\u6267\u884C\u91D1\u989D", value: money(amount), unit: "\u5143" }];
      if (recovered > 0) {
        blocks.push({
          label: "\u6263\u9664\u6267\u884C\u8D39\u540E\u5B9E\u5F97",
          value: money(round(recovered - Math.min(total, recovered), 2)),
          unit: "\u5143",
          sub: `\u6267\u884C\u8D39\u7387 ${(total / Math.max(recovered, 1) * 100).toFixed(2)}%`
        });
      }
      return {
        main: { label: "\u6267\u884C\u7533\u8BF7\u8D39", value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        blocks,
        steps,
        basis: [
          {
            law: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u56DB\u6761\u7B2C\uFF08\u4E00\uFF09\u9879",
            text: "\u4F9D\u6CD5\u7533\u8BF7\u6267\u884C\u4EBA\u6C11\u6CD5\u9662\u53D1\u751F\u6CD5\u5F8B\u6548\u529B\u7684\u5224\u51B3\u3001\u88C1\u5B9A\u3001\u8C03\u89E3\u4E66\uFF0C\u4EF2\u88C1\u673A\u6784\u4F9D\u6CD5\u4F5C\u51FA\u7684\u88C1\u51B3\u548C\u8C03\u89E3\u4E66\uFF0C\u516C\u8BC1\u673A\u6784\u4F9D\u6CD5\u8D4B\u4E88\u5F3A\u5236\u6267\u884C\u6548\u529B\u7684\u503A\u6743\u6587\u4E66\uFF0C\u6309\u4E0B\u5217\u6807\u51C6\u4EA4\u7EB3\uFF1A\u6CA1\u6709\u6267\u884C\u91D1\u989D\u6216\u8005\u4EF7\u989D\u7684\uFF0C\u6BCF\u4EF6\u4EA4\u7EB350\u5143\u81F3500\u5143\u3002\u6267\u884C\u91D1\u989D\u6216\u8005\u4EF7\u989D\u4E0D\u8D85\u8FC71\u4E07\u5143\u7684\uFF0C\u6BCF\u4EF6\u4EA4\u7EB350\u5143\uFF1B\u8D85\u8FC71\u4E07\u5143\u81F350\u4E07\u5143\u7684\u90E8\u5206\uFF0C\u6309\u71671.5%\u4EA4\u7EB3\uFF1B\u8D85\u8FC750\u4E07\u5143\u81F3500\u4E07\u5143\u7684\u90E8\u5206\uFF0C\u6309\u71671%\u4EA4\u7EB3\uFF1B\u8D85\u8FC7500\u4E07\u5143\u81F31000\u4E07\u5143\u7684\u90E8\u5206\uFF0C\u6309\u71670.5%\u4EA4\u7EB3\uFF1B\u8D85\u8FC71000\u4E07\u5143\u7684\u90E8\u5206\uFF0C\u6309\u71670.1%\u4EA4\u7EB3\u3002"
          },
          {
            law: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B",
            article: "\u7B2C\u4E8C\u5341\u6761",
            text: "\u6267\u884C\u7533\u8BF7\u8D39\u6267\u884C\u540E\u4EA4\u7EB3\uFF0C\u7531\u88AB\u6267\u884C\u4EBA\u8D1F\u62C5\u3002"
          }
        ],
        tips: [
          '\u6267\u884C\u7533\u8BF7\u8D39\u6700\u5927\u7684\u5B9E\u52A1\u4F18\u52BF\u662F"\u6267\u884C\u540E\u4EA4\u7EB3"\uFF0C\u7533\u8BF7\u4EBA\u65E0\u9700\u57AB\u4ED8\uFF0C\u5927\u5E45\u964D\u4F4E\u7EF4\u6743\u95E8\u69DB\u3002',
          "\u7533\u8BF7\u6267\u884C\u7684\u671F\u95F4\u4E3A\u4E8C\u5E74\uFF0C\u9002\u7528\u8BC9\u8BBC\u65F6\u6548\u4E2D\u6B62\u3001\u4E2D\u65AD\u7684\u89C4\u5B9A\u3002"
        ]
      };
    }
  },
  /* ── 支付令 / 其他申请费 ── */
  {
    id: "application-fee",
    name: "\u652F\u4ED8\u4EE4\u53CA\u5176\u4ED6\u7533\u8BF7\u8D39",
    category: "litigation",
    glyph: "\u7533",
    summary: "\u652F\u4ED8\u4EE4\u3001\u516C\u793A\u50AC\u544A\u3001\u64A4\u9500\u4EF2\u88C1\u88C1\u51B3\u7B49\u7533\u8BF7\u7684\u6536\u8D39\u6807\u51C6",
    keywords: ["\u652F\u4ED8\u4EE4", "\u516C\u793A\u50AC\u544A", "\u4EF2\u88C1", "\u7533\u8BF7\u8D39"],
    fields: [
      {
        key: "appType",
        label: "\u7533\u8BF7\u4E8B\u9879",
        type: "select",
        defaultValue: "payment",
        options: [
          { label: "\u7533\u8BF7\u652F\u4ED8\u4EE4", value: "payment" },
          { label: "\u7533\u8BF7\u516C\u793A\u50AC\u544A", value: "public" },
          { label: "\u7533\u8BF7\u64A4\u9500\u4EF2\u88C1\u88C1\u51B3 / \u8BA4\u5B9A\u4EF2\u88C1\u534F\u8BAE\u6548\u529B", value: "arbitration" },
          { label: "\u7533\u8BF7\u627F\u8BA4\u4E0E\u6267\u884C\u5916\u56FD\u5224\u51B3\u3001\u4EF2\u88C1\u88C1\u51B3", value: "foreign" },
          { label: "\u7533\u8BF7\u7834\u4EA7", value: "bankruptcy" }
        ]
      },
      {
        key: "amount",
        label: "\u6D89\u53CA\u91D1\u989D",
        type: "money",
        unit: "\u5143",
        defaultValue: 2e5,
        hint: "\u652F\u4ED8\u4EE4\u6309\u8D22\u4EA7\u6848\u4EF6\u6807\u51C6\u7684 1/3\uFF1B\u7834\u4EA7\u6309\u8D22\u4EA7\u603B\u989D\u51CF\u534A\uFF0C30 \u4E07\u5C01\u9876",
        visibleWhen: (v) => ["payment", "bankruptcy"].includes(toStr(v.appType))
      }
    ],
    calc(values) {
      const t = toStr(values.appType, "payment");
      const amount = toNum(values.amount);
      const steps = [];
      let total = 0;
      let label = "";
      if (t === "payment") {
        const { total: full } = progressive(amount, CIVIL_FEE_TIERS);
        total = round(full / 3, 2);
        label = "\u652F\u4ED8\u4EE4\u7533\u8BF7\u8D39";
        steps.push({ label: "\u6BD4\u7167\u8D22\u4EA7\u6848\u4EF6\u53D7\u7406\u8D39", value: `\u6807\u51C6\u8D39\u7528 ${money(full)} \u5143` });
        steps.push({ label: "\u6309\u4E09\u5206\u4E4B\u4E00\u4EA4\u7EB3", value: `${money(full)} \xF7 3 = ${money(total)} \u5143`, emphasis: true });
      } else if (t === "public") {
        total = 100;
        label = "\u516C\u793A\u50AC\u544A\u7533\u8BF7\u8D39";
        steps.push({ label: "\u6309\u4EF6\u6536\u53D6", value: "\u6BCF\u4EF6 100 \u5143" });
      } else if (t === "arbitration") {
        total = 400;
        label = "\u7533\u8BF7\u64A4\u9500\u4EF2\u88C1\u88C1\u51B3 / \u8BA4\u5B9A\u4EF2\u88C1\u534F\u8BAE\u6548\u529B";
        steps.push({ label: "\u6309\u4EF6\u6536\u53D6", value: "\u6BCF\u4EF6 400 \u5143", note: "\u7533\u8BF7\u8BA4\u5B9A\u4EF2\u88C1\u534F\u8BAE\u6548\u529B\u540C\u6837\u4E3A\u6BCF\u4EF6 400 \u5143" });
      } else if (t === "foreign") {
        total = 500;
        label = "\u627F\u8BA4\u4E0E\u6267\u884C\u5916\u56FD\u5224\u51B3\u3001\u4EF2\u88C1\u88C1\u51B3";
        steps.push({ label: "\u6309\u4EF6\u6536\u53D6", value: "\u6BCF\u4EF6 500 \u5143" });
      } else {
        const { total: full } = progressive(amount, CIVIL_FEE_TIERS);
        const half = round(full / 2, 2);
        total = Math.min(half, BANKRUPTCY_CAP);
        label = "\u7834\u4EA7\u6848\u4EF6\u7533\u8BF7\u8D39";
        steps.push({ label: "\u6309\u8D22\u4EA7\u6848\u4EF6\u53D7\u7406\u8D39\u6807\u51C6", value: `${money(full)} \u5143` });
        steps.push({ label: "\u51CF\u534A\u4EA4\u7EB3", value: `${money(full)} \xF7 2 = ${money(half)} \u5143` });
        if (half > BANKRUPTCY_CAP) {
          steps.push({ label: "\u9002\u7528 30 \u4E07\u5143\u5C01\u9876", value: `\u6309 ${money(BANKRUPTCY_CAP)} \u5143\u4EA4\u7EB3`, emphasis: true });
        }
      }
      return {
        main: { label, value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        steps,
        basis: [
          {
            law: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u56DB\u6761",
            text: "\u7533\u8BF7\u8D39\u5206\u522B\u6309\u7167\u4E0B\u5217\u6807\u51C6\u4EA4\u7EB3\uFF1A\u4F9D\u6CD5\u7533\u8BF7\u652F\u4ED8\u4EE4\u7684\uFF0C\u6BD4\u7167\u8D22\u4EA7\u6848\u4EF6\u53D7\u7406\u8D39\u6807\u51C6\u7684\u4E09\u5206\u4E4B\u4E00\u4EA4\u7EB3\uFF1B\u4F9D\u6CD5\u7533\u8BF7\u516C\u793A\u50AC\u544A\u7684\uFF0C\u6BCF\u4EF6\u4EA4\u7EB3100\u5143\uFF1B\u7533\u8BF7\u64A4\u9500\u4EF2\u88C1\u88C1\u51B3\u6216\u8005\u8BA4\u5B9A\u4EF2\u88C1\u534F\u8BAE\u6548\u529B\u7684\uFF0C\u6BCF\u4EF6\u4EA4\u7EB3400\u5143\uFF1B\u7533\u8BF7\u627F\u8BA4\u548C\u6267\u884C\u5916\u56FD\u5224\u51B3\u3001\u4EF2\u88C1\u88C1\u51B3\u7684\uFF0C\u6BCF\u4EF6\u4EA4\u7EB3500\u5143\u3002\u7834\u4EA7\u6848\u4EF6\u4F9D\u636E\u7834\u4EA7\u8D22\u4EA7\u603B\u989D\u8BA1\u7B97\uFF0C\u6309\u7167\u8D22\u4EA7\u6848\u4EF6\u53D7\u7406\u8D39\u6807\u51C6\u51CF\u534A\u4EA4\u7EB3\uFF0C\u4F46\u662F\u6700\u9AD8\u4E0D\u8D85\u8FC730\u4E07\u5143\u3002"
          }
        ],
        tips: [
          "\u652F\u4ED8\u4EE4\u662F\u975E\u8BC9\u50AC\u6B3E\u7684\u4F4E\u6210\u672C\u8DEF\u5F84\uFF1A\u8D39\u7528\u4EC5\u4E3A\u666E\u901A\u8BC9\u8BBC\u7684 1/3\uFF0C\u4E14\u65E0\u9700\u5F00\u5EAD\u3002",
          "\u652F\u4ED8\u4EE4\u53D1\u51FA\u540E\uFF0C\u503A\u52A1\u4EBA 15 \u65E5\u5185\u63D0\u51FA\u4E66\u9762\u5F02\u8BAE\u5373\u5931\u6548\uFF0C\u8F6C\u4E3A\u8BC9\u8BBC\u7A0B\u5E8F\uFF0C\u9002\u5408\u503A\u6743\u503A\u52A1\u5173\u7CFB\u6E05\u6670\u65E0\u4E89\u8BAE\u7684\u6848\u4EF6\u3002"
        ]
      };
    }
  },
  /* ── 律师费 ── */
  {
    id: "lawyer-fee",
    name: "\u5F8B\u5E08\u670D\u52A1\u8D39",
    category: "litigation",
    glyph: "\u5F8B",
    summary: "\u8BA1\u4EF6\u3001\u6309\u6807\u7684\u989D\u6BD4\u4F8B\u3001\u8BA1\u65F6\u4E0E\u98CE\u9669\u4EE3\u7406\u56DB\u79CD\u8BA1\u8D39\u65B9\u5F0F\u6D4B\u7B97",
    keywords: ["\u5F8B\u5E08\u8D39", "\u98CE\u9669\u4EE3\u7406", "\u8BA1\u65F6\u6536\u8D39", "\u4EE3\u7406\u8D39"],
    fields: [
      {
        key: "mode",
        label: "\u8BA1\u8D39\u65B9\u5F0F",
        type: "select",
        defaultValue: "proportion",
        options: [
          { label: "\u6309\u6807\u7684\u989D\u6BD4\u4F8B", value: "proportion" },
          { label: "\u8BA1\u4EF6\u6536\u8D39", value: "fixed" },
          { label: "\u8BA1\u65F6\u6536\u8D39", value: "hourly" },
          { label: "\u98CE\u9669\u4EE3\u7406", value: "contingency" }
        ]
      },
      {
        key: "amount",
        label: "\u4E89\u8BAE\u6807\u7684\u989D",
        emphasis: true,
        type: "money",
        unit: "\u5143",
        defaultValue: 1e6,
        visibleWhen: (v) => ["proportion", "contingency"].includes(toStr(v.mode))
      },
      {
        key: "rate",
        label: "\u7EA6\u5B9A\u8D39\u7387",
        type: "percent",
        unit: "%",
        defaultValue: 5,
        hint: "\u5E38\u89C4\u4EE3\u7406\u5E38\u89C1\u533A\u95F4 3%\u20148%\uFF0C\u5404\u5730\u6307\u5BFC\u4EF7\u4E0D\u540C",
        visibleWhen: (v) => toStr(v.mode) === "proportion"
      },
      {
        key: "minFee",
        label: "\u6700\u4F4E\u6536\u8D39",
        type: "money",
        unit: "\u5143",
        defaultValue: 5e3,
        visibleWhen: (v) => toStr(v.mode) === "proportion"
      },
      {
        key: "fixedFee",
        label: "\u6BCF\u4EF6\u6536\u8D39",
        type: "money",
        unit: "\u5143",
        defaultValue: 3e4,
        visibleWhen: (v) => toStr(v.mode) === "fixed"
      },
      {
        key: "hours",
        label: "\u9884\u8BA1\u5DE5\u4F5C\u5C0F\u65F6",
        type: "number",
        unit: "\u5C0F\u65F6",
        defaultValue: 60,
        visibleWhen: (v) => toStr(v.mode) === "hourly"
      },
      {
        key: "hourlyRate",
        label: "\u5C0F\u65F6\u8D39\u7387",
        type: "money",
        unit: "\u5143/\u5C0F\u65F6",
        defaultValue: 2e3,
        visibleWhen: (v) => toStr(v.mode) === "hourly"
      },
      {
        key: "baseFee",
        label: "\u57FA\u7840\u4EE3\u7406\u8D39\uFF08\u9884\u4ED8\uFF09",
        type: "money",
        unit: "\u5143",
        defaultValue: 2e4,
        visibleWhen: (v) => toStr(v.mode) === "contingency"
      },
      {
        key: "contingencyRate",
        label: "\u98CE\u9669\u4EE3\u7406\u63D0\u6210\u6BD4\u4F8B",
        type: "percent",
        unit: "%",
        defaultValue: 15,
        hint: "\u6CD5\u5B9A\u4E0A\u9650\u4E3A\u6807\u7684\u989D\u7684 30%",
        visibleWhen: (v) => toStr(v.mode) === "contingency"
      },
      {
        key: "recoveryRate",
        label: "\u9884\u8BA1\u56DE\u6B3E\u7387",
        type: "percent",
        unit: "%",
        defaultValue: 80,
        visibleWhen: (v) => toStr(v.mode) === "contingency"
      }
    ],
    calc(values) {
      const mode = toStr(values.mode, "proportion");
      const amount = toNum(values.amount);
      const steps = [];
      let total = 0;
      let mainLabel = "\u5F8B\u5E08\u670D\u52A1\u8D39";
      let blocks = [];
      if (mode === "proportion") {
        const rate = toNum(values.rate) / 100;
        const minFee = toNum(values.minFee);
        const raw = round(amount * rate, 2);
        total = Math.max(raw, minFee);
        mainLabel = "\u5F8B\u5E08\u8D39\uFF08\u6309\u6807\u7684\u989D\u6BD4\u4F8B\uFF09";
        steps.push({ label: "\u6807\u7684\u989D \xD7 \u8D39\u7387", value: `${money(amount)} \xD7 ${toNum(values.rate)}% = ${money(raw)} \u5143` });
        if (raw < minFee) {
          steps.push({ label: "\u4F4E\u4E8E\u6700\u4F4E\u6536\u8D39\uFF0C\u6309\u6700\u4F4E\u6536\u8D39", value: `${money(minFee)} \u5143`, emphasis: true });
        }
        blocks = [{ label: "\u6709\u6548\u8D39\u7387", value: `${(total / Math.max(amount, 1) * 100).toFixed(2)}%` }];
      } else if (mode === "fixed") {
        total = toNum(values.fixedFee);
        mainLabel = "\u5F8B\u5E08\u8D39\uFF08\u8BA1\u4EF6\uFF09";
        steps.push({ label: "\u6BCF\u4EF6\u56FA\u5B9A\u6536\u8D39", value: `${money(total)} \u5143` });
      } else if (mode === "hourly") {
        const h = toNum(values.hours);
        const r = toNum(values.hourlyRate);
        total = round(h * r, 2);
        mainLabel = "\u5F8B\u5E08\u8D39\uFF08\u8BA1\u65F6\uFF09";
        steps.push({ label: "\u5DE5\u4F5C\u5C0F\u65F6 \xD7 \u5C0F\u65F6\u8D39\u7387", value: `${h} \u5C0F\u65F6 \xD7 ${money(r)} \u5143 = ${money(total)} \u5143` });
        blocks = [{ label: "\u6298\u5408\u5DE5\u4F5C\u65E5", value: `${(h / 8).toFixed(1)} \u5929`, sub: "\u6309 8 \u5C0F\u65F6/\u5DE5\u4F5C\u65E5" }];
      } else {
        const base = toNum(values.baseFee);
        const cr = toNum(values.contingencyRate) / 100;
        const recovery = amount * (toNum(values.recoveryRate) / 100);
        const contingent = round(recovery * cr, 2);
        total = round(base + contingent, 2);
        mainLabel = "\u5F8B\u5E08\u8D39\uFF08\u98CE\u9669\u4EE3\u7406\uFF09";
        steps.push({ label: "\u9884\u8BA1\u56DE\u6B3E", value: `${money(amount)} \xD7 ${toNum(values.recoveryRate)}% = ${money(recovery)} \u5143` });
        steps.push({ label: "\u98CE\u9669\u63D0\u6210", value: `${money(recovery)} \xD7 ${toNum(values.contingencyRate)}% = ${money(contingent)} \u5143` });
        steps.push({ label: "\u5408\u8BA1\uFF08\u57FA\u7840\u8D39 + \u63D0\u6210\uFF09", value: `${money(base)} + ${money(contingent)} = ${money(total)} \u5143`, emphasis: true });
        const cap = round(amount * 0.3, 2);
        const share = round(total / Math.max(recovery, 1) * 100, 2);
        blocks = [
          { label: "\u6CD5\u5B9A\u4E0A\u9650\uFF08\u6807\u7684\u989D 30%\uFF09", value: money(cap), unit: "\u5143", sub: total > cap ? "\u26A0 \u5DF2\u8D85\u51FA\u4E0A\u9650" : "\u672A\u8D85\u4E0A\u9650" },
          { label: "\u5360\u5B9E\u9645\u56DE\u6B3E\u6BD4\u4F8B", value: `${share}%` }
        ];
      }
      return {
        main: { label: mainLabel, value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        blocks,
        steps,
        basis: [
          {
            law: "\u300A\u5F8B\u5E08\u670D\u52A1\u6536\u8D39\u7BA1\u7406\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u4E09\u6761",
            text: "\u5B9E\u884C\u98CE\u9669\u4EE3\u7406\u6536\u8D39\uFF0C\u5F8B\u5E08\u4E8B\u52A1\u6240\u5E94\u5F53\u4E0E\u59D4\u6258\u4EBA\u7B7E\u8BA2\u98CE\u9669\u4EE3\u7406\u6536\u8D39\u5408\u540C\uFF0C\u7EA6\u5B9A\u53CC\u65B9\u5E94\u627F\u62C5\u7684\u98CE\u9669\u8D23\u4EFB\u3001\u6536\u8D39\u65B9\u5F0F\u3001\u6536\u8D39\u6570\u989D\u6216\u6BD4\u4F8B\u3002\u5B9E\u884C\u98CE\u9669\u4EE3\u7406\u6536\u8D39\uFF0C\u6700\u9AD8\u6536\u8D39\u91D1\u989D\u4E0D\u5F97\u9AD8\u4E8E\u6536\u8D39\u5408\u540C\u7EA6\u5B9A\u6807\u7684\u989D\u768430%\u3002"
          },
          {
            law: "\u300A\u5F8B\u5E08\u670D\u52A1\u6536\u8D39\u7BA1\u7406\u529E\u6CD5\u300B",
            article: "\u7B2C\u56DB\u6761",
            text: "\u5F8B\u5E08\u670D\u52A1\u6536\u8D39\u5B9E\u884C\u653F\u5E9C\u6307\u5BFC\u4EF7\u548C\u5E02\u573A\u8C03\u8282\u4EF7\u3002"
          }
        ],
        tips: [
          "\u4E0B\u5217\u6848\u4EF6\u4E0D\u5F97\u5B9E\u884C\u98CE\u9669\u4EE3\u7406\uFF1A\u5A5A\u59FB\u7EE7\u627F\u3001\u8BF7\u6C42\u793E\u4FDD\u5F85\u9047\u3001\u8D61\u517B\u629A\u517B\u629A\u517B\u3001\u8BF7\u6C42\u652F\u4ED8\u52B3\u52A8\u62A5\u916C\u3001\u5211\u4E8B\u8BC9\u8BBC\u3001\u884C\u653F\u8BC9\u8BBC\u3001\u56FD\u5BB6\u8D54\u507F\u3001\u7FA4\u4F53\u6027\u8BC9\u8BBC\u7B49\u3002",
          '\u98CE\u9669\u4EE3\u7406 30% \u7684\u4E0A\u9650\u4EE5"\u5408\u540C\u7EA6\u5B9A\u6807\u7684\u989D"\u4E3A\u57FA\u6570\uFF0C\u4E0D\u662F\u4EE5\u5B9E\u9645\u56DE\u6B3E\u4E3A\u57FA\u6570\uFF0C\u7B7E\u7EA6\u65F6\u5E94\u660E\u786E\u8868\u8FF0\u3002',
          "\u5F8B\u5E08\u8D39\u7531\u8D25\u8BC9\u65B9\u627F\u62C5\u9700\u4EE5\u5408\u540C\u7EA6\u5B9A\u6216\u6CD5\u5F8B\u7279\u522B\u89C4\u5B9A\u4E3A\u524D\u63D0\uFF08\u5982\u77E5\u8BC6\u4EA7\u6743\u3001\u4E0D\u6B63\u5F53\u7ADE\u4E89\u6848\u4EF6\uFF09\u3002"
        ]
      };
    }
  },
  /* ── 诉讼成本总览 ── */
  {
    id: "litigation-total",
    name: "\u8BC9\u8BBC\u6210\u672C\u603B\u89C8",
    category: "litigation",
    glyph: "\u603B",
    summary: "\u4E00\u6B21\u6027\u6C47\u603B\u53D7\u7406\u8D39\u3001\u4FDD\u5168\u8D39\u4E0E\u4FDD\u5168\u62C5\u4FDD\u8D39\u3001\u5F8B\u5E08\u8D39\u4E0E\u516C\u544A\u8D39\u3001\u516C\u8BC1\u8D39\u3001\u9274\u5B9A\u8D39\u3001\u8BC4\u4F30\u8D39\u7B49\u5168\u90E8\u6295\u5165",
    keywords: ["\u8BC9\u8BBC\u6210\u672C", "\u603B\u6210\u672C", "\u8D77\u8BC9\u9884\u7B97", "\u516C\u544A\u8D39", "\u516C\u8BC1\u8D39", "\u9274\u5B9A\u8D39", "\u8BC4\u4F30\u8D39"],
    fields: [
      { key: "amount", label: "\u4E89\u8BAE\u6807\u7684\u989D", type: "money", unit: "\u5143", emphasis: true, defaultValue: 2e6 },
      { key: "lawyerFee", label: "\u5F8B\u5E08\u8D39", type: "money", unit: "\u5143", defaultValue: 1e5 },
      { key: "preserve", label: "\u662F\u5426\u7533\u8BF7\u8D22\u4EA7\u4FDD\u5168", type: "switch", defaultValue: true },
      {
        key: "preserveAmount",
        label: "\u4FDD\u5168\u8D22\u4EA7\u6570\u989D",
        type: "money",
        unit: "\u5143",
        defaultValue: 2e6,
        visibleWhen: (v) => v.preserve === true || v.preserve === "true"
      },
      {
        key: "guarantee",
        label: "\u4FDD\u5168\u62C5\u4FDD\u65B9\u5F0F",
        type: "select",
        defaultValue: "insurance",
        options: [
          { label: "\u4FDD\u9669\u516C\u53F8\u4FDD\u51FD", value: "insurance" },
          { label: "\u73B0\u91D1\u62C5\u4FDD\uFF08\u5168\u989D\u51BB\u7ED3\uFF09", value: "cash" },
          { label: "\u94F6\u884C\u4FDD\u51FD", value: "bank" },
          { label: "\u65E0\u9700\u62C5\u4FDD", value: "none" }
        ],
        visibleWhen: (v) => v.preserve === true || v.preserve === "true"
      },
      {
        key: "guaranteeRate",
        label: "\u4FDD\u51FD\u8D39\u7387",
        type: "number",
        unit: "\u2030/\u5E74",
        defaultValue: 0.8,
        step: 0.1,
        hint: "\u5E02\u573A\u5E38\u89C1 0.5\u2030\u20141.5\u2030/\u5E74\uFF0C\u6309\u4FDD\u9669\u516C\u53F8\u5B9E\u9645\u62A5\u4EF7\u586B\u5199",
        visibleWhen: (v) => (v.preserve === true || v.preserve === "true") && toStr(v.guarantee) !== "cash" && toStr(v.guarantee) !== "none"
      },
      {
        key: "minPremium",
        label: "\u4FDD\u51FD\u6700\u4F4E\u4FDD\u8D39",
        type: "money",
        unit: "\u5143",
        defaultValue: 500,
        hint: "\u591A\u6570\u4FDD\u9669\u516C\u53F8\u8BBE\u5355\u7B14\u6700\u4F4E\u4FDD\u8D39\uFF0C\u586B 0 \u8868\u793A\u4E0D\u8BBE\u4E0B\u9650",
        visibleWhen: (v) => (v.preserve === true || v.preserve === "true") && toStr(v.guarantee) !== "cash" && toStr(v.guarantee) !== "none"
      },
      {
        key: "announcementFee",
        label: "\u516C\u544A\u8D39",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        hint: "\u9001\u8FBE\u3001\u5F00\u5EAD\u3001\u6267\u884C\u3001\u7834\u4EA7\u7B49\u516C\u544A\u7684\u520A\u767B\u8D39\uFF0C\u6309\u5B9E\u9645\u6B21\u6570 \xD7 \u5355\u4EF7\u586B",
        group: "\u5176\u4ED6\u8BC9\u8BBC\u8D39\u7528"
      },
      {
        key: "notarizationFee",
        label: "\u516C\u8BC1\u8D39",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        hint: "\u5F3A\u5236\u6267\u884C\u516C\u8BC1\u3001\u7EE7\u627F\u8D60\u4E0E\u3001\u4FDD\u5168\u8BC1\u636E\u7B49\u516C\u8BC1\u4E8B\u9879\u8D39\u7528",
        group: "\u5176\u4ED6\u8BC9\u8BBC\u8D39\u7528"
      },
      {
        key: "appraisalFee",
        label: "\u9274\u5B9A\u8D39",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        hint: "\u7B14\u8FF9\u3001\u533B\u7597\u635F\u5BB3\u3001\u5DE5\u7A0B\u9020\u4EF7\u3001\u53F8\u6CD5\u4F1A\u8BA1\u7B49\u53F8\u6CD5\u9274\u5B9A\u8D39\u7528",
        group: "\u5176\u4ED6\u8BC9\u8BBC\u8D39\u7528"
      },
      {
        key: "valuationFee",
        label: "\u8BC4\u4F30\u8D39",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        hint: "\u8D44\u4EA7\u8BC4\u4F30\u3001\u623F\u5730\u4EA7\u4F30\u4EF7\u3001\u571F\u5730\u4F30\u4EF7\u8D39\u7528",
        group: "\u5176\u4ED6\u8BC9\u8BBC\u8D39\u7528"
      },
      {
        key: "winRate",
        label: "\u9884\u4F30\u80DC\u8BC9\u53CA\u6267\u884C\u5230\u4F4D\u7387",
        type: "percent",
        unit: "%",
        defaultValue: 60
      }
    ],
    calc(values) {
      const amount = toNum(values.amount);
      const lawyerFee = toNum(values.lawyerFee);
      const preserve = values.preserve === true || values.preserve === "true";
      const preserveAmount = toNum(values.preserveAmount);
      const guarantee = toStr(values.guarantee, "insurance");
      const gr = toNum(values.guaranteeRate) / 1e3;
      const minPremium = toNum(values.minPremium);
      const announcementFee = toNum(values.announcementFee);
      const notarizationFee = toNum(values.notarizationFee);
      const appraisalFee = toNum(values.appraisalFee, toNum(values.appraisal));
      const valuationFee = toNum(values.valuationFee);
      const otherFee = round(announcementFee + notarizationFee + appraisalFee + valuationFee, 2);
      const winRate = toNum(values.winRate) / 100;
      const { total: acceptFee } = progressive(amount, CIVIL_FEE_TIERS);
      const steps = [
        { label: "\u6848\u4EF6\u53D7\u7406\u8D39", value: `${money(acceptFee)} \u5143`, note: `\u6807\u7684\u989D ${money(amount)} \u5143\u5206\u6BB5\u7D2F\u8BA1` },
        { label: "\u5F8B\u5E08\u8D39", value: `${money(lawyerFee)} \u5143` }
      ];
      let preserveFee = 0;
      if (preserve) {
        const p = progressive(preserveAmount, PRESERVATION_TIERS);
        preserveFee = Math.min(p.total, PRESERVATION_CAP);
        steps.push({ label: "\u4FDD\u5168\u7533\u8BF7\u8D39", value: `${money(preserveFee)} \u5143`, note: "5,000 \u5143\u5C01\u9876" });
        let gCost = 0;
        if (guarantee === "cash") {
          gCost = 0;
          steps.push({
            label: "\u73B0\u91D1\u62C5\u4FDD",
            value: `${money(preserveAmount)} \u5143\u5168\u989D\u51BB\u7ED3`,
            note: "\u4E0D\u4EA7\u751F\u8D39\u7528\u4F46\u5168\u989D\u51BB\u7ED3\uFF0C\u673A\u4F1A\u6210\u672C\u6309\u540C\u671F LPR \u4F30\u7B97"
          });
        } else if (guarantee !== "none") {
          const rawPremium = round(preserveAmount * gr, 2);
          gCost = Math.max(rawPremium, minPremium);
          steps.push({
            label: guarantee === "bank" ? "\u94F6\u884C\u4FDD\u51FD\u624B\u7EED\u8D39" : "\u4FDD\u5168\u4FDD\u9669\u8D39",
            value: `${money(preserveAmount)} \xD7 ${toNum(values.guaranteeRate)}\u2030 = ${money(rawPremium)} \u5143${gCost > rawPremium ? `\uFF0C\u4F4E\u4E8E\u6700\u4F4E\u4FDD\u8D39\uFF0C\u6309 ${money(minPremium)} \u5143\u8BA1\u6536` : ""}`
          });
        }
        preserveFee = round(preserveFee + gCost, 2);
      }
      if (announcementFee > 0) steps.push({ label: "\u516C\u544A\u8D39", value: `${money(announcementFee)} \u5143`, note: "\u7531\u5F53\u4E8B\u4EBA\u76F4\u63A5\u652F\u4ED8\u7ED9\u6CD5\u9662\u6307\u5B9A\u5A92\u4F53" });
      if (notarizationFee > 0) steps.push({ label: "\u516C\u8BC1\u8D39", value: `${money(notarizationFee)} \u5143` });
      if (appraisalFee > 0) steps.push({ label: "\u9274\u5B9A\u8D39", value: `${money(appraisalFee)} \u5143` });
      if (valuationFee > 0) steps.push({ label: "\u8BC4\u4F30\u8D39", value: `${money(valuationFee)} \u5143` });
      if (otherFee > 0) {
        steps.push({
          label: "\u5176\u4ED6\u8BC9\u8BBC\u8D39\u7528\u5C0F\u8BA1",
          value: `${money(otherFee)} \u5143`,
          emphasis: true,
          note: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B\u7B2C\u5341\u4E8C\u6761\uFF1A\u7531\u5F53\u4E8B\u4EBA\u76F4\u63A5\u652F\u4ED8\uFF0C\u6CD5\u9662\u4E0D\u4EE3\u6536\u4EE3\u4ED8"
        });
      }
      const total = round(acceptFee + lawyerFee + preserveFee + otherFee, 2);
      steps.push({ label: "\u524D\u671F\u6295\u5165\u5408\u8BA1", value: `${money(total)} \u5143`, emphasis: true });
      const expected = round(amount * winRate, 2);
      const net = round(expected - total, 2);
      const roi = round(net / Math.max(total, 1) * 100, 2);
      steps.push({
        label: "\u9884\u671F\u56DE\u6536",
        value: `${money(amount)} \xD7 ${toNum(values.winRate)}% = ${money(expected)} \u5143`
      });
      steps.push({
        label: "\u6295\u5165\u4EA7\u51FA\u6BD4",
        value: `\u51C0\u6536\u76CA ${money(net)} \u5143 / \u6295\u5165 ${money(total)} \u5143 = ${roi}%`,
        emphasis: true,
        note: net < 0 ? "\u26A0 \u9884\u671F\u4E8F\u635F\uFF0C\u5EFA\u8BAE\u4F18\u5148\u8003\u8651\u8C03\u89E3\u6216\u503A\u6743\u8F6C\u8BA9" : "\u9884\u671F\u4E3A\u6B63\uFF0C\u5177\u5907\u8BC9\u8BBC\u7ECF\u6D4E\u6027"
      });
      return {
        main: { label: "\u8BC9\u8BBC\u524D\u671F\u603B\u6295\u5165", value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        blocks: [
          { label: "\u5360\u6807\u7684\u989D\u6BD4\u4F8B", value: `${(total / Math.max(amount, 1) * 100).toFixed(2)}%` },
          { label: "\u5176\u4ED6\u8BC9\u8BBC\u8D39\u7528", value: money(otherFee), unit: "\u5143", sub: "\u516C\u544A + \u516C\u8BC1 + \u9274\u5B9A + \u8BC4\u4F30" },
          { label: "\u9884\u671F\u56DE\u6536\u91D1\u989D", value: money(expected), unit: "\u5143" },
          {
            label: "\u51C0\u6536\u76CA",
            value: money(net),
            unit: "\u5143",
            sub: `\u6295\u5165\u4EA7\u51FA\u6BD4 ${roi}%`
          }
        ],
        steps,
        basis: [
          ...COMMON_BASIS,
          {
            law: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u4E8C\u6761",
            text: "\u8BC9\u8BBC\u8FC7\u7A0B\u4E2D\u56E0\u9274\u5B9A\u3001\u516C\u544A\u3001\u52D8\u9A8C\u3001\u7FFB\u8BD1\u3001\u8BC4\u4F30\u3001\u62CD\u5356\u3001\u53D8\u5356\u3001\u4ED3\u50A8\u3001\u4FDD\u7BA1\u3001\u8FD0\u8F93\u3001\u8239\u8236\u76D1\u7BA1\u7B49\u53D1\u751F\u7684\u4F9D\u6CD5\u5E94\u5F53\u7531\u5F53\u4E8B\u4EBA\u8D1F\u62C5\u7684\u8D39\u7528\uFF0C\u4EBA\u6C11\u6CD5\u9662\u6839\u636E\u8C01\u4E3B\u5F20\u3001\u8C01\u8D1F\u62C5\u7684\u539F\u5219\uFF0C\u51B3\u5B9A\u7531\u5F53\u4E8B\u4EBA\u76F4\u63A5\u652F\u4ED8\u7ED9\u6709\u5173\u673A\u6784\u6216\u8005\u5355\u4F4D\uFF0C\u4EBA\u6C11\u6CD5\u9662\u4E0D\u5F97\u4EE3\u6536\u4EE3\u4ED8\u3002"
          }
        ],
        tips: [
          "\u53D7\u7406\u8D39\u4E0E\u4FDD\u5168\u8D39\u7531\u8D25\u8BC9\u65B9\u8D1F\u62C5\uFF0C\u80DC\u8BC9\u540E\u53EF\u7533\u8BF7\u9000\u8FD8\uFF0C\u5B9E\u9645\u51C0\u652F\u51FA\u901A\u5E38\u4F4E\u4E8E\u6D4B\u7B97\u503C\u3002",
          "\u516C\u544A\u8D39\u3001\u516C\u8BC1\u8D39\u3001\u9274\u5B9A\u8D39\u3001\u8BC4\u4F30\u8D39\u4E0D\u5C5E\u4E8E\u6848\u4EF6\u53D7\u7406\u8D39\uFF0C\u6CD5\u9662\u4E0D\u4EE3\u6536\u4EE3\u4ED8\uFF0C\u9700\u7531\u5F53\u4E8B\u4EBA\u76F4\u63A5\u652F\u4ED8\u7ED9\u7B2C\u4E09\u65B9\u673A\u6784\uFF0C\u505A\u9884\u7B97\u65F6\u5FC5\u987B\u5355\u72EC\u5217\u652F\u2014\u2014\u8FD9\u51E0\u9879\u5F80\u5F80\u662F\u8BC9\u8BBC\u4E2D\u6700\u5927\u7684\u73B0\u91D1\u6D41\u51FA\u3002",
          "\u5F8B\u5E08\u8D39\u9664\u975E\u6709\u7EA6\u5B9A\u6216\u6CD5\u5B9A\u60C5\u5F62\uFF0C\u5426\u5219\u5404\u81EA\u627F\u62C5\uFF0C\u662F\u8BC9\u8BBC\u4E2D\u6700\u96BE\u56DE\u6536\u7684\u6210\u672C\u3002",
          "\u51C0\u6536\u76CA\u4E3A\u8D1F\u65F6\uFF0C\u8C03\u89E3\u3001\u503A\u6743\u8F6C\u8BA9\u6216\u5546\u4E1A\u6B62\u635F\u5F80\u5F80\u6BD4\u786C\u6253\u5230\u5E95\u66F4\u5212\u7B97\u3002"
        ]
      };
    }
  }
];

// src/core/calculators/otherfee.ts
var FEE_BASIS = [
  {
    law: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B",
    article: "\u7B2C\u5341\u4E8C\u6761",
    text: "\u8BC9\u8BBC\u8FC7\u7A0B\u4E2D\u56E0\u9274\u5B9A\u3001\u516C\u544A\u3001\u52D8\u9A8C\u3001\u7FFB\u8BD1\u3001\u8BC4\u4F30\u3001\u62CD\u5356\u3001\u53D8\u5356\u3001\u4ED3\u50A8\u3001\u4FDD\u7BA1\u3001\u8FD0\u8F93\u3001\u8239\u8236\u76D1\u7BA1\u7B49\u53D1\u751F\u7684\u4F9D\u6CD5\u5E94\u5F53\u7531\u5F53\u4E8B\u4EBA\u8D1F\u62C5\u7684\u8D39\u7528\uFF0C\u4EBA\u6C11\u6CD5\u9662\u6839\u636E\u8C01\u4E3B\u5F20\u3001\u8C01\u8D1F\u62C5\u7684\u539F\u5219\uFF0C\u51B3\u5B9A\u7531\u5F53\u4E8B\u4EBA\u76F4\u63A5\u652F\u4ED8\u7ED9\u6709\u5173\u673A\u6784\u6216\u8005\u5355\u4F4D\uFF0C\u4EBA\u6C11\u6CD5\u9662\u4E0D\u5F97\u4EE3\u6536\u4EE3\u4ED8\u3002"
  }
];
var ANNOUNCEMENT_PRICE = {
  service: { label: "\u8D77\u8BC9\u72B6\u526F\u672C\u53CA\u5F00\u5EAD\u4F20\u7968\u9001\u8FBE\u516C\u544A", price: 300, note: "\u6700\u5E38\u89C1\uFF0C\u4E00\u822C\u5408\u5E76\u520A\u767B\u4E00\u6B21" },
  judgment: { label: "\u5224\u51B3\u4E66 / \u88C1\u5B9A\u4E66\u9001\u8FBE\u516C\u544A", price: 300, note: "\u540C\u4E0A\uFF0C\u6309\u6B21\u8BA1\u8D39" },
  execution: { label: "\u6267\u884C\u516C\u544A", price: 300, note: "\u542B\u6267\u884C\u901A\u77E5\u3001\u67E5\u5C01\u516C\u544A\u7B49" },
  bankruptcy: { label: "\u7834\u4EA7 / \u5F3A\u5236\u6E05\u7B97\u516C\u544A", price: 1500, note: "\u7BC7\u5E45\u957F\u3001\u591A\u9700\u8FDE\u7EED\u520A\u767B\uFF0C\u8D39\u7528\u8F83\u9AD8" },
  missing: { label: "\u5BA3\u544A\u5931\u8E2A / \u5BA3\u544A\u6B7B\u4EA1\u516C\u544A", price: 500, note: "\u5BA3\u544A\u5931\u8E2A\u516C\u544A\u671F 3 \u4E2A\u6708\uFF0C\u5BA3\u544A\u6B7B\u4EA1 1 \u5E74" },
  public: { label: "\u516C\u793A\u50AC\u544A / \u7968\u636E\u516C\u544A", price: 600, note: "\u516C\u793A\u50AC\u544A\u671F\u95F4\u7531\u6CD5\u9662\u786E\u5B9A\uFF0C\u4E0D\u5C11\u4E8E 60 \u65E5" },
  other: { label: "\u5176\u4ED6\u516C\u544A\uFF08\u8BA4\u9886\u8D22\u4EA7\u3001\u9001\u8FBE\u6D89\u5916\u6587\u4E66\u7B49\uFF09", price: 300, note: "\u6D89\u5916\u516C\u544A\u81EA\u53D1\u51FA\u4E4B\u65E5\u8D77\u6EE1 3 \u4E2A\u6708\u89C6\u4E3A\u9001\u8FBE" }
};
var EXPERTISE_PRICE = {
  handwriting: { label: "\u7B14\u8FF9 / \u5370\u7AE0 / \u6587\u4E66\u771F\u4F2A\u9274\u5B9A", price: 4e3, note: "\u5E38\u89C1\u533A\u95F4 3000\u20148000 \u5143/\u4EF6\uFF0C\u6837\u672C\u6BCF\u589E\u52A0\u4E00\u4EFD\u52A0\u6536" },
  timing: { label: "\u6587\u4E66\u5F62\u6210\u65F6\u95F4\u9274\u5B9A", price: 12e3, note: "\u6280\u672F\u96BE\u5EA6\u5927\uFF0C\u5E38\u89C1 10000\u201420000 \u5143" },
  clinical: { label: "\u6CD5\u533B\u4E34\u5E8A\uFF08\u4F24\u6B8B\u7B49\u7EA7 / \u4F24\u75C5\u5173\u7CFB\uFF09", price: 1200, note: "\u5404\u7701\u6536\u8D39\u6807\u51C6\u4E0D\u540C\uFF0C\u5E38\u89C1 700\u20142000 \u5143/\u4F8B" },
  medical: { label: "\u533B\u7597\u635F\u5BB3 / \u533B\u7597\u8FC7\u9519\u9274\u5B9A", price: 1e4, note: "\u5E38\u89C1 8000\u201415000 \u5143" },
  psych: { label: "\u7CBE\u795E\u75BE\u75C5 / \u6C11\u4E8B\u884C\u4E3A\u80FD\u529B\u9274\u5B9A", price: 3e3, note: "\u5E38\u89C1 2000\u20145000 \u5143" },
  dna: { label: "\u4EB2\u5B50\u9274\u5B9A\uFF08\u4E09\u8054\u4F53\uFF09", price: 3e3, note: "\u5E38\u89C1 2400\u20143600 \u5143/\u4F8B" },
  electronic: { label: "\u7535\u5B50\u6570\u636E\u53F8\u6CD5\u9274\u5B9A", price: 12e3, note: "\u5E38\u89C1 8000\u201430000 \u5143\uFF0C\u6309\u6570\u636E\u91CF\u4E0E\u6062\u590D\u96BE\u5EA6" },
  product: { label: "\u4EA7\u54C1\u8D28\u91CF / \u673A\u52A8\u8F66\u6280\u672F\u9274\u5B9A", price: 8e3, note: "\u5E38\u89C1 3000\u201420000 \u5143" },
  accounting: { label: "\u53F8\u6CD5\u4F1A\u8BA1\u9274\u5B9A", price: 0, note: "\u591A\u6309\u6807\u7684\u989D\u6BD4\u4F8B\u6216\u8BA1\u65F6\u6536\u8D39" },
  engineering: { label: "\u5DE5\u7A0B\u9020\u4EF7\u9274\u5B9A", price: 0, note: "\u591A\u6309\u6807\u7684\u989D\u7D2F\u8FDB\u8BA1\u8D39\uFF0C\u5E38\u89C1 1%\u20143%" },
  other: { label: "\u5176\u4ED6\u4E13\u95E8\u6027\u95EE\u9898\u9274\u5B9A", price: 5e3, note: "\u4EE5\u9274\u5B9A\u673A\u6784\u62A5\u4EF7\u4E3A\u51C6" }
};
var otherFeeCalculators = [
  /* ── 公告费 ── */
  {
    id: "announcement-fee",
    name: "\u516C\u544A\u8D39",
    category: "litigation",
    glyph: "\u544A",
    summary: "\u9001\u8FBE\u3001\u5F00\u5EAD\u3001\u6267\u884C\u3001\u7834\u4EA7\u7B49\u516C\u544A\u7684\u520A\u767B\u8D39\u7528\u6D4B\u7B97\uFF08\u6CD5\u9662\u4E0D\u4EE3\u6536\uFF0C\u7531\u5F53\u4E8B\u4EBA\u76F4\u63A5\u652F\u4ED8\u5A92\u4F53\uFF09",
    keywords: ["\u516C\u544A\u8D39", "\u516C\u544A\u9001\u8FBE", "\u520A\u767B", "\u4EBA\u6C11\u6CD5\u9662\u62A5", "\u7834\u4EA7\u516C\u544A", "\u516C\u793A\u50AC\u544A"],
    fields: [
      {
        key: "annoType",
        label: "\u516C\u544A\u7C7B\u578B",
        type: "select",
        defaultValue: "service",
        options: Object.entries(ANNOUNCEMENT_PRICE).map(([value, v]) => ({ label: v.label, value }))
      },
      {
        key: "times",
        label: "\u520A\u767B\u6B21\u6570",
        type: "number",
        unit: "\u6B21",
        defaultValue: 1,
        min: 1,
        step: 1,
        hint: "\u4E00\u822C\u9001\u8FBE\u516C\u544A\u520A\u767B 1 \u6B21\u5373\u53EF\uFF1B\u7834\u4EA7\u3001\u6E05\u7B97\u7C7B\u516C\u544A\u5E38\u9700\u8FDE\u7EED\u520A\u767B 2\u20143 \u6B21"
      },
      {
        key: "unitPrice",
        label: "\u5355\u6B21\u520A\u767B\u5355\u4EF7",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        hint: "\u586B 0 \u65F6\u81EA\u52A8\u91C7\u7528\u6240\u9009\u516C\u544A\u7C7B\u578B\u7684\u53C2\u8003\u4EF7\uFF1B\u6709\u5B9E\u9645\u62A5\u4EF7\u65F6\u76F4\u63A5\u586B\u5199\uFF08\u4EBA\u6C11\u6CD5\u9662\u62A5 / \u6CD5\u9662\u516C\u544A\u7F51\uFF09"
      },
      {
        key: "extra",
        label: "\u5176\u4ED6\u652F\u51FA\uFF08\u52A0\u6025\u3001\u7FFB\u8BD1\u3001\u90AE\u5BC4\u7B49\uFF09",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        group: "\u5176\u4ED6"
      }
    ],
    calc(values) {
      const type = toStr(values.annoType, "service");
      const ref = ANNOUNCEMENT_PRICE[type] ?? ANNOUNCEMENT_PRICE.other;
      const times = Math.max(1, Math.round(toNum(values.times, 1)));
      const custom = toNum(values.unitPrice);
      const unitPrice = custom > 0 ? custom : ref.price;
      const extra = toNum(values.extra);
      const subtotal = round(unitPrice * times, 2);
      const total = round(subtotal + extra, 2);
      const steps = [
        { label: "\u516C\u544A\u7C7B\u578B", value: ref.label, note: ref.note },
        {
          label: "\u5355\u6B21\u520A\u767B\u5355\u4EF7",
          value: `${money(unitPrice)} \u5143`,
          note: custom > 0 ? "\u6309\u7528\u6237\u586B\u5199\u7684\u5355\u4EF7" : `\u672A\u586B\u5199\u5355\u4EF7\uFF0C\u91C7\u7528\u53C2\u8003\u4EF7 ${money(ref.price)} \u5143/\u6B21`
        },
        { label: `\u520A\u767B ${times} \u6B21`, value: `${money(unitPrice)} \xD7 ${times} = ${money(subtotal)} \u5143`, emphasis: true }
      ];
      if (extra > 0) {
        steps.push({ label: "\u5176\u4ED6\u652F\u51FA", value: `${money(extra)} \u5143` });
        steps.push({ label: "\u5408\u8BA1", value: `${money(subtotal)} + ${money(extra)} = ${money(total)} \u5143`, emphasis: true });
      }
      const effectText = type === "missing" ? "\u5BA3\u544A\u5931\u8E2A 3 \u4E2A\u6708 / \u5BA3\u544A\u6B7B\u4EA1 1 \u5E74" : type === "public" ? "\u4E0D\u5C11\u4E8E 60 \u65E5" : type === "bankruptcy" ? "\u4EE5\u6CD5\u9662\u516C\u544A\u8F7D\u660E\u4E3A\u51C6" : type === "other" ? "\u6D89\u5916\u516C\u544A 3 \u4E2A\u6708" : "30 \u65E5";
      return {
        main: { label: "\u516C\u544A\u8D39\u5408\u8BA1", value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        blocks: [
          { label: "\u516C\u544A\u7C7B\u578B", value: ref.label },
          { label: "\u520A\u767B\u6B21\u6570", value: `${times} \u6B21` },
          { label: "\u516C\u544A\u751F\u6548\u671F\u95F4", value: effectText, sub: "\u81EA\u53D1\u51FA\u516C\u544A\u4E4B\u65E5\u8D77\u7B97" }
        ],
        steps,
        basis: [
          ...FEE_BASIS,
          {
            law: "\u300A\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u300B",
            article: "\u7B2C\u4E5D\u5341\u4E94\u6761",
            text: "\u53D7\u9001\u8FBE\u4EBA\u4E0B\u843D\u4E0D\u660E\uFF0C\u6216\u8005\u7528\u672C\u8282\u89C4\u5B9A\u7684\u5176\u4ED6\u65B9\u5F0F\u65E0\u6CD5\u9001\u8FBE\u7684\uFF0C\u516C\u544A\u9001\u8FBE\u3002\u81EA\u53D1\u51FA\u516C\u544A\u4E4B\u65E5\u8D77\uFF0C\u7ECF\u8FC7\u4E09\u5341\u65E5\uFF0C\u5373\u89C6\u4E3A\u9001\u8FBE\u3002\u516C\u544A\u9001\u8FBE\uFF0C\u5E94\u5F53\u5728\u6848\u5377\u4E2D\u8BB0\u660E\u539F\u56E0\u548C\u7ECF\u8FC7\u3002"
          }
        ],
        tips: [
          "\u516C\u544A\u8D39\u4E0D\u5C5E\u4E8E\u6848\u4EF6\u53D7\u7406\u8D39\uFF0C\u6CD5\u9662\u4E0D\u4EE3\u6536\u4EE3\u4ED8\uFF0C\u9700\u7531\u7533\u8BF7\u65B9\u76F4\u63A5\u652F\u4ED8\u7ED9\u4EBA\u6C11\u6CD5\u9662\u62A5\u793E\u6216\u6CD5\u9662\u516C\u544A\u7F51\u3002",
          "\u516C\u544A\u9001\u8FBE\u662F\u300C\u6700\u540E\u624B\u6BB5\u300D\uFF0C\u542F\u52A8\u524D\u987B\u5148\u5B8C\u6210\u76F4\u63A5\u9001\u8FBE\u3001\u90AE\u5BC4\u9001\u8FBE\u3001\u7535\u5B50\u9001\u8FBE\u7B49\uFF0C\u5E76\u7559\u5B58\u9001\u8FBE\u4E0D\u80FD\u7684\u51ED\u8BC1\u3002",
          "\u516C\u544A\u9001\u8FBE\u4EC5\u9002\u7528\u4E8E\u53D7\u9001\u8FBE\u4EBA\u4E0B\u843D\u4E0D\u660E\u6216\u5176\u4ED6\u65B9\u5F0F\u65E0\u6CD5\u9001\u8FBE\u7684\u60C5\u5F62\uFF0C\u6EE5\u7528\u516C\u544A\u9001\u8FBE\u53EF\u80FD\u88AB\u8BA4\u5B9A\u4E3A\u7A0B\u5E8F\u8FDD\u6CD5\u3002",
          "\u7834\u4EA7\u3001\u5F3A\u5236\u6E05\u7B97\u7C7B\u516C\u544A\u8D39\u7528\u9AD8\u4E14\u9700\u8FDE\u7EED\u520A\u767B\uFF0C\u5E94\u5728\u9884\u7B97\u4E2D\u5355\u72EC\u5217\u652F\u3002"
        ]
      };
    }
  },
  /* ── 公证费 ── */
  {
    id: "notarization-fee",
    name: "\u516C\u8BC1\u8D39",
    category: "litigation",
    glyph: "\u8BC1",
    summary: "\u5F3A\u5236\u6267\u884C\u516C\u8BC1\u3001\u7EE7\u627F\u8D60\u4E0E\u3001\u5408\u540C\u3001\u4FDD\u5168\u8BC1\u636E\u3001\u63D0\u5B58\u7B49\u516C\u8BC1\u4E8B\u9879\u7684\u6536\u8D39\u6D4B\u7B97",
    keywords: ["\u516C\u8BC1\u8D39", "\u5F3A\u5236\u6267\u884C\u516C\u8BC1", "\u8D4B\u5F3A\u516C\u8BC1", "\u4FDD\u5168\u8BC1\u636E", "\u63D0\u5B58", "\u7EE7\u627F\u516C\u8BC1"],
    fields: [
      {
        key: "notaryType",
        label: "\u516C\u8BC1\u4E8B\u9879",
        type: "select",
        defaultValue: "enforcement",
        options: [
          { label: "\u8D4B\u4E88\u503A\u6743\u6587\u4E66\u5F3A\u5236\u6267\u884C\u6548\u529B\u516C\u8BC1", value: "enforcement" },
          { label: "\u8D22\u4EA7\u7EE7\u627F / \u8D60\u4E0E / \u63A5\u53D7\u9057\u8D60\u516C\u8BC1", value: "inheritance" },
          { label: "\u5408\u540C\uFF08\u534F\u8BAE\uFF09\u516C\u8BC1", value: "contract" },
          { label: "\u4FDD\u5168\u8BC1\u636E\u516C\u8BC1\uFF08\u7F51\u9875\u3001\u73B0\u573A\u3001\u804A\u5929\u8BB0\u5F55\u7B49\uFF09", value: "evidence" },
          { label: "\u6587\u672C\u76F8\u7B26 / \u5F71\u5370\u672C\u4E0E\u539F\u672C\u76F8\u7B26\u516C\u8BC1", value: "copy" },
          { label: "\u63D0\u5B58\u516C\u8BC1", value: "deposit" }
        ]
      },
      {
        key: "amount",
        label: "\u6D89\u53CA\u91D1\u989D",
        type: "money",
        unit: "\u5143",
        emphasis: true,
        defaultValue: 1e6,
        hint: "\u5F3A\u5236\u6267\u884C\u516C\u8BC1\u586B\u503A\u52A1\u603B\u989D\uFF1B\u7EE7\u627F\u8D60\u4E0E\u586B\u53D7\u76CA\u989D\uFF1B\u5408\u540C\u516C\u8BC1\u586B\u6807\u7684\u989D\uFF1B\u63D0\u5B58\u586B\u63D0\u5B58\u989D",
        visibleWhen: (v) => ["enforcement", "inheritance", "contract", "deposit"].includes(toStr(v.notaryType))
      },
      {
        key: "pieces",
        label: "\u516C\u8BC1\u4EF6\u6570",
        type: "number",
        unit: "\u4EF6",
        defaultValue: 1,
        min: 1,
        step: 1,
        visibleWhen: (v) => ["evidence", "copy"].includes(toStr(v.notaryType))
      },
      {
        key: "unitPrice",
        label: "\u6BCF\u4EF6\u6536\u8D39",
        type: "money",
        unit: "\u5143",
        defaultValue: 1200,
        hint: "\u4FDD\u5168\u8BC1\u636E\u516C\u8BC1\u5E38\u89C1 1000\u20142000 \u5143/\u4EF6\uFF1B\u6587\u672C\u76F8\u7B26\u516C\u8BC1\u5E38\u89C1 100\u2014300 \u5143/\u4EF6\uFF0C\u4EE5\u516C\u8BC1\u5904\u62A5\u4EF7\u4E3A\u51C6",
        visibleWhen: (v) => ["evidence", "copy"].includes(toStr(v.notaryType))
      },
      {
        key: "minFee",
        label: "\u6700\u4F4E\u6536\u8D39",
        type: "money",
        unit: "\u5143",
        defaultValue: 200,
        hint: "\u591A\u6570\u516C\u8BC1\u4E8B\u9879\u8BBE\u6709\u5355\u4EF6\u6700\u4F4E\u6536\u8D39",
        group: "\u5176\u4ED6"
      },
      {
        key: "extra",
        label: "\u5176\u4ED6\u652F\u51FA\uFF08\u526F\u672C\u3001\u7FFB\u8BD1\u3001\u5DEE\u65C5\u3001\u5149\u76D8\u7B49\uFF09",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        group: "\u5176\u4ED6"
      }
    ],
    calc(values) {
      const type = toStr(values.notaryType, "enforcement");
      const amount = toNum(values.amount);
      const pieces = Math.max(1, Math.round(toNum(values.pieces, 1)));
      const unitPrice = toNum(values.unitPrice);
      const minFee = toNum(values.minFee);
      const extra = toNum(values.extra);
      const steps = [];
      let base = 0;
      let mainLabel = "\u516C\u8BC1\u8D39";
      if (type === "enforcement") {
        base = round(amount * 3e-3, 2);
        mainLabel = "\u8D4B\u4E88\u5F3A\u5236\u6267\u884C\u6548\u529B\u516C\u8BC1\u8D39";
        steps.push({ label: "\u6309\u503A\u52A1\u603B\u989D 0.3% \u8BA1\u6536", value: `${money(amount)} \xD7 0.3% = ${money(base)} \u5143`, note: "\u884C\u4E1A\u901A\u884C\u6807\u51C6\uFF0C\u4EE5\u516C\u8BC1\u5904\u62A5\u4EF7\u4E3A\u51C6" });
      } else if (type === "deposit") {
        base = round(amount * 3e-3, 2);
        mainLabel = "\u63D0\u5B58\u516C\u8BC1\u8D39";
        steps.push({ label: "\u6309\u63D0\u5B58\u989D 0.3% \u8BA1\u6536", value: `${money(amount)} \xD7 0.3% = ${money(base)} \u5143`, note: "\u63D0\u5B58\u7269\u7684\u4FDD\u7BA1\u8D39\u53E6\u6309\u5B9E\u9645\u8BA1\u6536" });
      } else if (type === "inheritance") {
        const r = progressive(amount, NOTARY_INHERITANCE_TIERS);
        base = r.total;
        mainLabel = "\u7EE7\u627F / \u8D60\u4E0E / \u53D7\u9057\u8D60\u516C\u8BC1\u8D39";
        r.lines.forEach((l) => steps.push({ label: l.desc, value: `${money(l.base)} ${l.rateText} = ${money(l.amount)} \u5143` }));
        steps.push({ label: "\u5206\u6BB5\u7D2F\u8BA1", value: `${money(base)} \u5143`, emphasis: true, note: "\u6309\u53D7\u76CA\u989D\u7D2F\u8FDB" });
      } else if (type === "contract") {
        const r = progressive(amount, NOTARY_CONTRACT_TIERS);
        base = r.total;
        mainLabel = "\u5408\u540C\uFF08\u534F\u8BAE\uFF09\u516C\u8BC1\u8D39";
        r.lines.forEach((l) => steps.push({ label: l.desc, value: `${money(l.base)} ${l.rateText} = ${money(l.amount)} \u5143` }));
        steps.push({ label: "\u5206\u6BB5\u7D2F\u8BA1", value: `${money(base)} \u5143`, emphasis: true, note: "\u6309\u5408\u540C\u6807\u7684\u989D\u7D2F\u8FDB" });
      } else {
        base = round(unitPrice * pieces, 2);
        mainLabel = type === "evidence" ? "\u4FDD\u5168\u8BC1\u636E\u516C\u8BC1\u8D39" : "\u6587\u672C\u76F8\u7B26\u516C\u8BC1\u8D39";
        steps.push({ label: `\u6BCF\u4EF6 ${money(unitPrice)} \u5143 \xD7 ${pieces} \u4EF6`, value: `${money(base)} \u5143`, emphasis: true });
      }
      if (minFee > 0 && base < minFee) {
        steps.push({ label: "\u4F4E\u4E8E\u6700\u4F4E\u6536\u8D39\uFF0C\u6309\u6700\u4F4E\u6536\u8D39\u8BA1\u6536", value: `${money(minFee)} \u5143`, emphasis: true });
        base = minFee;
      }
      const total = round(base + extra, 2);
      if (extra > 0) steps.push({ label: "\u52A0\u8BA1\u5176\u4ED6\u652F\u51FA", value: `${money(base)} + ${money(extra)} = ${money(total)} \u5143`, emphasis: true });
      const blocks = [
        { label: "\u516C\u8BC1\u8D39", value: money(base), unit: "\u5143" },
        { label: "\u5176\u4ED6\u652F\u51FA", value: money(extra), unit: "\u5143" }
      ];
      if (type === "enforcement") {
        blocks.push({ label: "\u53EF\u7701\u53BB\u7684\u8BC9\u8BBC\u6210\u672C", value: "\u4E00\u5BA1\u53D7\u7406\u8D39 + \u4FDD\u5168\u8D39", sub: "\u503A\u6743\u6587\u4E66\u53EF\u76F4\u63A5\u7533\u8BF7\u6267\u884C\uFF0C\u65E0\u9700\u8BC9\u8BBC" });
      }
      return {
        main: { label: mainLabel, value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        blocks,
        steps,
        basis: [
          {
            law: "\u300A\u516C\u8BC1\u6CD5\u300B",
            article: "\u7B2C\u56DB\u5341\u516D\u6761",
            text: "\u516C\u8BC1\u8D39\u7684\u6536\u8D39\u6807\u51C6\u7531\u56FD\u52A1\u9662\u8D22\u653F\u90E8\u95E8\u3001\u4EF7\u683C\u4E3B\u7BA1\u90E8\u95E8\u4F1A\u540C\u56FD\u52A1\u9662\u53F8\u6CD5\u884C\u653F\u90E8\u95E8\u5236\u5B9A\u3002"
          },
          {
            law: "\u300A\u516C\u8BC1\u6CD5\u300B",
            article: "\u7B2C\u4E09\u5341\u4E03\u6761",
            text: "\u5BF9\u7ECF\u516C\u8BC1\u7684\u4EE5\u7ED9\u4ED8\u4E3A\u5185\u5BB9\u5E76\u8F7D\u660E\u503A\u52A1\u4EBA\u613F\u610F\u63A5\u53D7\u5F3A\u5236\u6267\u884C\u627F\u8BFA\u7684\u503A\u6743\u6587\u4E66\uFF0C\u503A\u52A1\u4EBA\u4E0D\u5C65\u884C\u6216\u8005\u5C65\u884C\u4E0D\u9002\u5F53\u7684\uFF0C\u503A\u6743\u4EBA\u53EF\u4EE5\u4F9D\u6CD5\u5411\u6709\u7BA1\u8F96\u6743\u7684\u4EBA\u6C11\u6CD5\u9662\u7533\u8BF7\u6267\u884C\u3002"
          },
          ...FEE_BASIS
        ],
        tips: [
          "\u8D4B\u4E88\u5F3A\u5236\u6267\u884C\u6548\u529B\u7684\u503A\u6743\u6587\u4E66\u516C\u8BC1\u662F\u6027\u4EF7\u6BD4\u6700\u9AD8\u7684\u98CE\u63A7\u624B\u6BB5\uFF1A0.3% \u7684\u516C\u8BC1\u8D39\u53EF\u7701\u53BB\u4E00\u5BA1\u53D7\u7406\u8D39\u3001\u4FDD\u5168\u8D39\u4E0E\u6F2B\u957F\u5468\u671F\uFF0C\u76F4\u63A5\u8FDB\u5165\u6267\u884C\u7A0B\u5E8F\u3002",
          '\u529E\u7406\u5F3A\u5236\u6267\u884C\u516C\u8BC1\u5FC5\u987B\u540C\u65F6\u6EE1\u8DB3\u4E09\u4E2A\u8981\u4EF6\uFF1A\u503A\u6743\u6587\u4E66\u4EE5\u7ED9\u4ED8\u4E3A\u5185\u5BB9\u3001\u8F7D\u660E\u503A\u52A1\u4EBA\u613F\u610F\u63A5\u53D7\u5F3A\u5236\u6267\u884C\u7684\u627F\u8BFA\u3001\u516C\u8BC1\u4E66\u4E2D\u8F7D\u660E"\u8D4B\u4E88\u5F3A\u5236\u6267\u884C\u6548\u529B"\u3002',
          "\u4FDD\u5168\u8BC1\u636E\u516C\u8BC1\u662F\u77E5\u8BC6\u4EA7\u6743\u3001\u7F51\u7EDC\u4FB5\u6743\u6848\u4EF6\u7684\u5E38\u89C4\u64CD\u4F5C\uFF0C\u5E94\u5728\u53D1\u73B0\u4FB5\u6743\u540E\u7B2C\u4E00\u65F6\u95F4\u529E\u7406\uFF0C\u907F\u514D\u8BC1\u636E\u706D\u5931\u6216\u88AB\u7BE1\u6539\u3002",
          "\u516C\u8BC1\u6536\u8D39\u6807\u51C6\u7531\u5404\u7701\u7EA7\u4EF7\u683C\u4E3B\u7BA1\u90E8\u95E8\u4E0E\u53F8\u6CD5\u884C\u653F\u90E8\u95E8\u5236\u5B9A\uFF0C\u591A\u6570\u4E8B\u9879\u5DF2\u5B9E\u884C\u5E02\u573A\u8C03\u8282\u4EF7\uFF0C\u52A1\u5FC5\u4E8B\u524D\u53D6\u5F97\u516C\u8BC1\u5904\u4E66\u9762\u62A5\u4EF7\u3002"
        ]
      };
    }
  },
  /* ── 鉴定费 ── */
  {
    id: "expertise-fee",
    name: "\u53F8\u6CD5\u9274\u5B9A\u8D39",
    category: "litigation",
    glyph: "\u9274",
    summary: "\u7B14\u8FF9\u3001\u533B\u7597\u635F\u5BB3\u3001\u5DE5\u7A0B\u9020\u4EF7\u3001\u53F8\u6CD5\u4F1A\u8BA1\u7B49\u5404\u7C7B\u53F8\u6CD5\u9274\u5B9A\u7684\u8D39\u7528\u6D4B\u7B97\uFF08\u6309\u4EF6\u6216\u6309\u6807\u7684\u989D\uFF09",
    keywords: ["\u9274\u5B9A\u8D39", "\u53F8\u6CD5\u9274\u5B9A", "\u7B14\u8FF9\u9274\u5B9A", "\u533B\u7597\u9274\u5B9A", "\u5DE5\u7A0B\u9020\u4EF7\u9274\u5B9A", "\u53F8\u6CD5\u4F1A\u8BA1", "\u4F24\u6B8B\u9274\u5B9A"],
    fields: [
      {
        key: "expType",
        label: "\u9274\u5B9A\u4E8B\u9879",
        type: "select",
        defaultValue: "handwriting",
        options: Object.entries(EXPERTISE_PRICE).map(([value, v]) => ({ label: v.label, value }))
      },
      {
        key: "method",
        label: "\u8BA1\u8D39\u65B9\u5F0F",
        type: "select",
        defaultValue: "bycase",
        options: [
          { label: "\u6309\u4EF6\u8BA1\u8D39", value: "bycase" },
          { label: "\u6309\u6807\u7684\u989D\u6BD4\u4F8B\u8BA1\u8D39", value: "byamount" }
        ],
        hint: "\u5DE5\u7A0B\u9020\u4EF7\u3001\u53F8\u6CD5\u4F1A\u8BA1\u9274\u5B9A\u591A\u6309\u6807\u7684\u989D\u7D2F\u8FDB\uFF1B\u5176\u4F59\u591A\u4E3A\u6309\u4EF6\u8BA1\u8D39"
      },
      {
        key: "unitPrice",
        label: "\u6BCF\u4EF6\u6536\u8D39",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        hint: "\u586B 0 \u65F6\u81EA\u52A8\u91C7\u7528\u6240\u9009\u9274\u5B9A\u4E8B\u9879\u7684\u53C2\u8003\u4EF7\uFF1B\u6709\u673A\u6784\u62A5\u4EF7\u65F6\u76F4\u63A5\u586B\u5199",
        visibleWhen: (v) => toStr(v.method, "bycase") === "bycase"
      },
      {
        key: "count",
        label: "\u9274\u5B9A\u4EF6\u6570 / \u4F8B\u6570",
        type: "number",
        unit: "\u4EF6",
        defaultValue: 1,
        min: 1,
        step: 1,
        visibleWhen: (v) => toStr(v.method, "bycase") === "bycase"
      },
      {
        key: "amount",
        label: "\u9274\u5B9A\u6807\u7684\u989D",
        type: "money",
        unit: "\u5143",
        emphasis: true,
        defaultValue: 3e6,
        visibleWhen: (v) => toStr(v.method, "bycase") === "byamount"
      },
      {
        key: "rate",
        label: "\u8D39\u7387",
        type: "percent",
        unit: "%",
        defaultValue: 1.5,
        step: 0.1,
        hint: "\u5DE5\u7A0B\u9020\u4EF7\u9274\u5B9A\u5E38\u89C1 1%\u20143%\uFF1B\u53F8\u6CD5\u4F1A\u8BA1\u9274\u5B9A\u5E38\u89C1 0.5%\u20142%",
        visibleWhen: (v) => toStr(v.method, "bycase") === "byamount"
      },
      {
        key: "courtFee",
        label: "\u9274\u5B9A\u4EBA\u51FA\u5EAD\u8D39\u7528",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        hint: "\u542B\u4EA4\u901A\u8D39\u3001\u4F4F\u5BBF\u8D39\u3001\u751F\u6D3B\u8D39\u4E0E\u8BEF\u5DE5\u8865\u8D34\uFF0C\u7531\u7533\u8BF7\u65B9\u57AB\u4ED8\uFF0C\u6700\u7EC8\u7531\u8D25\u8BC9\u65B9\u8D1F\u62C5",
        group: "\u5176\u4ED6"
      },
      {
        key: "extra",
        label: "\u5176\u4ED6\u652F\u51FA\uFF08\u5DEE\u65C5\u3001\u52A0\u6025\u3001\u8865\u5145\u6750\u6599\u68C0\u6D4B\uFF09",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        group: "\u5176\u4ED6"
      }
    ],
    calc(values) {
      const type = toStr(values.expType, "handwriting");
      const ref = EXPERTISE_PRICE[type] ?? EXPERTISE_PRICE.other;
      const method = toStr(values.method, "bycase");
      const custom = toNum(values.unitPrice);
      const unitPrice = custom > 0 ? custom : ref.price || 5e3;
      const count = Math.max(1, Math.round(toNum(values.count, 1)));
      const amount = toNum(values.amount);
      const rate = toNum(values.rate, 1.5) / 100;
      const courtFee = toNum(values.courtFee);
      const extra = toNum(values.extra);
      const steps = [{ label: "\u9274\u5B9A\u4E8B\u9879", value: ref.label, note: ref.note }];
      let base = 0;
      if (method === "byamount") {
        base = round(amount * rate, 2);
        steps.push({ label: "\u6807\u7684\u989D \xD7 \u8D39\u7387", value: `${money(amount)} \xD7 ${toNum(values.rate, 1.5)}% = ${money(base)} \u5143`, emphasis: true });
      } else {
        base = round(unitPrice * count, 2);
        steps.push({
          label: `\u6BCF\u4EF6 ${money(unitPrice)} \u5143 \xD7 ${count} \u4EF6`,
          value: `${money(base)} \u5143`,
          emphasis: true,
          note: custom > 0 ? "\u6309\u7528\u6237\u586B\u5199\u7684\u5355\u4EF7" : `\u672A\u586B\u5199\u5355\u4EF7\uFF0C\u91C7\u7528\u53C2\u8003\u4EF7 ${money(unitPrice)} \u5143/\u4EF6`
        });
      }
      const total = round(base + courtFee + extra, 2);
      if (courtFee > 0) steps.push({ label: "\u9274\u5B9A\u4EBA\u51FA\u5EAD\u8D39\u7528", value: `${money(courtFee)} \u5143` });
      if (extra > 0) steps.push({ label: "\u5176\u4ED6\u652F\u51FA", value: `${money(extra)} \u5143` });
      steps.push({ label: "\u9274\u5B9A\u8D39\u5408\u8BA1", value: `${money(total)} \u5143`, emphasis: true });
      const blocks = [
        { label: "\u9274\u5B9A\u8D39", value: money(base), unit: "\u5143" },
        { label: "\u51FA\u5EAD\u8D39\u7528", value: money(courtFee), unit: "\u5143" }
      ];
      if (method === "byamount") {
        blocks.push({ label: "\u5360\u6807\u7684\u989D\u6BD4\u4F8B", value: `${(base / Math.max(amount, 1) * 100).toFixed(2)}%` });
      }
      return {
        main: { label: "\u53F8\u6CD5\u9274\u5B9A\u8D39\u5408\u8BA1", value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        blocks,
        steps,
        basis: [
          ...FEE_BASIS,
          {
            law: "\u300A\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u300B",
            article: "\u7B2C\u4E03\u5341\u4E5D\u6761",
            text: "\u5F53\u4E8B\u4EBA\u53EF\u4EE5\u5C31\u67E5\u660E\u4E8B\u5B9E\u7684\u4E13\u95E8\u6027\u95EE\u9898\u5411\u4EBA\u6C11\u6CD5\u9662\u7533\u8BF7\u9274\u5B9A\u3002\u5F53\u4E8B\u4EBA\u7533\u8BF7\u9274\u5B9A\u7684\uFF0C\u7531\u53CC\u65B9\u5F53\u4E8B\u4EBA\u534F\u5546\u786E\u5B9A\u5177\u5907\u8D44\u683C\u7684\u9274\u5B9A\u4EBA\uFF1B\u534F\u5546\u4E0D\u6210\u7684\uFF0C\u7531\u4EBA\u6C11\u6CD5\u9662\u6307\u5B9A\u3002"
          },
          {
            law: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B",
            article: "\u7B2C\u516D\u6761",
            text: "\u5F53\u4E8B\u4EBA\u5E94\u5F53\u5411\u4EBA\u6C11\u6CD5\u9662\u4EA4\u7EB3\u7684\u8BC9\u8BBC\u8D39\u7528\u5305\u62EC\uFF1A\uFF08\u4E00\uFF09\u6848\u4EF6\u53D7\u7406\u8D39\uFF1B\uFF08\u4E8C\uFF09\u7533\u8BF7\u8D39\uFF1B\uFF08\u4E09\uFF09\u8BC1\u4EBA\u3001\u9274\u5B9A\u4EBA\u3001\u7FFB\u8BD1\u4EBA\u5458\u3001\u7406\u7B97\u4EBA\u5458\u5728\u4EBA\u6C11\u6CD5\u9662\u6307\u5B9A\u65E5\u671F\u51FA\u5EAD\u53D1\u751F\u7684\u4EA4\u901A\u8D39\u3001\u4F4F\u5BBF\u8D39\u3001\u751F\u6D3B\u8D39\u548C\u8BEF\u5DE5\u8865\u8D34\u3002"
          }
        ],
        tips: [
          "\u9274\u5B9A\u8D39\u7531\u7533\u8BF7\u65B9\u57AB\u4ED8\uFF0C\u6700\u7EC8\u7531\u8D25\u8BC9\u65B9\u8D1F\u62C5\uFF0C\u4F46\u6CD5\u9662\u901A\u5E38\u8981\u6C42\u7533\u8BF7\u65B9\u5148\u884C\u9884\u4EA4\uFF0C\u91D1\u989D\u8F83\u5927\u65F6\u5E94\u5728\u9884\u7B97\u4E2D\u63D0\u524D\u5B89\u6392\u3002",
          "\u7533\u8BF7\u9274\u5B9A\u5E94\u5728\u4E3E\u8BC1\u671F\u9650\u5C4A\u6EE1\u524D\u63D0\u51FA\uFF0C\u903E\u671F\u53EF\u80FD\u88AB\u6CD5\u9662\u4E0D\u4E88\u51C6\u8BB8\uFF0C\u5BFC\u81F4\u4E3B\u5F20\u56E0\u7F3A\u4E4F\u8BC1\u636E\u800C\u4E0D\u88AB\u652F\u6301\u3002",
          "\u5BF9\u9274\u5B9A\u610F\u89C1\u6709\u5F02\u8BAE\u7684\uFF0C\u5E94\u5728\u6CD5\u9662\u6307\u5B9A\u671F\u9650\u5185\u4EE5\u4E66\u9762\u5F62\u5F0F\u63D0\u51FA\uFF0C\u5E76\u7533\u8BF7\u9274\u5B9A\u4EBA\u51FA\u5EAD\u4F5C\u8BC1\u6216\u7533\u8BF7\u91CD\u65B0\u9274\u5B9A\u3002",
          "\u5DE5\u7A0B\u9020\u4EF7\u4E0E\u53F8\u6CD5\u4F1A\u8BA1\u9274\u5B9A\u6807\u7684\u989D\u5927\u3001\u5468\u671F\u957F\uFF0C\u53EF\u8981\u6C42\u9274\u5B9A\u673A\u6784\u5148\u51FA\u5177\u8D39\u7528\u9884\u7B97\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u542F\u52A8\u3002"
        ]
      };
    }
  },
  /* ── 评估费 ── */
  {
    id: "valuation-fee",
    name: "\u8BC4\u4F30\u8D39",
    category: "litigation",
    glyph: "\u4F30",
    summary: "\u8D44\u4EA7\u8BC4\u4F30\u3001\u623F\u5730\u4EA7\u4F30\u4EF7\u3001\u571F\u5730\u4F30\u4EF7\u6309\u8BC4\u4F30\u503C\u7D2F\u8FDB\u8BA1\u8D39\uFF0C\u542B\u5E02\u573A\u6298\u6263\u4E0E\u6700\u4F4E\u6536\u8D39",
    keywords: ["\u8BC4\u4F30\u8D39", "\u8D44\u4EA7\u8BC4\u4F30", "\u623F\u5730\u4EA7\u4F30\u4EF7", "\u571F\u5730\u8BC4\u4F30", "\u53F8\u6CD5\u8BC4\u4F30", "\u62CD\u5356\u8BC4\u4F30"],
    fields: [
      {
        key: "valType",
        label: "\u8BC4\u4F30\u7C7B\u578B",
        type: "select",
        defaultValue: "asset",
        options: [
          { label: "\u8D44\u4EA7\u8BC4\u4F30\uFF08\u80A1\u6743\u3001\u8BBE\u5907\u3001\u65E0\u5F62\u8D44\u4EA7\u7B49\uFF09", value: "asset" },
          { label: "\u623F\u5730\u4EA7\u4F30\u4EF7", value: "realestate" },
          { label: "\u571F\u5730\u4EF7\u683C\u8BC4\u4F30", value: "land" }
        ]
      },
      {
        key: "value",
        label: "\u8BC4\u4F30\u503C / \u6807\u7684\u989D",
        type: "money",
        unit: "\u5143",
        emphasis: true,
        defaultValue: 1e7,
        hint: "\u53F8\u6CD5\u8BC4\u4F30\u6309\u8BC4\u4F30\u5BF9\u8C61\u4EF7\u503C\uFF1B\u80A1\u6743\u8BC4\u4F30\u6309\u88AB\u8BC4\u4F30\u4F01\u4E1A\u51C0\u8D44\u4EA7\u6216\u80A1\u6743\u4EF7\u503C"
      },
      {
        key: "discount",
        label: "\u6298\u6263\u7387",
        type: "percent",
        unit: "%",
        defaultValue: 60,
        hint: "\u8BC4\u4F30\u6536\u8D39\u5DF2\u653E\u5F00\u4E3A\u5E02\u573A\u8C03\u8282\u4EF7\uFF0C\u5B9E\u52A1\u4E2D\u591A\u6309\u6807\u51C6\u4EF7\u7684 5\u20148 \u6298\u6536\u53D6\uFF0C\u586B 100 \u8868\u793A\u4E0D\u6253\u6298"
      },
      {
        key: "minFee",
        label: "\u6700\u4F4E\u6536\u8D39",
        type: "money",
        unit: "\u5143",
        defaultValue: 1e3,
        hint: "\u5C0F\u989D\u8BC4\u4F30\u901A\u5E38\u8BBE\u5355\u7B14\u6700\u4F4E\u6536\u8D39",
        group: "\u5176\u4ED6"
      },
      {
        key: "extra",
        label: "\u5176\u4ED6\u652F\u51FA\uFF08\u73B0\u573A\u52D8\u5BDF\u5DEE\u65C5\u3001\u52A0\u6025\uFF09",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        group: "\u5176\u4ED6"
      }
    ],
    calc(values) {
      const type = toStr(values.valType, "asset");
      const value = toNum(values.value);
      const discount = toNum(values.discount, 100) / 100;
      const minFee = toNum(values.minFee);
      const extra = toNum(values.extra);
      const tiers = type === "realestate" ? REAL_ESTATE_TIERS : type === "land" ? LAND_APPRAISAL_TIERS : ASSET_APPRAISAL_TIERS;
      const typeName = type === "realestate" ? "\u623F\u5730\u4EA7\u4F30\u4EF7" : type === "land" ? "\u571F\u5730\u4EF7\u683C\u8BC4\u4F30" : "\u8D44\u4EA7\u8BC4\u4F30";
      const { total: standard, lines } = progressive(value, tiers);
      const steps = [{ label: "\u8BC4\u4F30\u7C7B\u578B", value: typeName, note: "\u6309\u8BC4\u4F30\u503C\u5DEE\u989D\u5B9A\u7387\u7D2F\u8FDB\u8BA1\u8D39\uFF08\u884C\u4E1A\u53C2\u8003\u6807\u51C6\uFF09" }];
      lines.forEach((l) => steps.push({ label: l.desc, value: `${money(l.base)} ${l.rateText} = ${money(l.amount)} \u5143` }));
      steps.push({ label: "\u6807\u51C6\u4EF7\u5408\u8BA1", value: `${money(standard)} \u5143`, emphasis: true });
      let base = round(standard * discount, 2);
      if (discount < 1) {
        steps.push({
          label: `\u5E02\u573A\u6298\u6263\uFF08${toNum(values.discount, 100)}%\uFF09`,
          value: `${money(standard)} \xD7 ${toNum(values.discount, 100)}% = ${money(base)} \u5143`
        });
      }
      if (minFee > 0 && base < minFee) {
        steps.push({ label: "\u4F4E\u4E8E\u6700\u4F4E\u6536\u8D39\uFF0C\u6309\u6700\u4F4E\u6536\u8D39\u8BA1\u6536", value: `${money(minFee)} \u5143`, emphasis: true });
        base = minFee;
      }
      const total = round(base + extra, 2);
      if (extra > 0) steps.push({ label: "\u52A0\u8BA1\u5176\u4ED6\u652F\u51FA", value: `${money(base)} + ${money(extra)} = ${money(total)} \u5143`, emphasis: true });
      return {
        main: { label: `${typeName}\u8D39`, value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        blocks: [
          { label: "\u6807\u51C6\u4EF7\uFF08\u672A\u6298\u6263\uFF09", value: money(standard), unit: "\u5143" },
          { label: "\u5B9E\u9645\u8BC4\u4F30\u8D39", value: money(base), unit: "\u5143" },
          { label: "\u5360\u8BC4\u4F30\u503C\u6BD4\u4F8B", value: `${(base / Math.max(value, 1) * 100).toFixed(3)}%` }
        ],
        steps,
        basis: [
          ...FEE_BASIS,
          {
            law: "\u300A\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u300B",
            article: "\u7B2C\u4E8C\u767E\u4E94\u5341\u4E94\u6761",
            text: "\u88AB\u6267\u884C\u4EBA\u672A\u6309\u6267\u884C\u901A\u77E5\u5C65\u884C\u6CD5\u5F8B\u6587\u4E66\u786E\u5B9A\u7684\u4E49\u52A1\uFF0C\u4EBA\u6C11\u6CD5\u9662\u6709\u6743\u67E5\u5C01\u3001\u6263\u62BC\u3001\u51BB\u7ED3\u3001\u62CD\u5356\u3001\u53D8\u5356\u88AB\u6267\u884C\u4EBA\u5E94\u5F53\u5C65\u884C\u4E49\u52A1\u90E8\u5206\u7684\u8D22\u4EA7\u3002"
          },
          {
            law: "\u300A\u6700\u9AD8\u4EBA\u6C11\u6CD5\u9662\u5173\u4E8E\u4EBA\u6C11\u6CD5\u9662\u6C11\u4E8B\u6267\u884C\u4E2D\u62CD\u5356\u3001\u53D8\u5356\u8D22\u4EA7\u7684\u89C4\u5B9A\u300B",
            article: "\u7B2C\u56DB\u6761",
            text: "\u5BF9\u62DF\u62CD\u5356\u7684\u8D22\u4EA7\uFF0C\u4EBA\u6C11\u6CD5\u9662\u5E94\u5F53\u59D4\u6258\u5177\u6709\u76F8\u5E94\u8D44\u8D28\u7684\u8BC4\u4F30\u673A\u6784\u8FDB\u884C\u4EF7\u683C\u8BC4\u4F30\u3002"
          }
        ],
        tips: [
          "\u8BC4\u4F30\u6536\u8D39\u5DF2\u653E\u5F00\u4E3A\u5E02\u573A\u8C03\u8282\u4EF7\uFF0C\u4E0A\u8868\u4E3A\u884C\u4E1A\u901A\u884C\u7684\u7D2F\u8FDB\u53C2\u8003\u6807\u51C6\uFF0C\u5B9E\u9645\u6210\u4EA4\u4EF7\u901A\u5E38\u4E3A\u6807\u51C6\u7684 5\u20148 \u6298\uFF0C\u52A1\u5FC5\u8D27\u6BD4\u4E09\u5BB6\u3002",
          "\u53F8\u6CD5\u5904\u7F6E\u4E2D\u7684\u8BC4\u4F30\u8D39\u7531\u7533\u8BF7\u6267\u884C\u4EBA\u5148\u884C\u57AB\u4ED8\uFF0C\u6700\u7EC8\u4ECE\u62CD\u5356\u6B3E\u4E2D\u4F18\u5148\u6263\u9664\uFF0C\u5C5E\u4E8E\u6267\u884C\u8D39\u7528\u7684\u4E00\u90E8\u5206\u3002",
          "\u5BF9\u8BC4\u4F30\u62A5\u544A\u6709\u5F02\u8BAE\u7684\uFF0C\u53EF\u5728\u6536\u5230\u540E 10 \u65E5\u5185\u4EE5\u4E66\u9762\u5F62\u5F0F\u5411\u6CD5\u9662\u63D0\u51FA\uFF0C\u7533\u8BF7\u590D\u6838\u8BC4\u4F30\u6216\u91CD\u65B0\u8BC4\u4F30\u3002",
          "\u8BC4\u4F30\u503C\u76F4\u63A5\u51B3\u5B9A\u8D77\u62CD\u4EF7\u4E0E\u6E05\u507F\u987A\u5E8F\uFF0C\u8BC4\u4F30\u8FC7\u9AD8\u6613\u6D41\u62CD\u3001\u8FC7\u4F4E\u635F\u5BB3\u88AB\u6267\u884C\u4EBA\u5229\u76CA\uFF0C\u5747\u4E3A\u5E38\u89C1\u4E89\u8BAE\u70B9\u3002"
        ]
      };
    }
  }
];

// src/core/dateUtils.ts
var HOLIDAYS = {
  2024: [
    "2024-01-01",
    "2024-02-10",
    "2024-02-11",
    "2024-02-12",
    "2024-02-13",
    "2024-02-14",
    "2024-02-15",
    "2024-02-16",
    "2024-02-17",
    "2024-04-04",
    "2024-04-05",
    "2024-04-06",
    "2024-05-01",
    "2024-05-02",
    "2024-05-03",
    "2024-05-04",
    "2024-05-05",
    "2024-06-08",
    "2024-06-09",
    "2024-06-10",
    "2024-09-15",
    "2024-09-16",
    "2024-09-17",
    "2024-10-01",
    "2024-10-02",
    "2024-10-03",
    "2024-10-04",
    "2024-10-05",
    "2024-10-06",
    "2024-10-07"
  ],
  2025: [
    "2025-01-01",
    "2025-01-28",
    "2025-01-29",
    "2025-01-30",
    "2025-01-31",
    "2025-02-01",
    "2025-02-02",
    "2025-02-03",
    "2025-02-04",
    "2025-04-04",
    "2025-04-05",
    "2025-04-06",
    "2025-05-01",
    "2025-05-02",
    "2025-05-03",
    "2025-05-04",
    "2025-05-05",
    "2025-05-31",
    "2025-06-01",
    "2025-06-02",
    "2025-10-01",
    "2025-10-02",
    "2025-10-03",
    "2025-10-04",
    "2025-10-05",
    "2025-10-06",
    "2025-10-07",
    "2025-10-08"
  ],
  2026: [
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
    "2026-02-15",
    "2026-02-16",
    "2026-02-17",
    "2026-02-18",
    "2026-02-19",
    "2026-02-20",
    "2026-02-21",
    "2026-02-22",
    "2026-04-04",
    "2026-04-05",
    "2026-04-06",
    "2026-05-01",
    "2026-05-02",
    "2026-05-03",
    "2026-05-04",
    "2026-05-05",
    "2026-06-19",
    "2026-06-20",
    "2026-06-21",
    "2026-09-25",
    "2026-09-26",
    "2026-09-27",
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
    "2026-10-05",
    "2026-10-06",
    "2026-10-07"
  ],
  2027: [
    // 元旦 1/1（五）—1/3（日）3 天，不调休
    "2027-01-01",
    "2027-01-02",
    "2027-01-03",
    // 春节：除夕 2/5（周五）起放假调休 8 天，顺连周末实际连休 9 天（2/13 为周六）
    "2027-02-05",
    "2027-02-06",
    "2027-02-07",
    "2027-02-08",
    "2027-02-09",
    "2027-02-10",
    "2027-02-11",
    "2027-02-12",
    // 清明 4/3（六）—4/5（一）3 天，不调休
    "2027-04-03",
    "2027-04-04",
    "2027-04-05",
    // 劳动节 4/30（五）—5/4（二）5 天，调休 1 天
    "2027-04-30",
    "2027-05-01",
    "2027-05-02",
    "2027-05-03",
    "2027-05-04",
    // 端午 6/9（周三）仅 1 天，不调休
    "2027-06-09",
    // 中秋 9/15（周三）仅 1 天，不调休
    "2027-09-15",
    // 国庆 10/1（五）—10/7（四）7 天，调休 2 天
    "2027-10-01",
    "2027-10-02",
    "2027-10-03",
    "2027-10-04",
    "2027-10-05",
    "2027-10-06",
    "2027-10-07"
  ]
};
var WORKDAY_OVERRIDE = {
  2025: ["2025-01-26", "2025-02-08", "2025-04-27", "2025-09-28", "2025-10-11"],
  2026: ["2026-02-14", "2026-02-28", "2026-09-20", "2026-10-10"],
  2027: ["2027-02-20", "2027-02-21", "2027-05-08", "2027-10-09", "2027-10-10"]
};
function ymd(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
var WEEKDAY_CN = ["\u661F\u671F\u65E5", "\u661F\u671F\u4E00", "\u661F\u671F\u4E8C", "\u661F\u671F\u4E09", "\u661F\u671F\u56DB", "\u661F\u671F\u4E94", "\u661F\u671F\u516D"];
function weekdayCn(d) {
  return WEEKDAY_CN[d.getDay()];
}
function parseDate(input) {
  if (input === void 0 || input === null || input === "") return null;
  const s = String(input).trim();
  const m = /^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
function isHoliday(d) {
  const key = ymd(d);
  const year = d.getFullYear();
  if (WORKDAY_OVERRIDE[year]?.includes(key)) return false;
  if (HOLIDAYS[year]?.includes(key)) return true;
  const wd = d.getDay();
  return wd === 0 || wd === 6;
}
function addDays(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}
function addMonths(d, n) {
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target;
}
function addYears(d, n) {
  return addMonths(d, n * 12);
}
function calcPeriod(base, value, unit) {
  const startFrom = addDays(base, 1);
  let rawEnd;
  if (unit === "day") {
    rawEnd = addDays(startFrom, Math.max(0, value - 1));
  } else if (unit === "month") {
    rawEnd = addMonths(base, value);
  } else {
    rawEnd = addYears(base, value);
  }
  const postponedDays = [];
  let finalEnd = rawEnd;
  let guard = 0;
  while (isHoliday(finalEnd) && guard < 30) {
    postponedDays.push(`${ymd(finalEnd)}(${weekdayCn(finalEnd)})`);
    finalEnd = addDays(finalEnd, 1);
    guard++;
  }
  const totalDays = Math.round((finalEnd.getTime() - startFrom.getTime()) / 864e5) + 1;
  return {
    startFrom,
    rawEnd,
    finalEnd,
    postponed: postponedDays.length > 0,
    postponedDays,
    totalDays
  };
}

// src/core/calculators/interest.ts
var DOUBLE_RATE_DAILY = 175e-6;
var LPR_DEFAULT = 3;
function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 864e5);
}
var interestCalculators = [
  /* ── 民间借贷利息（司法保护上限） ── */
  {
    id: "lpr-interest",
    name: "\u6C11\u95F4\u501F\u8D37\u5229\u606F\u4E0E\u4E0A\u9650",
    category: "interest",
    glyph: "\u606F",
    summary: "\u6309\u7EA6\u5B9A\u5229\u7387\u8BA1\u606F\uFF0C\u5E76\u4EE5\u4E00\u5E74\u671F LPR \u56DB\u500D\u6821\u9A8C\u53F8\u6CD5\u4FDD\u62A4\u4E0A\u9650",
    keywords: ["LPR", "\u6C11\u95F4\u501F\u8D37", "\u56DB\u500D", "\u5229\u606F\u4E0A\u9650"],
    fields: [
      { key: "principal", label: "\u501F\u6B3E\u672C\u91D1", type: "money", unit: "\u5143", emphasis: true, defaultValue: 5e5 },
      {
        key: "agreedRate",
        label: "\u7EA6\u5B9A\u5E74\u5229\u7387",
        type: "percent",
        unit: "%",
        defaultValue: 15,
        hint: "\u5E74\u5316\u5229\u7387\uFF0C\u5982\u6708\u606F 2 \u5206\u8BF7\u586B 24"
      },
      {
        key: "lpr",
        label: "\u5408\u540C\u6210\u7ACB\u65F6\u4E00\u5E74\u671F LPR",
        type: "percent",
        unit: "%",
        defaultValue: LPR_DEFAULT,
        hint: "\u6BCF\u6708 20 \u65E5\u7531\u5168\u56FD\u94F6\u884C\u95F4\u540C\u4E1A\u62C6\u501F\u4E2D\u5FC3\u516C\u5E03\uFF0C\u52A1\u5FC5\u6838\u5BF9\u5F53\u671F\u503C"
      },
      { key: "days", label: "\u501F\u6B3E\u5929\u6570", type: "number", unit: "\u5929", defaultValue: 365 },
      {
        key: "startDate",
        label: "\u501F\u6B3E\u53D1\u653E\u65E5",
        type: "date",
        hint: "\u9009\u586B\uFF0C\u7528\u4E8E\u5C55\u793A\u8BA1\u606F\u533A\u95F4"
      },
      {
        key: "cutHead",
        label: "\u662F\u5426\u5B58\u5728\u780D\u5934\u606F",
        type: "switch",
        defaultValue: false,
        hint: "\u9884\u5148\u5728\u672C\u91D1\u4E2D\u6263\u9664\u5229\u606F\u7684\uFF0C\u6309\u5B9E\u9645\u501F\u6B3E\u6570\u989D\u8BA1\u7B97"
      },
      {
        key: "cutAmount",
        label: "\u9884\u5148\u6263\u9664\u7684\u5229\u606F",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        visibleWhen: (v) => v.cutHead === true || v.cutHead === "true"
      }
    ],
    calc(values) {
      const rawPrincipal = toNum(values.principal);
      const agreedRate = toNum(values.agreedRate) / 100;
      const lpr = toNum(values.lpr) / 100;
      const days = toNum(values.days);
      const cut = values.cutHead === true || values.cutHead === "true" ? toNum(values.cutAmount) : 0;
      const cap = round(lpr * 4 * 100, 4);
      const effectivePrincipal = round(rawPrincipal - cut, 2);
      const steps = [];
      if (cut > 0) {
        steps.push({
          label: "\u780D\u5934\u606F\u8C03\u6574\u672C\u91D1",
          value: `${money(rawPrincipal)} \u2212 ${money(cut)} = ${money(effectivePrincipal)} \u5143`,
          note: "\u300A\u6C11\u6CD5\u5178\u300B\u7B2C670\u6761\uFF1A\u5229\u606F\u9884\u5148\u5728\u672C\u91D1\u4E2D\u6263\u9664\u7684\uFF0C\u6309\u5B9E\u9645\u501F\u6B3E\u6570\u989D\u8FD4\u8FD8\u5E76\u8BA1\u606F"
        });
      }
      steps.push({
        label: "\u53F8\u6CD5\u4FDD\u62A4\u4E0A\u9650",
        value: `${toNum(values.lpr)}% \xD7 4 = ${cap}%`,
        note: "\u4E00\u5E74\u671F LPR \u56DB\u500D",
        emphasis: true
      });
      const agreedInterest = round(effectivePrincipal * agreedRate * (days / 360), 2);
      steps.push({
        label: "\u7EA6\u5B9A\u5229\u606F",
        value: `${money(effectivePrincipal)} \xD7 ${toNum(values.agreedRate)}% \xD7 ${days}/360 = ${money(agreedInterest)} \u5143`
      });
      const over = agreedRate > lpr * 4;
      const cappedInterest = over ? round(effectivePrincipal * lpr * 4 * (days / 360), 2) : agreedInterest;
      if (over) {
        steps.push({
          label: "\u8D85\u51FA\u4E0A\u9650\uFF0C\u6309\u4E0A\u9650\u8BA1\u606F",
          value: `${money(effectivePrincipal)} \xD7 ${cap}% \xD7 ${days}/360 = ${money(cappedInterest)} \u5143`,
          emphasis: true
        });
        steps.push({
          label: "\u4E0D\u4E88\u652F\u6301\u90E8\u5206",
          value: `${money(round(agreedInterest - cappedInterest, 2))} \u5143`,
          note: "\u6CD5\u9662\u5BF9\u8D85\u51FA\u90E8\u5206\u4E0D\u4E88\u652F\u6301\uFF1B\u5DF2\u81EA\u613F\u652F\u4ED8\u4E14\u672A\u635F\u5BB3\u56FD\u5BB6\u3001\u96C6\u4F53\u548C\u7B2C\u4E09\u4EBA\u5229\u76CA\u7684\uFF0C\u4E00\u822C\u4E0D\u5F97\u8BF7\u6C42\u8FD4\u8FD8"
        });
      }
      const start = parseDate(values.startDate);
      if (start) {
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        end.setDate(end.getDate() + days);
        steps.push({ label: "\u8BA1\u606F\u533A\u95F4", value: `${ymd(start)} \u81F3 ${ymd(end)}` });
      }
      return {
        main: {
          label: "\u6CD5\u9662\u652F\u6301\u7684\u5229\u606F",
          value: money(cappedInterest),
          unit: "\u5143",
          sub: over ? `\u7EA6\u5B9A ${money(agreedInterest)} \u5143\uFF0C\u5DF2\u6309 ${cap}% \u4E0A\u9650\u6838\u51CF` : moneyToChinese(cappedInterest)
        },
        blocks: [
          { label: "\u53F8\u6CD5\u4FDD\u62A4\u4E0A\u9650\uFF08\u5E74\u5316\uFF09", value: `${cap}%`, sub: `LPR ${toNum(values.lpr)}% \xD7 4` },
          { label: "\u7EA6\u5B9A\u5229\u7387\u662F\u5426\u8D85\u9650", value: over ? "\u26A0 \u5DF2\u8D85\u9650" : "\u672A\u8D85\u9650" },
          { label: "\u672C\u606F\u5408\u8BA1", value: money(round(effectivePrincipal + cappedInterest, 2)), unit: "\u5143" }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u6700\u9AD8\u4EBA\u6C11\u6CD5\u9662\u5173\u4E8E\u5BA1\u7406\u6C11\u95F4\u501F\u8D37\u6848\u4EF6\u9002\u7528\u6CD5\u5F8B\u82E5\u5E72\u95EE\u9898\u7684\u89C4\u5B9A\u300B",
            article: "\u7B2C\u4E8C\u5341\u4E94\u6761",
            text: "\u51FA\u501F\u4EBA\u8BF7\u6C42\u501F\u6B3E\u4EBA\u6309\u7167\u5408\u540C\u7EA6\u5B9A\u5229\u7387\u652F\u4ED8\u5229\u606F\u7684\uFF0C\u4EBA\u6C11\u6CD5\u9662\u5E94\u4E88\u652F\u6301\uFF0C\u4F46\u662F\u53CC\u65B9\u7EA6\u5B9A\u7684\u5229\u7387\u8D85\u8FC7\u5408\u540C\u6210\u7ACB\u65F6\u4E00\u5E74\u671F\u8D37\u6B3E\u5E02\u573A\u62A5\u4EF7\u5229\u7387\u56DB\u500D\u7684\u9664\u5916\u3002"
          },
          {
            law: "\u300A\u6C11\u6CD5\u5178\u300B",
            article: "\u7B2C\u516D\u767E\u4E03\u5341\u6761",
            text: "\u501F\u6B3E\u7684\u5229\u606F\u4E0D\u5F97\u9884\u5148\u5728\u672C\u91D1\u4E2D\u6263\u9664\u3002\u5229\u606F\u9884\u5148\u5728\u672C\u91D1\u4E2D\u6263\u9664\u7684\uFF0C\u5E94\u5F53\u6309\u7167\u5B9E\u9645\u501F\u6B3E\u6570\u989D\u8FD4\u8FD8\u501F\u6B3E\u5E76\u8BA1\u7B97\u5229\u606F\u3002"
          }
        ],
        tips: [
          '\u4E0A\u9650\u5224\u65AD\u7684\u65F6\u70B9\u662F"\u5408\u540C\u6210\u7ACB\u65F6"\u7684 LPR\uFF0C\u800C\u975E\u8D77\u8BC9\u65F6\u6216\u8FD8\u6B3E\u65F6\uFF0C\u52A1\u5FC5\u6838\u5BF9\u7B7E\u7EA6\u65E5\u5F53\u6708\u7684\u516C\u5E03\u503C\u3002',
          "LPR \u6BCF\u6708 20 \u65E5\u66F4\u65B0\uFF0C2025 \u5E74 5 \u6708\u8D77\u4E00\u5E74\u671F LPR \u4E3A 3.0%\uFF0C\u672C\u5DE5\u5177\u9ED8\u8BA4\u503C\u4E3A\u53C2\u8003\uFF0C\u8BF7\u81EA\u884C\u6838\u5BF9\u6700\u65B0\u516C\u5E03\u503C\u3002",
          "\u81EA\u7136\u4EBA\u4E4B\u95F4\u7684\u501F\u6B3E\u5408\u540C\uFF0C\u672A\u7EA6\u5B9A\u5229\u606F\u6216\u7EA6\u5B9A\u4E0D\u660E\u7684\uFF0C\u89C6\u4E3A\u4E0D\u652F\u4ED8\u5229\u606F\u3002"
        ]
      };
    }
  },
  /* ── 迟延履行期间加倍债务利息 ── */
  {
    id: "delay-interest",
    name: "\u8FDF\u5EF6\u5C65\u884C\u52A0\u500D\u5229\u606F",
    category: "interest",
    glyph: "\u5EF6",
    summary: "\u751F\u6548\u6587\u4E66\u8FDF\u5EF6\u5C65\u884C\u7684\u4E00\u822C\u503A\u52A1\u5229\u606F + \u52A0\u500D\u90E8\u5206\u503A\u52A1\u5229\u606F",
    keywords: ["\u8FDF\u5EF6\u5C65\u884C", "\u52A0\u500D\u5229\u606F", "\u4E07\u5206\u4E4B\u4E00\u70B9\u4E03\u4E94", "\u6267\u884C"],
    fields: [
      { key: "principal", label: "\u672A\u6E05\u507F\u91D1\u94B1\u503A\u52A1\u672C\u91D1", type: "money", unit: "\u5143", emphasis: true, defaultValue: 1e6 },
      {
        key: "hasGeneral",
        label: "\u751F\u6548\u6587\u4E66\u662F\u5426\u786E\u5B9A\u4E00\u822C\u503A\u52A1\u5229\u606F",
        type: "switch",
        defaultValue: true
      },
      {
        key: "generalRate",
        label: "\u4E00\u822C\u503A\u52A1\u5229\u606F\u5E74\u5229\u7387",
        type: "percent",
        unit: "%",
        defaultValue: 6,
        visibleWhen: (v) => v.hasGeneral === true || v.hasGeneral === "true"
      },
      { key: "startDate", label: "\u5C65\u884C\u671F\u95F4\u5C4A\u6EE1\u65E5", type: "date", defaultValue: "2025-01-01" },
      { key: "endDate", label: "\u5B9E\u9645\u6E05\u507F\u65E5", type: "date", defaultValue: "2026-01-01" },
      {
        key: "partial",
        label: "\u671F\u95F4\u5185\u662F\u5426\u5206\u671F\u6E05\u507F",
        type: "switch",
        defaultValue: false,
        hint: "\u5206\u671F\u6E05\u507F\u9700\u5206\u6BB5\u8BA1\u7B97\uFF0C\u6B64\u5904\u6309\u5168\u989D\u672A\u6E05\u507F\u7B80\u5316"
      }
    ],
    calc(values) {
      const principal = toNum(values.principal);
      const hasGeneral = values.hasGeneral === true || values.hasGeneral === "true";
      const gr = toNum(values.generalRate) / 100;
      const start = parseDate(values.startDate) ?? /* @__PURE__ */ new Date();
      const end = parseDate(values.endDate) ?? /* @__PURE__ */ new Date();
      const days = Math.max(0, daysBetween(start, end));
      const steps = [
        { label: "\u8FDF\u5EF6\u671F\u95F4", value: `${ymd(start)} \u81F3 ${ymd(end)}\uFF0C\u5171 ${days} \u5929` }
      ];
      let general = 0;
      if (hasGeneral) {
        general = round(principal * gr * (days / 360), 2);
        steps.push({
          label: "\u4E00\u822C\u503A\u52A1\u5229\u606F",
          value: `${money(principal)} \xD7 ${toNum(values.generalRate)}% \xD7 ${days}/360 = ${money(general)} \u5143`,
          note: "\u6309\u751F\u6548\u6CD5\u5F8B\u6587\u4E66\u786E\u5B9A\u7684\u65B9\u6CD5\u8BA1\u7B97\uFF1B\u6587\u4E66\u672A\u786E\u5B9A\u7684\u4E0D\u4E88\u8BA1\u7B97"
        });
      } else {
        steps.push({ label: "\u4E00\u822C\u503A\u52A1\u5229\u606F", value: "0 \u5143", note: "\u751F\u6548\u6587\u4E66\u672A\u786E\u5B9A\u4E00\u822C\u503A\u52A1\u5229\u606F" });
      }
      const doubled = round(principal * DOUBLE_RATE_DAILY * days, 2);
      steps.push({
        label: "\u52A0\u500D\u90E8\u5206\u503A\u52A1\u5229\u606F",
        value: `${money(principal)} \xD7 0.0175% \xD7 ${days} \u5929 = ${money(doubled)} \u5143`,
        note: "\u65E5\u4E07\u5206\u4E4B\u4E00\u70B9\u4E03\u4E94\uFF0C\u4E0D\u56E0\u4E00\u822C\u503A\u52A1\u5229\u606F\u7684\u6709\u65E0\u800C\u53D8\u5316",
        emphasis: true
      });
      const total = round(general + doubled, 2);
      steps.push({ label: "\u8FDF\u5EF6\u5C65\u884C\u671F\u95F4\u503A\u52A1\u5229\u606F\u5408\u8BA1", value: `${money(total)} \u5143`, emphasis: true });
      const annualized = round(DOUBLE_RATE_DAILY * 365 * 100, 4);
      return {
        main: { label: "\u8FDF\u5EF6\u5C65\u884C\u671F\u95F4\u503A\u52A1\u5229\u606F", value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        blocks: [
          { label: "\u4E00\u822C\u503A\u52A1\u5229\u606F", value: money(general), unit: "\u5143" },
          { label: "\u52A0\u500D\u90E8\u5206\u503A\u52A1\u5229\u606F", value: money(doubled), unit: "\u5143" },
          { label: "\u52A0\u500D\u90E8\u5206\u6298\u5408\u5E74\u5316", value: `${annualized}%`, sub: "\u65E5\u4E07\u5206\u4E4B\u4E00\u70B9\u4E03\u4E94 \xD7 365" },
          { label: "\u672C\u606F\u5408\u8BA1", value: money(round(principal + total, 2)), unit: "\u5143" }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u6700\u9AD8\u4EBA\u6C11\u6CD5\u9662\u5173\u4E8E\u6267\u884C\u7A0B\u5E8F\u4E2D\u8BA1\u7B97\u8FDF\u5EF6\u5C65\u884C\u671F\u95F4\u7684\u503A\u52A1\u5229\u606F\u9002\u7528\u6CD5\u5F8B\u82E5\u5E72\u95EE\u9898\u7684\u89E3\u91CA\u300B",
            article: "\u7B2C\u4E00\u6761",
            text: "\u8FDF\u5EF6\u5C65\u884C\u671F\u95F4\u7684\u503A\u52A1\u5229\u606F\u5305\u62EC\u8FDF\u5EF6\u5C65\u884C\u671F\u95F4\u7684\u4E00\u822C\u503A\u52A1\u5229\u606F\u548C\u52A0\u500D\u90E8\u5206\u503A\u52A1\u5229\u606F\u3002\u52A0\u500D\u90E8\u5206\u503A\u52A1\u5229\u606F\u7684\u8BA1\u7B97\u65B9\u6CD5\u4E3A\uFF1A\u52A0\u500D\u90E8\u5206\u503A\u52A1\u5229\u606F\uFF1D\u503A\u52A1\u4EBA\u5C1A\u672A\u6E05\u507F\u7684\u751F\u6548\u6CD5\u5F8B\u6587\u4E66\u786E\u5B9A\u7684\u9664\u4E00\u822C\u503A\u52A1\u5229\u606F\u4E4B\u5916\u7684\u91D1\u94B1\u503A\u52A1\xD7\u65E5\u4E07\u5206\u4E4B\u4E00\u70B9\u4E03\u4E94\xD7\u8FDF\u5EF6\u5C65\u884C\u671F\u95F4\u3002"
          },
          {
            law: "\u300A\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u300B",
            article: "\u7B2C\u4E8C\u767E\u516D\u5341\u56DB\u6761",
            text: "\u88AB\u6267\u884C\u4EBA\u672A\u6309\u5224\u51B3\u3001\u88C1\u5B9A\u548C\u5176\u4ED6\u6CD5\u5F8B\u6587\u4E66\u6307\u5B9A\u7684\u671F\u95F4\u5C65\u884C\u7ED9\u4ED8\u91D1\u94B1\u4E49\u52A1\u7684\uFF0C\u5E94\u5F53\u52A0\u500D\u652F\u4ED8\u8FDF\u5EF6\u5C65\u884C\u671F\u95F4\u7684\u503A\u52A1\u5229\u606F\u3002"
          },
          {
            law: "\u300A\u8FDF\u5EF6\u5C65\u884C\u5229\u606F\u89E3\u91CA\u300B",
            article: "\u7B2C\u56DB\u6761",
            text: "\u88AB\u6267\u884C\u4EBA\u7684\u8D22\u4EA7\u4E0D\u8DB3\u4EE5\u6E05\u507F\u5168\u90E8\u503A\u52A1\u7684\uFF0C\u5E94\u5F53\u5148\u6E05\u507F\u751F\u6548\u6CD5\u5F8B\u6587\u4E66\u786E\u5B9A\u7684\u91D1\u94B1\u503A\u52A1\uFF0C\u518D\u6E05\u507F\u52A0\u500D\u90E8\u5206\u503A\u52A1\u5229\u606F\uFF0C\u4F46\u5F53\u4E8B\u4EBA\u5BF9\u6E05\u507F\u987A\u5E8F\u53E6\u6709\u7EA6\u5B9A\u7684\u9664\u5916\u3002"
          }
        ],
        tips: [
          '\u52A0\u500D\u90E8\u5206\u503A\u52A1\u5229\u606F\u7684\u8BA1\u606F\u57FA\u6570\u4E0D\u542B\u4E00\u822C\u503A\u52A1\u5229\u606F\uFF0C\u4EC5\u4EE5"\u91D1\u94B1\u503A\u52A1\u672C\u91D1"\u4E3A\u57FA\u6570\uFF0C\u8FD9\u662F\u5B9E\u52A1\u4E2D\u6700\u5E38\u89C1\u7684\u8BA1\u7B97\u9519\u8BEF\u3002',
          "\u8D77\u70B9\uFF1A\u5C65\u884C\u671F\u95F4\u5C4A\u6EE1\u4E4B\u65E5\uFF1B\u5206\u671F\u5C65\u884C\u7684\u81EA\u6BCF\u671F\u5C4A\u6EE1\u65E5\u8D77\u7B97\uFF1B\u672A\u786E\u5B9A\u5C65\u884C\u671F\u95F4\u7684\u81EA\u6CD5\u5F8B\u6587\u4E66\u751F\u6548\u4E4B\u65E5\u8D77\u7B97\u3002",
          "\u8D22\u4EA7\u4E0D\u8DB3\u6E05\u507F\u5168\u90E8\u503A\u52A1\u65F6\uFF0C\u6E05\u507F\u987A\u5E8F\u4E3A\uFF1A\u672C\u91D1 \u2192 \u4E00\u822C\u503A\u52A1\u5229\u606F \u2192 \u52A0\u500D\u90E8\u5206\u5229\u606F\uFF08\u5F53\u4E8B\u4EBA\u53E6\u6709\u7EA6\u5B9A\u9664\u5916\uFF09\u3002"
        ]
      };
    }
  },
  /* ── 一般债务利息（单利/复利） ── */
  {
    id: "general-interest",
    name: "\u4E00\u822C\u503A\u52A1\u5229\u606F",
    category: "interest",
    glyph: "\u5229",
    summary: "\u5355\u5229 / \u590D\u5229\u4E24\u79CD\u53E3\u5F84\u7684\u5229\u606F\u8BA1\u7B97\uFF0C\u652F\u6301\u5206\u6BB5\u5229\u7387",
    keywords: ["\u5355\u5229", "\u590D\u5229", "\u5229\u606F", "\u5E74\u5229\u7387"],
    fields: [
      { key: "principal", label: "\u672C\u91D1", type: "money", unit: "\u5143", emphasis: true, defaultValue: 1e6 },
      { key: "rate", label: "\u5E74\u5229\u7387", type: "percent", unit: "%", defaultValue: 6 },
      {
        key: "mode",
        label: "\u8BA1\u606F\u65B9\u5F0F",
        type: "select",
        defaultValue: "simple",
        options: [
          { label: "\u5355\u5229", value: "simple" },
          { label: "\u590D\u5229\uFF08\u5E74\u590D\u5229\uFF09", value: "compound" }
        ]
      },
      { key: "startDate", label: "\u8D77\u606F\u65E5", type: "date", defaultValue: "2023-01-01" },
      { key: "endDate", label: "\u622A\u6B62\u65E5", type: "date", defaultValue: "2026-01-01" },
      {
        key: "dayBase",
        label: "\u5E74\u5929\u6570\u57FA\u6570",
        type: "select",
        defaultValue: "360",
        options: [
          { label: "360 \u5929\uFF08\u91D1\u878D\u60EF\u4F8B\uFF09", value: "360" },
          { label: "365 \u5929\uFF08\u53F8\u6CD5\u5E38\u7528\uFF09", value: "365" }
        ]
      }
    ],
    calc(values) {
      const p = toNum(values.principal);
      const r = toNum(values.rate) / 100;
      const mode = toStr(values.mode, "simple");
      const start = parseDate(values.startDate) ?? /* @__PURE__ */ new Date();
      const end = parseDate(values.endDate) ?? /* @__PURE__ */ new Date();
      const base = toNum(values.dayBase, 360);
      const days = Math.max(0, daysBetween(start, end));
      const years = days / base;
      const steps = [{ label: "\u8BA1\u606F\u671F\u95F4", value: `${ymd(start)} \u81F3 ${ymd(end)}\uFF0C\u5171 ${days} \u5929\uFF08${years.toFixed(4)} \u5E74\uFF09` }];
      let interest = 0;
      if (mode === "simple") {
        interest = round(p * r * years, 2);
        steps.push({ label: "\u5355\u5229\u8BA1\u7B97", value: `${money(p)} \xD7 ${toNum(values.rate)}% \xD7 ${years.toFixed(4)} = ${money(interest)} \u5143` });
      } else {
        const n = Math.floor(years);
        const frac = years - n;
        const full = round(p * Math.pow(1 + r, n), 2);
        interest = round(full + full * r * frac - p, 2);
        steps.push({ label: `\u590D\u5229 ${n} \u4E2A\u5B8C\u6574\u5E74\u5EA6`, value: `${money(p)} \xD7 (1 + ${toNum(values.rate)}%)^${n} = ${money(full)} \u5143` });
        if (frac > 0) {
          steps.push({ label: `\u4F59\u6570 ${frac.toFixed(4)} \u5E74\u6309\u5355\u5229`, value: `+ ${money(round(full * r * frac, 2))} \u5143` });
        }
        steps.push({ label: "\u5229\u606F\u5408\u8BA1", value: `${money(interest)} \u5143`, emphasis: true });
      }
      return {
        main: { label: "\u5229\u606F\u91D1\u989D", value: money(interest), unit: "\u5143", sub: moneyToChinese(interest) },
        blocks: [
          { label: "\u672C\u606F\u5408\u8BA1", value: money(round(p + interest, 2)), unit: "\u5143" },
          { label: "\u5B9E\u9645\u5E74\u5316\u6210\u672C", value: `${(interest / Math.max(p, 1) / Math.max(years, 1e-4) * 100).toFixed(3)}%` }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u6C11\u6CD5\u5178\u300B",
            article: "\u7B2C\u516D\u767E\u516B\u5341\u6761",
            text: "\u501F\u6B3E\u5408\u540C\u5BF9\u652F\u4ED8\u5229\u606F\u6CA1\u6709\u7EA6\u5B9A\u7684\uFF0C\u89C6\u4E3A\u6CA1\u6709\u5229\u606F\u3002\u501F\u6B3E\u5408\u540C\u5BF9\u652F\u4ED8\u5229\u606F\u7EA6\u5B9A\u4E0D\u660E\u786E\uFF0C\u5F53\u4E8B\u4EBA\u4E0D\u80FD\u8FBE\u6210\u8865\u5145\u534F\u8BAE\u7684\uFF0C\u6309\u7167\u5F53\u5730\u6216\u8005\u5F53\u4E8B\u4EBA\u7684\u4EA4\u6613\u65B9\u5F0F\u3001\u4EA4\u6613\u4E60\u60EF\u3001\u5E02\u573A\u5229\u7387\u7B49\u56E0\u7D20\u786E\u5B9A\u5229\u606F\u3002"
          }
        ],
        tips: [
          '\u53F8\u6CD5\u5B9E\u52A1\u4E2D"\u590D\u5229"\u53D7\u4E25\u683C\u9650\u5236\uFF1A\u4EC5\u5728\u501F\u6B3E\u671F\u9650\u5C4A\u6EE1\u540E\u7ECF\u53CC\u65B9\u786E\u8BA4\u5C06\u524D\u671F\u5229\u606F\u8BA1\u5165\u540E\u671F\u672C\u91D1\uFF0C\u4E14\u524D\u671F\u5229\u7387\u672A\u8D85\u4E0A\u9650\u65F6\uFF0C\u65B9\u53EF\u90E8\u5206\u652F\u6301\u3002',
          "\u6CD5\u9662\u5224\u51B3\u5229\u606F\u901A\u5E38\u6309 365 \u5929\u4E3A\u5E74\u57FA\u6570\uFF0C\u91D1\u878D\u5408\u540C\u5E38\u7EA6\u5B9A 360 \u5929\uFF0C\u4E24\u8005\u5728\u957F\u5468\u671F\u4E0B\u5DEE\u5F02\u660E\u663E\u3002"
        ]
      };
    }
  },
  /* ── 逾期付款违约金 ── */
  {
    id: "contract-penalty",
    name: "\u8FDD\u7EA6\u91D1\u8BA1\u7B97\u5668",
    category: "interest",
    glyph: "\u8FDD",
    summary: "\u6309\u65E5\u4E07\u5206\u4E4BX \u6216\u56FA\u5B9A\u91D1\u989D\u8BA1\u7B97\u903E\u671F\u8FDD\u7EA6\u91D1\uFF0C\u5E76\u540C\u6B65\u6821\u9A8C\u53F8\u6CD5\u4FDD\u62A4\u4E0A\u9650",
    keywords: ["\u8FDD\u7EA6\u91D1", "\u903E\u671F\u4ED8\u6B3E", "\u65E5\u4E07\u5206\u4E4B", "\u8FDD\u7EA6"],
    fields: [
      { key: "principal", label: "\u8FDD\u7EA6\u6240\u6D89\u4EF7\u6B3E / \u672C\u91D1", type: "money", unit: "\u5143", emphasis: true, defaultValue: 1e6 },
      {
        key: "mode",
        label: "\u8FDD\u7EA6\u91D1\u7EA6\u5B9A\u65B9\u5F0F",
        type: "select",
        defaultValue: "daily",
        options: [
          { label: "\u6309\u65E5\u8BA1\u7B97\uFF08\u65E5\u4E07\u5206\u4E4BX\uFF09", value: "daily" },
          { label: "\u4E00\u6B21\u6027\u56FA\u5B9A\u91D1\u989D", value: "fixed" },
          { label: "\u6309\u672A\u4ED8\u6B3E\u6BD4\u4F8B", value: "proportion" }
        ]
      },
      {
        key: "dailyRate",
        label: "\u65E5\u8FDD\u7EA6\u91D1\u7387",
        type: "number",
        unit: "\u2031\uFF08\u4E07\u5206\u4E4B\uFF09",
        defaultValue: 5,
        hint: "\u5E38\u89C1\u7EA6\u5B9A\u4E3A\u65E5\u4E07\u5206\u4E4B\u4E09\u81F3\u4E07\u5206\u4E4B\u4E94",
        visibleWhen: (v) => toStr(v.mode) === "daily"
      },
      {
        key: "fixedAmount",
        label: "\u7EA6\u5B9A\u8FDD\u7EA6\u91D1\u91D1\u989D",
        type: "money",
        unit: "\u5143",
        defaultValue: 1e5,
        visibleWhen: (v) => toStr(v.mode) === "fixed"
      },
      {
        key: "propRate",
        label: "\u8FDD\u7EA6\u91D1\u6BD4\u4F8B",
        type: "percent",
        unit: "%",
        defaultValue: 20,
        visibleWhen: (v) => toStr(v.mode) === "proportion"
      },
      { key: "startDate", label: "\u8FDD\u7EA6\u884C\u4E3A\u53D1\u751F\u65E5", type: "date", defaultValue: "2025-01-01" },
      { key: "endDate", label: "\u8BA1\u7B97\u622A\u6B62\u65E5", type: "date", defaultValue: "2026-01-01" },
      {
        key: "capRate",
        label: "\u5408\u540C\u7EA6\u5B9A\u7684\u8FDD\u7EA6\u91D1\u4E0A\u9650",
        type: "percent",
        unit: "%",
        defaultValue: 30,
        hint: "\u586B 0 \u8868\u793A\u5408\u540C\u672A\u7EA6\u5B9A\u4E0A\u9650"
      },
      {
        key: "actualLoss",
        label: "\u5B9E\u9645\u635F\u5931\uFF08\u7528\u4E8E\u8C03\u51CF\u5BA1\u67E5\uFF09",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        hint: "\u586B 0 \u8868\u793A\u6682\u4E0D\u5BA1\u67E5"
      }
    ],
    calc(values) {
      const p = toNum(values.principal);
      const mode = toStr(values.mode, "daily");
      const start = parseDate(values.startDate) ?? /* @__PURE__ */ new Date();
      const end = parseDate(values.endDate) ?? /* @__PURE__ */ new Date();
      const days = Math.max(0, daysBetween(start, end));
      const capRate = toNum(values.capRate) / 100;
      const actualLoss = toNum(values.actualLoss);
      const steps = [
        { label: "\u8FDD\u7EA6\u6301\u7EED\u671F\u95F4", value: `${ymd(start)} \u81F3 ${ymd(end)}\uFF0C\u5171 ${days} \u5929` }
      ];
      let raw = 0;
      let rateDesc = "";
      if (mode === "daily") {
        const d = toNum(values.dailyRate) / 1e4;
        raw = round(p * d * days, 2);
        rateDesc = `\u65E5\u4E07\u5206\u4E4B ${toNum(values.dailyRate)}`;
        steps.push({ label: `\u6309\u65E5\u8BA1\u7B97`, value: `${money(p)} \xD7 ${toNum(values.dailyRate)}\u2031 \xD7 ${days} \u5929 = ${money(raw)} \u5143` });
        steps.push({ label: "\u6298\u5408\u5E74\u5316", value: `${(d * 365 * 100).toFixed(2)}%` });
      } else if (mode === "fixed") {
        raw = toNum(values.fixedAmount);
        rateDesc = "\u56FA\u5B9A\u91D1\u989D";
        steps.push({ label: "\u7EA6\u5B9A\u56FA\u5B9A\u8FDD\u7EA6\u91D1", value: `${money(raw)} \u5143` });
      } else {
        const pr = toNum(values.propRate) / 100;
        raw = round(p * pr, 2);
        rateDesc = `\u672A\u4ED8\u6B3E\u7684 ${toNum(values.propRate)}%`;
        steps.push({ label: "\u6309\u6BD4\u4F8B\u8BA1\u7B97", value: `${money(p)} \xD7 ${toNum(values.propRate)}% = ${money(raw)} \u5143` });
      }
      let capped = raw;
      if (capRate > 0) {
        const cap = round(p * capRate, 2);
        if (raw > cap) {
          capped = cap;
          steps.push({
            label: "\u89E6\u53D1\u5408\u540C\u8FDD\u7EA6\u91D1\u4E0A\u9650",
            value: `${money(p)} \xD7 ${toNum(values.capRate)}% = ${money(cap)} \u5143`,
            emphasis: true,
            note: "\u5408\u540C\u7EA6\u5B9A\u4E0A\u9650\u4F18\u5148\u4E8E\u6309\u65E5\u7D2F\u8BA1\u7ED3\u679C"
          });
        } else {
          steps.push({ label: "\u5408\u540C\u4E0A\u9650\u6821\u9A8C", value: `\u4E0A\u9650 ${money(cap)} \u5143\uFF0C\u672A\u89E6\u53D1` });
        }
      }
      const blocks = [
        { label: "\u8FDD\u7EA6\u91D1\u8BA1\u7B97\u53E3\u5F84", value: rateDesc },
        { label: "\u5360\u672C\u91D1\u6BD4\u4F8B", value: `${(capped / Math.max(p, 1) * 100).toFixed(2)}%` }
      ];
      if (actualLoss > 0) {
        const threshold = round(actualLoss * 1.3, 2);
        const excessive = capped > threshold;
        steps.push({
          label: "\u53F8\u6CD5\u8C03\u51CF\u5BA1\u67E5\uFF08\u635F\u5931 \xD7 130%\uFF09",
          value: `${money(actualLoss)} \xD7 130% = ${money(threshold)} \u5143`,
          emphasis: true
        });
        steps.push({
          label: "\u5BA1\u67E5\u7ED3\u8BBA",
          value: excessive ? '\u26A0 \u8D85\u8FC7\u635F\u5931 30%\uFF0C\u4E00\u822C\u53EF\u8BA4\u5B9A\u4E3A"\u8FC7\u5206\u9AD8\u4E8E\u9020\u6210\u7684\u635F\u5931"' : "\u672A\u8D85\u8FC7\u635F\u5931 30%\uFF0C\u901A\u5E38\u4E88\u4EE5\u652F\u6301",
          note: "\u300A\u6C11\u6CD5\u5178\u5408\u540C\u7F16\u901A\u5219\u53F8\u6CD5\u89E3\u91CA\u300B\u7B2C65\u6761"
        });
        blocks.push({
          label: "\u9884\u4F30\u8C03\u51CF\u540E\u91D1\u989D",
          value: excessive ? money(threshold) : money(capped),
          unit: "\u5143",
          sub: excessive ? "\u4EE5\u635F\u5931 130% \u4E3A\u53C2\u8003\u4E0A\u9650" : "\u65E0\u9700\u8C03\u51CF"
        });
      }
      return {
        main: { label: "\u8FDD\u7EA6\u91D1\u91D1\u989D", value: money(capped), unit: "\u5143", sub: moneyToChinese(capped) },
        blocks,
        steps,
        basis: [
          {
            law: "\u300A\u6C11\u6CD5\u5178\u300B",
            article: "\u7B2C\u4E94\u767E\u516B\u5341\u4E94\u6761",
            text: "\u5F53\u4E8B\u4EBA\u53EF\u4EE5\u7EA6\u5B9A\u4E00\u65B9\u8FDD\u7EA6\u65F6\u5E94\u5F53\u6839\u636E\u8FDD\u7EA6\u60C5\u51B5\u5411\u5BF9\u65B9\u652F\u4ED8\u4E00\u5B9A\u6570\u989D\u7684\u8FDD\u7EA6\u91D1\uFF0C\u4E5F\u53EF\u4EE5\u7EA6\u5B9A\u56E0\u8FDD\u7EA6\u4EA7\u751F\u7684\u635F\u5931\u8D54\u507F\u989D\u7684\u8BA1\u7B97\u65B9\u6CD5\u3002\u7EA6\u5B9A\u7684\u8FDD\u7EA6\u91D1\u4F4E\u4E8E\u9020\u6210\u7684\u635F\u5931\u7684\uFF0C\u4EBA\u6C11\u6CD5\u9662\u6216\u8005\u4EF2\u88C1\u673A\u6784\u53EF\u4EE5\u6839\u636E\u5F53\u4E8B\u4EBA\u7684\u8BF7\u6C42\u4E88\u4EE5\u589E\u52A0\uFF1B\u7EA6\u5B9A\u7684\u8FDD\u7EA6\u91D1\u8FC7\u5206\u9AD8\u4E8E\u9020\u6210\u7684\u635F\u5931\u7684\uFF0C\u4EBA\u6C11\u6CD5\u9662\u6216\u8005\u4EF2\u88C1\u673A\u6784\u53EF\u4EE5\u6839\u636E\u5F53\u4E8B\u4EBA\u7684\u8BF7\u6C42\u4E88\u4EE5\u9002\u5F53\u51CF\u5C11\u3002"
          },
          {
            law: "\u300A\u6C11\u6CD5\u5178\u5408\u540C\u7F16\u901A\u5219\u53F8\u6CD5\u89E3\u91CA\u300B",
            article: "\u7B2C\u516D\u5341\u4E94\u6761",
            text: '\u7EA6\u5B9A\u7684\u8FDD\u7EA6\u91D1\u8D85\u8FC7\u9020\u6210\u635F\u5931\u7684\u767E\u5206\u4E4B\u4E09\u5341\u7684\uFF0C\u4EBA\u6C11\u6CD5\u9662\u4E00\u822C\u53EF\u4EE5\u8BA4\u5B9A\u4E3A\u6C11\u6CD5\u5178\u7B2C\u4E94\u767E\u516B\u5341\u4E94\u6761\u7B2C\u4E8C\u6B3E\u89C4\u5B9A\u7684"\u8FC7\u5206\u9AD8\u4E8E\u9020\u6210\u7684\u635F\u5931"\u3002'
          }
        ],
        tips: [
          '\u8FDD\u7EA6\u91D1\u8C03\u51CF\u4EE5"\u5F53\u4E8B\u4EBA\u8BF7\u6C42"\u4E3A\u524D\u63D0\uFF0C\u6CD5\u9662\u4E00\u822C\u4E0D\u4E3B\u52A8\u8C03\u6574\uFF0C\u88AB\u544A\u9700\u660E\u786E\u63D0\u51FA\u6297\u8FA9\u3002',
          "\u4E3B\u5F20\u8FDD\u7EA6\u91D1\u8FC7\u9AD8\u7684\u4E00\u65B9\u5E94\u627F\u62C5\u521D\u6B65\u4E3E\u8BC1\u8D23\u4EFB\uFF0C\u4E4B\u540E\u7531\u4E3B\u5F20\u8FDD\u7EA6\u91D1\u7684\u4E00\u65B9\u4E3E\u8BC1\u5B9E\u9645\u635F\u5931\u3002",
          "\u65E5\u4E07\u5206\u4E4B\u4E94\u6298\u5408\u5E74\u5316 18.25%\uFF0C\u5728\u957F\u5468\u671F\u903E\u671F\u4E2D\u6781\u6613\u88AB\u8C03\u51CF\uFF0C\u5EFA\u8BAE\u540C\u6B65\u7EA6\u5B9A 30% \u603B\u989D\u4E0A\u9650\u4EE5\u63D0\u9AD8\u7A33\u5B9A\u6027\u3002"
        ]
      };
    }
  },
  /* ── 违约金司法调减 ── */
  {
    id: "penalty-adjust",
    name: "\u8FDD\u7EA6\u91D1\u53F8\u6CD5\u8C03\u6574",
    category: "interest",
    glyph: "\u8C03",
    summary: "\u4EE5\u5B9E\u9645\u635F\u5931\u4E3A\u57FA\u51C6\uFF0C\u6D4B\u7B97\u6CD5\u9662\u53EF\u80FD\u8C03\u589E / \u8C03\u51CF\u540E\u7684\u8FDD\u7EA6\u91D1\u533A\u95F4",
    keywords: ["\u8FDD\u7EA6\u91D1\u8C03\u51CF", "\u8FDD\u7EA6\u91D1\u8FC7\u9AD8", "\u635F\u593130%", "\u53F8\u6CD5\u8C03\u6574"],
    fields: [
      { key: "agreed", label: "\u7EA6\u5B9A\u8FDD\u7EA6\u91D1\u91D1\u989D", type: "money", unit: "\u5143", defaultValue: 5e5 },
      { key: "loss", label: "\u5B88\u7EA6\u65B9\u5B9E\u9645\u635F\u5931", type: "money", unit: "\u5143", defaultValue: 2e5 },
      {
        key: "fault",
        label: "\u8FDD\u7EA6\u65B9\u8FC7\u9519\u7A0B\u5EA6",
        type: "select",
        defaultValue: "intentional",
        options: [
          { label: "\u6545\u610F\u8FDD\u7EA6", value: "intentional" },
          { label: "\u91CD\u5927\u8FC7\u5931", value: "gross" },
          { label: "\u4E00\u822C\u8FC7\u5931", value: "ordinary" },
          { label: "\u65E0\u8FC7\u9519\uFF08\u4E0D\u53EF\u6297\u529B\u7B49\uFF09", value: "none" }
        ]
      },
      {
        key: "performed",
        label: "\u5408\u540C\u5DF2\u5C65\u884C\u6BD4\u4F8B",
        type: "percent",
        unit: "%",
        defaultValue: 50,
        hint: "\u5DF2\u5C65\u884C\u6BD4\u4F8B\u8D8A\u9AD8\uFF0C\u8FDD\u7EA6\u91D1\u8D8A\u5BB9\u6613\u88AB\u8C03\u51CF"
      },
      {
        key: "partyType",
        label: "\u5B88\u7EA6\u65B9\u4E3B\u4F53\u7C7B\u578B",
        type: "select",
        defaultValue: "enterprise",
        options: [
          { label: "\u4F01\u4E1A\uFF08\u5546\u4E8B\u4E3B\u4F53\uFF09", value: "enterprise" },
          { label: "\u6D88\u8D39\u8005 / \u81EA\u7136\u4EBA", value: "consumer" }
        ]
      }
    ],
    calc(values) {
      const agreed = toNum(values.agreed);
      const loss = toNum(values.loss);
      const fault = toStr(values.fault, "intentional");
      const performed = toNum(values.performed) / 100;
      const partyType = toStr(values.partyType, "enterprise");
      const steps = [
        { label: "\u57FA\u7840\u635F\u5931", value: `${money(loss)} \u5143` },
        { label: "\u7EA6\u5B9A\u8FDD\u7EA6\u91D1", value: `${money(agreed)} \u5143` }
      ];
      const faultCoef = fault === "intentional" ? 0.15 : fault === "gross" ? 0.08 : fault === "ordinary" ? 0 : -0.08;
      const faultLabel = fault === "intentional" ? "\u6545\u610F\u8FDD\u7EA6 +15%" : fault === "gross" ? "\u91CD\u5927\u8FC7\u5931 +8%" : fault === "ordinary" ? "\u4E00\u822C\u8FC7\u5931 \xB10%" : "\u65E0\u8FC7\u9519 \u22128%";
      steps.push({ label: "\u8FC7\u9519\u7A0B\u5EA6\u8C03\u6574", value: faultLabel, note: "\u300A\u6C11\u6CD5\u5178\u5408\u540C\u7F16\u901A\u5219\u53F8\u6CD5\u89E3\u91CA\u300B\u7B2C65\u6761\u5217\u4E3E\u7684\u8861\u91CF\u56E0\u7D20" });
      const perfCoef = round((performed - 0.5) * -0.1, 4);
      steps.push({
        label: "\u5C65\u884C\u60C5\u51B5\u8C03\u6574",
        value: `\u5DF2\u5C65\u884C ${toNum(values.performed)}% \u2192 ${perfCoef >= 0 ? "+" : ""}${(perfCoef * 100).toFixed(1)}%`
      });
      const partyCoef = partyType === "enterprise" ? 0.1 : -0.05;
      steps.push({
        label: "\u4E3B\u4F53\u7C7B\u578B\u8C03\u6574",
        value: partyType === "enterprise" ? "\u5546\u4E8B\u4E3B\u4F53 +10%\uFF08\u5C0A\u91CD\u610F\u601D\u81EA\u6CBB\uFF09" : "\u6D88\u8D39\u8005 \u22125%\uFF08\u503E\u659C\u4FDD\u62A4\uFF09"
      });
      const coef = round(1 + faultCoef + perfCoef + partyCoef, 4);
      const estimated = round(loss * 1.3 * coef, 2);
      const threshold = round(loss * 1.3, 2);
      steps.push({ label: "\u7EFC\u5408\u7CFB\u6570", value: `${coef.toFixed(3)}` });
      steps.push({
        label: "\u914C\u5B9A\u652F\u6301\u91D1\u989D",
        value: `${money(loss)} \xD7 130% \xD7 ${coef.toFixed(3)} = ${money(estimated)} \u5143`,
        emphasis: true
      });
      const final = Math.min(agreed, estimated);
      steps.push({
        label: "\u4E0E\u7EA6\u5B9A\u91D1\u989D\u6BD4\u8F83\u53D6\u4F4E",
        value: `min(${money(agreed)}, ${money(estimated)}) = ${money(final)} \u5143`,
        emphasis: true
      });
      const excessive = agreed > threshold;
      return {
        main: {
          label: "\u9884\u4F30\u6CD5\u9662\u652F\u6301\u91D1\u989D",
          value: money(final),
          unit: "\u5143",
          sub: final < agreed ? `\u8F83\u7EA6\u5B9A\u91D1\u989D\u8C03\u51CF ${money(round(agreed - final, 2))} \u5143` : moneyToChinese(final)
        },
        blocks: [
          { label: "\u635F\u5931 130% \u53C2\u8003\u7EBF", value: money(threshold), unit: "\u5143" },
          { label: '\u662F\u5426\u6784\u6210"\u8FC7\u5206\u9AD8\u4E8E"', value: excessive ? "\u662F\uFF08\u8D85\u8FC7\u635F\u5931 30%\uFF09" : "\u5426" },
          {
            label: "\u8C03\u51CF\u5E45\u5EA6",
            value: final < agreed ? `${((agreed - final) / Math.max(agreed, 1) * 100).toFixed(2)}%` : "0%"
          }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u6C11\u6CD5\u5178\u5408\u540C\u7F16\u901A\u5219\u53F8\u6CD5\u89E3\u91CA\u300B",
            article: "\u7B2C\u516D\u5341\u4E94\u6761",
            text: "\u5F53\u4E8B\u4EBA\u4E3B\u5F20\u7EA6\u5B9A\u7684\u8FDD\u7EA6\u91D1\u8FC7\u9AD8\u8BF7\u6C42\u4E88\u4EE5\u9002\u5F53\u51CF\u5C11\u7684\uFF0C\u4EBA\u6C11\u6CD5\u9662\u5E94\u5F53\u4EE5\u8FDD\u7EA6\u9020\u6210\u7684\u635F\u5931\u4E3A\u57FA\u7840\uFF0C\u517C\u987E\u5408\u540C\u4E3B\u4F53\u3001\u4EA4\u6613\u7C7B\u578B\u3001\u5408\u540C\u7684\u5C65\u884C\u60C5\u51B5\u3001\u5F53\u4E8B\u4EBA\u7684\u8FC7\u9519\u7A0B\u5EA6\u3001\u5C65\u7EA6\u80CC\u666F\u7B49\u56E0\u7D20\uFF0C\u9075\u5FAA\u516C\u5E73\u539F\u5219\u548C\u8BDA\u4FE1\u539F\u5219\u8FDB\u884C\u8861\u91CF\uFF0C\u5E76\u4F5C\u51FA\u88C1\u5224\u3002"
          }
        ],
        tips: [
          "\u672C\u5DE5\u5177\u4E3A\u57FA\u4E8E\u88C1\u91CF\u56E0\u7D20\u7684\u4F30\u7B97\u6A21\u578B\uFF0C\u4E2A\u6848\u88C1\u5224\u7ED3\u679C\u53D7\u6CD5\u5B98\u81EA\u7531\u88C1\u91CF\u5F71\u54CD\uFF0C\u4EC5\u4F9B\u8C08\u5224\u4E0E\u9884\u671F\u7BA1\u7406\u53C2\u8003\u3002",
          '\u8FDD\u7EA6\u91D1\u517C\u5177\u8865\u507F\u6027\u4E0E\u60E9\u7F5A\u6027\uFF0C"\u8D85\u8FC7\u635F\u5931 30%"\u53EA\u662F\u4E00\u822C\u53C2\u8003\u7EBF\uFF0C\u5E76\u975E\u7EDD\u5BF9\u7EA2\u7EBF\uFF0C\u5546\u4E8B\u5408\u540C\u4E2D\u8F83\u9AD8\u7EA6\u5B9A\u88AB\u652F\u6301\u7684\u6848\u4F8B\u5E76\u4E0D\u5C11\u89C1\u3002',
          "\u5B88\u7EA6\u65B9\u5E94\u91CD\u70B9\u4E3E\u8BC1\u5B9E\u9645\u635F\u5931\uFF08\u542B\u53EF\u5F97\u5229\u76CA\u635F\u5931\uFF09\uFF0C\u635F\u5931\u4E3E\u8BC1\u8D8A\u5145\u5206\uFF0C\u8C03\u51CF\u7A7A\u95F4\u8D8A\u5C0F\u3002"
        ]
      };
    }
  },
  /* ── 借款利率合规体检 ── */
  {
    id: "loan-compliance",
    name: "\u501F\u6B3E\u5229\u7387\u5408\u89C4\u4F53\u68C0",
    category: "interest",
    glyph: "\u68C0",
    summary: "\u780D\u5934\u606F\u8FD8\u539F\u3001\u7EFC\u5408\u8D39\u7387\u6D4B\u7B97\u4E0E\u8D85\u4E0A\u9650\u98CE\u9669\u9884\u8B66",
    keywords: ["\u780D\u5934\u606F", "\u7EFC\u5408\u8D39\u7387", "\u5408\u89C4", "\u5229\u7387\u4E0A\u9650", "\u670D\u52A1\u8D39"],
    fields: [
      { key: "contractAmount", label: "\u5408\u540C\u8F7D\u660E\u501F\u6B3E\u91D1\u989D", type: "money", unit: "\u5143", defaultValue: 1e6 },
      { key: "cutAmount", label: "\u9884\u5148\u6263\u9664\u6B3E\u9879\uFF08\u780D\u5934\u606F\uFF09", type: "money", unit: "\u5143", defaultValue: 0 },
      { key: "interestRate", label: "\u7EA6\u5B9A\u5E74\u5229\u7387", type: "percent", unit: "%", defaultValue: 12 },
      { key: "serviceFee", label: "\u670D\u52A1\u8D39 / \u54A8\u8BE2\u8D39\uFF08\u4E00\u6B21\u6027\uFF09", type: "money", unit: "\u5143", defaultValue: 0 },
      { key: "otherFee", label: "\u5176\u4ED6\u8D39\u7528\uFF08\u62C5\u4FDD\u8D39\u3001\u4FDD\u9669\u8D39\u7B49\uFF09", type: "money", unit: "\u5143", defaultValue: 0 },
      { key: "term", label: "\u501F\u6B3E\u671F\u9650", type: "number", unit: "\u6708", defaultValue: 12 },
      {
        key: "lpr",
        label: "\u5408\u540C\u6210\u7ACB\u65F6\u4E00\u5E74\u671F LPR",
        type: "percent",
        unit: "%",
        defaultValue: LPR_DEFAULT
      }
    ],
    calc(values) {
      const contract = toNum(values.contractAmount);
      const cut = toNum(values.cutAmount);
      const rate = toNum(values.interestRate) / 100;
      const service = toNum(values.serviceFee);
      const other = toNum(values.otherFee);
      const months = Math.max(1, toNum(values.term));
      const lpr = toNum(values.lpr) / 100;
      const actual = round(contract - cut, 2);
      const steps = [];
      if (cut > 0) {
        steps.push({
          label: "\u780D\u5934\u606F\u8FD8\u539F\u672C\u91D1",
          value: `${money(contract)} \u2212 ${money(cut)} = ${money(actual)} \u5143`,
          note: "\u300A\u6C11\u6CD5\u5178\u300B\u7B2C670\u6761\uFF1A\u6309\u5B9E\u9645\u501F\u6B3E\u6570\u989D\u8FD4\u8FD8\u5E76\u8BA1\u606F",
          emphasis: true
        });
      } else {
        steps.push({ label: "\u5B9E\u9645\u5230\u8D26\u672C\u91D1", value: `${money(actual)} \u5143` });
      }
      const interest = round(actual * rate * (months / 12), 2);
      steps.push({ label: "\u7EA6\u5B9A\u5229\u606F", value: `${money(actual)} \xD7 ${toNum(values.interestRate)}% \xD7 ${months}/12 = ${money(interest)} \u5143` });
      const allCost = round(interest + service + other, 2);
      steps.push({ label: "\u501F\u6B3E\u4EBA\u5168\u90E8\u6210\u672C", value: `${money(interest)} + ${money(service)} + ${money(other)} = ${money(allCost)} \u5143` });
      const comprehensive = round(allCost / Math.max(actual, 1) * (12 / months) * 100, 4);
      steps.push({
        label: "\u7EFC\u5408\u5E74\u5316\u6210\u672C\u7387",
        value: `${comprehensive}%`,
        note: "\u5C06\u5229\u606F\u3001\u670D\u52A1\u8D39\u3001\u62C5\u4FDD\u8D39\u7B49\u5168\u90E8\u8BA1\u5165\uFF0C\u9664\u4EE5\u5B9E\u9645\u5230\u8D26\u672C\u91D1",
        emphasis: true
      });
      const cap = round(lpr * 4 * 100, 4);
      steps.push({ label: "\u53F8\u6CD5\u4FDD\u62A4\u4E0A\u9650\uFF08LPR \u56DB\u500D\uFF09", value: `${cap}%` });
      const over = comprehensive > cap;
      const supported = over ? round(actual * lpr * 4 * (months / 12), 2) : allCost;
      if (over) {
        steps.push({
          label: "\u8D85\u9650\u90E8\u5206\u4E0D\u4E88\u652F\u6301",
          value: `\u6309\u4E0A\u9650\u8BA1\u7B97\u53EF\u652F\u6301\u6210\u672C ${money(supported)} \u5143\uFF0C\u8D85\u51FA ${money(round(allCost - supported, 2))} \u5143`,
          emphasis: true
        });
      }
      return {
        main: {
          label: "\u7EFC\u5408\u5E74\u5316\u6210\u672C\u7387",
          value: `${comprehensive}%`,
          sub: over ? `\u26A0 \u5DF2\u8D85 LPR \u56DB\u500D\u4E0A\u9650 ${cap}%` : `\u672A\u8D85\u4E0A\u9650\uFF08${cap}%\uFF09`
        },
        blocks: [
          { label: "\u5B9E\u9645\u53EF\u7528\u672C\u91D1", value: money(actual), unit: "\u5143" },
          { label: "\u6CD5\u9662\u53EF\u652F\u6301\u6210\u672C", value: money(supported), unit: "\u5143" },
          { label: "\u5230\u671F\u5E94\u8FD8\u603B\u989D\uFF08\u5408\u89C4\u53E3\u5F84\uFF09", value: money(round(actual + supported, 2)), unit: "\u5143" }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u6700\u9AD8\u4EBA\u6C11\u6CD5\u9662\u5173\u4E8E\u5BA1\u7406\u6C11\u95F4\u501F\u8D37\u6848\u4EF6\u9002\u7528\u6CD5\u5F8B\u82E5\u5E72\u95EE\u9898\u7684\u89C4\u5B9A\u300B",
            article: "\u7B2C\u4E8C\u5341\u4E94\u6761",
            text: "\u53CC\u65B9\u7EA6\u5B9A\u7684\u5229\u7387\u8D85\u8FC7\u5408\u540C\u6210\u7ACB\u65F6\u4E00\u5E74\u671F\u8D37\u6B3E\u5E02\u573A\u62A5\u4EF7\u5229\u7387\u56DB\u500D\u7684\uFF0C\u4EBA\u6C11\u6CD5\u9662\u4E0D\u4E88\u652F\u6301\u3002"
          },
          {
            law: "\u300A\u6700\u9AD8\u4EBA\u6C11\u6CD5\u9662\u5173\u4E8E\u8FDB\u4E00\u6B65\u52A0\u5F3A\u91D1\u878D\u5BA1\u5224\u5DE5\u4F5C\u7684\u82E5\u5E72\u610F\u89C1\u300B",
            text: "\u91D1\u878D\u501F\u6B3E\u5408\u540C\u7684\u501F\u6B3E\u4EBA\u4EE5\u8D37\u6B3E\u4EBA\u540C\u65F6\u4E3B\u5F20\u7684\u5229\u606F\u3001\u590D\u5229\u3001\u7F5A\u606F\u3001\u8FDD\u7EA6\u91D1\u548C\u5176\u4ED6\u8D39\u7528\u8FC7\u9AD8\u663E\u8457\u80CC\u79BB\u5B9E\u9645\u635F\u5931\u4E3A\u7531\uFF0C\u8BF7\u6C42\u5BF9\u603B\u8BA1\u8D85\u8FC7\u5E74\u5229\u738724%\u7684\u90E8\u5206\u4E88\u4EE5\u8C03\u51CF\u7684\uFF0C\u5E94\u4E88\u652F\u6301\u3002"
          }
        ],
        tips: [
          "\u5B9E\u52A1\u4E2D\u6CD5\u9662\u4F1A\u5C06\u670D\u52A1\u8D39\u3001\u54A8\u8BE2\u8D39\u3001\u62C5\u4FDD\u8D39\u7B49\u53D8\u76F8\u5229\u606F\u5408\u5E76\u8BA1\u7B97\uFF0C\u5224\u65AD\u7EFC\u5408\u878D\u8D44\u6210\u672C\u662F\u5426\u7A81\u7834\u4E0A\u9650\uFF0C\u62C6\u5206\u6536\u8D39\u65E0\u6CD5\u89C4\u907F\u3002",
          '\u780D\u5934\u606F\u662F\u6C11\u95F4\u501F\u8D37\u9AD8\u9891\u4E89\u8BAE\u70B9\uFF0C\u52A1\u5FC5\u6309"\u5B9E\u9645\u5230\u8D26\u91D1\u989D"\u800C\u975E"\u5408\u540C\u91D1\u989D"\u4F5C\u4E3A\u8BA1\u606F\u672C\u91D1\u4E0E\u8FD8\u6B3E\u57FA\u6570\u3002',
          "\u91D1\u878D\u673A\u6784\u501F\u8D37\u4E0D\u9002\u7528 LPR \u56DB\u500D\u89C4\u5219\uFF0C\u4F46\u53D7\u5E74\u5229\u7387 24% \u7684\u53F8\u6CD5\u8C03\u51CF\u7EA6\u675F\uFF0C\u4E24\u8005\u6807\u51C6\u4E0D\u540C\u3002"
        ]
      };
    }
  },
  /* ── 资金占用损失 ── */
  {
    id: "occupation-loss",
    name: "\u8D44\u91D1\u5360\u7528\u635F\u5931",
    category: "interest",
    glyph: "\u5360",
    summary: "\u672A\u7EA6\u5B9A\u903E\u671F\u4ED8\u6B3E\u8FDD\u7EA6\u91D1\u65F6\uFF0C\u6309 LPR \u52A0\u8BA1 30%\u201450% \u4E3B\u5F20\u635F\u5931",
    keywords: ["\u8D44\u91D1\u5360\u7528", "\u903E\u671F\u4ED8\u6B3E\u635F\u5931", "LPR\u52A0\u8BA1", "\u4E70\u5356\u5408\u540C"],
    fields: [
      { key: "principal", label: "\u6B20\u4ED8\u4EF7\u6B3E / \u6B3E\u9879", type: "money", unit: "\u5143", emphasis: true, defaultValue: 1e6 },
      { key: "startDate", label: "\u5E94\u4ED8\u6B3E\u65E5", type: "date", defaultValue: "2025-01-01" },
      { key: "endDate", label: "\u5B9E\u9645\u6E05\u507F\u65E5", type: "date", defaultValue: "2026-01-01" },
      {
        key: "lpr",
        label: "\u8FDD\u7EA6\u884C\u4E3A\u53D1\u751F\u65F6\u4E00\u5E74\u671F LPR",
        type: "percent",
        unit: "%",
        defaultValue: LPR_DEFAULT
      },
      {
        key: "addRate",
        label: "\u52A0\u8BA1\u6BD4\u4F8B",
        type: "select",
        defaultValue: "50",
        options: [
          { label: "\u52A0\u8BA1 30%", value: "30" },
          { label: "\u52A0\u8BA1 40%", value: "40" },
          { label: "\u52A0\u8BA1 50%", value: "50" }
        ]
      }
    ],
    calc(values) {
      const p = toNum(values.principal);
      const start = parseDate(values.startDate) ?? /* @__PURE__ */ new Date();
      const end = parseDate(values.endDate) ?? /* @__PURE__ */ new Date();
      const lpr = toNum(values.lpr) / 100;
      const add = toNum(values.addRate, 50) / 100;
      const days = Math.max(0, daysBetween(start, end));
      const effective = round(lpr * (1 + add), 6);
      const loss = round(p * effective * (days / 365), 2);
      const steps = [
        { label: "\u903E\u671F\u671F\u95F4", value: `${ymd(start)} \u81F3 ${ymd(end)}\uFF0C\u5171 ${days} \u5929` },
        { label: "\u9002\u7528\u5229\u7387", value: `${toNum(values.lpr)}% \xD7 (1 + ${toNum(values.addRate)}%) = ${(effective * 100).toFixed(3)}%`, emphasis: true },
        {
          label: "\u8D44\u91D1\u5360\u7528\u635F\u5931",
          value: `${money(p)} \xD7 ${(effective * 100).toFixed(3)}% \xD7 ${days}/365 = ${money(loss)} \u5143`,
          emphasis: true
        }
      ];
      return {
        main: { label: "\u8D44\u91D1\u5360\u7528\u635F\u5931", value: money(loss), unit: "\u5143", sub: moneyToChinese(loss) },
        blocks: [
          { label: "\u9002\u7528\u5E74\u5229\u7387", value: `${(effective * 100).toFixed(3)}%` },
          { label: "\u672C\u606F\u5408\u8BA1", value: money(round(p + loss, 2)), unit: "\u5143" }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u6700\u9AD8\u4EBA\u6C11\u6CD5\u9662\u5173\u4E8E\u5BA1\u7406\u4E70\u5356\u5408\u540C\u7EA0\u7EB7\u6848\u4EF6\u9002\u7528\u6CD5\u5F8B\u95EE\u9898\u7684\u89E3\u91CA\u300B",
            article: "\u7B2C\u5341\u516B\u6761",
            text: "\u4E70\u5356\u5408\u540C\u6CA1\u6709\u7EA6\u5B9A\u903E\u671F\u4ED8\u6B3E\u8FDD\u7EA6\u91D1\u6216\u8005\u8BE5\u8FDD\u7EA6\u91D1\u7684\u8BA1\u7B97\u65B9\u6CD5\uFF0C\u51FA\u5356\u4EBA\u4EE5\u4E70\u53D7\u4EBA\u8FDD\u7EA6\u4E3A\u7531\u4E3B\u5F20\u8D54\u507F\u903E\u671F\u4ED8\u6B3E\u635F\u5931\uFF0C\u8FDD\u7EA6\u884C\u4E3A\u53D1\u751F\u57282019\u5E748\u670820\u65E5\u4E4B\u540E\u7684\uFF0C\u4EBA\u6C11\u6CD5\u9662\u53EF\u4EE5\u8FDD\u7EA6\u884C\u4E3A\u53D1\u751F\u65F6\u4E2D\u56FD\u4EBA\u6C11\u94F6\u884C\u6388\u6743\u5168\u56FD\u94F6\u884C\u95F4\u540C\u4E1A\u62C6\u501F\u4E2D\u5FC3\u516C\u5E03\u7684\u4E00\u5E74\u671F\u8D37\u6B3E\u5E02\u573A\u62A5\u4EF7\u5229\u7387\uFF08LPR\uFF09\u6807\u51C6\u4E3A\u57FA\u7840\uFF0C\u52A0\u8BA130\u201450%\u8BA1\u7B97\u903E\u671F\u4ED8\u6B3E\u635F\u5931\u3002"
          },
          {
            law: "\u300A\u6C11\u6CD5\u5178\u300B",
            article: "\u7B2C\u4E94\u767E\u4E03\u5341\u4E03\u6761",
            text: "\u5F53\u4E8B\u4EBA\u4E00\u65B9\u4E0D\u5C65\u884C\u5408\u540C\u4E49\u52A1\u6216\u8005\u5C65\u884C\u5408\u540C\u4E49\u52A1\u4E0D\u7B26\u5408\u7EA6\u5B9A\u7684\uFF0C\u5E94\u5F53\u627F\u62C5\u7EE7\u7EED\u5C65\u884C\u3001\u91C7\u53D6\u8865\u6551\u63AA\u65BD\u6216\u8005\u8D54\u507F\u635F\u5931\u7B49\u8FDD\u7EA6\u8D23\u4EFB\u3002"
          }
        ],
        tips: [
          '\u8FD9\u662F"\u5408\u540C\u6CA1\u7EA6\u5B9A\u8FDD\u7EA6\u91D1"\u65F6\u7684\u515C\u5E95\u4E3B\u5F20\u8DEF\u5F84\uFF0C\u51E0\u4E4E\u6240\u6709\u91D1\u94B1\u503A\u52A1\u90FD\u53EF\u63F4\u5F15\uFF0C\u5B9E\u52A1\u4EF7\u503C\u6781\u9AD8\u3002',
          "\u52A0\u8BA1 30%\u201450% \u5C5E\u6CD5\u9662\u88C1\u91CF\u533A\u95F4\uFF0C\u903E\u671F\u65F6\u95F4\u957F\u3001\u8FDD\u7EA6\u65B9\u6076\u610F\u660E\u663E\u7684\uFF0C\u4E3B\u5F20 50% \u66F4\u6613\u83B7\u652F\u6301\u3002",
          "\u8BE5\u7C7B\u635F\u5931\u6309 365 \u5929\u4E3A\u5E74\u57FA\u6570\u8BA1\u7B97\uFF0C\u4E0E\u91D1\u878D\u5408\u540C\u7684 360 \u5929\u53E3\u5F84\u4E0D\u540C\u3002"
        ]
      };
    }
  }
];

// src/core/calculators/labor.ts
var MONTH_WORK_DAYS = 21.75;
var DISABILITY_GRANT_MONTHS = [27, 25, 23, 21, 18, 16, 13, 11, 9, 7];
var DISABILITY_PENSION_RATE = [0.9, 0.85, 0.8, 0.75, 0.7, 0.6];
var URBAN_INCOME_DEFAULT = 56502;
function monthsBetween(a, b) {
  const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  return b.getDate() < a.getDate() ? months - 1 : months;
}
var laborCalculators = [
  /* ── 经济补偿金 ── */
  {
    id: "severance",
    name: "\u7ECF\u6D4E\u8865\u507F\u91D1\uFF08N\uFF09",
    category: "labor",
    glyph: "\u8865",
    summary: "\u6309\u5DE5\u4F5C\u5E74\u9650\u4E0E\u6708\u5E73\u5747\u5DE5\u8D44\u8BA1\u7B97\u89E3\u9664/\u7EC8\u6B62\u52B3\u52A8\u5408\u540C\u7684\u7ECF\u6D4E\u8865\u507F",
    keywords: ["\u7ECF\u6D4E\u8865\u507F\u91D1", "N", "\u88C1\u5458", "\u89E3\u9664\u52B3\u52A8\u5408\u540C"],
    fields: [
      { key: "startDate", label: "\u5165\u804C\u65E5\u671F", type: "date", defaultValue: "2018-03-01" },
      { key: "endDate", label: "\u89E3\u9664 / \u7EC8\u6B62\u65E5\u671F", type: "date", defaultValue: "2026-01-31" },
      { key: "avgSalary", label: "\u79BB\u804C\u524D 12 \u4E2A\u6708\u5E73\u5747\u5DE5\u8D44", type: "money", unit: "\u5143", defaultValue: 15e3, hint: "\u6309\u5E94\u5F97\u5DE5\u8D44\u8BA1\u7B97\uFF0C\u542B\u5956\u91D1\u3001\u6D25\u8D34\u3001\u8865\u8D34" },
      { key: "localAvg", label: "\u5F53\u5730\u4E0A\u5E74\u5EA6\u804C\u5DE5\u6708\u5E73\u5747\u5DE5\u8D44", type: "money", unit: "\u5143", defaultValue: 12e3, hint: "\u7528\u4E8E\u5224\u65AD\u4E09\u500D\u5C01\u9876\uFF0C\u586B 0 \u8868\u793A\u4E0D\u5C01\u9876" },
      {
        key: "reason",
        label: "\u89E3\u9664 / \u7EC8\u6B62\u60C5\u5F62",
        type: "select",
        defaultValue: "mutual",
        options: [
          { label: "\u534F\u5546\u4E00\u81F4\u89E3\u9664\uFF08\u5355\u4F4D\u63D0\u51FA\uFF09", value: "mutual" },
          { label: "\u5355\u4F4D\u4F9D\u6CD5\u88C1\u5458 / \u65E0\u8FC7\u5931\u6027\u8F9E\u9000", value: "layoff" },
          { label: "\u52B3\u52A8\u5408\u540C\u671F\u6EE1\u7EC8\u6B62", value: "expire" },
          { label: "\u5355\u4F4D\u7834\u4EA7\u3001\u540A\u9500\u6267\u7167\u7B49", value: "bankrupt" },
          { label: "\u52B3\u52A8\u8005\u4E3B\u52A8\u8F9E\u804C\uFF08\u65E0\u8865\u507F\uFF09", value: "resign" },
          { label: "\u5355\u4F4D\u8FDD\u6CD5\u89E3\u9664\uFF08\u5E94\u9002\u7528 2N\uFF09", value: "illegal" }
        ]
      }
    ],
    calc(values) {
      const start = parseDate(values.startDate) ?? /* @__PURE__ */ new Date();
      const end = parseDate(values.endDate) ?? /* @__PURE__ */ new Date();
      const avg = toNum(values.avgSalary);
      const localAvg = toNum(values.localAvg);
      const reason = toStr(values.reason, "mutual");
      const steps = [];
      if (reason === "resign") {
        return {
          main: { label: "\u7ECF\u6D4E\u8865\u507F\u91D1", value: "0", unit: "\u5143", sub: "\u52B3\u52A8\u8005\u4E3B\u52A8\u8F9E\u804C\uFF0C\u7528\u4EBA\u5355\u4F4D\u65E0\u9700\u652F\u4ED8\u7ECF\u6D4E\u8865\u507F" },
          steps: [{ label: "\u7ED3\u8BBA", value: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B\u7B2C46\u6761\u5217\u4E3E\u7684\u60C5\u5F62\u4E4B\u5916\uFF0C\u5355\u4F4D\u65E0\u9700\u652F\u4ED8\u7ECF\u6D4E\u8865\u507F" }],
          basis: [
            {
              law: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B",
              article: "\u7B2C\u56DB\u5341\u516D\u6761",
              text: "\u6709\u4E0B\u5217\u60C5\u5F62\u4E4B\u4E00\u7684\uFF0C\u7528\u4EBA\u5355\u4F4D\u5E94\u5F53\u5411\u52B3\u52A8\u8005\u652F\u4ED8\u7ECF\u6D4E\u8865\u507F\uFF1A\uFF08\u4E00\uFF09\u52B3\u52A8\u8005\u4F9D\u7167\u672C\u6CD5\u7B2C\u4E09\u5341\u516B\u6761\u89C4\u5B9A\u89E3\u9664\u52B3\u52A8\u5408\u540C\u7684\uFF1B\uFF08\u4E8C\uFF09\u7528\u4EBA\u5355\u4F4D\u4F9D\u7167\u672C\u6CD5\u7B2C\u4E09\u5341\u516D\u6761\u89C4\u5B9A\u5411\u52B3\u52A8\u8005\u63D0\u51FA\u89E3\u9664\u52B3\u52A8\u5408\u540C\u5E76\u4E0E\u52B3\u52A8\u8005\u534F\u5546\u4E00\u81F4\u89E3\u9664\u52B3\u52A8\u5408\u540C\u7684\uFF1B\u2026\u2026"
            }
          ],
          tips: [
            "\u4F8B\u5916\uFF1A\u82E5\u5355\u4F4D\u5B58\u5728\u672A\u7F34\u793E\u4FDD\u3001\u672A\u8DB3\u989D\u652F\u4ED8\u5DE5\u8D44\u3001\u672A\u63D0\u4F9B\u52B3\u52A8\u6761\u4EF6\u7B49\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B\u7B2C38\u6761\u60C5\u5F62\uFF0C\u52B3\u52A8\u8005\u88AB\u8FEB\u89E3\u9664\u4ECD\u53EF\u4E3B\u5F20\u7ECF\u6D4E\u8865\u507F\u3002"
          ]
        };
      }
      const totalMonths = Math.max(0, monthsBetween(start, end));
      const years = Math.floor(totalMonths / 12);
      const restMonths = totalMonths % 12;
      steps.push({
        label: "\u5DE5\u4F5C\u5E74\u9650",
        value: `${ymd(start)} \u81F3 ${ymd(end)}\uFF0C\u5171 ${totalMonths} \u4E2A\u6708\uFF08${years} \u5E74 ${restMonths} \u4E2A\u6708\uFF09`
      });
      let n;
      if (restMonths === 0) {
        n = years;
        steps.push({ label: "\u6298\u7B97\u8865\u507F\u6708\u6570", value: `${years} \u5E74 \u2192 ${n} \u4E2A\u6708` });
      } else if (restMonths >= 6) {
        n = years + 1;
        steps.push({
          label: "\u6298\u7B97\u8865\u507F\u6708\u6570",
          value: `${years} \u5E74 + \u4F59 ${restMonths} \u4E2A\u6708\uFF08\u516D\u4E2A\u6708\u4EE5\u4E0A\u6309\u4E00\u5E74\u7B97\uFF09= ${n} \u4E2A\u6708`,
          note: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B\u7B2C47\u6761"
        });
      } else {
        n = years + 0.5;
        steps.push({
          label: "\u6298\u7B97\u8865\u507F\u6708\u6570",
          value: `${years} \u5E74 + \u4F59 ${restMonths} \u4E2A\u6708\uFF08\u4E0D\u6EE1\u516D\u4E2A\u6708\u6309\u534A\u5E74\u7B97\uFF09= ${n} \u4E2A\u6708`,
          note: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B\u7B2C47\u6761"
        });
      }
      const cap3 = localAvg > 0 ? localAvg * 3 : Infinity;
      let usedSalary = avg;
      let capped = false;
      let cappedYears = false;
      if (localAvg > 0 && avg > cap3) {
        usedSalary = cap3;
        capped = true;
        steps.push({
          label: "\u6708\u5DE5\u8D44\u4E09\u500D\u5C01\u9876",
          value: `\u5F53\u5730\u6708\u5747 ${money(localAvg)} \xD7 3 = ${money(cap3)} \u5143\uFF0C\u5B9E\u9645 ${money(avg)} \u5143 \u2192 \u6309 ${money(cap3)} \u5143\u8BA1`,
          note: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B\u7B2C47\u6761\u7B2C2\u6B3E",
          emphasis: true
        });
      }
      if (capped && n > 12) {
        n = 12;
        cappedYears = true;
        steps.push({
          label: "\u5E74\u9650\u5C01\u9876",
          value: "\u5DE5\u8D44\u8D85\u4E09\u500D\u7684\uFF0C\u652F\u4ED8\u5E74\u9650\u6700\u9AD8\u4E0D\u8D85\u8FC7 12 \u5E74 \u2192 \u6309 12 \u4E2A\u6708\u8BA1",
          note: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B\u7B2C47\u6761\u7B2C2\u6B3E",
          emphasis: true
        });
      }
      const amount = round(usedSalary * n, 2);
      steps.push({ label: "\u7ECF\u6D4E\u8865\u507F\u91D1", value: `${money(usedSalary)} \xD7 ${n} = ${money(amount)} \u5143`, emphasis: true });
      const isIllegal = reason === "illegal";
      if (isIllegal) {
        steps.push({
          label: "\u26A0 \u63D0\u793A",
          value: '\u8BE5\u60C5\u5F62\u5E94\u9002\u7528\u8D54\u507F\u91D1\uFF082N\uFF09\uFF0C\u8BF7\u4F7F\u7528"\u8FDD\u6CD5\u89E3\u9664\u8D54\u507F\u91D1"\u8BA1\u7B97\u5668'
        });
      }
      return {
        main: { label: "\u7ECF\u6D4E\u8865\u507F\u91D1\uFF08N\uFF09", value: money(amount), unit: "\u5143", sub: moneyToChinese(amount) },
        blocks: [
          { label: "\u8865\u507F\u6708\u6570", value: `${n} \u4E2A\u6708` },
          { label: "\u8BA1\u7B97\u57FA\u6570\u6708\u5DE5\u8D44", value: money(usedSalary), unit: "\u5143", sub: capped ? "\u5DF2\u9002\u7528\u4E09\u500D\u5C01\u9876" : "\u672A\u5C01\u9876" },
          { label: "\u662F\u5426\u5E74\u9650\u5C01\u9876", value: cappedYears ? "\u662F\uFF0812 \u5E74\uFF09" : "\u5426" }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B",
            article: "\u7B2C\u56DB\u5341\u4E03\u6761",
            text: "\u7ECF\u6D4E\u8865\u507F\u6309\u52B3\u52A8\u8005\u5728\u672C\u5355\u4F4D\u5DE5\u4F5C\u7684\u5E74\u9650\uFF0C\u6BCF\u6EE1\u4E00\u5E74\u652F\u4ED8\u4E00\u4E2A\u6708\u5DE5\u8D44\u7684\u6807\u51C6\u5411\u52B3\u52A8\u8005\u652F\u4ED8\u3002\u516D\u4E2A\u6708\u4EE5\u4E0A\u4E0D\u6EE1\u4E00\u5E74\u7684\uFF0C\u6309\u4E00\u5E74\u8BA1\u7B97\uFF1B\u4E0D\u6EE1\u516D\u4E2A\u6708\u7684\uFF0C\u5411\u52B3\u52A8\u8005\u652F\u4ED8\u534A\u4E2A\u6708\u5DE5\u8D44\u7684\u7ECF\u6D4E\u8865\u507F\u3002\u52B3\u52A8\u8005\u6708\u5DE5\u8D44\u9AD8\u4E8E\u7528\u4EBA\u5355\u4F4D\u6240\u5728\u76F4\u8F96\u5E02\u3001\u8BBE\u533A\u7684\u5E02\u7EA7\u4EBA\u6C11\u653F\u5E9C\u516C\u5E03\u7684\u672C\u5730\u533A\u4E0A\u5E74\u5EA6\u804C\u5DE5\u6708\u5E73\u5747\u5DE5\u8D44\u4E09\u500D\u7684\uFF0C\u5411\u5176\u652F\u4ED8\u7ECF\u6D4E\u8865\u507F\u7684\u6807\u51C6\u6309\u804C\u5DE5\u6708\u5E73\u5747\u5DE5\u8D44\u4E09\u500D\u7684\u6570\u989D\u652F\u4ED8\uFF0C\u5411\u5176\u652F\u4ED8\u7ECF\u6D4E\u8865\u507F\u7684\u5E74\u9650\u6700\u9AD8\u4E0D\u8D85\u8FC7\u5341\u4E8C\u5E74\u3002"
          },
          {
            law: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u5B9E\u65BD\u6761\u4F8B\u300B",
            article: "\u7B2C\u4E8C\u5341\u4E03\u6761",
            text: "\u7ECF\u6D4E\u8865\u507F\u7684\u6708\u5DE5\u8D44\u6309\u7167\u52B3\u52A8\u8005\u5E94\u5F97\u5DE5\u8D44\u8BA1\u7B97\uFF0C\u5305\u62EC\u8BA1\u65F6\u5DE5\u8D44\u6216\u8005\u8BA1\u4EF6\u5DE5\u8D44\u4EE5\u53CA\u5956\u91D1\u3001\u6D25\u8D34\u548C\u8865\u8D34\u7B49\u8D27\u5E01\u6027\u6536\u5165\u3002\u52B3\u52A8\u8005\u5DE5\u4F5C\u4E0D\u6EE112\u4E2A\u6708\u7684\uFF0C\u6309\u7167\u5B9E\u9645\u5DE5\u4F5C\u7684\u6708\u6570\u8BA1\u7B97\u5E73\u5747\u5DE5\u8D44\u3002"
          }
        ],
        tips: [
          '\u6708\u5DE5\u8D44\u57FA\u6570\u6309"\u5E94\u5F97\u5DE5\u8D44"\u8BA1\u7B97\uFF0C\u542B\u5956\u91D1\u3001\u6D25\u8D34\u3001\u8865\u8D34\u548C\u52A0\u73ED\u5DE5\u8D44\uFF0C\u4E0D\u662F\u57FA\u672C\u5DE5\u8D44\uFF0C\u4E5F\u4E0D\u662F\u5B9E\u53D1\u5DE5\u8D44\u3002',
          "2008 \u5E74 1 \u6708 1 \u65E5\u524D\u540E\u7ECF\u6D4E\u8865\u507F\u89C4\u5219\u4E0D\u540C\uFF0C\u6D89\u8001\u6848\u5DE5\u9F84\u9700\u5206\u6BB5\u9002\u7528\u5F53\u65F6\u89C4\u5B9A\uFF0C\u672C\u5DE5\u5177\u6309\u73B0\u884C\u7EDF\u4E00\u89C4\u5219\u8BA1\u7B97\u3002",
          "\u52B3\u52A8\u8005\u975E\u56E0\u672C\u4EBA\u539F\u56E0\u88AB\u5B89\u6392\u5230\u65B0\u5355\u4F4D\u7684\uFF0C\u539F\u5355\u4F4D\u5DE5\u4F5C\u5E74\u9650\u5408\u5E76\u8BA1\u7B97\u3002"
        ]
      };
    }
  },
  /* ── 违法解除赔偿金 ── */
  {
    id: "illegal-termination",
    name: "\u8FDD\u6CD5\u89E3\u9664\u8D54\u507F\u91D1\uFF082N\uFF09",
    category: "labor",
    glyph: "\u8D54",
    summary: "\u5355\u4F4D\u8FDD\u6CD5\u89E3\u9664\u6216\u7EC8\u6B62\u52B3\u52A8\u5408\u540C\u7684\u4E8C\u500D\u8D54\u507F\u91D1",
    keywords: ["\u8D54\u507F\u91D1", "2N", "\u8FDD\u6CD5\u89E3\u9664", "\u8FDD\u6CD5\u8F9E\u9000"],
    fields: [
      { key: "startDate", label: "\u5165\u804C\u65E5\u671F", type: "date", defaultValue: "2018-03-01" },
      { key: "endDate", label: "\u8FDD\u6CD5\u89E3\u9664\u65E5\u671F", type: "date", defaultValue: "2026-01-31" },
      { key: "avgSalary", label: "\u79BB\u804C\u524D 12 \u4E2A\u6708\u5E73\u5747\u5DE5\u8D44", type: "money", unit: "\u5143", defaultValue: 15e3 },
      { key: "localAvg", label: "\u5F53\u5730\u4E0A\u5E74\u5EA6\u804C\u5DE5\u6708\u5E73\u5747\u5DE5\u8D44", type: "money", unit: "\u5143", defaultValue: 12e3 },
      {
        key: "remedy",
        label: "\u52B3\u52A8\u8005\u8BC9\u6C42",
        type: "select",
        defaultValue: "compensation",
        options: [
          { label: "\u8981\u6C42\u652F\u4ED8\u8D54\u507F\u91D1\uFF082N\uFF0C\u4E0D\u8981\u6C42\u7EE7\u7EED\u5C65\u884C\uFF09", value: "compensation" },
          { label: "\u8981\u6C42\u7EE7\u7EED\u5C65\u884C\u52B3\u52A8\u5408\u540C", value: "reinstate" }
        ]
      }
    ],
    calc(values) {
      const start = parseDate(values.startDate) ?? /* @__PURE__ */ new Date();
      const end = parseDate(values.endDate) ?? /* @__PURE__ */ new Date();
      const avg = toNum(values.avgSalary);
      const localAvg = toNum(values.localAvg);
      const remedy = toStr(values.remedy, "compensation");
      const steps = [];
      const totalMonths = Math.max(0, monthsBetween(start, end));
      const years = Math.floor(totalMonths / 12);
      const restMonths = totalMonths % 12;
      steps.push({ label: "\u5DE5\u4F5C\u5E74\u9650", value: `${totalMonths} \u4E2A\u6708\uFF08${years} \u5E74 ${restMonths} \u4E2A\u6708\uFF09` });
      let n = restMonths === 0 ? years : restMonths >= 6 ? years + 1 : years + 0.5;
      steps.push({ label: "\u7ECF\u6D4E\u8865\u507F\u6708\u6570 N", value: `${n} \u4E2A\u6708` });
      const cap3 = localAvg > 0 ? localAvg * 3 : Infinity;
      let usedSalary = avg;
      if (localAvg > 0 && avg > cap3) {
        usedSalary = cap3;
        if (n > 12) n = 12;
        steps.push({ label: "\u4E09\u500D\u5C01\u9876 + 12 \u5E74\u5E74\u9650\u5C01\u9876", value: `\u6708\u5DE5\u8D44\u6309 ${money(cap3)} \u5143\uFF0CN \u6309 ${n} \u4E2A\u6708`, emphasis: true });
      }
      const economic = round(usedSalary * n, 2);
      steps.push({ label: "\u7ECF\u6D4E\u8865\u507F\uFF08N\uFF09", value: `${money(usedSalary)} \xD7 ${n} = ${money(economic)} \u5143` });
      if (remedy === "reinstate") {
        const wageLoss = round(avg * totalMonths * 0 + avg * n, 2);
        steps.push({
          label: "\u9009\u62E9\u7EE7\u7EED\u5C65\u884C",
          value: "\u6CD5\u9662\u5224\u51B3\u7EE7\u7EED\u5C65\u884C\u7684\uFF0C\u5355\u4F4D\u5E94\u8865\u53D1\u8FDD\u6CD5\u89E3\u9664\u51B3\u5B9A\u4F5C\u51FA\u81F3\u6062\u590D\u52B3\u52A8\u5173\u7CFB\u671F\u95F4\u7684\u5DE5\u8D44\u635F\u5931",
          note: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B\u7B2C48\u6761",
          emphasis: true
        });
        steps.push({ label: "\u53C2\u8003\u5DE5\u8D44\u635F\u5931\uFF08\u6309 N \u4E2A\u6708\u4F30\u7B97\uFF09", value: `${money(wageLoss)} \u5143`, note: "\u5B9E\u9645\u4EE5\u8BC9\u8BBC\u5468\u671F\u957F\u77ED\u4E3A\u51C6\uFF0C\u901A\u5E38\u8FDC\u9AD8\u4E8E N \u4E2A\u6708" });
        return {
          main: { label: "\u7EE7\u7EED\u5C65\u884C\u65B9\u6848", value: "\u6062\u590D\u52B3\u52A8\u5173\u7CFB", sub: `\u53E6\u53EF\u4E3B\u5F20\u5DE5\u8D44\u635F\u5931\uFF08\u53C2\u8003 ${money(wageLoss)} \u5143\uFF09` },
          blocks: [
            { label: "\u5BF9\u6BD4\uFF1A\u8D54\u507F\u91D1\u65B9\u6848\uFF082N\uFF09", value: money(round(economic * 2, 2)), unit: "\u5143" },
            { label: "\u5DE5\u8D44\u635F\u5931\u4F30\u7B97", value: money(wageLoss), unit: "\u5143" }
          ],
          steps,
          basis: [
            {
              law: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B",
              article: "\u7B2C\u56DB\u5341\u516B\u6761",
              text: "\u7528\u4EBA\u5355\u4F4D\u8FDD\u53CD\u672C\u6CD5\u89C4\u5B9A\u89E3\u9664\u6216\u8005\u7EC8\u6B62\u52B3\u52A8\u5408\u540C\uFF0C\u52B3\u52A8\u8005\u8981\u6C42\u7EE7\u7EED\u5C65\u884C\u52B3\u52A8\u5408\u540C\u7684\uFF0C\u7528\u4EBA\u5355\u4F4D\u5E94\u5F53\u7EE7\u7EED\u5C65\u884C\uFF1B\u52B3\u52A8\u8005\u4E0D\u8981\u6C42\u7EE7\u7EED\u5C65\u884C\u52B3\u52A8\u5408\u540C\u6216\u8005\u52B3\u52A8\u5408\u540C\u5DF2\u7ECF\u4E0D\u80FD\u7EE7\u7EED\u5C65\u884C\u7684\uFF0C\u7528\u4EBA\u5355\u4F4D\u5E94\u5F53\u4F9D\u7167\u672C\u6CD5\u7B2C\u516B\u5341\u4E03\u6761\u89C4\u5B9A\u652F\u4ED8\u8D54\u507F\u91D1\u3002"
            }
          ],
          tips: [
            "\u9009\u62E9\u6743\u5728\u52B3\u52A8\u8005\uFF1A\u7EE7\u7EED\u5C65\u884C\u4E0E\u8D54\u507F\u91D1\u4E8C\u9009\u4E00\uFF0C\u4E0D\u80FD\u540C\u65F6\u4E3B\u5F20\u3002",
            "\u8BC9\u8BBC\u5468\u671F\u8D8A\u957F\uFF0C\u7EE7\u7EED\u5C65\u884C\u65B9\u6848\u4E0B\u7684\u5DE5\u8D44\u635F\u5931\u8D8A\u5927\uFF0C\u957F\u5468\u671F\u6848\u4EF6\u4E2D\u7EE7\u7EED\u5C65\u884C\u5F80\u5F80\u66F4\u6709\u5229\u3002",
            '\u5C97\u4F4D\u5DF2\u88AB\u66FF\u4EE3\u3001\u4FE1\u4EFB\u57FA\u7840\u4E27\u5931\u7684\uFF0C\u6CD5\u9662\u53EF\u80FD\u8BA4\u5B9A"\u52B3\u52A8\u5408\u540C\u5DF2\u4E0D\u80FD\u7EE7\u7EED\u5C65\u884C"\uFF0C\u8F6C\u800C\u5224\u8D54\u8D54\u507F\u91D1\u3002'
          ]
        };
      }
      const compensation = round(economic * 2, 2);
      steps.push({ label: "\u8D54\u507F\u91D1\uFF082N\uFF09", value: `${money(economic)} \xD7 2 = ${money(compensation)} \u5143`, emphasis: true });
      return {
        main: { label: "\u8FDD\u6CD5\u89E3\u9664\u8D54\u507F\u91D1\uFF082N\uFF09", value: money(compensation), unit: "\u5143", sub: moneyToChinese(compensation) },
        blocks: [
          { label: "\u7ECF\u6D4E\u8865\u507F\uFF08N\uFF09", value: money(economic), unit: "\u5143" },
          { label: "\u8D54\u507F\u500D\u6570", value: "2 \u500D" },
          { label: "\u8BA1\u7B97\u57FA\u6570", value: money(usedSalary), unit: "\u5143" }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B",
            article: "\u7B2C\u516B\u5341\u4E03\u6761",
            text: "\u7528\u4EBA\u5355\u4F4D\u8FDD\u53CD\u672C\u6CD5\u89C4\u5B9A\u89E3\u9664\u6216\u8005\u7EC8\u6B62\u52B3\u52A8\u5408\u540C\u7684\uFF0C\u5E94\u5F53\u4F9D\u7167\u672C\u6CD5\u7B2C\u56DB\u5341\u4E03\u6761\u89C4\u5B9A\u7684\u7ECF\u6D4E\u8865\u507F\u6807\u51C6\u7684\u4E8C\u500D\u5411\u52B3\u52A8\u8005\u652F\u4ED8\u8D54\u507F\u91D1\u3002"
          }
        ],
        tips: [
          '\u8D54\u507F\u91D1\u7684\u8BA1\u7B97\u57FA\u6570\u662F"\u7ECF\u6D4E\u8865\u507F\u91D1"\uFF0C\u518D\u4E58\u4E8C\u500D\uFF0C\u5373 2N\uFF0C\u4E0D\u662F N+1\u3002',
          '"N+1"\u4E2D\u7684 +1 \u662F\u672A\u63D0\u524D 30 \u65E5\u4E66\u9762\u901A\u77E5\u7684\u4EE3\u901A\u77E5\u91D1\uFF0C\u4EC5\u9002\u7528\u4E8E\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B\u7B2C40\u6761\u7684\u65E0\u8FC7\u5931\u6027\u8F9E\u9000\uFF0C\u4E0D\u9002\u7528\u4E8E\u8FDD\u6CD5\u89E3\u9664\u3002',
          "\u8FDD\u6CD5\u89E3\u9664\u5E38\u89C1\u60C5\u5F62\uFF1A\u65E0\u8BC1\u636E\u8F9E\u9000\u3001\u8F9E\u9000\u4E09\u671F\u5973\u804C\u5DE5\u3001\u8F9E\u9000\u5DE5\u4F24\u804C\u5DE5\u3001\u672A\u8D70\u5DE5\u4F1A\u7A0B\u5E8F\u7B49\u3002"
        ]
      };
    }
  },
  /* ── 加班费 ── */
  {
    id: "overtime-pay",
    name: "\u52A0\u73ED\u8D39",
    category: "labor",
    glyph: "\u52A0",
    summary: "\u5DE5\u4F5C\u65E5 / \u4F11\u606F\u65E5 / \u6CD5\u5B9A\u8282\u5047\u65E5\u4E09\u7C7B\u52A0\u73ED\u5DE5\u8D44\u8BA1\u7B97",
    keywords: ["\u52A0\u73ED\u8D39", "150%", "200%", "300%", "\u6CD5\u5B9A\u8282\u5047\u65E5"],
    fields: [
      { key: "monthlySalary", label: "\u6708\u5DE5\u8D44\uFF08\u52A0\u73ED\u8D39\u8BA1\u7B97\u57FA\u6570\uFF09", type: "money", unit: "\u5143", defaultValue: 1e4, hint: "\u4E0D\u5F97\u4F4E\u4E8E\u5F53\u5730\u6700\u4F4E\u5DE5\u8D44\u6807\u51C6\uFF1B\u6709\u7EA6\u5B9A\u7684\u4ECE\u7EA6\u5B9A" },
      { key: "weekdayHours", label: "\u5DE5\u4F5C\u65E5\u5EF6\u65F6\u52A0\u73ED\u5C0F\u65F6\u6570", type: "number", unit: "\u5C0F\u65F6", defaultValue: 40 },
      { key: "restDayHours", label: "\u4F11\u606F\u65E5\u52A0\u73ED\u5C0F\u65F6\u6570", type: "number", unit: "\u5C0F\u65F6", defaultValue: 16 },
      {
        key: "restDayComp",
        label: "\u4F11\u606F\u65E5\u662F\u5426\u5DF2\u5B89\u6392\u8865\u4F11",
        type: "switch",
        defaultValue: false,
        hint: "\u5DF2\u5B89\u6392\u8865\u4F11\u7684\u53EF\u4E0D\u652F\u4ED8 200% \u52A0\u73ED\u8D39"
      },
      { key: "holidayHours", label: "\u6CD5\u5B9A\u8282\u5047\u65E5\u52A0\u73ED\u5C0F\u65F6\u6570", type: "number", unit: "\u5C0F\u65F6", defaultValue: 8 },
      {
        key: "months",
        label: "\u8FFD\u7D22\u6708\u6570",
        type: "number",
        unit: "\u6708",
        defaultValue: 12,
        hint: "\u52A0\u73ED\u8D39\u4EF2\u88C1\u65F6\u6548\u4E3A\u4E00\u5E74\uFF0C\u901A\u5E38\u6309 12 \u4E2A\u6708\u8FFD\u7D22"
      }
    ],
    calc(values) {
      const monthly = toNum(values.monthlySalary);
      const wd = toNum(values.weekdayHours);
      const rd = toNum(values.restDayHours);
      const hd = toNum(values.holidayHours);
      const months = Math.max(1, toNum(values.months));
      const compensated = values.restDayComp === true || values.restDayComp === "true";
      const daily = round(monthly / MONTH_WORK_DAYS, 2);
      const hourly = round(daily / 8, 2);
      const steps = [
        { label: "\u65E5\u5DE5\u8D44", value: `${money(monthly)} \xF7 21.75 = ${money(daily)} \u5143`, note: "\u6708\u8BA1\u85AA\u5929\u6570 21.75 \u5929" },
        { label: "\u5C0F\u65F6\u5DE5\u8D44", value: `${money(daily)} \xF7 8 = ${money(hourly)} \u5143` }
      ];
      const wdPay = round(hourly * wd * 1.5, 2);
      steps.push({ label: "\u5DE5\u4F5C\u65E5\u5EF6\u65F6\u52A0\u73ED\uFF08150%\uFF09", value: `${money(hourly)} \xD7 ${wd} \u5C0F\u65F6 \xD7 150% = ${money(wdPay)} \u5143`, note: "\u300A\u52B3\u52A8\u6CD5\u300B\u7B2C44\u6761\u7B2C\uFF08\u4E00\uFF09\u9879" });
      let rdPay = 0;
      if (compensated) {
        steps.push({ label: "\u4F11\u606F\u65E5\u52A0\u73ED\uFF08200%\uFF09", value: "\u5DF2\u5B89\u6392\u8865\u4F11\uFF0C\u65E0\u9700\u652F\u4ED8", note: "\u300A\u52B3\u52A8\u6CD5\u300B\u7B2C44\u6761\u7B2C\uFF08\u4E8C\uFF09\u9879" });
      } else {
        rdPay = round(hourly * rd * 2, 2);
        steps.push({ label: "\u4F11\u606F\u65E5\u52A0\u73ED\uFF08200%\uFF09", value: `${money(hourly)} \xD7 ${rd} \u5C0F\u65F6 \xD7 200% = ${money(rdPay)} \u5143`, note: "\u300A\u52B3\u52A8\u6CD5\u300B\u7B2C44\u6761\u7B2C\uFF08\u4E8C\uFF09\u9879" });
      }
      const hdPay = round(hourly * hd * 3, 2);
      steps.push({ label: "\u6CD5\u5B9A\u8282\u5047\u65E5\u52A0\u73ED\uFF08300%\uFF09", value: `${money(hourly)} \xD7 ${hd} \u5C0F\u65F6 \xD7 300% = ${money(hdPay)} \u5143`, note: "\u300A\u52B3\u52A8\u6CD5\u300B\u7B2C44\u6761\u7B2C\uFF08\u4E09\uFF09\u9879\uFF0C\u4E0D\u53EF\u7528\u8865\u4F11\u66FF\u4EE3" });
      const monthTotal = round(wdPay + rdPay + hdPay, 2);
      steps.push({ label: "\u5355\u6708\u52A0\u73ED\u8D39\u5408\u8BA1", value: `${money(monthTotal)} \u5143`, emphasis: true });
      const total = round(monthTotal * months, 2);
      steps.push({ label: `\u8FFD\u7D22 ${months} \u4E2A\u6708`, value: `${money(monthTotal)} \xD7 ${months} = ${money(total)} \u5143`, emphasis: true });
      return {
        main: { label: "\u52A0\u73ED\u8D39\u603B\u989D", value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        blocks: [
          { label: "\u5C0F\u65F6\u5DE5\u8D44\u57FA\u6570", value: money(hourly), unit: "\u5143" },
          { label: "\u5DE5\u4F5C\u65E5\u52A0\u73ED\u8D39", value: money(wdPay), unit: "\u5143" },
          { label: "\u4F11\u606F\u65E5\u52A0\u73ED\u8D39", value: money(rdPay), unit: "\u5143" },
          { label: "\u6CD5\u5B9A\u8282\u5047\u65E5\u52A0\u73ED\u8D39", value: money(hdPay), unit: "\u5143" },
          { label: "\u5355\u6708\u5408\u8BA1", value: money(monthTotal), unit: "\u5143" }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u52B3\u52A8\u6CD5\u300B",
            article: "\u7B2C\u56DB\u5341\u56DB\u6761",
            text: "\u6709\u4E0B\u5217\u60C5\u5F62\u4E4B\u4E00\u7684\uFF0C\u7528\u4EBA\u5355\u4F4D\u5E94\u5F53\u6309\u7167\u4E0B\u5217\u6807\u51C6\u652F\u4ED8\u9AD8\u4E8E\u52B3\u52A8\u8005\u6B63\u5E38\u5DE5\u4F5C\u65F6\u95F4\u5DE5\u8D44\u7684\u5DE5\u8D44\u62A5\u916C\uFF1A\uFF08\u4E00\uFF09\u5B89\u6392\u52B3\u52A8\u8005\u5EF6\u957F\u5DE5\u4F5C\u65F6\u95F4\u7684\uFF0C\u652F\u4ED8\u4E0D\u4F4E\u4E8E\u5DE5\u8D44\u7684\u767E\u5206\u4E4B\u4E00\u767E\u4E94\u5341\u7684\u5DE5\u8D44\u62A5\u916C\uFF1B\uFF08\u4E8C\uFF09\u4F11\u606F\u65E5\u5B89\u6392\u52B3\u52A8\u8005\u5DE5\u4F5C\u53C8\u4E0D\u80FD\u5B89\u6392\u8865\u4F11\u7684\uFF0C\u652F\u4ED8\u4E0D\u4F4E\u4E8E\u5DE5\u8D44\u7684\u767E\u5206\u4E4B\u4E8C\u767E\u7684\u5DE5\u8D44\u62A5\u916C\uFF1B\uFF08\u4E09\uFF09\u6CD5\u5B9A\u4F11\u5047\u65E5\u5B89\u6392\u52B3\u52A8\u8005\u5DE5\u4F5C\u7684\uFF0C\u652F\u4ED8\u4E0D\u4F4E\u4E8E\u5DE5\u8D44\u7684\u767E\u5206\u4E4B\u4E09\u767E\u7684\u5DE5\u8D44\u62A5\u916C\u3002"
          },
          {
            law: "\u300A\u5173\u4E8E\u804C\u5DE5\u5168\u5E74\u6708\u5E73\u5747\u5DE5\u4F5C\u65F6\u95F4\u548C\u5DE5\u8D44\u6298\u7B97\u95EE\u9898\u7684\u901A\u77E5\u300B",
            text: "\u6708\u8BA1\u85AA\u5929\u6570\uFF1D\uFF08365\u5929\uFF0D104\u5929\uFF09\xF712\u6708\uFF1D21.75\u5929\u3002"
          }
        ],
        tips: [
          "\u6CD5\u5B9A\u8282\u5047\u65E5\u52A0\u73ED\u8D39\u4E0D\u53EF\u7528\u8865\u4F11\u66FF\u4EE3\uFF0C\u5FC5\u987B\u652F\u4ED8 300%\uFF1B\u4F11\u606F\u65E5\u52A0\u73ED\u5219\u53EF\u4EE5\u4F18\u5148\u5B89\u6392\u8865\u4F11\u3002",
          "\u52A0\u73ED\u8D39\u8BA1\u7B97\u57FA\u6570\u6709\u7EA6\u5B9A\u7684\u4ECE\u7EA6\u5B9A\uFF0C\u4F46\u4E0D\u5F97\u4F4E\u4E8E\u5F53\u5730\u6700\u4F4E\u5DE5\u8D44\u6807\u51C6\uFF1B\u65E0\u7EA6\u5B9A\u7684\u901A\u5E38\u6309\u6B63\u5E38\u5DE5\u4F5C\u65F6\u95F4\u5DE5\u8D44\u786E\u5B9A\u3002",
          "\u52A0\u73ED\u4E8B\u5B9E\u7684\u4E3E\u8BC1\u8D23\u4EFB\u539F\u5219\u4E0A\u7531\u52B3\u52A8\u8005\u627F\u62C5\uFF0C\u4F46\u7528\u4EBA\u5355\u4F4D\u4FDD\u6709\u7684\u8003\u52E4\u8BB0\u5F55\u3001\u5DE5\u8D44\u8868\u5E94\u7531\u5355\u4F4D\u63D0\u4F9B\uFF0C\u62D2\u4E0D\u63D0\u4F9B\u53EF\u91C7\u4FE1\u52B3\u52A8\u8005\u4E3B\u5F20\u3002"
        ]
      };
    }
  },
  /* ── 未休年休假工资 ── */
  {
    id: "annual-leave-pay",
    name: "\u672A\u4F11\u5E74\u4F11\u5047\u5DE5\u8D44",
    category: "labor",
    glyph: "\u5047",
    summary: "\u6309 300% \u65E5\u5DE5\u8D44\u8BA1\u7B97\u5E94\u4F11\u672A\u4F11\u5E74\u4F11\u5047\u7684\u5DE5\u8D44\u62A5\u916C\uFF08\u53E6\u4ED8 200%\uFF09",
    keywords: ["\u5E74\u4F11\u5047", "\u672A\u4F11\u5E74\u5047", "300%", "\u5E26\u85AA\u4F11\u5047"],
    fields: [
      {
        key: "workYears",
        label: "\u7D2F\u8BA1\u5DE5\u4F5C\u5E74\u9650",
        type: "number",
        unit: "\u5E74",
        defaultValue: 8,
        hint: "\u542B\u5728\u5176\u4ED6\u5355\u4F4D\u7684\u5DE5\u4F5C\u5E74\u9650\uFF0C\u975E\u4EC5\u672C\u5355\u4F4D"
      },
      { key: "monthlySalary", label: "\u6708\u5DE5\u8D44\uFF08\u5254\u9664\u52A0\u73ED\u8D39\uFF09", type: "money", unit: "\u5143", defaultValue: 12e3 },
      { key: "entitled", label: "\u672C\u5E74\u5EA6\u5E94\u4F11\u5929\u6570", type: "number", unit: "\u5929", defaultValue: 5, hint: "\u7CFB\u7EDF\u81EA\u52A8\u6309\u5DE5\u9F84\u9884\u586B\uFF0C\u53EF\u624B\u52A8\u8C03\u6574" },
      { key: "taken", label: "\u5DF2\u4F11\u5929\u6570", type: "number", unit: "\u5929", defaultValue: 0 },
      {
        key: "years",
        label: "\u8FFD\u7D22\u5E74\u6570",
        type: "number",
        unit: "\u5E74",
        defaultValue: 2,
        hint: "\u5B9E\u52A1\u4E2D\u4E00\u822C\u652F\u6301\u8FFD\u7D22\u4E24\u5E74"
      }
    ],
    calc(values) {
      const wy = toNum(values.workYears);
      const monthly = toNum(values.monthlySalary);
      const entitled = toNum(values.entitled);
      const taken = toNum(values.taken);
      const years = Math.max(1, toNum(values.years));
      const statutory = wy >= 20 ? 15 : wy >= 10 ? 10 : wy >= 1 ? 5 : 0;
      const daily = round(monthly / MONTH_WORK_DAYS, 2);
      const untaken = Math.max(0, entitled - taken);
      const steps = [
        { label: "\u6CD5\u5B9A\u5E74\u4F11\u5047\u5929\u6570", value: statutory > 0 ? `${statutory} \u5929` : "0 \u5929\uFF08\u7D2F\u8BA1\u5DE5\u4F5C\u4E0D\u6EE1 1 \u5E74\uFF09", note: wy >= 20 ? "\u7D2F\u8BA1\u5DE5\u4F5C\u6EE1 20 \u5E74" : wy >= 10 ? "\u6EE1 10 \u5E74\u4E0D\u6EE1 20 \u5E74" : "\u6EE1 1 \u5E74\u4E0D\u6EE1 10 \u5E74" },
        { label: "\u5E94\u4F11\u672A\u4F11\u5929\u6570", value: `${entitled} \u2212 ${taken} = ${untaken} \u5929` },
        { label: "\u65E5\u5DE5\u8D44", value: `${money(monthly)} \xF7 21.75 = ${money(daily)} \u5143` }
      ];
      const total300 = round(daily * untaken * 3, 2);
      const extra200 = round(daily * untaken * 2, 2);
      steps.push({
        label: "300% \u5DE5\u8D44\u62A5\u916C",
        value: `${money(daily)} \xD7 ${untaken} \u5929 \xD7 300% = ${money(total300)} \u5143`,
        note: "\u300A\u804C\u5DE5\u5E26\u85AA\u5E74\u4F11\u5047\u6761\u4F8B\u300B\u7B2C5\u6761",
        emphasis: true
      });
      steps.push({
        label: "\u5176\u4E2D\u9700\u53E6\u884C\u652F\u4ED8\u90E8\u5206",
        value: `${money(extra200)} \u5143`,
        note: "300% \u4E2D\u5DF2\u5305\u542B\u6B63\u5E38\u5DE5\u4F5C\u671F\u95F4\u7684\u4E00\u500D\u5DE5\u8D44\uFF0C\u5B9E\u9645\u53E6\u884C\u652F\u4ED8 200%",
        emphasis: true
      });
      const multi = round(extra200 * years, 2);
      if (years > 1) steps.push({ label: `\u8FFD\u7D22 ${years} \u5E74`, value: `${money(extra200)} \xD7 ${years} = ${money(multi)} \u5143`, emphasis: true });
      return {
        main: {
          label: `\u5E94\u53E6\u884C\u652F\u4ED8\u7684\u672A\u4F11\u5E74\u5047\u5DE5\u8D44\uFF08${years > 1 ? years + " \u5E74" : "\u672C\u5E74\u5EA6"}\uFF09`,
          value: money(years > 1 ? multi : extra200),
          unit: "\u5143",
          sub: moneyToChinese(years > 1 ? multi : extra200)
        },
        blocks: [
          { label: "\u6CD5\u5B9A\u5E94\u4F11\u5929\u6570", value: `${statutory} \u5929` },
          { label: "\u672A\u4F11\u5929\u6570", value: `${untaken} \u5929` },
          { label: "\u65E5\u5DE5\u8D44", value: money(daily), unit: "\u5143" },
          { label: "\u672C\u5E74\u5EA6 300% \u603B\u989D", value: money(total300), unit: "\u5143" }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u804C\u5DE5\u5E26\u85AA\u5E74\u4F11\u5047\u6761\u4F8B\u300B",
            article: "\u7B2C\u4E09\u6761",
            text: "\u804C\u5DE5\u7D2F\u8BA1\u5DE5\u4F5C\u5DF2\u6EE11\u5E74\u4E0D\u6EE110\u5E74\u7684\uFF0C\u5E74\u4F11\u50475\u5929\uFF1B\u5DF2\u6EE110\u5E74\u4E0D\u6EE120\u5E74\u7684\uFF0C\u5E74\u4F11\u504710\u5929\uFF1B\u5DF2\u6EE120\u5E74\u7684\uFF0C\u5E74\u4F11\u504715\u5929\u3002"
          },
          {
            law: "\u300A\u804C\u5DE5\u5E26\u85AA\u5E74\u4F11\u5047\u6761\u4F8B\u300B",
            article: "\u7B2C\u4E94\u6761",
            text: "\u5355\u4F4D\u56E0\u5DE5\u4F5C\u9700\u8981\u4E0D\u80FD\u5B89\u6392\u804C\u5DE5\u4F11\u5E74\u4F11\u5047\u7684\uFF0C\u7ECF\u804C\u5DE5\u672C\u4EBA\u540C\u610F\uFF0C\u53EF\u4EE5\u4E0D\u5B89\u6392\u4F11\u5E74\u4F11\u5047\u3002\u5BF9\u804C\u5DE5\u5E94\u4F11\u672A\u4F11\u7684\u5E74\u4F11\u5047\u5929\u6570\uFF0C\u5355\u4F4D\u5E94\u5F53\u6309\u7167\u8BE5\u804C\u5DE5\u65E5\u5DE5\u8D44\u6536\u5165\u7684300%\u652F\u4ED8\u5E74\u4F11\u5047\u5DE5\u8D44\u62A5\u916C\u3002"
          },
          {
            law: "\u300A\u4F01\u4E1A\u804C\u5DE5\u5E26\u85AA\u5E74\u4F11\u5047\u5B9E\u65BD\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u6761",
            text: "\u7528\u4EBA\u5355\u4F4D\u7ECF\u804C\u5DE5\u540C\u610F\u4E0D\u5B89\u6392\u5E74\u4F11\u5047\u6216\u8005\u5B89\u6392\u804C\u5DE5\u5E74\u4F11\u5047\u5929\u6570\u5C11\u4E8E\u5E94\u4F11\u5929\u6570\uFF0C\u5E94\u5F53\u5728\u672C\u5E74\u5EA6\u5185\u5BF9\u804C\u5DE5\u5E94\u4F11\u672A\u4F11\u5E74\u4F11\u5047\u5929\u6570\uFF0C\u6309\u7167\u5176\u65E5\u5DE5\u8D44\u6536\u5165\u7684300%\u652F\u4ED8\u672A\u4F11\u5E74\u4F11\u5047\u5DE5\u8D44\u62A5\u916C\uFF0C\u5176\u4E2D\u5305\u542B\u7528\u4EBA\u5355\u4F4D\u652F\u4ED8\u804C\u5DE5\u6B63\u5E38\u5DE5\u4F5C\u671F\u95F4\u7684\u5DE5\u8D44\u6536\u5165\u3002"
          }
        ],
        tips: [
          "\u8BA1\u7B97\u57FA\u6570\u5E94\u5254\u9664\u52A0\u73ED\u5DE5\u8D44\uFF0C\u6309\u524D 12 \u4E2A\u6708\u5E73\u5747\u6708\u5DE5\u8D44\u9664\u4EE5 21.75 \u6298\u7B97\u65E5\u5DE5\u8D44\u3002",
          '\u6700\u6613\u8E29\u7684\u5751\uFF1A300% \u4E2D\u5305\u542B\u5DF2\u53D1\u7684\u6B63\u5E38\u5DE5\u8D44\uFF0C\u5B9E\u9645\u53EA\u9700\u53E6\u884C\u652F\u4ED8 200%\uFF0C\u4E3B\u5F20\u65F6\u5E94\u660E\u786E\u662F"\u5DEE\u989D"\u3002',
          '\u5E74\u4F11\u5047\u5929\u6570\u6309"\u7D2F\u8BA1\u5DE5\u4F5C\u5E74\u9650"\u8BA1\u7B97\uFF0C\u5305\u542B\u5728\u5176\u4ED6\u5355\u4F4D\u7684\u5DE5\u4F5C\u5E74\u9650\uFF0C\u4E0D\u9650\u4E8E\u672C\u5355\u4F4D\u3002'
        ]
      };
    }
  },
  /* ── 未签劳动合同二倍工资 ── */
  {
    id: "double-wage",
    name: "\u672A\u7B7E\u52B3\u52A8\u5408\u540C\u4E8C\u500D\u5DE5\u8D44",
    category: "labor",
    glyph: "\u53CC",
    summary: "\u7528\u5DE5\u6EE1\u4E00\u4E2A\u6708\u672A\u7B7E\u4E66\u9762\u5408\u540C\u7684\u4E8C\u500D\u5DE5\u8D44\u5DEE\u989D",
    keywords: ["\u4E8C\u500D\u5DE5\u8D44", "\u672A\u7B7E\u5408\u540C", "\u4E66\u9762\u52B3\u52A8\u5408\u540C", "\u7B2C82\u6761"],
    fields: [
      { key: "startDate", label: "\u7528\u5DE5\u4E4B\u65E5", type: "date", defaultValue: "2025-01-01" },
      { key: "signDate", label: "\u8865\u7B7E\u4E66\u9762\u5408\u540C\u4E4B\u65E5", type: "date", defaultValue: "2025-08-01", hint: "\u81F3\u4ECA\u672A\u7B7E\u7684\u586B\u8BA1\u7B97\u622A\u6B62\u65E5" },
      { key: "monthlySalary", label: "\u6708\u5DE5\u8D44", type: "money", unit: "\u5143", defaultValue: 12e3 },
      {
        key: "status",
        label: "\u5408\u540C\u7B7E\u8BA2\u72B6\u6001",
        type: "select",
        defaultValue: "unsigned",
        options: [
          { label: "\u81F3\u4ECA\u672A\u7B7E", value: "unsigned" },
          { label: "\u5DF2\u8865\u7B7E", value: "signed" }
        ]
      }
    ],
    calc(values) {
      const start = parseDate(values.startDate) ?? /* @__PURE__ */ new Date();
      const sign = parseDate(values.signDate) ?? /* @__PURE__ */ new Date();
      const salary = toNum(values.monthlySalary);
      const status = toStr(values.status, "unsigned");
      const graceEnd = new Date(start.getFullYear(), start.getMonth() + 1, start.getDate());
      const capDate = new Date(start.getFullYear(), start.getMonth() + 12, start.getDate());
      const steps = [
        { label: "\u7528\u5DE5\u4E4B\u65E5", value: ymd(start) },
        { label: "\u4E00\u4E2A\u6708\u5BBD\u9650\u671F\u5C4A\u6EE1", value: ymd(graceEnd), note: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B\u7B2C10\u6761\uFF1A\u5DF2\u5EFA\u7ACB\u52B3\u52A8\u5173\u7CFB\uFF0C\u5E94\u81EA\u7528\u5DE5\u4E4B\u65E5\u8D77\u4E00\u4E2A\u6708\u5185\u8BA2\u7ACB\u4E66\u9762\u5408\u540C" },
        { label: "\u89C6\u4E3A\u8BA2\u7ACB\u65E0\u56FA\u5B9A\u671F\u9650\u5408\u540C\u4E4B\u65E5", value: ymd(capDate), note: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B\u7B2C14\u6761\u7B2C3\u6B3E\uFF1A\u7528\u5DE5\u6EE1\u4E00\u5E74\u4E0D\u7B7E\uFF0C\u89C6\u4E3A\u5DF2\u8BA2\u7ACB\u65E0\u56FA\u5B9A\u671F\u9650\u52B3\u52A8\u5408\u540C" }
      ];
      const end = status === "signed" ? sign < capDate ? sign : capDate : capDate;
      const m = Math.max(0, monthsBetween(graceEnd, end));
      const eligible = Math.min(m, 11);
      steps.push({
        label: "\u53EF\u4E3B\u5F20\u671F\u95F4",
        value: `${ymd(graceEnd)} \u81F3 ${ymd(end)}\uFF0C\u5171 ${eligible} \u4E2A\u6708`,
        note: status === "unsigned" ? "\u672A\u7B7E\u72B6\u6001\u6700\u957F\u8BA1\u7B97\u81F3\u6EE1\u4E00\u5E74\uFF0811 \u4E2A\u6708\uFF09" : "\u8BA1\u7B97\u81F3\u8865\u7B7E\u65E5",
        emphasis: true
      });
      const diff = round(salary * eligible, 2);
      steps.push({
        label: "\u4E8C\u500D\u5DE5\u8D44\u5DEE\u989D",
        value: `${money(salary)} \xD7 ${eligible} \u4E2A\u6708 = ${money(diff)} \u5143`,
        note: '\u4E8C\u500D\u5DE5\u8D44\u6307"\u518D\u4ED8\u4E00\u500D"\uFF0C\u5373\u5DEE\u989D\u4E3A\u6708\u5DE5\u8D44 \xD7 \u6708\u6570',
        emphasis: true
      });
      return {
        main: { label: "\u4E8C\u500D\u5DE5\u8D44\u5DEE\u989D", value: money(diff), unit: "\u5143", sub: moneyToChinese(diff) },
        blocks: [
          { label: "\u53EF\u4E3B\u5F20\u6708\u6570", value: `${eligible} \u4E2A\u6708`, sub: "\u6CD5\u5B9A\u6700\u957F 11 \u4E2A\u6708" },
          { label: "\u6708\u5DE5\u8D44\u57FA\u6570", value: money(salary), unit: "\u5143" },
          { label: "\u662F\u5426\u5DF2\u8D85\u6700\u957F\u671F\u95F4", value: eligible >= 11 ? "\u662F\uFF08\u5DF2\u8FBE 11 \u4E2A\u6708\u4E0A\u9650\uFF09" : "\u5426" }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B",
            article: "\u7B2C\u516B\u5341\u4E8C\u6761",
            text: "\u7528\u4EBA\u5355\u4F4D\u81EA\u7528\u5DE5\u4E4B\u65E5\u8D77\u8D85\u8FC7\u4E00\u4E2A\u6708\u4E0D\u6EE1\u4E00\u5E74\u672A\u4E0E\u52B3\u52A8\u8005\u8BA2\u7ACB\u4E66\u9762\u52B3\u52A8\u5408\u540C\u7684\uFF0C\u5E94\u5F53\u5411\u52B3\u52A8\u8005\u6BCF\u6708\u652F\u4ED8\u4E8C\u500D\u7684\u5DE5\u8D44\u3002"
          },
          {
            law: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u5B9E\u65BD\u6761\u4F8B\u300B",
            article: "\u7B2C\u4E03\u6761",
            text: "\u7528\u4EBA\u5355\u4F4D\u81EA\u7528\u5DE5\u4E4B\u65E5\u8D77\u6EE1\u4E00\u5E74\u672A\u4E0E\u52B3\u52A8\u8005\u8BA2\u7ACB\u4E66\u9762\u52B3\u52A8\u5408\u540C\u7684\uFF0C\u81EA\u7528\u5DE5\u4E4B\u65E5\u8D77\u6EE1\u4E00\u4E2A\u6708\u7684\u6B21\u65E5\u81F3\u6EE1\u4E00\u5E74\u7684\u524D\u4E00\u65E5\u5E94\u5F53\u4F9D\u7167\u52B3\u52A8\u5408\u540C\u6CD5\u7B2C\u516B\u5341\u4E8C\u6761\u7684\u89C4\u5B9A\u5411\u52B3\u52A8\u8005\u6BCF\u6708\u652F\u4ED8\u4E24\u500D\u7684\u5DE5\u8D44\uFF0C\u5E76\u89C6\u4E3A\u81EA\u7528\u5DE5\u4E4B\u65E5\u8D77\u6EE1\u4E00\u5E74\u7684\u5F53\u65E5\u5DF2\u7ECF\u4E0E\u52B3\u52A8\u8005\u8BA2\u7ACB\u65E0\u56FA\u5B9A\u671F\u9650\u52B3\u52A8\u5408\u540C\u3002"
          }
        ],
        tips: [
          '\u4E8C\u500D\u5DE5\u8D44\u7684\u4EF2\u88C1\u65F6\u6548\u4E3A\u4E00\u5E74\uFF0C\u4ECE"\u5E94\u5F53\u8BA2\u7ACB\u4E66\u9762\u52B3\u52A8\u5408\u540C\u671F\u6EE1\u4E4B\u65E5\u7684\u6B21\u65E5"\u8D77\u7B97\uFF0C\u903E\u671F\u4E3B\u5F20\u5B58\u5728\u88AB\u9A73\u56DE\u98CE\u9669\uFF0C\u5404\u5730\u88C1\u5224\u53E3\u5F84\u6709\u5DEE\u5F02\u3002',
          "\u6708\u5DE5\u8D44\u57FA\u6570\u6709\u4E89\u8BAE\u65F6\uFF0C\u4E00\u822C\u6309\u52B3\u52A8\u8005\u5E94\u5F97\u6708\u5DE5\u8D44\u786E\u5B9A\uFF0C\u5305\u542B\u5956\u91D1\u3001\u6D25\u8D34\u3002",
          "\u5012\u7B7E\u52B3\u52A8\u5408\u540C\uFF08\u628A\u7B7E\u7EA6\u65E5\u671F\u5012\u7B7E\u81F3\u7528\u5DE5\u4E4B\u65E5\uFF09\u80FD\u5426\u514D\u8D23\uFF0C\u5404\u5730\u88C1\u5224\u4E0D\u4E00\uFF0C\u4F46\u591A\u6570\u6CD5\u9662\u5BF9\u771F\u5B9E\u8865\u7B7E\u6301\u5BBD\u5BB9\u6001\u5EA6\u3002"
        ]
      };
    }
  },
  /* ── 工伤伤残赔偿 ── */
  {
    id: "work-injury",
    name: "\u5DE5\u4F24\u4F24\u6B8B\u8D54\u507F",
    category: "labor",
    glyph: "\u4F24",
    summary: "1\u201410 \u7EA7\u4F24\u6B8B\u7684\u4E00\u6B21\u6027\u4F24\u6B8B\u8865\u52A9\u91D1\u3001\u4F24\u6B8B\u6D25\u8D34\u53CA\u4E24\u9879\u4E00\u6B21\u6027\u8865\u52A9\u91D1",
    keywords: ["\u5DE5\u4F24", "\u4F24\u6B8B", "\u4E00\u6B21\u6027\u4F24\u6B8B\u8865\u52A9\u91D1", "\u4F24\u6B8B\u6D25\u8D34"],
    fields: [
      {
        key: "level",
        label: "\u4F24\u6B8B\u7B49\u7EA7",
        type: "select",
        defaultValue: "9",
        options: Array.from({ length: 10 }, (_, i) => ({ label: `${i + 1} \u7EA7`, value: String(i + 1) }))
      },
      { key: "salary", label: "\u672C\u4EBA\u5DE5\u8D44\uFF08\u6708\u7F34\u8D39\u5DE5\u8D44\uFF09", type: "money", unit: "\u5143", defaultValue: 1e4, hint: "\u5DE5\u4F24\u524D 12 \u4E2A\u6708\u5E73\u5747\u6708\u7F34\u8D39\u5DE5\u8D44" },
      { key: "localAvg", label: "\u7EDF\u7B79\u5730\u533A\u804C\u5DE5\u6708\u5E73\u5747\u5DE5\u8D44", type: "money", unit: "\u5143", defaultValue: 9e3, hint: "\u7528\u4E8E 60%\u2014300% \u7684\u4FDD\u5E95\u5C01\u9876\uFF0C\u586B 0 \u8DF3\u8FC7" },
      {
        key: "terminate",
        label: "\u662F\u5426\u89E3\u9664 / \u7EC8\u6B62\u52B3\u52A8\u5173\u7CFB",
        type: "switch",
        defaultValue: true,
        hint: "5\u201410 \u7EA7\u89E3\u9664\u6216\u7EC8\u6B62\u5408\u540C\u65F6\uFF0C\u53EF\u4E3B\u5F20\u4E00\u6B21\u6027\u5DE5\u4F24\u533B\u7597\u8865\u52A9\u91D1\u548C\u4F24\u6B8B\u5C31\u4E1A\u8865\u52A9\u91D1"
      },
      {
        key: "medicalMonths",
        label: "\u4E00\u6B21\u6027\u5DE5\u4F24\u533B\u7597\u8865\u52A9\u91D1\uFF08\u6708\u6570\uFF09",
        type: "number",
        unit: "\u6708",
        defaultValue: 6,
        hint: "\u7531\u7701\u7EA7\u653F\u5E9C\u89C4\u5B9A\uFF0C\u8BF7\u6309\u5F53\u5730\u6807\u51C6\u586B\u5199",
        visibleWhen: (v) => (v.terminate === true || v.terminate === "true") && Number(toStr(v.level)) >= 5
      },
      {
        key: "employmentMonths",
        label: "\u4E00\u6B21\u6027\u4F24\u6B8B\u5C31\u4E1A\u8865\u52A9\u91D1\uFF08\u6708\u6570\uFF09",
        type: "number",
        unit: "\u6708",
        defaultValue: 8,
        hint: "\u7531\u7701\u7EA7\u653F\u5E9C\u89C4\u5B9A\uFF0C\u8BF7\u6309\u5F53\u5730\u6807\u51C6\u586B\u5199",
        visibleWhen: (v) => (v.terminate === true || v.terminate === "true") && Number(toStr(v.level)) >= 5
      },
      {
        key: "medicalCare",
        label: "\u533B\u7597\u8D39\u3001\u5EB7\u590D\u8D39\u7B49\u5DF2\u652F\u51FA\u8D39\u7528",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        hint: "\u7B26\u5408\u5DE5\u4F24\u4FDD\u9669\u76EE\u5F55\u7684\u7531\u57FA\u91D1\u652F\u4ED8"
      }
    ],
    calc(values) {
      const level = Math.max(1, Math.min(10, Math.round(toNum(values.level, 9))));
      let salary = toNum(values.salary);
      const localAvg = toNum(values.localAvg);
      const terminate = values.terminate === true || values.terminate === "true";
      const medicalMonths = toNum(values.medicalMonths);
      const employmentMonths = toNum(values.employmentMonths);
      const medicalCare = toNum(values.medicalCare);
      const steps = [];
      if (localAvg > 0) {
        const low = localAvg * 0.6;
        const high = localAvg * 3;
        if (salary < low) {
          steps.push({ label: "\u672C\u4EBA\u5DE5\u8D44\u4F4E\u4E8E\u7EDF\u7B79\u5730\u533A 60%", value: `\u6309 ${money(low)} \u5143\u8BA1`, note: "\u300A\u5DE5\u4F24\u4FDD\u9669\u6761\u4F8B\u300B\u7B2C64\u6761" });
          salary = low;
        } else if (salary > high) {
          steps.push({ label: "\u672C\u4EBA\u5DE5\u8D44\u9AD8\u4E8E\u7EDF\u7B79\u5730\u533A 300%", value: `\u6309 ${money(high)} \u5143\u8BA1`, note: "\u300A\u5DE5\u4F24\u4FDD\u9669\u6761\u4F8B\u300B\u7B2C64\u6761" });
          salary = high;
        } else {
          steps.push({ label: "\u672C\u4EBA\u5DE5\u8D44", value: `${money(salary)} \u5143`, note: "\u5728 60%\u2014300% \u533A\u95F4\u5185\uFF0C\u636E\u5B9E\u8BA1\u7B97" });
        }
      } else {
        steps.push({ label: "\u672C\u4EBA\u5DE5\u8D44", value: `${money(salary)} \u5143` });
      }
      const grantMonths = DISABILITY_GRANT_MONTHS[level - 1];
      const grant = round(salary * grantMonths, 2);
      steps.push({
        label: `\u4E00\u6B21\u6027\u4F24\u6B8B\u8865\u52A9\u91D1\uFF08${level} \u7EA7 = ${grantMonths} \u4E2A\u6708\uFF09`,
        value: `${money(salary)} \xD7 ${grantMonths} = ${money(grant)} \u5143`,
        note: "\u300A\u5DE5\u4F24\u4FDD\u9669\u6761\u4F8B\u300B\u7B2C35\u201437\u6761\uFF0C\u7531\u5DE5\u4F24\u4FDD\u9669\u57FA\u91D1\u652F\u4ED8",
        emphasis: true
      });
      let pensionMonthly = 0;
      if (level <= 6) {
        const rate = DISABILITY_PENSION_RATE[level - 1];
        pensionMonthly = round(salary * rate, 2);
        steps.push({
          label: `\u4F24\u6B8B\u6D25\u8D34\uFF08${level} \u7EA7 = ${rate * 100}%\uFF09`,
          value: `\u6BCF\u6708 ${money(pensionMonthly)} \u5143`,
          note: level <= 4 ? "\u4FDD\u7559\u52B3\u52A8\u5173\u7CFB\u3001\u9000\u51FA\u5DE5\u4F5C\u5C97\u4F4D\uFF0C\u7531\u57FA\u91D1\u6309\u6708\u652F\u4ED8" : "\u5355\u4F4D\u96BE\u4EE5\u5B89\u6392\u5DE5\u4F5C\u7684\uFF0C\u7531\u5355\u4F4D\u6309\u6708\u652F\u4ED8"
        });
      }
      let medicalGrant = 0;
      let employmentGrant = 0;
      if (terminate && level >= 5) {
        medicalGrant = round(salary * medicalMonths, 2);
        employmentGrant = round(salary * employmentMonths, 2);
        steps.push({
          label: `\u4E00\u6B21\u6027\u5DE5\u4F24\u533B\u7597\u8865\u52A9\u91D1\uFF08${medicalMonths} \u4E2A\u6708\uFF09`,
          value: `${money(salary)} \xD7 ${medicalMonths} = ${money(medicalGrant)} \u5143`,
          note: "\u7531\u5DE5\u4F24\u4FDD\u9669\u57FA\u91D1\u652F\u4ED8\uFF0C\u6807\u51C6\u7531\u7701\u7EA7\u653F\u5E9C\u89C4\u5B9A"
        });
        steps.push({
          label: `\u4E00\u6B21\u6027\u4F24\u6B8B\u5C31\u4E1A\u8865\u52A9\u91D1\uFF08${employmentMonths} \u4E2A\u6708\uFF09`,
          value: `${money(salary)} \xD7 ${employmentMonths} = ${money(employmentGrant)} \u5143`,
          note: "\u7531\u7528\u4EBA\u5355\u4F4D\u652F\u4ED8\uFF0C\u6807\u51C6\u7531\u7701\u7EA7\u653F\u5E9C\u89C4\u5B9A"
        });
      }
      const lumpSum = round(grant + medicalGrant + employmentGrant + medicalCare, 2);
      steps.push({
        label: "\u4E00\u6B21\u6027\u9879\u76EE\u5408\u8BA1",
        value: `${money(lumpSum)} \u5143`,
        emphasis: true,
        note: medicalCare > 0 ? "\u542B\u5DF2\u652F\u51FA\u7684\u533B\u7597\u8D39\u3001\u5EB7\u590D\u8D39" : ""
      });
      const blocks = [
        { label: "\u4E00\u6B21\u6027\u4F24\u6B8B\u8865\u52A9\u91D1", value: money(grant), unit: "\u5143" },
        { label: "\u4E00\u6B21\u6027\u5DE5\u4F24\u533B\u7597\u8865\u52A9\u91D1", value: money(medicalGrant), unit: "\u5143" },
        { label: "\u4E00\u6B21\u6027\u4F24\u6B8B\u5C31\u4E1A\u8865\u52A9\u91D1", value: money(employmentGrant), unit: "\u5143" }
      ];
      if (pensionMonthly > 0) {
        blocks.push({ label: "\u4F24\u6B8B\u6D25\u8D34\uFF08\u6309\u6708\uFF09", value: money(pensionMonthly), unit: "\u5143/\u6708" });
      }
      if (medicalCare > 0) blocks.push({ label: "\u533B\u7597\u5EB7\u590D\u8D39", value: money(medicalCare), unit: "\u5143" });
      return {
        main: { label: "\u4E00\u6B21\u6027\u8D54\u507F\u5408\u8BA1", value: money(lumpSum), unit: "\u5143", sub: moneyToChinese(lumpSum) },
        blocks,
        steps,
        basis: [
          {
            law: "\u300A\u5DE5\u4F24\u4FDD\u9669\u6761\u4F8B\u300B",
            article: "\u7B2C\u4E09\u5341\u4E94\u6761\u81F3\u7B2C\u4E09\u5341\u4E03\u6761",
            text: "\u804C\u5DE5\u56E0\u5DE5\u81F4\u6B8B\u88AB\u9274\u5B9A\u4E3A\u4E00\u7EA7\u81F3\u5341\u7EA7\u4F24\u6B8B\u7684\uFF0C\u4ECE\u5DE5\u4F24\u4FDD\u9669\u57FA\u91D1\u6309\u4F24\u6B8B\u7B49\u7EA7\u652F\u4ED8\u4E00\u6B21\u6027\u4F24\u6B8B\u8865\u52A9\u91D1\uFF0C\u6807\u51C6\u4E3A\uFF1A\u4E00\u7EA727\u4E2A\u6708\u3001\u4E8C\u7EA725\u4E2A\u6708\u3001\u4E09\u7EA723\u4E2A\u6708\u3001\u56DB\u7EA721\u4E2A\u6708\u3001\u4E94\u7EA718\u4E2A\u6708\u3001\u516D\u7EA716\u4E2A\u6708\u3001\u4E03\u7EA713\u4E2A\u6708\u3001\u516B\u7EA711\u4E2A\u6708\u3001\u4E5D\u7EA79\u4E2A\u6708\u3001\u5341\u7EA77\u4E2A\u6708\u7684\u672C\u4EBA\u5DE5\u8D44\u3002"
          },
          {
            law: "\u300A\u5DE5\u4F24\u4FDD\u9669\u6761\u4F8B\u300B",
            article: "\u7B2C\u516D\u5341\u56DB\u6761",
            text: "\u672C\u4EBA\u5DE5\u8D44\u9AD8\u4E8E\u7EDF\u7B79\u5730\u533A\u804C\u5DE5\u5E73\u5747\u5DE5\u8D44300%\u7684\uFF0C\u6309\u7167\u7EDF\u7B79\u5730\u533A\u804C\u5DE5\u5E73\u5747\u5DE5\u8D44\u7684300%\u8BA1\u7B97\uFF1B\u672C\u4EBA\u5DE5\u8D44\u4F4E\u4E8E\u7EDF\u7B79\u5730\u533A\u804C\u5DE5\u5E73\u5747\u5DE5\u8D4460%\u7684\uFF0C\u6309\u7167\u7EDF\u7B79\u5730\u533A\u804C\u5DE5\u5E73\u5747\u5DE5\u8D44\u768460%\u8BA1\u7B97\u3002"
          }
        ],
        tips: [
          "\u4E00\u6B21\u6027\u5DE5\u4F24\u533B\u7597\u8865\u52A9\u91D1\u4E0E\u4E00\u6B21\u6027\u4F24\u6B8B\u5C31\u4E1A\u8865\u52A9\u91D1\u7684\u5177\u4F53\u6708\u6570\u7531\u5404\u7701\u3001\u81EA\u6CBB\u533A\u3001\u76F4\u8F96\u5E02\u4EBA\u6C11\u653F\u5E9C\u89C4\u5B9A\uFF0C\u52A1\u5FC5\u67E5\u8BE2\u5F53\u5730\u5B9E\u65BD\u529E\u6CD5\u3002",
          "\u7528\u4EBA\u5355\u4F4D\u672A\u7F34\u7EB3\u5DE5\u4F24\u4FDD\u9669\u7684\uFF0C\u5168\u90E8\u5DE5\u4F24\u4FDD\u9669\u5F85\u9047\u7531\u7528\u4EBA\u5355\u4F4D\u652F\u4ED8\uFF0C\u8FD9\u662F\u5B9E\u52A1\u4E2D\u6700\u5E38\u89C1\u7684\u9AD8\u989D\u7D22\u8D54\u6765\u6E90\u3002",
          "\u4F24\u6B8B\u6D25\u8D34\u5B9E\u9645\u91D1\u989D\u4F4E\u4E8E\u5F53\u5730\u6700\u4F4E\u5DE5\u8D44\u6807\u51C6\u7684\uFF0C\u7531\u5DE5\u4F24\u4FDD\u9669\u57FA\u91D1\u8865\u8DB3\u5DEE\u989D\u3002",
          "\u5DE5\u4F24\u8BA4\u5B9A\u7533\u8BF7\u65F6\u6548\uFF1A\u5355\u4F4D 30 \u65E5\u5185\u63D0\u51FA\uFF0C\u804C\u5DE5\u65B9 1 \u5E74\u5185\u63D0\u51FA\uFF0C\u5207\u52FF\u903E\u671F\u3002"
        ]
      };
    }
  },
  /* ── 工亡赔偿 ── */
  {
    id: "work-death",
    name: "\u5DE5\u4EA1\u8D54\u507F",
    category: "labor",
    glyph: "\u4EA1",
    summary: "\u4E27\u846C\u8865\u52A9\u91D1\u3001\u4F9B\u517B\u4EB2\u5C5E\u629A\u6064\u91D1\u4E0E\u4E00\u6B21\u6027\u5DE5\u4EA1\u8865\u52A9\u91D1",
    keywords: ["\u5DE5\u4EA1", "\u4E00\u6B21\u6027\u5DE5\u4EA1\u8865\u52A9\u91D1", "\u629A\u6064\u91D1", "\u4E27\u846C\u8865\u52A9\u91D1"],
    fields: [
      { key: "localAvg", label: "\u7EDF\u7B79\u5730\u533A\u4E0A\u5E74\u5EA6\u804C\u5DE5\u6708\u5E73\u5747\u5DE5\u8D44", type: "money", unit: "\u5143", defaultValue: 9e3 },
      {
        key: "urbanIncome",
        label: "\u4E0A\u4E00\u5E74\u5EA6\u5168\u56FD\u57CE\u9547\u5C45\u6C11\u4EBA\u5747\u53EF\u652F\u914D\u6536\u5165",
        type: "money",
        unit: "\u5143",
        defaultValue: URBAN_INCOME_DEFAULT,
        hint: "\u56FD\u5BB6\u7EDF\u8BA1\u5C40\u516C\u5E03\uFF0C\u7528\u4E8E\u4E00\u6B21\u6027\u5DE5\u4EA1\u8865\u52A9\u91D1\uFF08\xD720\uFF09"
      },
      { key: "deceasedSalary", label: "\u5DE5\u4EA1\u804C\u5DE5\u751F\u524D\u6708\u5DE5\u8D44", type: "money", unit: "\u5143", defaultValue: 1e4 },
      {
        key: "dependents",
        label: "\u4F9B\u517B\u4EB2\u5C5E\u4EBA\u6570",
        type: "number",
        unit: "\u4EBA",
        defaultValue: 2,
        hint: "\u542B\u914D\u5076\u3001\u7236\u6BCD\u3001\u5B50\u5973\u7B49\u7B26\u5408\u6761\u4EF6\u7684\u4EB2\u5C5E"
      },
      {
        key: "hasSpouse",
        label: "\u662F\u5426\u542B\u914D\u5076",
        type: "switch",
        defaultValue: true,
        hint: "\u914D\u5076\u6BCF\u6708 40%\uFF0C\u5176\u4ED6\u4EB2\u5C5E\u6BCF\u4EBA\u6BCF\u6708 30%"
      },
      {
        key: "isOrphan",
        label: "\u662F\u5426\u542B\u5B64\u5BE1\u8001\u4EBA\u6216\u5B64\u513F",
        type: "switch",
        defaultValue: false,
        hint: "\u6BCF\u4EBA\u6BCF\u6708\u5728\u4E0A\u8FF0\u6807\u51C6\u57FA\u7840\u4E0A\u589E\u52A0 10%"
      }
    ],
    calc(values) {
      const localAvg = toNum(values.localAvg);
      const urban = toNum(values.urbanIncome);
      const salary = toNum(values.deceasedSalary);
      const dependents = Math.max(0, Math.round(toNum(values.dependents)));
      const hasSpouse = values.hasSpouse === true || values.hasSpouse === "true";
      const isOrphan = values.isOrphan === true || values.isOrphan === "true";
      const funeral = round(localAvg * 6, 2);
      const lumpSum = round(urban * 20, 2);
      const steps = [
        {
          label: "\u4E27\u846C\u8865\u52A9\u91D1",
          value: `${money(localAvg)} \xD7 6 = ${money(funeral)} \u5143`,
          note: "\u300A\u5DE5\u4F24\u4FDD\u9669\u6761\u4F8B\u300B\u7B2C39\u6761\u7B2C\uFF08\u4E00\uFF09\u9879\uFF0C6 \u4E2A\u6708\u7EDF\u7B79\u5730\u533A\u4E0A\u5E74\u5EA6\u804C\u5DE5\u6708\u5E73\u5747\u5DE5\u8D44"
        },
        {
          label: "\u4E00\u6B21\u6027\u5DE5\u4EA1\u8865\u52A9\u91D1",
          value: `${money(urban)} \xD7 20 = ${money(lumpSum)} \u5143`,
          note: "\u300A\u5DE5\u4F24\u4FDD\u9669\u6761\u4F8B\u300B\u7B2C39\u6761\u7B2C\uFF08\u4E09\uFF09\u9879\uFF0C\u4E0A\u4E00\u5E74\u5EA6\u5168\u56FD\u57CE\u9547\u5C45\u6C11\u4EBA\u5747\u53EF\u652F\u914D\u6536\u5165\u7684 20 \u500D",
          emphasis: true
        }
      ];
      const others = Math.max(0, dependents - (hasSpouse ? 1 : 0));
      let monthlyRate = 0;
      if (hasSpouse) monthlyRate += 0.4 + (isOrphan ? 0.1 : 0);
      monthlyRate += others * (0.3 + (isOrphan ? 0.1 : 0));
      let pensionMonthly = round(salary * monthlyRate, 2);
      const capped = pensionMonthly > salary;
      if (capped) pensionMonthly = salary;
      steps.push({
        label: "\u4F9B\u517B\u4EB2\u5C5E\u6784\u6210",
        value: (hasSpouse ? `\u914D\u5076 1 \u4EBA\uFF08${(40 + (isOrphan ? 10 : 0)).toFixed(0)}%\uFF09` : "\u65E0\u914D\u5076") + (others > 0 ? ` + \u5176\u4ED6\u4EB2\u5C5E ${others} \u4EBA\uFF08\u6BCF\u4EBA ${(30 + (isOrphan ? 10 : 0)).toFixed(0)}%\uFF09` : "")
      });
      steps.push({
        label: "\u629A\u6064\u91D1\u5408\u8BA1\u6BD4\u4F8B",
        value: `${(monthlyRate * 100).toFixed(0)}%`,
        note: capped ? "\u26A0 \u5DF2\u8D85\u8FC7\u751F\u524D\u5DE5\u8D44\uFF0C\u6309\u751F\u524D\u5DE5\u8D44\u603B\u989D\u5C01\u9876" : ""
      });
      steps.push({
        label: "\u4F9B\u517B\u4EB2\u5C5E\u629A\u6064\u91D1\uFF08\u6309\u6708\uFF09",
        value: `${money(salary)} \xD7 ${(monthlyRate * 100).toFixed(0)}% = ${money(pensionMonthly)} \u5143/\u6708`,
        note: capped ? "\u300A\u5DE5\u4F24\u4FDD\u9669\u6761\u4F8B\u300B\u7B2C39\u6761\u7B2C\uFF08\u4E8C\uFF09\u9879\uFF1A\u6838\u5B9A\u7684\u5404\u4F9B\u517B\u4EB2\u5C5E\u629A\u6064\u91D1\u4E4B\u548C\u4E0D\u5E94\u9AD8\u4E8E\u5DE5\u4EA1\u804C\u5DE5\u751F\u524D\u5DE5\u8D44" : "\u300A\u5DE5\u4F24\u4FDD\u9669\u6761\u4F8B\u300B\u7B2C39\u6761\u7B2C\uFF08\u4E8C\uFF09\u9879",
        emphasis: true
      });
      const total = round(funeral + lumpSum, 2);
      steps.push({ label: "\u4E00\u6B21\u6027\u8D54\u507F\u5408\u8BA1", value: `${money(total)} \u5143`, emphasis: true });
      return {
        main: { label: "\u4E00\u6B21\u6027\u5DE5\u4EA1\u8D54\u507F\u5408\u8BA1", value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        blocks: [
          { label: "\u4E27\u846C\u8865\u52A9\u91D1", value: money(funeral), unit: "\u5143" },
          { label: "\u4E00\u6B21\u6027\u5DE5\u4EA1\u8865\u52A9\u91D1", value: money(lumpSum), unit: "\u5143" },
          { label: "\u4F9B\u517B\u4EB2\u5C5E\u629A\u6064\u91D1", value: money(pensionMonthly), unit: "\u5143/\u6708", sub: capped ? "\u5DF2\u6309\u751F\u524D\u5DE5\u8D44\u5C01\u9876" : `\u5360\u751F\u524D\u5DE5\u8D44 ${(monthlyRate * 100).toFixed(0)}%` },
          { label: "\u629A\u6064\u91D1\u5E74\u5EA6\u91D1\u989D", value: money(round(pensionMonthly * 12, 2)), unit: "\u5143/\u5E74" }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u5DE5\u4F24\u4FDD\u9669\u6761\u4F8B\u300B",
            article: "\u7B2C\u4E09\u5341\u4E5D\u6761",
            text: "\u804C\u5DE5\u56E0\u5DE5\u6B7B\u4EA1\uFF0C\u5176\u8FD1\u4EB2\u5C5E\u6309\u7167\u4E0B\u5217\u89C4\u5B9A\u4ECE\u5DE5\u4F24\u4FDD\u9669\u57FA\u91D1\u9886\u53D6\u4E27\u846C\u8865\u52A9\u91D1\u3001\u4F9B\u517B\u4EB2\u5C5E\u629A\u6064\u91D1\u548C\u4E00\u6B21\u6027\u5DE5\u4EA1\u8865\u52A9\u91D1\uFF1A\uFF08\u4E00\uFF09\u4E27\u846C\u8865\u52A9\u91D1\u4E3A6\u4E2A\u6708\u7684\u7EDF\u7B79\u5730\u533A\u4E0A\u5E74\u5EA6\u804C\u5DE5\u6708\u5E73\u5747\u5DE5\u8D44\uFF1B\uFF08\u4E8C\uFF09\u4F9B\u517B\u4EB2\u5C5E\u629A\u6064\u91D1\u6309\u7167\u804C\u5DE5\u672C\u4EBA\u5DE5\u8D44\u7684\u4E00\u5B9A\u6BD4\u4F8B\u53D1\u7ED9\u7531\u56E0\u5DE5\u6B7B\u4EA1\u804C\u5DE5\u751F\u524D\u63D0\u4F9B\u4E3B\u8981\u751F\u6D3B\u6765\u6E90\u3001\u65E0\u52B3\u52A8\u80FD\u529B\u7684\u4EB2\u5C5E\u3002\u6807\u51C6\u4E3A\uFF1A\u914D\u5076\u6BCF\u670840%\uFF0C\u5176\u4ED6\u4EB2\u5C5E\u6BCF\u4EBA\u6BCF\u670830%\uFF0C\u5B64\u5BE1\u8001\u4EBA\u6216\u8005\u5B64\u513F\u6BCF\u4EBA\u6BCF\u6708\u5728\u4E0A\u8FF0\u6807\u51C6\u7684\u57FA\u7840\u4E0A\u589E\u52A010%\u3002\u6838\u5B9A\u7684\u5404\u4F9B\u517B\u4EB2\u5C5E\u7684\u629A\u6064\u91D1\u4E4B\u548C\u4E0D\u5E94\u9AD8\u4E8E\u56E0\u5DE5\u6B7B\u4EA1\u804C\u5DE5\u751F\u524D\u7684\u5DE5\u8D44\uFF1B\uFF08\u4E09\uFF09\u4E00\u6B21\u6027\u5DE5\u4EA1\u8865\u52A9\u91D1\u6807\u51C6\u4E3A\u4E0A\u4E00\u5E74\u5EA6\u5168\u56FD\u57CE\u9547\u5C45\u6C11\u4EBA\u5747\u53EF\u652F\u914D\u6536\u5165\u768420\u500D\u3002"
          }
        ],
        tips: [
          "\u4E00\u6B21\u6027\u5DE5\u4EA1\u8865\u52A9\u91D1\u5168\u56FD\u7EDF\u4E00\u6807\u51C6\uFF0C\u4E0D\u56E0\u5730\u533A\u800C\u5F02\uFF0C\u6BCF\u5E74\u968F\u56FD\u5BB6\u7EDF\u8BA1\u5C40\u516C\u5E03\u7684\u57CE\u9547\u5C45\u6C11\u4EBA\u5747\u53EF\u652F\u914D\u6536\u5165\u8C03\u6574\u3002",
          "\u4F9B\u517B\u4EB2\u5C5E\u629A\u6064\u91D1\u603B\u989D\u4E0D\u5F97\u8D85\u8FC7\u5DE5\u4EA1\u804C\u5DE5\u751F\u524D\u5DE5\u8D44\uFF0C\u4EB2\u5C5E\u4EBA\u6570\u591A\u65F6\u4F1A\u81EA\u52A8\u89E6\u9876\u3002",
          "\u4F24\u6B8B\u804C\u5DE5\u5728\u505C\u5DE5\u7559\u85AA\u671F\u5185\u56E0\u5DE5\u4F24\u5BFC\u81F4\u6B7B\u4EA1\u7684\uFF0C\u5176\u8FD1\u4EB2\u5C5E\u540C\u6837\u4EAB\u53D7\u4E0A\u8FF0\u5168\u90E8\u5F85\u9047\u3002"
        ]
      };
    }
  },
  /* ── 竞业限制补偿金 ── */
  {
    id: "non-compete",
    name: "\u7ADE\u4E1A\u9650\u5236\u8865\u507F\u91D1",
    category: "labor",
    glyph: "\u7ADE",
    summary: "\u7ADE\u4E1A\u9650\u5236\u671F\u5185\u7684\u6708\u5EA6\u8865\u507F\u91D1\u4E0E\u603B\u989D\uFF0C\u542B\u6700\u4F4E\u6807\u51C6\u6821\u9A8C",
    keywords: ["\u7ADE\u4E1A\u9650\u5236", "\u7ADE\u4E1A\u7981\u6B62", "\u8865\u507F\u91D1", "\u4FDD\u5BC6\u534F\u8BAE"],
    fields: [
      { key: "avgSalary", label: "\u79BB\u804C\u524D 12 \u4E2A\u6708\u5E73\u5747\u5DE5\u8D44", type: "money", unit: "\u5143", defaultValue: 2e4 },
      { key: "months", label: "\u7ADE\u4E1A\u9650\u5236\u671F\u9650", type: "number", unit: "\u6708", defaultValue: 24, hint: "\u6CD5\u5B9A\u6700\u957F\u4E0D\u8D85\u8FC7 2 \u5E74" },
      {
        key: "agreed",
        label: "\u662F\u5426\u7EA6\u5B9A\u4E86\u8865\u507F\u6807\u51C6",
        type: "switch",
        defaultValue: false
      },
      {
        key: "monthlyAmount",
        label: "\u7EA6\u5B9A\u7684\u6708\u8865\u507F\u91D1\u989D",
        type: "money",
        unit: "\u5143",
        defaultValue: 6e3,
        visibleWhen: (v) => v.agreed === true || v.agreed === "true"
      },
      { key: "minWage", label: "\u52B3\u52A8\u5408\u540C\u5C65\u884C\u5730\u6700\u4F4E\u5DE5\u8D44\u6807\u51C6", type: "money", unit: "\u5143", defaultValue: 2500 }
    ],
    calc(values) {
      const avg = toNum(values.avgSalary);
      let months = toNum(values.months);
      const agreed = values.agreed === true || values.agreed === "true";
      const monthlyAmount = toNum(values.monthlyAmount);
      const minWage = toNum(values.minWage);
      const steps = [];
      if (months > 24) {
        steps.push({ label: "\u671F\u9650\u8D85\u9650", value: "\u7EA6\u5B9A\u7684 24 \u4E2A\u6708\u4EE5\u4E0A\u90E8\u5206\u65E0\u6548\uFF0C\u6309 24 \u4E2A\u6708\u8BA1", note: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B\u7B2C24\u6761", emphasis: true });
        months = 24;
      }
      const statutoryMonthly = round(avg * 0.3, 2);
      steps.push({
        label: "\u6CD5\u5B9A\u53C2\u8003\u6807\u51C6\uFF08\u524D 12 \u4E2A\u6708\u5E73\u5747\u5DE5\u8D44 30%\uFF09",
        value: `${money(avg)} \xD7 30% = ${money(statutoryMonthly)} \u5143/\u6708`,
        note: "\u300A\u52B3\u52A8\u4E89\u8BAE\u53F8\u6CD5\u89E3\u91CA\uFF08\u4E00\uFF09\u300B\u76F8\u5173\u89C4\u5B9A\uFF1A\u672A\u7EA6\u5B9A\u8865\u507F\u6807\u51C6\u7684\uFF0C\u53EF\u6309\u6B64\u4E3B\u5F20"
      });
      let monthly = agreed ? monthlyAmount : statutoryMonthly;
      steps.push({ label: "\u9002\u7528\u6708\u8865\u507F\u6807\u51C6", value: `${money(monthly)} \u5143/\u6708`, emphasis: true });
      if (monthly < minWage) {
        steps.push({
          label: "\u4F4E\u4E8E\u6700\u4F4E\u5DE5\u8D44\u6807\u51C6",
          value: `\u4E0D\u8DB3 ${money(minWage)} \u5143\uFF0C\u5E94\u8865\u8DB3\u81F3\u6700\u4F4E\u5DE5\u8D44`,
          note: "\u8865\u507F\u6807\u51C6\u4E0D\u5F97\u4F4E\u4E8E\u52B3\u52A8\u5408\u540C\u5C65\u884C\u5730\u6700\u4F4E\u5DE5\u8D44",
          emphasis: true
        });
        monthly = minWage;
      }
      const total = round(monthly * months, 2);
      steps.push({ label: "\u8865\u507F\u91D1\u603B\u989D", value: `${money(monthly)} \xD7 ${months} \u4E2A\u6708 = ${money(total)} \u5143`, emphasis: true });
      const ratio = round(monthly / Math.max(avg, 1) * 100, 2);
      return {
        main: { label: "\u7ADE\u4E1A\u9650\u5236\u8865\u507F\u91D1\u603B\u989D", value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        blocks: [
          { label: "\u6708\u8865\u507F\u6807\u51C6", value: money(monthly), unit: "\u5143/\u6708" },
          { label: "\u5360\u79BB\u804C\u524D\u5DE5\u8D44\u6BD4\u4F8B", value: `${ratio}%`, sub: ratio < 30 ? "\u26A0 \u4F4E\u4E8E 30% \u53C2\u8003\u7EBF" : "\u4E0D\u4F4E\u4E8E 30% \u53C2\u8003\u7EBF" },
          { label: "\u7ADE\u4E1A\u671F\u9650", value: `${months} \u4E2A\u6708` }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B",
            article: "\u7B2C\u4E8C\u5341\u4E09\u6761",
            text: "\u7528\u4EBA\u5355\u4F4D\u4E0E\u52B3\u52A8\u8005\u53EF\u4EE5\u5728\u52B3\u52A8\u5408\u540C\u4E2D\u7EA6\u5B9A\u4FDD\u5B88\u7528\u4EBA\u5355\u4F4D\u7684\u5546\u4E1A\u79D8\u5BC6\u548C\u4E0E\u77E5\u8BC6\u4EA7\u6743\u76F8\u5173\u7684\u4FDD\u5BC6\u4E8B\u9879\u3002\u5BF9\u8D1F\u6709\u4FDD\u5BC6\u4E49\u52A1\u7684\u52B3\u52A8\u8005\uFF0C\u7528\u4EBA\u5355\u4F4D\u53EF\u4EE5\u5728\u52B3\u52A8\u5408\u540C\u6216\u8005\u4FDD\u5BC6\u534F\u8BAE\u4E2D\u4E0E\u52B3\u52A8\u8005\u7EA6\u5B9A\u7ADE\u4E1A\u9650\u5236\u6761\u6B3E\uFF0C\u5E76\u7EA6\u5B9A\u5728\u89E3\u9664\u6216\u8005\u7EC8\u6B62\u52B3\u52A8\u5408\u540C\u540E\uFF0C\u5728\u7ADE\u4E1A\u9650\u5236\u671F\u9650\u5185\u6309\u6708\u7ED9\u4E88\u52B3\u52A8\u8005\u7ECF\u6D4E\u8865\u507F\u3002"
          },
          {
            law: "\u300A\u52B3\u52A8\u5408\u540C\u6CD5\u300B",
            article: "\u7B2C\u4E8C\u5341\u56DB\u6761",
            text: "\u7ADE\u4E1A\u9650\u5236\u671F\u9650\u4E0D\u5F97\u8D85\u8FC7\u4E8C\u5E74\u3002"
          }
        ],
        tips: [
          "\u7528\u4EBA\u5355\u4F4D\u672A\u6309\u6708\u652F\u4ED8\u8865\u507F\u91D1\u8FBE 3 \u4E2A\u6708\uFF0C\u52B3\u52A8\u8005\u53EF\u8BF7\u6C42\u89E3\u9664\u7ADE\u4E1A\u9650\u5236\u7EA6\u5B9A\uFF0C\u5B9E\u52A1\u4E2D\u6CD5\u9662\u666E\u904D\u652F\u6301\u3002",
          '\u7ADE\u4E1A\u9650\u5236\u8865\u507F\u91D1\u5E94\u5728\u89E3\u9664\u6216\u7EC8\u6B62\u52B3\u52A8\u5408\u540C\u540E"\u6309\u6708"\u652F\u4ED8\uFF0C\u7EA6\u5B9A\u5728\u804C\u671F\u95F4\u5DE5\u8D44\u5DF2\u5305\u542B\u7684\uFF0C\u4E00\u822C\u4E0D\u88AB\u8BA4\u53EF\u3002',
          "\u52B3\u52A8\u8005\u8FDD\u53CD\u7ADE\u4E1A\u9650\u5236\u7EA6\u5B9A\u7684\uFF0C\u5E94\u8FD4\u8FD8\u5DF2\u9886\u53D6\u7684\u8865\u507F\u91D1\u5E76\u6309\u7EA6\u5B9A\u652F\u4ED8\u8FDD\u7EA6\u91D1\uFF0C\u8FDD\u7EA6\u91D1\u8FC7\u9AD8\u53EF\u8BF7\u6C42\u8C03\u51CF\u3002"
        ]
      };
    }
  }
];

// src/core/calculators/limitation.ts
var limitationCalculators = [
  /* ── 诉讼时效 ── */
  {
    id: "limitation-period",
    name: "\u8BC9\u8BBC\u65F6\u6548\u5C4A\u6EE1\u65E5",
    category: "limitation",
    glyph: "\u6548",
    summary: "\u4E09\u5E74\u666E\u901A\u65F6\u6548\u7684\u8D77\u7B97\u3001\u4E2D\u65AD\u3001\u4E2D\u6B62\u4E0E\u4E8C\u5341\u5E74\u6700\u957F\u4FDD\u62A4\u671F",
    keywords: ["\u8BC9\u8BBC\u65F6\u6548", "\u4E09\u5E74", "\u4E8C\u5341\u5E74", "\u4E2D\u65AD", "\u4E2D\u6B62"],
    fields: [
      {
        key: "type",
        label: "\u65F6\u6548\u7C7B\u578B",
        type: "select",
        defaultValue: "general",
        options: [
          { label: "\u666E\u901A\u8BC9\u8BBC\u65F6\u6548\uFF083 \u5E74\uFF09", value: "general" },
          { label: "\u5206\u671F\u5C65\u884C\u503A\u52A1\uFF08\u81EA\u6700\u540E\u4E00\u671F\u5C4A\u6EE1\u8D77\u7B97\uFF09", value: "installment" },
          { label: "\u56FD\u9645\u8D27\u7269\u4E70\u5356 / \u6280\u672F\u8FDB\u51FA\u53E3\u5408\u540C\uFF084 \u5E74\uFF09", value: "intl" },
          { label: "\u6D77\u4E0A\u8D27\u7269\u8FD0\u8F93\u8D54\u507F\uFF081 \u5E74\uFF09", value: "maritime" },
          { label: "\u73AF\u5883\u6C61\u67D3\u635F\u5BB3\u8D54\u507F\uFF083 \u5E74\uFF0C\u53E6\u6709\u7279\u522B\u89C4\u5B9A\uFF09", value: "env" }
        ]
      },
      { key: "startDate", label: "\u77E5\u9053\u6216\u5E94\u5F53\u77E5\u9053\u6743\u5229\u53D7\u635F\u4E4B\u65E5", type: "date", defaultValue: "2023-06-01" },
      {
        key: "damageDate",
        label: "\u6743\u5229\u5B9E\u9645\u53D7\u5230\u635F\u5BB3\u4E4B\u65E5",
        type: "date",
        defaultValue: "2023-01-01",
        hint: "\u7528\u4E8E\u4E8C\u5341\u5E74\u6700\u957F\u4FDD\u62A4\u671F\u7684\u5224\u65AD"
      },
      {
        key: "interrupt",
        label: "\u662F\u5426\u53D1\u751F\u65F6\u6548\u4E2D\u65AD",
        type: "switch",
        defaultValue: false,
        hint: "\u8D77\u8BC9\u3001\u63D0\u51FA\u5C65\u884C\u8BF7\u6C42\u3001\u4E49\u52A1\u4EBA\u540C\u610F\u5C65\u884C\u7B49"
      },
      {
        key: "interruptDate",
        label: "\u6700\u8FD1\u4E00\u6B21\u4E2D\u65AD\u4E8B\u7531\u53D1\u751F\u65E5",
        type: "date",
        defaultValue: "2025-01-01",
        visibleWhen: (v) => v.interrupt === true || v.interrupt === "true"
      }
    ],
    calc(values) {
      const type = toStr(values.type, "general");
      const start = parseDate(values.startDate) ?? /* @__PURE__ */ new Date();
      const damage = parseDate(values.damageDate) ?? start;
      const interrupted = values.interrupt === true || values.interrupt === "true";
      const iDate = parseDate(values.interruptDate);
      const years = type === "intl" ? 4 : type === "maritime" ? 1 : 3;
      const typeLabel = type === "general" ? "\u666E\u901A\u8BC9\u8BBC\u65F6\u6548 3 \u5E74" : type === "installment" ? "\u5206\u671F\u5C65\u884C\u503A\u52A1 3 \u5E74" : type === "intl" ? "\u6D89\u5916\u5408\u540C 4 \u5E74" : type === "maritime" ? "\u6D77\u4E0A\u8D27\u7269\u8FD0\u8F93 1 \u5E74" : "\u73AF\u5883\u635F\u5BB3\u8D54\u507F 3 \u5E74";
      const steps = [{ label: "\u9002\u7528\u65F6\u6548", value: typeLabel }];
      let base = start;
      steps.push({ label: "\u8D77\u7B97\u65E5", value: `${ymd(start)}\uFF08${weekdayCn(start)}\uFF09`, note: "\u300A\u6C11\u6CD5\u5178\u300B\u7B2C188\u6761\uFF1A\u81EA\u6743\u5229\u4EBA\u77E5\u9053\u6216\u5E94\u5F53\u77E5\u9053\u6743\u5229\u53D7\u5230\u635F\u5BB3\u53CA\u4E49\u52A1\u4EBA\u4E4B\u65E5\u8D77\u7B97" });
      if (interrupted && iDate) {
        base = iDate;
        steps.push({
          label: "\u65F6\u6548\u4E2D\u65AD",
          value: `${ymd(iDate)} \u53D1\u751F\u4E2D\u65AD\u4E8B\u7531\uFF0C\u65F6\u6548\u91CD\u65B0\u8BA1\u7B97`,
          note: "\u300A\u6C11\u6CD5\u5178\u300B\u7B2C195\u6761\uFF1A\u4ECE\u4E2D\u65AD\u3001\u6709\u5173\u7A0B\u5E8F\u7EC8\u7ED3\u65F6\u8D77\uFF0C\u8BC9\u8BBC\u65F6\u6548\u671F\u95F4\u91CD\u65B0\u8BA1\u7B97",
          emphasis: true
        });
      }
      const p = calcPeriod(base, years, "year");
      steps.push({ label: `\u52A0\u4E0A ${years} \u5E74`, value: `${ymd(p.rawEnd)}\uFF08${weekdayCn(p.rawEnd)}\uFF09` });
      if (p.postponed) {
        steps.push({
          label: "\u6CD5\u5B9A\u4F11\u5047\u65E5\u987A\u5EF6",
          value: `${p.postponedDays.join("\u3001")} \u4E3A\u4F11\u5047\u65E5\uFF0C\u987A\u5EF6\u81F3 ${ymd(p.finalEnd)}`,
          note: "\u300A\u6C11\u6CD5\u5178\u300B\u7B2C203\u6761\uFF1A\u671F\u95F4\u7684\u6700\u540E\u4E00\u65E5\u662F\u6CD5\u5B9A\u4F11\u5047\u65E5\u7684\uFF0C\u4EE5\u6CD5\u5B9A\u4F11\u5047\u65E5\u7ED3\u675F\u7684\u6B21\u65E5\u4E3A\u671F\u95F4\u5C4A\u6EE1\u65E5",
          emphasis: true
        });
      }
      steps.push({ label: "\u65F6\u6548\u5C4A\u6EE1\u65E5", value: `${ymd(p.finalEnd)}\uFF08${weekdayCn(p.finalEnd)}\uFF09`, emphasis: true });
      const maxP = calcPeriod(damage, 20, "year");
      const maxLabel = `${ymd(maxP.finalEnd)}\uFF08${weekdayCn(maxP.finalEnd)}\uFF09`;
      steps.push({
        label: "\u4E8C\u5341\u5E74\u6700\u957F\u4FDD\u62A4\u671F\u5C4A\u6EE1",
        value: maxLabel,
        note: "\u300A\u6C11\u6CD5\u5178\u300B\u7B2C188\u6761\u7B2C2\u6B3E\uFF1A\u81EA\u6743\u5229\u53D7\u5230\u635F\u5BB3\u4E4B\u65E5\u8D77\u8D85\u8FC7\u4E8C\u5341\u5E74\u7684\uFF0C\u4EBA\u6C11\u6CD5\u9662\u4E0D\u4E88\u4FDD\u62A4\uFF1B\u4E0D\u9002\u7528\u4E2D\u6B62\u3001\u4E2D\u65AD"
      });
      const now = /* @__PURE__ */ new Date();
      const remainDays = Math.round((p.finalEnd.getTime() - now.getTime()) / 864e5);
      const expired = remainDays <= 0;
      return {
        main: {
          label: "\u8BC9\u8BBC\u65F6\u6548\u5C4A\u6EE1\u65E5",
          value: ymd(p.finalEnd),
          sub: expired ? `\u26A0 \u8DDD\u4ECA\u65E5\u5DF2\u8FC7 ${Math.abs(remainDays)} \u5929\uFF0C\u65F6\u6548\u53EF\u80FD\u5DF2\u5C4A\u6EE1` : `\u8DDD\u4ECA\u65E5\u5C1A\u6709 ${remainDays} \u5929`
        },
        blocks: [
          { label: "\u661F\u671F", value: weekdayCn(p.finalEnd) },
          { label: "\u4E8C\u5341\u5E74\u6700\u957F\u4FDD\u62A4\u671F", value: ymd(maxP.finalEnd) },
          { label: "\u5269\u4F59\u5929\u6570", value: expired ? "\u5DF2\u5C4A\u6EE1" : `${remainDays} \u5929` }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u6C11\u6CD5\u5178\u300B",
            article: "\u7B2C\u4E00\u767E\u516B\u5341\u516B\u6761",
            text: "\u5411\u4EBA\u6C11\u6CD5\u9662\u8BF7\u6C42\u4FDD\u62A4\u6C11\u4E8B\u6743\u5229\u7684\u8BC9\u8BBC\u65F6\u6548\u671F\u95F4\u4E3A\u4E09\u5E74\u3002\u6CD5\u5F8B\u53E6\u6709\u89C4\u5B9A\u7684\uFF0C\u4F9D\u7167\u5176\u89C4\u5B9A\u3002\u8BC9\u8BBC\u65F6\u6548\u671F\u95F4\u81EA\u6743\u5229\u4EBA\u77E5\u9053\u6216\u8005\u5E94\u5F53\u77E5\u9053\u6743\u5229\u53D7\u5230\u635F\u5BB3\u4EE5\u53CA\u4E49\u52A1\u4EBA\u4E4B\u65E5\u8D77\u8BA1\u7B97\u3002\u6CD5\u5F8B\u53E6\u6709\u89C4\u5B9A\u7684\uFF0C\u4F9D\u7167\u5176\u89C4\u5B9A\u3002\u4F46\u662F\uFF0C\u81EA\u6743\u5229\u53D7\u5230\u635F\u5BB3\u4E4B\u65E5\u8D77\u8D85\u8FC7\u4E8C\u5341\u5E74\u7684\uFF0C\u4EBA\u6C11\u6CD5\u9662\u4E0D\u4E88\u4FDD\u62A4\uFF0C\u6709\u7279\u6B8A\u60C5\u51B5\u7684\uFF0C\u4EBA\u6C11\u6CD5\u9662\u53EF\u4EE5\u6839\u636E\u6743\u5229\u4EBA\u7684\u7533\u8BF7\u51B3\u5B9A\u5EF6\u957F\u3002"
          },
          {
            law: "\u300A\u6C11\u6CD5\u5178\u300B",
            article: "\u7B2C\u4E00\u767E\u4E5D\u5341\u4E94\u6761",
            text: "\u6709\u4E0B\u5217\u60C5\u5F62\u4E4B\u4E00\u7684\uFF0C\u8BC9\u8BBC\u65F6\u6548\u4E2D\u65AD\uFF0C\u4ECE\u4E2D\u65AD\u3001\u6709\u5173\u7A0B\u5E8F\u7EC8\u7ED3\u65F6\u8D77\uFF0C\u8BC9\u8BBC\u65F6\u6548\u671F\u95F4\u91CD\u65B0\u8BA1\u7B97\uFF1A\uFF08\u4E00\uFF09\u6743\u5229\u4EBA\u5411\u4E49\u52A1\u4EBA\u63D0\u51FA\u5C65\u884C\u8BF7\u6C42\uFF1B\uFF08\u4E8C\uFF09\u4E49\u52A1\u4EBA\u540C\u610F\u5C65\u884C\u4E49\u52A1\uFF1B\uFF08\u4E09\uFF09\u6743\u5229\u4EBA\u63D0\u8D77\u8BC9\u8BBC\u6216\u8005\u7533\u8BF7\u4EF2\u88C1\uFF1B\uFF08\u56DB\uFF09\u4E0E\u63D0\u8D77\u8BC9\u8BBC\u6216\u8005\u7533\u8BF7\u4EF2\u88C1\u5177\u6709\u540C\u7B49\u6548\u529B\u7684\u5176\u4ED6\u60C5\u5F62\u3002"
          },
          {
            law: "\u300A\u6C11\u6CD5\u5178\u300B",
            article: "\u7B2C\u4E00\u767E\u4E5D\u5341\u56DB\u6761",
            text: "\u5728\u8BC9\u8BBC\u65F6\u6548\u671F\u95F4\u7684\u6700\u540E\u516D\u4E2A\u6708\u5185\uFF0C\u56E0\u4E0D\u53EF\u6297\u529B\u7B49\u969C\u788D\uFF0C\u4E0D\u80FD\u884C\u4F7F\u8BF7\u6C42\u6743\u7684\uFF0C\u8BC9\u8BBC\u65F6\u6548\u4E2D\u6B62\u3002\u81EA\u4E2D\u6B62\u65F6\u6548\u7684\u539F\u56E0\u6D88\u9664\u4E4B\u65E5\u8D77\u6EE1\u516D\u4E2A\u6708\uFF0C\u8BC9\u8BBC\u65F6\u6548\u671F\u95F4\u5C4A\u6EE1\u3002"
          }
        ],
        tips: [
          "\u8BC9\u8BBC\u65F6\u6548\u5C4A\u6EE1\u4EC5\u4E27\u5931\u80DC\u8BC9\u6743\uFF08\u4EA7\u751F\u6297\u8FA9\u6743\uFF09\uFF0C\u5B9E\u4F53\u6743\u5229\u5E76\u4E0D\u6D88\u706D\uFF0C\u4E49\u52A1\u4EBA\u81EA\u613F\u5C65\u884C\u7684\u4E0D\u5F97\u8BF7\u6C42\u8FD4\u8FD8\u3002",
          "\u65F6\u6548\u6297\u8FA9\u5FC5\u987B\u7531\u5F53\u4E8B\u4EBA\u5728\u8BC9\u8BBC\u4E2D\u4E3B\u52A8\u63D0\u51FA\uFF0C\u6CD5\u9662\u4E0D\u5F97\u4E3B\u52A8\u9002\u7528\uFF0C\u4E5F\u4E0D\u5F97\u91CA\u660E\u3002",
          "\u4E2D\u6B62\u53EA\u53D1\u751F\u5728\u6700\u540E\u516D\u4E2A\u6708\u5185\uFF0C\u4E14\u4E2D\u6B62\u539F\u56E0\u6D88\u9664\u540E\u4E00\u5F8B\u8865\u8DB3\u516D\u4E2A\u6708\uFF0C\u800C\u975E\u7EE7\u7EED\u8BA1\u7B97\u5269\u4F59\u671F\u95F4\u3002",
          '\u4E8C\u5341\u5E74\u6700\u957F\u4FDD\u62A4\u671F\u4E0D\u9002\u7528\u4E2D\u6B62\u3001\u4E2D\u65AD\uFF0C\u4EC5\u5728"\u7279\u6B8A\u60C5\u51B5"\u4E0B\u53EF\u7531\u6CD5\u9662\u51B3\u5B9A\u5EF6\u957F\u3002'
        ]
      };
    }
  },
  /* ── 法定期间推算 ── */
  {
    id: "period-calc",
    name: "\u6CD5\u5B9A\u671F\u95F4\u63A8\u7B97",
    category: "limitation",
    glyph: "\u671F",
    summary: "\u901A\u7528\u671F\u95F4\u8BA1\u7B97\u5DE5\u5177\uFF0C\u81EA\u52A8\u5904\u7406\u8282\u5047\u65E5\u987A\u5EF6\u4E0E\u6708\u672B\u5BF9\u5E94\u65E5",
    keywords: ["\u671F\u95F4", "\u987A\u5EF6", "\u5C4A\u6EE1\u65E5", "\u671F\u9650\u8BA1\u7B97"],
    fields: [
      { key: "baseDate", label: "\u8D77\u7B97\u57FA\u51C6\u65E5", type: "date", defaultValue: "2026-01-20", hint: "\u5982\u9001\u8FBE\u65E5\u3001\u7B7E\u6536\u65E5\u3001\u4E8B\u6545\u53D1\u751F\u65E5" },
      { key: "value", label: "\u671F\u95F4\u957F\u5EA6", type: "number", defaultValue: 15 },
      {
        key: "unit",
        label: "\u5355\u4F4D",
        type: "select",
        defaultValue: "day",
        options: [
          { label: "\u65E5", value: "day" },
          { label: "\u6708", value: "month" },
          { label: "\u5E74", value: "year" }
        ]
      },
      {
        key: "countRule",
        label: "\u8D77\u7B97\u89C4\u5219",
        type: "select",
        defaultValue: "next",
        options: [
          { label: "\u5F00\u59CB\u7684\u5F53\u65E5\u4E0D\u8BA1\u5165\uFF0C\u81EA\u6B21\u65E5\u8D77\u7B97\uFF08\u6C11\u4E8B\u901A\u7528\uFF09", value: "next" },
          { label: "\u81EA\u5F53\u65E5\u8D77\u7B97\uFF08\u5982\u90E8\u5206\u884C\u653F\u3001\u5408\u540C\u7EA6\u5B9A\u671F\u9650\uFF09", value: "same" }
        ]
      }
    ],
    calc(values) {
      const base = parseDate(values.baseDate) ?? /* @__PURE__ */ new Date();
      const value = Math.max(0, Math.round(toNum(values.value, 15)));
      const unit = toStr(values.unit, "day");
      const rule = toStr(values.countRule, "next");
      const p = calcPeriod(base, value, unit);
      const steps = [];
      steps.push({ label: "\u8D77\u7B97\u57FA\u51C6\u65E5", value: `${ymd(base)}\uFF08${weekdayCn(base)}\uFF09` });
      if (rule === "next") {
        steps.push({
          label: "\u8D77\u7B97\u89C4\u5219",
          value: `\u5F00\u59CB\u5F53\u65E5\u4E0D\u8BA1\u5165\uFF0C\u81EA\u6B21\u65E5 ${ymd(p.startFrom)}\uFF08${weekdayCn(p.startFrom)}\uFF09\u8D77\u7B97`,
          note: "\u300A\u6C11\u6CD5\u5178\u300B\u7B2C201\u6761"
        });
      } else {
        steps.push({ label: "\u8D77\u7B97\u89C4\u5219", value: `\u81EA\u5F53\u65E5 ${ymd(base)} \u8D77\u7B97\uFF08\u5408\u540C\u7EA6\u5B9A\u6216\u7279\u522B\u89C4\u5B9A\uFF09` });
      }
      steps.push({
        label: `\u671F\u95F4\u957F\u5EA6`,
        value: `${value} ${unit === "day" ? "\u65E5" : unit === "month" ? "\u6708" : "\u5E74"}`
      });
      steps.push({
        label: "\u540D\u4E49\u5C4A\u6EE1\u65E5",
        value: `${ymd(p.rawEnd)}\uFF08${weekdayCn(p.rawEnd)}\uFF09`,
        note: unit === "month" || unit === "year" ? "\u300A\u6C11\u6CD5\u5178\u300B\u7B2C202\u6761\uFF1A\u5230\u671F\u6708\u7684\u5BF9\u5E94\u65E5\u4E3A\u6700\u540E\u4E00\u65E5\uFF1B\u6CA1\u6709\u5BF9\u5E94\u65E5\u7684\uFF0C\u6708\u672B\u65E5\u4E3A\u6700\u540E\u4E00\u65E5" : ""
      });
      if (isHoliday(p.rawEnd)) {
        steps.push({
          label: "\u26A0 \u540D\u4E49\u5C4A\u6EE1\u65E5\u4E3A\u6CD5\u5B9A\u4F11\u5047\u65E5",
          value: p.postponedDays.join("\u3001"),
          emphasis: true
        });
        steps.push({
          label: "\u987A\u5EF6\u540E\u5C4A\u6EE1\u65E5",
          value: `${ymd(p.finalEnd)}\uFF08${weekdayCn(p.finalEnd)}\uFF09`,
          note: "\u300A\u6C11\u6CD5\u5178\u300B\u7B2C203\u6761\u7B2C1\u6B3E",
          emphasis: true
        });
      } else {
        steps.push({ label: "\u5C4A\u6EE1\u65E5", value: `${ymd(p.finalEnd)}\uFF08${weekdayCn(p.finalEnd)}\uFF09`, emphasis: true });
      }
      steps.push({ label: "\u671F\u95F4\u81EA\u7136\u65E5\u603B\u6570", value: `${p.totalDays} \u5929` });
      return {
        main: {
          label: "\u671F\u95F4\u5C4A\u6EE1\u65E5",
          value: ymd(p.finalEnd),
          sub: `${weekdayCn(p.finalEnd)}${p.postponed ? "\uFF08\u5DF2\u987A\u5EF6\uFF09" : ""}`
        },
        blocks: [
          { label: "\u8D77\u7B97\u65E5", value: ymd(p.startFrom) },
          { label: "\u662F\u5426\u987A\u5EF6", value: p.postponed ? `\u662F\uFF08\u987A\u5EF6 ${p.postponedDays.length} \u5929\uFF09` : "\u5426" },
          { label: "\u81EA\u7136\u65E5\u6570", value: `${p.totalDays} \u5929` }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u6C11\u6CD5\u5178\u300B",
            article: "\u7B2C\u4E8C\u767E\u96F6\u4E00\u6761",
            text: "\u6309\u7167\u5E74\u3001\u6708\u3001\u65E5\u8BA1\u7B97\u671F\u95F4\u7684\uFF0C\u5F00\u59CB\u7684\u5F53\u65E5\u4E0D\u7B97\u5165\uFF0C\u4ECE\u4E0B\u4E00\u65E5\u5F00\u59CB\u8BA1\u7B97\u3002\u6309\u7167\u5C0F\u65F6\u8BA1\u7B97\u671F\u95F4\u7684\uFF0C\u81EA\u6CD5\u5F8B\u89C4\u5B9A\u6216\u8005\u5F53\u4E8B\u4EBA\u7EA6\u5B9A\u7684\u65F6\u95F4\u5F00\u59CB\u8BA1\u7B97\u3002"
          },
          {
            law: "\u300A\u6C11\u6CD5\u5178\u300B",
            article: "\u7B2C\u4E8C\u767E\u96F6\u4E8C\u6761",
            text: "\u6309\u7167\u5E74\u3001\u6708\u8BA1\u7B97\u671F\u95F4\u7684\uFF0C\u5230\u671F\u6708\u7684\u5BF9\u5E94\u65E5\u4E3A\u671F\u95F4\u7684\u6700\u540E\u4E00\u65E5\uFF1B\u6CA1\u6709\u5BF9\u5E94\u65E5\u7684\uFF0C\u6708\u672B\u65E5\u4E3A\u671F\u95F4\u7684\u6700\u540E\u4E00\u65E5\u3002"
          },
          {
            law: "\u300A\u6C11\u6CD5\u5178\u300B",
            article: "\u7B2C\u4E8C\u767E\u96F6\u4E09\u6761",
            text: "\u671F\u95F4\u7684\u6700\u540E\u4E00\u65E5\u662F\u6CD5\u5B9A\u4F11\u5047\u65E5\u7684\uFF0C\u4EE5\u6CD5\u5B9A\u4F11\u5047\u65E5\u7ED3\u675F\u7684\u6B21\u65E5\u4E3A\u671F\u95F4\u5C4A\u6EE1\u65E5\u3002\u671F\u95F4\u7684\u6700\u540E\u4E00\u65E5\u622A\u6B62\u65F6\u95F4\u4E3A\u4E8C\u5341\u56DB\u65F6\uFF1B\u6709\u4E1A\u52A1\u65F6\u95F4\u7684\uFF0C\u505C\u6B62\u4E1A\u52A1\u6D3B\u52A8\u7684\u65F6\u95F4\u4E3A\u622A\u6B62\u65F6\u95F4\u3002"
          }
        ],
        tips: [
          "\u671F\u95F4\u4E0D\u5305\u62EC\u5728\u9014\u65F6\u95F4\uFF1A\u8BC9\u8BBC\u6587\u4E66\u5728\u671F\u6EE1\u524D\u4EA4\u90AE\u7684\uFF0C\u4E0D\u7B97\u8FC7\u671F\uFF08\u300A\u6C11\u6CD5\u5178\u300B\u7B2C204\u6761\u7CBE\u795E\uFF0C\u300A\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u300B\u4EA6\u6709\u89C4\u5B9A\uFF09\u3002",
          "\u672C\u5DE5\u5177\u5185\u7F6E 2024\u20142027 \u5E74\u8282\u5047\u65E5\u8868\uFF0C\u5176\u4E2D 2026 \u5E74\u4E3A\u6309\u5E38\u89C4\u89C4\u5219\u63A8\u5B9A\uFF0C\u56FD\u52A1\u9662\u529E\u516C\u5385\u6B63\u5F0F\u901A\u77E5\u53D1\u5E03\u540E\u8BF7\u4EE5\u5B98\u65B9\u4E3A\u51C6\u3002",
          '"\u6CD5\u5B9A\u4F11\u5047\u65E5"\u6307\u56FD\u5BB6\u7EDF\u4E00\u653E\u5047\u7684\u8282\u65E5\u548C\u4F11\u606F\u65E5\uFF0C\u5404\u5730\u81EA\u884C\u5B89\u6392\u7684\u5730\u65B9\u6027\u5047\u671F\u901A\u5E38\u4E0D\u5C5E\u4E8E\u6B64\u5217\u3002'
        ]
      };
    }
  },
  /* ── 上诉期与答辩期 ── */
  {
    id: "appeal-deadline",
    name: "\u4E0A\u8BC9\u671F / \u7B54\u8FA9\u671F",
    category: "limitation",
    glyph: "\u4E0A",
    summary: "\u5224\u51B3 15 \u65E5\u3001\u88C1\u5B9A 10 \u65E5\u7684\u4E0A\u8BC9\u671F\u4E0E\u7B54\u8FA9\u671F\u5C4A\u6EE1\u65E5\u63A8\u7B97",
    keywords: ["\u4E0A\u8BC9\u671F", "\u7B54\u8FA9\u671F", "\u5341\u4E94\u65E5", "\u5341\u65E5", "\u9001\u8FBE"],
    fields: [
      {
        key: "docType",
        label: "\u6587\u4E66\u7C7B\u578B",
        type: "select",
        defaultValue: "judgment",
        options: [
          { label: "\u5224\u51B3\u4E66\uFF08\u4E0A\u8BC9\u671F 15 \u65E5\uFF09", value: "judgment" },
          { label: "\u88C1\u5B9A\u4E66\uFF08\u4E0A\u8BC9\u671F 10 \u65E5\uFF09", value: "ruling" },
          { label: "\u8D77\u8BC9\u72B6\u526F\u672C\uFF08\u7B54\u8FA9\u671F 15 \u65E5\uFF09", value: "complaint" },
          { label: "\u652F\u4ED8\u4EE4\uFF08\u5F02\u8BAE\u671F 15 \u65E5\uFF09", value: "payment" }
        ]
      },
      { key: "serveDate", label: "\u9001\u8FBE / \u6536\u5230\u4E4B\u65E5", type: "date", defaultValue: "2026-01-20" },
      {
        key: "serveWay",
        label: "\u9001\u8FBE\u65B9\u5F0F",
        type: "select",
        defaultValue: "direct",
        options: [
          { label: "\u76F4\u63A5\u9001\u8FBE / \u7559\u7F6E\u9001\u8FBE", value: "direct" },
          { label: "\u90AE\u5BC4\u9001\u8FBE\uFF08\u4EE5\u7B7E\u6536\u65E5\u4E3A\u51C6\uFF09", value: "mail" },
          { label: "\u516C\u544A\u9001\u8FBE\uFF08\u53E6\u8BA1 30 \u65E5\uFF09", value: "public" },
          { label: "\u7535\u5B50\u9001\u8FBE\uFF08\u4EE5\u5230\u8FBE\u7CFB\u7EDF\u65E5\u4E3A\u51C6\uFF09", value: "electronic" }
        ]
      },
      {
        key: "parties",
        label: "\u5F53\u4E8B\u4EBA\u662F\u5426\u5404\u81EA\u5206\u522B\u9001\u8FBE",
        type: "switch",
        defaultValue: false,
        hint: "\u5404\u65B9\u4E0A\u8BC9\u671F\u5206\u522B\u8BA1\u7B97\uFF0C\u4EE5\u5404\u81EA\u9001\u8FBE\u65E5\u4E3A\u51C6"
      }
    ],
    calc(values) {
      const docType = toStr(values.docType, "judgment");
      const serve = parseDate(values.serveDate) ?? /* @__PURE__ */ new Date();
      const way = toStr(values.serveWay, "direct");
      const config = {
        judgment: { days: 15, label: "\u5224\u51B3\u4E66\u4E0A\u8BC9\u671F", note: "\u4E0D\u670D\u4E00\u5BA1\u5224\u51B3\u7684\u4E0A\u8BC9\u671F\u4E3A 15 \u65E5" },
        ruling: { days: 10, label: "\u88C1\u5B9A\u4E66\u4E0A\u8BC9\u671F", note: "\u4E0D\u670D\u4E00\u5BA1\u88C1\u5B9A\u7684\u4E0A\u8BC9\u671F\u4E3A 10 \u65E5" },
        complaint: { days: 15, label: "\u7B54\u8FA9\u671F", note: "\u88AB\u544A\u5E94\u5728\u6536\u5230\u8D77\u8BC9\u72B6\u526F\u672C\u4E4B\u65E5\u8D77 15 \u65E5\u5185\u63D0\u51FA\u7B54\u8FA9\u72B6" },
        payment: { days: 15, label: "\u652F\u4ED8\u4EE4\u5F02\u8BAE\u671F", note: "\u503A\u52A1\u4EBA\u5E94\u5728\u6536\u5230\u652F\u4ED8\u4EE4\u4E4B\u65E5\u8D77 15 \u65E5\u5185\u6E05\u507F\u6216\u63D0\u51FA\u4E66\u9762\u5F02\u8BAE" }
      };
      const cfg = config[docType] ?? config.judgment;
      const steps = [
        { label: "\u6587\u4E66\u7C7B\u578B", value: cfg.label },
        { label: "\u9001\u8FBE / \u6536\u5230\u65E5", value: `${ymd(serve)}\uFF08${weekdayCn(serve)}\uFF09` }
      ];
      let base = serve;
      if (way === "public") {
        base = addDays(serve, 30);
        steps.push({
          label: "\u516C\u544A\u9001\u8FBE",
          value: `\u516C\u544A\u53D1\u51FA\u4E4B\u65E5\u8D77\u7ECF\u8FC7 30 \u65E5\u89C6\u4E3A\u9001\u8FBE \u2192 ${ymd(base)}`,
          note: "\u300A\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u300B\u5173\u4E8E\u516C\u544A\u9001\u8FBE\u7684\u89C4\u5B9A",
          emphasis: true
        });
      } else if (way === "electronic") {
        steps.push({ label: "\u7535\u5B50\u9001\u8FBE", value: "\u4EE5\u9001\u8FBE\u4FE1\u606F\u5230\u8FBE\u53D7\u9001\u8FBE\u4EBA\u7279\u5B9A\u7CFB\u7EDF\u7684\u65E5\u671F\u4E3A\u9001\u8FBE\u65E5" });
      } else if (way === "mail") {
        steps.push({ label: "\u90AE\u5BC4\u9001\u8FBE", value: "\u4EE5\u7B7E\u6536\u65E5\u4E3A\u9001\u8FBE\u65E5\uFF0C\u8BF7\u4EE5\u5B9E\u9645\u7B7E\u6536\u65E5\u671F\u586B\u5199" });
      }
      const p = calcPeriod(base, cfg.days, "day");
      steps.push({ label: "\u5F00\u59CB\u5F53\u65E5\u4E0D\u8BA1\u5165", value: `\u81EA ${ymd(p.startFrom)}\uFF08${weekdayCn(p.startFrom)}\uFF09\u8D77\u7B97`, note: "\u300A\u6C11\u6CD5\u5178\u300B\u7B2C201\u6761" });
      steps.push({ label: `\u7B2C ${cfg.days} \u65E5`, value: `${ymd(p.rawEnd)}\uFF08${weekdayCn(p.rawEnd)}\uFF09` });
      if (p.postponed) {
        steps.push({
          label: "\u4F11\u5047\u65E5\u987A\u5EF6",
          value: `${p.postponedDays.join("\u3001")} \u2192 \u987A\u5EF6\u81F3 ${ymd(p.finalEnd)}\uFF08${weekdayCn(p.finalEnd)}\uFF09`,
          emphasis: true
        });
      }
      steps.push({ label: `${cfg.label}\u5C4A\u6EE1\u65E5`, value: `${ymd(p.finalEnd)}\uFF08${weekdayCn(p.finalEnd)}\uFF09`, emphasis: true });
      const now = /* @__PURE__ */ new Date();
      const remain = Math.round((p.finalEnd.getTime() - now.getTime()) / 864e5);
      return {
        main: {
          label: `${cfg.label}\u5C4A\u6EE1\u65E5`,
          value: ymd(p.finalEnd),
          sub: remain <= 0 ? `\u26A0 \u5DF2\u8FC7 ${Math.abs(remain)} \u5929` : `\u8DDD\u4ECA\u65E5 ${remain} \u5929`
        },
        blocks: [
          { label: "\u6CD5\u5B9A\u671F\u95F4", value: `${cfg.days} \u65E5` },
          { label: "\u8D77\u7B97\u65E5", value: ymd(p.startFrom) },
          { label: "\u662F\u5426\u987A\u5EF6", value: p.postponed ? "\u662F" : "\u5426" },
          { label: "\u5269\u4F59\u5929\u6570", value: remain <= 0 ? "\u5DF2\u5C4A\u6EE1" : `${remain} \u5929` }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u300B",
            article: "\u7B2C\u4E00\u767E\u4E03\u5341\u4E00\u6761\uFF082021\u5E74\u4FEE\u6B63\u6761\u6587\u53F7\uFF09",
            text: "\u5F53\u4E8B\u4EBA\u4E0D\u670D\u5730\u65B9\u4EBA\u6C11\u6CD5\u9662\u7B2C\u4E00\u5BA1\u5224\u51B3\u7684\uFF0C\u6709\u6743\u5728\u5224\u51B3\u4E66\u9001\u8FBE\u4E4B\u65E5\u8D77\u5341\u4E94\u65E5\u5185\u5411\u4E0A\u4E00\u7EA7\u4EBA\u6C11\u6CD5\u9662\u63D0\u8D77\u4E0A\u8BC9\u3002\u5F53\u4E8B\u4EBA\u4E0D\u670D\u5730\u65B9\u4EBA\u6C11\u6CD5\u9662\u7B2C\u4E00\u5BA1\u88C1\u5B9A\u7684\uFF0C\u6709\u6743\u5728\u88C1\u5B9A\u4E66\u9001\u8FBE\u4E4B\u65E5\u8D77\u5341\u65E5\u5185\u5411\u4E0A\u4E00\u7EA7\u4EBA\u6C11\u6CD5\u9662\u63D0\u8D77\u4E0A\u8BC9\u3002"
          },
          {
            law: "\u300A\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u300B",
            article: "\u7B2C\u4E00\u767E\u4E8C\u5341\u516B\u6761\uFF082021\u5E74\u4FEE\u6B63\u6761\u6587\u53F7\uFF09",
            text: "\u4EBA\u6C11\u6CD5\u9662\u5E94\u5F53\u5728\u7ACB\u6848\u4E4B\u65E5\u8D77\u4E94\u65E5\u5185\u5C06\u8D77\u8BC9\u72B6\u526F\u672C\u53D1\u9001\u88AB\u544A\uFF0C\u88AB\u544A\u5E94\u5F53\u5728\u6536\u5230\u4E4B\u65E5\u8D77\u5341\u4E94\u65E5\u5185\u63D0\u51FA\u7B54\u8FA9\u72B6\u3002"
          }
        ],
        tips: [
          '\u4E0A\u8BC9\u671F\u81EA"\u9001\u8FBE\u4E4B\u6B21\u65E5"\u8D77\u7B97\uFF0C\u8282\u5047\u65E5\u987A\u5EF6\uFF1B\u4E0A\u8BC9\u72B6\u5728\u671F\u6EE1\u524D\u4EA4\u90AE\u7684\uFF0C\u4E0D\u7B97\u8FC7\u671F\u3002',
          "\u5404\u65B9\u5F53\u4E8B\u4EBA\u7684\u4E0A\u8BC9\u671F\u5206\u522B\u8BA1\u7B97\uFF0C\u4EE5\u5404\u81EA\u6536\u5230\u88C1\u5224\u6587\u4E66\u7684\u65E5\u671F\u4E3A\u51C6\uFF0C\u4E0D\u56E0\u4ED6\u4EBA\u5DF2\u4E0A\u8BC9\u800C\u7EDF\u4E00\u3002",
          "\u652F\u4ED8\u4EE4\u5F02\u8BAE\u53EA\u9700\u5728 15 \u65E5\u5185\u63D0\u51FA\u4E66\u9762\u5F02\u8BAE\u5373\u53EF\u4F7F\u5176\u5931\u6548\uFF0C\u6CD5\u9662\u4E0D\u5BA1\u67E5\u5F02\u8BAE\u662F\u5426\u6210\u7ACB\uFF0C\u662F\u503A\u52A1\u4EBA\u4F4E\u6210\u672C\u963B\u65AD\u7A0B\u5E8F\u7684\u5173\u952E\u8282\u70B9\u3002",
          "\u6C11\u4E8B\u4E0A\u8BC9\u671F\u4E0D\u53EF\u5EF6\u957F\u4E5F\u4E0D\u53EF\u7533\u8BF7\u6062\u590D\uFF0C\u9519\u8FC7\u5373\u4E27\u5931\u4E0A\u8BC9\u6743\uFF0C\u53EA\u80FD\u7533\u8BF7\u518D\u5BA1\u3002"
        ]
      };
    }
  },
  /* ── 申请执行期 ── */
  {
    id: "execution-apply",
    name: "\u7533\u8BF7\u6267\u884C\u671F\u95F4",
    category: "limitation",
    glyph: "\u884C",
    summary: "\u4E8C\u5E74\u7533\u8BF7\u6267\u884C\u671F\u95F4\u7684\u8D77\u7B97\u3001\u4E2D\u6B62\u4E0E\u4E2D\u65AD",
    keywords: ["\u7533\u8BF7\u6267\u884C", "\u4E8C\u5E74", "\u6267\u884C\u65F6\u6548", "\u5C65\u884C\u671F\u5C4A\u6EE1"],
    fields: [
      { key: "dueDate", label: "\u6CD5\u5F8B\u6587\u4E66\u786E\u5B9A\u7684\u5C65\u884C\u671F\u95F4\u6700\u540E\u4E00\u65E5", type: "date", defaultValue: "2024-06-01" },
      {
        key: "staged",
        label: "\u662F\u5426\u5206\u671F\u5C65\u884C",
        type: "switch",
        defaultValue: false,
        hint: "\u5206\u671F\u5C65\u884C\u7684\uFF0C\u4ECE\u6700\u540E\u4E00\u671F\u5C65\u884C\u671F\u9650\u5C4A\u6EE1\u4E4B\u65E5\u8D77\u8BA1\u7B97"
      },
      {
        key: "lastDue",
        label: "\u6700\u540E\u4E00\u671F\u5C65\u884C\u671F\u9650\u5C4A\u6EE1\u65E5",
        type: "date",
        defaultValue: "2025-06-01",
        visibleWhen: (v) => v.staged === true || v.staged === "true"
      },
      {
        key: "interrupt",
        label: "\u662F\u5426\u53D1\u751F\u65F6\u6548\u4E2D\u65AD",
        type: "switch",
        defaultValue: false,
        hint: "\u5982\u503A\u6743\u4EBA\u4E3B\u5F20\u6743\u5229\u3001\u503A\u52A1\u4EBA\u540C\u610F\u5C65\u884C\u3001\u7533\u8BF7\u6267\u884C\u7B49"
      },
      {
        key: "interruptDate",
        label: "\u6700\u8FD1\u4E00\u6B21\u4E2D\u65AD\u4E8B\u7531\u53D1\u751F\u65E5",
        type: "date",
        defaultValue: "2025-01-01",
        visibleWhen: (v) => v.interrupt === true || v.interrupt === "true"
      }
    ],
    calc(values) {
      const due = parseDate(values.dueDate) ?? /* @__PURE__ */ new Date();
      const staged = values.staged === true || values.staged === "true";
      const lastDue = parseDate(values.lastDue);
      const interrupted = values.interrupt === true || values.interrupt === "true";
      const iDate = parseDate(values.interruptDate);
      const steps = [];
      let base = due;
      steps.push({ label: "\u5C65\u884C\u671F\u95F4\u6700\u540E\u4E00\u65E5", value: `${ymd(due)}\uFF08${weekdayCn(due)}\uFF09` });
      if (staged && lastDue) {
        base = lastDue;
        steps.push({ label: "\u5206\u671F\u5C65\u884C", value: `\u81EA\u6700\u540E\u4E00\u671F\u5C4A\u6EE1\u65E5 ${ymd(lastDue)} \u8D77\u7B97`, emphasis: true, note: "\u300A\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u300B\u7B2C246\u6761\u7B2C2\u6B3E" });
      }
      if (interrupted && iDate) {
        base = iDate;
        steps.push({ label: "\u65F6\u6548\u4E2D\u65AD", value: `\u81EA ${ymd(iDate)} \u91CD\u65B0\u8BA1\u7B97`, emphasis: true });
      }
      const p = calcPeriod(base, 2, "year");
      steps.push({ label: "\u52A0\u4E8C\u5E74", value: `${ymd(p.rawEnd)}\uFF08${weekdayCn(p.rawEnd)}\uFF09` });
      if (p.postponed) {
        steps.push({ label: "\u4F11\u5047\u65E5\u987A\u5EF6", value: `${p.postponedDays.join("\u3001")} \u2192 ${ymd(p.finalEnd)}`, emphasis: true });
      }
      steps.push({ label: "\u7533\u8BF7\u6267\u884C\u671F\u95F4\u5C4A\u6EE1\u65E5", value: `${ymd(p.finalEnd)}\uFF08${weekdayCn(p.finalEnd)}\uFF09`, emphasis: true });
      const now = /* @__PURE__ */ new Date();
      const remain = Math.round((p.finalEnd.getTime() - now.getTime()) / 864e5);
      return {
        main: {
          label: "\u7533\u8BF7\u6267\u884C\u671F\u95F4\u5C4A\u6EE1\u65E5",
          value: ymd(p.finalEnd),
          sub: remain <= 0 ? `\u26A0 \u5DF2\u8FC7 ${Math.abs(remain)} \u5929\uFF0C\u7533\u8BF7\u53EF\u80FD\u4E0D\u88AB\u53D7\u7406` : `\u8DDD\u4ECA\u65E5 ${remain} \u5929`
        },
        blocks: [
          { label: "\u6CD5\u5B9A\u671F\u95F4", value: "2 \u5E74" },
          { label: "\u8D77\u7B97\u65E5", value: ymd(p.startFrom) },
          { label: "\u5269\u4F59\u5929\u6570", value: remain <= 0 ? "\u5DF2\u5C4A\u6EE1" : `${remain} \u5929` }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u300B",
            article: "\u7B2C\u4E8C\u767E\u56DB\u5341\u516D\u6761\uFF082021\u5E74\u4FEE\u6B63\u6761\u6587\u53F7\uFF09",
            text: "\u7533\u8BF7\u6267\u884C\u7684\u671F\u95F4\u4E3A\u4E8C\u5E74\u3002\u7533\u8BF7\u6267\u884C\u65F6\u6548\u7684\u4E2D\u6B62\u3001\u4E2D\u65AD\uFF0C\u9002\u7528\u6CD5\u5F8B\u6709\u5173\u8BC9\u8BBC\u65F6\u6548\u4E2D\u6B62\u3001\u4E2D\u65AD\u7684\u89C4\u5B9A\u3002\u524D\u6B3E\u89C4\u5B9A\u7684\u671F\u95F4\uFF0C\u4ECE\u6CD5\u5F8B\u6587\u4E66\u89C4\u5B9A\u5C65\u884C\u671F\u95F4\u7684\u6700\u540E\u4E00\u65E5\u8D77\u8BA1\u7B97\uFF1B\u6CD5\u5F8B\u6587\u4E66\u89C4\u5B9A\u5206\u671F\u5C65\u884C\u7684\uFF0C\u4ECE\u6700\u540E\u4E00\u671F\u5C65\u884C\u671F\u9650\u5C4A\u6EE1\u4E4B\u65E5\u8D77\u8BA1\u7B97\uFF1B\u6CD5\u5F8B\u6587\u4E66\u672A\u89C4\u5B9A\u5C65\u884C\u671F\u95F4\u7684\uFF0C\u4ECE\u6CD5\u5F8B\u6587\u4E66\u751F\u6548\u4E4B\u65E5\u8D77\u8BA1\u7B97\u3002"
          }
        ],
        tips: [
          "\u7533\u8BF7\u6267\u884C\u671F\u95F4\u9002\u7528\u8BC9\u8BBC\u65F6\u6548\u4E2D\u6B62\u3001\u4E2D\u65AD\u7684\u89C4\u5B9A\uFF0C\u8FD9\u4E00\u70B9\u4E0E\u4E0A\u8BC9\u671F\u7B49\u4E0D\u53D8\u671F\u95F4\u5B8C\u5168\u4E0D\u540C\u3002",
          "\u8D85\u8FC7\u7533\u8BF7\u6267\u884C\u671F\u95F4\u63D0\u51FA\u7533\u8BF7\uFF0C\u6CD5\u9662\u4ECD\u5E94\u53D7\u7406\uFF1B\u88AB\u6267\u884C\u4EBA\u63D0\u51FA\u5F02\u8BAE\u4E14\u6210\u7ACB\u7684\uFF0C\u88C1\u5B9A\u4E0D\u4E88\u6267\u884C\u3002",
          "\u5B9E\u52A1\u5EFA\u8BAE\uFF1A\u5224\u51B3\u751F\u6548\u540E\u53CA\u65F6\u7533\u8BF7\u6267\u884C\uFF0C\u5373\u4F7F\u6682\u65E0\u8D22\u4EA7\u53EF\u4F9B\u6267\u884C\uFF0C\u6CD5\u9662\u7EC8\u672C\u540E\u53D1\u73B0\u7684\u8D22\u4EA7\u4ECD\u53EF\u968F\u65F6\u6062\u590D\u6267\u884C\u3002"
        ]
      };
    }
  },
  /* ── 再审申请期 ── */
  {
    id: "retrial-deadline",
    name: "\u518D\u5BA1\u7533\u8BF7\u671F\u9650",
    category: "limitation",
    glyph: "\u518D",
    summary: "\u5224\u51B3\u751F\u6548\u540E\u516D\u4E2A\u6708\u518D\u5BA1\u7533\u8BF7\u671F\uFF0C\u53CA\u7279\u6B8A\u4E8B\u7531\u7684\u77E5\u9053\u4E4B\u65E5\u8D77\u516D\u4E2A\u6708",
    keywords: ["\u518D\u5BA1", "\u516D\u4E2A\u6708", "\u7533\u8BF7\u518D\u5BA1", "\u751F\u6548"],
    fields: [
      { key: "effectiveDate", label: "\u5224\u51B3 / \u88C1\u5B9A\u751F\u6548\u4E4B\u65E5", type: "date", defaultValue: "2025-06-01" },
      {
        key: "special",
        label: "\u662F\u5426\u5C5E\u4E8E\u7279\u6B8A\u4E8B\u7531",
        type: "switch",
        defaultValue: false,
        hint: "\u5982\u51FA\u73B0\u65B0\u8BC1\u636E\u3001\u539F\u88C1\u5224\u4F9D\u636E\u7684\u6CD5\u5F8B\u6587\u4E66\u88AB\u64A4\u9500\u3001\u5BA1\u5224\u4EBA\u5458\u6789\u6CD5\u88C1\u5224\u7B49"
      },
      {
        key: "knowDate",
        label: "\u77E5\u9053 / \u5E94\u5F53\u77E5\u9053\u7279\u6B8A\u4E8B\u7531\u4E4B\u65E5",
        type: "date",
        defaultValue: "2026-01-01",
        visibleWhen: (v) => v.special === true || v.special === "true"
      }
    ],
    calc(values) {
      const eff = parseDate(values.effectiveDate) ?? /* @__PURE__ */ new Date();
      const special = values.special === true || values.special === "true";
      const know = parseDate(values.knowDate);
      const steps = [
        { label: "\u88C1\u5224\u751F\u6548\u65E5", value: `${ymd(eff)}\uFF08${weekdayCn(eff)}\uFF09` }
      ];
      const p1 = calcPeriod(eff, 6, "month");
      steps.push({ label: "\u52A0\u516D\u4E2A\u6708", value: `${ymd(p1.rawEnd)}\uFF08${weekdayCn(p1.rawEnd)}\uFF09` });
      if (p1.postponed) {
        steps.push({ label: "\u4F11\u5047\u65E5\u987A\u5EF6", value: `${p1.postponedDays.join("\u3001")} \u2192 ${ymd(p1.finalEnd)}`, emphasis: true });
      }
      steps.push({ label: "\u4E00\u822C\u60C5\u5F62\u5C4A\u6EE1\u65E5", value: `${ymd(p1.finalEnd)}\uFF08${weekdayCn(p1.finalEnd)}\uFF09`, emphasis: true });
      let finalEnd = p1.finalEnd;
      if (special && know) {
        const p2 = calcPeriod(know, 6, "month");
        steps.push({
          label: "\u7279\u6B8A\u4E8B\u7531",
          value: `\u81EA\u77E5\u9053\u4E4B\u65E5 ${ymd(know)}\uFF08${weekdayCn(know)}\uFF09\u8D77\u7B97\u516D\u4E2A\u6708`,
          note: "\u5305\u62EC\uFF1A\u6709\u65B0\u7684\u8BC1\u636E\u8DB3\u4EE5\u63A8\u7FFB\u539F\u88C1\u5224\u3001\u539F\u88C1\u5224\u4F9D\u636E\u7684\u6CD5\u5F8B\u6587\u4E66\u88AB\u64A4\u9500\u6216\u53D8\u66F4\u3001\u5BA1\u5224\u4EBA\u5458\u6709\u6789\u6CD5\u88C1\u5224\u884C\u4E3A\u7B49",
          emphasis: true
        });
        steps.push({ label: "\u7279\u6B8A\u60C5\u5F62\u5C4A\u6EE1\u65E5", value: `${ymd(p2.finalEnd)}\uFF08${weekdayCn(p2.finalEnd)}\uFF09`, emphasis: true });
        finalEnd = p2.finalEnd > finalEnd ? p2.finalEnd : finalEnd;
        steps.push({ label: "\u53D6\u8F83\u665A\u8005", value: `${ymd(finalEnd)}\uFF08${weekdayCn(finalEnd)}\uFF09`, emphasis: true });
      }
      const now = /* @__PURE__ */ new Date();
      const remain = Math.round((finalEnd.getTime() - now.getTime()) / 864e5);
      return {
        main: {
          label: "\u518D\u5BA1\u7533\u8BF7\u671F\u9650\u5C4A\u6EE1\u65E5",
          value: ymd(finalEnd),
          sub: remain <= 0 ? `\u26A0 \u5DF2\u8FC7 ${Math.abs(remain)} \u5929` : `\u8DDD\u4ECA\u65E5 ${remain} \u5929`
        },
        blocks: [
          { label: "\u6CD5\u5B9A\u671F\u95F4", value: "6 \u4E2A\u6708" },
          { label: "\u9002\u7528\u8D77\u7B97\u70B9", value: special && know ? "\u77E5\u9053\u7279\u6B8A\u4E8B\u7531\u4E4B\u65E5" : "\u88C1\u5224\u751F\u6548\u4E4B\u65E5" },
          { label: "\u5269\u4F59\u5929\u6570", value: remain <= 0 ? "\u5DF2\u5C4A\u6EE1" : `${remain} \u5929` }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u300B",
            article: "\u7B2C\u4E8C\u767E\u96F6\u4E94\u6761\uFF082021\u5E74\u4FEE\u6B63\u6761\u6587\u53F7\uFF09",
            text: "\u5F53\u4E8B\u4EBA\u7533\u8BF7\u518D\u5BA1\uFF0C\u5E94\u5F53\u5728\u5224\u51B3\u3001\u88C1\u5B9A\u53D1\u751F\u6CD5\u5F8B\u6548\u529B\u540E\u516D\u4E2A\u6708\u5185\u63D0\u51FA\uFF1B\u6709\u672C\u6CD5\u7B2C\u4E8C\u767E\u96F6\u4E03\u6761\u7B2C\u4E00\u9879\u3001\u7B2C\u4E09\u9879\u3001\u7B2C\u5341\u4E8C\u9879\u3001\u7B2C\u5341\u4E09\u9879\u89C4\u5B9A\u60C5\u5F62\u7684\uFF0C\u81EA\u77E5\u9053\u6216\u8005\u5E94\u5F53\u77E5\u9053\u4E4B\u65E5\u8D77\u516D\u4E2A\u6708\u5185\u63D0\u51FA\u3002"
          }
        ],
        tips: [
          "\u516D\u4E2A\u6708\u662F\u4E0D\u53D8\u671F\u95F4\uFF0C\u4E0D\u9002\u7528\u4E2D\u6B62\u3001\u4E2D\u65AD\u3001\u5EF6\u957F\uFF0C\u903E\u671F\u7533\u8BF7\u7684\u518D\u5BA1\u4E8B\u7531\u5C06\u4E0D\u4E88\u5BA1\u67E5\u3002",
          "\u540C\u4E00\u6848\u4EF6\u4E00\u822C\u53EA\u80FD\u7533\u8BF7\u518D\u5BA1\u4E00\u6B21\uFF0C\u88AB\u9A73\u56DE\u540E\u53EF\u5411\u68C0\u5BDF\u9662\u7533\u8BF7\u68C0\u5BDF\u5EFA\u8BAE\u6216\u6297\u8BC9\u3002",
          "\u518D\u5BA1\u4E0D\u505C\u6B62\u539F\u5224\u51B3\u7684\u6267\u884C\uFF0C\u4F46\u6D89\u53CA\u8FFD\u7D22\u8D61\u517B\u8D39\u3001\u6276\u517B\u8D39\u3001\u629A\u517B\u8D39\u3001\u629A\u6064\u91D1\u3001\u533B\u7597\u8D39\u7528\u3001\u52B3\u52A8\u62A5\u916C\u7B49\u6848\u4EF6\uFF0C\u53EF\u4EE5\u88C1\u5B9A\u4E2D\u6B62\u6267\u884C\u3002"
        ]
      };
    }
  },
  /* ── 劳动仲裁时效 ── */
  {
    id: "arbitration-limitation",
    name: "\u52B3\u52A8\u4EF2\u88C1\u65F6\u6548",
    category: "limitation",
    glyph: "\u88C1",
    summary: "\u4E00\u5E74\u4EF2\u88C1\u65F6\u6548\uFF0C\u52B3\u52A8\u62A5\u916C\u4E89\u8BAE\u81EA\u52B3\u52A8\u5173\u7CFB\u7EC8\u6B62\u8D77\u7B97",
    keywords: ["\u52B3\u52A8\u4EF2\u88C1", "\u4EF2\u88C1\u65F6\u6548", "\u4E00\u5E74", "\u52B3\u52A8\u62A5\u916C"],
    fields: [
      {
        key: "disputeType",
        label: "\u4E89\u8BAE\u7C7B\u578B",
        type: "select",
        defaultValue: "wage",
        options: [
          { label: "\u62D6\u6B20\u52B3\u52A8\u62A5\u916C\uFF08\u5B58\u7EED\u671F\u95F4\u4E0D\u53D7\u9650\u5236\uFF09", value: "wage" },
          { label: "\u8FDD\u6CD5\u89E3\u9664\u8D54\u507F\u91D1 / \u7ECF\u6D4E\u8865\u507F", value: "termination" },
          { label: "\u672A\u7B7E\u52B3\u52A8\u5408\u540C\u4E8C\u500D\u5DE5\u8D44", value: "double" },
          { label: "\u5DE5\u4F24\u5F85\u9047", value: "injury" },
          { label: "\u5176\u4ED6\u52B3\u52A8\u4E89\u8BAE", value: "other" }
        ]
      },
      { key: "knowDate", label: "\u77E5\u9053\u6216\u5E94\u5F53\u77E5\u9053\u6743\u5229\u88AB\u4FB5\u5BB3\u4E4B\u65E5", type: "date", defaultValue: "2025-01-01" },
      {
        key: "endDate",
        label: "\u52B3\u52A8\u5173\u7CFB\u7EC8\u6B62\u4E4B\u65E5",
        type: "date",
        defaultValue: "2025-06-01",
        hint: "\u52B3\u52A8\u62A5\u916C\u4E89\u8BAE\u81EA\u52B3\u52A8\u5173\u7CFB\u7EC8\u6B62\u4E4B\u65E5\u8D77\u7B97\u4E00\u5E74",
        visibleWhen: (v) => toStr(v.disputeType) === "wage"
      },
      {
        key: "interrupt",
        label: "\u662F\u5426\u53D1\u751F\u65F6\u6548\u4E2D\u65AD",
        type: "switch",
        defaultValue: false,
        hint: "\u5411\u5BF9\u65B9\u4E3B\u5F20\u6743\u5229\u3001\u5411\u6709\u5173\u90E8\u95E8\u8BF7\u6C42\u6551\u6D4E\u3001\u5BF9\u65B9\u540C\u610F\u5C65\u884C\u7B49"
      },
      {
        key: "interruptDate",
        label: "\u6700\u8FD1\u4E00\u6B21\u4E2D\u65AD\u4E8B\u7531\u53D1\u751F\u65E5",
        type: "date",
        defaultValue: "2025-03-01",
        visibleWhen: (v) => v.interrupt === true || v.interrupt === "true"
      }
    ],
    calc(values) {
      const type = toStr(values.disputeType, "wage");
      const know = parseDate(values.knowDate) ?? /* @__PURE__ */ new Date();
      const end = parseDate(values.endDate);
      const interrupted = values.interrupt === true || values.interrupt === "true";
      const iDate = parseDate(values.interruptDate);
      const steps = [];
      let base = know;
      let baseLabel = "\u77E5\u9053\u6216\u5E94\u5F53\u77E5\u9053\u6743\u5229\u88AB\u4FB5\u5BB3\u4E4B\u65E5";
      if (type === "wage" && end) {
        base = end;
        baseLabel = "\u52B3\u52A8\u5173\u7CFB\u7EC8\u6B62\u4E4B\u65E5";
        steps.push({
          label: "\u52B3\u52A8\u62A5\u916C\u4E89\u8BAE\u7279\u522B\u89C4\u5219",
          value: "\u52B3\u52A8\u5173\u7CFB\u5B58\u7EED\u671F\u95F4\u56E0\u62D6\u6B20\u52B3\u52A8\u62A5\u916C\u53D1\u751F\u4E89\u8BAE\u7684\uFF0C\u4E0D\u53D7\u4E00\u5E74\u4EF2\u88C1\u65F6\u6548\u9650\u5236",
          note: "\u300A\u52B3\u52A8\u4E89\u8BAE\u8C03\u89E3\u4EF2\u88C1\u6CD5\u300B\u7B2C27\u6761\u7B2C4\u6B3E",
          emphasis: true
        });
        steps.push({ label: "\u52B3\u52A8\u5173\u7CFB\u7EC8\u6B62\u65E5", value: `${ymd(end)}\uFF08${weekdayCn(end)}\uFF09` });
        steps.push({ label: "\u8D77\u7B97\u70B9", value: "\u81EA\u52B3\u52A8\u5173\u7CFB\u7EC8\u6B62\u4E4B\u65E5\u8D77\u7B97\u4E00\u5E74", emphasis: true });
      } else {
        steps.push({ label: "\u8D77\u7B97\u70B9", value: `${ymd(know)}\uFF08${weekdayCn(know)}\uFF09` });
      }
      if (interrupted && iDate) {
        base = iDate;
        baseLabel = "\u4E2D\u65AD\u4E8B\u7531\u53D1\u751F\u65E5";
        steps.push({ label: "\u65F6\u6548\u4E2D\u65AD", value: `\u81EA ${ymd(iDate)} \u91CD\u65B0\u8BA1\u7B97`, emphasis: true });
      }
      const p = calcPeriod(base, 1, "year");
      steps.push({ label: "\u52A0\u4E00\u5E74", value: `${ymd(p.rawEnd)}\uFF08${weekdayCn(p.rawEnd)}\uFF09` });
      if (p.postponed) {
        steps.push({ label: "\u4F11\u5047\u65E5\u987A\u5EF6", value: `${p.postponedDays.join("\u3001")} \u2192 ${ymd(p.finalEnd)}`, emphasis: true });
      }
      steps.push({ label: "\u4EF2\u88C1\u65F6\u6548\u5C4A\u6EE1\u65E5", value: `${ymd(p.finalEnd)}\uFF08${weekdayCn(p.finalEnd)}\uFF09`, emphasis: true });
      const now = /* @__PURE__ */ new Date();
      const remain = Math.round((p.finalEnd.getTime() - now.getTime()) / 864e5);
      return {
        main: {
          label: "\u52B3\u52A8\u4EF2\u88C1\u65F6\u6548\u5C4A\u6EE1\u65E5",
          value: ymd(p.finalEnd),
          sub: remain <= 0 ? `\u26A0 \u5DF2\u8FC7 ${Math.abs(remain)} \u5929` : `\u8DDD\u4ECA\u65E5 ${remain} \u5929`
        },
        blocks: [
          { label: "\u6CD5\u5B9A\u65F6\u6548", value: "1 \u5E74" },
          { label: "\u8D77\u7B97\u57FA\u51C6", value: baseLabel },
          { label: "\u8D77\u7B97\u65E5", value: ymd(p.startFrom) },
          { label: "\u5269\u4F59\u5929\u6570", value: remain <= 0 ? "\u5DF2\u5C4A\u6EE1" : `${remain} \u5929` }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u52B3\u52A8\u4E89\u8BAE\u8C03\u89E3\u4EF2\u88C1\u6CD5\u300B",
            article: "\u7B2C\u4E8C\u5341\u4E03\u6761",
            text: "\u52B3\u52A8\u4E89\u8BAE\u7533\u8BF7\u4EF2\u88C1\u7684\u65F6\u6548\u671F\u95F4\u4E3A\u4E00\u5E74\u3002\u4EF2\u88C1\u65F6\u6548\u671F\u95F4\u4ECE\u5F53\u4E8B\u4EBA\u77E5\u9053\u6216\u8005\u5E94\u5F53\u77E5\u9053\u5176\u6743\u5229\u88AB\u4FB5\u5BB3\u4E4B\u65E5\u8D77\u8BA1\u7B97\u3002\u524D\u6B3E\u89C4\u5B9A\u7684\u4EF2\u88C1\u65F6\u6548\uFF0C\u56E0\u5F53\u4E8B\u4EBA\u4E00\u65B9\u5411\u5BF9\u65B9\u5F53\u4E8B\u4EBA\u4E3B\u5F20\u6743\u5229\uFF0C\u6216\u8005\u5411\u6709\u5173\u90E8\u95E8\u8BF7\u6C42\u6743\u5229\u6551\u6D4E\uFF0C\u6216\u8005\u5BF9\u65B9\u5F53\u4E8B\u4EBA\u540C\u610F\u5C65\u884C\u4E49\u52A1\u800C\u4E2D\u65AD\u3002\u4ECE\u4E2D\u65AD\u65F6\u8D77\uFF0C\u4EF2\u88C1\u65F6\u6548\u671F\u95F4\u91CD\u65B0\u8BA1\u7B97\u3002\u56E0\u4E0D\u53EF\u6297\u529B\u6216\u8005\u6709\u5176\u4ED6\u6B63\u5F53\u7406\u7531\uFF0C\u5F53\u4E8B\u4EBA\u4E0D\u80FD\u5728\u672C\u6761\u7B2C\u4E00\u6B3E\u89C4\u5B9A\u7684\u4EF2\u88C1\u65F6\u6548\u671F\u95F4\u7533\u8BF7\u4EF2\u88C1\u7684\uFF0C\u4EF2\u88C1\u65F6\u6548\u4E2D\u6B62\u3002\u52B3\u52A8\u5173\u7CFB\u5B58\u7EED\u671F\u95F4\u56E0\u62D6\u6B20\u52B3\u52A8\u62A5\u916C\u53D1\u751F\u4E89\u8BAE\u7684\uFF0C\u52B3\u52A8\u8005\u7533\u8BF7\u4EF2\u88C1\u4E0D\u53D7\u672C\u6761\u7B2C\u4E00\u6B3E\u89C4\u5B9A\u7684\u4EF2\u88C1\u65F6\u6548\u671F\u95F4\u7684\u9650\u5236\uFF1B\u4F46\u662F\uFF0C\u52B3\u52A8\u5173\u7CFB\u7EC8\u6B62\u7684\uFF0C\u5E94\u5F53\u81EA\u52B3\u52A8\u5173\u7CFB\u7EC8\u6B62\u4E4B\u65E5\u8D77\u4E00\u5E74\u5185\u63D0\u51FA\u3002"
          }
        ],
        tips: [
          "\u52B3\u52A8\u4EF2\u88C1\u662F\u8BC9\u8BBC\u7684\u524D\u7F6E\u7A0B\u5E8F\uFF0C\u672A\u7ECF\u4EF2\u88C1\u76F4\u63A5\u8D77\u8BC9\u7684\uFF0C\u6CD5\u9662\u4E0D\u4E88\u53D7\u7406\u3002",
          '\u52B3\u52A8\u62A5\u916C\u4E89\u8BAE\u7684\u65F6\u6548\u8D77\u7B97\u70B9\u662F"\u52B3\u52A8\u5173\u7CFB\u7EC8\u6B62\u4E4B\u65E5"\uFF0C\u5728\u804C\u671F\u95F4\u4E0D\u53D7\u4E00\u5E74\u9650\u5236\uFF0C\u8FD9\u662F\u52B3\u52A8\u8005\u6700\u6709\u5229\u7684\u89C4\u5219\u4E4B\u4E00\u3002',
          '\u4E8C\u500D\u5DE5\u8D44\u5DEE\u989D\u7684\u4EF2\u88C1\u65F6\u6548\u5404\u5730\u88C1\u5224\u53E3\u5F84\u4E0D\u4E00\uFF0C\u90E8\u5206\u5730\u533A\u6309"\u5E94\u5F53\u8BA2\u7ACB\u4E66\u9762\u5408\u540C\u671F\u6EE1\u4E4B\u6B21\u65E5"\u8D77\u7B97\u4E00\u5E74\uFF0C\u9700\u67E5\u8BE2\u5F53\u5730\u88C1\u5BA1\u53E3\u5F84\u3002',
          "\u4EF2\u88C1\u88C1\u51B3\u540E 15 \u65E5\u5185\u53EF\u5411\u6CD5\u9662\u8D77\u8BC9\uFF0C\u903E\u671F\u88C1\u51B3\u4E66\u751F\u6548\u3002"
        ]
      };
    }
  }
];

// src/core/calculators/tax.ts
var STAMP_ITEMS = {
  loan: { label: "\u501F\u6B3E\u5408\u540C", rate: 0.05, note: "\u501F\u6B3E\u91D1\u989D" },
  lease_finance: { label: "\u878D\u8D44\u79DF\u8D41\u5408\u540C", rate: 0.05, note: "\u79DF\u91D1" },
  sale: { label: "\u4E70\u5356\u5408\u540C", rate: 0.3, note: "\u4EF7\u6B3E" },
  contract_work: { label: "\u627F\u63FD\u5408\u540C", rate: 0.3, note: "\u62A5\u916C" },
  construction: { label: "\u5EFA\u8BBE\u5DE5\u7A0B\u5408\u540C", rate: 0.3, note: "\u4EF7\u6B3E" },
  transport: { label: "\u8FD0\u8F93\u5408\u540C", rate: 0.3, note: "\u8FD0\u8F93\u8D39\u7528" },
  technology: { label: "\u6280\u672F\u5408\u540C", rate: 0.3, note: "\u4EF7\u6B3E\u3001\u62A5\u916C\u6216\u4F7F\u7528\u8D39" },
  lease: { label: "\u79DF\u8D41\u5408\u540C", rate: 1, note: "\u79DF\u91D1" },
  storage: { label: "\u4ED3\u50A8\u5408\u540C", rate: 1, note: "\u4ED3\u50A8\u8D39" },
  safekeeping: { label: "\u4FDD\u7BA1\u5408\u540C", rate: 1, note: "\u4FDD\u7BA1\u8D39" },
  insurance: { label: "\u8D22\u4EA7\u4FDD\u9669\u5408\u540C", rate: 1, note: "\u4FDD\u9669\u8D39" },
  land_transfer: { label: "\u571F\u5730\u4F7F\u7528\u6743\u51FA\u8BA9 / \u8F6C\u8BA9\u4E66\u636E", rate: 0.5, note: "\u4EF7\u6B3E" },
  house_transfer: { label: "\u623F\u5C4B\u7B49\u5EFA\u7B51\u7269\u6240\u6709\u6743\u8F6C\u8BA9\u4E66\u636E", rate: 0.5, note: "\u4EF7\u6B3E" },
  equity_transfer: { label: "\u80A1\u6743\u8F6C\u8BA9\u4E66\u636E\uFF08\u975E\u4E0A\u5E02\uFF09", rate: 0.5, note: "\u4EF7\u6B3E" },
  ip_transfer: { label: "\u5546\u6807 / \u8457\u4F5C\u6743 / \u4E13\u5229\u6743\u8F6C\u8BA9\u4E66\u636E", rate: 0.3, note: "\u4EF7\u6B3E" },
  capital_book: { label: "\u8425\u4E1A\u8D26\u7C3F\uFF08\u5B9E\u6536\u8D44\u672C + \u8D44\u672C\u516C\u79EF\uFF09", rate: 0.25, note: "\u5408\u8BA1\u91D1\u989D" }
};
var IIT_TIERS = [
  { upTo: 36e3, rate: 0.03, deduct: 0 },
  { upTo: 144e3, rate: 0.1, deduct: 2520 },
  { upTo: 3e5, rate: 0.2, deduct: 16920 },
  { upTo: 42e4, rate: 0.25, deduct: 31920 },
  { upTo: 66e4, rate: 0.3, deduct: 52920 },
  { upTo: 96e4, rate: 0.35, deduct: 85920 },
  { upTo: Infinity, rate: 0.45, deduct: 181920 }
];
var LABOR_TIERS = [
  { upTo: 2e4, rate: 0.2, deduct: 0 },
  { upTo: 5e4, rate: 0.3, deduct: 2e3 },
  { upTo: Infinity, rate: 0.4, deduct: 7e3 }
];
function tieredTax(taxable, tiers) {
  for (const t of tiers) {
    if (taxable <= t.upTo) {
      return { tax: Math.max(0, round(taxable * t.rate - t.deduct, 2)), rate: t.rate, deduct: t.deduct };
    }
  }
  return { tax: 0, rate: 0, deduct: 0 };
}
var taxCalculators = [
  /* ── 印花税 ── */
  {
    id: "stamp-duty",
    name: "\u5408\u540C\u5370\u82B1\u7A0E",
    category: "tax",
    glyph: "\u5370",
    summary: "\u6309\u300A\u5370\u82B1\u7A0E\u6CD5\u300B\u7A0E\u76EE\u7A0E\u7387\u8868\u8BA1\u7B97\u5404\u7C7B\u5408\u540C\u5E94\u7F34\u5370\u82B1\u7A0E",
    keywords: ["\u5370\u82B1\u7A0E", "\u5408\u540C\u7A0E", "\u80A1\u6743\u8F6C\u8BA9", "\u501F\u6B3E\u5408\u540C"],
    fields: [
      {
        key: "item",
        label: "\u7A0E\u76EE",
        type: "select",
        defaultValue: "sale",
        options: Object.entries(STAMP_ITEMS).map(([k, v]) => ({ label: v.label, value: k }))
      },
      { key: "amount", label: "\u8BA1\u7A0E\u91D1\u989D", type: "money", unit: "\u5143", defaultValue: 1e7, hint: "\u4E0D\u542B\u589E\u503C\u7A0E\uFF1B\u672A\u5217\u660E\u589E\u503C\u7A0E\u7684\u6309\u5168\u989D\u8BA1\u5F81" },
      {
        key: "vatIncluded",
        label: "\u91D1\u989D\u662F\u5426\u542B\u589E\u503C\u7A0E",
        type: "switch",
        defaultValue: false,
        hint: "\u5E94\u7A0E\u5408\u540C\u7684\u8BA1\u7A0E\u4F9D\u636E\u4E0D\u542B\u5217\u660E\u7684\u589E\u503C\u7A0E\u7A0E\u6B3E"
      },
      {
        key: "vat",
        label: "\u5408\u540C\u5217\u660E\u7684\u589E\u503C\u7A0E\u989D",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        visibleWhen: (v) => v.vatIncluded === true || v.vatIncluded === "true"
      },
      {
        key: "copies",
        label: "\u5408\u540C\u4EFD\u6570\uFF08\u5404\u65B9\u5747\u9700\u8D34\u82B1\uFF09",
        type: "number",
        unit: "\u4EFD",
        defaultValue: 2,
        hint: "\u540C\u4E00\u5408\u540C\u7531\u5404\u65B9\u5206\u522B\u7EB3\u7A0E\uFF0C\u6BCF\u4EFD\u91D1\u989D\u76F8\u540C"
      },
      {
        key: "smallScale",
        label: "\u662F\u5426\u4EAB\u53D7\u5C0F\u89C4\u6A21\u7EB3\u7A0E\u4EBA\u51CF\u534A\u4F18\u60E0",
        type: "switch",
        defaultValue: false,
        hint: "\u5C0F\u89C4\u6A21\u7EB3\u7A0E\u4EBA\u3001\u5C0F\u5FAE\u4F01\u4E1A\u3001\u4E2A\u4F53\u5DE5\u5546\u6237\u53EF\u51CF\u534A\u5F81\u6536\uFF08\u73B0\u884C\u4F18\u60E0\u653F\u7B56\uFF09"
      }
    ],
    calc(values) {
      const item = STAMP_ITEMS[toStr(values.item, "sale")] ?? STAMP_ITEMS.sale;
      let amount = toNum(values.amount);
      const vat = values.vatIncluded === true || values.vatIncluded === "true" ? toNum(values.vat) : 0;
      const copies = Math.max(1, Math.round(toNum(values.copies, 2)));
      const halved = values.smallScale === true || values.smallScale === "true";
      const steps = [];
      let base = amount;
      if (vat > 0) {
        base = round(amount - vat, 2);
        steps.push({
          label: "\u6263\u9664\u5217\u660E\u7684\u589E\u503C\u7A0E",
          value: `${money(amount)} \u2212 ${money(vat)} = ${money(base)} \u5143`,
          note: "\u300A\u5370\u82B1\u7A0E\u6CD5\u300B\u7B2C\u4E94\u6761\u7B2C\uFF08\u4E00\uFF09\u9879\uFF1A\u5E94\u7A0E\u5408\u540C\u7684\u8BA1\u7A0E\u4F9D\u636E\u4E3A\u5408\u540C\u6240\u5217\u91D1\u989D\uFF0C\u4E0D\u5305\u62EC\u5217\u660E\u7684\u589E\u503C\u7A0E\u7A0E\u6B3E"
        });
      } else {
        steps.push({ label: "\u8BA1\u7A0E\u4F9D\u636E", value: `${money(amount)} \u5143`, note: `\u6309${item.note}\u786E\u5B9A` });
      }
      steps.push({ label: "\u9002\u7528\u7A0E\u7387", value: `${item.rate}\u2030`, note: `${item.label}` });
      const perCopy = round(base * item.rate / 1e3, 2);
      steps.push({
        label: "\u5355\u4EFD\u5E94\u7EB3\u7A0E\u989D",
        value: `${money(base)} \xD7 ${item.rate}\u2030 = ${money(perCopy)} \u5143`
      });
      if (halved) {
        steps.push({ label: "\u51CF\u534A\u4F18\u60E0", value: `${money(perCopy)} \xF7 2 = ${money(round(perCopy / 2, 2))} \u5143`, emphasis: true });
      }
      const perAfter = halved ? round(perCopy / 2, 2) : perCopy;
      const total = round(perAfter * copies, 2);
      steps.push({ label: `\u5171 ${copies} \u4EFD\uFF08\u5404\u65B9\u5206\u522B\u7EB3\u7A0E\uFF09`, value: `${money(perAfter)} \xD7 ${copies} = ${money(total)} \u5143`, emphasis: true });
      return {
        main: { label: "\u5370\u82B1\u7A0E\u5408\u8BA1", value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        blocks: [
          { label: "\u5355\u4EFD\u5E94\u7EB3\u7A0E\u989D", value: money(perAfter), unit: "\u5143" },
          { label: "\u9002\u7528\u7A0E\u76EE", value: item.label, sub: `${item.rate}\u2030` },
          { label: "\u5B9E\u9645\u7A0E\u8D1F\u7387", value: `${(total / Math.max(amount, 1) * 100).toFixed(4)}%` }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u5370\u82B1\u7A0E\u6CD5\u300B",
            article: "\u7B2C\u4E94\u6761",
            text: "\u5E94\u7A0E\u5408\u540C\u7684\u8BA1\u7A0E\u4F9D\u636E\uFF0C\u4E3A\u5408\u540C\u6240\u5217\u7684\u91D1\u989D\uFF0C\u4E0D\u5305\u62EC\u5217\u660E\u7684\u589E\u503C\u7A0E\u7A0E\u6B3E\u3002"
          },
          {
            law: "\u300A\u5370\u82B1\u7A0E\u6CD5\u300B",
            article: "\u7B2C\u56DB\u6761",
            text: "\u5370\u82B1\u7A0E\u7684\u7A0E\u76EE\u3001\u7A0E\u7387\uFF0C\u4F9D\u7167\u672C\u6CD5\u6240\u9644\u300A\u5370\u82B1\u7A0E\u7A0E\u76EE\u7A0E\u7387\u8868\u300B\u6267\u884C\u3002"
          },
          {
            law: "\u300A\u5370\u82B1\u7A0E\u7A0E\u76EE\u7A0E\u7387\u8868\u300B",
            text: "\u501F\u6B3E\u5408\u540C\u6309\u501F\u6B3E\u91D1\u989D\u7684\u4E07\u5206\u4E4B\u96F6\u70B9\u4E94\uFF1B\u4E70\u5356\u5408\u540C\u6309\u4EF7\u6B3E\u7684\u4E07\u5206\u4E4B\u4E09\uFF1B\u79DF\u8D41\u5408\u540C\u6309\u79DF\u91D1\u7684\u5343\u5206\u4E4B\u4E00\uFF1B\u80A1\u6743\u8F6C\u8BA9\u4E66\u636E\u6309\u4EF7\u6B3E\u7684\u4E07\u5206\u4E4B\u4E94\uFF1B\u8425\u4E1A\u8D26\u7C3F\u6309\u5B9E\u6536\u8D44\u672C\u4E0E\u8D44\u672C\u516C\u79EF\u5408\u8BA1\u91D1\u989D\u7684\u4E07\u5206\u4E4B\u4E8C\u70B9\u4E94\u3002"
          }
        ],
        tips: [
          "\u540C\u4E00\u5408\u540C\u7531\u5404\u65B9\u5F53\u4E8B\u4EBA\u5206\u522B\u7EB3\u7A0E\uFF0C\u5B9E\u52A1\u4E2D\u53CC\u65B9\u5404\u7F34\u4E00\u6B21\uFF0C\u4E0D\u8981\u8BEF\u8BA4\u4E3A\u53EA\u7F34\u4E00\u4EFD\u3002",
          "\u5408\u540C\u91D1\u989D\u5728\u5C65\u7EA6\u4E2D\u589E\u52A0\u7684\uFF0C\u5E94\u5C31\u589E\u52A0\u90E8\u5206\u8865\u7F34\u5370\u82B1\u7A0E\uFF1B\u51CF\u5C11\u7684\uFF0C\u5DF2\u7F34\u7A0E\u6B3E\u4E0D\u4E88\u9000\u8FD8\u3002",
          "\u672A\u5217\u660E\u589E\u503C\u7A0E\u7A0E\u6B3E\u7684\u5408\u540C\uFF0C\u6309\u5408\u540C\u5168\u989D\u8BA1\u5F81\uFF0C\u7B7E\u8BA2\u5408\u540C\u65F6\u52A1\u5FC5\u5355\u72EC\u5217\u660E\u7A0E\u989D\u3002",
          "\u5E94\u7A0E\u51ED\u8BC1\u5E94\u5F53\u5728\u4E66\u7ACB\u65F6\u6216\u9886\u53D7\u65F6\u8D34\u82B1\uFF0C\u5883\u5916\u7B7E\u8BA2\u7684\u5883\u5185\u4F7F\u7528\u5408\u540C\u540C\u6837\u5E94\u7A0E\u3002"
        ]
      };
    }
  },
  /* ── 工资薪金个人所得税 ── */
  {
    id: "personal-income-tax",
    name: "\u5DE5\u8D44\u85AA\u91D1\u4E2A\u4EBA\u6240\u5F97\u7A0E",
    category: "tax",
    glyph: "\u7A0E",
    summary: "\u5E74\u5EA6\u7EFC\u5408\u6240\u5F97\u6C47\u7B97\u4E0E\u6708\u5EA6\u7D2F\u8BA1\u9884\u6263\u7684\u4E2A\u7A0E\u6D4B\u7B97",
    keywords: ["\u4E2A\u7A0E", "\u4E2A\u4EBA\u6240\u5F97\u7A0E", "\u4E13\u9879\u9644\u52A0\u6263\u9664", "\u6C47\u7B97"],
    fields: [
      { key: "monthlySalary", label: "\u6708\u5DE5\u8D44\u6536\u5165\uFF08\u7A0E\u524D\uFF09", type: "money", unit: "\u5143", defaultValue: 25e3 },
      { key: "bonus", label: "\u5E74\u5EA6\u5956\u91D1", type: "money", unit: "\u5143", defaultValue: 0, hint: "\u5E76\u5165\u7EFC\u5408\u6240\u5F97\u53E3\u5F84\u8BA1\u7B97" },
      { key: "socialMonthly", label: "\u6BCF\u6708\u4E09\u9669\u4E00\u91D1\u4E2A\u4EBA\u90E8\u5206", type: "money", unit: "\u5143", defaultValue: 3e3 },
      { key: "children", label: "\u5B50\u5973\u6559\u80B2\uFF08\u4EBA\u6570 \xD7 2000 \u5143/\u6708\uFF09", type: "number", unit: "\u4EBA", defaultValue: 1 },
      { key: "elderly", label: "\u8D61\u517B\u8001\u4EBA\uFF08\u72EC\u751F\u5B50\u5973 3000 \u5143/\u6708\uFF09", type: "switch", defaultValue: true },
      { key: "housing", label: "\u4F4F\u623F\u8D37\u6B3E\u5229\u606F / \u79DF\u91D1", type: "select", defaultValue: "loan", options: [
        { label: "\u4F4F\u623F\u8D37\u6B3E\u5229\u606F\uFF081000 \u5143/\u6708\uFF09", value: "loan" },
        { label: "\u4F4F\u623F\u79DF\u91D1\uFF081500 \u5143/\u6708\uFF09", value: "rent1500" },
        { label: "\u4F4F\u623F\u79DF\u91D1\uFF081100 \u5143/\u6708\uFF09", value: "rent1100" },
        { label: "\u65E0", value: "none" }
      ] },
      { key: "infant", label: "3 \u5C81\u4EE5\u4E0B\u5A74\u5E7C\u513F\u7167\u62A4\uFF08\u4EBA\u6570 \xD7 2000 \u5143/\u6708\uFF09", type: "number", unit: "\u4EBA", defaultValue: 0 },
      { key: "other", label: "\u5176\u4ED6\u6263\u9664\uFF08\u5546\u4E1A\u5065\u5EB7\u9669\u7B49\uFF0C\u5E74\uFF09", type: "money", unit: "\u5143", defaultValue: 0 }
    ],
    calc(values) {
      const salary = toNum(values.monthlySalary);
      const bonus = toNum(values.bonus);
      const social = toNum(values.socialMonthly);
      const children = toNum(values.children);
      const elderly = values.elderly === true || values.elderly === "true";
      const housing = toStr(values.housing, "loan");
      const infant = toNum(values.infant);
      const other = toNum(values.other);
      const steps = [];
      const grossAnnual = round(salary * 12 + bonus, 2);
      steps.push({ label: "\u5E74\u5EA6\u6536\u5165\u603B\u989D", value: `${money(salary)} \xD7 12${bonus > 0 ? ` + ${money(bonus)}` : ""} = ${money(grossAnnual)} \u5143` });
      const basicDeduction = 6e4;
      steps.push({ label: "\u57FA\u672C\u51CF\u9664\u8D39\u7528", value: `${money(basicDeduction)} \u5143\uFF085000 \u5143 \xD7 12 \u4E2A\u6708\uFF09` });
      const socialAnnual = round(social * 12, 2);
      steps.push({ label: "\u4E13\u9879\u6263\u9664\uFF08\u4E09\u9669\u4E00\u91D1\uFF09", value: `${money(social)} \xD7 12 = ${money(socialAnnual)} \u5143` });
      let childrenDed = children * 2e3 * 12;
      let infantDed = infant * 2e3 * 12;
      let elderlyDed = elderly ? 3e3 * 12 : 0;
      let housingDed = housing === "loan" ? 1e3 * 12 : housing === "rent1500" ? 1500 * 12 : housing === "rent1100" ? 1100 * 12 : 0;
      steps.push({
        label: "\u4E13\u9879\u9644\u52A0\u6263\u9664",
        value: [
          childrenDed > 0 ? `\u5B50\u5973\u6559\u80B2 ${money(childrenDed)}` : "",
          elderlyDed > 0 ? `\u8D61\u517B\u8001\u4EBA ${money(elderlyDed)}` : "",
          housingDed > 0 ? `\u4F4F\u623F ${money(housingDed)}` : "",
          infantDed > 0 ? `\u5A74\u5E7C\u513F\u7167\u62A4 ${money(infantDed)}` : ""
        ].filter(Boolean).join(" + ") + ` = ${money(childrenDed + elderlyDed + housingDed + infantDed)} \u5143`
      });
      const specialAdd = round(childrenDed + elderlyDed + housingDed + infantDed, 2);
      if (other > 0) steps.push({ label: "\u5176\u4ED6\u6263\u9664", value: `${money(other)} \u5143` });
      const taxable = Math.max(0, round(grossAnnual - basicDeduction - socialAnnual - specialAdd - other, 2));
      steps.push({
        label: "\u5E94\u7EB3\u7A0E\u6240\u5F97\u989D",
        value: `${money(grossAnnual)} \u2212 ${money(basicDeduction)} \u2212 ${money(socialAnnual)} \u2212 ${money(specialAdd)}${other > 0 ? ` \u2212 ${money(other)}` : ""} = ${money(taxable)} \u5143`,
        emphasis: true
      });
      const { tax, rate, deduct } = tieredTax(taxable, IIT_TIERS);
      steps.push({
        label: "\u9002\u7528\u7A0E\u7387\u4E0E\u901F\u7B97\u6263\u9664\u6570",
        value: `${(rate * 100).toFixed(0)}%\uFF0C\u901F\u7B97\u6263\u9664 ${money(deduct)} \u5143`
      });
      steps.push({
        label: "\u5E94\u7EB3\u7A0E\u989D",
        value: `${money(taxable)} \xD7 ${(rate * 100).toFixed(0)}% \u2212 ${money(deduct)} = ${money(tax)} \u5143`,
        emphasis: true
      });
      const netAnnual = round(grossAnnual - socialAnnual - tax, 2);
      steps.push({ label: "\u7A0E\u540E\u5E74\u6536\u5165", value: `${money(netAnnual)} \u5143` });
      return {
        main: { label: "\u5168\u5E74\u5E94\u7EB3\u4E2A\u4EBA\u6240\u5F97\u7A0E", value: money(tax), unit: "\u5143", sub: moneyToChinese(tax) },
        blocks: [
          { label: "\u6708\u5747\u7A0E\u8D1F", value: money(round(tax / 12, 2)), unit: "\u5143/\u6708" },
          { label: "\u6709\u6548\u7A0E\u7387", value: `${(tax / Math.max(grossAnnual, 1) * 100).toFixed(2)}%`, sub: `\u8FB9\u9645\u7A0E\u7387 ${(rate * 100).toFixed(0)}%` },
          { label: "\u7A0E\u540E\u6708\u5747\u6536\u5165", value: money(round(netAnnual / 12, 2)), unit: "\u5143" },
          { label: "\u5168\u5E74\u7EFC\u5408\u6240\u5F97", value: money(grossAnnual), unit: "\u5143" }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u4E2A\u4EBA\u6240\u5F97\u7A0E\u6CD5\u300B",
            article: "\u7B2C\u516D\u6761",
            text: "\u5C45\u6C11\u4E2A\u4EBA\u7684\u7EFC\u5408\u6240\u5F97\uFF0C\u4EE5\u6BCF\u4E00\u7EB3\u7A0E\u5E74\u5EA6\u7684\u6536\u5165\u989D\u51CF\u9664\u8D39\u7528\u516D\u4E07\u5143\u4EE5\u53CA\u4E13\u9879\u6263\u9664\u3001\u4E13\u9879\u9644\u52A0\u6263\u9664\u548C\u4F9D\u6CD5\u786E\u5B9A\u7684\u5176\u4ED6\u6263\u9664\u540E\u7684\u4F59\u989D\uFF0C\u4E3A\u5E94\u7EB3\u7A0E\u6240\u5F97\u989D\u3002"
          },
          {
            law: "\u300A\u4E2A\u4EBA\u6240\u5F97\u7A0E\u6CD5\u300B",
            article: "\u7B2C\u4E09\u6761",
            text: "\u7EFC\u5408\u6240\u5F97\uFF0C\u9002\u7528\u767E\u5206\u4E4B\u4E09\u81F3\u767E\u5206\u4E4B\u56DB\u5341\u4E94\u7684\u8D85\u989D\u7D2F\u8FDB\u7A0E\u7387\u3002"
          }
        ],
        tips: [
          '\u672C\u5DE5\u5177\u91C7\u7528"\u5E76\u5165\u7EFC\u5408\u6240\u5F97"\u53E3\u5F84\u3002\u5168\u5E74\u4E00\u6B21\u6027\u5956\u91D1\u5355\u72EC\u8BA1\u7A0E\u4F18\u60E0\u653F\u7B56\u5728 2027 \u5E74 12 \u6708 31 \u65E5\u524D\u4ECD\u53EF\u9009\u62E9\uFF0C\u9AD8\u6536\u5165\u8005\u5EFA\u8BAE\u4E24\u79CD\u53E3\u5F84\u5206\u522B\u6D4B\u7B97\u540E\u62E9\u4F18\u3002',
          "\u4E13\u9879\u9644\u52A0\u6263\u9664\u6807\u51C6\u8FD1\u5E74\u591A\u6B21\u63D0\u9AD8\uFF0C\u586B\u62A5\u524D\u8BF7\u6838\u5BF9\u5F53\u5E74\u6700\u65B0\u6807\u51C6\u53CA\u672C\u4EBA\u5B9E\u9645\u4EAB\u53D7\u6761\u4EF6\u3002",
          "\u4F4F\u623F\u8D37\u6B3E\u5229\u606F\u4E0E\u4F4F\u623F\u79DF\u91D1\u53EA\u80FD\u4E8C\u9009\u4E00\uFF0C\u4E0D\u80FD\u540C\u65F6\u4EAB\u53D7\u3002",
          '\u5E74\u7EC8\u5956"\u7A0E\u6536\u4E34\u754C\u70B9"\u6548\u5E94\u663E\u8457\uFF08\u5982 36000\u3001144000 \u5143\u9644\u8FD1\u591A\u53D1\u4E00\u5143\u53EF\u80FD\u591A\u7F34\u4E0A\u5343\u5143\uFF09\uFF0C\u53D1\u653E\u65F6\u5E94\u907F\u5F00\u8DF3\u6863\u533A\u95F4\u3002'
        ]
      };
    }
  },
  /* ── 劳务报酬所得税 ── */
  {
    id: "labor-remuneration-tax",
    name: "\u52B3\u52A1\u62A5\u916C\u6240\u5F97\u7A0E",
    category: "tax",
    glyph: "\u52B3",
    summary: "\u5F8B\u5E08\u8D39\u3001\u987E\u95EE\u8D39\u3001\u7A3F\u916C\u7B49\u52B3\u52A1\u62A5\u916C\u7684\u9884\u6263\u9884\u7F34\u4E0E\u5E74\u5EA6\u6C47\u7B97",
    keywords: ["\u52B3\u52A1\u62A5\u916C", "\u9884\u6263\u9884\u7F34", "\u5F8B\u5E08\u8D39\u4E2A\u7A0E", "\u987E\u95EE\u8D39"],
    fields: [
      { key: "income", label: "\u5355\u6B21\u52B3\u52A1\u62A5\u916C\u91D1\u989D", type: "money", unit: "\u5143", defaultValue: 1e5 },
      {
        key: "times",
        label: "\u5E74\u5EA6\u5185\u652F\u4ED8\u6B21\u6570",
        type: "number",
        unit: "\u6B21",
        defaultValue: 1,
        hint: "\u6309\u6B21\u9884\u6263\uFF0C\u5E74\u5EA6\u7EC8\u4E86\u5E76\u5165\u7EFC\u5408\u6240\u5F97\u6C47\u7B97"
      },
      {
        key: "otherIncome",
        label: "\u5E74\u5EA6\u5176\u4ED6\u7EFC\u5408\u6240\u5F97\uFF08\u5DE5\u8D44\u85AA\u91D1\u7B49\uFF09",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        hint: "\u7528\u4E8E\u5E74\u5EA6\u6C47\u7B97\u7684\u6574\u4F53\u6D4B\u7B97"
      },
      {
        key: "otherDeduction",
        label: "\u5E74\u5EA6\u53EF\u6263\u9664\u9879\u5408\u8BA1",
        type: "money",
        unit: "\u5143",
        defaultValue: 6e4,
        hint: "\u57FA\u672C\u51CF\u9664 60000 + \u4E13\u9879\u6263\u9664 + \u4E13\u9879\u9644\u52A0\u6263\u9664"
      }
    ],
    calc(values) {
      const income = toNum(values.income);
      const times = Math.max(1, Math.round(toNum(values.times, 1)));
      const otherIncome = toNum(values.otherIncome);
      const otherDed = toNum(values.otherDeduction);
      const steps = [{ label: "\u5355\u6B21\u52B3\u52A1\u62A5\u916C", value: `${money(income)} \u5143` }];
      let expense = income <= 4e3 ? 800 : round(income * 0.2, 2);
      steps.push({
        label: "\u51CF\u9664\u8D39\u7528",
        value: income <= 4e3 ? "\u6536\u5165 \u2264 4000 \u5143\uFF0C\u51CF\u9664 800 \u5143" : `${money(income)} \xD7 20% = ${money(expense)} \u5143`,
        note: "\u300A\u4E2A\u4EBA\u6240\u5F97\u7A0E\u6CD5\u300B\u7B2C\u516D\u6761\uFF1A\u52B3\u52A1\u62A5\u916C\u6240\u5F97\u6BCF\u6B21\u6536\u5165\u4E0D\u8D85\u8FC7\u56DB\u5343\u5143\u7684\uFF0C\u51CF\u9664\u8D39\u7528\u516B\u767E\u5143\uFF1B\u56DB\u5343\u5143\u4EE5\u4E0A\u7684\uFF0C\u51CF\u9664\u767E\u5206\u4E4B\u4E8C\u5341\u7684\u8D39\u7528"
      });
      const taxableOnce = Math.max(0, round(income - expense, 2));
      steps.push({ label: "\u5355\u6B21\u5E94\u7EB3\u7A0E\u6240\u5F97\u989D", value: `${money(taxableOnce)} \u5143` });
      const t = tieredTax(taxableOnce, LABOR_TIERS);
      steps.push({ label: "\u9884\u6263\u9884\u7F34\u7A0E\u7387", value: `${(t.rate * 100).toFixed(0)}%\uFF0C\u901F\u7B97\u6263\u9664 ${money(t.deduct)} \u5143` });
      const withholdOnce = t.tax;
      steps.push({
        label: "\u5355\u6B21\u9884\u6263\u7A0E\u989D",
        value: `${money(taxableOnce)} \xD7 ${(t.rate * 100).toFixed(0)}% \u2212 ${money(t.deduct)} = ${money(withholdOnce)} \u5143`,
        emphasis: true
      });
      const withholdTotal = round(withholdOnce * times, 2);
      steps.push({ label: `\u5E74\u5EA6\u9884\u6263\u5408\u8BA1\uFF08${times} \u6B21\uFF09`, value: `${money(withholdOnce)} \xD7 ${times} = ${money(withholdTotal)} \u5143` });
      const laborAnnual = round(income * times, 2);
      const laborIncomeAmount = round(laborAnnual * 0.8, 2);
      steps.push({ label: "\u5E74\u5EA6\u52B3\u52A1\u6536\u5165\u989D", value: `${money(laborAnnual)} \xD7 80% = ${money(laborIncomeAmount)} \u5143\uFF08\u4E0D\u518D\u6263 800 \u5143\uFF09` });
      const totalIncomeAmount = round(laborIncomeAmount + otherIncome, 2);
      const taxableYear = Math.max(0, round(totalIncomeAmount - otherDed, 2));
      steps.push({ label: "\u5E74\u5EA6\u7EFC\u5408\u6240\u5F97\u5E94\u7EB3\u7A0E\u6240\u5F97\u989D", value: `${money(taxableYear)} \u5143`, emphasis: true });
      const y = tieredTax(taxableYear, IIT_TIERS);
      steps.push({
        label: "\u5E74\u5EA6\u6C47\u7B97\u5E94\u7EB3\u7A0E\u989D",
        value: `${money(taxableYear)} \xD7 ${(y.rate * 100).toFixed(0)}% \u2212 ${money(y.deduct)} = ${money(y.tax)} \u5143`,
        emphasis: true
      });
      const diff = round(y.tax - withholdTotal, 2);
      steps.push({
        label: diff >= 0 ? "\u5E94\u8865\u7A0E\u989D" : "\u5E94\u9000\u7A0E\u989D",
        value: `${money(Math.abs(diff))} \u5143`,
        note: diff >= 0 ? "\u9884\u6263\u4E0D\u8DB3\uFF0C\u6C47\u7B97\u65F6\u9700\u8865\u7A0E" : "\u9884\u6263\u8D85\u989D\uFF0C\u6C47\u7B97\u65F6\u53EF\u7533\u8BF7\u9000\u7A0E",
        emphasis: true
      });
      const net = round(laborAnnual - y.tax, 2);
      return {
        main: {
          label: "\u5E74\u5EA6\u6C47\u7B97\u5E94\u7EB3\u7A0E\u989D",
          value: money(y.tax),
          unit: "\u5143",
          sub: diff >= 0 ? `\u9700\u8865\u7A0E ${money(diff)} \u5143` : `\u53EF\u9000\u7A0E ${money(Math.abs(diff))} \u5143`
        },
        blocks: [
          { label: "\u5355\u6B21\u9884\u6263\u7A0E\u989D", value: money(withholdOnce), unit: "\u5143" },
          { label: "\u5E74\u5EA6\u9884\u6263\u5408\u8BA1", value: money(withholdTotal), unit: "\u5143" },
          { label: "\u52B3\u52A1\u62A5\u916C\u7A0E\u540E\u51C0\u989D", value: money(net), unit: "\u5143" },
          { label: "\u7EFC\u5408\u7A0E\u8D1F\u7387", value: `${(y.tax / Math.max(laborAnnual, 1) * 100).toFixed(2)}%` }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u4E2A\u4EBA\u6240\u5F97\u7A0E\u6CD5\u300B",
            article: "\u7B2C\u516D\u6761",
            text: "\u52B3\u52A1\u62A5\u916C\u6240\u5F97\u3001\u7A3F\u916C\u6240\u5F97\u3001\u7279\u8BB8\u6743\u4F7F\u7528\u8D39\u6240\u5F97\uFF0C\u6BCF\u6B21\u6536\u5165\u4E0D\u8D85\u8FC7\u56DB\u5343\u5143\u7684\uFF0C\u51CF\u9664\u8D39\u7528\u516B\u767E\u5143\uFF1B\u56DB\u5343\u5143\u4EE5\u4E0A\u7684\uFF0C\u51CF\u9664\u767E\u5206\u4E4B\u4E8C\u5341\u7684\u8D39\u7528\uFF0C\u5176\u4F59\u989D\u4E3A\u5E94\u7EB3\u7A0E\u6240\u5F97\u989D\u3002"
          },
          {
            law: "\u300A\u4E2A\u4EBA\u6240\u5F97\u7A0E\u6263\u7F34\u7533\u62A5\u7BA1\u7406\u529E\u6CD5\uFF08\u8BD5\u884C\uFF09\u300B",
            article: "\u7B2C\u516B\u6761",
            text: "\u6263\u7F34\u4E49\u52A1\u4EBA\u5411\u5C45\u6C11\u4E2A\u4EBA\u652F\u4ED8\u52B3\u52A1\u62A5\u916C\u6240\u5F97\u65F6\uFF0C\u5E94\u5F53\u6309\u7167\u4EE5\u4E0B\u65B9\u6CD5\u6309\u6B21\u9884\u6263\u9884\u7F34\u7A0E\u6B3E\uFF1A\u52B3\u52A1\u62A5\u916C\u6240\u5F97\u9002\u7528\u4E2A\u4EBA\u6240\u5F97\u7A0E\u9884\u6263\u7387\u8868\u4E8C\u3002"
          },
          {
            law: "\u300A\u4E2A\u4EBA\u6240\u5F97\u7A0E\u6CD5\u300B",
            article: "\u7B2C\u5341\u4E00\u6761",
            text: "\u5C45\u6C11\u4E2A\u4EBA\u53D6\u5F97\u7EFC\u5408\u6240\u5F97\uFF0C\u6309\u5E74\u8BA1\u7B97\u4E2A\u4EBA\u6240\u5F97\u7A0E\uFF1B\u6709\u6263\u7F34\u4E49\u52A1\u4EBA\u7684\uFF0C\u7531\u6263\u7F34\u4E49\u52A1\u4EBA\u6309\u6708\u6216\u8005\u6309\u6B21\u9884\u6263\u9884\u7F34\u7A0E\u6B3E\uFF1B\u9700\u8981\u529E\u7406\u6C47\u7B97\u6E05\u7F34\u7684\uFF0C\u5E94\u5F53\u5728\u53D6\u5F97\u6240\u5F97\u7684\u6B21\u5E74\u4E09\u6708\u4E00\u65E5\u81F3\u516D\u6708\u4E09\u5341\u65E5\u5185\u529E\u7406\u6C47\u7B97\u6E05\u7F34\u3002"
          }
        ],
        tips: [
          "\u52B3\u52A1\u62A5\u916C\u9884\u6263\u7A0E\u7387\uFF0820%/30%/40%\uFF09\u8FDC\u9AD8\u4E8E\u6C47\u7B97\u65F6\u7684\u5B9E\u9645\u7A0E\u8D1F\uFF0C\u5355\u6B21\u91D1\u989D\u5927\u3001\u5E74\u5EA6\u6536\u5165\u4F4E\u7684\uFF0C\u901A\u5E38\u80FD\u5728\u6C47\u7B97\u65F6\u83B7\u5F97\u9000\u7A0E\uFF0C\u52A1\u5FC5\u529E\u7406\u6C47\u7B97\u3002",
          "\u652F\u4ED8\u65B9\u662F\u6CD5\u5B9A\u6263\u7F34\u4E49\u52A1\u4EBA\uFF0C\u672A\u4F9D\u6CD5\u6263\u7F34\u7684\u5C06\u9762\u4E34\u5E94\u6263\u672A\u6263\u7A0E\u6B3E 50%\u20143 \u500D\u7684\u7F5A\u6B3E\u3002",
          "\u4F01\u4E1A\u652F\u4ED8\u5F8B\u5E08\u8D39\u3001\u987E\u95EE\u8D39\u3001\u8BB2\u5E08\u8D39\u3001\u8BBE\u8BA1\u8D39\u7B49\u5747\u5C5E\u52B3\u52A1\u62A5\u916C\uFF0C\u9700\u7D22\u53D6\u53D1\u7968\u5E76\u4EE3\u6263\u4E2A\u7A0E\u3002",
          "\u6C47\u7B97\u529E\u7406\u65F6\u95F4\u4E3A\u6B21\u5E74 3 \u6708 1 \u65E5\u81F3 6 \u6708 30 \u65E5\u3002"
        ]
      };
    }
  },
  /* ── 违约金涉税测算 ── */
  {
    id: "penalty-tax",
    name: "\u8FDD\u7EA6\u91D1 / \u8D54\u507F\u91D1\u6D89\u7A0E",
    category: "tax",
    glyph: "\u91D1",
    summary: "\u8FDD\u7EA6\u91D1\u6536\u5165\u7684\u589E\u503C\u7A0E\u3001\u9644\u52A0\u7A0E\u8D39\u4E0E\u4F01\u4E1A\u6240\u5F97\u7A0E / \u4E2A\u7A0E\u6D4B\u7B97",
    keywords: ["\u8FDD\u7EA6\u91D1", "\u8D54\u507F\u91D1", "\u589E\u503C\u7A0E", "\u4EF7\u5916\u8D39\u7528", "\u6D89\u7A0E"],
    fields: [
      { key: "amount", label: "\u8FDD\u7EA6\u91D1 / \u8D54\u507F\u91D1\u91D1\u989D", type: "money", unit: "\u5143", defaultValue: 5e5 },
      {
        key: "receiver",
        label: "\u6536\u53D6\u65B9",
        type: "select",
        defaultValue: "seller",
        options: [
          { label: "\u9500\u552E\u65B9\uFF08\u968F\u8D27\u6B3E\u6536\u53D6\uFF0C\u5C5E\u4EF7\u5916\u8D39\u7528\uFF09", value: "seller" },
          { label: "\u91C7\u8D2D\u65B9 / \u5B88\u7EA6\u65B9\uFF08\u672A\u53D1\u751F\u9500\u552E\u884C\u4E3A\uFF09", value: "buyer" },
          { label: "\u4E2A\u4EBA\uFF08\u5982\u52B3\u52A8\u8005\u3001\u6D88\u8D39\u8005\uFF09", value: "individual" }
        ]
      },
      {
        key: "vatRate",
        label: "\u9002\u7528\u589E\u503C\u7A0E\u7A0E\u7387",
        type: "select",
        defaultValue: "13",
        options: [
          { label: "13%\uFF08\u9500\u552E\u8D27\u7269\u7B49\uFF09", value: "13" },
          { label: "9%\uFF08\u4EA4\u901A\u8FD0\u8F93\u3001\u5EFA\u7B51\u7B49\uFF09", value: "9" },
          { label: "6%\uFF08\u73B0\u4EE3\u670D\u52A1\u3001\u65E0\u5F62\u8D44\u4EA7\u7B49\uFF09", value: "6" },
          { label: "3%\uFF08\u5C0F\u89C4\u6A21\u7EB3\u7A0E\u4EBA\u5F81\u6536\u7387\uFF09", value: "3" },
          { label: "1%\uFF08\u5C0F\u89C4\u6A21\u4F18\u60E0\u5F81\u6536\u7387\uFF09", value: "1" },
          { label: "\u4E0D\u5F81\u589E\u503C\u7A0E", value: "0" }
        ],
        visibleWhen: (v) => toStr(v.receiver) === "seller"
      },
      {
        key: "citRate",
        label: "\u4F01\u4E1A\u6240\u5F97\u7A0E\u7A0E\u7387",
        type: "select",
        defaultValue: "25",
        options: [
          { label: "25%\uFF08\u4E00\u822C\u4F01\u4E1A\uFF09", value: "25" },
          { label: "20%\uFF08\u5C0F\u578B\u5FAE\u5229\u4F01\u4E1A\u5B9E\u9645\u7A0E\u8D1F\uFF09", value: "20" },
          { label: "15%\uFF08\u9AD8\u65B0\u6280\u672F\u4F01\u4E1A\uFF09", value: "15" }
        ],
        visibleWhen: (v) => toStr(v.receiver) !== "individual"
      }
    ],
    calc(values) {
      const amount = toNum(values.amount);
      const receiver = toStr(values.receiver, "seller");
      const vatRate = toNum(values.vatRate, 13) / 100;
      const citRate = toNum(values.citRate, 25) / 100;
      const steps = [{ label: "\u8FDD\u7EA6\u91D1\u91D1\u989D", value: `${money(amount)} \u5143` }];
      let vat = 0;
      let surcharge = 0;
      let cit = 0;
      if (receiver === "seller" && vatRate > 0) {
        vat = round(amount / (1 + vatRate) * vatRate, 2);
        steps.push({
          label: "\u589E\u503C\u7A0E\uFF08\u4EF7\u5916\u8D39\u7528\u9700\u4EF7\u7A0E\u5206\u79BB\uFF09",
          value: `${money(amount)} \xF7 (1 + ${(vatRate * 100).toFixed(0)}%) \xD7 ${(vatRate * 100).toFixed(0)}% = ${money(vat)} \u5143`,
          note: "\u300A\u589E\u503C\u7A0E\u6682\u884C\u6761\u4F8B\u5B9E\u65BD\u7EC6\u5219\u300B\u7B2C\u5341\u4E8C\u6761\uFF1A\u4EF7\u5916\u8D39\u7528\u5305\u62EC\u8FDD\u7EA6\u91D1\u3001\u5EF6\u671F\u4ED8\u6B3E\u5229\u606F\u7B49\uFF0C\u5E94\u5E76\u5165\u9500\u552E\u989D\u5F81\u7A0E",
          emphasis: true
        });
        surcharge = round(vat * 0.12, 2);
        steps.push({
          label: "\u9644\u52A0\u7A0E\u8D39\uFF08\u57CE\u5EFA 7% + \u6559\u80B2\u8D39\u9644\u52A0 3% + \u5730\u65B9\u6559\u80B2\u9644\u52A0 2%\uFF09",
          value: `${money(vat)} \xD7 12% = ${money(surcharge)} \u5143`
        });
      } else if (receiver === "buyer") {
        steps.push({
          label: "\u589E\u503C\u7A0E",
          value: "\u4E0D\u5F81\u6536",
          note: "\u5B88\u7EA6\u65B9\u6536\u53D6\u7684\u8FDD\u7EA6\u91D1\u672A\u53D1\u751F\u9500\u552E\u884C\u4E3A\uFF0C\u4E0D\u5C5E\u4E8E\u589E\u503C\u7A0E\u5E94\u7A0E\u8303\u56F4\uFF0C\u65E0\u9700\u5F00\u7968\uFF0C\u51ED\u5408\u540C\u4E0E\u6536\u6B3E\u51ED\u8BC1\u5165\u8D26",
          emphasis: true
        });
      } else {
        steps.push({ label: "\u589E\u503C\u7A0E", value: "\u4E0D\u6D89\u53CA\uFF08\u4E2A\u4EBA\u6536\u53D6\uFF09" });
      }
      if (receiver !== "individual") {
        const base = round(amount - vat - surcharge, 2);
        cit = round(base * citRate, 2);
        steps.push({
          label: "\u4F01\u4E1A\u6240\u5F97\u7A0E\u5E94\u7EB3\u7A0E\u6240\u5F97\u989D",
          value: `${money(amount)} \u2212 ${money(vat)} \u2212 ${money(surcharge)} = ${money(base)} \u5143`
        });
        steps.push({
          label: "\u4F01\u4E1A\u6240\u5F97\u7A0E",
          value: `${money(base)} \xD7 ${(citRate * 100).toFixed(0)}% = ${money(cit)} \u5143`,
          emphasis: true
        });
      } else {
        steps.push({
          label: "\u4E2A\u4EBA\u6240\u5F97\u7A0E",
          value: "\u4E00\u822C\u4E0D\u5C5E\u4E8E\u5F81\u7A0E\u8303\u56F4",
          note: "\u4E2A\u4EBA\u56E0\u5408\u540C\u89E3\u9664\u53D6\u5F97\u7684\u8FDD\u7EA6\u91D1\u3001\u8D54\u507F\u91D1\uFF0C\u901A\u5E38\u4E0D\u5C5E\u4E8E\u4E2A\u4EBA\u6240\u5F97\u7A0E\u5E94\u7A0E\u6240\u5F97\uFF1B\u4F46\u56E0\u4EFB\u804C\u53D7\u96C7\u5173\u7CFB\u53D6\u5F97\u7684\uFF0C\u5E94\u6309\u5DE5\u8D44\u85AA\u91D1\u8BA1\u7A0E"
        });
      }
      const totalTax = round(vat + surcharge + cit, 2);
      const net = round(amount - totalTax, 2);
      steps.push({ label: "\u7A0E\u8D39\u5408\u8BA1", value: `${money(totalTax)} \u5143`, emphasis: true });
      steps.push({ label: "\u7A0E\u540E\u51C0\u989D", value: `${money(net)} \u5143`, emphasis: true });
      return {
        main: { label: "\u7A0E\u8D39\u5408\u8BA1", value: money(totalTax), unit: "\u5143", sub: `\u7A0E\u540E\u51C0\u989D ${money(net)} \u5143` },
        blocks: [
          { label: "\u589E\u503C\u7A0E", value: money(vat), unit: "\u5143" },
          { label: "\u9644\u52A0\u7A0E\u8D39", value: money(surcharge), unit: "\u5143" },
          { label: "\u4F01\u4E1A\u6240\u5F97\u7A0E", value: money(cit), unit: "\u5143" },
          { label: "\u7EFC\u5408\u7A0E\u8D1F\u7387", value: `${(totalTax / Math.max(amount, 1) * 100).toFixed(2)}%` }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u589E\u503C\u7A0E\u6682\u884C\u6761\u4F8B\u5B9E\u65BD\u7EC6\u5219\u300B",
            article: "\u7B2C\u5341\u4E8C\u6761",
            text: "\u6761\u4F8B\u7B2C\u516D\u6761\u7B2C\u4E00\u6B3E\u6240\u79F0\u4EF7\u5916\u8D39\u7528\uFF0C\u5305\u62EC\u4EF7\u5916\u5411\u8D2D\u4E70\u65B9\u6536\u53D6\u7684\u624B\u7EED\u8D39\u3001\u8865\u8D34\u3001\u57FA\u91D1\u3001\u96C6\u8D44\u8D39\u3001\u8FD4\u8FD8\u5229\u6DA6\u3001\u5956\u52B1\u8D39\u3001\u8FDD\u7EA6\u91D1\u3001\u6EDE\u7EB3\u91D1\u3001\u5EF6\u671F\u4ED8\u6B3E\u5229\u606F\u3001\u8D54\u507F\u91D1\u3001\u4EE3\u6536\u6B3E\u9879\u3001\u4EE3\u57AB\u6B3E\u9879\u3001\u5305\u88C5\u8D39\u3001\u5305\u88C5\u7269\u79DF\u91D1\u3001\u50A8\u5907\u8D39\u3001\u4F18\u8D28\u8D39\u3001\u8FD0\u8F93\u88C5\u5378\u8D39\u4EE5\u53CA\u5176\u4ED6\u5404\u79CD\u6027\u8D28\u7684\u4EF7\u5916\u6536\u8D39\u3002"
          },
          {
            law: "\u300A\u4F01\u4E1A\u6240\u5F97\u7A0E\u6CD5\u300B",
            article: "\u7B2C\u516D\u6761",
            text: "\u4F01\u4E1A\u4EE5\u8D27\u5E01\u5F62\u5F0F\u548C\u975E\u8D27\u5E01\u5F62\u5F0F\u4ECE\u5404\u79CD\u6765\u6E90\u53D6\u5F97\u7684\u6536\u5165\uFF0C\u4E3A\u6536\u5165\u603B\u989D\u3002\u5305\u62EC\uFF1A\u9500\u552E\u8D27\u7269\u6536\u5165\uFF1B\u63D0\u4F9B\u52B3\u52A1\u6536\u5165\uFF1B\u8F6C\u8BA9\u8D22\u4EA7\u6536\u5165\uFF1B\u80A1\u606F\u3001\u7EA2\u5229\u7B49\u6743\u76CA\u6027\u6295\u8D44\u6536\u76CA\uFF1B\u5229\u606F\u6536\u5165\uFF1B\u79DF\u91D1\u6536\u5165\uFF1B\u7279\u8BB8\u6743\u4F7F\u7528\u8D39\u6536\u5165\uFF1B\u63A5\u53D7\u6350\u8D60\u6536\u5165\uFF1B\u5176\u4ED6\u6536\u5165\u3002"
          }
        ],
        tips: [
          '\u5173\u952E\u533A\u5206\uFF1A\u9500\u552E\u65B9\u6536\u53D6\u7684\u8FDD\u7EA6\u91D1\u662F"\u4EF7\u5916\u8D39\u7528"\u9700\u7F34\u589E\u503C\u7A0E\u5E76\u5F00\u7968\uFF1B\u91C7\u8D2D\u65B9\u6536\u53D6\u7684\u8FDD\u7EA6\u91D1\u56E0\u65E0\u9500\u552E\u884C\u4E3A\u4E0D\u5F81\u589E\u503C\u7A0E\uFF0C\u53EF\u5F00\u5177\u6536\u6B3E\u6536\u636E\u3002',
          "\u652F\u4ED8\u65B9\u53D6\u5F97\u8FDD\u7EA6\u91D1\u652F\u51FA\u7A0E\u524D\u6263\u9664\u65F6\uFF0C\u5E94\u5907\u9F50\u5408\u540C\u3001\u4ED8\u6B3E\u51ED\u8BC1\u3001\u6536\u6B3E\u65B9\u6536\u636E\u6216\u53D1\u7968\u7B49\u8D44\u6599\u3002",
          "\u589E\u503C\u7A0E\u4EF7\u5916\u8D39\u7528\u9700\u505A\u4EF7\u7A0E\u5206\u79BB\uFF0C\u76F4\u63A5\u7528\u8FDD\u7EA6\u91D1\u4E58\u7A0E\u7387\u4F1A\u591A\u7F34\u7A0E\u3002"
        ]
      };
    }
  },
  /* ── 社保公积金与用工成本 ── */
  {
    id: "social-insurance",
    name: "\u793E\u4FDD\u516C\u79EF\u91D1\u4E0E\u7528\u5DE5\u6210\u672C",
    category: "tax",
    glyph: "\u4FDD",
    summary: "\u4E94\u9669\u4E00\u91D1\u5355\u4F4D\u4E0E\u4E2A\u4EBA\u8D1F\u62C5\u6D4B\u7B97\uFF0C\u5F97\u51FA\u4F01\u4E1A\u5B9E\u9645\u7528\u5DE5\u603B\u6210\u672C",
    keywords: ["\u793E\u4FDD", "\u516C\u79EF\u91D1", "\u7528\u5DE5\u6210\u672C", "\u4E94\u9669\u4E00\u91D1"],
    fields: [
      { key: "salary", label: "\u6708\u5DE5\u8D44\uFF08\u5E94\u53D1\uFF09", type: "money", unit: "\u5143", defaultValue: 15e3 },
      { key: "base", label: "\u793E\u4FDD\u7F34\u8D39\u57FA\u6570", type: "money", unit: "\u5143", defaultValue: 15e3, hint: "\u6309\u5F53\u5730\u4E0A\u4E0B\u9650\u6838\u5B9A\uFF0C\u586B 0 \u8868\u793A\u540C\u5DE5\u8D44" },
      { key: "pensionE", label: "\u517B\u8001\u4FDD\u9669\u5355\u4F4D\u6BD4\u4F8B", type: "percent", unit: "%", defaultValue: 16 },
      { key: "medicalE", label: "\u533B\u7597\u4FDD\u9669\u5355\u4F4D\u6BD4\u4F8B", type: "percent", unit: "%", defaultValue: 8 },
      { key: "unemployE", label: "\u5931\u4E1A\u4FDD\u9669\u5355\u4F4D\u6BD4\u4F8B", type: "percent", unit: "%", defaultValue: 0.5 },
      { key: "injuryE", label: "\u5DE5\u4F24\u4FDD\u9669\u5355\u4F4D\u6BD4\u4F8B", type: "percent", unit: "%", defaultValue: 0.4 },
      { key: "maternityE", label: "\u751F\u80B2\u4FDD\u9669\u5355\u4F4D\u6BD4\u4F8B", type: "percent", unit: "%", defaultValue: 0.8 },
      { key: "fundE", label: "\u4F4F\u623F\u516C\u79EF\u91D1\u5355\u4F4D\u6BD4\u4F8B", type: "percent", unit: "%", defaultValue: 12 },
      { key: "fundP", label: "\u4F4F\u623F\u516C\u79EF\u91D1\u4E2A\u4EBA\u6BD4\u4F8B", type: "percent", unit: "%", defaultValue: 12 },
      { key: "months", label: "\u8BA1\u7B97\u6708\u6570", type: "number", unit: "\u6708", defaultValue: 12 }
    ],
    calc(values) {
      const salary = toNum(values.salary);
      let base = toNum(values.base) || salary;
      const months = Math.max(1, toNum(values.months, 12));
      const items = [
        { name: "\u517B\u8001\u4FDD\u9669", e: toNum(values.pensionE), p: 8 },
        { name: "\u533B\u7597\u4FDD\u9669", e: toNum(values.medicalE), p: 2 },
        { name: "\u5931\u4E1A\u4FDD\u9669", e: toNum(values.unemployE), p: 0.5 },
        { name: "\u5DE5\u4F24\u4FDD\u9669", e: toNum(values.injuryE), p: 0 },
        { name: "\u751F\u80B2\u4FDD\u9669", e: toNum(values.maternityE), p: 0 },
        { name: "\u4F4F\u623F\u516C\u79EF\u91D1", e: toNum(values.fundE), p: toNum(values.fundP) }
      ];
      const steps = [{ label: "\u7F34\u8D39\u57FA\u6570", value: `${money(base)} \u5143` }];
      let eTotal = 0;
      let pTotal = 0;
      items.forEach((it) => {
        const e = round(base * (it.e / 100), 2);
        const p = round(base * (it.p / 100), 2);
        eTotal = round(eTotal + e, 2);
        pTotal = round(pTotal + p, 2);
        steps.push({
          label: it.name,
          value: `\u5355\u4F4D ${money(e)}\uFF08${it.e}%\uFF09+ \u4E2A\u4EBA ${money(p)}\uFF08${it.p}%\uFF09= ${money(round(e + p, 2))} \u5143`
        });
      });
      steps.push({ label: "\u5355\u4F4D\u8D1F\u62C5\u5408\u8BA1\uFF08\u6708\uFF09", value: `${money(eTotal)} \u5143`, emphasis: true });
      steps.push({ label: "\u4E2A\u4EBA\u8D1F\u62C5\u5408\u8BA1\uFF08\u6708\uFF09", value: `${money(pTotal)} \u5143`, emphasis: true });
      const employerCost = round(salary + eTotal, 2);
      steps.push({
        label: "\u4F01\u4E1A\u5B9E\u9645\u7528\u5DE5\u6210\u672C\uFF08\u6708\uFF09",
        value: `${money(salary)} + ${money(eTotal)} = ${money(employerCost)} \u5143`,
        emphasis: true
      });
      const netPay = round(salary - pTotal, 2);
      steps.push({ label: "\u5458\u5DE5\u5B9E\u53D1\uFF08\u672A\u6263\u4E2A\u7A0E\uFF09", value: `${money(salary)} \u2212 ${money(pTotal)} = ${money(netPay)} \u5143`, note: "\u5C1A\u672A\u6263\u51CF\u4E2A\u4EBA\u6240\u5F97\u7A0E" });
      const yearCost = round(employerCost * months, 2);
      steps.push({ label: `\u5E74\u5EA6\u7528\u5DE5\u6210\u672C\uFF08${months} \u4E2A\u6708\uFF09`, value: `${money(yearCost)} \u5143`, emphasis: true });
      return {
        main: { label: "\u4F01\u4E1A\u6708\u7528\u5DE5\u603B\u6210\u672C", value: money(employerCost), unit: "\u5143", sub: moneyToChinese(employerCost) },
        blocks: [
          { label: "\u5355\u4F4D\u793E\u4FDD\u516C\u79EF\u91D1\uFF08\u6708\uFF09", value: money(eTotal), unit: "\u5143" },
          { label: "\u4E2A\u4EBA\u793E\u4FDD\u516C\u79EF\u91D1\uFF08\u6708\uFF09", value: money(pTotal), unit: "\u5143" },
          { label: "\u5458\u5DE5\u5B9E\u53D1\uFF08\u672A\u6263\u4E2A\u7A0E\uFF09", value: money(netPay), unit: "\u5143" },
          { label: "\u4E94\u9669\u4E00\u91D1\u5360\u5DE5\u8D44\u6BD4\uFF08\u5355\u4F4D\u4FA7\uFF09", value: `${(eTotal / Math.max(salary, 1) * 100).toFixed(2)}%` },
          { label: `\u5E74\u5EA6\u7528\u5DE5\u6210\u672C\uFF08${months} \u4E2A\u6708\uFF09`, value: money(yearCost), unit: "\u5143" }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u793E\u4F1A\u4FDD\u9669\u6CD5\u300B",
            article: "\u7B2C\u4E94\u5341\u516B\u6761",
            text: "\u7528\u4EBA\u5355\u4F4D\u5E94\u5F53\u81EA\u7528\u5DE5\u4E4B\u65E5\u8D77\u4E09\u5341\u65E5\u5185\u4E3A\u5176\u804C\u5DE5\u5411\u793E\u4F1A\u4FDD\u9669\u7ECF\u529E\u673A\u6784\u7533\u8BF7\u529E\u7406\u793E\u4F1A\u4FDD\u9669\u767B\u8BB0\u3002\u672A\u529E\u7406\u793E\u4F1A\u4FDD\u9669\u767B\u8BB0\u7684\uFF0C\u7531\u793E\u4F1A\u4FDD\u9669\u7ECF\u529E\u673A\u6784\u6838\u5B9A\u5176\u5E94\u5F53\u7F34\u7EB3\u7684\u793E\u4F1A\u4FDD\u9669\u8D39\u3002"
          },
          {
            law: "\u300A\u4F4F\u623F\u516C\u79EF\u91D1\u7BA1\u7406\u6761\u4F8B\u300B",
            article: "\u7B2C\u5341\u516D\u6761",
            text: "\u804C\u5DE5\u4F4F\u623F\u516C\u79EF\u91D1\u7684\u6708\u7F34\u5B58\u989D\u4E3A\u804C\u5DE5\u672C\u4EBA\u4E0A\u4E00\u5E74\u5EA6\u6708\u5E73\u5747\u5DE5\u8D44\u4E58\u4EE5\u804C\u5DE5\u4F4F\u623F\u516C\u79EF\u91D1\u7F34\u5B58\u6BD4\u4F8B\u3002\u5355\u4F4D\u4E3A\u804C\u5DE5\u7F34\u5B58\u7684\u4F4F\u623F\u516C\u79EF\u91D1\u7684\u6708\u7F34\u5B58\u989D\u4E3A\u804C\u5DE5\u672C\u4EBA\u4E0A\u4E00\u5E74\u5EA6\u6708\u5E73\u5747\u5DE5\u8D44\u4E58\u4EE5\u5355\u4F4D\u4F4F\u623F\u516C\u79EF\u91D1\u7F34\u5B58\u6BD4\u4F8B\u3002"
          }
        ],
        tips: [
          "\u5404\u5730\u793E\u4FDD\u8D39\u7387\u3001\u7F34\u8D39\u57FA\u6570\u4E0A\u4E0B\u9650\u5DEE\u5F02\u8F83\u5927\uFF0C\u8BF7\u6309\u53C2\u4FDD\u5730\u5F53\u5E74\u516C\u5E03\u7684\u53C2\u6570\u8C03\u6574\u3002",
          "\u751F\u80B2\u4FDD\u9669\u5728\u591A\u6570\u5730\u533A\u5DF2\u5E76\u5165\u533B\u7597\u4FDD\u9669\uFF0C\u5408\u5E76\u8BA1\u7B97\u5373\u53EF\uFF0C\u4E0D\u5FC5\u5355\u72EC\u586B\u5217\u3002",
          "\u7528\u5DE5\u6210\u672C\u901A\u5E38\u6BD4\u540D\u4E49\u5DE5\u8D44\u9AD8\u51FA 30%\u201445%\uFF0C\u88C1\u5458\u8D54\u507F\u3001\u62DB\u8058\u9884\u7B97\u6D4B\u7B97\u65F6\u52A1\u5FC5\u6309\u5168\u53E3\u5F84\u6210\u672C\u8BA1\u7B97\u3002",
          "\u672A\u8DB3\u989D\u7F34\u7EB3\u793E\u4FDD\u7684\uFF0C\u52B3\u52A8\u8005\u53EF\u636E\u6B64\u88AB\u8FEB\u89E3\u9664\u52B3\u52A8\u5408\u540C\u5E76\u4E3B\u5F20\u7ECF\u6D4E\u8865\u507F\uFF0C\u662F\u9AD8\u9891\u8D25\u8BC9\u98CE\u9669\u70B9\u3002"
        ]
      };
    }
  }
];

// src/core/calculators/travel.ts
var LODGING_STANDARD = {
  \u5317\u4EAC: [1100, 650, 500],
  \u4E0A\u6D77: [1100, 600, 500],
  \u5E7F\u5DDE: [900, 550, 450],
  \u6DF1\u5733: [900, 550, 450],
  \u5929\u6D25: [800, 480, 380],
  \u91CD\u5E86: [800, 480, 370],
  \u5357\u4EAC: [900, 490, 380],
  \u676D\u5DDE: [900, 500, 400],
  \u6210\u90FD: [750, 470, 370],
  \u6B66\u6C49: [800, 480, 350],
  \u897F\u5B89: [800, 460, 350],
  \u6D4E\u5357: [800, 480, 380],
  \u9752\u5C9B: [800, 490, 380],
  \u798F\u5DDE: [800, 480, 380],
  \u53A6\u95E8: [800, 490, 400],
  \u90D1\u5DDE: [800, 480, 380],
  \u957F\u6C99: [800, 450, 350],
  \u5408\u80A5: [800, 460, 350],
  \u6C88\u9633: [800, 480, 350],
  \u5927\u8FDE: [800, 490, 350],
  \u77F3\u5BB6\u5E84: [800, 450, 350],
  \u6606\u660E: [800, 480, 380],
  \u5357\u660C: [800, 470, 350],
  \u5357\u5B81: [800, 470, 350],
  \u592A\u539F: [800, 460, 350],
  \u8D35\u9633: [750, 450, 350],
  \u54C8\u5C14\u6EE8: [750, 450, 350],
  \u957F\u6625: [750, 450, 350],
  \u5170\u5DDE: [700, 450, 330],
  \u547C\u548C\u6D69\u7279: [700, 450, 350],
  \u4E4C\u9C81\u6728\u9F50: [700, 450, 350],
  \u6D77\u53E3: [800, 500, 350],
  \u62C9\u8428: [800, 500, 350],
  \u897F\u5B81: [700, 450, 350],
  \u94F6\u5DDD: [700, 450, 350],
  \u5176\u4ED6\u5730\u533A: [700, 450, 330]
};
var MEAL_ALLOWANCE = 100;
var LOCAL_TRANSPORT = 80;
var CITY_OPTIONS = Object.keys(LODGING_STANDARD).map((c) => ({ label: c, value: c }));
var LEVEL_OPTIONS = [
  { label: "\u90E8\u7EA7 / \u76F8\u5F53\u804C\u52A1\u4EBA\u5458", value: "0" },
  { label: "\u53F8\u5C40\u7EA7 / \u76F8\u5F53\u804C\u52A1\u4EBA\u5458", value: "1" },
  { label: "\u5176\u4ED6\u4EBA\u5458", value: "2" }
];
var travelCalculators = [
  /* ── 差旅补贴标准 ── */
  {
    id: "travel-allowance",
    name: "\u5DEE\u65C5\u8865\u8D34\u6807\u51C6",
    category: "travel",
    glyph: "\u5DEE",
    summary: "\u4F19\u98DF\u8865\u52A9 + \u5E02\u5185\u4EA4\u901A + \u4F4F\u5BBF\u6807\u51C6\u7684\u6BCF\u65E5\u8865\u8D34\u6D4B\u7B97",
    keywords: ["\u5DEE\u65C5\u8D39", "\u51FA\u5DEE\u8865\u8D34", "\u4F19\u98DF\u8865\u52A9", "\u4F4F\u5BBF\u6807\u51C6"],
    fields: [
      { key: "city", label: "\u51FA\u5DEE\u76EE\u7684\u5730", type: "select", defaultValue: "\u5317\u4EAC", options: CITY_OPTIONS },
      { key: "level", label: "\u4EBA\u5458\u7EA7\u522B", type: "select", defaultValue: "2", options: LEVEL_OPTIONS },
      { key: "days", label: "\u51FA\u5DEE\u5929\u6570", type: "number", unit: "\u5929", defaultValue: 3 },
      { key: "people", label: "\u51FA\u5DEE\u4EBA\u6570", type: "number", unit: "\u4EBA", defaultValue: 2 },
      {
        key: "provideMeal",
        label: "\u63A5\u5F85\u5355\u4F4D\u662F\u5426\u5B89\u6392\u7528\u9910",
        type: "switch",
        defaultValue: false,
        hint: "\u7531\u63A5\u5F85\u5355\u4F4D\u7EDF\u4E00\u5B89\u6392\u7528\u9910\u7684\uFF0C\u4E0D\u518D\u53D1\u653E\u4F19\u98DF\u8865\u52A9"
      },
      {
        key: "provideTransport",
        label: "\u662F\u5426\u7531\u63A5\u5F85\u5355\u4F4D\u63D0\u4F9B\u4EA4\u901A\u5DE5\u5177",
        type: "switch",
        defaultValue: false,
        hint: "\u7531\u63A5\u5F85\u5355\u4F4D\u63D0\u4F9B\u4EA4\u901A\u5DE5\u5177\u7684\uFF0C\u4E0D\u518D\u53D1\u653E\u5E02\u5185\u4EA4\u901A\u8D39"
      },
      {
        key: "customLodging",
        label: "\u81EA\u5B9A\u4E49\u4F4F\u5BBF\u6807\u51C6\uFF08\u5143/\u5929\uFF09",
        type: "money",
        unit: "\u5143",
        defaultValue: 0,
        hint: "\u586B 0 \u8868\u793A\u9002\u7528\u5185\u7F6E\u6807\u51C6\uFF1B\u4F01\u4E1A\u81EA\u5B9A\u6807\u51C6\u8BF7\u586B\u6B64\u680F"
      }
    ],
    calc(values) {
      const city = toStr(values.city, "\u5317\u4EAC");
      const levelIdx = Math.min(2, Math.max(0, Math.round(toNum(values.level, 2))));
      const days = Math.max(0, toNum(values.days));
      const people = Math.max(1, toNum(values.people));
      const provideMeal = values.provideMeal === true || values.provideMeal === "true";
      const provideTransport = values.provideTransport === true || values.provideTransport === "true";
      const custom = toNum(values.customLodging);
      const std = LODGING_STANDARD[city] ?? LODGING_STANDARD["\u5176\u4ED6\u5730\u533A"];
      const lodgingPerDay = custom > 0 ? custom : std[levelIdx];
      const steps = [
        { label: "\u76EE\u7684\u5730\u4E0E\u7EA7\u522B", value: `${city} / ${LEVEL_OPTIONS[levelIdx].label}` },
        { label: "\u4F4F\u5BBF\u8D39\u6807\u51C6", value: custom > 0 ? `${money(lodgingPerDay)} \u5143/\u5929\uFF08\u81EA\u5B9A\u4E49\uFF09` : `${money(lodgingPerDay)} \u5143/\u5929\uFF08\u5185\u7F6E\u6807\u51C6\uFF09` }
      ];
      const lodging = round(lodgingPerDay * days * people, 2);
      steps.push({ label: "\u4F4F\u5BBF\u8D39\u5C0F\u8BA1", value: `${money(lodgingPerDay)} \xD7 ${days} \u5929 \xD7 ${people} \u4EBA = ${money(lodging)} \u5143` });
      const meal = provideMeal ? 0 : round(MEAL_ALLOWANCE * days * people, 2);
      steps.push({
        label: "\u4F19\u98DF\u8865\u52A9\u8D39",
        value: provideMeal ? "0 \u5143\uFF08\u63A5\u5F85\u5355\u4F4D\u5DF2\u5B89\u6392\u7528\u9910\uFF09" : `${MEAL_ALLOWANCE} \xD7 ${days} \u5929 \xD7 ${people} \u4EBA = ${money(meal)} \u5143`
      });
      const transport = provideTransport ? 0 : round(LOCAL_TRANSPORT * days * people, 2);
      steps.push({
        label: "\u5E02\u5185\u4EA4\u901A\u8D39",
        value: provideTransport ? "0 \u5143\uFF08\u63A5\u5F85\u5355\u4F4D\u5DF2\u63D0\u4F9B\u4EA4\u901A\u5DE5\u5177\uFF09" : `${LOCAL_TRANSPORT} \xD7 ${days} \u5929 \xD7 ${people} \u4EBA = ${money(transport)} \u5143`
      });
      const total = round(lodging + meal + transport, 2);
      steps.push({ label: "\u5DEE\u65C5\u8865\u8D34\u5408\u8BA1", value: `${money(total)} \u5143`, emphasis: true });
      const perPerson = round(total / people, 2);
      steps.push({ label: "\u4EBA\u5747\u6807\u51C6", value: `${money(perPerson)} \u5143` });
      return {
        main: { label: "\u5DEE\u65C5\u8865\u8D34\u5408\u8BA1", value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        blocks: [
          { label: "\u4F4F\u5BBF\u8D39", value: money(lodging), unit: "\u5143" },
          { label: "\u4F19\u98DF\u8865\u52A9\u8D39", value: money(meal), unit: "\u5143" },
          { label: "\u5E02\u5185\u4EA4\u901A\u8D39", value: money(transport), unit: "\u5143" },
          { label: "\u4EBA\u5747 / \u6BCF\u5929", value: money(round(total / Math.max(days * people, 1), 2)), unit: "\u5143" }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u4E2D\u592E\u548C\u56FD\u5BB6\u673A\u5173\u5DEE\u65C5\u8D39\u7BA1\u7406\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u4E03\u6761",
            text: "\u4F19\u98DF\u8865\u52A9\u8D39\u6309\u51FA\u5DEE\u81EA\u7136\uFF08\u65E5\u5386\uFF09\u5929\u6570\u8BA1\u7B97\uFF0C\u6309\u89C4\u5B9A\u6807\u51C6\u5305\u5E72\u4F7F\u7528\u3002"
          },
          {
            law: "\u300A\u4E2D\u592E\u548C\u56FD\u5BB6\u673A\u5173\u5DEE\u65C5\u8D39\u7BA1\u7406\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u516B\u6761",
            text: "\u5E02\u5185\u4EA4\u901A\u8D39\u6309\u51FA\u5DEE\u81EA\u7136\uFF08\u65E5\u5386\uFF09\u5929\u6570\u8BA1\u7B97\uFF0C\u6BCF\u4EBA\u6BCF\u592980\u5143\u5305\u5E72\u4F7F\u7528\u3002"
          }
        ],
        tips: [
          '\u4F19\u98DF\u8865\u52A9\u8D39\u4E0E\u5E02\u5185\u4EA4\u901A\u8D39\u6309"\u51FA\u5DEE\u81EA\u7136\u5929\u6570"\u5305\u5E72\u53D1\u653E\uFF0C\u4E0D\u9700\u8981\u63D0\u4F9B\u7968\u636E\uFF0C\u8FD9\u662F\u6700\u5BB9\u6613\u6F0F\u7B97\u7684\u90E8\u5206\u3002',
          "\u7531\u63A5\u5F85\u5355\u4F4D\u5B89\u6392\u7528\u9910\u6216\u63D0\u4F9B\u4EA4\u901A\u5DE5\u5177\u7684\uFF0C\u76F8\u5E94\u8865\u52A9\u4E0D\u4E88\u53D1\u653E\uFF0C\u5982\u5B9E\u7533\u62A5\u53EF\u907F\u514D\u8FDD\u89C4\u98CE\u9669\u3002",
          "\u4F01\u4E1A\u53EF\u81EA\u884C\u5236\u5B9A\u5DEE\u65C5\u6807\u51C6\uFF0C\u6807\u51C6\u5185\u4E14\u53D6\u5F97\u5408\u89C4\u53D1\u7968\u7684\u652F\u51FA\u53EF\u5168\u989D\u7A0E\u524D\u6263\u9664\u3002"
        ]
      };
    }
  },
  /* ── 差旅报销核算 ── */
  {
    id: "travel-reimburse",
    name: "\u5DEE\u65C5\u62A5\u9500\u6838\u7B97",
    category: "travel",
    glyph: "\u62A5",
    summary: "\u5B9E\u9645\u652F\u51FA\u4E0E\u6807\u51C6\u5BF9\u6BD4\uFF0C\u8BC6\u522B\u8D85\u6807\u51C6\u4E0D\u4E88\u62A5\u9500\u90E8\u5206",
    keywords: ["\u62A5\u9500", "\u5DEE\u65C5\u62A5\u9500", "\u8D85\u6807\u51C6", "\u8D39\u7528\u5BA1\u6838"],
    fields: [
      { key: "city", label: "\u51FA\u5DEE\u76EE\u7684\u5730", type: "select", defaultValue: "\u4E0A\u6D77", options: CITY_OPTIONS },
      { key: "level", label: "\u4EBA\u5458\u7EA7\u522B", type: "select", defaultValue: "2", options: LEVEL_OPTIONS },
      { key: "days", label: "\u51FA\u5DEE\u5929\u6570", type: "number", unit: "\u5929", defaultValue: 3 },
      { key: "intercity", label: "\u57CE\u5E02\u95F4\u4EA4\u901A\u8D39\uFF08\u5F80\u8FD4\uFF09", type: "money", unit: "\u5143", defaultValue: 2500 },
      { key: "actualLodging", label: "\u5B9E\u9645\u4F4F\u5BBF\u8D39\u603B\u989D", type: "money", unit: "\u5143", defaultValue: 1800 },
      { key: "actualMeal", label: "\u5B9E\u9645\u9910\u8D39\u652F\u51FA", type: "money", unit: "\u5143", defaultValue: 600, hint: "\u5305\u5E72\u8865\u52A9\u5236\u4E0B\u6B64\u9879\u901A\u5E38\u4E0D\u4E88\u53E6\u884C\u62A5\u9500" },
      { key: "actualLocal", label: "\u5B9E\u9645\u5E02\u5185\u4EA4\u901A\u652F\u51FA", type: "money", unit: "\u5143", defaultValue: 300 },
      {
        key: "policy",
        label: "\u62A5\u9500\u653F\u7B56",
        type: "select",
        defaultValue: "standard",
        options: [
          { label: "\u4F4F\u5BBF\u636E\u5B9E\u62A5\u9500\uFF08\u4E0D\u8D85\u6807\u51C6\uFF09+ \u8865\u8D34\u5305\u5E72", value: "standard" },
          { label: "\u4F4F\u5BBF\u4E0E\u9910\u8D39\u5747\u636E\u5B9E\u62A5\u9500\uFF08\u4E0D\u53D1\u5305\u5E72\u8865\u52A9\uFF09", value: "actual" },
          { label: "\u5168\u90E8\u5305\u5E72\uFF08\u6309\u6807\u51C6\u53D1\u653E\uFF0C\u4E0D\u5BA1\u7968\u636E\uFF09", value: "lumpsum" }
        ]
      }
    ],
    calc(values) {
      const city = toStr(values.city, "\u4E0A\u6D77");
      const levelIdx = Math.min(2, Math.max(0, Math.round(toNum(values.level, 2))));
      const days = Math.max(0, toNum(values.days));
      const intercity = toNum(values.intercity);
      const actualLodging = toNum(values.actualLodging);
      const actualMeal = toNum(values.actualMeal);
      const actualLocal = toNum(values.actualLocal);
      const policy = toStr(values.policy, "standard");
      const std = LODGING_STANDARD[city] ?? LODGING_STANDARD["\u5176\u4ED6\u5730\u533A"];
      const lodgingPerDay = std[levelIdx];
      const lodgingCap = round(lodgingPerDay * days, 2);
      const steps = [
        { label: "\u76EE\u7684\u5730\u4E0E\u4F4F\u5BBF\u6807\u51C6", value: `${city} / ${money(lodgingPerDay)} \u5143/\u5929` },
        { label: "\u4F4F\u5BBF\u8D39\u4E0A\u9650", value: `${money(lodgingPerDay)} \xD7 ${days} \u5929 = ${money(lodgingCap)} \u5143` }
      ];
      let reimbursable = 0;
      let selfPaid = 0;
      reimbursable = round(reimbursable + intercity, 2);
      steps.push({ label: "\u57CE\u5E02\u95F4\u4EA4\u901A\u8D39\uFF08\u636E\u5B9E\uFF09", value: `${money(intercity)} \u5143` });
      if (policy === "lumpsum") {
        const lodging = Math.min(actualLodging, lodgingCap);
        const meal = MEAL_ALLOWANCE * days;
        const local = LOCAL_TRANSPORT * days;
        reimbursable = round(reimbursable + lodging + meal + local, 2);
        selfPaid = round(Math.max(0, actualLodging - lodgingCap) + Math.max(0, actualMeal - meal) + Math.max(0, actualLocal - local), 2);
        steps.push({ label: "\u5168\u90E8\u5305\u5E72\u6A21\u5F0F", value: `\u4F4F\u5BBF ${money(lodging)} + \u4F19\u98DF ${money(meal)} + \u5E02\u5185\u4EA4\u901A ${money(local)} \u5143` });
      } else if (policy === "actual") {
        const lodging = Math.min(actualLodging, lodgingCap);
        const meal = Math.min(actualMeal, MEAL_ALLOWANCE * days);
        reimbursable = round(reimbursable + lodging + meal, 2);
        selfPaid = round(Math.max(0, actualLodging - lodgingCap) + Math.max(0, actualMeal - MEAL_ALLOWANCE * days) + actualLocal, 2);
        steps.push({ label: "\u636E\u5B9E\u62A5\u9500\u6A21\u5F0F", value: `\u4F4F\u5BBF ${money(lodging)}\uFF08\u4E0A\u9650 ${money(lodgingCap)}\uFF09+ \u9910\u8D39 ${money(meal)}\uFF08\u4E0A\u9650 ${money(MEAL_ALLOWANCE * days)}\uFF09` });
        steps.push({ label: "\u5E02\u5185\u4EA4\u901A", value: `${money(actualLocal)} \u5143\uFF08\u636E\u5B9E\u6A21\u5F0F\u4E0B\u5E02\u5185\u4EA4\u901A\u901A\u5E38\u5E76\u5165\u9910\u8D39\u6807\u51C6\u6216\u4E0D\u4E88\u62A5\u9500\uFF09` });
      } else {
        const lodging = Math.min(actualLodging, lodgingCap);
        const meal = MEAL_ALLOWANCE * days;
        const local = LOCAL_TRANSPORT * days;
        reimbursable = round(reimbursable + lodging + meal + local, 2);
        selfPaid = round(Math.max(0, actualLodging - lodgingCap) + actualMeal + Math.max(0, actualLocal - local), 2);
        steps.push({ label: "\u4F4F\u5BBF\uFF08\u636E\u5B9E\uFF0C\u4E0D\u8D85\u6807\u51C6\uFF09", value: `${money(lodging)} \u5143`, note: actualLodging > lodgingCap ? `\u5B9E\u9645 ${money(actualLodging)} \u5143\uFF0C\u8D85\u6807\u51C6\u90E8\u5206\u81EA\u7406` : "\u672A\u8D85\u6807\u51C6" });
        steps.push({ label: "\u4F19\u98DF\u8865\u52A9\uFF08\u5305\u5E72\uFF09", value: `${money(meal)} \u5143`, note: "\u5305\u5E72\u53D1\u653E\u540E\u9910\u8D39\u7968\u636E\u4E0D\u518D\u62A5\u9500" });
        steps.push({ label: "\u5E02\u5185\u4EA4\u901A\uFF08\u5305\u5E72\uFF09", value: `${money(local)} \u5143` });
      }
      const actualTotal = round(intercity + actualLodging + actualMeal + actualLocal, 2);
      steps.push({ label: "\u5B9E\u9645\u652F\u51FA\u603B\u989D", value: `${money(actualTotal)} \u5143` });
      steps.push({ label: "\u53EF\u62A5\u9500\u91D1\u989D", value: `${money(reimbursable)} \u5143`, emphasis: true });
      steps.push({
        label: "\u9700\u4E2A\u4EBA\u627F\u62C5",
        value: `${money(selfPaid)} \u5143`,
        note: selfPaid > 0 ? "\u4E3B\u8981\u4E3A\u8D85\u6807\u51C6\u4F4F\u5BBF\u53CA\u5305\u5E72\u5916\u7968\u636E" : "\u65E0\u8D85\u6807\u51C6\u652F\u51FA",
        emphasis: true
      });
      return {
        main: { label: "\u53EF\u62A5\u9500\u91D1\u989D", value: money(reimbursable), unit: "\u5143", sub: moneyToChinese(reimbursable) },
        blocks: [
          { label: "\u5B9E\u9645\u652F\u51FA\u603B\u989D", value: money(actualTotal), unit: "\u5143" },
          { label: "\u9700\u4E2A\u4EBA\u627F\u62C5", value: money(selfPaid), unit: "\u5143", sub: `${(selfPaid / Math.max(actualTotal, 1) * 100).toFixed(2)}%` },
          { label: "\u4F4F\u5BBF\u8D39\u6807\u51C6\u4E0A\u9650", value: money(lodgingCap), unit: "\u5143" },
          { label: "\u62A5\u9500\u6BD4\u4F8B", value: `${(reimbursable / Math.max(actualTotal, 1) * 100).toFixed(2)}%` }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u4E2D\u592E\u548C\u56FD\u5BB6\u673A\u5173\u5DEE\u65C5\u8D39\u7BA1\u7406\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u4E8C\u6761",
            text: "\u5DEE\u65C5\u8D39\u5F00\u652F\u8303\u56F4\u5305\u62EC\u57CE\u5E02\u95F4\u4EA4\u901A\u8D39\u3001\u4F4F\u5BBF\u8D39\u3001\u4F19\u98DF\u8865\u52A9\u8D39\u548C\u5E02\u5185\u4EA4\u901A\u8D39\u3002"
          },
          {
            law: "\u300A\u4E2D\u592E\u548C\u56FD\u5BB6\u673A\u5173\u5DEE\u65C5\u8D39\u7BA1\u7406\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u56DB\u6761",
            text: "\u51FA\u5DEE\u4EBA\u5458\u5E94\u5F53\u5728\u804C\u52A1\u7EA7\u522B\u5BF9\u5E94\u7684\u4F4F\u5BBF\u8D39\u6807\u51C6\u9650\u989D\u5185\uFF0C\u9009\u62E9\u5B89\u5168\u3001\u7ECF\u6D4E\u3001\u4FBF\u6377\u7684\u5BBE\u9986\u4F4F\u5BBF\u3002"
          }
        ],
        tips: [
          '\u6700\u5E38\u89C1\u7684\u62A5\u9500\u4E89\u8BAE\u662F"\u4F4F\u5BBF\u8D85\u6807\u51C6"\uFF0C\u51FA\u5DEE\u524D\u5E94\u5148\u786E\u8BA4\u76EE\u7684\u5730\u5F53\u5B63\u9650\u4EF7\uFF0C\u65FA\u5B63\u53EF\u4E0A\u6D6E\u7684\u5730\u533A\u9700\u63D0\u524D\u62A5\u6279\u3002',
          "\u5305\u5E72\u5236\u4E0B\u4F19\u98DF\u8865\u52A9\u4E0E\u5E02\u5185\u4EA4\u901A\u65E0\u9700\u7968\u636E\uFF0C\u4F46\u7968\u636E\u62A5\u9500\u4E0E\u5305\u5E72\u8865\u52A9\u4E0D\u80FD\u91CD\u590D\u4EAB\u53D7\u3002",
          '\u4F01\u4E1A\u5DEE\u65C5\u6807\u51C6\u9AD8\u4E8E\u56FD\u5BB6\u673A\u5173\u6807\u51C6\u7684\uFF0C\u8D85\u51FA\u90E8\u5206\u7684\u7A0E\u524D\u6263\u9664\u4ECD\u4EE5"\u5408\u7406\u652F\u51FA"\u4E3A\u9650\uFF0C\u5EFA\u8BAE\u5236\u5EA6\u4E2D\u660E\u786E\u6807\u51C6\u3002'
        ]
      };
    }
  },
  /* ── 年度差旅预算 ── */
  {
    id: "travel-budget",
    name: "\u5E74\u5EA6\u5DEE\u65C5\u9884\u7B97",
    category: "travel",
    glyph: "\u9884",
    summary: "\u6309\u51FA\u5DEE\u9891\u6B21\u4E0E\u4EBA\u5747\u6807\u51C6\u6D4B\u7B97\u5E74\u5EA6\u5DEE\u65C5\u8D39\u603B\u989D\u4E0E\u964D\u672C\u7A7A\u95F4",
    keywords: ["\u5DEE\u65C5\u9884\u7B97", "\u5E74\u5EA6\u9884\u7B97", "\u5DEE\u65C5\u6210\u672C", "\u964D\u672C"],
    fields: [
      { key: "trips", label: "\u5E74\u5EA6\u51FA\u5DEE\u4EBA\u6B21", type: "number", unit: "\u4EBA\u6B21", defaultValue: 120 },
      { key: "avgDays", label: "\u4EBA\u5747\u6BCF\u6B21\u5929\u6570", type: "number", unit: "\u5929", defaultValue: 2.5 },
      { key: "avgIntercity", label: "\u4EBA\u5747\u5F80\u8FD4\u4EA4\u901A\u8D39", type: "money", unit: "\u5143", defaultValue: 2200 },
      { key: "avgLodging", label: "\u4EBA\u5747\u4F4F\u5BBF\u8D39\uFF08\u5143/\u5929\uFF09", type: "money", unit: "\u5143", defaultValue: 450 },
      { key: "mealStd", label: "\u4F19\u98DF\u8865\u52A9\uFF08\u5143/\u5929\uFF09", type: "money", unit: "\u5143", defaultValue: 100 },
      { key: "localStd", label: "\u5E02\u5185\u4EA4\u901A\uFF08\u5143/\u5929\uFF09", type: "money", unit: "\u5143", defaultValue: 80 },
      {
        key: "optimize",
        label: "\u6D4B\u7B97\u964D\u672C\u65B9\u6848",
        type: "switch",
        defaultValue: true
      },
      {
        key: "optRate",
        label: "\u9884\u671F\u964D\u672C\u6BD4\u4F8B",
        type: "percent",
        unit: "%",
        defaultValue: 15,
        hint: "\u901A\u8FC7\u534F\u8BAE\u9152\u5E97\u3001\u63D0\u524D\u8D2D\u7968\u3001\u7EBF\u4E0A\u4F1A\u8BAE\u66FF\u4EE3\u7B49\u65B9\u5F0F",
        visibleWhen: (v) => v.optimize === true || v.optimize === "true"
      }
    ],
    calc(values) {
      const trips = Math.max(0, toNum(values.trips));
      const avgDays = toNum(values.avgDays);
      const intercity = toNum(values.avgIntercity);
      const lodgingPerDay = toNum(values.avgLodging);
      const meal = toNum(values.mealStd);
      const local = toNum(values.localStd);
      const optimize = values.optimize === true || values.optimize === "true";
      const optRate = toNum(values.optRate) / 100;
      const totalDays = round(trips * avgDays, 2);
      const steps = [{ label: "\u5E74\u5EA6\u51FA\u5DEE\u603B\u5929\u6570", value: `${trips} \u4EBA\u6B21 \xD7 ${avgDays} \u5929 = ${totalDays} \u5929` }];
      const intercityTotal = round(trips * intercity, 2);
      steps.push({ label: "\u57CE\u5E02\u95F4\u4EA4\u901A\u8D39", value: `${trips} \xD7 ${money(intercity)} = ${money(intercityTotal)} \u5143` });
      const lodgingTotal = round(totalDays * lodgingPerDay, 2);
      steps.push({ label: "\u4F4F\u5BBF\u8D39", value: `${totalDays} \u5929 \xD7 ${money(lodgingPerDay)} = ${money(lodgingTotal)} \u5143` });
      const mealTotal = round(totalDays * meal, 2);
      steps.push({ label: "\u4F19\u98DF\u8865\u52A9", value: `${totalDays} \u5929 \xD7 ${money(meal)} = ${money(mealTotal)} \u5143` });
      const localTotal = round(totalDays * local, 2);
      steps.push({ label: "\u5E02\u5185\u4EA4\u901A\u8D39", value: `${totalDays} \u5929 \xD7 ${money(local)} = ${money(localTotal)} \u5143` });
      const total = round(intercityTotal + lodgingTotal + mealTotal + localTotal, 2);
      steps.push({ label: "\u5E74\u5EA6\u5DEE\u65C5\u8D39\u603B\u989D", value: `${money(total)} \u5143`, emphasis: true });
      const perTrip = round(total / Math.max(trips, 1), 2);
      steps.push({ label: "\u5355\u6B21\u4EBA\u5747\u6210\u672C", value: `${money(perTrip)} \u5143` });
      let saving = 0;
      if (optimize) {
        saving = round(total * optRate, 2);
        steps.push({
          label: `\u964D\u672C\u6D4B\u7B97\uFF08${toNum(values.optRate)}%\uFF09`,
          value: `${money(total)} \xD7 ${toNum(values.optRate)}% = ${money(saving)} \u5143`,
          emphasis: true
        });
        steps.push({ label: "\u4F18\u5316\u540E\u9884\u7B97", value: `${money(round(total - saving, 2))} \u5143`, emphasis: true });
      }
      return {
        main: { label: "\u5E74\u5EA6\u5DEE\u65C5\u8D39\u9884\u7B97", value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        blocks: [
          { label: "\u5355\u6B21\u4EBA\u5747\u6210\u672C", value: money(perTrip), unit: "\u5143" },
          { label: "\u5E74\u5EA6\u51FA\u5DEE\u603B\u5929\u6570", value: `${totalDays} \u5929` },
          { label: "\u4F4F\u5BBF\u8D39\u5360\u6BD4", value: `${(lodgingTotal / Math.max(total, 1) * 100).toFixed(2)}%` },
          { label: "\u4EA4\u901A\u8D39\u5360\u6BD4", value: `${((intercityTotal + localTotal) / Math.max(total, 1) * 100).toFixed(2)}%` },
          ...optimize ? [{ label: "\u9884\u8BA1\u53EF\u8282\u7EA6", value: money(saving), unit: "\u5143", sub: `\u4F18\u5316\u540E ${money(round(total - saving, 2))} \u5143` }] : []
        ],
        steps,
        basis: [
          {
            law: "\u300A\u4E2D\u592E\u548C\u56FD\u5BB6\u673A\u5173\u5DEE\u65C5\u8D39\u7BA1\u7406\u529E\u6CD5\u300B",
            article: "\u7B2C\u4E09\u6761",
            text: "\u5DEE\u65C5\u8D39\u662F\u6307\u5DE5\u4F5C\u4EBA\u5458\u4E34\u65F6\u5230\u5E38\u9A7B\u5730\u4EE5\u5916\u5730\u533A\u516C\u52A1\u51FA\u5DEE\u6240\u53D1\u751F\u7684\u57CE\u5E02\u95F4\u4EA4\u901A\u8D39\u3001\u4F4F\u5BBF\u8D39\u3001\u4F19\u98DF\u8865\u52A9\u8D39\u548C\u5E02\u5185\u4EA4\u901A\u8D39\u3002"
          }
        ],
        tips: [
          "\u4F4F\u5BBF\u8D39\u901A\u5E38\u662F\u6700\u5927\u6210\u672C\u9879\uFF08\u5360\u6BD4 40%\u201455%\uFF09\uFF0C\u7B7E\u8BA2\u534F\u8BAE\u9152\u5E97\u662F\u89C1\u6548\u6700\u5FEB\u7684\u964D\u672C\u624B\u6BB5\u3002",
          "\u63D0\u524D 15\u201430 \u5929\u9884\u8BA2\u673A\u7968\u3001\u9009\u62E9\u9AD8\u94C1\u66FF\u4EE3\u77ED\u9014\u822A\u73ED\uFF0C\u901A\u5E38\u53EF\u538B\u7F29\u4EA4\u901A\u8D39 10%\u201420%\u3002",
          "\u5DEE\u65C5\u5236\u5EA6\u5E94\u660E\u786E\u5BA1\u6279\u6D41\u7A0B\u3001\u6807\u51C6\u4E0A\u9650\u4E0E\u8D85\u6807\u5904\u7406\u89C4\u5219\uFF0C\u65E2\u662F\u6210\u672C\u63A7\u5236\u624B\u6BB5\uFF0C\u4E5F\u662F\u7A0E\u52A1\u5408\u89C4\u4E0E\u5EC9\u6D01\u98CE\u9669\u9632\u63A7\u7684\u4F9D\u636E\u3002"
        ]
      };
    }
  }
];

// src/core/calculators/legalcost.ts
var ARBITRATION_TIERS = [
  { upTo: 25e4, rate: 0.04, desc: "25 \u4E07\u5143\u4EE5\u4E0B\u90E8\u5206" },
  { upTo: 1e6, rate: 0.03, desc: "25 \u4E07\u2014100 \u4E07\u5143\u90E8\u5206" },
  { upTo: 5e6, rate: 0.02, desc: "100 \u4E07\u2014500 \u4E07\u5143\u90E8\u5206" },
  { upTo: 1e7, rate: 0.012, desc: "500 \u4E07\u20141000 \u4E07\u5143\u90E8\u5206" },
  { upTo: 5e7, rate: 8e-3, desc: "1000 \u4E07\u20145000 \u4E07\u5143\u90E8\u5206" },
  { upTo: Infinity, rate: 5e-3, desc: "5000 \u4E07\u5143\u4EE5\u4E0A\u90E8\u5206" }
];
var ARBITRATION_MIN = 5e3;
var legalCostCalculators = [
  /* ── 单案件法务成本 ── */
  {
    id: "case-cost",
    name: "\u5355\u6848\u4EF6\u6CD5\u52A1\u6210\u672C",
    category: "legalcost",
    glyph: "\u6848",
    summary: "\u5916\u90E8\u5F8B\u5E08\u8D39\u3001\u8BC9\u8BBC\u8D39\u4E0E\u5185\u90E8\u4EBA\u529B\u65F6\u95F4\u6210\u672C\u7684\u5B8C\u6574\u5F52\u96C6",
    keywords: ["\u6848\u4EF6\u6210\u672C", "\u6CD5\u52A1\u6210\u672C", "\u8BC9\u8BBC\u9884\u7B97", "\u5185\u90E8\u4EBA\u529B"],
    fields: [
      { key: "amount", label: "\u4E89\u8BAE\u6807\u7684\u989D", type: "money", unit: "\u5143", emphasis: true, defaultValue: 2e6 },
      { key: "lawyerFee", label: "\u5916\u90E8\u5F8B\u5E08\u8D39", type: "money", unit: "\u5143", defaultValue: 15e4 },
      { key: "courtFee", label: "\u6CD5\u9662\u6536\u53D6\u8D39\u7528\uFF08\u53D7\u7406\u8D39 + \u4FDD\u5168\u8D39\u7B49\uFF09", type: "money", unit: "\u5143", defaultValue: 0, hint: "\u586B 0 \u65F6\u6309\u6807\u7684\u989D\u81EA\u52A8\u6D4B\u7B97\u53D7\u7406\u8D39" },
      { key: "arbitrationFee", label: "\u4EF2\u88C1\u8D39\uFF08\u5982\u8D70\u4EF2\u88C1\uFF09", type: "money", unit: "\u5143", defaultValue: 0 },
      { key: "otherFee", label: "\u9274\u5B9A\u3001\u516C\u8BC1\u3001\u7FFB\u8BD1\u7B49\u8D39\u7528", type: "money", unit: "\u5143", defaultValue: 0 },
      { key: "travelFee", label: "\u5DEE\u65C5\u8D39", type: "money", unit: "\u5143", defaultValue: 0 },
      { key: "internalHours", label: "\u5185\u90E8\u6CD5\u52A1\u6295\u5165\u5C0F\u65F6\u6570", type: "number", unit: "\u5C0F\u65F6", defaultValue: 80 },
      { key: "hourlyCost", label: "\u5185\u90E8\u6CD5\u52A1\u5C0F\u65F6\u6210\u672C", type: "money", unit: "\u5143/\u5C0F\u65F6", defaultValue: 300, hint: "\u6309\u5E74\u85AA\u6298\u7B97\u7684\u5C0F\u65F6\u6210\u672C\uFF0C\u7528\u4E8E\u91CF\u5316\u5185\u90E8\u8D44\u6E90\u5360\u7528" },
      { key: "duration", label: "\u6848\u4EF6\u5468\u671F", type: "number", unit: "\u6708", defaultValue: 12 },
      {
        key: "recoveryRate",
        label: "\u9884\u671F\u56DE\u6B3E\u7387",
        type: "percent",
        unit: "%",
        defaultValue: 70
      }
    ],
    calc(values) {
      const amount = toNum(values.amount);
      const lawyerFee = toNum(values.lawyerFee);
      let courtFee = toNum(values.courtFee);
      const arbFee = toNum(values.arbitrationFee);
      const otherFee = toNum(values.otherFee);
      const travelFee = toNum(values.travelFee);
      const hours = toNum(values.internalHours);
      const hourlyCost = toNum(values.hourlyCost);
      const months = Math.max(1, toNum(values.duration));
      const recoveryRate = toNum(values.recoveryRate) / 100;
      const steps = [];
      if (courtFee === 0) {
        const r = progressive(amount, CIVIL_FEE_TIERS);
        courtFee = r.total;
        steps.push({ label: "\u6848\u4EF6\u53D7\u7406\u8D39\uFF08\u81EA\u52A8\u6D4B\u7B97\uFF09", value: `\u6807\u7684\u989D ${money(amount)} \u2192 ${money(courtFee)} \u5143` });
      } else {
        steps.push({ label: "\u6CD5\u9662\u6536\u53D6\u8D39\u7528", value: `${money(courtFee)} \u5143` });
      }
      steps.push({ label: "\u5916\u90E8\u5F8B\u5E08\u8D39", value: `${money(lawyerFee)} \u5143` });
      if (arbFee > 0) steps.push({ label: "\u4EF2\u88C1\u8D39", value: `${money(arbFee)} \u5143` });
      if (otherFee > 0) steps.push({ label: "\u9274\u5B9A / \u516C\u8BC1\u7B49\u5176\u4ED6\u8D39\u7528", value: `${money(otherFee)} \u5143` });
      if (travelFee > 0) steps.push({ label: "\u5DEE\u65C5\u8D39", value: `${money(travelFee)} \u5143` });
      const internalCost = round(hours * hourlyCost, 2);
      steps.push({
        label: "\u5185\u90E8\u6CD5\u52A1\u4EBA\u529B\u6210\u672C",
        value: `${hours} \u5C0F\u65F6 \xD7 ${money(hourlyCost)} = ${money(internalCost)} \u5143`,
        note: "\u5185\u90E8\u8D44\u6E90\u5360\u7528\u5E38\u88AB\u4F4E\u4F30\uFF0C\u91CF\u5316\u540E\u53EF\u66F4\u771F\u5B9E\u6BD4\u8F83\u81EA\u884C\u5904\u7406\u4E0E\u5916\u5305\u7684\u6027\u4EF7\u6BD4"
      });
      const external = round(lawyerFee + courtFee + arbFee + otherFee + travelFee, 2);
      const total = round(external + internalCost, 2);
      steps.push({ label: "\u5916\u90E8\u652F\u51FA\u5C0F\u8BA1", value: `${money(external)} \u5143` });
      steps.push({ label: "\u6848\u4EF6\u603B\u6210\u672C", value: `${money(total)} \u5143`, emphasis: true });
      const recovery = round(amount * recoveryRate, 2);
      const net = round(recovery - total, 2);
      const roi = round(net / Math.max(total, 1) * 100, 2);
      steps.push({ label: "\u9884\u671F\u56DE\u6B3E", value: `${money(amount)} \xD7 ${toNum(values.recoveryRate)}% = ${money(recovery)} \u5143` });
      steps.push({
        label: "\u51C0\u6536\u76CA\u4E0E\u6295\u5165\u4EA7\u51FA\u6BD4",
        value: `${money(net)} \u5143 / ${money(total)} \u5143 = ${roi}%`,
        emphasis: true,
        note: net < 0 ? "\u26A0 \u6210\u672C\u5927\u4E8E\u9884\u671F\u6536\u76CA\uFF0C\u5EFA\u8BAE\u4F18\u5148\u8C03\u89E3\u6216\u5546\u4E1A\u6B62\u635F" : "\u5177\u5907\u8BC9\u8BBC\u7ECF\u6D4E\u6027"
      });
      const monthlyBurn = round(total / months, 2);
      steps.push({ label: `\u6708\u5EA6\u6210\u672C\u6D88\u8017\uFF08${months} \u4E2A\u6708\uFF09`, value: `${money(monthlyBurn)} \u5143/\u6708` });
      return {
        main: { label: "\u6848\u4EF6\u603B\u6210\u672C", value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        blocks: [
          { label: "\u5916\u90E8\u652F\u51FA", value: money(external), unit: "\u5143", sub: `${(external / Math.max(total, 1) * 100).toFixed(1)}%` },
          { label: "\u5185\u90E8\u4EBA\u529B\u6210\u672C", value: money(internalCost), unit: "\u5143", sub: `${(internalCost / Math.max(total, 1) * 100).toFixed(1)}%` },
          { label: "\u6210\u672C\u5360\u6807\u7684\u989D\u6BD4", value: `${(total / Math.max(amount, 1) * 100).toFixed(2)}%` },
          { label: "\u51C0\u6536\u76CA", value: money(net), unit: "\u5143", sub: `ROI ${roi}%` },
          { label: "\u6708\u5EA6\u6210\u672C", value: money(monthlyBurn), unit: "\u5143/\u6708" }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u4E09\u6761",
            text: "\u8D22\u4EA7\u6848\u4EF6\u6839\u636E\u8BC9\u8BBC\u8BF7\u6C42\u7684\u91D1\u989D\u6216\u8005\u4EF7\u989D\uFF0C\u6309\u7167\u5206\u6BB5\u7D2F\u8BA1\u6807\u51C6\u4EA4\u7EB3\u6848\u4EF6\u53D7\u7406\u8D39\u3002"
          }
        ],
        tips: [
          "\u5185\u90E8\u6CD5\u52A1\u7684\u4EBA\u529B\u6210\u672C\u662F\u6700\u5BB9\u6613\u88AB\u5FFD\u7565\u7684\u9690\u6027\u652F\u51FA\uFF0C\u91CF\u5316\u540E\u5F80\u5F80\u5360\u5230\u6848\u4EF6\u603B\u6210\u672C\u7684 15%\u201430%\u3002",
          "\u6848\u4EF6\u5468\u671F\u8D8A\u957F\uFF0C\u5185\u90E8\u4EBA\u529B\u4E0E\u673A\u4F1A\u6210\u672C\u8D8A\u9AD8\uFF0C\u8BC4\u4F30\u8BC9\u8BBC\u7ECF\u6D4E\u6027\u65F6\u52A1\u5FC5\u628A\u5468\u671F\u7EB3\u5165\u8003\u91CF\u3002",
          "\u80DC\u8BC9\u540E\u53D7\u7406\u8D39\u53EF\u7533\u8BF7\u9000\u8FD8\uFF0C\u5F8B\u5E08\u8D39\u9664\u975E\u6709\u7EA6\u5B9A\u6216\u6CD5\u5B9A\u60C5\u5F62\u5426\u5219\u96BE\u4EE5\u8F6C\u5AC1\uFF0C\u6D4B\u7B97\u65F6\u5E94\u4FDD\u5B88\u5904\u7406\u3002"
        ]
      };
    }
  },
  /* ── 律师计费方案比选 ── */
  {
    id: "counsel-compare",
    name: "\u5F8B\u5E08\u8BA1\u8D39\u65B9\u6848\u6BD4\u9009",
    category: "legalcost",
    glyph: "\u9009",
    summary: "\u56FA\u5B9A\u8D39\u3001\u8BA1\u65F6\u3001\u98CE\u9669\u4EE3\u7406\u4E09\u79CD\u65B9\u6848\u7684\u573A\u666F\u5316\u5BF9\u6BD4\u4E0E\u76C8\u4E8F\u5E73\u8861\u70B9",
    keywords: ["\u5F8B\u5E08\u8D39\u6BD4\u9009", "\u98CE\u9669\u4EE3\u7406", "\u8BA1\u65F6\u6536\u8D39", "\u8BA1\u8D39\u65B9\u6848"],
    fields: [
      { key: "amount", label: "\u4E89\u8BAE\u6807\u7684\u989D", type: "money", unit: "\u5143", emphasis: true, defaultValue: 3e6 },
      { key: "fixedFee", label: "\u65B9\u6848 A\uFF1A\u56FA\u5B9A\u8D39\u7528", type: "money", unit: "\u5143", defaultValue: 2e5 },
      { key: "hours", label: "\u65B9\u6848 B\uFF1A\u9884\u8BA1\u5DE5\u4F5C\u5C0F\u65F6", type: "number", unit: "\u5C0F\u65F6", defaultValue: 120 },
      { key: "hourlyRate", label: "\u65B9\u6848 B\uFF1A\u5C0F\u65F6\u8D39\u7387", type: "money", unit: "\u5143/\u5C0F\u65F6", defaultValue: 2500 },
      { key: "contingencyBase", label: "\u65B9\u6848 C\uFF1A\u98CE\u9669\u4EE3\u7406\u57FA\u7840\u8D39", type: "money", unit: "\u5143", defaultValue: 3e4 },
      { key: "contingencyRate", label: "\u65B9\u6848 C\uFF1A\u98CE\u9669\u63D0\u6210\u6BD4\u4F8B", type: "percent", unit: "%", defaultValue: 12 },
      {
        key: "recoveryRate",
        label: "\u9884\u8BA1\u56DE\u6B3E\u7387",
        type: "percent",
        unit: "%",
        defaultValue: 70
      },
      {
        key: "scenario",
        label: "\u5BF9\u6BD4\u573A\u666F",
        type: "select",
        defaultValue: "expected",
        options: [
          { label: "\u6309\u9884\u8BA1\u56DE\u6B3E\u7387\u6D4B\u7B97", value: "expected" },
          { label: "\u60B2\u89C2\u60C5\u666F\uFF08\u56DE\u6B3E 30%\uFF09", value: "pessimistic" },
          { label: "\u4E50\u89C2\u60C5\u666F\uFF08\u56DE\u6B3E 100%\uFF09", value: "optimistic" },
          { label: "\u8D25\u8BC9\uFF08\u56DE\u6B3E 0%\uFF09", value: "lose" }
        ]
      }
    ],
    calc(values) {
      const amount = toNum(values.amount);
      const fixedFee = toNum(values.fixedFee);
      const hours = toNum(values.hours);
      const hourlyRate = toNum(values.hourlyRate);
      const base = toNum(values.contingencyBase);
      const cRate = toNum(values.contingencyRate) / 100;
      const scenario = toStr(values.scenario, "expected");
      const inputRate = toNum(values.recoveryRate) / 100;
      const rate = scenario === "pessimistic" ? 0.3 : scenario === "optimistic" ? 1 : scenario === "lose" ? 0 : inputRate;
      const recovery = round(amount * rate, 2);
      const steps = [
        { label: "\u5BF9\u6BD4\u573A\u666F", value: `\u56DE\u6B3E\u7387 ${(rate * 100).toFixed(0)}%` },
        { label: "\u9884\u8BA1\u56DE\u6B3E\u91D1\u989D", value: `${money(recovery)} \u5143` }
      ];
      const hourlyFee = round(hours * hourlyRate, 2);
      const contingencyFee = round(base + recovery * cRate, 2);
      steps.push({ label: "\u65B9\u6848 A \u56FA\u5B9A\u8D39", value: `${money(fixedFee)} \u5143`, note: "\u65E0\u8BBA\u7ED3\u679C\u5982\u4F55\u5747\u9700\u652F\u4ED8" });
      steps.push({ label: "\u65B9\u6848 B \u8BA1\u65F6\u6536\u8D39", value: `${hours} \u5C0F\u65F6 \xD7 ${money(hourlyRate)} = ${money(hourlyFee)} \u5143` });
      steps.push({
        label: "\u65B9\u6848 C \u98CE\u9669\u4EE3\u7406",
        value: `${money(base)} + ${money(recovery)} \xD7 ${toNum(values.contingencyRate)}% = ${money(contingencyFee)} \u5143`,
        note: "\u56DE\u6B3E\u4E3A\u96F6\u65F6\u4EC5\u9700\u652F\u4ED8\u57FA\u7840\u8D39"
      });
      const options = [
        { name: "A \u56FA\u5B9A\u8D39\u7528", fee: fixedFee },
        { name: "B \u8BA1\u65F6\u6536\u8D39", fee: hourlyFee },
        { name: "C \u98CE\u9669\u4EE3\u7406", fee: contingencyFee }
      ];
      const sorted = [...options].sort((a, b) => a.fee - b.fee);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      steps.push({ label: "\u6700\u4F18\u65B9\u6848", value: `${best.name}\uFF08${money(best.fee)} \u5143\uFF09`, emphasis: true });
      steps.push({ label: "\u6700\u52A3\u65B9\u6848", value: `${worst.name}\uFF08${money(worst.fee)} \u5143\uFF09` });
      steps.push({ label: "\u65B9\u6848\u4EF7\u5DEE", value: `${money(round(worst.fee - best.fee, 2))} \u5143`, emphasis: true });
      const breakEvenRecovery = cRate > 0 ? round((fixedFee - base) / cRate, 2) : Infinity;
      if (Number.isFinite(breakEvenRecovery)) {
        const breakEvenRate = round(breakEvenRecovery / Math.max(amount, 1) * 100, 2);
        steps.push({
          label: "\u56FA\u5B9A\u8D39 vs \u98CE\u9669\u4EE3\u7406\u76C8\u4E8F\u5E73\u8861\u70B9",
          value: `\u56DE\u6B3E\u8FBE\u5230 ${money(breakEvenRecovery)} \u5143\uFF08\u56DE\u6B3E\u7387 ${breakEvenRate}%\uFF09\u65F6\u4E24\u8005\u8D39\u7528\u76F8\u5F53`,
          note: breakEvenRate < rate * 100 ? "\u5F53\u524D\u60C5\u666F\u4E0B\u98CE\u9669\u4EE3\u7406\u66F4\u8D35\uFF0C\u56FA\u5B9A\u8D39\u66F4\u5212\u7B97" : "\u5F53\u524D\u60C5\u666F\u4E0B\u98CE\u9669\u4EE3\u7406\u66F4\u5212\u7B97",
          emphasis: true
        });
      }
      const blocks = [
        { label: "\u65B9\u6848 A \u56FA\u5B9A\u8D39\u7528", value: money(fixedFee), unit: "\u5143" },
        { label: "\u65B9\u6848 B \u8BA1\u65F6\u6536\u8D39", value: money(hourlyFee), unit: "\u5143" },
        { label: "\u65B9\u6848 C \u98CE\u9669\u4EE3\u7406", value: money(contingencyFee), unit: "\u5143" },
        { label: "\u63A8\u8350\u65B9\u6848", value: best.name, sub: money(best.fee) }
      ];
      if (Number.isFinite(breakEvenRecovery)) {
        blocks.push({
          label: "\u76C8\u4E8F\u5E73\u8861\u56DE\u6B3E\u7387",
          value: `${round(breakEvenRecovery / Math.max(amount, 1) * 100, 2)}%`,
          sub: "\u4F4E\u4E8E\u6B64\u503C\u9009\u56FA\u5B9A\u8D39"
        });
      }
      return {
        main: { label: "\u6700\u4F18\u65B9\u6848", value: best.name, sub: `${money(best.fee)} \u5143\uFF0C\u8F83\u6B21\u4F18\u65B9\u6848\u7701 ${money(round(sorted[1].fee - best.fee, 2))} \u5143` },
        blocks,
        steps,
        basis: [
          {
            law: "\u300A\u5F8B\u5E08\u670D\u52A1\u6536\u8D39\u7BA1\u7406\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u4E09\u6761",
            text: "\u5B9E\u884C\u98CE\u9669\u4EE3\u7406\u6536\u8D39\uFF0C\u6700\u9AD8\u6536\u8D39\u91D1\u989D\u4E0D\u5F97\u9AD8\u4E8E\u6536\u8D39\u5408\u540C\u7EA6\u5B9A\u6807\u7684\u989D\u768430%\u3002"
          },
          {
            law: "\u300A\u5F8B\u5E08\u670D\u52A1\u6536\u8D39\u7BA1\u7406\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u6761",
            text: "\u5F8B\u5E08\u670D\u52A1\u6536\u8D39\u53EF\u4EE5\u6839\u636E\u4E0D\u540C\u7684\u670D\u52A1\u5185\u5BB9\uFF0C\u91C7\u53D6\u8BA1\u4EF6\u6536\u8D39\u3001\u6309\u6807\u7684\u989D\u6BD4\u4F8B\u6536\u8D39\u548C\u8BA1\u65F6\u6536\u8D39\u7B49\u65B9\u5F0F\u3002"
          }
        ],
        tips: [
          "\u56DE\u6B3E\u9884\u671F\u4F4E\u3001\u6267\u884C\u96BE\u5EA6\u5927\u7684\u6848\u4EF6\uFF0C\u98CE\u9669\u4EE3\u7406\u5BF9\u59D4\u6258\u4EBA\u66F4\u6709\u5229\uFF1B\u6807\u7684\u6E05\u6670\u3001\u80DC\u8BC9\u6982\u7387\u9AD8\u7684\u6848\u4EF6\uFF0C\u56FA\u5B9A\u8D39\u901A\u5E38\u66F4\u7701\u3002",
          '\u98CE\u9669\u4EE3\u7406\u7684\u63D0\u6210\u57FA\u6570\u52A1\u5FC5\u660E\u786E\u662F"\u5B9E\u9645\u56DE\u6B3E"\u8FD8\u662F"\u6807\u7684\u989D"\u2014\u2014\u6CD5\u5B9A 30% \u4E0A\u9650\u662F\u4EE5\u6807\u7684\u989D\u4E3A\u57FA\u6570\uFF0C\u7B7E\u7EA6\u65F6\u4E24\u8005\u5DEE\u5F02\u6781\u5927\u3002',
          "\u8BA1\u65F6\u6536\u8D39\u6700\u5927\u7684\u98CE\u9669\u662F\u5C0F\u65F6\u6570\u5931\u63A7\uFF0C\u5EFA\u8BAE\u7EA6\u5B9A\u5C0F\u65F6\u4E0A\u9650\u4E0E\u9636\u6BB5\u6027\u62A5\u544A\u4E49\u52A1\u3002",
          "\u4E0B\u5217\u6848\u4EF6\u7981\u6B62\u98CE\u9669\u4EE3\u7406\uFF1A\u5211\u4E8B\u8BC9\u8BBC\u3001\u884C\u653F\u8BC9\u8BBC\u3001\u56FD\u5BB6\u8D54\u507F\u3001\u7FA4\u4F53\u6027\u8BC9\u8BBC\u3001\u5A5A\u59FB\u7EE7\u627F\u3001\u52B3\u52A8\u62A5\u916C\u7B49\u3002"
        ]
      };
    }
  },
  /* ── 争议解决方式对比 ── */
  {
    id: "dispute-decision",
    name: "\u4E89\u8BAE\u89E3\u51B3\u65B9\u5F0F\u5BF9\u6BD4",
    category: "legalcost",
    glyph: "\u4E89",
    summary: "\u8BC9\u8BBC\u3001\u4EF2\u88C1\u3001\u8C03\u89E3\u4E09\u79CD\u8DEF\u5F84\u7684\u6210\u672C\u4E0E\u5468\u671F\u7EFC\u5408\u5BF9\u6BD4",
    keywords: ["\u8BC9\u8BBC", "\u4EF2\u88C1", "\u8C03\u89E3", "\u4E89\u8BAE\u89E3\u51B3", "\u6210\u672C\u5BF9\u6BD4"],
    fields: [
      { key: "amount", label: "\u4E89\u8BAE\u6807\u7684\u989D", type: "money", unit: "\u5143", emphasis: true, defaultValue: 5e6 },
      { key: "lawyerFee", label: "\u5F8B\u5E08\u8D39\uFF08\u5404\u8DEF\u5F84\u5927\u81F4\u76F8\u540C\uFF09", type: "money", unit: "\u5143", defaultValue: 25e4 },
      {
        key: "litigationMonths",
        label: "\u8BC9\u8BBC\u9884\u8BA1\u5468\u671F",
        type: "number",
        unit: "\u6708",
        defaultValue: 18,
        hint: "\u542B\u4E00\u5BA1\u3001\u53EF\u80FD\u7684\u4E8C\u5BA1\u4E0E\u6267\u884C"
      },
      {
        key: "arbitrationMonths",
        label: "\u4EF2\u88C1\u9884\u8BA1\u5468\u671F",
        type: "number",
        unit: "\u6708",
        defaultValue: 8
      },
      {
        key: "mediationMonths",
        label: "\u8C03\u89E3\u9884\u8BA1\u5468\u671F",
        type: "number",
        unit: "\u6708",
        defaultValue: 2
      },
      {
        key: "internalHours",
        label: "\u5185\u90E8\u6CD5\u52A1\u6295\u5165\u5C0F\u65F6",
        type: "number",
        unit: "\u5C0F\u65F6",
        defaultValue: 100
      },
      { key: "hourlyCost", label: "\u5185\u90E8\u6CD5\u52A1\u5C0F\u65F6\u6210\u672C", type: "money", unit: "\u5143/\u5C0F\u65F6", defaultValue: 300 },
      {
        key: "recoveryRate",
        label: "\u9884\u671F\u56DE\u6B3E\u7387",
        type: "percent",
        unit: "%",
        defaultValue: 70
      },
      {
        key: "capitalRate",
        label: "\u8D44\u91D1\u5360\u7528\u5E74\u6210\u672C\u7387",
        type: "percent",
        unit: "%",
        defaultValue: 5,
        hint: "\u56DE\u6B3E\u5EF6\u8FDF\u7684\u673A\u4F1A\u6210\u672C\uFF0C\u6309\u4F01\u4E1A\u8D44\u91D1\u6210\u672C\u586B\u5199"
      }
    ],
    calc(values) {
      const amount = toNum(values.amount);
      const lawyerFee = toNum(values.lawyerFee);
      const internalCost = round(toNum(values.internalHours) * toNum(values.hourlyCost), 2);
      const recoveryRate = toNum(values.recoveryRate) / 100;
      const capitalRate = toNum(values.capitalRate) / 100;
      const { total: courtFee } = progressive(amount, CIVIL_FEE_TIERS);
      let arbFee = 0;
      {
        let lower = 0;
        for (const t of ARBITRATION_TIERS) {
          if (amount <= lower) break;
          arbFee += (Math.min(amount, t.upTo) - lower) * t.rate;
          lower = t.upTo;
        }
        arbFee = Math.max(round(arbFee, 2), ARBITRATION_MIN);
      }
      const paths = [
        {
          name: "\u8BC9\u8BBC\uFF08\u4E00\u5BA1 + \u53EF\u80FD\u4E8C\u5BA1\uFF09",
          fee: round(courtFee + lawyerFee + internalCost, 2),
          months: toNum(values.litigationMonths),
          note: `\u53D7\u7406\u8D39 ${money(courtFee)} \u5143\uFF0C\u4E24\u5BA1\u7EC8\u5BA1 + \u6267\u884C\u5468\u671F\u957F`
        },
        {
          name: "\u4EF2\u88C1\uFF08\u4E00\u88C1\u7EC8\u5C40\uFF09",
          fee: round(arbFee + lawyerFee + internalCost, 2),
          months: toNum(values.arbitrationMonths),
          note: `\u4EF2\u88C1\u8D39\u7EA6 ${money(arbFee)} \u5143\uFF08\u53C2\u8003\u4F30\u7B97\uFF09\uFF0C\u4E00\u88C1\u7EC8\u5C40\u3001\u5468\u671F\u77ED\u3001\u4FDD\u5BC6\u6027\u5F3A`
        },
        {
          name: "\u8C03\u89E3 / \u548C\u89E3",
          fee: round(lawyerFee * 0.4 + internalCost * 0.5, 2),
          months: toNum(values.mediationMonths),
          note: "\u5F8B\u5E08\u8D39\u6309 40% \u6298\u7B97\uFF0C\u901A\u5E38\u9700\u8981\u4EE5\u4E00\u5B9A\u91D1\u989D\u6298\u8BA9\u6362\u53D6\u5FEB\u901F\u56DE\u6B3E"
        }
      ];
      const steps = [{ label: "\u4E89\u8BAE\u6807\u7684\u989D", value: `${money(amount)} \u5143` }];
      const results = paths.map((p) => {
        const capitalCost = round(amount * recoveryRate * capitalRate * (p.months / 12), 2);
        const total = round(p.fee + capitalCost, 2);
        steps.push({
          label: p.name,
          value: `\u76F4\u63A5\u6210\u672C ${money(p.fee)} + \u8D44\u91D1\u5360\u7528 ${money(capitalCost)} = ${money(total)} \u5143\uFF08${p.months} \u4E2A\u6708\uFF09`,
          note: p.note
        });
        return { ...p, capitalCost, total };
      });
      const sorted = [...results].sort((a, b) => a.total - b.total);
      const best = sorted[0];
      steps.push({ label: "\u7EFC\u5408\u6210\u672C\u6700\u4F18", value: `${best.name}\uFF08${money(best.total)} \u5143\uFF09`, emphasis: true });
      const recovery = round(amount * recoveryRate, 2);
      steps.push({
        label: "\u6700\u4F18\u8DEF\u5F84\u51C0\u6536\u76CA",
        value: `${money(recovery)} \u2212 ${money(best.total)} = ${money(round(recovery - best.total, 2))} \u5143`,
        emphasis: true
      });
      return {
        main: {
          label: "\u63A8\u8350\u8DEF\u5F84",
          value: best.name,
          sub: `\u7EFC\u5408\u6210\u672C ${money(best.total)} \u5143\uFF0C\u5468\u671F ${best.months} \u4E2A\u6708`
        },
        blocks: results.map((r) => ({
          label: r.name,
          value: money(r.total),
          unit: "\u5143",
          sub: `\u76F4\u63A5\u6210\u672C ${money(r.fee)} + \u8D44\u91D1\u5360\u7528 ${money(r.capitalCost)}\uFF0C${r.months} \u4E2A\u6708`
        })),
        steps,
        basis: [
          {
            law: "\u300A\u8BC9\u8BBC\u8D39\u7528\u4EA4\u7EB3\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u4E09\u6761",
            text: "\u8D22\u4EA7\u6848\u4EF6\u6839\u636E\u8BC9\u8BBC\u8BF7\u6C42\u7684\u91D1\u989D\u6216\u8005\u4EF7\u989D\u5206\u6BB5\u7D2F\u8BA1\u4EA4\u7EB3\u6848\u4EF6\u53D7\u7406\u8D39\u3002"
          },
          {
            law: "\u300A\u4EF2\u88C1\u6CD5\u300B",
            article: "\u7B2C\u4E5D\u6761",
            text: "\u4EF2\u88C1\u5B9E\u884C\u4E00\u88C1\u7EC8\u5C40\u7684\u5236\u5EA6\u3002\u88C1\u51B3\u4F5C\u51FA\u540E\uFF0C\u5F53\u4E8B\u4EBA\u5C31\u540C\u4E00\u7EA0\u7EB7\u518D\u7533\u8BF7\u4EF2\u88C1\u6216\u8005\u5411\u4EBA\u6C11\u6CD5\u9662\u8D77\u8BC9\u7684\uFF0C\u4EF2\u88C1\u59D4\u5458\u4F1A\u6216\u8005\u4EBA\u6C11\u6CD5\u9662\u4E0D\u4E88\u53D7\u7406\u3002"
          },
          {
            law: "\u300A\u6C11\u4E8B\u8BC9\u8BBC\u6CD5\u300B",
            article: "\u7B2C\u4E5D\u6761",
            text: "\u4EBA\u6C11\u6CD5\u9662\u5BA1\u7406\u6C11\u4E8B\u6848\u4EF6\uFF0C\u5E94\u5F53\u6839\u636E\u81EA\u613F\u548C\u5408\u6CD5\u7684\u539F\u5219\u8FDB\u884C\u8C03\u89E3\uFF1B\u8C03\u89E3\u4E0D\u6210\u7684\uFF0C\u5E94\u5F53\u53CA\u65F6\u5224\u51B3\u3002"
          }
        ],
        tips: [
          "\u4EF2\u88C1\u8D39\u7528\u9AD8\u4E8E\u8BC9\u8BBC\u53D7\u7406\u8D39\uFF0C\u4F46\u4E00\u88C1\u7EC8\u5C40\u53EF\u8282\u7701\u5927\u91CF\u65F6\u95F4\u6210\u672C\uFF1B\u91D1\u989D\u5927\u3001\u5468\u671F\u654F\u611F\u7684\u5546\u4E1A\u4E89\u8BAE\u901A\u5E38\u66F4\u5212\u7B97\u3002",
          "\u8BC9\u8BBC\u65F6\u6548\u5185\u5148\u884C\u8C03\u89E3\u7684\u6210\u672C\u6781\u4F4E\uFF0C\u4E14\u8C03\u89E3\u4E66\u53EF\u76F4\u63A5\u7533\u8BF7\u5F3A\u5236\u6267\u884C\uFF0C\u662F\u6027\u4EF7\u6BD4\u6700\u9AD8\u7684\u8DEF\u5F84\u3002",
          "\u8D44\u91D1\u5360\u7528\u6210\u672C\u5E38\u88AB\u5FFD\u7565\uFF1A5000 \u4E07\u6807\u7684\u62D6\u5EF6\u4E00\u5E74\uFF0C\u6309 5% \u5E74\u6210\u672C\u8BA1\u5373\u8FBE 175 \u4E07\u5143\uFF0C\u5F80\u5F80\u8D85\u8FC7\u5F8B\u5E08\u8D39\u672C\u8EAB\u3002",
          "\u4EF2\u88C1\u8D39\u6863\u4F4D\u4E3A\u5E38\u89C1\u533A\u95F4\u8FD1\u4F3C\u503C\uFF0C\u6B63\u5F0F\u51B3\u7B56\u524D\u8BF7\u5411\u9009\u5B9A\u4EF2\u88C1\u673A\u6784\u6838\u5B9E\u6700\u65B0\u6536\u8D39\u529E\u6CD5\u3002"
        ],
        disclaimer: "\u4EF2\u88C1\u8D39\u4E3A\u6309\u5E38\u89C1\u6863\u4F4D\u7684\u4F30\u7B97\u503C\uFF0C\u5404\u4EF2\u88C1\u673A\u6784\u6536\u8D39\u6807\u51C6\u5DEE\u5F02\u8F83\u5927\uFF0C\u6B63\u5F0F\u51B3\u7B56\u524D\u8BF7\u5411\u9009\u5B9A\u673A\u6784\u6838\u5B9E\u3002"
      };
    }
  },
  /* ── 法务部门投入产出 ── */
  {
    id: "legal-dept-roi",
    name: "\u6CD5\u52A1\u90E8\u95E8\u6295\u5165\u4EA7\u51FA",
    category: "legalcost",
    glyph: "\u4EA7",
    summary: "\u5E74\u5EA6\u6CD5\u52A1\u603B\u6210\u672C\u4E0E\u98CE\u9669\u51CF\u635F\u3001\u4E89\u8BAE\u633D\u56DE\u91D1\u989D\u7684 ROI \u5206\u6790",
    keywords: ["\u6CD5\u52A1\u90E8\u95E8", "ROI", "\u6295\u5165\u4EA7\u51FA", "\u6CD5\u52A1\u9884\u7B97"],
    fields: [
      { key: "headcount", label: "\u6CD5\u52A1\u56E2\u961F\u4EBA\u6570", type: "number", unit: "\u4EBA", defaultValue: 8 },
      { key: "avgSalary", label: "\u4EBA\u5747\u5E74\u5EA6\u4EBA\u529B\u6210\u672C", type: "money", unit: "\u5143", defaultValue: 5e5, hint: "\u542B\u5DE5\u8D44\u3001\u793E\u4FDD\u3001\u516C\u79EF\u91D1\u3001\u5956\u91D1" },
      { key: "externalFee", label: "\u5E74\u5EA6\u5916\u90E8\u5F8B\u5E08\u8D39", type: "money", unit: "\u5143", defaultValue: 15e5 },
      { key: "litigationFee", label: "\u5E74\u5EA6\u8BC9\u8BBC / \u4EF2\u88C1\u8D39\u7528", type: "money", unit: "\u5143", defaultValue: 3e5 },
      { key: "systemFee", label: "\u7CFB\u7EDF\u5DE5\u5177\u4E0E\u57F9\u8BAD\u8D39\u7528", type: "money", unit: "\u5143", defaultValue: 2e5 },
      { key: "cases", label: "\u5E74\u5EA6\u5904\u7406\u6848\u4EF6\u6570", type: "number", unit: "\u4EF6", defaultValue: 120 },
      { key: "disputeAmount", label: "\u5E74\u5EA6\u6D89\u53CA\u4E89\u8BAE\u603B\u91D1\u989D", type: "money", unit: "\u5143", defaultValue: 8e7 },
      { key: "recovered", label: "\u5E74\u5EA6\u633D\u56DE / \u907F\u514D\u635F\u5931\u91D1\u989D", type: "money", unit: "\u5143", defaultValue: 25e6 },
      {
        key: "contractValue",
        label: "\u5E74\u5EA6\u5BA1\u6838\u5408\u540C\u6D89\u53CA\u91D1\u989D",
        type: "money",
        unit: "\u5143",
        defaultValue: 3e8,
        hint: "\u7528\u4E8E\u8BA1\u7B97\u6CD5\u52A1\u5BF9\u4E1A\u52A1\u89C4\u6A21\u7684\u652F\u6491\u6548\u7387"
      }
    ],
    calc(values) {
      const headcount = Math.max(1, toNum(values.headcount));
      const avgSalary = toNum(values.avgSalary);
      const external = toNum(values.externalFee);
      const litigation = toNum(values.litigationFee);
      const system = toNum(values.systemFee);
      const cases = Math.max(1, toNum(values.cases));
      const dispute = toNum(values.disputeAmount);
      const recovered = toNum(values.recovered);
      const contractValue = toNum(values.contractValue);
      const steps = [];
      const internal = round(headcount * avgSalary, 2);
      steps.push({ label: "\u5185\u90E8\u4EBA\u529B\u6210\u672C", value: `${headcount} \u4EBA \xD7 ${money(avgSalary)} = ${money(internal)} \u5143` });
      steps.push({ label: "\u5916\u90E8\u5F8B\u5E08\u8D39", value: `${money(external)} \u5143` });
      steps.push({ label: "\u8BC9\u8BBC / \u4EF2\u88C1\u8D39\u7528", value: `${money(litigation)} \u5143` });
      steps.push({ label: "\u7CFB\u7EDF\u5DE5\u5177\u4E0E\u57F9\u8BAD", value: `${money(system)} \u5143` });
      const total = round(internal + external + litigation + system, 2);
      steps.push({ label: "\u5E74\u5EA6\u6CD5\u52A1\u603B\u6210\u672C", value: `${money(total)} \u5143`, emphasis: true });
      const roi = round((recovered - total) / Math.max(total, 1) * 100, 2);
      steps.push({
        label: "\u6295\u5165\u4EA7\u51FA\u6BD4",
        value: `(${money(recovered)} \u2212 ${money(total)}) \xF7 ${money(total)} = ${roi}%`,
        emphasis: true,
        note: recovered > total ? "\u6CD5\u52A1\u521B\u9020\u7684\u4EF7\u503C\u9AD8\u4E8E\u6210\u672C" : "\u26A0 \u8D26\u9762 ROI \u4E3A\u8D1F\uFF0C\u9700\u590D\u6838\u633D\u56DE\u91D1\u989D\u7684\u7EDF\u8BA1\u53E3\u5F84"
      });
      const perCase = round(total / cases, 2);
      steps.push({ label: "\u5355\u6848\u4EF6\u5E73\u5747\u6210\u672C", value: `${money(total)} \xF7 ${cases} = ${money(perCase)} \u5143` });
      const perHeadDispute = round(dispute / headcount, 2);
      steps.push({ label: "\u4EBA\u5747\u7BA1\u7406\u4E89\u8BAE\u91D1\u989D", value: `${money(perHeadDispute)} \u5143` });
      const costRate = round(total / Math.max(contractValue, 1) * 100, 4);
      steps.push({
        label: "\u6CD5\u52A1\u6210\u672C\u5360\u5408\u540C\u89C4\u6A21\u6BD4",
        value: `${money(total)} \xF7 ${money(contractValue)} = ${costRate}%`,
        note: costRate < 0.1 ? "\u5904\u4E8E\u8F83\u4F4E\u6C34\u5E73\uFF0C\u53EF\u8BC4\u4F30\u662F\u5426\u6295\u5165\u4E0D\u8DB3" : costRate > 0.5 ? "\u5360\u6BD4\u8F83\u9AD8\uFF0C\u53EF\u8003\u8651\u4F18\u5316\u5916\u90E8\u5F8B\u5E08\u4F7F\u7528\u7B56\u7565" : "\u5904\u4E8E\u5E38\u89C1\u533A\u95F4"
      });
      const externalRatio = round(external / Math.max(total, 1) * 100, 2);
      steps.push({ label: "\u5916\u90E8\u5F8B\u5E08\u8D39\u5360\u6BD4", value: `${externalRatio}%`, note: externalRatio > 50 ? "\u5916\u90E8\u4F9D\u8D56\u5EA6\u9AD8\uFF0C\u53EF\u8003\u8651\u8865\u5145\u5185\u90E8\u529B\u91CF\u6216\u91C7\u7528\u56FA\u5B9A\u5E74\u8D39\u5236" : "\u5185\u5916\u914D\u6BD4\u76F8\u5BF9\u5747\u8861" });
      return {
        main: { label: "\u5E74\u5EA6\u6CD5\u52A1\u603B\u6210\u672C", value: money(total), unit: "\u5143", sub: moneyToChinese(total) },
        blocks: [
          { label: "\u6295\u5165\u4EA7\u51FA\u6BD4", value: `${roi}%`, sub: recovered > total ? "\u4EF7\u503C\u521B\u9020\u4E3A\u6B63" : "ROI \u4E3A\u8D1F" },
          { label: "\u5355\u6848\u4EF6\u5E73\u5747\u6210\u672C", value: money(perCase), unit: "\u5143" },
          { label: "\u4EBA\u5747\u7BA1\u7406\u4E89\u8BAE\u91D1\u989D", value: money(perHeadDispute), unit: "\u5143" },
          { label: "\u6CD5\u52A1\u6210\u672C\u5360\u5408\u540C\u89C4\u6A21", value: `${costRate}%` },
          { label: "\u5916\u90E8\u5F8B\u5E08\u8D39\u5360\u6BD4", value: `${externalRatio}%` }
        ],
        steps,
        basis: [
          {
            law: "\u300A\u5F8B\u5E08\u670D\u52A1\u6536\u8D39\u7BA1\u7406\u529E\u6CD5\u300B",
            article: "\u7B2C\u5341\u6761",
            text: "\u5F8B\u5E08\u670D\u52A1\u6536\u8D39\u53EF\u4EE5\u6839\u636E\u4E0D\u540C\u7684\u670D\u52A1\u5185\u5BB9\uFF0C\u91C7\u53D6\u8BA1\u4EF6\u6536\u8D39\u3001\u6309\u6807\u7684\u989D\u6BD4\u4F8B\u6536\u8D39\u548C\u8BA1\u65F6\u6536\u8D39\u7B49\u65B9\u5F0F\u3002"
          }
        ],
        tips: [
          '"\u633D\u56DE\u635F\u5931"\u7684\u7EDF\u8BA1\u53E3\u5F84\u51B3\u5B9A\u4E86 ROI \u7684\u53EF\u4FE1\u5EA6\uFF0C\u5EFA\u8BAE\u53EA\u8BA1\u5165\u6709\u4E66\u9762\u4F9D\u636E\uFF08\u80DC\u8BC9\u5224\u51B3\u3001\u6267\u884C\u5230\u4F4D\u3001\u8C08\u5224\u964D\u4EF7\uFF09\u7684\u91D1\u989D\u3002',
          "\u6CD5\u52A1\u6210\u672C\u5360\u5408\u540C\u89C4\u6A21 0.1%\u20140.5% \u662F\u591A\u6570\u884C\u4E1A\u7684\u5E38\u89C1\u533A\u95F4\uFF0C\u663E\u8457\u4F4E\u4E8E\u8BE5\u533A\u95F4\u5F80\u5F80\u610F\u5473\u7740\u5408\u89C4\u98CE\u9669\u655E\u53E3\u504F\u5927\u3002",
          "\u5916\u90E8\u5F8B\u5E08\u8D39\u5360\u6BD4\u8D85\u8FC7 50% \u65F6\uFF0C\u901A\u5E38\u53EF\u901A\u8FC7\u5E38\u5E74\u6CD5\u5F8B\u987E\u95EE\uFF08\u5E74\u5EA6\u56FA\u5B9A\u8D39\uFF09\u66FF\u4EE3\u4E2A\u6848\u59D4\u6258\uFF0C\u663E\u8457\u964D\u4F4E\u6210\u672C\u3002",
          '\u9664\u633D\u56DE\u91D1\u989D\u5916\uFF0C\u6CD5\u52A1\u7684"\u98CE\u9669\u907F\u514D"\u4EF7\u503C\uFF08\u672A\u53D1\u751F\u7684\u8BC9\u8BBC\u3001\u672A\u7B7E\u4E0B\u7684\u98CE\u9669\u5408\u540C\uFF09\u540C\u6837\u91CD\u8981\uFF0C\u5EFA\u8BAE\u5728\u62A5\u544A\u4E2D\u5355\u72EC\u5217\u793A\u3002'
        ]
      };
    }
  }
];

// src/core/calculators/index.ts
var CATEGORIES = [
  { id: "litigation", name: "\u8BC9\u8BBC\u8D39\u7528", desc: "\u6848\u4EF6\u53D7\u7406\u8D39\u3001\u4FDD\u5168\u8D39\u4E0E\u4FDD\u5168\u62C5\u4FDD\u8D39\u3001\u6267\u884C\u8D39\u3001\u5F8B\u5E08\u8D39\u3001\u516C\u544A\u516C\u8BC1\u9274\u5B9A\u8BC4\u4F30\u8D39\u4E0E\u603B\u6210\u672C\u6D4B\u7B97", accent: "#8b5cf6" },
  { id: "interest", name: "\u5229\u606F\u4E0E\u8FDD\u7EA6\u91D1", desc: "LPR \u5229\u606F\u3001\u8FDF\u5EF6\u5C65\u884C\u52A0\u500D\u5229\u606F\u3001\u8FDD\u7EA6\u91D1\u8BA1\u7B97\u4E0E\u53F8\u6CD5\u8C03\u6574", accent: "#ef4444" },
  { id: "labor", name: "\u52B3\u52A8\u4E89\u8BAE", desc: "\u7ECF\u6D4E\u8865\u507F\u3001\u8D54\u507F\u91D1\u3001\u52A0\u73ED\u8D39\u3001\u5DE5\u4F24\u5DE5\u4EA1\u4E0E\u7ADE\u4E1A\u9650\u5236\u8865\u507F", accent: "#f59e0b" },
  { id: "limitation", name: "\u65F6\u6548\u4E0E\u671F\u9650", desc: "\u8BC9\u8BBC\u65F6\u6548\u3001\u4E0A\u8BC9\u671F\u3001\u7533\u8BF7\u6267\u884C\u671F\u4E0E\u6CD5\u5B9A\u671F\u95F4\u63A8\u7B97", accent: "#06b6d4" },
  { id: "tax", name: "\u7A0E\u52A1", desc: "\u5370\u82B1\u7A0E\u3001\u4E2A\u4EBA\u6240\u5F97\u7A0E\u3001\u52B3\u52A1\u62A5\u916C\u3001\u8FDD\u7EA6\u91D1\u6D89\u7A0E\u4E0E\u7528\u5DE5\u6210\u672C", accent: "#10b981" },
  { id: "travel", name: "\u5DEE\u65C5\u8D39\u7528", desc: "\u5DEE\u65C5\u8865\u8D34\u6807\u51C6\u3001\u62A5\u9500\u6838\u7B97\u4E0E\u5E74\u5EA6\u9884\u7B97\u6D4B\u7B97", accent: "#3b82f6" },
  { id: "legalcost", name: "\u6CD5\u52A1\u6210\u672C", desc: "\u5355\u6848\u4EF6\u6210\u672C\u3001\u5F8B\u5E08\u8BA1\u8D39\u6BD4\u9009\u3001\u4E89\u8BAE\u8DEF\u5F84\u5BF9\u6BD4\u4E0E\u90E8\u95E8 ROI", accent: "#ec4899" }
];
var litigationTotal = litigationCalculators.filter((c) => c.id === "litigation-total");
var litigationBase = litigationCalculators.filter((c) => c.id !== "litigation-total");
var ALL_CALCULATORS = [
  ...litigationBase,
  ...otherFeeCalculators,
  ...litigationTotal,
  ...interestCalculators,
  ...laborCalculators,
  ...limitationCalculators,
  ...taxCalculators,
  ...travelCalculators,
  ...legalCostCalculators
];
function getCalculator(id) {
  return ALL_CALCULATORS.find((c) => c.id === id);
}
function getByCategory(id) {
  return ALL_CALCULATORS.filter((c) => c.category === id);
}
function searchCalculators(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ALL_CALCULATORS.filter((c) => {
    const haystack = [c.name, c.summary, ...c.keywords ?? []].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}
function defaultValues(def) {
  const v = {};
  for (const f of def.fields) {
    v[f.key] = f.defaultValue ?? (f.type === "select" ? f.options?.[0]?.value ?? "" : f.type === "switch" ? false : "");
  }
  return v;
}
export {
  ALL_CALCULATORS,
  CATEGORIES,
  defaultValues,
  getByCategory,
  getCalculator,
  searchCalculators
};
