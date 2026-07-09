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
const SOURCE_STATUS = {
  official: "OFFICIAL",
  trade: "TRADE",
  bom: "BOM",
  tn: "TN",
  tracking: "TRACKING",
  sns: "SNS_EST",
  calc: "CALC",
};
const JAPAN_CALIBRATION = {
  officialThreeDayGrossYenBillion: 24.151,
  officialThreeDayAdmissionsMillion: 1.64,
  trackedThreeDaySales: 1293102,
  yenPerTrackedPoint: 1868,
  firstDayGrossYenBillion: 4.84,
  firstDayTrackedSales: 248001,
  openingTrackedSales: {
    "2026/07/03": 248001,
    "2026/07/04": 481038,
    "2026/07/05": 564063,
  },
  fixedOpeningDailyGrossYenBillion: {
    "2026/07/03": 4.84,
    "2026/07/04": 8.891,
    "2026/07/05": 10.42,
  },
  note:
    "公式3日間興収24.151億円にP値推定を合わせるための補正係数。P値は全国動員そのものではなく販売数指標として扱う。",
};
const JAPAN_WEEKDAY_FACTORS = {
  0: 1.0,
  1: 1.0,
  2: 1.0,
  3: 0.93,
  4: 1.0,
  5: 1.0,
  6: 1.0,
};
const JAPAN_WEEKDAY_NOTES = {
  3: "水曜サービスデー補正",
};
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
          sourceStatus: SOURCE_STATUS.bom,
          unit: "USD million",
          status: current.fallback ? (key === "Japan" ? "公式累計・前回確認値" : "前回確認値") : key === "Japan" ? "公式累計反映" : "公開中",
        }
      : {
          name,
          flag,
          gross: null,
          growth: null,
          share: null,
          sourceStatus: null,
          unit: "USD million",
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
const compactNumber = (value) => {
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  return cleaned ? Number(cleaned) : null;
};
const yyyymmddToSlash = (value) =>
  value ? `${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}` : null;
const slashToYyyymmdd = (value) => String(value ?? "").replace(/\//g, "");
const addDaysRaw = (value, offset) => {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
};
const recentDateRaws = (latestRaw, count) =>
  Array.from({ length: count }, (_, index) => addDaysRaw(latestRaw, index - count + 1));
const dayOfWeekRaw = (value) => {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};
const timeMinutes = (value) => {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 24 * 60;
};
const dayProgressFactor = (timeLabel) => {
  if (!timeLabel || timeLabel === "最終") return 1;
  const minutes = timeMinutes(timeLabel);
  const hour = minutes / 60;
  const points = [
    [8, 0.04],
    [10, 0.10],
    [12, 0.24],
    [14, 0.42],
    [16, 0.58],
    [17, 0.68],
    [19, 0.90],
    [20, 0.95],
    [21, 0.98],
    [23, 1.00],
  ];
  if (hour <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i += 1) {
    const [h1, f1] = points[i - 1];
    const [h2, f2] = points[i];
    if (hour <= h2) return f1 + ((hour - h1) / (h2 - h1)) * (f2 - f1);
  }
  return 1;
};
const estimateJapanGrossYen = (trackedSales, coverage, progressFactor, dateRaw) => {
  if (!trackedSales) return null;
  const safeProgress = Math.max(0.04, Math.min(1, progressFactor || 1));
  const estimatedFullDaySales = Math.round(trackedSales / safeProgress);
  const date = yyyymmddToSlash(dateRaw);
  const officialFixed = JAPAN_CALIBRATION.fixedOpeningDailyGrossYenBillion[date];
  if (officialFixed != null) {
    return {
      low: officialFixed,
      base: officialFixed,
      high: officialFixed,
      estimatedFullDaySales,
      estimatedAllMarketSales: estimatedFullDaySales,
      yenPerTrackedPoint: round((officialFixed * 100000000) / estimatedFullDaySales, 0),
      weekdayFactor: 1,
      calibration: "公式3日間興収に整合するよう日別配分",
      sourceStatus: SOURCE_STATUS.official,
    };
  }
  const weekday = dateRaw ? dayOfWeekRaw(dateRaw) : null;
  const weekdayFactor = weekday == null ? 1 : JAPAN_WEEKDAY_FACTORS[weekday] ?? 1;
  const base = round((estimatedFullDaySales * JAPAN_CALIBRATION.yenPerTrackedPoint * weekdayFactor) / 100000000, 2);
  const low = round(base * (weekday === 3 ? 0.93 : 0.95), 2);
  const high = round(base * (weekday === 3 ? 1.08 : 1.07), 2);
  return {
    low,
    base,
    high,
    estimatedFullDaySales,
    estimatedAllMarketSales: estimatedFullDaySales,
    yenPerTrackedPoint: JAPAN_CALIBRATION.yenPerTrackedPoint,
    weekdayFactor,
    calibration: JAPAN_WEEKDAY_NOTES[weekday] ?? "公式3日間補正係数ベース",
    sourceStatus: SOURCE_STATUS.calc,
  };
};
const parseMimorinRow = (line, kind) => {
  const tokens = line.replace(/＊/g, "*").trim().split(/\s+/);
  const title = tokens.slice(kind === "seatPlan" ? 8 : 6).join(" ");
  if (!/トイ[・･]ストーリー[５5]/.test(title)) return null;
  if (kind === "seatPlan") {
    return {
      rank: compactNumber(tokens[0]),
      seats: compactNumber(tokens[1]),
      showings: compactNumber(tokens[2]),
      trackedTheaters: compactNumber(tokens[5]),
      allTheaters: compactNumber(tokens[6]),
      coverage: compactNumber(tokens[7]),
      title,
    };
  }
  return {
    rank: compactNumber(tokens[0]),
    sales: compactNumber(tokens[1]),
    seats: compactNumber(tokens[2]),
    showings: compactNumber(tokens[3]),
    theaters: compactNumber(tokens[4]),
    weekRatio: tokens[5] && tokens[5] !== "******" ? compactNumber(tokens[5]) : null,
    title,
  };
};
const parseMimorin = (html) => {
  if (!html) return null;
  const lines = clean(html)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const dailyCandidates = [];
  const seatPlans = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/デイリー.*ランキング/.test(line) && /202\d{5}/.test(line)) {
      const dateRaw = line.match(/：(\d{8})|:(\d{8})/)?.slice(1).find(Boolean);
      const hour = line.match(/（(\d{1,2})時中間集計）/)?.[1];
      const snapshotTime = hour ? `${hour.padStart(2, "0")}:00` : line.includes("中間集計") ? null : "最終";
      const independent = line.includes("独立系を含む");
      let tableStarted = false;
      for (let j = i + 1; j < Math.min(lines.length, i + 45); j += 1) {
        if (!tableStarted) {
          if (/順位\s+販売数\s+座席数/.test(lines[j])) tableStarted = true;
          continue;
        }
        if (
          lines[j] === "続きを読む" ||
          /座席数・上映回数・館数前日集計/.test(lines[j]) ||
          (/ランキング/.test(lines[j]) && /202\d{5}/.test(lines[j]))
        ) {
          break;
        }
        const row = parseMimorinRow(lines[j], "daily");
        if (!row) continue;
        dailyCandidates.push({
          ...row,
          dateRaw,
          date: yyyymmddToSlash(dateRaw),
          snapshotTime,
          independent,
          sourceTitle: line,
        });
        break;
      }
    }
    if (/座席数・上映回数・館数前日集計/.test(line) && /202\d{5}/.test(line)) {
      const dateRaw = line.match(/：(\d{8})|:(\d{8})/)?.slice(1).find(Boolean);
      let tableStarted = false;
      for (let j = i + 1; j < Math.min(lines.length, i + 45); j += 1) {
        if (!tableStarted) {
          if (/順位\s+座席数\s+回数/.test(lines[j])) tableStarted = true;
          continue;
        }
        if (
          lines[j] === "続きを読む" ||
          (/ランキング/.test(lines[j]) && /202\d{5}/.test(lines[j]))
        ) {
          break;
        }
        const row = parseMimorinRow(lines[j], "seatPlan");
        if (!row) continue;
        seatPlans.push({
          ...row,
          dateRaw,
          date: yyyymmddToSlash(dateRaw),
          sourceTitle: line,
        });
        break;
      }
    }
  }
  const latestDaily = dailyCandidates
    .filter((row) => row.dateRaw && row.sales)
    .sort(
      (a, b) =>
        b.dateRaw.localeCompare(a.dateRaw) ||
        timeMinutes(b.snapshotTime) - timeMinutes(a.snapshotTime) ||
        Number(b.independent) - Number(a.independent)
    )[0];
  const latestSeatPlan = seatPlans
    .filter((row) => row.dateRaw && row.seats)
    .sort((a, b) => b.dateRaw.localeCompare(a.dateRaw))[0];
  if (!latestDaily) return null;
  const coverage = latestSeatPlan?.coverage ?? null;
  const bestDailyByDate = new Map();
  for (const row of dailyCandidates.filter((candidate) => candidate.dateRaw && candidate.sales)) {
    const current = bestDailyByDate.get(row.dateRaw);
    const rowScore = timeMinutes(row.snapshotTime) * 10 + Number(row.independent);
    const currentScore = current ? timeMinutes(current.snapshotTime) * 10 + Number(current.independent) : -1;
    if (!current || rowScore > currentScore) bestDailyByDate.set(row.dateRaw, row);
  }
  const dailyTrend = [...bestDailyByDate.values()]
    .sort((a, b) => a.dateRaw.localeCompare(b.dateRaw))
    .slice(-10)
    .map((row) => {
      const factor = dayProgressFactor(row.snapshotTime);
      const rowEstimate = estimateJapanGrossYen(row.sales, coverage, factor, row.dateRaw);
      return {
        date: row.date,
        snapshotTime: row.snapshotTime || "速報",
        sourceScope: row.independent ? "独立系含む" : "通常集計",
        rank: row.rank,
        trackedSales: row.sales,
        seats: row.seats,
        seatOccupancy: row.seats ? round((row.sales / row.seats) * 100, 1) : null,
        estimatedFullDaySales: rowEstimate?.estimatedFullDaySales ?? null,
        estimatedGrossYen: rowEstimate
          ? { low: rowEstimate.low, base: rowEstimate.base, high: rowEstimate.high }
          : null,
        sourceStatus: rowEstimate?.sourceStatus ?? SOURCE_STATUS.tracking,
        calibration: rowEstimate?.calibration ?? null,
        yenPerTrackedPoint: rowEstimate?.yenPerTrackedPoint ?? null,
        weekdayFactor: rowEstimate?.weekdayFactor ?? null,
        coverage,
        progressFactor: round(factor, 3),
        status: row.snapshotTime === "最終" ? "最終販売速報" : "中間販売速報",
      };
    });
  const dailyTrendByDate = new Map(dailyTrend.map((row) => [slashToYyyymmdd(row.date), row]));
  const latestDailyRaw = latestDaily.dateRaw;
  const filledDailyTrend = latestDailyRaw
    ? recentDateRaws(latestDailyRaw, 7).map(
        (dateRaw) =>
          dailyTrendByDate.get(dateRaw) ?? {
            date: yyyymmddToSlash(dateRaw),
            snapshotTime: "未取得",
            sourceScope: "データなし",
            rank: null,
            trackedSales: null,
            seats: null,
            seatOccupancy: null,
            estimatedFullDaySales: null,
            estimatedGrossYen: null,
            sourceStatus: SOURCE_STATUS.tracking,
            calibration: null,
            yenPerTrackedPoint: null,
            weekdayFactor: null,
            coverage,
            progressFactor: null,
            status: "販売データなし",
          }
      )
    : dailyTrend.slice(-7);
  const progressFactor = dayProgressFactor(latestDaily.snapshotTime);
  const estimate = estimateJapanGrossYen(latestDaily.sales, coverage, progressFactor, latestDaily.dateRaw);
  return {
    date: latestDaily.date,
    updatedAt: `${latestDaily.date} ${latestDaily.snapshotTime || "速報"}`,
    snapshotTime: latestDaily.snapshotTime || "速報",
    rank: latestDaily.rank,
    trackedSales: latestDaily.sales,
    seats: latestDaily.seats,
    showings: latestDaily.showings,
    theaters: latestDaily.theaters,
    weekRatio: latestDaily.weekRatio,
    sourceScope: latestDaily.independent ? "独立系含む" : "通常集計",
    sourceStatus: SOURCE_STATUS.tracking,
    progressFactor: round(progressFactor, 3),
    seatOccupancy: latestDaily.seats ? round((latestDaily.sales / latestDaily.seats) * 100, 1) : null,
    dailyEstimateYen: estimate
      ? { low: estimate.low, base: estimate.base, high: estimate.high, sourceStatus: estimate.sourceStatus }
      : null,
    currentEstimateYen: estimate
      ? { low: estimate.low, base: estimate.base, high: estimate.high, sourceStatus: estimate.sourceStatus }
      : null,
    estimatedFullDaySales: estimate?.estimatedFullDaySales ?? null,
    estimatedAllMarketSales: estimate?.estimatedAllMarketSales ?? null,
    yenPerTrackedPoint: estimate?.yenPerTrackedPoint ?? null,
    weekdayFactor: estimate?.weekdayFactor ?? null,
    calibration: estimate?.calibration ?? null,
    dailyTrend: filledDailyTrend,
    seatPlan: latestSeatPlan
      ? {
          date: latestSeatPlan.date,
          seats: latestSeatPlan.seats,
          showings: latestSeatPlan.showings,
          trackedTheaters: latestSeatPlan.trackedTheaters,
          allTheaters: latestSeatPlan.allTheaters,
          coverage: latestSeatPlan.coverage,
        }
      : null,
    referenceCoverage: latestSeatPlan?.coverage ?? null,
    status: "興行収入を見守りたい！販売速報ベース・当日推定興収",
    method:
      "P値を全国動員そのものとは扱わず、公式3日間興収24.151億円に合わせた補正係数と曜日補正で興収換算した当日推定値。公式累計とは別扱いです。",
  };
};

