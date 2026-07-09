const D = window.BOX_OFFICE_DATA || {};
const J = D.japanFlash || {};

const $ = (selector) => document.querySelector(selector);
const setHTML = (selector, html) => {
  const el = $(selector);
  if (el) el.innerHTML = html;
};
const setText = (selector, text) => {
  const el = $(selector);
  if (el) el.textContent = text;
};

const numberJa = (value) => (value == null ? "未更新" : Number(value).toLocaleString("ja-JP"));
const money = (value, digits = 2) => (value == null ? "未更新" : `$${Number(value).toFixed(digits)}M`);
const billion = (value) => (value == null ? "未更新" : `$${(Number(value) / 1000).toFixed(2)}B`);
const yenOku = (value, digits = 2) => (value == null ? "未更新" : `${Number(value).toFixed(digits)}億円`);
const pctText = (value, digits = 1) => (value == null ? "未更新" : `${Number(value).toFixed(digits)}%`);
const pValueText = (value) => (value == null ? "未取得" : `${numberJa(value)}P`);
const safe = (value) => (value == null || value === "" ? "未更新" : value);
const sourceClass = (status) => String(status || "").toLowerCase().replace(/_/g, "-");
const sourceTag = (status) =>
  status ? ` <span class="source-tag source-${sourceClass(status)}">[${status}]</span>` : "";
const valueWithSource = (value, status) =>
  `<span class="value-source"><span>${value}</span>${sourceTag(status)}</span>`;
const formatUnitValue = (value, unit, digits = 2) => {
  if (value == null) return "—";
  if (/JPY billion/i.test(unit || "")) return yenOku(value, digits);
  if (/USD million/i.test(unit || "")) return money(value, digits);
  if (/P$/i.test(unit || "") || unit === "P") return pValueText(value);
  if (/percent|%/i.test(unit || "")) return pctText(value, digits);
  if (unit) return `${Number(value).toFixed(digits)} ${unit}`;
  return money(value, digits);
};
const formatScenarioValue = (item) => {
  if (item.valueRange) {
    if (/JPY billion/i.test(item.unit || "")) return `${item.valueRange}億円`;
    return `${item.valueRange}${item.unit ? ` ${item.unit}` : ""}`;
  }
  return formatUnitValue(item.value, item.unit, item.value >= 100 ? 1 : 3).replace(".000", "");
};
const trackingTimeLabel = (label) => {
  if (!label) return "速報";
  if (label === "最終") return "P値最終";
  return label;
};
const delta = (value) =>
  value == null
    ? '<span class="muted">未更新</span>'
    : `<span class="${value >= 0 ? "up" : "down"}">${value >= 0 ? "▲" : "▼"} ${Math.abs(value).toFixed(1)}%</span>`;
const diff = (value) =>
  value === 0 || value == null
    ? value == null
      ? '<span class="muted">—</span>'
      : "—"
    : `<span class="${value > 0 ? "up" : "down"}">${value > 0 ? "▲" : "▼"} ${money(Math.abs(value))}</span>`;
const previousWeekDate = (date) => {
  const [month, day] = String(date).split("/").map(Number);
  const d = new Date(Date.UTC(2026, month - 1, day - 7));
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};
const weekDelta = (row) => {
  if (row.wow == null) return '<span class="no-compare">比較データなし</span>';
  const priorGross = row.gross / (1 + row.wow / 100);
  return `<span class="week-delta"><span class="${row.wow >= 0 ? "up" : "down"}">${row.wow >= 0 ? "▲" : "▼"} ${Math.abs(row.wow).toFixed(1)}%</span><small>vs ${previousWeekDate(row.date)} ${money(priorGross)}</small></span>`;
};

setText("#headline", D.headline || "");
const updatedLine = [
  `手動反映 ${safe(D.updatedAt)}`,
  `世界公表値 ${safe(D.worldDataThrough || D.dataThrough)}まで`,
  `日本速報 ${safe(D.japanFlashDate || J.date)}`,
].join(" ／ ");
setText("#updated", updatedLine);
setText("#progress-label", `${Number(D.summary?.billionProgress || 0).toFixed(1)}%`);
const progressBar = $("#progress-bar");
if (progressBar) progressBar.style.width = `${Math.min(100, Number(D.summary?.billionProgress || 0))}%`;

const renderUpdateMeta = () => {
  const rows = [
    { label: "公表値・手動反映", value: safe(D.updatedAt), status: "CALC" },
    { label: "世界興収データ対象", value: safe(D.worldDataThrough || D.dataThrough), status: D.summary?.sourceStatus || "TN" },
    { label: "日本速報対象日", value: safe(D.japanFlashDate || J.date), status: "TRACKING" },
    { label: "日本P値取得・更新", value: safe(D.japanTrackingUpdatedAt || J.updatedAt), status: "TRACKING" },
  ];
  setHTML(
    "#update-meta",
    `<div class="meta-grid">${rows
      .map((row) => `<div class="meta-card"><small>${row.label}</small><strong>${row.value}</strong>${sourceTag(row.status)}</div>`)
      .join("")}</div><details class="compact-details"><summary>更新ルール</summary><p>公表値・手動反映は原則毎朝6:00更新。日本速報・当日推定は取得できたタイミングで随時更新。国別市場データは公表スナップショットのみ反映します。</p></details>`
  );
};
renderUpdateMeta();

