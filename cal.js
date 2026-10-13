// 일정 달력 템플릿 · © 2026 crazy4eu (cwkim83) · 라이선스는 LICENSE 파일 참고
// 달력 계산 — 화면을 그리지 않는 순수 함수만 모았다 (check.mjs 가 이 파일을 그대로 불러다 검사한다).
// 날짜는 모두 "2026-10-06" 모양의 글자이고, 한 주는 월요일부터 시작한다.
(() => {
  const str = (v) => String(v ?? '');
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${String(d.getFullYear()).padStart(4, '0')}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // Date → "2026-10-06" (브라우저 언어 설정과 무관)
  const parse = (s) => { const [y, m, d] = str(s).split('-').map(Number); return new Date(y, m - 1, d); }; // "그 날 0시"(이 PC 시간)
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const addMonths = (s, n) => { const d = parse(s); return ymd(new Date(d.getFullYear(), d.getMonth() + n, 1)); }; // 항상 그 달 1일
  const weekStart = (s) => addDays(s, -((parse(s).getDay() + 6) % 7));
  const weekDays = (s) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(s), i));

  // s 가 속한 달을 덮는 주들 (앞뒤 달의 날짜가 섞여 4~6줄)
  function monthGrid(s) {
    const d = parse(s), last = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    const weeks = [];
    for (let w = weekStart(ymd(new Date(d.getFullYear(), d.getMonth(), 1))); w <= last; w = addDays(w, 7)) weeks.push(weekDays(w));
    return weeks;
  }

  // 모양 검사: 날짜는 진짜 있는 날("2026-02-31" 은 안 됨), 시각은 0 을 붙인 24시간, id 는 글자·숫자·_-
  const isDate = (s) => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && ymd(parse(s)) === s;
  const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  const okId = (id) => /^[A-Za-z0-9_-]{1,64}$/.test(str(id));
  const endOf = (e) => (isDate(e.endDate) && e.endDate >= e.date ? e.endDate : e.date); // 끝 날짜가 이상하면 하루짜리로 본다

  // 그 날에 걸친 일정(여러 날짜 일정 포함), 시작 시각 순. 날짜 모양이 틀린 항목은 건너뛴다 (problems 가 따로 알려 준다)
  const eventsOn = (events, day) => events.filter((e) => isObj(e) && isDate(e.date) && e.date <= day && day <= endOf(e))
    .sort((a, b) => str(a.start).localeCompare(str(b.start)));

  // 항목 하나가 왜 안 되는지 (괜찮으면 ''). 화면이 제대로 못 보여 주거나 고칠 수 없는 항목 — 주로 AI 가 형식을 어겨 쓴 것
  function why(x) {
    if (!isObj(x)) return '항목 모양이 아님';
    if (!okId(x.id)) return 'id 가 없거나 쓸 수 없는 글자';
    if (!isDate(x.date)) return '날짜가 YYYY-MM-DD 가 아님';
    if (x.endDate && (!isDate(x.endDate) || x.endDate < x.date)) return '끝 날짜가 이상함';
    if ((x.start && !isTime(x.start)) || (x.end && !isTime(x.end))) return '시각이 HH:MM 이 아님';
    if (['title', 'kind', 'place', 'memo'].some((k) => x[k] != null && typeof x[k] !== 'string')) return '글자여야 하는 칸이 글자가 아님';
    return '';
  }

  // 일정 목록 → { ok: 쓸 수 있는 것들, skipped: ['3번째 "제목": 이유', …] }. 멈추지 않고 건너뛰되 무엇이 왜 문제인지 모아 알려 준다
  function split(items) {
    const ok = [], skipped = [], seen = new Set();
    const label = (x) => (isObj(x) && x.title ? str(x.title) : JSON.stringify(x) ?? str(x)).slice(0, 30);
    (Array.isArray(items) ? items : []).forEach((x, i) => {
      const w = why(x) || (seen.has(str(x.id)) ? '같은 id 가 앞에 이미 있음' : '');
      if (w) return skipped.push(`${i + 1}번째 "${label(x)}": ${w}`);
      seen.add(str(x.id)); ok.push(x);
    });
    return { ok, skipped };
  }
  const problems = (events) => split(events).skipped;

  // 일정 창에서 저장을 누를 때: 문제가 있으면 쉬운 말로 된 이유를, 괜찮으면 '' 를 돌려준다
  function validate(f) {
    if (!str(f.title).trim()) return '제목을 적어 주세요.';
    if (!/^\d{4}-\d\d-\d\d$/.test(str(f.date))) return '날짜를 골라 주세요.';
    if (f.endDate && f.endDate < f.date) return '종료 날짜가 시작 날짜보다 빨라요.';
    if ((!f.endDate || f.endDate === f.date) && f.start && f.end && f.end < f.start) return '끝 시각이 시작 시각보다 빨라요.';
    return '';
  }
  // 창에 적은 값 → 저장할 일정. 고치는 경우 창에 없는 필드는 그대로 둔다
  const toEvent = (old, f, newId) => ({
    ...(old || {}), id: old ? str(old.id) : newId,
    title: str(f.title).trim(), kind: f.kind, date: f.date, endDate: f.endDate || f.date,
    start: str(f.start), end: str(f.end), place: str(f.place).trim(), memo: str(f.memo).trim(),
  });

  // ---------- 파일(JSON) ----------
  const FORMAT = 'calendar-template';
  const toFile = (events) => JSON.stringify({ format: FORMAT, ver: 1, events, exportedAt: new Date().toISOString() }, null, 2);
  // JSON 글 → { ok, skipped } 또는 { error: '쉬운 말 이유' } (이 달력 파일이 아니면 error — 호출한 쪽은 지금 데이터를 그대로 둔다)
  function parseFile(text) {
    let d;
    try { d = JSON.parse(text); } catch (e) { return { error: 'JSON 파일이 아니에요 (파일이 깨졌거나 다른 종류의 파일이에요).' }; }
    if (!isObj(d) || d.format !== FORMAT) return { error: `이 달력에서 내보낸 파일이 아니에요 ("format": "${FORMAT}" 이 없어요).` };
    if (!Array.isArray(d.events)) return { error: '파일에 "events" 일정 목록이 없어요.' };
    return split(d.events);
  }

  // 예시(전부 가상): 오늘 둘레에 — 하루짜리·시각 있는 것·종일·여러 날 일정, 오늘은 4개(월 보기의 "+1개 더" 를 보여 준다)
  function sample(today) {
    const e = (id, off, title, kind, start, end, place, memo, span = 0) =>
      ({ id, title, kind, date: addDays(today, off), endDate: addDays(today, off + span), start, end, place, memo });
    const m = '가상의 예시 일정이에요. 눌러서 고치거나 지워 보세요.';
    return [
      e('s1', 0, '(예시) 주간 팀 회의', '회의', '10:00', '11:00', '예시 회의실 A', m),
      e('s2', 0, '(예시) 점심 약속', '개인', '12:00', '13:00', '가상 식당', m),
      e('s3', 0, '(예시) 자료 정리', '회의', '14:00', '15:30', '', m),
      e('s4', 0, '(예시) 현장 확인', '외근', '16:00', '17:00', '가상 공장', m),
      e('s5', 1, '(예시) 거래처 방문', '출장', '09:00', '17:00', '예시시 가상구', m),
      e('s6', 2, '(예시) 가상 워크숍 (사흘)', '출장', '09:00', '18:00', '예시 연수원', '여러 날에 걸친 일정은 걸친 날마다 보여요.', 2),
      e('s7', -2, '(예시) 지난 회의 정리', '회의', '14:00', '15:00', '', m),
      e('s8', 7, '(예시) 하루 종일 행사', '개인', '', '', '', '시각을 비우면 「종일」로 보여요.'),
      e('s9', 9, '(예시) 월말 보고', '회의', '16:00', '17:00', '예시 회의실 B', m),
    ];
  }

  window.cal = { ymd, parse, addDays, addMonths, weekStart, weekDays, monthGrid, isDate, isTime, isObj, okId, eventsOn, problems, split, validate, toEvent, FORMAT, toFile, parseFile, sample };
})();