const buildJapanDay10Watch = () => {
  const scenarios = [
    { label: "Conservative", value: 48.0, status: "未達", sourceStatus: SOURCE_STATUS.calc },
    { label: "Base", value: 49.3, status: "ほぼ接近", sourceStatus: SOURCE_STATUS.calc },
    { label: "Bull", value: 50.5, status: "突破", sourceStatus: SOURCE_STATUS.calc },
  ];
  return {
    title: "10日50億チャレンジ",
    targetYenBillion: 50,
    sourceStatus: SOURCE_STATUS.calc,
    items: [
      { label: "公式初週3日間", value: 24.151, unit: "JPY billion", sourceStatus: SOURCE_STATUS.official },
      { label: "5日目終了推定", value: 28.55, unit: "JPY billion", sourceStatus: SOURCE_STATUS.sns },
      { label: "6日目終了推定", valueRange: "30.8〜31.0", unit: "JPY billion", sourceStatus: SOURCE_STATUS.calc },
      { label: "7日目終了予測", valueRange: "32.2〜32.7", unit: "JPY billion", sourceStatus: SOURCE_STATUS.calc },
      { label: "2週目金土日予測", valueRange: "16.5〜17.8", unit: "JPY billion", sourceStatus: SOURCE_STATUS.calc },
      { label: "10日累計予測", valueRange: "48.8〜50.5", unit: "JPY billion", sourceStatus: SOURCE_STATUS.calc },
    ],
    scenarios: scenarios.map((scenario) => ({
      ...scenario,
      remainingToTarget: round(50 - scenario.value, 1),
      progress: round((scenario.value / 50) * 100, 1),
    })),
    note: "公式3日間24.151億円を起点に、4日目以降はP値補正・曜日補正で推定。公式予測ではありません。",
  };
};

