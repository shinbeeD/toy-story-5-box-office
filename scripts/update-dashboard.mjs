import fs from "node:fs";
import vm from "node:vm";

const DATA_FILE = "data.js";
const MONEY = /\$([\d,]+)/;
const UA =
  "Mozilla/5.0 (compatible; ToyStory5BoxOfficeDashboard/1.0; +https://github.com/shinbeeD/toy-story-5-box-office)";

const number = (value) => Number(String(value).replace(/[$,]/g, ""));
const toM = (value) => Math.round((number(value) / 1_000_000) * 1_000_000) / 1_000_000;
const pct = (value) => (value == null ? null : Number(String(value).replace(/[+%]/g, "")));
const round = (value, digits = 3) =>
  value == null ? null : Number(Number(value).toFixed(digits));
const money = (value, digits = 2) => `$${Number(value).toFixed(digits)}M`;
const formatDate = (date) => {
  const months = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };
  const match = String(date).match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})$/);
  if (!match) return String(date);
  return `${match[3]}-${months[match[1]]}-${match[2].padStart(2, "0")}`;
};
const shortDate = (isoDate) => {
  const [, month, day] = isoDate.match(/^\d{4}-(\d{2})-(\d{2})$/) || [];
  return month && day ? `${Number(month)}/${Number(day)}` : isoDate;
};
const jstStamp = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(" ", " ") + " JST";