const renderKpis = () => {
  const summary = D.summary || {};
  const world = summary.worldwide || 0;
  const domesticShare = world ? (summary.domestic / world) * 100 : null;
  const intlShare = world ? (summary.international / world) * 100 : null;
  const latest = Array.isArray(D.daily) ? D.daily[D.daily.length - 1] : null;
  const kpiData = [
    ["WORLDWIDE", money(summary.worldwide), `前回公表比 +${money(summary.worldDelta)}`, "🌐", summary.sourceStatus || "TN"],
    ["NORTH AMERICA", money(summary.domestic), `世界比 ${pctText(domesticShare)}`, "🚀", "TN"],
    ["INTERNATIONAL", money(summary.international), `世界比 ${pctText(intlShare)}`, "🌍", "TN"],
    ["LATEST DAILY", money(summary.latestDaily), `${latest?.date || "直近"} 北米日次`, "⭐", "TN"],
  ];
  setHTML(
    "#kpis",
    kpiData
      .map(
        (x) =>
          `<div class="kpi"><span class="toy">${x[3]}</span><label>${x[0]}</label><strong>${x[1]}</strong><span>${x[2]}</span>${sourceTag(x[4])}</div>`
      )
      .join("")
  );
};
renderKpis();

const renderJapanDay10Watch = () => {
  const watch = D.japanDay10Watch;
  if (!watch) return;
  const target = watch.targetYenBillion || 50;
  const base = watch.scenarios?.find((x) => x.label === "Base") || watch.scenarios?.[0];
  setHTML(
    "#japan-day10-watch",
    `<div class="day10-hero"><div><small>10日累計 Base</small><strong>${yenOku(base?.value, 1)}</strong><span>50億まで ${base?.remainingToTarget > 0 ? `あと${base.remainingToTarget.toFixed(1)}億円` : `${Math.abs(base?.remainingToTarget || 0).toFixed(1)}億円超え`}</span></div><div class="day10-meter"><i style="width:${Math.min(110, base?.progress || 0)}%"></i><b>${target}億ライン</b></div></div>
    <div class="watch-list">${watch.items
      .map((item) => `<div><span>${item.label}</span><strong>${formatScenarioValue(item)}</strong>${sourceTag(item.sourceStatus)}</div>`)
      .join("")}</div>
    <div class="scenario-mini">${watch.scenarios
      .map(
        (item) =>
          `<div class="${item.value >= target ? "hit" : item.value >= 48 ? "near" : ""}"><small>${item.label}</small><strong>${yenOku(item.value, 1)}</strong><span>${item.status}</span>${sourceTag(item.sourceStatus)}</div>`
      )
      .join("")}</div>
    <p class="data-note">${watch.note}</p>`
  );
};
renderJapanDay10Watch();

const renderJapanUsdMission = () => {
  const mission = D.japanUsdMission;
  if (!mission) return;
  const max = Math.max(180, ...(mission.milestones || []).map((x) => x.value || 0));
  setHTML(
    "#japan-usd-mission",
    `<div class="usd-mission-head"><div><small>為替前提</small><strong>1ドル = ${mission.fxYenPerUsd}円</strong></div><div><small>$100Mライン</small><strong>${yenOku(mission.usd100LineYenBillion, 1)}</strong></div><div><small>藤井予想</small><strong>${yenOku(mission.fujiiForecastYenBillion, 0)} ≒ $${mission.fujiiForecastUsdMillion}M</strong></div></div>
    <div class="usd-track">${mission.milestones
      .map(
        (m) =>
          `<span class="${m.highlight ? "highlight" : ""} ${m.fujii ? "fujii" : ""}" style="left:${Math.min(100, (m.value / max) * 100)}%"><i></i><b>${m.label}</b><em>${yenOku(m.value, m.value % 1 ? 1 : 0)}</em></span>`
      )
      .join("")}</div>
    <details class="compact-details"><summary>為替換算の注意</summary><p>${mission.note}</p></details>`
  );
};
renderJapanUsdMission();

const renderScenarioCards = (selector, scenarios) => {
  if (!scenarios?.length) return;
  setHTML(
    selector,
    `<div class="scenario-cards">${scenarios
      .map(
        (item) =>
          `<div class="scenario-card ${item.fujii ? "fujii" : ""}"><small>${item.label}</small><strong>${item.range}</strong><p>${item.note}</p>${sourceTag(item.sourceStatus)}</div>`
      )
      .join("")}</div>`
  );
};
renderScenarioCards("#japan-final-scenarios", D.japanFinalForecastScenarios);

const renderSummerCheckpoints = () => {
  if (!D.summerCheckpoints?.length) return;
  setHTML(
    "#summer-checkpoints",
    `<div class="checkpoint-grid">${D.summerCheckpoints
      .map(
        (item, i) =>
          `<div class="checkpoint-card"><small>${String(i + 1).padStart(2, "0")}</small><h3>${item.label}</h3><p>${item.focus}</p><dl><div><dt>GOOD</dt><dd>${item.good}</dd></div><div><dt>WATCH</dt><dd>${item.watch}</dd></div><div><dt>DANGER</dt><dd>${item.danger}</dd></div></dl></div>`
      )
      .join("")}</div>`
  );
};
renderSummerCheckpoints();

