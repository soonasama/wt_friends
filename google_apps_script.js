/**
 * ⚾ 2026 WT프렌즈 통합 데이터베이스(DB) - 마스터 Google Apps Script
 * 
 * [연동 시트 전체 목록]
 * 1. 라인업_관리_DB : 출전 라인업 및 오더 기록
 * 2. WT_일정_참석투표_DB : 훈련·시합·행사 일정 및 RSVP 투표 현황
 * 3. WT_공지_커뮤니티_DB : 구단 공지사항 및 댓글 소통
 * 4. WT_훈련_셋로그_DB : 선수별 개인 훈련 로그
 * 5. WT_주간미션_스탬프_DB : 주간 홈트·기술 훈련 과제 및 스탬프 인증 내역
 * 6. WT_출석부_통계_DB : 2026 시즌 선수단 출석률 및 올해의 출석왕 랭킹
 * 7. WT_정산_회계_DB : 대회 원정 및 행사 지출·찬조·회비 정산서
 * 8. _CLUB_RAW : 클럽하우스 전체 데이터 백업 JSON
 */

function doGet(e) {
  var params = e ? (e.parameter || {}) : {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. 클럽하우스 전체 데이터 백업 조회 (기본값)
  if (params.action === 'get' || params.action === 'club' || !params.sheet) {
    var rawSheet = getOrCreateSheet(ss, '_CLUB_RAW');
    var rawJson = rawSheet.getRange('A1').getValue();
    var data = null;
    if (rawJson) {
      try { data = JSON.parse(rawJson); } catch(err) { data = null; }
    }
    
    var response = {
      status: 'success',
      teamId: params.teamId || 'aSEa0076',
      data: data,
      serverTime: new Date().toISOString()
    };
    
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // 2. 특정 시트 데이터 조회
  var sheetName = params.sheet || '라인업_관리_DB';
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Sheet not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var rows = values.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
  
  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var rawContents = e.postData ? e.postData.contents : '';
    var data = {};
    if (rawContents) {
      try { data = JSON.parse(rawContents); } catch(err) { data = {}; }
    }
    
    // 분기 A: 라인업 저장 요청
    if (data.batters && Array.isArray(data.batters)) {
      var luSheet = getOrCreateSheet(ss, '라인업_관리_DB');
      luSheet.appendRow([
        "LU_" + Utilities.formatDate(new Date(), "GMT+9", "yyyyMMdd_HHmmss"),
        data.date || "",
        data.time || "",
        data.opp || "",
        data.venue || "",
        data.host || "KBSA",
        data.sp || "",
        (data.batters[0] && data.batters[0].name) || "", (data.batters[0] && data.batters[0].pos) || "",
        (data.batters[1] && data.batters[1].name) || "", (data.batters[1] && data.batters[1].pos) || "",
        (data.batters[2] && data.batters[2].name) || "", (data.batters[2] && data.batters[2].pos) || "",
        (data.batters[3] && data.batters[3].name) || "", (data.batters[3] && data.batters[3].pos) || "",
        (data.batters[4] && data.batters[4].name) || "", (data.batters[4] && data.batters[4].pos) || "",
        (data.batters[5] && data.batters[5].name) || "", (data.batters[5] && data.batters[5].pos) || "",
        (data.batters[6] && data.batters[6].name) || "", (data.batters[6] && data.batters[6].pos) || "",
        (data.batters[7] && data.batters[7].name) || "", (data.batters[7] && data.batters[7].pos) || "",
        (data.batters[8] && data.batters[8].name) || "", (data.batters[8] && data.batters[8].pos) || "",
        (data.bench || []).join(", "),
        data.notes || "웹앱에서 저장됨",
        "확정"
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "라인업 저장 완료" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 분기 B: 클럽하우스 데이터 전체 동기화
    var clubData = data.data || data;
    
    // 1) RAW JSON 백업
    var rawSheet = getOrCreateSheet(ss, '_CLUB_RAW');
    rawSheet.getRange('A1').setValue(JSON.stringify(clubData));
    rawSheet.getRange('B1').setValue('마지막 업데이트: ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'));
    
    // 2) 개별 DB 시트 실시간 자동 갱신
    if (clubData.events && Array.isArray(clubData.events)) {
      updateEventsSheet(ss, clubData.events);
      updateAttendanceSheet(ss, clubData.events);
    }
    if (clubData.notices && Array.isArray(clubData.notices)) {
      updateNoticesSheet(ss, clubData.notices);
    }
    if (clubData.setlogs && Array.isArray(clubData.setlogs)) {
      updateSetlogsSheet(ss, clubData.setlogs);
    }
    if (clubData.missions && Array.isArray(clubData.missions)) {
      updateMissionsSheet(ss, clubData.missions);
    }
    if (clubData.settlements && Array.isArray(clubData.settlements)) {
      updateSettlementsSheet(ss, clubData.settlements);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "WT프렌즈 클럽하우스 전체 DB 동기화 완료" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

// 1. 일정 및 참석투표 시트
function updateEventsSheet(ss, events) {
  var sheet = getOrCreateSheet(ss, 'WT_일정_참석투표_DB');
  sheet.clear();
  sheet.appendRow(['일정ID', '일정제목', '일정구분', '일시', '장소', '참석수', '불참수', '미정수', '참석자명단', '비고']);
  if (events && events.length) {
    events.forEach(function(ev) {
      var rsvp = ev.rsvp || {};
      var ins = [], outs = [], tbds = [];
      Object.keys(rsvp).forEach(function(p) {
        if (rsvp[p] === 'in' || rsvp[p] === 'car' || rsvp[p] === 'ok') ins.push(p);
        else if (rsvp[p] === 'out') outs.push(p);
        else if (rsvp[p] === 'tbd') tbds.push(p);
      });
      sheet.appendRow([
        ev.id || '',
        ev.title || '',
        ev.type || '',
        (ev.date || '') + ' ' + (ev.time || ''),
        ev.venue || '',
        ins.length,
        outs.length,
        tbds.length,
        ins.join(', '),
        ev.note || ''
      ]);
    });
  }
}

// 2. 공지 커뮤니티 시트
function updateNoticesSheet(ss, notices) {
  var sheet = getOrCreateSheet(ss, 'WT_공지_커뮤니티_DB');
  sheet.clear();
  sheet.appendRow(['공지ID', '작성자', '제목', '내용', '작성일시', '댓글수', '댓글목록']);
  if (notices && notices.length) {
    notices.forEach(function(nt) {
      var cmtTexts = (nt.comments || []).map(function(c) { return c.author + ': ' + c.text + ' (' + c.date + ')'; }).join('\n');
      sheet.appendRow([
        nt.id || '',
        nt.author || '',
        nt.title || '',
        nt.body || '',
        nt.date || '',
        (nt.comments || []).length,
        cmtTexts
      ]);
    });
  }
}

// 3. 훈련 셋로그 시트
function updateSetlogsSheet(ss, setlogs) {
  var sheet = getOrCreateSheet(ss, 'WT_훈련_셋로그_DB');
  sheet.clear();
  sheet.appendRow(['작성일시', '선수명', '훈련분류', '스윙타격수', '투구수', '핵심루틴훈련', '훈련메모_피드백', '고유ID']);
  if (setlogs && setlogs.length) {
    setlogs.forEach(function(sl) {
      sheet.appendRow([
        sl.date || '',
        sl.author || '',
        sl.cat || '',
        sl.swings || 0,
        sl.pitches || 0,
        sl.drill || '',
        sl.memo || '',
        sl.id || ''
      ]);
    });
  }
}

// 4. 주간 미션 스탬프 시트
function updateMissionsSheet(ss, missions) {
  var sheet = getOrCreateSheet(ss, 'WT_주간미션_스탬프_DB');
  sheet.clear();
  sheet.appendRow(['주차/미션ID', '미션제목', '기간', '훈련항목', '인증완료선수수', '달성선수명단', '달성률']);
  if (missions && missions.length) {
    missions.forEach(function(m) {
      var stamps = m.stamps || {};
      var members = Object.keys(stamps);
      var taskDesc = (m.tasks || []).map(function(t){ return t.title + '(' + t.goal + ')'; }).join(' | ');
      var mList = members.map(function(name){ return name + '(' + (stamps[name]||[]).length + ')'; }).join(', ');
      var pct = Math.round((members.length / 22) * 100) + '%';
      sheet.appendRow([
        m.id || '',
        m.weekTitle || '',
        m.dateRange || '',
        taskDesc,
        members.length,
        mList,
        pct
      ]);
    });
  }
}

// 5. 출석부 통계 시트 (RSVP 누적 기반)
function updateAttendanceSheet(ss, events) {
  var sheet = getOrCreateSheet(ss, 'WT_출석부_통계_DB');
  sheet.clear();
  sheet.appendRow(['순위', '선수명', '총일정수', '참석횟수', '카풀지원', '불참', '출석률(%)', '성실등급', '수상구분']);
  
  var roster = [
    '전순아', '전광숙', '김현우', '김성현', '정은경', '민정현', '안장우', '조우림',
    '최수남', '류이슬', '이정은', '조보영', '송백설', '원미리', '박세영', '이은숙',
    '서희숙', '구민경', '황지민', '이선희', '김설빈', '이수정'
  ];
  
  var totalEv = events ? events.length : 1;
  if (!totalEv) totalEv = 1;
  
  var stats = roster.map(function(name) {
    var att = 0, car = 0, abs = 0;
    (events || []).forEach(function(ev) {
      var r = (ev.rsvp || {})[name];
      if (r === 'in' || r === 'ok') att++;
      else if (r === 'car') { att++; car++; }
      else if (r === 'out') abs++;
    });
    var rate = Math.round((att / totalEv) * 100);
    return { name: name, att: att, car: car, abs: abs, rate: rate };
  }).sort(function(a, b){ return b.rate - a.rate || b.att - a.att; });
  
  stats.forEach(function(s, idx) {
    var rank = idx + 1;
    var grade = s.rate >= 90 ? 'S급' : (s.rate >= 75 ? 'A급' : 'B급');
    var award = '';
    if (rank === 1) award = '🥇 올해의 출석왕 (1위)';
    else if (rank === 2) award = '🥈 성실상 (2위)';
    else if (rank === 3) award = '🥉 성실상 (3위)';
    else if (s.rate >= 80) award = '우수출석';
    
    sheet.appendRow([
      rank, s.name, totalEv, s.att, s.car, s.abs, s.rate, grade, award
    ]);
  });
}

// 6. 정산 회계 DB 시트
function updateSettlementsSheet(ss, settlements) {
  var sheet = getOrCreateSheet(ss, 'WT_정산_회계_DB');
  sheet.clear();
  sheet.appendRow([
    '정산ID', '정산제목', '행사구분', '시작일', '종료일', '장소', 
    '참석인원수', '참석자명단', '총수입금액', '총지출금액', '최종잔액', 
    '지출상세내역(JSON)', '찬조및협찬내역', '비고'
  ]);
  if (settlements && settlements.length) {
    settlements.forEach(function(st) {
      var partStr = (st.participants || []).join(', ');
      var totalInc = (st.incomes || []).reduce(function(a, b){ return a + (Number(b.amount)||0); }, 0);
      var totalExp = (st.expenses || []).reduce(function(a, b){ return a + (Number(b.amount)||0); }, 0);
      var bal = totalInc - totalExp;
      var sponStr = (st.sponsorships || []).map(function(s){ return s.person + ': ' + s.item; }).join('\n');
      sheet.appendRow([
        st.id || ('ST_' + Utilities.formatDate(new Date(), 'GMT+9', 'yyyyMMdd_HHmmss')),
        st.title || '',
        st.type || '공식대회',
        st.startDate || '',
        st.endDate || '',
        st.venue || '',
        (st.participants || []).length,
        partStr,
        totalInc,
        totalExp,
        bal,
        JSON.stringify(st.expenses || []),
        sponStr,
        st.notes || ''
      ]);
    });
  }
}