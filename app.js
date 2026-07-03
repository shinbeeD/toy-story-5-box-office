const D = window.BOX_OFFICE_DATA;
const money = (v, digits = 2) => v == null ? "未更新" : `$${v.toFixed(digits)}M`;
const delta = v => v == null ? '<span class="muted">未更新</span>' : `<span class="${v >= 0 ? 'up' : 'down'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(1)}%</span>`;
const previousWeekDate = date => {
  const [month, day] = date.split('/').map(Number);
  const d = new Date(Date.UTC(2026, month - 1, day - 7));
  return `${d.getUTCMonth()+1}/${d.getUTCDate()}`;
};
const weekDelta = x => {
  if (x.wow == null) return '<span class="no-compare">比較データなし</span>';
  const priorGross = x.gross / (1 + x.wow / 100);
  return `<span class="week-delta"><span class="${x.wow >= 0 ? 'up' : 'down'}">${x.wow >= 0 ? '▲' : '▼'} ${Math.abs(x.wow).toFixed(1)}%</span><small>vs ${previousWeekDate(x.date)} ${money(priorGross)}</small></span>`;
};
const diff = v => v === 0 ? "—" : `<span class="${v > 0 ? 'up' : 'down'}">${v > 0 ? '▲' : '▼'} ${money(Math.abs(v))}</span>`;
const sourceDate = `更新 ${D.updatedAt} ／ 数値は ${D.dataThrough} まで`;
document.querySelector('#headline').textContent = D.headline;
document.querySelector('#updated').textContent = sourceDate;
document.querySelector('#progress-label').textContent = `${D.summary.billionProgress.toFixed(1)}%`;
document.querySelector('#progress-bar').style.width = `${D.summary.billionProgress}%`;

const kpiData = [
  ["WORLDWIDE", money(D.summary.worldwide), `前回公表比 +${money(D.summary.worldDelta)}`, "🌐"],
  ["NORTH AMERICA", money(D.summary.domestic), "世界比 53.5%", "🚀"],
  ["INTERNATIONAL", money(D.summary.international), "世界比 46.5%", "🌍"],
  ["LATEST DAILY", money(D.summary.latestDaily), "7/1 前日比 +9.3%", "⭐"]
];
document.querySelector('#kpis').innerHTML = kpiData.map(x => `<div class="kpi"><span class="toy">${x[3]}</span><label>${x[0]}</label><strong>${x[1]}</strong><span>${x[2]}</span></div>`).join('');
const J = D.japanFlash;
const numberJa = value => Number(value).toLocaleString('ja-JP');
document.querySelector('#japan-flash').innerHTML = `<div class="japan-flash-lead"><div><span class="flash-live">● 超速報</span><b>${J.date} 初日・${J.updatedAt}更新</b></div><strong>参考興収換算 約¥${J.grossEstimateYen.base.toFixed(1)}億</strong><small>推計レンジ ¥${J.grossEstimateYen.low.toFixed(1)}〜¥${J.grossEstimateYen.high.toFixed(1)}億</small></div><div class="japan-flash-stats"><div><small>取得館販売数</small><strong>${numberJa(J.trackedSales)}</strong><span>チケット販売速報</span></div><div><small>デイリー順位</small><strong>${J.rank}位</strong><span>全作品中</span></div><div><small>座席・消化率</small><strong>${numberJa(J.seats)}</strong><span>${J.seatProgress.toFixed(1)}%消化</span></div><div><small>参考取得館率</small><strong>${J.referenceCoverage.toFixed(1)}%</strong><span>${J.nextDayTrackedTheaters}/${J.nextDayAllTheaters}館（翌日）</span></div></div><p class="japan-flash-note"><b>公式値ではありません。</b>${J.method} 正式発表までは世界累計に加算しません。</p>`;
const billion = v => `$${(v / 1000).toFixed(2)}B`;
document.querySelector('#forecast-card').innerHTML = `<div class="forecast-layout"><div class="forecast-main"><small>中心見込み</small><strong>${billion(D.forecast.base)}</strong><span>${D.forecast.confidence}・モデル推定</span></div><div class="forecast-range"><div class="forecast-labels"><span>下限 ${billion(D.forecast.low)}</span><span>上限 ${billion(D.forecast.high)}</span></div><div class="forecast-track"><i class="forecast-marker"></i></div><div class="forecast-basis">${D.forecast.basis}</div></div></div>`;