const renderCompetitionWatch = () => {
  const watch = D.competitionWatch;
  if (!watch) return;
  const group = (title, items) =>
    `<div class="competition-watch-group"><h3>${title}</h3>${(items || [])
      .map((item) => `<article><b>${item.title}</b>${sourceTag(item.sourceStatus)}<p>${item.note}</p></article>`)
      .join("")}</div>`;
  setHTML("#competition-watch", `<div class="competition-watch-grid">${group("NORTH AMERICA COMPETITION", watch.northAmerica)}${group("JAPAN COMPETITION", watch.japan)}</div>`);
};
renderCompetitionWatch();

const renderJapanFlash = () => {
  const estimate = J.currentEstimateYen || J.dailyEstimateYen || J.grossEstimateYen || {};
  const yenText = estimate.base == null ? "未更新" : `約${yenOku(estimate.base)}`;
  const yenRange = estimate.low == null ? "推定レンジ 未更新" : `推定レンジ ${yenOku(estimate.low)}〜${yenOku(estimate.high)}`;
  const jpSnapshot = J.snapshotTime ? `${J.date} ${trackingTimeLabel(J.snapshotTime)}時点` : `${J.date || "日本速報"}・${J.updatedAt || "更新"}`;
  const officialOpening = J.officialOpening || D.japanCalibration;
  const bomUsd = J.officialGrossUsd != null ? money(J.officialGrossUsd, 3) : null;
  setHTML(
    "#japan-flash",
    `<div class="japan-flash-lead"><div><span class="flash-live">● ${J.sourceScope || "販売速報"} ${sourceTag(J.sourceStatus || "TRACKING")}</span><b>${jpSnapshot}</b></div><strong>当日推定興収 ${valueWithSource(yenText, estimate.sourceStatus || "CALC")}</strong><small>${yenRange}</small></div>
    <div class="japan-flash-stats">
      <div><small>当日P値</small><strong>${pValueText(J.trackedSales)}</strong><span>${J.status || "販売速報"}</span>${sourceTag("TRACKING")}</div>
      <div><small>推定最終P値</small><strong>${pValueText(J.estimatedFullDaySales)}</strong><span>${J.calibration || "公式3日間補正"}</span>${sourceTag("CALC")}</div>
      <div><small>公式3日間</small><strong>${officialOpening?.grossYenBillion ? yenOku(officialOpening.grossYenBillion, 3) : yenOku(D.japanCalibration?.officialThreeDayGrossYenBillion, 3)}</strong><span>動員 約${officialOpening?.admissionsMillion || D.japanCalibration?.officialThreeDayAdmissionsMillion || 1.64}百万人</span>${sourceTag("OFFICIAL")}</div>
      <div><small>BOM日本累計</small><strong>${bomUsd || "未更新"}</strong><span>USD換算・円建て推定と別枠</span>${sourceTag("BOM")}</div>
    </div>
    <p class="japan-flash-note"><b>推定値です。</b>${J.method || ""} ${J.officialGrossUsd ? `BOM日本累計は${money(J.officialGrossUsd, 3)}。` : "公式累計とは別扱いです。"}</p>`
  );
};
renderJapanFlash();

const renderPValueGuide = () => {
  const calibration = D.japanCalibration || {};
  const fixedTotal = calibration.officialThreeDayGrossYenBillion || 24.151;
  const tracked = calibration.trackedThreeDaySales || 1293102;
  const yenPerPoint = calibration.yenPerTrackedPoint || Math.round((fixedTotal * 100000000) / tracked);
  setHTML(
    "#pvalue-guide",
    `<div class="pvalue-card"><p><b>P値</b> = 見守りサイト等で取得された販売数指標。全国動員そのものではなく、興収推定には公式値との補正が必要です。</p><div class="pvalue-formula"><span>${yenOku(fixedTotal, 3)}</span><i>÷</i><span>${pValueText(tracked)}</span><i>=</i><strong>約${numberJa(yenPerPoint)}円/P</strong></div><p>${J.pValueNote || "公式累計とは別扱いで、後日修正される可能性があります。"}</p></div>`
  );
};
renderPValueGuide();