const readData = () => {
  const code = fs.readFileSync(DATA_FILE, "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { filename: DATA_FILE });
  return sandbox.window.BOX_OFFICE_DATA;
};

const writeData = (data) => {
  fs.writeFileSync(DATA_FILE, `window.BOX_OFFICE_DATA = ${stableStringify(data)};\n`);
};

const stableStringify = (value, depth = 0) => {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((item) => `${"  ".repeat(depth + 1)}${stableStringify(item, depth + 1)}`);
    return `[\n${items.join(",\n")}\n${"  ".repeat(depth)}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    const body = entries
      .map(([key, item]) => `${"  ".repeat(depth + 1)}${JSON.stringify(key)}: ${stableStringify(item, depth + 1)}`)
      .join(",\n");
    return `{\n${body}\n${"  ".repeat(depth)}}`;
  }
  return JSON.stringify(value);
};

const fetchText = async (url) => {
  const response = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
};

const clean = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/<\/tr>|<\/p>|<br\s*\/?>|<\/h\d>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();

const parseSummary = (text) => {
  const domestic = text.match(/Domestic(?: Box Office|\s+\([^)]*\))\s+\$([\d,]+)/);
  const international = text.match(/International(?: Box Office|\s+\([^)]*\))\s+\$([\d,]+)/);
  const worldwide = text.match(/Worldwide(?: Box Office)?\s+\$([\d,]+)/);
  return {
    domestic: domestic ? toM(domestic[0].match(MONEY)[1]) : null,
    international: international ? toM(international[0].match(MONEY)[1]) : null,
    worldwide: worldwide ? toM(worldwide[0].match(MONEY)[1]) : null,
  };
};

const parseDaily = (text) => {
  const section = text.split("Daily Box Office Performance").slice(1).join("Daily Box Office Performance");
  const beforeWeekly = section.split("Weekly Box Office Performance")[0] || section;
  const re =
    /([A-Z][a-z]{2}\s+\d{1,2},\s+20\d{2})\s+(P|\d+|-)\s+\$([\d,]+)(?:\s+([+-]\d+%))?(?:\s+([+-]\d+%))?\s+([\d,]+|0)\s+\$?([\d,]+)?\s+\$([\d,]+)(?:\s+(\d+))?/g;
  const rows = [];
  let match;
  while ((match = re.exec(beforeWeekly))) {
    if (match[2] === "P" || !match[9]) continue;
    rows.push({
      date: shortDate(formatDate(match[1])),
      isoDate: formatDate(match[1]),
      rank: match[2] === "-" ? null : Number(match[2]),
      gross: toM(match[3]),
      dod: pct(match[4]),
      wow: pct(match[5]),
      theaters: number(match[6]),
      cumulative: toM(match[8]),
      days: Number(match[9]),
    });
  }
  return rows;
};

const parseWeekends = (text) => {
  const section = text.split("Weekend Box Office Performance")[1]?.split("Daily Box Office Performance")[0] || "";
  const re =
    /([A-Z][a-z]{2}\s+\d{1,2},\s+20\d{2})\s+(\d+|-)\s+\$([\d,]+)(?:\s+([+-]\d+%))?\s+([\d,]+)\s+\$([\d,]+)\s+\$([\d,]+)\s+(\d+)/g;
  const rows = [];
  let match;
  while ((match = re.exec(section))) {
    rows.push({
      date: shortDate(formatDate(match[1])),
      isoDate: formatDate(match[1]),
      rank: match[2] === "-" ? null : Number(match[2]),
      gross: toM(match[3]),
      change: pct(match[4]),
      theaters: number(match[5]),
      cumulative: toM(match[7]),
      week: Number(match[8]),
    });
  }
  return rows;
};

const parseBOM = (text, worldwide) => {
  const flat = text.replace(/\s+/g, " ");
  const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fallbackByKey = {
    Mexico: { opening: 25.863, gross: 59.128, releaseDate: "Jun 18, 2026", fallback: true },
    "United Kingdom": { opening: 20.312, gross: 50.378, releaseDate: "Jun 19, 2026", fallback: true },
    China: { opening: 17.983, gross: 36.999, releaseDate: "Jun 19, 2026", fallback: true },
    France: { opening: 7.320, gross: 21.070, releaseDate: "Jun 17, 2026", fallback: true },
    Brazil: { opening: 6.539, gross: 16.994, releaseDate: "Jun 18, 2026", fallback: true },
    Australia: { opening: 6.844, gross: 19.379, releaseDate: "Jun 18, 2026", fallback: true },
    "South Korea": { opening: 5.936, gross: 14.849, releaseDate: "Jun 17, 2026", fallback: true },
    Japan: { opening: null, gross: 14.562, releaseDate: "Jul 3, 2026", fallback: true },
  };
  const findCountry = (key) => {
    const re = new RegExp(
      `${escapeRe(key)}\\s+([A-Z][a-z]{2}\\s+\\d{1,2},\\s+20\\d{2})\\s*(?:\\$([\\d,]+)|–|-)?\\s*\\$([\\d,]+)`
    );
    const match = flat.match(re);
    return match
      ? {
          opening: match[2] ? toM(match[2]) : null,
          gross: toM(match[3]),
          releaseDate: match[1],
        }
      : null;
  };
  const config = [
    ["Mexico", "メキシコ", "🇲🇽"],
    ["United Kingdom", "英国", "🇬🇧"],
    ["China", "中国", "🇨🇳"],
    ["France", "フランス", "🇫🇷"],
    ["Brazil", "ブラジル", "🇧🇷"],
    ["Australia", "オーストラリア", "🇦🇺"],
    ["South Korea", "韓国", "🇰🇷"],
    ["Japan", "日本", "🇯🇵"],
  ];
  return config.map(([key, name, flag]) => {
    const current = findCountry(key) ?? fallbackByKey[key];
    return current
      ? {
          name,
          flag,
          gross: round(current.gross, 3),
          growth: current.opening == null ? null : round(current.gross - current.opening, 3),
          share: worldwide ? round((current.gross / worldwide) * 100, 1) : null,
          status: current.fallback ? (key === "Japan" ? "公式累計・前回確認値" : "前回確認値") : key === "Japan" ? "公式累計反映" : "公開中",
        }
      : {
          name,
          flag,
          gross: null,
          growth: null,
          share: null,
          status: "未更新",
        };
  });
};

const PEERS = [
  {
    title: "インサイド・ヘッド2",
    color: "#7357c7",
    url: "https://www.the-numbers.com/movie/Inside-Out-2-%282024%29",
  },
  {
    title: "インクレディブル・ファミリー",
    color: "#1676c3",
    url: "https://www.the-numbers.com/movie/Incredibles-2-The-%282018%29",
  },
  {
    title: "アナと雪の女王2",
    color: "#53a7c8",
    url: "https://www.the-numbers.com/movie/Frozen-II-%282019%29",
  },
  {
    title: "トイ・ストーリー4",
    color: "#39a96b",
    url: "https://www.the-numbers.com/movie/Toy-Story-4-%282019%29",
  },
  {
    title: "ズートピア2",
    color: "#8a9bab",
    url: "https://www.the-numbers.com/movie/Zootopia-2-%282025%29",
  },
];

const fetchPeer = async (peer) => {
  try {
    const html = await fetchText(peer.url);
    const text = clean(html);
    return {
      ...peer,
      summary: parseSummary(text),
      daily: parseDaily(text),
      weekends: parseWeekends(text),
    };
  } catch (error) {
    console.warn(`Peer skipped: ${peer.title}: ${error.message}`);
    return null;
  }
};

const byDay = (rows, day) => rows.find((row) => row.days === day);
const byWeek = (rows, week) => rows.find((row) => row.week === week);

const update = async () => {
  const data = readData();
  const previousWorld = data.summary?.worldwide ?? null;
  const [numbersHtml, mojoHtml] = await Promise.all([
    fetchText("https://www.the-numbers.com/movie/Toy-Story-5-%282026%29"),
    fetchText("https://www.boxofficemojo.com/title/tt29355505/"),
  ]);
  const numbersText = clean(numbersHtml);
  const mojoText = clean(mojoHtml);
  const numbers = parseSummary(numbersText);
  const mojo = parseSummary(mojoText);
  const daily = parseDaily(numbersText);
  const weekends = parseWeekends(numbersText);
  if (!daily.length) throw new Error("No daily rows parsed from The Numbers.");
  const latest = daily[daily.length - 1];
  const latestWeekend = weekends[weekends.length - 1];
  const peers = (await Promise.all(PEERS.map(fetchPeer))).filter(Boolean);

  const adopted = {
    domestic: numbers.domestic ?? mojo.domestic ?? data.summary.domestic,
    international: numbers.international ?? mojo.international ?? data.summary.international,
    worldwide: numbers.worldwide ?? mojo.worldwide ?? data.summary.worldwide,
  };
  const parsedMarkets = parseBOM(mojoText, adopted.worldwide);
  const japanMarket = parsedMarkets.find((market) => market.name === "日本");
  const latestWorldDelta =
    previousWorld == null ? null : round(adopted.worldwide - previousWorld, 6);

  data.updatedAt = jstStamp();
  data.dataThrough = latest.isoDate;
  data.headline = `世界累計 ${money(adopted.worldwide)}。${japanMarket?.gross ? `日本累計${money(japanMarket.gross)}も反映、` : ""}北米は公開${latest.days}日目で${money(adopted.domestic)}`;
  data.summary = {
    worldwide: adopted.worldwide,
    domestic: adopted.domestic,
    international: adopted.international,
    latestDaily: latest.gross,
    worldDelta: latestWorldDelta,
    billionProgress: round((adopted.worldwide / 1000) * 100, 1),
  };

  data.daily = daily.slice(-7).map(({ date, gross, dod, wow, cumulative }) => ({
    date,
    gross,
    dod,
    wow,
    cumulative,
  }));

  data.weekends = [
    ...weekends.slice(-3).map(({ week, gross, change, cumulative, rank }) => ({
      week,
      gross,
      change,
      cumulative,
      rank,
    })),
  ];
  while (data.weekends.length < 3) {
    data.weekends.push({ week: data.weekends.length + 1, gross: null, change: null, cumulative: null, rank: null });
  }

  const trendDate = shortDate(latest.isoDate);
  const existingTrend = data.worldwideTrend ?? [];
  const nextTrend = {
    date: trendDate,
    label: "最新公表",
    domestic: adopted.domestic,
    international: adopted.international,
    worldwide: adopted.worldwide,
    increase: latestWorldDelta,
    status: "The Numbers更新値",
    latest: true,
  };
  data.worldwideTrend = [
    ...existingTrend
      .filter((row) => row.date !== trendDate)
      .map((row) => ({ ...row, latest: false })),
    nextTrend,
  ].slice(-8);

  data.markets = parsedMarkets;
  const japan = japanMarket;
  if (japan && japan.gross != null && data.japanFlash) {
    data.japanFlash.officialGrossUsd = japan.gross;
    data.japanFlash.status = "Box Office Mojoで日本累計が公式反映。販売速報は初日参考値として保持。";
  }

  data.checks = [
    {
      metric: "北米累計",
      adopted: adopted.domestic,
      alternate: mojo.domestic,
      difference: mojo.domestic == null ? null : round(adopted.domestic - mojo.domestic, 6),
      note: "The Numbersを採用。Box Office Mojoとの差は更新時刻差として記録。",
    },
    {
      metric: "海外累計",
      adopted: adopted.international,
      alternate: mojo.international,
      difference: mojo.international == null ? null : round(adopted.international - mojo.international, 6),
      note: "The Numbersを採用。国別内訳はBox Office Mojoで補強。",
    },
    {
      metric: "世界累計",
      adopted: adopted.worldwide,
      alternate: mojo.worldwide,
      difference: mojo.worldwide == null ? null : round(adopted.worldwide - mojo.worldwide, 6),
      note: "The Numbersを採用。BOMは国別確認に使用。",
    },
    {
      metric: `${latest.date}北米日次`,
      adopted: latest.gross,
      alternate: null,
      difference: null,
      note: "The Numbers日次確定値。",
    },
    {
      metric: `日本累計`,
      adopted: japan?.gross ?? null,
      alternate: data.japanFlash?.grossEstimateYen?.base ?? null,
      difference: null,
      note: "BOMの日本累計USDを採用。円建て販売速報は公式興収ではないため差額比較しない。",
    },
  ];

  const peerByTitle = new Map(peers.map((peer) => [peer.title, peer]));
  const dayRows = [
    {
      title: "トイ・ストーリー5",
      cumulative: latest.cumulative,
      difference: 0,
      index: 100,
      current: true,
    },
    ...PEERS.map((peerConfig) => {
      const peer = peerByTitle.get(peerConfig.title);
      const row = peer ? byDay(peer.daily, latest.days) : null;
      return row
        ? {
            title: peerConfig.title,
            cumulative: row.cumulative,
            difference: round(row.cumulative - latest.cumulative, 6),
            index: round((row.cumulative / latest.cumulative) * 100, 1),
          }
        : null;
    }).filter(Boolean),
  ]
    .sort((a, b) => b.cumulative - a.cumulative)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  data.dayMatchedDay = latest.days;
  data.comparisons = dayRows;

  const weekRows = [
    {
      title: "トイ・ストーリー5",
      gross: latestWeekend.gross,
      change: latestWeekend.change,
      difference: 0,
      current: true,
    },
    ...PEERS.map((peerConfig) => {
      const peer = peerByTitle.get(peerConfig.title);
      const row = peer ? byWeek(peer.weekends, latestWeekend.week) : null;
      return row
        ? {
            title: peerConfig.title,
            gross: row.gross,
            change: row.change,
            difference: round(row.gross - latestWeekend.gross, 6),
          }
        : null;
    }).filter(Boolean),
  ].sort((a, b) => b.gross - a.gross);
  data.weekendMatchedWeek = latestWeekend.week;
  data.weekendComparisons = weekRows;

  const dayPoints = [3, 7, 10, 14, 17, 24].filter((day) => day <= Math.max(24, latest.days));
  if (!dayPoints.includes(latest.days) && latest.days < 24) {
    const insertAt = dayPoints.findIndex((day) => day > latest.days);
    dayPoints.splice(insertAt === -1 ? dayPoints.length : insertAt, 0, latest.days);
  }
  const finalDomesticProjection = data.trajectory?.series?.find((row) => row.title === "TS5 推移イメージ")?.values?.at(-1) ?? 525;
  const projectedDay24 = latest.days >= 24 ? null : Math.max(latest.cumulative, Math.min(finalDomesticProjection * 0.82, latest.cumulative + 55));
  data.trajectory = {
    labels: [...dayPoints.map((day) => `Day ${day}`), "最終"],
    unit: "北米累計（$M）",
    series: [
      {
        title: "トイ・ストーリー5",
        color: "#e4322b",
        values: [...dayPoints.map((day) => byDay(daily, day)?.cumulative ?? null), null],
        current: true,
      },
      {
        title: "TS5 推移イメージ",
        color: "#f0b821",
        values: [
          ...dayPoints.map((day) =>
            day === latest.days ? latest.cumulative : day === 24 && projectedDay24 ? projectedDay24 : null
          ),
          finalDomesticProjection,
        ],
        projected: true,
      },
      ...PEERS.map((peerConfig) => {
        const peer = peerByTitle.get(peerConfig.title);
        const summary = peer?.summary;
        return {
          title: peerConfig.title,
          color: peerConfig.color,
          values: [
            ...dayPoints.map((day) => (peer ? byDay(peer.daily, day)?.cumulative ?? null : null)),
            summary?.domestic ?? data.trajectory?.series?.find((row) => row.title === peerConfig.title)?.values?.at(-1) ?? null,
          ],
        };
      }),
    ],
  };

  data.worldComparisons = PEERS.map((peerConfig) => {
    const peer = peerByTitle.get(peerConfig.title);
    const existing = data.worldComparisons?.find((row) => row.title === peerConfig.title);
    const opening = peer ? byDay(peer.daily, 3)?.cumulative : null;
    return {
      title: peerConfig.title,
      color: peerConfig.color,
      opening: opening ?? existing?.opening ?? null,
      final: peer?.summary?.worldwide ?? existing?.final ?? null,
    };
  });

  data.insights = [
    `公開${latest.days}日目の北米累計は${money(latest.cumulative)}。同日比較では${dayRows.length}作品中${dayRows.find((row) => row.current)?.rank ?? "—"}位。`,
    `第${latestWeekend.week}週末は${money(latestWeekend.gross)}で前週比${latestWeekend.change == null ? "未更新" : `${Math.abs(latestWeekend.change).toFixed(1)}%減`}。祝日週末後の平日推移を注視。`,
    `${latest.date}の日次興収は${money(latest.gross)}、前週同曜日比${latest.wow == null ? "未更新" : `${Math.abs(latest.wow).toFixed(1)}%減`}。競合ファミリー作品の流入下でも累計は着実に上積み。`,
    `海外累計は${money(adopted.international)}、世界比${((adopted.international / adopted.worldwide) * 100).toFixed(1)}%。日本累計${japan?.gross ? money(japan.gross) : "未更新"}の反映で海外比率が上昇。`,
    "同日比較には公開曜日・祝日・上映館数・為替差があるため、順位だけでなく下落率と海外比率を合わせて見る。",
  ];

  data.competition = {
    current: {
      label: "今週の競合",
      title: "Minions & Monstersが首位、TS5は2位で粘る",
      stat: `TS5第${latestWeekend.week}週末 ${money(latestWeekend.gross)}／${latestWeekend.theaters?.toLocaleString?.("en-US") ?? "—"}館。前週比${latestWeekend.change == null ? "未更新" : `${Math.abs(latestWeekend.change).toFixed(1)}%減`}。`,
      impact:
        "事実: 家族・アニメ層の競合作品が首位化し、TS5はスクリーンと客層の両面で競合。分析: 週末の落ち込みは強いが、平日での上積みと日本反映が世界累計を支えている。",
    },
    next: {
      label: "次週の注意",
      title: "第4週以降は上映枠と海外伸びが焦点",
      stat: "北米は新作流入で上映枠の再配分が続く。海外は日本を含む主要市場の累計更新待ち。",
      impact:
        "分析: 北米の最終値は週末下落率次第で上下しやすい一方、世界累計は海外比率の上昇で$1B到達シナリオを維持。",
    },
  };

  data.outlook = `北米は最終${money(finalDomesticProjection)}前後、世界最終は${money(data.forecast.low)}〜${money(data.forecast.high)}（中心${money(data.forecast.base)}）を継続。日本の公式累計反映で海外側の厚みが増したが、競合ファミリー作の影響で北米の週末下落率には注意。`;
  data.sources = [
    { name: "The Numbers", url: "https://www.the-numbers.com/movie/Toy-Story-5-%282026%29" },
    { name: "Box Office Mojo", url: "https://www.boxofficemojo.com/title/tt29355505/" },
    { name: "興行収入を見守りたい！ 日本販売速報", url: "https://mimorin2014.com/?pc=" },
    { name: "AP News", url: "https://apnews.com/" },
  ];

  writeData(data);
  console.log(`Updated through ${latest.isoDate}: ${money(adopted.worldwide)} worldwide.`);
};

update().catch((error) => {
  console.error(error);
  process.exit(1);
});
