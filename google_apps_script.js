/**
 * ⚾ 2026 WT프렌즈 통합 데이터베이스(DB) - 통합 Apps Script (라인업 DB + 클럽하우스 연동)
 * 
 * [설명]
 * 기존 '라인업_관리_DB' 저장 기능과
 * 새로 추가된 'WT_일정_참석투표_DB', 'WT_공지_커뮤니티_DB', 'WT_훈련_셋로그_DB'의 
 * 실시간 양방향 연동 기능이 하나로 통합된 마스터 스크립트입니다.
 */

function doGet(e) {
  var params = e ? (e.parameter || {}) : {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. 클럽하우스 일정·투표·공지·셋로그 데이터 조회 (action: 'get' 또는 기본값)
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
  
  // 2. 기존 특정 시트 데이터 조회 (sheet 파라미터가 있을 때)
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
    
    // 분기 A: 기존 라인업 저장 요청 (data.batters 또는 data.opp 등이 전달된 경우)
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
    
    // 분기 B: 클럽하우스 일정·참석투표·공지·셋로그 저장 (data.data 또는 data.events가 전달된 경우)
    var clubData = data.data || data;
    
    // 1) RAW JSON 저장
    var rawSheet = getOrCreateSheet(ss, '_CLUB_RAW');
    rawSheet.getRange('A1').setValue(JSON.stringify(clubData));
    rawSheet.getRange('B1').setValue('마지막 업데이트: ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'));
    
    // 2) 구단 DB 스타일 한글 시트 실시간 자동 갱신
    if (clubData.events && Array.isArray(clubData.events)) {
      updateEventsSheet(ss, clubData.events);
    }
    if (clubData.notices && Array.isArray(clubData.notices)) {
      updateNoticesSheet(ss, clubData.notices);
    }
    if (clubData.setlogs && Array.isArray(clubData.setlogs)) {
      updateSetlogsSheet(ss, clubData.setlogs);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "클럽하우스 동기화 완료" }))
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
  
  var headers = ['일정 구분', '일정 제목', '날짜', '시간', '구장/장소', '참석 명단 (차량)', '불참 명단', '미정 명단', '공지 및 준비물 메모'];
  var rows = [headers];
  
  if (events && Array.isArray(events)) {
    events.forEach(function(ev) {
      var rsvp = ev.rsvp || {};
      var inList = [];
      var carList = [];
      var outList = [];
      var tbdList = [];
      
      Object.keys(rsvp).forEach(function(player) {
        var st = rsvp[player];
        if (st === 'car') { inList.push(player + '(🚗차량)'); carList.push(player); }
        else if (st === 'in' || st === 'ok') { inList.push(player); }
        else if (st === 'out') { outList.push(player); }
        else if (st === 'tbd') { tbdList.push(player); }
      });
      
      rows.push([
        ev.type || '훈련',
        ev.title || '',
        ev.date || '',
        ev.time || '',
        ev.venue || '',
        inList.join(', ') + (inList.length ? ' [총 ' + inList.length + '명]' : '없음'),
        outList.join(', ') + (outList.length ? ' [총 ' + outList.length + '명]' : '없음'),
        tbdList.join(', ') + (tbdList.length ? ' [총 ' + tbdList.length + '명]' : '없음'),
        ev.note || ''
      ]);
    });
  }
  
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#172554').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function updateNoticesSheet(ss, notices) {
  var sheet = getOrCreateSheet(ss, 'WT_공지_커뮤니티_DB');
  sheet.clear();
  var headers = ['구분', '고정 여부', '작성자', '작성일', '제목', '공지 내용', '팀원 댓글'];
  var rows = [headers];
  if (notices && Array.isArray(notices)) {
    notices.forEach(function(nt) {
      var cmtTexts = (nt.comments || []).map(function(c) { return c.author + ': ' + c.text + ' (' + c.date + ')'; }).join('\n');
      rows.push([
        nt.cat || '공지',
        nt.pinned ? '📌 고정' : '일반',
        nt.author || '',
        nt.date || '',
        nt.title || '',
        nt.body || '',
        cmtTexts || '댓글 없음'
      ]);
    });
  }
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#172554').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function updateSetlogsSheet(ss, setlogs) {
  var sheet = getOrCreateSheet(ss, 'WT_훈련_셋로그_DB');
  sheet.clear();
  var headers = ['작성자', '훈련일', '카테고리', '배팅 스윙수', '투구수', '훈련 드릴 내용', '훈련 메모 및 코멘트'];
  var rows = [headers];
  if (setlogs && Array.isArray(setlogs)) {
    setlogs.forEach(function(sl) {
      rows.push([
        sl.author || '',
        sl.date || '',
        sl.cat || '타격',
        sl.swings || 0,
        sl.pitches || 0,
        sl.drill || '',
        sl.memo || ''
      ]);
    });
  }
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#172554').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}