const maxDaily = Math.max(...D.daily.map(x => x.gross));
document.querySelector('#daily-chart').innerHTML = D.daily.map((x, i) => `<div class="bar-item ${i === D.daily.length - 1 ? 'highlight' : ''}"><div class="bar-value">${money(x.gross,1)}</div><div class="bar" style="height:${Math.max(12, x.gross/maxDaily*185)}px"></div><div class="bar-label">${x.date}</div></div>`).join('');
document.querySelector('#insights').innerHTML = D.insights.map(x => `<li>${x}</li>`).join('');
document.querySelector('#competition-context').innerHTML = [D.competition.current,D.competition.next].map((x,i) => `<div class="competition-card ${i?'next':''}"><small>${i?'⚠️':'🎟️'} ${x.label}</small><b>${x.title}</b><strong>${x.stat}</strong><p>${x.impact}</p></div>`).join('');
document.querySelector('#outlook').textContent = D.outlook;

const maxRace = Math.max(...D.comparisons.map(x => x.cumulative));
document.querySelector('#race-chart').innerHTML = D.comparisons.map(x => `<div class="race-row ${x.current ? 'current' : ''}"><div class="race-name">${x.current ? '★ ' : ''}${x.title}</div><div class="race-track"><div class="race-fill" style="width:${x.cumulative/maxRace*100}%"></div></div><div class="race-value">${money(x.cumulative,1)}</div></div>`).join('');

