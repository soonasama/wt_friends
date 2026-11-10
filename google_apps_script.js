/**
 * WT프렌즈 클럽하우스 - 구글 스프레드시트 연동 백엔드 스크립트 (Google Apps Script)
 * 
 * [1분 설정 및 배포 가이드]
 * 1. 구글 드라이브에서 새 스프레드시트를 생성합니다 (예: 'WT프렌즈 일정 및 참석 관리').
 * 2. 상단 메뉴 [확장 프로그램] -> [Apps Script]를 클릭합니다.
 * 3. 기존 코드를 모두 지우고 이 파일의 내용을 전체 복사하여 붙여넣습니다.
 * 4. 우측 상단 파란색 [배포] -> [새 배포]를 클릭합니다.
 * 5. 왼쪽 유형 선택(톱니바퀴 아이콘)에서 [웹 앱]을 선택합니다.
 *    - 설명: WT프렌즈 클럽하우스 API
 *    - 다음 사용자 권한으로 실행: '나(내 계정)'
 *    - 액세스 권한이 있는 사용자: '모든 사용자(Anyone)'  <-- 필수!
 * 6. [배포] 버튼을 누르고 '웹 앱 URL' (https://script.google.com/macros/s/.../exec)을 복사합니다.
 * 7. WT프렌즈 웹앱에서 [📊 구글 시트 연동 설정] 버튼을 누르고 위 URL을 붙여넣으면 완료!
 */

function doGet(e) {
  var params = e.parameter || {};
  var action = params.action || 'get';
  var teamId = params.teamId || 'aSEa0076';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rawSheet = getOrCreateSheet(ss, '_CLUB_RAW');
  
  var rawJson = rawSheet.getRange('A1').getValue();
  var data = null;
  if (rawJson) {
    try {
      data = JSON.parse(rawJson);
    } catch(err) {
      data = null;
    }
  }
  
  var response = {
    status: 'success',
    action: action,
    teamId: teamId,
    data: data,
    serverTime: new Date().toISOString()
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var rawContents = e.postData ? e.postData.contents : '';
  var payload = {};
  if (rawContents) {
    try {
      payload = JSON.parse(rawContents);
    } catch(err) {
      payload = {};
    }
  }
  
  var action = payload.action || 'save';
  var teamId = payload.teamId || 'aSEa0076';
  var data = payload.data || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. RAW JSON 데이터 저장 (_DB_RAW 시트 A1 셀)
  var rawSheet = getOrCreateSheet(ss, '_CLUB_RAW');
  rawSheet.getRange('A1').setValue(JSON.stringify(data));
  rawSheet.getRange('B1').setValue('마지막 업데이트: ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'));
  
  // 2. 운영진과 감독님이 엑셀로 보기 편한 한글 탭 자동 생성 및 갱신
  if (data.events && Array.isArray(data.events)) {
    updateEventsSheet(ss, data.events);
  }
  if (data.notices && Array.isArray(data.notices)) {
    updateNoticesSheet(ss, data.notices);
  }
  if (data.setlogs && Array.isArray(data.setlogs)) {
    updateSetlogsSheet(ss, data.setlogs);
  }
  
  var response = {
    status: 'success',
    message: '성공적으로 저장되었습니다.',
    savedAt: new Date().toISOString(),
    eventsCount: (data.events || []).length
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
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
  
  events.forEach(function(ev) {
    var rsvp = ev.rsvp || {};
    var inList = [];
    var carList = [];
    var outList = [];
    var tbdList = [];
    
    Object.keys(rsvp).forEach(function(player) {
      var st = rsvp[player];
      if (st === 'car') { inList.push(player + '(🚗차량)'); carList.push(player); }
      else if (st === 'in') { inList.push(player); }
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
  
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#172554').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function updateNoticesSheet(ss, notices) {
  var sheet = getOrCreateSheet(ss, 'WT_공지_커뮤니티_DB');
  sheet.clear();
  var headers = ['구분', '고정 여부', '작성자', '작성일', '제목', '공지 내용', '팀원 댓글 내용 (작성자: 내용)'];
  var rows = [headers];
  notices.forEach(function(nt) {
    var cmtTexts = (nt.comments || []).map(function(c) {
      return c.author + ': ' + c.text + ' (' + c.date + ')';
    }).join('
');
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
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#172554').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}
