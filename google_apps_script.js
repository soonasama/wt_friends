/**
 * ⚾ 2026 WT프렌즈 통합 데이터베이스(DB) - 마스터 Google Apps Script
 * (라인업_관리_DB + WT_일정_참석투표_DB + WT_공지_커뮤니티_DB + WT_훈련_셋로그_DB + WT_정산_회계_DB)
 */

function doGet(e) {
  var params = e ? (e.parameter || {}) : {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
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
    
    // 분기 A: 라인업 저장
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
    
    // 분기 B: 클럽하우스 데이터 저장 (일정, 공지, 셋로그, 정산실)
    var clubData = data.data || data;
    
    var rawSheet = getOrCreateSheet(ss, '_CLUB_RAW');
    rawSheet.getRange('A1').setValue(JSON.stringify(clubData));
    rawSheet.getRange('B1').setValue('마지막 업데이트: ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'));
    
    if (clubData.events && Array.isArray(clubData.events)) {
      updateEventsSheet(ss, clubData.events);
    }
    if (clubData.notices && Array.isArray(clubData.notices)) {
      updateNoticesSheet(ss, clubData.notices);
    }
    if (clubData.setlogs && Array.isArray(clubData.setlogs)) {
      updateSetlogsSheet(ss, clubData.setlogs);
    }
    if (clubData.settlements && Array.isArray(clubData.settlements)) {
      updateSettlementsSheet(ss, clubData.settlements);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "클럽하우스 통합 동기화 완료" }))
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