document.querySelector('#daily-table').innerHTML = `<thead><tr><th>日付</th><th>その日の興収</th><th>前日からの増減</th><th>1週間前比<small>同じ曜日・比較元を併記</small></th><th>北米累計</th></tr></thead><tbody>${D.daily.map(x => `<tr><td>${x.date}</td><td class="num">${money(x.gross)}</td><td class="num">${delta(x.dod)}</td><td class="num">${weekDelta(x)}</td><td class="num">${money(x.cumulative)}</td></tr>`).join('')}</tbody>`;
document.querySelector('#weekends').innerHTML = D.weekends.map((x,i) => `<div class="weekend ${i === 1 ? 'current' : ''}"><small>WEEK ${x.week}</small><strong>${money(x.gross)}</strong><div>${x.change == null ? '前週比 —' : `前週比 ${delta(x.change)}`}</div><div class="muted">終了時累計 ${money(x.cumulative)}</div></div>`).join('');
document.querySelector('#compare-table').innerHTML = `<thead><tr><th>作品</th><th>Day 14累計</th><th>TS5との差</th><th>TS5比</th><th>順位</th></tr></thead><tbody>${D.comparisons.map(x => `<tr class="${x.current ? 'current' : ''}"><td>${x.current?'★ ':''}${x.title}</td><td class="num">${money(x.cumulative)}</td><td class="num">${diff(x.difference)}</td><td class="num">${x.index.toFixed(1)}%</td><td class="num">${x.rank}</td></tr>`).join('')}</tbody>`;
document.querySelector('#weekend-compare-table').innerHTML = `<thead><tr><th>作品</th><th>第2週末</th><th>前週比</th><th>TS5との差</th></tr></thead><tbody>${D.weekendComparisons.map(x => `<tr class="${x.current ? 'current' : ''}"><td>${x.current?'★ ':''}${x.title}</td><td class="num">${money(x.gross)}</td><td class="num">${delta(x.change)}</td><td class="num">${diff(x.difference)}</td></tr>`).join('')}</tbody>`;
document.querySelector('#market-grid').innerHTML = D.markets.map(x => { const isJapan=x.name==='日本'; return `<div class="market ${isJapan?'jp':''}"><div class="flag">${x.flag}</div><h3>${x.name}${isJapan?'<span class="flash-badge">超速報</span>':''}</h3><strong>${isJapan?`推計 約¥${J.grossEstimateYen.base.toFixed(1)}億`:money(x.gross)}</strong><footer>${isJapan?`販売 ${numberJa(J.trackedSales)}・公式未公表`:x.status} ${x.share == null ? '' : `・世界比 ${x.share.toFixed(1)}%`}</footer></div>`; }).join('');
const marketSelect = document.querySelector('#market-select');
marketSelect.innerHTML = D.markets.map((x,i) => `<option value="${i}">${x.flag} ${x.name}</option>`).join('');
const renderMarketTrend = index => {
  const x = D.markets[index];
  if (x.name === '日本') {
    document.querySelector('#market-trend').innerHTML = `<div class="jp-trend-summary"><span class="flash-live">● 超速報</span><strong>販売 ${numberJa(J.trackedSales)}</strong><b>参考興収換算 約¥${J.grossEstimateYen.base.toFixed(1)}億</b><small>公式興収の公表後に正式値へ差し替えます</small></div>`;
    return;
  }
  if (x.gross == null || x.growth == null) {
    document.querySelector('#market-trend').innerHTML = `<div class="empty-market"><strong>${x.flag} ${x.name}</strong><span>${x.status} — 興収公表後に推移を表示します</span></div>`;
    return;
  }
  const opening = x.gross - x.growth;
  const gain = opening > 0 ? (x.gross / opening - 1) * 100 : 0;
  document.querySelector('#market-trend').innerHTML = [{label:'初動',value:opening,latest:false},{label:'最新公表',value:x.gross,latest:true}].map(p => `<div class="snapshot-col ${p.latest?'latest':''}"><div class="snapshot-value">${money(p.value)}</div><div class="snapshot-bar" style="height:${Math.max(18,p.value/x.gross*170)}px"></div><div class="snapshot-label">${p.label}</div>${p.latest?`<div class="snapshot-growth">初動比 ▲${gain.toFixed(1)}%</div>`:''}</div>`).join('');
};
const renderMarketPeers = index => {
  const market = D.markets[index];
  const peers = D.marketOpeningComparisons[market.name] || [];
  const available = peers.filter(x => x.gross != null);
  const peerMax = available.length ? Math.max(...available.map(x => x.gross)) : 1;
  document.querySelector('#market-peer-chart').innerHTML = `<div class="market-peer-heading"><b>${market.flag} ${market.name}</b><span>公開週末・USD</span></div>${peers.map(x => `<div class="mini-race-row ${x.current?'current':''}"><div class="mini-race-name">${x.current?'★ ':''}${x.title}</div><div class="mini-race-track"><div class="mini-race-fill" style="width:${x.gross==null?0:x.gross/peerMax*100}%;background:${x.color}"></div></div><div class="mini-race-value">${x.gross==null?(x.note||'未取得'):money(x.gross,1)}</div></div>`).join('')}`;
};
marketSelect.addEventListener('change', e => { const index=Number(e.target.value); renderMarketTrend(index); renderMarketPeers(index); });
renderMarketTrend(0);
renderMarketPeers(0);

