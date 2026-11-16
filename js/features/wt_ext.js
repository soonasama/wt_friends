/* WT프렌즈 야구 기록실 - 2단계 확장 모듈 (경기 흐름 · 14시즌 아카이브 · 선수 심층 분석 · 상대전적) */
(function () {
  const WT_ID = 'aSEa0076';
  const cache = { core: null, box: null, detail: null, loading: {} };

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function loadScriptData(key, globalVar, path) {
    if (cache[key]) return Promise.resolve(cache[key]);
    if (window[globalVar]) {
      cache[key] = window[globalVar];
      return Promise.resolve(cache[key]);
    }
    if (cache.loading[key]) return cache.loading[key];
    cache.loading[key] = new Promise(resolve => {
      const s = document.createElement('script');
      s.src = path;
      s.onload = () => {
        cache[key] = window[globalVar] || null;
        resolve(cache[key]);
      };
      s.onerror = () => {
        console.warn('[WT_EXT] script load failed:', path);
        resolve(null);
      };
      document.head.appendChild(s);
    });
    return cache.loading[key];
  }

  const loadCore = () => loadScriptData('core', 'WT_CORE', 'js/data/core.js');
  const loadBox = () => loadScriptData('box', 'WT_BOX', 'js/data/box.js');
  const loadDetail = () => loadScriptData('detail', 'WT_DETAIL', 'js/data/detail.js');

  function teamName(core, tid) {
    if (!core || !core.teams || !core.teams[tid]) return tid;
    return core.teams[tid].s || core.teams[tid].n || tid;
  }

  function isHitEvent(txt) {
    return /(안|2루|3루|홈런|2|3|HR|볼넷|사구|몸|출루|번트안|내야안)/i.test(txt) && !/(삼진|땅|플|직|파울|병살|실책|야선)/.test(txt);
  }

  function parseGameFlow(boxEntry, awayName, homeName) {
    if (!Array.isArray(boxEntry) || boxEntry.length < 2) return null;
    const innings = {};
    function ingest(players, sideKey, tName) {
      if (!Array.isArray(players)) return;
      players.forEach(p => {
        const name = p[0];
        const batLog = typeof p[3] === 'string' ? p[3] : '';
        const runLog = typeof p[4] === 'string' ? p[4] : '';
        const pos = p[5] || '';
        const runsByInn = {};
        if (runLog) {
          runLog.split('|').forEach(seg => {
            const m = seg.match(/^(\d+):(.*)$/);
            if (m) runsByInn[Number(m[1])] = m[2];
          });
        }
        if (batLog) {
          batLog.split('|').forEach(seg => {
            const m = seg.match(/^(\d+):(.*)$/);
            if (!m) return;
            const inn = Number(m[1]);
            const desc = m[2].trim();
            if (!innings[inn]) innings[inn] = { a: [], h: [], aRuns: 0, hRuns: 0, aHits: 0, hHits: 0 };
            const rStr = runsByInn[inn] || '';
            const scored = /(^|,)R(,|$)/.test(rStr);
            const hit = isHitEvent(desc);
            if (sideKey === 'a') {
              if (scored) innings[inn].aRuns++;
              if (hit) innings[inn].aHits++;
            } else {
              if (scored) innings[inn].hRuns++;
              if (hit) innings[inn].hHits++;
            }
            innings[inn][sideKey].push({ name, pos, desc, run: rStr, scored, hit, team: tName });
          });
        }
      });
    }
    ingest(boxEntry[0], 'a', awayName);
    ingest(boxEntry[1], 'h', homeName);
    return innings;
  }

  function renderFlowHTML(innings, awayName, homeName, awayId, homeId) {
    const keys = Object.keys(innings).map(Number).sort((a, b) => a - b);
    if (!keys.length) return '';
    const maxVal = Math.max(1, ...keys.map(k => Math.max(innings[k].aHits + innings[k].aRuns, innings[k].hHits + innings[k].hRuns)));

    const bars = keys.map(k => {
      const d = innings[k];
      const ah = Math.max(4, Math.round(((d.aHits + d.aRuns) / maxVal) * 48));
      const hh = Math.max(4, Math.round(((d.hHits + d.hRuns) / maxVal) * 48));
      return `
        <div class="wt-flow-inn-col">
          <div class="wt-flow-pts">${d.aRuns}:${d.hRuns}</div>
          <div class="wt-flow-bars">
            <div class="wt-flow-bar ${awayId === WT_ID ? 'wt' : 'away'}" style="height:${ah}px" title="${esc(awayName)} ${k}회초: 출루/안타 ${d.aHits}, 득점 ${d.aRuns}"></div>
            <div class="wt-flow-bar ${homeId === WT_ID ? 'wt' : 'home'}" style="height:${hh}px" title="${esc(homeName)} ${k}회말: 출루/안타 ${d.hHits}, 득점 ${d.hRuns}"></div>
          </div>
          <div class="wt-flow-lbl">${k}회</div>
        </div>`;
    }).join('');

    const timeline = keys.map(k => {
      const d = innings[k];
      const renderHalf = (list, label) => {
        if (!list.length) return '';
        const chips = list.map(ev => {
          const cls = ev.scored ? 'run' : (ev.hit ? 'hit' : '');
          const posTxt = ev.pos ? `(${ev.pos})` : '';
          const runBadge = ev.scored ? ' ★득점' : '';
          return `<span class="wt-ev-chip ${cls}">${esc(ev.name)}${esc(posTxt)}: ${esc(ev.desc)}${runBadge}</span>`;
        }).join('');
        return `<div class="wt-tl-half"><div class="wt-tl-team">${esc(label)}</div><div class="wt-tl-evs">${chips}</div></div>`;
      };
      return `
        <div class="wt-tl-inn">
          <div class="wt-tl-inn-head">
            <span>${k}회 경기 흐름</span>
            <span>득점 ${d.aRuns} : ${d.hRuns}</span>
          </div>
          ${renderHalf(d.a, `${k}회초 · ${awayName}`)}
          ${renderHalf(d.h, `${k}회말 · ${homeName}`)}
        </div>`;
    }).join('');

    return `
      <div class="wt-ext-card" id="wt-ext-game-flow">
        <div class="wt-ext-head">
          <div class="wt-ext-title">📈 한눈에 보는 경기 흐름</div>
          <span class="wt-ext-badge">이닝별 타석 · 득점 타임라인</span>
        </div>
        <div style="font-size:12px;color:var(--sub);margin-bottom:8px">
          막대: <b style="color:${awayId === WT_ID ? '#f59e0b' : '#38bdf8'}">${esc(awayName)}</b> vs <b style="color:${homeId === WT_ID ? '#f59e0b' : '#10b981'}">${esc(homeName)}</b> (안타·출루·득점 활성도)
        </div>
        <div class="wt-flow-chart">${bars}</div>
        <div class="wt-timeline">${timeline}</div>
      </div>`;
  }

  async function enhanceGameView(gid) {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    const [core, box] = await Promise.all([loadCore(), loadBox()]);
    if (!core || !box) return;

    const g = (core.games || []).find(x => String(x[10]) === String(gid));
    const boxEntry = box.box ? box.box[String(gid)] : null;

    // 과거 시즌 경기(2013~2025)로 기존 Store에 없어서 '경기를 찾을 수 없습니다'가 뜬 경우 전체 페이지 렌더링
    if (appEl.textContent.includes('경기를 찾을 수 없습니다') && g) {
      const date = g[0], awayId = g[1], homeId = g[2], as = g[3], hs = g[4], comp = g[5], grp = g[6];
      const awayName = teamName(core, awayId), homeName = teamName(core, homeId);
      const innings = parseGameFlow(boxEntry, awayName, homeName);
      const flowHtml = innings ? renderFlowHTML(innings, awayName, homeName, awayId, homeId) : '<div class="wt-ext-card"><div class="wt-ext-title">이 경기는 이닝별 세부 타석 로그가 제공되지 않습니다.</div></div>';

      const renderBoxTable = (players, title) => {
        if (!Array.isArray(players) || !players.length) return '';
        const rows = players.map(p => {
          const st = Array.isArray(p[1]) ? p[1] : [0, 0, 0, 0, 0, 0];
          const pos = p[5] || '-';
          return `<tr><td><b>${esc(p[0])}</b></td><td>${esc(pos)}</td><td>${st[1] ?? '-'}</td><td>${st[2] ?? '-'}</td><td>${st[3] ?? '-'}</td><td>${st[4] ?? '-'}</td><td>${st[5] ?? '-'}</td></tr>`;
        }).join('');
        return `
          <div class="wt-ext-card">
            <div class="wt-ext-head"><div class="wt-ext-title">⚾ ${esc(title)} 박스스코어</div></div>
            <div style="overflow-x:auto">
              <table class="wt-spray-table">
                <thead><tr><th>선수</th><th>포지션</th><th>타수</th><th>안타</th><th>타점</th><th>득점</th><th>삼진</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>`;
      };

      appEl.innerHTML = `
        <div class="wt-ext-wrap">
          <div class="wt-ext-card">
            <div class="wt-ext-head">
              <div class="wt-ext-title">${esc(comp)} ${grp ? '· ' + esc(grp) : ''}</div>
              <span class="wt-ext-badge gold">${esc(date)} (과거 시즌 기록)</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-around;padding:14px 0;font-size:18px;font-weight:900">
              <div style="text-align:center">
                <div style="color:${awayId === WT_ID ? 'var(--gold)' : 'var(--ink)'}">${esc(awayName)}</div>
                <div style="font-size:28px;margin-top:4px">${as ?? '-'}</div>
              </div>
              <div style="color:var(--sub);font-size:14px">VS</div>
              <div style="text-align:center">
                <div style="color:${homeId === WT_ID ? 'var(--gold)' : 'var(--ink)'}">${esc(homeName)}</div>
                <div style="font-size:28px;margin-top:4px">${hs ?? '-'}</div>
              </div>
            </div>
            <div class="wt-ext-quickbar" style="justify-content:center;margin-bottom:0">
              <a class="wt-ext-pillbtn" href="#/archive">📅 14시즌 아카이브로 돌아가기</a>
            </div>
          </div>
          ${flowHtml}
          ${boxEntry ? renderBoxTable(boxEntry[0], awayName) : ''}
          ${boxEntry ? renderBoxTable(boxEntry[1], homeName) : ''}
        </div>`;
      return;
    }

    // 기존 2026 경기 페이지 하단에 경기 흐름 섹션 추가
    if (document.getElementById('wt-ext-game-flow')) return;
    if (g && boxEntry) {
      const awayId = g[1], homeId = g[2];
      const awayName = teamName(core, awayId), homeName = teamName(core, homeId);
      const innings = parseGameFlow(boxEntry, awayName, homeName);
      if (innings) {
        const html = renderFlowHTML(innings, awayName, homeName, awayId, homeId);
        if (html) {
          const wrap = document.createElement('div');
          wrap.className = 'wt-ext-wrap';
          wrap.innerHTML = html;
          appEl.appendChild(wrap);
        }
      }
    }
  }

  function renderSpraySVG(arrTotal, arrHits) {
    // zones: 0:포, 1:3루, 2:유격, 3:투, 4:2루, 5:1루, 6:좌, 7:좌중, 8:중, 9:우중, 10:우
    const coords = [
      [130, 212, '포'], [84, 152, '3루'], [104, 130, '유격'], [130, 160, '투'], [156, 130, '2루'], [176, 152, '1루'],
      [48, 86, '좌'], [85, 52, '좌중'], [130, 38, '중'], [175, 52, '우중'], [212, 86, '우']
    ];
    const maxT = Math.max(1, ...arrTotal);
    const dots = coords.map((c, idx) => {
      const tot = arrTotal[idx] || 0;
      const hit = arrHits[idx] || 0;
      const r = tot > 0 ? Math.min(20, 8 + Math.round((tot / maxT) * 12)) : 6;
      const fill = hit > 0 ? '#10b981' : (tot > 0 ? '#38bdf8' : 'rgba(148,163,184,0.25)');
      return `
        <g>
          <circle cx="${c[0]}" cy="${c[1]}" r="${r}" fill="${fill}" fill-opacity="0.82" stroke="#0f172a" stroke-width="1.2"></circle>
          <text x="${c[0]}" y="${c[1] + 3.5}" text-anchor="middle" font-size="9.5" font-weight="800" fill="#ffffff">${tot > 0 ? tot : ''}</text>
          <text x="${c[0]}" y="${c[1] + r + 10}" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor" opacity="0.75">${c[2]}</text>
        </g>`;
    }).join('');

    return `
      <svg viewBox="0 0 260 240" style="width:100%;max-width:260px;display:block;margin:0 auto;color:var(--ink2)">
        <path d="M130 218 L24 102 A145 145 0 0 1 236 102 Z" fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.4)" stroke-width="1.5"/>
        <polygon points="130,210 78,158 130,106 182,158" fill="rgba(245,158,11,0.09)" stroke="rgba(245,158,11,0.45)" stroke-width="1.4"/>
        ${dots}
      </svg>`;
  }

  async function enhancePlayerView(rawKey) {
    const appEl = document.getElementById('app');
    if (!appEl || document.getElementById('wt-ext-player-deep')) return;
    const key = decodeURIComponent(rawKey || '');
    if (!key) return;

    const [core, detail] = await Promise.all([loadCore(), loadDetail()]);
    if (!core || !detail) return;

    const parts = key.split('|');
    const tid = parts[0], pname = parts[1];
    const zones = core.zones || ['포', '3루', '유격', '투', '2루', '1루', '좌', '좌중', '중', '우중', '우'];
    const years = (core.years || []).filter(y => {
      const hasSpray = detail.spray && detail.spray[y] && detail.spray[y][key];
      const hasDef = detail.def && detail.def[y] && detail.def[y][key];
      const hasPos = detail.pos && detail.pos[y] && detail.pos[y][tid];
      return hasSpray || hasDef || hasPos;
    });
    if (!years.length) return;

    let selYear = years.includes('2026') ? '2026' : years[0];
    const wrap = document.createElement('div');
    wrap.className = 'wt-ext-wrap';
    wrap.id = 'wt-ext-player-deep';
    appEl.appendChild(wrap);

    function draw() {
      const sprayData = (detail.spray && detail.spray[selYear] && detail.spray[selYear][key]) || null;
      const defData = (detail.def && detail.def[selYear] && detail.def[selYear][key]) || null;

      // 포지션 출전
      const posEntries = [];
      if (detail.pos && detail.pos[selYear] && detail.pos[selYear][tid]) {
        Object.entries(detail.pos[selYear][tid]).forEach(([posName, list]) => {
          const hit = (list || []).find(x => x[0] === pname);
          if (hit) posEntries.push([posName, hit[1]]);
        });
      }
      posEntries.sort((a, b) => b[1] - a[1]);
      const maxPos = Math.max(1, ...posEntries.map(x => x[1]));
      const posHtml = posEntries.length
        ? `<div class="wt-pos-list">${posEntries.map(([pn, cnt]) => `
            <div class="wt-pos-row">
              <b>${esc(pn)}</b>
              <div class="wt-pos-bar-bg"><div class="wt-pos-bar-fill" style="width:${Math.round((cnt / maxPos) * 100)}%"></div></div>
              <span style="text-align:right;font-weight:700">${cnt}경기</span>
            </div>`).join('')}</div>`
        : '<div style="font-size:12px;color:var(--sub)">해당 연도 포지션 출전 기록이 없습니다.</div>';

      // 타구 방향 스프레이
      let sprayHtml = '<div style="font-size:12px;color:var(--sub)">해당 연도 타구 방향 기록이 없습니다.</div>';
      if (sprayData && Array.isArray(sprayData[0])) {
        const tot = sprayData[0], hits = sprayData[1] || [];
        const rows = zones.map((zn, i) => tot[i] > 0 ? `<tr><td><b>${esc(zn)}</b></td><td>${tot[i]}</td><td style="color:var(--accent);font-weight:700">${hits[i] || 0}</td></tr>` : '').join('');
        sprayHtml = `
          <div class="wt-spray-grid">
            <div>${renderSpraySVG(tot, hits)}</div>
            <div style="overflow-x:auto">
              <table class="wt-spray-table">
                <thead><tr><th>방향</th><th>타구</th><th>안타</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="3">타구 기록 없음</td></tr>'}</tbody>
              </table>
            </div>
          </div>`;
      }

      // 수비 기록
      let defHtml = '';
      if (defData && Object.keys(defData).length) {
        const dRows = Object.entries(defData).map(([pos, arr]) => `<tr><td><b>${esc(pos)}</b></td><td>${arr[0]}</td><td>${arr[1]}</td><td style="color:${arr[2] > 0 ? '#ef4444' : 'var(--accent)'};font-weight:700">${arr[2]}</td></tr>`).join('');
        defHtml = `
          <div style="margin-top:12px">
            <div style="font-size:13px;font-weight:800;margin-bottom:6px">🧤 포지션별 수비 기록</div>
            <table class="wt-spray-table">
              <thead><tr><th>포지션</th><th>경기</th><th>수비기회</th><th>실책</th></tr></thead>
              <tbody>${dRows}</tbody>
            </table>
          </div>`;
      }

      wrap.innerHTML = `
        <div class="wt-ext-card">
          <div class="wt-ext-head">
            <div class="wt-ext-title">📊 심층 분석 (포지션 · 타구 방향 · 수비)</div>
            <select class="wt-arch-sel" id="wtExtPlayerYear">
              ${years.map(y => `<option value="${y}" ${y === selYear ? 'selected' : ''}>${y} 시즌</option>`).join('')}
            </select>
          </div>
          <div style="font-size:13px;font-weight:800;margin-bottom:8px">📍 포지션 출전 분포</div>
          ${posHtml}
          <div style="font-size:13px;font-weight:800;margin:14px 0 8px">🎯 타구 방향 분포 (초록: 안타 포함 / 파랑: 아웃)</div>
          ${sprayHtml}
          ${defHtml}
        </div>`;

      const sel = document.getElementById('wtExtPlayerYear');
      if (sel) sel.onchange = () => { selYear = sel.value; draw(); };
    }
    draw();
  }

  async function enhanceHomeAndLists(routeName) {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    // 퀵 링크 바 추가 (홈, 경기, 순위 상단)
    if (['home', 'games', 'standings', 'team'].includes(routeName) && !document.getElementById('wt-ext-quickbar')) {
      const bar = document.createElement('div');
      bar.className = 'wt-ext-quickbar';
      bar.id = 'wt-ext-quickbar';
      bar.innerHTML = `
        <a class="wt-ext-pillbtn pri" href="#/archive">📅 14시즌 아카이브 (2013~2026)</a>
        <a class="wt-ext-pillbtn" href="#/h2h">⚔️ WT프렌즈 역대 상대전적</a>`;
      appEl.prepend(bar);
    }

    // 홈 화면 하단에 주요 기록 하이라이트
    if (routeName === 'home' && !document.getElementById('wt-ext-home-ms')) {
      const core = await loadCore();
      if (!core || !Array.isArray(core.ms)) return;
      const wtMs = core.ms.filter(m => String(m[1]).startsWith(WT_ID + '|'));
      const topMs = (wtMs.length ? wtMs : core.ms).slice(0, 6);
      if (!topMs.length) return;

      const wrap = document.createElement('div');
      wrap.className = 'wt-ext-wrap';
      wrap.id = 'wt-ext-home-ms';
      wrap.innerHTML = `
        <div class="wt-ext-card">
          <div class="wt-ext-head">
            <div class="wt-ext-title">🏅 ${wtMs.length ? 'WT프렌즈' : '2026 시즌'} 주요 기록 하이라이트</div>
            <a class="wt-ext-badge gold" href="#/archive" style="text-decoration:none">역대 기록 더보기 ›</a>
          </div>
          <div class="wt-ms-list">
            ${topMs.map(m => {
              const [dt, pkey, , label, , gid] = m;
              const [tid, pn] = String(pkey).split('|');
              const isWt = tid === WT_ID;
              return `
                <a class="wt-ms-item ${isWt ? 'is-wt' : ''}" href="#/game/${esc(gid)}">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span class="wt-ext-badge ${isWt ? 'gold' : ''}">${esc(label)}</span>
                    <span style="font-size:11px;color:var(--sub)">${esc(dt)}</span>
                  </div>
                  <div style="font-size:13.5px;font-weight:800;margin-top:4px">${esc(pn)} <span style="font-size:11.5px;font-weight:600;color:var(--sub)">· ${esc(teamName(core, tid))}</span></div>
                </a>`;
            }).join('')}
          </div>
        </div>`;
      appEl.appendChild(wrap);
    }
  }

  async function renderArchivePage() {
    const appEl = document.getElementById('app');
    if (!appEl) return;
    appEl.innerHTML = '<div class="loading">14시즌 데이터를 불러오는 중…</div>';
    const core = await loadCore();
    if (!core) {
      appEl.innerHTML = '<div class="empty">14시즌 데이터를 불러오지 못했습니다.</div>';
      return;
    }

    const years = core.years || [];
    let selYear = 'all';
    let onlyWT = true;

    function draw() {
      const gamesAll = core.games || [];
      const filtered = gamesAll.filter(g => {
        const yOk = selYear === 'all' || String(g[0]).startsWith(selYear);
        const wtOk = !onlyWT || g[1] === WT_ID || g[2] === WT_ID;
        return yOk && wtOk;
      });
      // WT프렌즈 경기 최우선 정렬
      filtered.sort((a, b) => {
        const aw = (a[1] === WT_ID || a[2] === WT_ID) ? 0 : 1;
        const bw = (b[1] === WT_ID || b[2] === WT_ID) ? 0 : 1;
        if (aw !== bw) return aw - bw;
        return String(b[0]).localeCompare(String(a[0]));
      });

      // WT프렌즈 요약 계산
      const wtList = gamesAll.filter(g => (selYear === 'all' || String(g[0]).startsWith(selYear)) && (g[1] === WT_ID || g[2] === WT_ID));
      let w = 0, l = 0, d = 0, rf = 0, ra = 0;
      wtList.forEach(g => {
        const isAway = g[1] === WT_ID;
        const s1 = Number(g[3]), s2 = Number(g[4]);
        if (isNaN(s1) || isNaN(s2)) return;
        const myS = isAway ? s1 : s2, oppS = isAway ? s2 : s1;
        rf += myS; ra += oppS;
        if (myS > oppS) w++; else if (myS < oppS) l++; else d++;
      });
      const pct = (w + l) > 0 ? (w / (w + l)).toFixed(3).replace(/^0/, '') : '.000';
      const wtDivs = (core.teams && core.teams[WT_ID] && core.teams[WT_ID].d) || {};
      const divNote = selYear !== 'all' && wtDivs[selYear] ? ` (${wtDivs[selYear]}리그)` : '';

      const listHtml = filtered.slice(0, 80).map(g => {
        const [dt, aId, hId, as, hs, comp, grp, , , , gid] = g;
        const isWt = aId === WT_ID || hId === WT_ID;
        const aName = teamName(core, aId), hName = teamName(core, hId);
        let pill = '';
        if (isWt && as !== null && hs !== null) {
          const myS = aId === WT_ID ? as : hs, oppS = aId === WT_ID ? hs : as;
          pill = myS > oppS ? '<span class="wt-res-pill w">승</span>' : (myS < oppS ? '<span class="wt-res-pill l">패</span>' : '<span class="wt-res-pill d">무</span>');
        }
        return `
          <a class="wt-game-item ${isWt ? 'is-wt' : ''}" href="#/game/${esc(gid)}">
            <div>
              <div style="font-size:11px;color:var(--sub)">${esc(dt)} · ${esc(comp)} ${grp ? esc(grp) : ''}</div>
              <div style="font-size:13.5px;font-weight:800;margin-top:2px">
                <span style="color:${aId === WT_ID ? 'var(--gold)' : 'inherit'}">${esc(aName)}</span>
                <span style="margin:0 6px;color:var(--accent)">${as ?? '-'} : ${hs ?? '-'}</span>
                <span style="color:${hId === WT_ID ? 'var(--gold)' : 'inherit'}">${esc(hName)}</span>
              </div>
            </div>
            <div>${pill}</div>
          </a>`;
      }).join('');

      appEl.innerHTML = `
        <div class="wt-ext-wrap">
          <div class="wt-ext-card">
            <div class="wt-ext-head">
              <div class="wt-ext-title">📅 14시즌 아카이브 (2013~2026)</div>
              <a class="wt-ext-pillbtn" href="#/">🏠 홈으로</a>
            </div>
            <div class="wt-arch-filters">
              <select class="wt-arch-sel" id="wtArchYear">
                <option value="all" ${selYear === 'all' ? 'selected' : ''}>전체 14시즌 (2013~2026)</option>
                ${years.map(y => `<option value="${y}" ${selYear === y ? 'selected' : ''}>${y} 시즌</option>`).join('')}
              </select>
              <button type="button" class="wt-ext-pillbtn ${onlyWT ? 'pri' : ''}" id="wtArchToggleWT">
                ${onlyWT ? '⭐ WT프렌즈 경기만 보기' : '전체 팀 경기 보기'}
              </button>
            </div>
            <div style="font-size:12.5px;font-weight:700;color:var(--gold);margin-bottom:8px">
              WT프렌즈 ${selYear === 'all' ? '역대 통산' : selYear + ' 시즌'}${esc(divNote)} 요약
            </div>
            <div class="wt-kpi-grid">
              <div class="wt-kpi-box"><div class="wt-kpi-val">${wtList.length}</div><div class="wt-kpi-lbl">경기 수</div></div>
              <div class="wt-kpi-box"><div class="wt-kpi-val">${w}승 ${l}패 ${d}무</div><div class="wt-kpi-lbl">전적</div></div>
              <div class="wt-kpi-box"><div class="wt-kpi-val">${pct}</div><div class="wt-kpi-lbl">승률</div></div>
              <div class="wt-kpi-box"><div class="wt-kpi-val">${rf} / ${ra}</div><div class="wt-kpi-lbl">득점 / 실점</div></div>
            </div>
            <div style="font-size:12px;color:var(--sub);margin-bottom:8px">총 ${filtered.length}경기 (최대 80경기 표시 · 클릭 시 경기 흐름 상세)</div>
            <div>${listHtml || '<div class="empty">해당 조건의 경기가 없습니다.</div>'}</div>
          </div>
        </div>`;

      document.getElementById('wtArchYear').onchange = e => { selYear = e.target.value; draw(); };
      document.getElementById('wtArchToggleWT').onclick = () => { onlyWT = !onlyWT; draw(); };
    }
    draw();
  }

  async function renderH2HPage() {
    const appEl = document.getElementById('app');
    if (!appEl) return;
    appEl.innerHTML = '<div class="loading">역대 상대전적을 불러오는 중…</div>';
    const core = await loadCore();
    if (!core || !core.h2h || !core.h2h[WT_ID]) {
      appEl.innerHTML = '<div class="empty">상대전적 데이터를 불러오지 못했습니다.</div>';
      return;
    }
    const entries = Object.entries(core.h2h[WT_ID]).map(([oppId, rec]) => {
      const [w, l, d] = rec;
      const tot = w + l + d;
      const pct = (w + l) > 0 ? Math.round((w / (w + l)) * 100) : 0;
      return { oppId, name: teamName(core, oppId), w, l, d, tot, pct };
    }).sort((a, b) => b.tot - a.tot || b.w - a.w);

    appEl.innerHTML = `
      <div class="wt-ext-wrap">
        <div class="wt-ext-card">
          <div class="wt-ext-head">
            <div class="wt-ext-title">⚔️ WT프렌즈 역대 상대전적 (2013~2026)</div>
            <a class="wt-ext-pillbtn" href="#/">🏠 홈으로</a>
          </div>
          <div style="font-size:12px;color:var(--sub);margin-bottom:10px">총 ${entries.length}개 구단과의 역대 공식전 맞대결 전적입니다.</div>
          <div style="overflow-x:auto">
            <table class="wt-spray-table">
              <thead><tr><th style="text-align:left">상대 구단</th><th>경기</th><th>승</th><th>패</th><th>무</th><th>승률</th></tr></thead>
              <tbody>
                ${entries.map(e => `
                  <tr>
                    <td style="text-align:left"><b>${esc(e.name)}</b></td>
                    <td>${e.tot}</td>
                    <td style="color:#10b981;font-weight:800">${e.w}</td>
                    <td style="color:#ef4444;font-weight:800">${e.l}</td>
                    <td>${e.d}</td>
                    <td><b>${e.pct}%</b></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  window.addEventListener('wt:rendered', e => {
    const info = e.detail || {};
    const name = info.name || 'home';
    const parts = info.parts || [];
    if (name === 'archive') { renderArchivePage(); return; }
    if (name === 'h2h') { renderH2HPage(); return; }
    if (name === 'game' && parts[1]) { enhanceGameView(parts[1]); return; }
    if (name === 'player' && parts[1]) { enhancePlayerView(parts[1]); return; }
    enhanceHomeAndLists(name);
  });
})();