const renderJapanDaily = () => {
  const japanTrend = D.japanDailyTrend || J.dailyTrend || [];
  const japanDailyPoints = japanTrend.slice(-7);
  const values = japanDailyPoints.map((x) => x.estimatedGrossYen?.base).filter((v) => v != null);
  const max = values.length ? Math.max(...values) : 1;
  setHTML(
    "#japan-daily-chart",
    japanDailyPoints.length
      ? japanDailyPoints
          .map((x, i) => {
            const base = x.estimatedGrossYen?.base ?? null;
            const shortDate = String(x.date).replace(/^2026\//, "");
            const latest = i === japanDailyPoints.length - 1 || x.date === J.date;
            const noData = base == null;
            return `<div class="bar-item ${latest ? "highlight" : ""} ${noData ? "no-data" : ""}"><div class="bar-value">${noData ? "未取得" : yenOku(base)}</div><div class="bar" style="height:${noData ? 12 : Math.max(12, (base / max) * 185)}px"></div><div class="bar-label">${shortDate}</div><div class="bar-sub">${trackingTimeLabel(x.snapshotTime)}</div></div>`;
          })
          .join("")
      : `<div class="empty-market"><strong>日本 日次興収（推定）</strong><span>販売速報の取得後に棒グラフを表示します</span></div>`
  );
  setHTML(
    "#japan-estimate-table",
    `<thead><tr><th>日付</th><th>速報時点</th><th>P値</th><th>当日推定興収</th><th>レンジ</th><th>補正・信頼度</th></tr></thead><tbody>${japanTrend
      .map((x) => {
        const est = x.estimatedGrossYen;
        const factor = x.weekdayFactor && x.weekdayFactor !== 1 ? ` / 曜日係数×${x.weekdayFactor}` : "";
        return `<tr class="${x.date === J.date ? "current" : ""}"><td>${x.date}</td><td>${trackingTimeLabel(x.snapshotTime)}<small class="row-note">${x.sourceScope || ""}</small></td><td class="num">${pValueText(x.trackedSales)}</td><td class="num world-total">${yenOku(est?.base)}</td><td class="num">${est ? `${yenOku(est.low)}〜${yenOku(est.high)}` : "未更新"}</td><td><span class="status-pill">${x.calibration || x.status || "販売速報"}</span>${sourceTag(x.sourceStatus || est?.sourceStatus)}<small class="row-note">${x.yenPerTrackedPoint ? `約${numberJa(x.yenPerTrackedPoint)}円/P${factor}` : ""}</small></td></tr>`;
      })
      .join("")}</tbody>`
  );
};
renderJapanDaily();

const renderForecast = () => {
  const scenarios = D.worldwideForecastScenarios || [
    { label: "Low", range: billion(D.forecast?.low), note: "", sourceStatus: D.forecast?.sourceStatus },
    { label: "Base", range: billion(D.forecast?.base), note: D.forecast?.basis || "", sourceStatus: D.forecast?.sourceStatus },
    { label: "High", range: billion(D.forecast?.high), note: "", sourceStatus: D.forecast?.sourceStatus },
  ];
  setHTML(
    "#forecast-card",
    `<div class="forecast-scenario-cards">${scenarios
      .map((s) => `<div class="forecast-scenario ${s.label === "Base" ? "base" : ""}"><small>${s.label}</small><strong>${s.range}</strong><p>${s.note}</p>${sourceTag(s.sourceStatus)}</div>`)
      .join("")}</div><p class="forecast-basis">${D.forecast?.basis || ""}</p>`
  );
};
renderForecast();

const renderOverviewBasics = () => {
  const maxDaily = Math.max(1, ...(D.daily || []).map((x) => x.gross || 0));
  setHTML(
    "#daily-chart",
    (D.daily || [])
      .map((x, i) => `<div class="bar-item ${i === (D.daily || []).length - 1 ? "highlight" : ""}"><div class="bar-value">${money(x.gross, 1)}</div><div class="bar" style="height:${Math.max(12, (x.gross / maxDaily) * 185)}px"></div><div class="bar-label">${x.date}</div></div>`)
      .join("")
  );
  setHTML("#insights", (D.insights || []).map((x) => `<li>${x}</li>`).join(""));
  setHTML(
    "#competition-context",
    [D.competition?.current, D.competition?.next]
      .filter(Boolean)
      .map((x, i) => `<div class="competition-card ${i ? "next" : ""}"><small>${i ? "⚠️" : "🎟️"} ${x.label}</small><b>${x.title}</b><strong>${x.stat}</strong><p>${x.impact}</p></div>`)
      .join("")
  );
  setText("#outlook", D.outlook || "");
  const maxRace = Math.max(1, ...(D.comparisons || []).map((x) => x.cumulative || 0));
  setHTML(
    "#race-chart",
    (D.comparisons || [])
      .map((x) => `<div class="race-row ${x.current ? "current" : ""}"><div class="race-name">${x.current ? "★ " : ""}${x.title}</div><div class="race-track"><div class="race-fill" style="width:${((x.cumulative || 0) / maxRace) * 100}%"></div></div><div class="race-value">${money(x.cumulative, 1)}</div></div>`)
      .join("")
  );
};
renderOverviewBasics();

const renderTables = () => {
  setHTML(
    "#daily-table",
    `<thead><tr><th>日付</th><th>その日の興収</th><th>前日からの増減</th><th>1週間前比<small>同じ曜日・比較元を併記</small></th><th>北米累計</th></tr></thead><tbody>${(D.daily || [])
      .map((x) => `<tr><td>${x.date}</td><td class="num">${money(x.gross)}</td><td class="num">${delta(x.dod)}</td><td class="num">${weekDelta(x)}</td><td class="num">${money(x.cumulative)}</td></tr>`)
      .join("")}</tbody>`
  );
  setHTML(
    "#weekends",
    (D.weekends || [])
      .map((x, i) => `<div class="weekend ${i === 1 ? "current" : ""}"><small>WEEK ${x.week}</small><strong>${money(x.gross)}</strong><div>${x.change == null ? "前週比 —" : `前週比 ${delta(x.change)}`}</div><div class="muted">終了時累計 ${money(x.cumulative)}</div></div>`)
      .join("")
  );
  setHTML(
    "#compare-table",
    `<thead><tr><th>作品</th><th>Day ${D.dayMatchedDay || 14}累計</th><th>TS5との差</th><th>TS5比</th><th>順位</th></tr></thead><tbody>${(D.comparisons || [])
      .map((x) => `<tr class="${x.current ? "current" : ""}"><td>${x.current ? "★ " : ""}${x.title}</td><td class="num">${money(x.cumulative)}</td><td class="num">${diff(x.difference)}</td><td class="num">${pctText(x.index)}</td><td class="num">${x.rank}</td></tr>`)
      .join("")}</tbody>`
  );
  setHTML(
    "#weekend-compare-table",
    `<thead><tr><th>作品</th><th>第${D.weekendMatchedWeek || 2}週末</th><th>前週比</th><th>TS5との差</th></tr></thead><tbody>${(D.weekendComparisons || [])
      .map((x) => `<tr class="${x.current ? "current" : ""}"><td>${x.current ? "★ " : ""}${x.title}</td><td class="num">${money(x.gross)}</td><td class="num">${delta(x.change)}</td><td class="num">${diff(x.difference)}</td></tr>`)
      .join("")}</tbody>`
  );
  setText("#day-match-title", `公開${D.dayMatchedDay || 14}日目・北米累計比較`);
  setText("#weekend-match-title", `第${D.weekendMatchedWeek || 2}週末・北米比較`);
};
renderTables();

const renderMarkets = () => {
  setHTML(
    "#market-grid",
    (D.markets || [])
      .map((x) => {
        const isJapan = x.name === "日本";
        const badge = isJapan ? `<span class="flash-badge">BOM累計</span>` : "";
        const mainValue = x.gross != null ? money(x.gross, isJapan ? 3 : 2) : "未更新";
        const footer = isJapan ? `${x.status || "BOM確認値"}・日本円推定とは別枠` : `${x.status || ""} ${x.share == null ? "" : `・世界比 ${x.share.toFixed(1)}%`}`;
        return `<div class="market ${isJapan ? "jp" : ""}"><div class="flag">${x.flag}</div><h3>${x.name}${badge}</h3><strong>${mainValue}</strong><footer>${footer} ${sourceTag(x.sourceStatus || (isJapan ? "BOM" : "TN"))}</footer></div>`;
      })
      .join("")
  );
  const marketSelect = $("#market-select");
  if (!marketSelect) return;
  marketSelect.innerHTML = (D.markets || []).map((x, i) => `<option value="${i}">${x.flag} ${x.name}</option>`).join("");
  const renderMarketTrend = (index) => {
    const x = (D.markets || [])[index];
    if (!x) return;
    if (x.name === "日本") {
      const opening = J.officialOpening?.grossYenBillion || D.japanCalibration?.officialThreeDayGrossYenBillion;
      const daily = J.dailyEstimateYen?.base || J.currentEstimateYen?.base;
      setHTML(
        "#market-trend",
        `<div class="jp-trend-summary"><span class="flash-live">● 日本データは単位別に分離</span><strong>${money(x.gross, 3)} ${sourceTag("BOM")}</strong><b>公開3日間 ${yenOku(opening, 3)} ${sourceTag("OFFICIAL")}</b><small>当日P値推定 ${yenOku(daily)} ${sourceTag("CALC")}。BOMのUSD累計とは比較せず、別コーナーで観測します。</small></div>`
      );
      return;
    }
    if (x.gross == null || x.growth == null) {
      setHTML("#market-trend", `<div class="empty-market"><strong>${x.flag} ${x.name}</strong><span>${x.status} — 興収公表後に推移を表示します</span></div>`);
      return;
    }
    const opening = x.gross - x.growth;
    const gain = opening > 0 ? (x.gross / opening - 1) * 100 : 0;
    setHTML(
      "#market-trend",
      [
        { label: "初動", value: opening, latest: false },
        { label: "最新公表", value: x.gross, latest: true },
      ]
        .map((p) => `<div class="snapshot-col ${p.latest ? "latest" : ""}"><div class="snapshot-value">${money(p.value)}</div><div class="snapshot-bar" style="height:${Math.max(18, (p.value / x.gross) * 170)}px"></div><div class="snapshot-label">${p.label}</div>${p.latest ? `<div class="snapshot-growth">初動比 ▲${gain.toFixed(1)}%</div>` : ""}</div>`)
        .join("")
    );
  };
  const renderMarketPeers = (index) => {
    const market = (D.markets || [])[index];
    if (!market) return;
    const raw = D.marketOpeningComparisons?.[market.name] || [];
    const peers = Array.isArray(raw) ? raw : raw.entries || [];
    const unit = Array.isArray(raw) ? "USD million" : raw.unit || "USD million";
    const note = Array.isArray(raw) ? "公開週末・USD" : raw.note || `公開週末・${unit}`;
    const available = peers.filter((x) => (x.gross ?? x.openingGross) != null);
    const peerMax = available.length ? Math.max(...available.map((x) => x.gross ?? x.openingGross)) : 1;
    setHTML(
      "#market-peer-chart",
      `<div class="market-peer-heading"><b>${market.flag} ${market.name}</b><span>${note}</span></div>${peers
        .map((x) => {
          const value = x.gross ?? x.openingGross;
          return `<div class="mini-race-row ${x.current ? "current" : ""}"><div class="mini-race-name">${x.current ? "★ " : ""}${x.title}</div><div class="mini-race-track"><div class="mini-race-fill" style="width:${value == null ? 0 : (value / peerMax) * 100}%;background:${x.color || "#1676c3"}"></div></div><div class="mini-race-value">${value == null ? x.note || "未取得" : formatUnitValue(value, unit, unit === "JPY billion" ? 3 : 1)} ${sourceTag(x.sourceStatus)}</div></div>`;
        })
        .join("")}`
    );
  };
  marketSelect.addEventListener("change", (event) => {
    const index = Number(event.target.value);
    renderMarketTrend(index);
    renderMarketPeers(index);
  });
  renderMarketTrend(0);
  renderMarketPeers(0);
};
renderMarkets();

const renderMusicChart = (target, item, accent) => {
  if (!item?.points?.length) return;
  const width = 520,
    height = 260,
    left = 44,
    right = 28,
    top = 24,
    bottom = 48;
  const points = item.points || [];
  const maxRank = Math.max(5, ...points.map((p) => p.rank || 1));
  const plotW = width - left - right,
    plotH = height - top - bottom;
  const x = (i) => (points.length < 2 ? left + plotW / 2 : left + (plotW * i) / (points.length - 1));
  const y = (rank) => top + ((rank - 1) / (maxRank - 1)) * plotH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.rank).toFixed(1)}`).join(" ");
  const grid = Array.from({ length: maxRank }, (_, i) => i + 1)
    .map((rank) => `<g><line x1="${left}" y1="${y(rank)}" x2="${width - right}" y2="${y(rank)}"/><text x="${left - 10}" y="${y(rank) + 4}" text-anchor="end">#${rank}</text></g>`)
    .join("");
  const labels = points.map((p, i) => `<text class="music-x-label" x="${x(i)}" y="${height - 18}" text-anchor="middle">${p.date}</text>`).join("");
  const marks = points.map((p, i) => `<g><circle cx="${x(i)}" cy="${y(p.rank)}" r="6" fill="${accent}"/><text class="music-rank-label" x="${x(i)}" y="${y(p.rank) - 12}" text-anchor="middle">#${p.rank}</text></g>`).join("");
  const move = points.length > 1 ? item.latest - points[points.length - 2].rank : null;
  const moveText = move == null ? "初登場" : move === 0 ? "前週同順位" : move > 0 ? `前週から ${move}位下降` : `前週から ${Math.abs(move)}位上昇`;
  setHTML(
    target,
    `<div class="music-card-head"><div><small>${item.chart}</small><h3>${item.title}</h3><span>${item.artist}</span></div><div class="music-latest"><small>最新</small><strong>#${item.latest}</strong></div></div><div class="music-stats"><span>最高 <b>#${item.peak}</b></span><span>${moveText}</span></div><svg class="music-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${item.title}の${item.chart}順位推移"><g class="music-gridlines">${grid}${labels}</g><path class="music-line" d="${path}" stroke="${accent}"/>${marks}</svg><p>${item.note}</p>`
  );
};
if (D.musicCharts) {
  renderMusicChart("#song-chart", D.musicCharts.song, "#e4322b");
  renderMusicChart("#soundtrack-chart", D.musicCharts.soundtrack, "#1676c3");
  setText("#music-note", `${D.musicCharts.updatedThrough}。異なるチャートの順位は直接比較せず、各チャート内の週次推移として表示します。`);
}