const renderMusicChart = (target, item, accent) => {
  const width = 520, height = 260, left = 44, right = 28, top = 24, bottom = 48;
  const points = item.points || [];
  const maxRank = Math.max(5, ...points.map(p => p.rank || 1));
  const plotW = width-left-right, plotH = height-top-bottom;
  const x = i => points.length < 2 ? left + plotW/2 : left + plotW*i/(points.length-1);
  const y = rank => top + (rank-1)/(maxRank-1)*plotH;
  const path = points.map((p,i) => `${i?'L':'M'}${x(i).toFixed(1)},${y(p.rank).toFixed(1)}`).join(' ');
  const grid = Array.from({length:maxRank},(_,i)=>i+1).map(rank => `<g><line x1="${left}" y1="${y(rank)}" x2="${width-right}" y2="${y(rank)}"/><text x="${left-10}" y="${y(rank)+4}" text-anchor="end">#${rank}</text></g>`).join('');
  const labels = points.map((p,i)=>`<text class="music-x-label" x="${x(i)}" y="${height-18}" text-anchor="middle">${p.date}</text>`).join('');
  const marks = points.map((p,i)=>`<g><circle cx="${x(i)}" cy="${y(p.rank)}" r="6" fill="${accent}"/><text class="music-rank-label" x="${x(i)}" y="${y(p.rank)-12}" text-anchor="middle">#${p.rank}</text></g>`).join('');
  const move = points.length > 1 ? item.latest-points[points.length-2].rank : null;
  const moveText = move == null ? '初登場' : move === 0 ? '前週同順位' : move > 0 ? `前週から ${move}位下降` : `前週から ${Math.abs(move)}位上昇`;
  document.querySelector(target).innerHTML = `<div class="music-card-head"><div><small>${item.chart}</small><h3>${item.title}</h3><span>${item.artist}</span></div><div class="music-latest"><small>最新</small><strong>#${item.latest}</strong></div></div><div class="music-stats"><span>最高 <b>#${item.peak}</b></span><span>${moveText}</span></div><svg class="music-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${item.title}の${item.chart}順位推移"><g class="music-gridlines">${grid}${labels}</g><path class="music-line" d="${path}" stroke="${accent}"/>${marks}</svg><p>${item.note}</p>`;
};
renderMusicChart('#song-chart', D.musicCharts.song, '#e4322b');
renderMusicChart('#soundtrack-chart', D.musicCharts.soundtrack, '#1676c3');
document.querySelector('#music-note').textContent = `${D.musicCharts.updatedThrough}。異なるチャートの順位は直接比較せず、各チャート内の週次推移として表示します。`;

