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
    if (!txt) return false;
    if (/^(1|2|3|투|포|유|좌|중|우)?(땅|플|파플|인플|직선타|직|삼진|낫아웃|번|희번|희플|실|송구실책|포구실책|야선|병살)$/.test(txt)) return false;
    if (/(삼진|낫아웃(?!출)|땅(?!출)|플|직|파울|병살|실|야선)/.test(txt)) return false;
    return /(안|루타|홈|HR|볼넷|4구|사구|몸|출$|[가-힣](2|3)$)/i.test(txt);
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
        const scoredUsed = {};
        if (batLog) {
          batLog.split('|').forEach(seg => {
            const m = seg.match(/^(\d+):(.*)$/);
            if (!m) return;
            const inn = Number(m[1]);
            const desc = m[2].trim();
            if (!innings[inn]) innings[inn] = { a: [], h: [], aRuns: 0, hRuns: 0, aHits: 0, hHits: 0 };
            const rStr = runsByInn[inn] || '';
            const scored = !scoredUsed[inn] && /(^|,)R(,|$)/.test(rStr);
            if (scored) scoredUsed[inn] = true;
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
        // 대주자 등 타석 기록 없이 주루 득점만 있는 경우(전체 59건) 누락 없이 반영
        Object.entries(runsByInn).forEach(([innStr, rStr]) => {
          const inn = Number(innStr);
          if (!scoredUsed[inn] && /(^|,)R(,|$)/.test(rStr)) {
            if (!innings[inn]) innings[inn] = { a: [], h: [], aRuns: 0, hRuns: 0, aHits: 0, hHits: 0 };
            if (sideKey === 'a') innings[inn].aRuns++; else innings[inn].hRuns++;
            innings[inn][sideKey].push({ name, pos: pos || '주자', desc: '대주자/주루', run: rStr, scored: true, hit: false, team: tName });
          }
        });
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

    let g = (core.games || []).find(x => String(x[10]) === String(gid));
    if (!g && window.Store && typeof window.Store.game === 'function') {
      const sg = window.Store.game(gid);
      if (sg && sg.away && sg.home) {
        g = (core.games || []).find(x =>
          x[0] === sg.date &&
          ((x[1] === sg.away.id && x[2] === sg.home.id) || (x[1] === sg.home.id && x[2] === sg.away.id))
        );
      }
    }
    const boxId = g ? String(g[10]) : String(gid);
    const boxEntry = box.box ? box.box[boxId] : null;

    // 과거 시즌 경기(2013~2025)로 기존 Store에 없어서 '경기를 찾을 수 없습니다'가 뜬 경우 전체 페이지 렌더링
    if (appEl.textContent.includes('경기를 찾을 수 없습니다') && g) {
      const date = g[0], awayId = g[1], homeId = g[2], as = g[3], hs = g[4], comp = g[5], grp = g[6];
      const awayName = teamName(core, awayId), homeName = teamName(core, homeId);
      const innings = parseGameFlow(boxEntry, awayName, homeName);
      const flowHtml = innings ? renderFlowHTML(innings, awayName, homeName, awayId, homeId) : '<div class="wt-ext-card"><div class="wt-ext-title">이 경기는 이닝별 세부 타석 로그가 제공되지 않습니다.</div></div>';

      const fmtInn = outs => {
        const n = Number(outs) || 0;
        const full = Math.floor(n / 3), rem = n % 3;
        return rem ? `${full}.${rem}` : `${full}`;
      };
      const renderBoxTable = (players, title) => {
        if (!Array.isArray(players) || !players.length) return '';
        const rows = players.map(p => {
          const st = Array.isArray(p[1]) ? p[1] : [0, 0, 0, 0, 0, 0];
          const pos = p[5] || '-';
          return `<tr><td>${st[0] ?? '-'}</td><td><b>${esc(p[0])}</b></td><td>${esc(pos)}</td><td>${st[1] ?? '-'}</td><td>${st[2] ?? '-'}</td><td>${st[3] ?? '-'}</td><td>${st[4] ?? '-'}</td><td>${st[5] ?? '-'}</td></tr>`;
        }).join('');
        const pitchers = players.filter(p => Array.isArray(p[2]) && p[2].length >= 6);
        const pitHtml = pitchers.length ? `
          <div style="margin-top:12px">
            <div style="font-size:12.5px;font-weight:800;color:var(--sub);margin-bottom:6px">🔥 투수 기록</div>
            <div style="overflow-x:auto">
              <table class="wt-spray-table">
                <thead><tr><th>투수</th><th>이닝</th><th>피안타</th><th>사사구</th><th>탈삼진</th><th>실점</th><th>자책</th><th>결과</th></tr></thead>
                <tbody>${pitchers.map(p => {
                  const pt = p[2];
                  const res = pt[6] === 'W' ? '승' : (pt[6] === 'L' ? '패' : (pt[6] || '-'));
                  return `<tr><td><b>${esc(p[0])}</b></td><td>${fmtInn(pt[0])}</td><td>${pt[1]}</td><td>${pt[2]}</td><td>${pt[3]}</td><td>${pt[4]}</td><td>${pt[5]}</td><td><b>${esc(res)}</b></td></tr>`;
                }).join('')}</tbody>
              </table>
            </div>
          </div>` : '';
        return `
          <div class="wt-ext-card">
            <div class="wt-ext-head"><div class="wt-ext-title">⚾ ${esc(title)} 박스스코어</div></div>
            <div style="overflow-x:auto">
              <table class="wt-spray-table">
                <thead><tr><th>타순</th><th>선수</th><th>포지션</th><th>타수</th><th>안타</th><th>타점</th><th>득점</th><th>도루</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            ${pitHtml}
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

    // 2026 시즌 WT프렌즈 경기일 경우 "그날 경기의 좋은 기록" 생성
    function renderGameHighlightsHTML() {
      if (!g || !boxEntry) return '';
      const is2026WT = String(g[0]).startsWith('2026') && (g[1] === WT_ID || g[2] === WT_ID);
      if (!is2026WT) return '';
      const wtSideIdx = g[1] === WT_ID ? 0 : 1;
      const wtPlayers = Array.isArray(boxEntry[wtSideIdx]) ? boxEntry[wtSideIdx] : [];
      const hlList = [];
      wtPlayers.forEach(p => {
        const nm = p[0];
        const st = Array.isArray(p[1]) ? p[1] : [0, 0, 0, 0, 0, 0];
        const [, ab, h, rbi, r, sb] = st;
        const batLog = typeof p[3] === 'string' ? p[3] : '';
        const tags = [];
        if (h >= 3) tags.push(`🔥 맹타 (${h}안타)`);
        else if (h === 2) tags.push('✨ 멀티히트 (2안타)');
        if (/홈런|HR/.test(batLog)) tags.push('💣 홈런');
        else if (/3$|3루타/.test(batLog) || /\|[^|]*3(\| |$)/.test(batLog)) tags.push('⚡ 3루타');
        else if (/2$|2루타/.test(batLog) || /\|[^|]*2(\| |$)/.test(batLog)) tags.push('💥 2루타');
        if (rbi >= 2) tags.push(`🎯 ${rbi}타점`);
        if (r >= 2) tags.push(`🏃 ${r}득점`);
        if (sb >= 2) tags.push(`💨 ${sb}도루`);
        if (Array.isArray(p[2]) && p[2].length >= 7) {
          const [outs, , , so, ra, er, res] = p[2];
          if (res === 'W') tags.push('🏆 승리투수');
          if (so >= 2) tags.push(`🔥 ${so}탈삼진`);
          if (outs >= 6 && er === 0) tags.push('🛡️ 무자책 호투');
        }
        if (tags.length) {
          hlList.push({ nm, tags, ab, h, rbi, r, sb });
        }
      });
      if (!hlList.length) return '';
      return `
        <div class="wt-ext-card" id="wt-ext-game-highlights">
          <div class="wt-ext-head">
            <div class="wt-ext-title">🌟 그날 경기의 좋은 기록 (WT프렌즈 하이라이트)</div>
            <span class="wt-ext-badge gold">${esc(g[0])}</span>
          </div>
          <div class="wt-ms-list">
            ${hlList.map(x => `
              <a class="wt-ms-item is-wt" href="#/player/${encodeURIComponent(WT_ID + '|' + x.nm)}">
                <div style="font-size:13.5px;font-weight:900">${esc(x.nm)}</div>
                <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
                  ${x.tags.map(tg => `<span class="wt-ext-badge gold">${esc(tg)}</span>`).join('')}
                </div>
              </a>`).join('')}
          </div>
        </div>`;
    }

    // 기존 2026 경기 페이지 하단에 좋은 기록 + 경기 흐름 섹션 추가
    if (document.getElementById('wt-ext-game-flow')) return;
    if (g && boxEntry) {
      const awayId = g[1], homeId = g[2];
      const awayName = teamName(core, awayId), homeName = teamName(core, homeId);
      const hlHtml = renderGameHighlightsHTML();
      const innings = parseGameFlow(boxEntry, awayName, homeName);
      const flowHtml = innings ? renderFlowHTML(innings, awayName, homeName, awayId, homeId) : '';
      if (hlHtml || flowHtml) {
        const wrap = document.createElement('div');
        wrap.className = 'wt-ext-wrap';
        wrap.innerHTML = hlHtml + flowHtml;
        appEl.appendChild(wrap);
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

    const [core, box, detail] = await Promise.all([loadCore(), loadBox(), loadDetail()]);
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

    // 개인별 2026 시즌 최고 기록 & 역대(통산) 커리어 하이 카드
    if (box && box.box && Array.isArray(core.games) && !document.getElementById('wt-ext-player-records')) {
      const pGames = [];
      core.games.forEach(g => {
        if (g[1] !== tid && g[2] !== tid) return;
        const gid = String(g[10]);
        const sideIdx = g[1] === tid ? 0 : 1;
        const b = box.box[gid];
        if (!b || !Array.isArray(b[sideIdx])) return;
        const pEntry = b[sideIdx].find(x => x[0] === pname);
        if (!pEntry) return;
        const opp = teamName(core, sideIdx === 0 ? g[2] : g[1]);
        const st = Array.isArray(pEntry[1]) ? pEntry[1] : [0, 0, 0, 0, 0, 0];
        const pt = Array.isArray(pEntry[2]) && pEntry[2].length >= 6 ? pEntry[2] : null;
        pGames.push({ gid, dt: g[0], opp, h: st[2] || 0, rbi: st[3] || 0, r: st[4] || 0, sb: st[5] || 0, so: pt ? (pt[3] || 0) : 0 });
      });

      if (pGames.length) {
        const bestOf = (list, field, unit, label, icon) => {
          const valid = list.filter(x => x[field] > 0);
          if (!valid.length) return null;
          const maxV = Math.max(...valid.map(x => x[field]));
          const best = valid.find(x => x[field] === maxV);
          return { label: `${icon} ${label}`, val: `${maxV}${unit}`, sub: `${best.dt} vs ${best.opp}`, gid: best.gid };
        };
        const p2026 = pGames.filter(x => String(x.dt).startsWith('2026'));
        const cards2026 = [
          bestOf(p2026, 'h', '안타', '2026 최다 안타', '🔥'),
          bestOf(p2026, 'rbi', '타점', '2026 최다 타점', '💥'),
          bestOf(p2026, 'r', '득점', '2026 최다 득점', '⚡'),
          bestOf(p2026, 'sb', '도루', '2026 최다 도루', '🏃‍♀️'),
          bestOf(p2026, 'so', 'K', '2026 최다 탈삼진', '🎯')
        ].filter(Boolean);

        const cardsAll = [
          bestOf(pGames, 'h', '안타', '역대 최다 안타', '👑'),
          bestOf(pGames, 'rbi', '타점', '역대 최다 타점', '🏆'),
          bestOf(pGames, 'r', '득점', '역대 최다 득점', '🌟'),
          bestOf(pGames, 'sb', '도루', '역대 최다 도루', '💨'),
          bestOf(pGames, 'so', 'K', '역대 최다 탈삼진', '⚾')
        ].filter(Boolean);

        if (cards2026.length || cardsAll.length) {
          const recCard = document.createElement('div');
          recCard.className = 'wt-ext-card';
          recCard.id = 'wt-ext-player-records';
          const renderGrid = arr => arr.map(c => `
            <a class="wt-ms-item is-wt" href="#/game/${esc(c.gid)}">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span class="wt-ext-badge gold">${esc(c.label)}</span>
                <b style="font-size:15px;color:var(--gold)">${esc(c.val)}</b>
              </div>
              <div style="font-size:11.5px;color:var(--sub);margin-top:4px">${esc(c.sub)}</div>
            </a>`).join('');

          recCard.innerHTML = `
            <div class="wt-ext-head">
              <div class="wt-ext-title">🏅 ${esc(pname)} 선수 베스트 기록 하이라이트</div>
              <span class="wt-ext-badge gold">클릭 시 해당 경기 이동</span>
            </div>
            ${cards2026.length ? `<div style="font-size:12.5px;font-weight:800;color:var(--accent);margin-bottom:6px">📅 2026 시즌 베스트</div><div class="wt-ms-list" style="margin-bottom:12px">${renderGrid(cards2026)}</div>` : ''}
            ${cardsAll.length ? `<div style="font-size:12.5px;font-weight:800;color:var(--gold);margin-bottom:6px">✨ 역대 통산 커리어 하이 (2013~2026)</div><div class="wt-ms-list">${renderGrid(cardsAll)}</div>` : ''}
          `;
          wrap.appendChild(recCard);
        }
      }
    }
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
        <a class="wt-ext-pillbtn" href="#/h2h">⚔️ WT프렌즈 역대 상대전적</a>
        <a class="wt-ext-pillbtn" href="#/gallery">📷 팀 갤러리 · 자료실</a>
        <a class="wt-ext-pillbtn" href="#/manito">🎁 연말총회 마니또</a>`;
      appEl.prepend(bar);
    }

    // 홈 화면 하단에 2026 시즌 WT프렌즈 최고 기록 하이라이트
    if (routeName === 'home' && !document.getElementById('wt-ext-home-ms')) {
      const [core, box] = await Promise.all([loadCore(), loadBox()]);
      if (!core || !box || !box.box) return;
      const wt2026 = (core.games || []).filter(g => (g[1] === WT_ID || g[2] === WT_ID) && String(g[0]).startsWith('2026'));
      if (!wt2026.length) return;

      const gameRecs = { h: [], rbi: [], r: [], sb: [], so: [] };
      const tot = { h: {}, rbi: {}, r: {}, sb: {}, so: {} };

      wt2026.forEach(g => {
        const gid = String(g[10]), dt = g[0];
        const sideIdx = g[1] === WT_ID ? 0 : 1;
        const opp = teamName(core, sideIdx === 0 ? g[2] : g[1]);
        const b = box.box[gid];
        if (!b || !Array.isArray(b[sideIdx])) return;
        b[sideIdx].forEach(p => {
          const nm = p[0];
          const st = Array.isArray(p[1]) ? p[1] : [0, 0, 0, 0, 0, 0];
          const [ , , h, rbi, r, sb ] = st;
          if (h > 0) gameRecs.h.push({ v: h, nm, dt, opp, gid });
          if (rbi > 0) gameRecs.rbi.push({ v: rbi, nm, dt, opp, gid });
          if (r > 0) gameRecs.r.push({ v: r, nm, dt, opp, gid });
          if (sb > 0) gameRecs.sb.push({ v: sb, nm, dt, opp, gid });
          tot.h[nm] = (tot.h[nm] || 0) + h;
          tot.rbi[nm] = (tot.rbi[nm] || 0) + rbi;
          tot.r[nm] = (tot.r[nm] || 0) + r;
          tot.sb[nm] = (tot.sb[nm] || 0) + sb;
          if (Array.isArray(p[2]) && p[2].length >= 4 && p[2][3] > 0) {
            const so = p[2][3];
            gameRecs.so.push({ v: so, nm, dt, opp, gid });
            tot.so[nm] = (tot.so[nm] || 0) + so;
          }
        });
      });

      const pickTopGame = (arr, unit, label, icon) => {
        if (!arr.length) return null;
        const maxV = Math.max(...arr.map(x => x.v));
        const tops = arr.filter(x => x.v === maxV);
        const first = tops[0];
        const extra = tops.length > 1 ? ` 외 ${tops.length - 1}건` : '';
        return {
          label: `${icon} ${label}`,
          val: `${maxV}${unit}`,
          who: `${first.nm}${extra}`,
          sub: `${first.dt} vs ${first.opp}`,
          href: `#/game/${first.gid}`
        };
      };
      const pickTopSeason = (map, unit, label, icon) => {
        const ents = Object.entries(map).filter(([, v]) => v > 0);
        if (!ents.length) return null;
        const maxV = Math.max(...ents.map(([, v]) => v));
        const tops = ents.filter(([, v]) => v === maxV).map(([nm]) => nm);
        return {
          label: `${icon} ${label}`,
          val: `${maxV}${unit}`,
          who: tops.join(', '),
          sub: '2026 시즌 누적 1위',
          href: `#/player/${encodeURIComponent(WT_ID + '|' + tops[0])}`
        };
      };

      const cards = [
        pickTopGame(gameRecs.h, '안타', '한 경기 최다 안타', '🔥'),
        pickTopGame(gameRecs.rbi, '타점', '한 경기 최다 타점', '💥'),
        pickTopGame(gameRecs.r, '득점', '한 경기 최다 득점', '⚡'),
        pickTopGame(gameRecs.sb, '도루', '한 경기 최다 도루', '🏃‍♀️'),
        pickTopGame(gameRecs.so, 'K', '한 경기 최다 탈삼진', '🎯'),
        pickTopSeason(tot.h, '안타', '2026 시즌 최다 안타', '🏏'),
        pickTopSeason(tot.rbi, '타점', '2026 시즌 최다 타점', '🏆'),
        pickTopSeason(tot.sb, '도루', '2026 시즌 최다 도루', '💨'),
        pickTopSeason(tot.so, '탈삼진', '2026 시즌 최다 탈삼진', '⚾')
      ].filter(Boolean);

      if (!cards.length) return;
      const wrap = document.createElement('div');
      wrap.className = 'wt-ext-wrap';
      wrap.id = 'wt-ext-home-ms';
      wrap.innerHTML = `
        <div class="wt-ext-card">
          <div class="wt-ext-head">
            <div class="wt-ext-title">🏆 2026 시즌 WT프렌즈 최고 기록</div>
            <a class="wt-ext-badge gold" href="#/archive" style="text-decoration:none">2026 전체 경기 ›</a>
          </div>
          <div class="wt-ms-list">
            ${cards.map(c => `
              <a class="wt-ms-item is-wt" href="${c.href}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span class="wt-ext-badge gold">${esc(c.label)}</span>
                  <b style="font-size:15px;color:var(--gold)">${esc(c.val)}</b>
                </div>
                <div style="font-size:13.5px;font-weight:800;margin-top:4px">${esc(c.who)}</div>
                <div style="font-size:11px;color:var(--sub)">${esc(c.sub)}</div>
              </a>`).join('')}
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
    let limit = 80;

    function draw() {
      const gamesAll = core.games || [];
      const yearGames = gamesAll.filter(g => selYear === 'all' || String(g[0]).startsWith(selYear));
      const wtCount = yearGames.filter(g => g[1] === WT_ID || g[2] === WT_ID).length;
      const allCount = yearGames.length;

      const filtered = onlyWT ? yearGames.filter(g => g[1] === WT_ID || g[2] === WT_ID) : yearGames.slice();
      filtered.sort((a, b) => String(b[0]).localeCompare(String(a[0])));

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

      const shown = filtered.slice(0, limit);
      const listHtml = shown.map(g => {
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
              <button type="button" class="wt-ext-pillbtn ${onlyWT ? 'pri' : ''}" id="wtArchBtnWT">⭐ WT프렌즈만 (${wtCount})</button>
              <button type="button" class="wt-ext-pillbtn ${!onlyWT ? 'pri' : ''}" id="wtArchBtnAll">⚾ 전체 구단 경기 (${allCount})</button>
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
            <div style="font-size:12px;color:var(--sub);margin-bottom:8px">총 ${filtered.length}경기 중 ${shown.length}경기 표시 · 클릭 시 경기 흐름 상세</div>
            <div>${listHtml || '<div class="empty">해당 조건의 경기가 없습니다.</div>'}</div>
            ${filtered.length > limit ? `<div style="text-align:center;margin-top:12px"><button type="button" class="wt-ext-pillbtn" id="wtArchMore">더 보기 (+80경기)</button></div>` : ''}
          </div>
        </div>`;

      document.getElementById('wtArchYear').onchange = e => { selYear = e.target.value; limit = 80; draw(); };
      document.getElementById('wtArchBtnWT').onclick = () => { onlyWT = true; limit = 80; draw(); };
      document.getElementById('wtArchBtnAll').onclick = () => { onlyWT = false; limit = 80; draw(); };
      const moreBtn = document.getElementById('wtArchMore');
      if (moreBtn) moreBtn.onclick = () => { limit += 80; draw(); };
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


  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const isImg = (file.type || '').startsWith('image/');
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.onload = () => {
        const res = String(reader.result || '');
        if (!isImg || file.size <= 900 * 1024) {
          return resolve({ base64: res.split(',')[1] || '', mimeType: file.type || 'application/octet-stream' });
        }
        // 큰 이미지는 최대 1600px로 가볍게 리사이즈해 업로드 속도 향상
        const img = new Image();
        img.onload = () => {
          const maxW = 1600;
          let w = img.width, h = img.height;
          if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          const outUrl = cv.toDataURL('image/jpeg', 0.85);
          resolve({ base64: outUrl.split(',')[1] || '', mimeType: 'image/jpeg' });
        };
        img.onerror = () => resolve({ base64: res.split(',')[1] || '', mimeType: file.type || 'image/jpeg' });
        img.src = res;
      };
      reader.readAsDataURL(file);
    });
  }

  window.WT_DRIVE_UPLOAD = async function (file, opts) {
    opts = opts || {};
    const url = (window.ClubStore && window.ClubStore.getSheetUrl({ id: WT_ID })) || window.WT_GOOGLE_SHEET_URL;
    if (!url) throw new Error('구글 시트 연결 URL이 없습니다.');
    const { base64, mimeType } = await readFileAsBase64(file);
    const clientId = 'gal_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const payload = {
      action: 'uploadFile',
      clientId,
      fileName: file.name,
      mimeType,
      base64,
      title: opts.title || file.name,
      category: opts.category || '일반',
      uploader: opts.uploader || '관리자',
      addToGallery: opts.addToGallery !== false
    };
    let serverErr = '';
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json && json.status === 'success' && json.item) return json.item;
        if (json && json.message) serverErr = json.message;
      }
    } catch (e) {
      // Apps Script CORS redirect fallback -> send no-cors POST and poll doGet up to 5 times
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const delays = [1800, 2000, 2200, 2500, 3000];
      for (const ms of delays) {
        await new Promise(r => setTimeout(r, ms));
        try {
          const resGet = await fetch(url + (url.includes('?') ? '&' : '?') + 'action=get&teamId=' + WT_ID + '&t=' + Date.now());
          if (resGet.ok) {
            const jGet = await resGet.json();
            const gal = (jGet && jGet.data && Array.isArray(jGet.data.gallery)) ? jGet.data.gallery : [];
            const uploads = (jGet && jGet.data && jGet.data._recentUploads) ? jGet.data._recentUploads : {};
            const found = gal.find(x => x.id === clientId) || uploads[clientId];
            if (found) return found;
          }
        } catch (_) {}
      }
    }
    throw new Error(serverErr ? ('서버 오류: ' + serverErr) : '업로드 응답 확인 실패 (Apps Script 새 버전 배포 및 드라이브 권한 승인을 확인해 주세요)');
  };

  window.WT_OPEN_LIGHTBOX = function (imgUrl, title, linkUrl) {
    const old = document.getElementById('wtLightboxModal');
    if (old) old.remove();
    const box = document.createElement('div');
    box.id = 'wtLightboxModal';
    box.className = 'wt-lightbox';
    box.innerHTML = `
      <div style="width:100%;max-width:720px;display:flex;justify-content:space-between;align-items:center;color:#fff;margin-bottom:10px">
        <b style="font-size:14px">${esc(title || '이미지 보기')}</b>
        <button type="button" id="wtLbClose" class="wt-ext-pillbtn">✕ 닫기</button>
      </div>
      <img src="${esc(imgUrl)}" alt="${esc(title || '')}">
      <div style="margin-top:12px;display:flex;gap:8px">
        ${linkUrl ? `<a class="wt-ext-pillbtn pri" href="${esc(linkUrl)}" target="_blank" rel="noopener">↗ 구글 드라이브 원본 열기</a>` : ''}
      </div>`;
    box.onclick = e => { if (e.target === box || e.target.id === 'wtLbClose') box.remove(); };
    document.body.appendChild(box);
  };

  async function renderGalleryPage() {
    const appEl = document.getElementById('app');
    if (!appEl) return;
    const isAdm = localStorage.getItem('wt_admin_auth') === '1';
    const cats = ['전체', '대회 사진', '훈련/연습', '행사/모임', '자료실'];
    let selCat = '전체';

    function getTeamObj() { return { id: WT_ID, short: 'WT프렌즈' }; }
    function loadLocalGallery() {
      try {
        const raw = localStorage.getItem('kbsa_club_v20_' + WT_ID);
        if (raw) {
          const d = JSON.parse(raw);
          if (Array.isArray(d.gallery)) return d.gallery;
        }
      } catch (e) {}
      return [];
    }

    let items = loadLocalGallery();
    function draw() {
      const shown = selCat === '전체' ? items : items.filter(x => (x.category || '일반') === selCat);
      appEl.innerHTML = `
        <div class="wt-ext-wrap">
          <div class="wt-ext-card">
            <div class="wt-ext-head">
              <div class="wt-ext-title">📷 WT프렌즈 팀 갤러리 & 자료실</div>
              <div style="display:flex;gap:6px">
                <button type="button" class="wt-ext-pillbtn" id="wtGalSync">🔄 새로고침</button>
                <a class="wt-ext-pillbtn" href="#/">🏠 홈으로</a>
              </div>
            </div>
            <div class="wt-arch-filters">
              ${cats.map(c => `<button type="button" class="wt-ext-pillbtn ${selCat === c ? 'pri' : ''}" data-gal-cat="${esc(c)}">${esc(c)}</button>`).join('')}
            </div>
            ${isAdm ? `
              <form id="wtGalForm" style="border:1.5px solid var(--accent);border-radius:12px;padding:12px;margin-bottom:14px;display:grid;gap:8px">
                <b style="font-size:13.5px;color:var(--accent)">➕ 사진·첨부파일 올리기 (관리자 전용 · 구글 드라이브 자동 저장)</b>
                <div style="display:flex;flex-wrap:wrap;gap:8px">
                  <select id="wtGalCat" class="wt-arch-sel">
                    <option value="대회 사진">🏆 대회 사진</option>
                    <option value="훈련/연습">⚾ 훈련/연습</option>
                    <option value="행사/모임">🍻 행사/모임</option>
                    <option value="자료실">📁 자료실 (PDF/문서)</option>
                  </select>
                  <input type="text" id="wtGalTitle" placeholder="제목 또는 설명 (선택)" style="flex:1;min-width:160px;padding:6px 10px;border-radius:8px">
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
                  <input type="file" id="wtGalFile" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.hwp,.zip" multiple required style="flex:1;font-size:12.5px">
                  <button type="submit" class="wt-ext-pillbtn pri" id="wtGalSubmit">⬆️ 드라이브에 올리기</button>
                </div>
              </form>
            ` : `<div style="font-size:12px;color:var(--sub);margin-bottom:10px">사진을 누르면 크게 볼 수 있으며, 문서는 클릭 시 구글 드라이브에서 열립니다. (등록·삭제는 관리자 전용)</div>`}
            <div class="wt-gal-grid">
              ${shown.length ? shown.map(g => `
                <div class="wt-gal-card">
                  ${g.isImage && g.thumbUrl
                    ? `<img class="wt-gal-thumb" src="${esc(g.thumbUrl)}" alt="${esc(g.title || g.name)}" loading="lazy" data-gal-zoom="${esc(g.thumbUrl)}" data-gal-title="${esc(g.title || g.name)}" data-gal-link="${esc(g.viewUrl)}">`
                    : `<a class="wt-gal-filebox" href="${esc(g.viewUrl)}" target="_blank" rel="noopener"><span style="font-size:26px">📄</span><span>${esc(g.name || g.title || '첨부파일')}</span></a>`}
                  <div class="wt-gal-meta">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:4px">
                      <span class="wt-ext-badge">${esc(g.category || '일반')}</span>
                      ${isAdm ? `<button type="button" data-gal-del="${esc(g.id)}" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px;font-weight:800">🗑️ 삭제</button>` : ''}
                    </div>
                    <b style="font-size:12.5px;line-height:1.3">${esc(g.title || g.name)}</b>
                    <span style="font-size:11px;color:var(--sub)">${esc(g.date || '')}</span>
                  </div>
                </div>`).join('') : '<div class="empty" style="grid-column:1/-1">등록된 사진이나 첨부파일이 없습니다.</div>'}
            </div>
          </div>
        </div>`;

      appEl.querySelectorAll('[data-gal-cat]').forEach(b => { b.onclick = () => { selCat = b.dataset.galCat; draw(); }; });
      appEl.querySelectorAll('[data-gal-zoom]').forEach(img => {
        img.onclick = () => window.WT_OPEN_LIGHTBOX(img.dataset.galZoom, img.dataset.galTitle, img.dataset.galLink);
      });
      const syncBtn = document.getElementById('wtGalSync');
      if (syncBtn && window.ClubStore) {
        syncBtn.onclick = async () => {
          syncBtn.textContent = '⏳ 불러오는 중...';
          const remote = await window.ClubStore.fetchFromSheet(getTeamObj());
          items = (remote && Array.isArray(remote.gallery)) ? remote.gallery : loadLocalGallery();
          draw();
        };
      }
      if (isAdm) {
        const form = document.getElementById('wtGalForm');
        if (form) form.onsubmit = async e => {
          e.preventDefault();
          const files = Array.from(document.getElementById('wtGalFile').files || []);
          if (!files.length) return;
          const btn = document.getElementById('wtGalSubmit');
          btn.disabled = true; btn.textContent = '⏳ 업로드 중...';
          try {
            const cat = document.getElementById('wtGalCat').value;
            const customTitle = document.getElementById('wtGalTitle').value.trim();
            for (const f of files) {
              const item = await window.WT_DRIVE_UPLOAD(f, { category: cat, title: customTitle || f.name, addToGallery: true });
              items.unshift(item);
            }
            if (window.ClubStore) {
              const td = window.ClubStore.getTeamData(getTeamObj());
              td.gallery = items;
              window.ClubStore.saveTeamData(getTeamObj(), td);
            }
            draw();
          } catch (err) {
            alert('업로드 중 오류: ' + err.message);
            btn.disabled = false; btn.textContent = '⬆️ 드라이브에 올리기';
          }
        };
        appEl.querySelectorAll('[data-gal-del]').forEach(b => {
          b.onclick = () => {
            if (!confirm('갤러리에서 이 항목을 삭제하시겠습니까?')) return;
            const id = b.dataset.galDel;
            items = items.filter(x => String(x.id) !== String(id));
            if (window.ClubStore) {
              const td = window.ClubStore.getTeamData(getTeamObj());
              td.gallery = items;
              window.ClubStore.saveTeamData(getTeamObj(), td);
            }
            draw();
          };
        });
      }
    }
    draw();
    if (window.ClubStore) {
      window.ClubStore.fetchFromSheet(getTeamObj()).then(remote => {
        if (remote && Array.isArray(remote.gallery)) { items = remote.gallery; draw(); }
      });
    }
  }


  // 2026 연말총회 마니또 & 상장 제작 시스템
  async function renderManitoPage() {
    const appEl = document.getElementById('app');
    if (!appEl) return;
    const isAdm = localStorage.getItem('wt_admin_auth') === '1';
    const teamObj = { id: WT_ID, short: 'WT프렌즈' };
    const [core, box] = await Promise.all([loadCore(), loadBox()]);

    function getClubData() {
      if (window.ClubStore) return window.ClubStore.getTeamData(teamObj);
      try {
        const raw = localStorage.getItem('kbsa_club_v20_' + WT_ID);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return { events: [], notices: [], manito: null };
    }

    function getDefaultManito() {
      return {
        eventDate: '2026-11-28',
        budgetNote: '선물 예산: 2~3만 원대',
        participants: [],
        pairs: {},
        awards: {}
      };
    }

    let clubData = getClubData();
    let manito = clubData.manito || getDefaultManito();
    let authedUser = sessionStorage.getItem('wt_manito_user') || '';
    let showSpoiler = false;
    let excludeMeOnPrint = true;

    const fullRoster = (() => {
      const set = new Set();
      if (window.Store && Array.isArray(window.Store.players)) {
        window.Store.players.filter(p => p.team && p.team.id === WT_ID).forEach(p => set.add(p.name));
      }
      if (core && box && box.box) {
        (core.games || []).filter(g => (g[1] === WT_ID || g[2] === WT_ID) && String(g[0]).startsWith('2026')).forEach(g => {
          const b = box.box[String(g[10])];
          const si = g[1] === WT_ID ? 0 : 1;
          if (b && Array.isArray(b[si])) b[si].forEach(p => set.add(p[0]));
        });
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
    })();

    function getPlayer2026Hint(pname) {
      let gCnt = 0, h = 0, rbi = 0, r = 0, sb = 0, so = 0;
      if (core && box && box.box) {
        (core.games || []).filter(g => (g[1] === WT_ID || g[2] === WT_ID) && String(g[0]).startsWith('2026')).forEach(g => {
          const b = box.box[String(g[10])];
          const si = g[1] === WT_ID ? 0 : 1;
          if (!b || !Array.isArray(b[si])) return;
          const p = b[si].find(x => x[0] === pname);
          if (!p) return;
          gCnt++;
          const st = Array.isArray(p[1]) ? p[1] : [0, 0, 0, 0, 0, 0];
          h += st[2] || 0; rbi += st[3] || 0; r += st[4] || 0; sb += st[5] || 0;
          if (Array.isArray(p[2]) && p[2].length >= 4) so += p[2][3] || 0;
        });
      }
      const evAtt = (clubData.events || []).filter(ev => {
        const st = ev.rsvp && ev.rsvp[pname];
        return st === 'in' || st === 'car' || st === 'ok';
      }).length;
      return { gCnt, h, rbi, r, sb, so, evAtt };
    }

    async function postManitoAction(action, extra) {
      const url = (window.ClubStore && window.ClubStore.getSheetUrl(teamObj)) || window.WT_GOOGLE_SHEET_URL;
      clubData.manito = manito;
      try { localStorage.setItem('kbsa_club_v20_' + WT_ID, JSON.stringify(clubData)); } catch (e) {}
      if (!url) return true;
      try {
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(Object.assign({ action }, extra))
        });
      } catch (e) { console.warn('Manito sync err:', e); }
      return true;
    }

    function openPrintOverlay() {
      const old = document.getElementById('wtManitoPrintRoot');
      if (old) old.remove();
      const parts = manito.participants || [];
      const pairs = manito.pairs || {};
      const awards = manito.awards || {};
      const myName = (window.ClubStore && window.ClubStore.getMe(teamObj)) || authedUser || '';
      const list = parts.filter(giver => {
        const target = pairs[giver];
        if (!target) return false;
        if (excludeMeOnPrint && myName && target === myName) return false;
        return true;
      });
      if (!list.length) { alert('출력할 상장이 없습니다.'); return; }
      const root = document.createElement('div');
      root.id = 'wtManitoPrintRoot';
      root.className = 'wt-print-overlay';
      const emblem = window.WT_EMBLEM || '';
      const evDateTxt = manito.eventDate || '2026-11-28';
      root.innerHTML = `
        <div class="wt-print-noprint" style="max-width:720px;margin:0 auto 14px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <b style="color:#fff;font-size:14px">🖨️ 총 ${list.length}장 인쇄 미리보기 (A4 1페이지당 1장)</b>
          <div style="display:flex;gap:8px">
            <button type="button" class="wt-ext-pillbtn pri" id="wtPrintNowBtn">🖨️ 인쇄 / PDF 저장</button>
            <button type="button" class="wt-ext-pillbtn" id="wtPrintCloseBtn">✕ 닫기</button>
          </div>
        </div>
        ${list.map(giver => {
          const target = pairs[giver];
          const aw = awards[giver] || {};
          const title = aw.title || '2026 WT프렌즈 특별상';
          const body = aw.body || '올 한 해 WT프렌즈와 함께 힘차게 뛰어주셔서 감사합니다!';
          return `
            <div class="wt-print-sheet">
              <div class="wt-cert-inner" style="text-align:center">
                ${emblem ? `<img class="wt-cert-emblem" src="${emblem}" alt="WT프렌즈">` : ''}
                <div class="wt-cert-head">상 장</div>
                <div class="wt-cert-award-title">${esc(title)}</div>
                <div class="wt-cert-to">WT프렌즈 · <u>${esc(target)}</u></div>
                <div class="wt-cert-body">${esc(body)}</div>
                <div class="wt-cert-foot">
                  <div>${esc(evDateTxt)} · 2026 WT프렌즈 연말총회</div>
                  <div class="wt-cert-giver">수여: ${esc(giver)}</div>
                </div>
              </div>
            </div>`;
        }).join('')}`;
      document.body.appendChild(root);
      document.getElementById('wtPrintCloseBtn').onclick = () => root.remove();
      document.getElementById('wtPrintNowBtn').onclick = () => window.print();
    }

    function draw() {
      const parts = manito.participants || [];
      const pairs = manito.pairs || {};
      const awards = manito.awards || {};
      const myTarget = authedUser ? (pairs[authedUser] || '') : '';
      const myAward = authedUser ? (awards[authedUser] || { title: '', body: '' }) : { title: '', body: '' };
      const hint = myTarget ? getPlayer2026Hint(myTarget) : null;
      const emblem = window.WT_EMBLEM || '';

      const templates = [
        ['⚡ 번개같은 도루상', '빠른 발과 과감한 주루 플레이로 매 경기 팀에 활력을 불어넣어 주었기에 이 상장을 드립니다!'],
        ['🔥 불꽃 타격상', '중요한 순간마다 터지는 시원한 타격으로 팀의 승리를 이끌어 주었기에 감사한 마음을 담아 드립니다!'],
        ['🛡️ 철벽 수비상', '흔들림 없는 집중력과 안정적인 수비로 팀의 뒷문을 든든하게 지켜주었기에 이 상장을 드립니다!'],
        ['🌞 더그아웃 분위기메이커상', '언제나 밝은 에너지와 따뜻한 응원으로 팀원들에게 큰 힘을 주었기에 감사의 마음을 전합니다!'],
        ['📅 성실한 출석요정상', '궂은 날씨에도 변함없이 훈련과 경기에 함께하며 팀의 중심을 잡아주었기에 이 상장을 드립니다!']
      ];

      appEl.innerHTML = `
        <div class="wt-ext-wrap">
          <div class="wt-ext-card">
            <div class="wt-ext-head">
              <div class="wt-ext-title">🎁 2026 WT프렌즈 연말총회 마니또</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button type="button" class="wt-ext-pillbtn" id="wtManitoSync">🔄 새로고침</button>
                <a class="wt-ext-pillbtn" href="#/">🏠 홈으로</a>
              </div>
            </div>

            ${!parts.length ? `
              <div class="empty" style="padding:20px 10px">아직 마니또 매칭이 시작되지 않았습니다.${isAdm ? ' 아래 [관리자 설정]에서 참석자를 체크하고 [매칭 생성] 버튼만 누르시면 바로 시작됩니다!' : ' (관리자이시면 상단 🔒 관리자 버튼을 먼저 켜주세요.)'}</div>
            ` : (!authedUser ? `
              <div style="border:1.5px solid var(--accent);border-radius:12px;padding:16px;display:grid;gap:10px;max-width:420px;margin:6px auto">
                <b style="font-size:14.5px;color:var(--accent)">🔐 나만의 비밀 코드로 마니또 확인하기</b>
                <div id="wtManitoAuthDesc" style="font-size:12px;color:var(--sub);line-height:1.5">본인 이름을 선택해 주세요. 등번호가 아닌 <b>본인만 아는 비밀 번호</b>를 직접 정해 안전하게 잠금 설정합니다.</div>
                <select id="wtManitoWho" class="wt-arch-sel" style="width:100% !important">
                  <option value="">-- 본인 이름 선택 --</option>
                  ${parts.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
                </select>
                <input type="password" id="wtManitoPin" placeholder="비밀 번호 4자리 이상" style="padding:8px 12px;border-radius:9px">
                <button type="button" class="wt-ext-pillbtn pri" id="wtManitoLoginBtn" style="justify-content:center">✓ 마니또 열기</button>
              </div>
            ` : `
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
                <div style="font-size:13.5px;font-weight:800">🙋‍♀️ <b>${esc(authedUser)}</b> 님으로 인증됨</div>
                <button type="button" class="wt-ext-pillbtn" id="wtManitoLogout">🔄 다른 선수로 전환</button>
              </div>
              ${!myTarget ? `
                <div class="empty">아직 마니또 매칭이 배정되지 않았습니다. 관리자가 매칭을 완료하면 바로 확인할 수 있습니다.</div>
              ` : `
                <div style="background:rgba(245,158,11,0.1);border:1.5px solid rgba(245,158,11,0.45);border-radius:14px;padding:16px;text-align:center;margin-bottom:14px">
                  <div style="font-size:12px;font-weight:700;color:var(--gold)">🤫 나만 아는 비밀 마니또</div>
                  <div style="font-size:21px;font-weight:900;margin:6px 0">당신의 마니또는 <span style="color:var(--accent)">${esc(myTarget)}</span> 님입니다!</div>
                  <div style="font-size:12px;color:var(--sub)">
                    📊 2026 기록 힌트: 공식 ${hint.gCnt}경기 · ${hint.h}안타 · ${hint.rbi}타점 · ${hint.sb}도루 · 탈삼진 ${hint.so}K · 팀 일정 출석 ${hint.evAtt}회
                  </div>
                </div>

                <form id="wtManitoAwardForm" style="display:grid;gap:10px;margin-bottom:16px">
                  <div style="font-size:13px;font-weight:800">✨ 원클릭 상장 제목 추천 (누르면 자동 입력 · 수정 가능)</div>
                  <div style="display:flex;flex-wrap:wrap;gap:6px">
                    ${templates.map((tp, idx) => `<button type="button" class="wt-ext-pillbtn" data-tpl-idx="${idx}" style="font-size:11.5px;padding:5px 10px">${esc(tp[0])}</button>`).join('')}
                  </div>
                  <input type="text" id="wtAwardTitle" value="${esc(myAward.title)}" placeholder="상장 제목 (예: 번개같은 도루상)" required style="padding:9px 12px;border-radius:9px;font-weight:700">
                  <textarea id="wtAwardBody" rows="4" placeholder="${esc(myTarget)} 님이 올해 가장 잘한 일이나 칭찬하고 싶은 내용을 적어주세요!" required style="padding:10px 12px;border-radius:9px;line-height:1.6">${esc(myAward.body)}</textarea>
                  <button type="submit" class="wt-ext-pillbtn pri" id="wtAwardSubmit" style="justify-content:center">✓ 상장 문구 제출 / 수정 저장</button>
                </form>

                <div style="font-size:12.5px;font-weight:800;color:var(--sub);margin-bottom:8px">👀 상장 실시간 미리보기</div>
                <div class="wt-cert-preview">
                  <div class="wt-cert-inner">
                    ${emblem ? `<img class="wt-cert-emblem" src="${emblem}" alt="WT프렌즈">` : ''}
                    <div class="wt-cert-head">상 장</div>
                    <div class="wt-cert-award-title" id="wtPrevTitle">${esc(myAward.title || '상장 제목이 여기에 표시됩니다')}</div>
                    <div class="wt-cert-to">WT프렌즈 · <u>${esc(myTarget)}</u></div>
                    <div class="wt-cert-body" id="wtPrevBody">${esc(myAward.body || '칭찬 문구를 입력하면 상장 미리보기가 완성됩니다.')}</div>
                    <div class="wt-cert-foot">
                      <div>${esc(manito.eventDate || '2026-11-28')} · 2026 WT프렌즈 연말총회</div>
                      <div class="wt-cert-giver">수여: ${esc(authedUser)}</div>
                    </div>
                  </div>
                </div>
              `}
            `)}
          </div>

          ${isAdm ? `
            <div class="wt-ext-card" style="border-color:rgba(245,158,11,0.45)">
              <div class="wt-ext-head">
                <div class="wt-ext-title">👑 관리자 전용 — 연말총회 마니또 설정 & 상장 출력</div>
                <span class="wt-ext-badge gold">작성 완료 ${parts.filter(n => awards[n] && awards[n].body).length} / ${parts.length}명</span>
              </div>
              <div style="font-size:12px;color:var(--sub);margin-bottom:10px;line-height:1.5">
                <b>진행 순서:</b> ① 아래에서 참석자 체크(또는 불러오기) → ② <b>[🎲 마니또 1:1 랜덤 매칭 생성]</b> 클릭 → ③ 팀원들이 각자 PIN으로 로그인해 마니또 확인 & 상장 작성 → ④ 총회 전날 <b>[🖨️ 전체 상장 인쇄]</b>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px">
                <label style="font-size:12.5px;font-weight:700">행사 날짜: <input type="date" id="wtManitoDate" value="${esc(manito.eventDate || '2026-11-28')}" style="padding:5px 8px;border-radius:8px"></label>
                <button type="button" class="wt-ext-pillbtn" id="wtImportAttendBtn">📥 일정 참석자 불러오기</button>
                <button type="button" class="wt-ext-pillbtn" id="wtSavePartsBtn">💾 날짜·명단만 저장</button>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;padding:10px;border-radius:10px;border:1px solid var(--line)">
                ${fullRoster.map(nm => `
                  <label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:3px 8px;border-radius:999px;border:1px solid var(--line);cursor:pointer">
                    <input type="checkbox" class="wt-manito-chk" value="${esc(nm)}" ${parts.includes(nm) ? 'checked' : ''}> ${esc(nm)}
                  </label>`).join('')}
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
                <button type="button" class="wt-ext-pillbtn pri" id="wtMakePairsBtn">🎲 마니또 1:1 랜덤 매칭 생성</button>
                <button type="button" class="wt-ext-pillbtn" id="wtToggleSpoilerBtn">${showSpoiler ? '🙈 스포일러 숨기기' : '👀 매칭 결과 잠깐 보기'}</button>
                <button type="button" class="wt-ext-pillbtn pri" id="wtOpenPrintBtn" style="background:linear-gradient(135deg,#f59e0b,#d97706)">🖨️ 전체 상장 인쇄 / PDF</button>
              </div>
              <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--sub);margin-bottom:10px">
                <input type="checkbox" id="wtExclMeChk" ${excludeMeOnPrint ? 'checked' : ''}> 🙈 인쇄할 때 내 상장(내가 받을 상장)은 제외하기 (스포일러 방지)
              </label>
              <div style="overflow-x:auto">
                <table class="wt-spray-table">
                  <thead><tr><th style="text-align:left">참여자</th><th>제출 상태</th><th>비밀코드</th>${showSpoiler ? '<th>내 마니또 대상</th>' : ''}</tr></thead>
                  <tbody>
                    ${parts.map(nm => {
                      const done = awards[nm] && awards[nm].body;
                      const hasSec = !!(manito.secrets && manito.secrets[nm]);
                      return `<tr>
                        <td style="text-align:left"><b>${esc(nm)}</b></td>
                        <td style="color:${done ? '#10b981' : '#f59e0b'};font-weight:800">${done ? '✅ 작성 완료' : '⏳ 미작성'}</td>
                        <td>${hasSec ? `<button type="button" class="wt-ext-pillbtn" data-reset-sec="${esc(nm)}" style="font-size:11px;padding:3px 8px">🔑 초기화</button>` : '<span style="font-size:11px;color:var(--sub)">미설정</span>'}</td>
                        ${showSpoiler ? `<td>${esc(pairs[nm] || '-')}</td>` : ''}
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
        </div>`;

      const syncBtn = document.getElementById('wtManitoSync');
      if (syncBtn && window.ClubStore) {
        syncBtn.onclick = async () => {
          syncBtn.textContent = '⏳ 불러오는 중...';
          const remote = await window.ClubStore.fetchFromSheet(teamObj, true);
          if (remote && remote.manito) { clubData = remote; manito = remote.manito; }
          draw();
        };
      }

      const whoSel = document.getElementById('wtManitoWho');
      const authDesc = document.getElementById('wtManitoAuthDesc');
      const loginBtn = document.getElementById('wtManitoLoginBtn');
      const secrets = manito.secrets || {};
      if (whoSel) whoSel.onchange = () => {
        const w = whoSel.value;
        if (!w) {
          authDesc.innerHTML = '본인 이름을 선택해 주세요. 등번호가 아닌 <b>본인만 아는 비밀 번호</b>를 직접 정해 안전하게 잠금 설정합니다.';
          loginBtn.textContent = '✓ 마니또 열기';
        } else if (!secrets[w]) {
          authDesc.innerHTML = `<b style="color:var(--gold)">[최초 1회 설정]</b> <b>${esc(w)}</b> 님만 아는 비밀 번호(4자리 이상)를 새로 정해주세요. 다른 사람은 절대 볼 수 없습니다.`;
          loginBtn.textContent = '🔐 비밀 번호 등록 & 마니또 열기';
        } else {
          authDesc.innerHTML = `<b>${esc(w)}</b> 님이 설정하신 비밀 번호를 입력해 주세요.`;
          loginBtn.textContent = '✓ 확인 및 마니또 열기';
        }
      };
      if (loginBtn) loginBtn.onclick = async () => {
        const who = whoSel ? whoSel.value : '';
        const pin = (document.getElementById('wtManitoPin').value || '').trim();
        if (!who) { alert('본인 이름을 선택해 주세요.'); return; }
        if (pin.length < 4) { alert('비밀 번호는 4자리 이상으로 입력해 주세요.'); return; }
        manito.secrets = manito.secrets || {};
        if (!manito.secrets[who]) {
          manito.secrets[who] = pin;
          await postManitoAction('setManitoSecret', { who, secret: pin });
          alert(`${who} 님의 비밀 번호가 등록되었습니다! 다음에도 이 번호로 들어오시면 됩니다.`);
        } else if (manito.secrets[who] !== pin) {
          alert('비밀 번호가 일치하지 않습니다. 분실 시 관리자에게 초기화를 요청해 주세요.');
          return;
        }
        authedUser = who;
        sessionStorage.setItem('wt_manito_user', who);
        draw();
      };

      const logoutBtn = document.getElementById('wtManitoLogout');
      if (logoutBtn) logoutBtn.onclick = () => {
        authedUser = '';
        sessionStorage.removeItem('wt_manito_user');
        draw();
      };

      appEl.querySelectorAll('[data-tpl-idx]').forEach(btn => {
        btn.onclick = () => {
          const tp = templates[Number(btn.dataset.tplIdx)];
          const tEl = document.getElementById('wtAwardTitle');
          const bEl = document.getElementById('wtAwardBody');
          if (tEl) { tEl.value = tp[0]; document.getElementById('wtPrevTitle').textContent = tp[0]; }
          if (bEl && !bEl.value.trim()) { bEl.value = tp[1]; document.getElementById('wtPrevBody').textContent = tp[1]; }
        };
      });

      const tIn = document.getElementById('wtAwardTitle');
      const bIn = document.getElementById('wtAwardBody');
      if (tIn) tIn.oninput = () => { document.getElementById('wtPrevTitle').textContent = tIn.value || '상장 제목이 여기에 표시됩니다'; };
      if (bIn) bIn.oninput = () => { document.getElementById('wtPrevBody').textContent = bIn.value || '칭찬 문구를 입력하면 상장 미리보기가 완성됩니다.'; };

      const awForm = document.getElementById('wtManitoAwardForm');
      if (awForm) awForm.onsubmit = async e => {
        e.preventDefault();
        const title = document.getElementById('wtAwardTitle').value.trim();
        const body = document.getElementById('wtAwardBody').value.trim();
        const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
        manito.awards = manito.awards || {};
        manito.awards[authedUser] = { title, body, updatedAt: nowStr };
        await postManitoAction('saveManitoAward', { giver: authedUser, award: manito.awards[authedUser] });
        alert('상장 문구가 저장되었습니다! 마감 전까지 언제든 다시 수정할 수 있습니다.');
        draw();
      };

      if (isAdm) {
        const importBtn = document.getElementById('wtImportAttendBtn');
        if (importBtn) importBtn.onclick = () => {
          const evs = clubData.events || [];
          const targetEv = evs.find(x => (x.title || '').includes('연말') || (x.title || '').includes('총회') || (x.type === '모임')) || evs[0];
          if (!targetEv || !targetEv.rsvp) { alert('참석 투표가 등록된 일정이 없습니다.'); return; }
          const ins = Object.entries(targetEv.rsvp).filter(([, v]) => v === 'in' || v === 'car' || v === 'ok').map(([nm]) => nm);
          appEl.querySelectorAll('.wt-manito-chk').forEach(chk => { chk.checked = ins.includes(chk.value); });
          if (targetEv.date) document.getElementById('wtManitoDate').value = targetEv.date;
          alert(`'${targetEv.title}' 참석자 ${ins.length}명을 체크했습니다. 확인 후 [명단·날짜 저장]을 눌러주세요!`);
        };

        const savePartsBtn = document.getElementById('wtSavePartsBtn');
        if (savePartsBtn) savePartsBtn.onclick = async () => {
          manito.eventDate = document.getElementById('wtManitoDate').value || '2026-11-28';
          manito.participants = Array.from(appEl.querySelectorAll('.wt-manito-chk:checked')).map(c => c.value);
          await postManitoAction('saveManitoConfig', { manito });
          alert(`참여자 ${manito.participants.length}명과 행사 날짜가 저장되었습니다.`);
          draw();
        };

        const pairsBtn = document.getElementById('wtMakePairsBtn');
        if (pairsBtn) pairsBtn.onclick = async () => {
          const selected = Array.from(appEl.querySelectorAll('.wt-manito-chk:checked')).map(c => c.value);
          if (selected.length < 3) { alert('마니또 매칭은 최소 3명 이상이어야 합니다.'); return; }
          if (Object.keys(manito.pairs || {}).length && !confirm('이미 매칭된 결과가 있습니다. 새로 다시 뽑으시겠습니까?')) return;
          // 단일 순환 셔플 (자기 자신 뽑기 & 2인 맞교환 원천 차단)
          const arr = selected.slice();
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          const newPairs = {};
          arr.forEach((giver, i) => { newPairs[giver] = arr[(i + 1) % arr.length]; });
          manito.eventDate = document.getElementById('wtManitoDate').value || '2026-11-28';
          manito.participants = selected;
          manito.pairs = newPairs;
          await postManitoAction('saveManitoConfig', { manito });
          alert(`${selected.length}명 1:1 마니또 매칭이 완료되어 구글 시트에 저장되었습니다!`);
          draw();
        };

        appEl.querySelectorAll('[data-reset-sec]').forEach(rb => {
          rb.onclick = async () => {
            const targetNm = rb.dataset.resetSec;
            if (!confirm(`${targetNm} 님의 마니또 비밀 번호를 초기화하시겠습니까?`)) return;
            if (manito.secrets) delete manito.secrets[targetNm];
            await postManitoAction('setManitoSecret', { who: targetNm, secret: '' });
            draw();
          };
        });
        const spBtn = document.getElementById('wtToggleSpoilerBtn');
        if (spBtn) spBtn.onclick = () => { showSpoiler = !showSpoiler; draw(); };
        const exChk = document.getElementById('wtExclMeChk');
        if (exChk) exChk.onchange = () => { excludeMeOnPrint = exChk.checked; };
        const prBtn = document.getElementById('wtOpenPrintBtn');
        if (prBtn) prBtn.onclick = () => openPrintOverlay();
      }
    }

    draw();
    if (window.ClubStore) {
      window.ClubStore.fetchFromSheet(teamObj, true).then(remote => {
        if (remote && remote.manito) { clubData = remote; manito = remote.manito; draw(); }
      });
    }
  }

  window.addEventListener('wt:rendered', e => {
    const info = e.detail || {};
    const name = info.name || 'home';
    const parts = info.parts || [];
    if (name === 'archive') { renderArchivePage(); return; }
    if (name === 'h2h') { renderH2HPage(); return; }
    if (name === 'gallery') { renderGalleryPage(); return; }
    if (name === 'manito') { renderManitoPage(); return; }
    if (name === 'game' && parts[1]) { enhanceGameView(parts[1]); return; }
    if (name === 'player' && parts[1]) { enhancePlayerView(parts[1]); return; }
    enhanceHomeAndLists(name);
  });
})();