const buildJapanUsdMission = (fx = 162) => {
  const usd100Line = round((fx * 100000000) / 100000000, 1);
  const fujiiForecast = 170;
  return {
    title: "日本1億ドルチャレンジ",
    fxYenPerUsd: fx,
    sourceStatus: SOURCE_STATUS.calc,
    usd100LineYenBillion: usd100Line,
    fujiiForecastYenBillion: fujiiForecast,
    fujiiForecastUsdMillion: round((fujiiForecast * 100000000) / fx / 1000000, 1),
    milestones: [
      { label: "100億円", value: 100 },
      { label: "120億円", value: 120 },
      { label: "150億円", value: 150 },
      { label: "$100Mライン", value: usd100Line, highlight: true },
      { label: "藤井予想", value: fujiiForecast, fujii: true },
    ],
    note:
      "為替換算は概算です。Box Office Mojo / The Numbers のUSD換算とは、反映日・為替レート・配給報告タイミングにより異なる場合があります。",
  };
};

const buildStaticDashboardData = () => ({
  sourceStatusLegend: [
    { code: SOURCE_STATUS.official, label: "公式発表" },
    { code: SOURCE_STATUS.trade, label: "業界媒体" },
    { code: SOURCE_STATUS.bom, label: "Box Office Mojo" },
    { code: SOURCE_STATUS.tn, label: "The Numbers" },
    { code: SOURCE_STATUS.tracking, label: "見守りP値など販売速報" },
    { code: SOURCE_STATUS.sns, label: "興行収入系SNS推定" },
    { code: SOURCE_STATUS.calc, label: "サイト側計算・派生推定" },
  ],
  worldwideForecastScenarios: [
    { label: "Conservative", range: "$950M〜$1.0B", note: "北米・海外が通常ペースで減速した場合", sourceStatus: SOURCE_STATUS.calc },
    { label: "Base", range: "$1.0B〜$1.08B", note: "日本・海外が粘り、10億ドルを突破する本線寄りシナリオ", sourceStatus: SOURCE_STATUS.calc },
    { label: "Bull", range: "$1.1B〜$1.2B", note: "日本・メキシコ・欧州・ラテンアメリカがかなり粘った場合", sourceStatus: SOURCE_STATUS.calc },
    { label: "Super Bull", range: "$1.25B+", note: "現時点ではかなり強気。公式予測ではない", sourceStatus: SOURCE_STATUS.calc },
  ],
  japanFinalForecastScenarios: [
    { label: "Conservative", range: "120〜130億円", note: "10日50億未満、夏休み中盤で減速した場合", sourceStatus: SOURCE_STATUS.calc },
    { label: "Base", range: "135〜150億円", note: "2週目以降も夏休みファミリー需要で堅調に推移した場合", sourceStatus: SOURCE_STATUS.calc },
    { label: "Bull", range: "150〜160億円", note: "2週目17億前後、7/24〜30週も強い場合", sourceStatus: SOURCE_STATUS.calc },
    {
      label: "Fujii Forecast",
      range: "170億円",
      note: "強気上振れシナリオ。公式予測ではない。10日50億近辺、夏休み平日、7/24〜30週、お盆前後の維持が必要",
      sourceStatus: SOURCE_STATUS.calc,
      fujii: true,
    },
  ],
  japanDay10Watch: buildJapanDay10Watch(),
  japanUsdMission: buildJapanUsdMission(162),
  summerCheckpoints: [
    { label: "Day 10", focus: "50億に届くか", good: "50億超え", watch: "48〜50億", danger: "47億未満" },
    { label: "海の日連休", focus: "連休で再加速できるか", good: "連休中に大きく上積み", watch: "通常推移", danger: "箱減・着席率低下" },
    { label: "7/24〜30週", focus: "夏休み平日で週間10億を守れるか", good: "10〜12億以上", watch: "8〜9億", danger: "6〜7億" },
    { label: "7/31以降", focus: "モアナ実写、クレしん等の競合後も箱と着席率を守れるか", good: "箱減でも着席率維持", watch: "ファミリー競合でやや鈍化", danger: "大幅箱削り" },
    { label: "お盆前", focus: "150〜170億ルートが残っているか", good: "100億到達が早い", watch: "150億は残る", danger: "130〜140億寄り" },
  ],
  competitionWatch: {
    northAmerica: [
      {
        title: "Moana live-action",
        note: "北米初動は強弱の予測幅が大きい。箱・ファミリー需要の競合だが、想定より弱いならTS5には追い風。",
        sourceStatus: SOURCE_STATUS.trade,
      },
      {
        title: "The Odyssey",
        note: "7/17の大きなWide競合。ファミリー直撃ではないが、IMAX/大箱に影響。",
        sourceStatus: SOURCE_STATUS.trade,
      },
      {
        title: "7/24 week",
        note: "大きな新作ファミリー競合が薄い場合、TS5の再安定チャンス。",
        sourceStatus: SOURCE_STATUS.calc,
      },
    ],
    japan: [
      { title: "7/24週", note: "ちいかわ、仮面ライダー等。夏休み需要と箱削りのバランスを見る。", sourceStatus: SOURCE_STATUS.calc },
      { title: "7/31以降", note: "モアナ実写、クレしん等。ファミリー競合後も箱と着席率を守れるかが焦点。", sourceStatus: SOURCE_STATUS.calc },
      { title: "7/24〜30 stress test", note: "夏休み平日で需要は上がるが、新作ファミリー作品でスクリーンが削られる可能性。", sourceStatus: SOURCE_STATUS.calc },
    ],
  },
  sourceCategories: [
    {
      category: "OFFICIAL",
      items: [
        { name: "Disney Japan公式・配給発表", url: "https://www.disney.co.jp/" },
        { name: "Disney / Pixar公式", url: "https://www.pixar.com/" },
      ],
    },
    {
      category: "BOX OFFICE DATABASE",
      items: [
        { name: "Box Office Mojo", url: "https://www.boxofficemojo.com/title/tt29355505/" },
        { name: "The Numbers", url: "https://www.the-numbers.com/movie/Toy-Story-5-%282026%29" },
      ],
    },
    {
      category: "TRADE MEDIA",
      items: [
        { name: "Variety", url: "https://variety.com/" },
        { name: "Deadline", url: "https://deadline.com/" },
        { name: "The Hollywood Reporter", url: "https://www.hollywoodreporter.com/" },
        { name: "AP News", url: "https://apnews.com/" },
      ],
    },
    {
      category: "JAPAN TRACKING",
      items: [
        { name: "興行収入を見守りたい！", url: "https://mimorin2014.com/?pc=" },
        { name: "販売P値スクリーンショット / 興行収入系SNS推定", url: "#" },
      ],
    },
    {
      category: "CALCULATION",
      items: [
        { name: "公式3日間興収によるP値補正", url: "#" },
        { name: "為替換算・10日累計予測・最終興収レンジ予測", url: "#" },
      ],
    },
  ],
});