const renderTrajectory = () => {
  const T = D.trajectory;
  const width = 1000, height = 430, left = 72, right = 115, top = 26, bottom = 62;
  const plotW = width - left - right, plotH = height - top - bottom, yMax = 700;
  const x = i => left + (plotW * i / (T.labels.length - 1));
  const y = v => top + plotH - (v / yMax * plotH);
  const pathFor = values => values.map((v, i) => v == null ? null : `${i && values[i-1] != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).filter(Boolean).join(' ');
  const grid = [0,100,200,300,400,500,600,700].map(v => `<g><line x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}"/><text x="${left-14}" y="${y(v)+4}" text-anchor="end">$${v}M</text></g>`).join('');
  const labels = T.labels.map((label,i) => `<text class="x-label" x="${x(i)}" y="${height-25}" text-anchor="middle">${label}</text>`).join('');
  const lines = T.series.map(s => {
    const dots = s.values.map((v,i) => v == null ? '' : `<circle cx="${x(i)}" cy="${y(v)}" r="${s.current ? 5 : 3.5}" fill="${s.color}"/>`).join('');
    return `<g class="trajectory-series ${s.projected?'projected':''}"><path d="${pathFor(s.values)}" stroke="${s.color}"/>${dots}</g>`;
  }).join('');
  const endpointOffsets = {"トイ・ストーリー4":-10,"ズートピア2":14};
  const endpointLabels = T.series.filter(s => s.values[6] != null).map(s => `<text class="endpoint-label" x="${x(6)+10}" y="${y(s.values[6])+(endpointOffsets[s.title]||4)}" fill="${s.color}">$${s.values[6].toFixed(0)}M</text>`).join('');
  const legend = T.series.map(s => `<span class="legend-item"><i style="--legend:${s.color}" class="${s.projected?'dashed':''}"></i>${s.title}</span>`).join('');
  document.querySelector('#trajectory-chart').innerHTML = `<div class="trajectory-meta"><b>${T.unit}</b><span>実線＝実績　破線＝推移イメージ</span></div><div class="trajectory-scroll"><svg class="trajectory-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="比較作品の北米累計推移とトイ・ストーリー5の予測"><g class="trajectory-grid">${grid}${labels}</g>${lines}${endpointLabels}<line class="actual-divider" x1="${x(3)}" y1="${top}" x2="${x(3)}" y2="${height-bottom}"/><text class="actual-label" x="${x(3)-10}" y="${top+14}" text-anchor="end">ここまで実績</text></svg></div><div class="trajectory-legend">${legend}</div>`;
};
renderTrajectory();
const worldTrend = D.worldwideTrend;
const worldFirst = worldTrend[0], worldLatest = worldTrend[worldTrend.length-1];
document.querySelector('#worldwide-summary').innerHTML = `<div><small>公開週末からの増加</small><strong>+${money(worldLatest.worldwide-worldFirst.worldwide)}</strong></div><div><small>現在の海外比率</small><strong>${(worldLatest.international/worldLatest.worldwide*100).toFixed(1)}%</strong></div><div><small>$1Bまで</small><strong>${money(1000-worldLatest.worldwide)}</strong></div>`;
const renderWorldwideTrajectory = () => {
  const width = 1000, height = 360, left = 76, right = 115, top = 28, bottom = 58, yMax = 1300;
  const plotW = width-left-right, plotH = height-top-bottom;
  const labels = [...worldTrend.map(d=>d.date),'最終見込み'];
  const x = i => left + plotW * i / (labels.length-1);
  const y = v => top + plotH - v/yMax*plotH;
  const path = values => values.map((v,i) => v==null ? null : `${i && values[i-1]!=null?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).filter(Boolean).join(' ');
  const ts5Actual = {title:'トイ・ストーリー5',color:'#e4322b',values:[...worldTrend.map(d=>d.worldwide),null],current:true};
  const ts5Projected = {title:'TS5 最終見込み',color:'#f0b821',values:[...Array(worldTrend.length-1).fill(null),worldLatest.worldwide,D.forecast.base],projected:true};
  const ticks = [0,250,500,750,1000,1250];
  const grid = ticks.map(v=>`<g><line x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}"/><text x="${left-13}" y="${y(v)+4}" text-anchor="end">${v>=1000?`$${(v/1000).toFixed(1)}B`:`$${v}M`}</text></g>`).join('');
  const xLabels = labels.map((label,i)=>`<text class="x-label" x="${x(i)}" y="${height-23}" text-anchor="middle">${label}</text>`).join('');
  const draw = s => `<g class="trajectory-series ${s.projected?'projected':''} ${s.current?'current-world':''}"><path d="${path(s.values)}" stroke="${s.color}"/>${s.values.map((v,i)=>v==null?'':`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${s.color}"/>`).join('')}</g>`;
  const markerX = x(worldTrend.length-1);
  const finalX = x(labels.length-1);
  document.querySelector('#worldwide-trend-chart').innerHTML = `<div class="trajectory-meta"><b>トイ・ストーリー5 世界累計（$M）</b><span>赤実線＝公表値　黄色破線＝分析見込み</span></div><div class="trajectory-scroll world-trajectory-scroll"><svg class="trajectory-svg world-trajectory-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="トイ・ストーリー5の世界累計公表値と最終見込み"><g class="trajectory-grid">${grid}${xLabels}</g>${draw(ts5Actual)}${draw(ts5Projected)}<line class="actual-divider" x1="${markerX}" y1="${top}" x2="${markerX}" y2="${height-bottom}"/><text class="actual-label" x="${markerX-10}" y="${top+14}" text-anchor="end">ここまで公表値</text><text class="endpoint-label" x="${finalX+10}" y="${y(D.forecast.base)+4}" fill="#c39200">${billion(D.forecast.base)}</text></svg></div>`;
};
renderWorldwideTrajectory();
const renderWorldPeerSlope = () => {
  const width=1000,height=430,left=115,right=135,top=32,bottom=62,yMax=2000;
  const plotH=height-top-bottom,x0=left,x1=width-right;
  const y=v=>top+plotH-v/yMax*plotH;
  const peers=D.worldComparisons;
  const ts5={title:'トイ・ストーリー5 見込み',color:'#f0b821',opening:worldFirst.worldwide,final:D.forecast.base,projected:true};
  const all=[...peers,ts5];
  const ticks=[0,500,1000,1500,2000];
  const grid=ticks.map(v=>`<g><line x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}"/><text x="${left-14}" y="${y(v)+4}" text-anchor="end">${v>=1000?`$${(v/1000).toFixed(1)}B`:`$${v}M`}</text></g>`).join('');
  const finalOffsets={"トイ・ストーリー4":13,"トイ・ストーリー5 見込み":-8};
  const lines=all.map(s=>`<g class="trajectory-series ${s.projected?'projected':''}"><path d="M${x0},${y(s.opening)} L${x1},${y(s.final)}" stroke="${s.color}"/><circle cx="${x0}" cy="${y(s.opening)}" r="4" fill="${s.color}"/><circle cx="${x1}" cy="${y(s.final)}" r="4" fill="${s.color}"/><text class="endpoint-label" x="${x1+10}" y="${y(s.final)+(finalOffsets[s.title]||4)}" fill="${s.color}">${billion(s.final)}</text></g>`).join('');
  const legend=all.map(s=>`<span class="legend-item"><i style="--legend:${s.color}" class="${s.projected?'dashed':''}"></i>${s.title}</span>`).join('');
  document.querySelector('#world-peer-slope-chart').innerHTML=`<div class="world-slope-title"><b>比較作品：公開週末 → 最終世界興収</b><span>2つの実績端点を結ぶ比較図</span></div><div class="trajectory-scroll world-peer-slope"><svg class="trajectory-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="比較作品の公開週末世界興収と最終世界興収"><g class="trajectory-grid">${grid}<text class="x-label" x="${x0}" y="${height-24}" text-anchor="middle">公開週末</text><text class="x-label" x="${x1}" y="${height-24}" text-anchor="middle">最終</text></g>${lines}</svg></div><div class="trajectory-legend world-legend">${legend}</div>`;
};
renderWorldPeerSlope();
document.querySelector('#worldwide-trend-table').innerHTML = `<thead><tr><th>公表時点</th><th>北米累計</th><th>海外累計</th><th>世界累計</th><th>前回公表から</th><th>データ状態</th></tr></thead><tbody>${worldTrend.map(x => `<tr class="${x.latest?'current':''}"><td><b>${x.date}</b><small class="row-note">${x.label}</small></td><td class="num">${money(x.domestic)}</td><td class="num">${money(x.international)}</td><td class="num world-total">${money(x.worldwide)}</td><td class="num">${x.increase==null?'—':`<span class="up">▲ ${money(x.increase)}</span>`}</td><td><span class="status-pill">${x.status}</span></td></tr>`).join('')}</tbody>`;
document.querySelector('#checks-table').innerHTML = `<thead><tr><th>指標</th><th>採用値</th><th>別ソース</th><th>差</th><th>判断</th></tr></thead><tbody>${D.checks.map(x => `<tr><td>${x.metric}</td><td class="num">${money(x.adopted)}</td><td class="num">${money(x.alternate)}</td><td class="num">${money(x.difference)}</td><td>${x.note}</td></tr>`).join('')}</tbody>`;
document.querySelector('#source-links').innerHTML = D.sources.map(x => `<a href="${x.url}" target="_blank" rel="noreferrer">↗ ${x.name}</a>`).join('');

document.querySelectorAll('.tabs button').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.tabs button,.tab-page').forEach(el => el.classList.remove('active'));
  btn.classList.add('active'); document.querySelector(`#${btn.dataset.tab}`).classList.add('active');
}));

// Keep an already-open side panel fresh after the scheduled data file is replaced.
setInterval(() => location.reload(), 10 * 60 * 1000);