const renderTrajectory = () => {
  const T = D.trajectory;
  if (!T?.series?.length) return;
  const width = 1000,
    height = 430,
    left = 72,
    right = 115,
    top = 26,
    bottom = 62;
  const plotW = width - left - right,
    plotH = height - top - bottom,
    yMax = Math.max(700, ...T.series.flatMap((s) => s.values || []).filter((v) => v != null)) * 1.08;
  const x = (i) => left + (plotW * i) / (T.labels.length - 1);
  const y = (v) => top + plotH - (v / yMax) * plotH;
  const currentSeries = T.series.find((s) => s.current) || T.series[0];
  const actualIndex = Math.max(0, currentSeries.values.reduce((last, value, index) => (value == null ? last : index), 0));
  const pathFor = (values) =>
    values
      .map((v, i) => (v == null ? null : `${i && values[i - 1] != null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");
  const tickStep = yMax > 900 ? 200 : 100;
  const ticks = Array.from({ length: Math.floor(yMax / tickStep) + 1 }, (_, i) => i * tickStep);
  const grid = ticks.map((v) => `<g><line x1="${left}" y1="${y(v)}" x2="${width - right}" y2="${y(v)}"/><text x="${left - 14}" y="${y(v) + 4}" text-anchor="end">$${v}M</text></g>`).join("");
  const labels = T.labels.map((label, i) => `<text class="x-label" x="${x(i)}" y="${height - 25}" text-anchor="middle">${label}</text>`).join("");
  const lines = T.series
    .map((s) => {
      const dots = (s.values || []).map((v, i) => (v == null ? "" : `<circle cx="${x(i)}" cy="${y(v)}" r="${s.current ? 5 : 3.5}" fill="${s.color}"/>`)).join("");
      return `<g class="trajectory-series ${s.projected ? "projected" : ""}"><path d="${pathFor(s.values || [])}" stroke="${s.color}"/>${dots}</g>`;
    })
    .join("");
  const finalIndex = T.labels.length - 1;
  const endpointLabels = T.series
    .filter((s) => s.values?.[finalIndex] != null)
    .map((s, i) => `<text class="endpoint-label" x="${x(finalIndex) + 10}" y="${y(s.values[finalIndex]) + 4 + (i % 3) * 12}" fill="${s.color}">$${s.values[finalIndex].toFixed(0)}M</text>`)
    .join("");
  const legend = T.series.map((s) => `<span class="legend-item"><i style="--legend:${s.color}" class="${s.projected ? "dashed" : ""}"></i>${s.title}</span>`).join("");
  setHTML(
    "#trajectory-chart",
    `<div class="trajectory-meta"><b>${T.unit}</b><span>実線＝実績　破線＝TS5分析イメージ</span></div><div class="trajectory-scroll"><svg class="trajectory-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="比較作品の北米累計推移とトイ・ストーリー5の予測"><g class="trajectory-grid">${grid}${labels}</g>${lines}${endpointLabels}<line class="actual-divider" x1="${x(actualIndex)}" y1="${top}" x2="${x(actualIndex)}" y2="${height - bottom}"/><text class="actual-label" x="${x(actualIndex) - 10}" y="${top + 14}" text-anchor="end">ここまで実績</text></svg></div><div class="trajectory-legend">${legend}</div>`
  );
};
renderTrajectory();

const worldTrend = D.worldwideTrend || [];
const renderWorldwide = () => {
  if (!worldTrend.length) return;
  const worldFirst = worldTrend[0],
    worldLatest = worldTrend[worldTrend.length - 1];
  setHTML(
    "#worldwide-summary",
    `<div><small>公開週末からの増加</small><strong>+${money(worldLatest.worldwide - worldFirst.worldwide)}</strong></div><div><small>現在の海外比率</small><strong>${pctText((worldLatest.international / worldLatest.worldwide) * 100)}</strong></div><div><small>$1Bまで</small><strong>${money(1000 - worldLatest.worldwide)}</strong></div>`
  );
  const width = 1000,
    height = 360,
    left = 76,
    right = 115,
    top = 28,
    bottom = 58,
    yMax = Math.max(1300, D.forecast?.base || 0);
  const plotW = width - left - right,
    plotH = height - top - bottom;
  const labels = [...worldTrend.map((d) => d.date), "最終見込み"];
  const x = (i) => left + (plotW * i) / (labels.length - 1);
  const y = (v) => top + plotH - (v / yMax) * plotH;
  const path = (values) =>
    values
      .map((v, i) => (v == null ? null : `${i && values[i - 1] != null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");
  const ts5Actual = { color: "#e4322b", values: [...worldTrend.map((d) => d.worldwide), null], current: true };
  const ts5Projected = { color: "#f0b821", values: [...Array(worldTrend.length - 1).fill(null), worldLatest.worldwide, D.forecast?.base], projected: true };
  const ticks = [0, 250, 500, 750, 1000, 1250, 1500].filter((v) => v <= yMax);
  const grid = ticks.map((v) => `<g><line x1="${left}" y1="${y(v)}" x2="${width - right}" y2="${y(v)}"/><text x="${left - 13}" y="${y(v) + 4}" text-anchor="end">${v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${v}M`}</text></g>`).join("");
  const xLabels = labels.map((label, i) => `<text class="x-label" x="${x(i)}" y="${height - 23}" text-anchor="middle">${label}</text>`).join("");
  const draw = (s) => `<g class="trajectory-series ${s.projected ? "projected" : ""} ${s.current ? "current-world" : ""}"><path d="${path(s.values)}" stroke="${s.color}"/>${s.values.map((v, i) => (v == null ? "" : `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${s.color}"/>`)).join("")}</g>`;
  const markerX = x(worldTrend.length - 1);
  const finalX = x(labels.length - 1);
  setHTML(
    "#worldwide-trend-chart",
    `<div class="trajectory-meta"><b>トイ・ストーリー5 世界累計（$M）</b><span>赤実線＝公表値　黄色破線＝最新実績以降の分析見込み</span></div><div class="trajectory-scroll world-trajectory-scroll"><svg class="trajectory-svg world-trajectory-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="トイ・ストーリー5の世界累計公表値と最終見込み"><g class="trajectory-grid">${grid}${xLabels}</g>${draw(ts5Actual)}${draw(ts5Projected)}<line class="actual-divider" x1="${markerX}" y1="${top}" x2="${markerX}" y2="${height - bottom}"/><text class="actual-label" x="${markerX - 10}" y="${top + 14}" text-anchor="end">ここまで公表値</text><text class="endpoint-label" x="${finalX + 10}" y="${y(D.forecast?.base) + 4}" fill="#c39200">${billion(D.forecast?.base)}</text></svg></div>`
  );

  const width2 = 1000,
    height2 = 430,
    left2 = 115,
    right2 = 135,
    top2 = 32,
    bottom2 = 62,
    yMax2 = 2000;
  const plotH2 = height2 - top2 - bottom2,
    x0 = left2,
    x1 = width2 - right2;
  const y2 = (v) => top2 + plotH2 - (v / yMax2) * plotH2;
  const peers = D.worldComparisons || [];
  const ts5 = { title: "トイ・ストーリー5 見込み", color: "#f0b821", opening: worldFirst.worldwide, final: D.forecast?.base, projected: true };
  const all = [...peers, ts5].filter((s) => s.opening != null && s.final != null);
  const grid2 = [0, 500, 1000, 1500, 2000].map((v) => `<g><line x1="${left2}" y1="${y2(v)}" x2="${width2 - right2}" y2="${y2(v)}"/><text x="${left2 - 14}" y="${y2(v) + 4}" text-anchor="end">${v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${v}M`}</text></g>`).join("");
  const lines2 = all
    .map((s) => `<g class="trajectory-series ${s.projected ? "projected" : ""}"><path d="M${x0},${y2(s.opening)} L${x1},${y2(s.final)}" stroke="${s.color}"/><circle cx="${x0}" cy="${y2(s.opening)}" r="4" fill="${s.color}"/><circle cx="${x1}" cy="${y2(s.final)}" r="4" fill="${s.color}"/><text class="endpoint-label" x="${x1 + 10}" y="${y2(s.final) + 4}" fill="${s.color}">${billion(s.final)}</text></g>`)
    .join("");
  const legend = all.map((s) => `<span class="legend-item"><i style="--legend:${s.color}" class="${s.projected ? "dashed" : ""}"></i>${s.title}</span>`).join("");
  setHTML(
    "#world-peer-slope-chart",
    `<div class="world-slope-title"><b>比較作品：公開週末 → 最終世界興収</b><span>日次推移ではなく、2つの実績端点を結ぶ参考線</span></div><div class="trajectory-scroll world-peer-slope"><svg class="trajectory-svg" viewBox="0 0 ${width2} ${height2}" role="img" aria-label="比較作品の公開週末世界興収と最終世界興収"><g class="trajectory-grid">${grid2}<text class="x-label" x="${x0}" y="${height2 - 24}" text-anchor="middle">公開週末</text><text class="x-label" x="${x1}" y="${height2 - 24}" text-anchor="middle">最終</text></g>${lines2}</svg></div><div class="trajectory-legend world-legend">${legend}</div>`
  );
  setHTML(
    "#worldwide-trend-table",
    `<thead><tr><th>公表時点</th><th>北米累計</th><th>海外累計</th><th>世界累計</th><th>前回公表から</th><th>データ状態</th></tr></thead><tbody>${worldTrend
      .map((x) => `<tr class="${x.latest ? "current" : ""}"><td><b>${x.date}</b><small class="row-note">${x.label}</small></td><td class="num">${money(x.domestic)}</td><td class="num">${money(x.international)}</td><td class="num world-total">${money(x.worldwide)}</td><td class="num">${x.increase == null ? "—" : `<span class="up">▲ ${money(x.increase)}</span>`}</td><td><span class="status-pill">${x.status}</span>${sourceTag(x.sourceStatus)}</td></tr>`)
      .join("")}</tbody>`
  );
};
renderWorldwide();

const renderSources = () => {
  setHTML(
    "#source-status-legend",
    `<div class="source-status-legend">${(D.sourceStatusLegend || [])
      .map((x) => `<div>${sourceTag(x.code)}<span>${x.label}</span></div>`)
      .join("")}</div>`
  );
  setHTML(
    "#checks-table",
    `<thead><tr><th>指標</th><th>採用値</th><th>別ソース・参考値</th><th>差</th><th>判断</th></tr></thead><tbody>${(D.checks || [])
      .map((x) => `<tr><td>${x.metric}</td><td class="num">${valueWithSource(formatUnitValue(x.adopted, x.adoptedUnit, 3), x.adoptedSourceStatus)}</td><td class="num">${valueWithSource(formatUnitValue(x.alternate, x.alternateUnit || x.adoptedUnit, 3), x.alternateSourceStatus)}</td><td class="num">${formatUnitValue(x.difference, x.diffUnit || x.adoptedUnit, 3)}</td><td>${x.note}</td></tr>`)
      .join("")}</tbody>`
  );
  setHTML("#source-links", (D.sources || []).map((x) => `<a href="${x.url}" target="_blank" rel="noreferrer">↗ ${x.name}</a>`).join(""));
  setHTML(
    "#source-categories",
    `<div class="source-category-grid">${(D.sourceCategories || [])
      .map(
        (group) =>
          `<article><h3>${group.category}</h3>${group.items
            .map((item) => (item.url && item.url !== "#" ? `<a href="${item.url}" target="_blank" rel="noreferrer">${item.name}</a>` : `<span>${item.name}</span>`))
            .join("")}</article>`
      )
      .join("")}</div>`
  );
};
renderSources();

document.querySelectorAll(".tabs button").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button,.tab-page").forEach((el) => el.classList.remove("active"));
    btn.classList.add("active");
    $(`#${btn.dataset.tab}`)?.classList.add("active");
  })
);

// Keep an already-open side panel fresh after the scheduled data file is replaced.
setInterval(() => location.reload(), 10 * 60 * 1000);