const update = async () => {
  const data = readData();
  const previousWorld = data.summary?.worldwide ?? null;
  const [numbersHtml, mojoHtml, mimorinHomeHtml] = await Promise.all([
    fetchText("https://www.the-numbers.com/movie/Toy-Story-5-%282026%29"),
    fetchText("https://www.boxofficemojo.com/title/tt29355505/"),
    fetchText("https://mimorin2014.com/?pc=").catch((error) => {
      console.warn(`Mimorin skipped: ${error.message}`);
      return null;
    }),
  ]);
  const mimorinSeed = parseMimorin(mimorinHomeHtml);
  const mimorinArchiveHtmls = mimorinSeed?.date
    ? await Promise.all(
        recentDateRaws(slashToYyyymmdd(mimorinSeed.date), 7).map((dateRaw) =>
          fetchText(`https://mimorin2014.com/blog-date-${dateRaw}.html`).catch((error) => {
            console.warn(`Mimorin archive skipped ${dateRaw}: ${error.message}`);
            return null;
          })
        )
      )
    : [];
  const mimorinHtml = [mimorinHomeHtml, ...mimorinArchiveHtmls].filter(Boolean).join("\n");
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
  const mimorin = parseMimorin(mimorinHtml);
  const trendDate = shortDate(latest.isoDate);
  const existingTrend = data.worldwideTrend ?? [];
  const previousTrendRow = [...existingTrend].filter((row) => row.date !== trendDate).at(-1);
  const latestWorldDelta =
    previousTrendRow?.worldwide != null
      ? round(adopted.worldwide - previousTrendRow.worldwide, 6)
      : previousWorld == null
        ? null
        : round(adopted.worldwide - previousWorld, 6);

  data.updatedAt = jstStamp();
  data.dataThrough = latest.isoDate;
  data.worldDataThrough = latest.isoDate;
  data.headline = `世界累計 ${money(adopted.worldwide)}、$1Bまであと${money(1000 - adopted.worldwide)}。日本は10日50億チャレンジへ`;
  data.summary = {
    worldwide: adopted.worldwide,
    domestic: adopted.domestic,
    international: adopted.international,
    latestDaily: latest.gross,
    worldDelta: latestWorldDelta,
    billionProgress: round((adopted.worldwide / 1000) * 100, 1),
    sourceStatus: SOURCE_STATUS.tn,
  };
  data.forecast = {
    low: 950,
    base: 1040,
    high: 1200,
    confidence: "シナリオ型・分析推定",
    basis:
      "日本は公開3日間の公式発表値を基準にし、4日目以降はP値推定で補完。北米の下落率が重いため、$1.2BはBaseではなくBull寄りとして扱います。公式予測ではありません。",
    sourceStatus: SOURCE_STATUS.calc,
  };
  Object.assign(data, buildStaticDashboardData());
  data.japanCalibration = { ...JAPAN_CALIBRATION };

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
  if (data.japanFlash) {
    if (mimorin) {
      data.japanFlash = {
        ...data.japanFlash,
        ...mimorin,
        grossEstimateYen: mimorin.dailyEstimateYen ?? data.japanFlash.grossEstimateYen,
      };
      data.japanDailyTrend = mimorin.dailyTrend;
      data.japanFlashDate = mimorin.date;
      data.japanTrackingUpdatedAt = data.updatedAt;
    }
    if (japan && japan.gross != null) {
      data.japanFlash.officialGrossUsd = japan.gross;
      data.japanFlash.status = mimorin
        ? "Box Office Mojoの日本累計と、興行収入を見守りたい！の当日販売速報を併記。"
        : "Box Office Mojoで日本累計が公式反映。販売速報は前回値として保持。";
    }
    data.japanFlash.officialOpening = {
      grossYenBillion: JAPAN_CALIBRATION.officialThreeDayGrossYenBillion,
      admissionsMillion: JAPAN_CALIBRATION.officialThreeDayAdmissionsMillion,
      days: 3,
      sourceStatus: SOURCE_STATUS.official,
      note: "公開3日間の公式・報道ベース値。P値推定の校正基準。",
    };
    data.japanFlash.pValueNote =
      "P値は全国動員数そのものではなく、取得対象館のチケット販売数指標です。興収推定には公式値との補正が必要です。";
  }
  data.marketOpeningComparisons = {
    ...data.marketOpeningComparisons,
    日本: {
      unit: "JPY billion",
      note: "日本比較は円建て。USD換算は為替・反映日で変動するため別扱い。",
      entries: [
        {
          title: "トイ・ストーリー5",
          gross: JAPAN_CALIBRATION.officialThreeDayGrossYenBillion,
          openingGross: JAPAN_CALIBRATION.officialThreeDayGrossYenBillion,
          days: 3,
          admissionsMillion: JAPAN_CALIBRATION.officialThreeDayAdmissionsMillion,
          sourceStatus: SOURCE_STATUS.official,
          color: "#e4322b",
          current: true,
        },
      ],
    },
  };

  data.checks = [
    {
      metric: "北米累計",
      adopted: adopted.domestic,
      adoptedUnit: "USD million",
      adoptedSourceStatus: SOURCE_STATUS.tn,
      alternate: mojo.domestic,
      alternateUnit: "USD million",
      alternateSourceStatus: SOURCE_STATUS.bom,
      difference: mojo.domestic == null ? null : round(adopted.domestic - mojo.domestic, 6),
      differenceUnit: "USD million",
      note: "The Numbersを採用。Box Office Mojoとの差は更新時刻差として記録。",
    },
    {
      metric: "海外累計",
      adopted: adopted.international,
      adoptedUnit: "USD million",
      adoptedSourceStatus: SOURCE_STATUS.tn,
      alternate: mojo.international,
      alternateUnit: "USD million",
      alternateSourceStatus: SOURCE_STATUS.bom,
      difference: mojo.international == null ? null : round(adopted.international - mojo.international, 6),
      differenceUnit: "USD million",
      note: "The Numbersを採用。国別内訳はBox Office Mojoで補強。",
    },
    {
      metric: "世界累計",
      adopted: adopted.worldwide,
      adoptedUnit: "USD million",
      adoptedSourceStatus: SOURCE_STATUS.tn,
      alternate: mojo.worldwide,
      alternateUnit: "USD million",
      alternateSourceStatus: SOURCE_STATUS.bom,
      difference: mojo.worldwide == null ? null : round(adopted.worldwide - mojo.worldwide, 6),
      differenceUnit: "USD million",
      note: "The Numbersを採用。BOMとの差は主に更新時刻差。BOMは国別確認に使用。",
    },
    {
      metric: `${latest.date}北米日次`,
      adopted: latest.gross,
      adoptedUnit: "USD million",
      adoptedSourceStatus: SOURCE_STATUS.tn,
      alternate: null,
      difference: null,
      note: "The Numbers日次確定値。",
    },
    {
      metric: "日本BOM累計",
      adopted: japan?.gross ?? null,
      adoptedUnit: "USD million",
      adoptedSourceStatus: SOURCE_STATUS.bom,
      alternate: null,
      difference: null,
      note: "BOMの日本累計USD。円建て当日推定とは比較しない。",
    },
    {
      metric: "日本当日P値推定",
      adopted: data.japanFlash?.dailyEstimateYen?.base ?? data.japanFlash?.grossEstimateYen?.base ?? null,
      adoptedUnit: "JPY billion",
      adoptedSourceStatus: SOURCE_STATUS.calc,
      alternate: data.japanFlash?.trackedSales ?? null,
      alternateUnit: "P",
      alternateSourceStatus: SOURCE_STATUS.tracking,
      difference: null,
      note: "公式3日間興収で校正したP値ベース推定。BOM累計USDとは別枠。",
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
    data.japanFlash?.dailyEstimateYen
      ? `日本速報は${data.japanFlash.date} ${data.japanFlash.snapshotTime}時点で販売${data.japanFlash.trackedSales.toLocaleString("ja-JP")}、当日推定興収は約${data.japanFlash.dailyEstimateYen.base.toFixed(2)}億円（${data.japanFlash.sourceScope}）。`
      : "日本速報は販売サイトの取得状況により未更新。公式累計と次回速報を分けて確認する。",
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

  data.outlook = `世界最終はBase $1.0B〜$1.08B、$1.2BはBull寄り。日本は公開3日間24.151億円の公式値を基準に、4日目以降はP値補正で観測する。藤井予想170億は本線ではなく強気上振れシナリオとして管理。`;
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
