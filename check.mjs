// 일정 달력 템플릿 · © 2026 crazy4eu (cwkim83)
// cal.js(날짜 계산) 자가 점검 — `node check.mjs`. 달력을 쓰기만 할 거라면 이 파일은 몰라도 됩니다.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const box = { window: {} };
vm.createContext(box);
vm.runInContext(readFileSync(new URL('./cal.js', import.meta.url), 'utf8'), box);
const c = box.window.cal;

let n = 0;
const fails = [];
const check = (name, cond) => { n++; if (!cond) fails.push(name); };
const ids = (a) => a.map((e) => e.id).join();

// 달 보기 칸: 2026-10 은 9/28(월)~11/1(일) 5줄, 2026-03 은 2/23~4/5 6줄
const m10 = c.monthGrid('2026-10-15'), m3 = c.monthGrid('2026-03-01'), m2 = c.monthGrid('2026-02-28');
check('2026-10 은 5줄 (9/28 ~ 11/1)', m10.length === 5 && m10[0][0] === '2026-09-28' && m10[4][6] === '2026-11-01' && m10.every((w) => w.length === 7));
check('2026-03 은 6줄 (2/23 ~ 4/5)', m3.length === 6 && m3[0][0] === '2026-02-23' && m3[5][6] === '2026-04-05');
check('2026-02 는 5줄 (1/26 ~ 3/1)', m2.length === 5 && m2[0][0] === '2026-01-26' && m2[4][6] === '2026-03-01');

// 주: 월요일 시작 (일요일을 골라도 같은 주)
check('weekStart 는 월요일', c.weekStart('2026-10-09') === '2026-10-05' && c.weekStart('2026-10-11') === '2026-10-05' && c.weekStart('2026-10-05') === '2026-10-05');
check('weekDays 는 월~일 7일', c.weekDays('2026-10-09').join() === '2026-10-05,2026-10-06,2026-10-07,2026-10-08,2026-10-09,2026-10-10,2026-10-11');

// 이전·다음: 달 경계·연 경계
check('addDays 달·연 경계', c.addDays('2026-10-31', 1) === '2026-11-01' && c.addDays('2026-01-01', -1) === '2025-12-31');
check('addMonths 는 그 달 1일', c.addMonths('2026-01-31', 1) === '2026-02-01' && c.addMonths('2026-01-15', -1) === '2025-12-01');
check('ymd/parse 왕복', c.ymd(c.parse('2026-10-06')) === '2026-10-06' && c.ymd(new Date(2026, 0, 5)) === '2026-01-05');

// 그 날의 일정: 여러 날 일정은 걸친 모든 날(마지막 날 포함), 시작 시각 순, 깨진 항목은 건너뜀
const events = [
  { id: 'a', date: '2026-10-06', endDate: '2026-10-06', start: '14:00' },
  { id: 'b', date: '2026-10-05', endDate: '2026-10-07', start: '09:00' }, // 사흘에 걸침
  { id: 'c', date: '2026-10-06', start: '08:30' }, // endDate 없음
  { id: 'd', date: '2026-10-08', start: '08:00' },
  null, { id: 'e' }, // 깨진 항목
];
check('eventsOn: 10/6 = c,b,a (시작 시각 순, 여러 날 포함)', ids(c.eventsOn(events, '2026-10-06')) === 'c,b,a');
check('eventsOn: 여러 날 일정의 첫날·마지막 날에도 보임', ids(c.eventsOn(events, '2026-10-05')) === 'b' && ids(c.eventsOn(events, '2026-10-07')) === 'b');
check('eventsOn: 걸치지 않는 날은 비어 있음', c.eventsOn(events, '2026-10-04').length === 0 && ids(c.eventsOn(events, '2026-10-08')) === 'd');

// 날짜·시각 모양
check('isDate: 진짜 있는 날만', c.isDate('2026-10-06') && c.isDate('2024-02-29') && !c.isDate('2026-02-31') && !c.isDate('2026-02-29') && !c.isDate(20261006) && !c.isDate('2026/10/06') && !c.isDate('2026-1-6'));
check('isTime: 0 을 붙인 24시간만', c.isTime('09:00') && c.isTime('23:59') && !c.isTime('9:00') && !c.isTime('24:00') && !c.isTime('09:60'));

// 일정 창 검사 (validate)
const ok = { title: '회의', date: '2026-10-09', endDate: '', start: '10:00', end: '11:00' };
check('validate: 정상은 통과', c.validate(ok) === '');
check('validate: 제목이 비면 안내', c.validate({ ...ok, title: '   ' }) === '제목을 적어 주세요.');
check('validate: 날짜가 없으면 안내', c.validate({ ...ok, date: '' }) === '날짜를 골라 주세요.');
check('validate: 종료 날짜가 더 빠르면 안내', c.validate({ ...ok, endDate: '2026-10-08' }) === '종료 날짜가 시작 날짜보다 빨라요.');
check('validate: 하루짜리에서 끝 시각이 빠르면 안내', c.validate({ ...ok, end: '09:00' }) === '끝 시각이 시작 시각보다 빨라요.');
check('validate: 여러 날이면 끝 시각이 더 빨라도 됨(밤샘)', c.validate({ ...ok, endDate: '2026-10-10', end: '09:00' }) === '' && c.validate({ ...ok, start: '', end: '' }) === '');

// toEvent: 새 일정은 새 id·종료 날짜 = 날짜·공백 제거, 고칠 때는 id·창에 없는 필드를 그대로
const f = { title: ' 분기 점검 ', kind: '회의', date: '2026-10-09', endDate: '', start: '11:00', end: '12:00', place: ' 회의실 ', memo: '' };
const made = c.toEvent(null, f, 'new-1');
check('toEvent(새): id·endDate·공백', made.id === 'new-1' && made.title === '분기 점검' && made.endDate === '2026-10-09' && made.place === '회의실');
const edited = c.toEvent({ id: 7, extra: 'x', title: '옛', date: '2026-10-09' }, f, 'ignored');
check('toEvent(고침): 기존 id(글자로)·모르는 필드 유지', edited.id === '7' && edited.extra === 'x' && edited.title === '분기 점검');

// problems / split: 형식이 틀린 항목이 섞여도 멈추지 않고, 무엇이 왜 문제인지 알려 줌
const weird = [null, 0, 'x', [], true, { id: 1, title: 2, date: 20261006 }, { id: 'a', date: '2026/10/06', title: '슬래시' },
  { id: 'b', date: '10월 6일', title: '한글 날짜' }, { id: 'c', date: '2026-10-06', endDate: '2026-10-05', title: '끝이 빠름' },
  { id: 'd', date: '2026-10-06', start: '9:00', title: '한 자리 시' }, { id: 'e', date: '2026-02-31', title: '없는 날' },
  { id: '한글', date: '2026-10-06', title: '이상한 id' }, { id: 'ok', date: '2026-10-06', start: '10:00', title: '정상' },
  { id: 'ok', date: '2026-10-07', title: '같은 id' }, { id: 'k', date: '2026-10-06', title: '종류가 글자 아님', kind: { x: 1 } }];
let probs = [], on6 = '';
try { probs = c.problems(weird); on6 = ids(c.eventsOn(weird, '2026-10-06')); } catch (e) { probs = null; }
check('problems: 형식이 틀린 항목이 섞여도 멈추지 않음', Array.isArray(probs));
check('problems: 틀린 14개를 모두 찾고 정상(10:00)은 안 잡음', probs.length === 14 && !probs.some((p) => p.includes('"정상"')));
check('problems: 날짜 틀림을 이유와 함께 알림', probs.some((p) => p.includes('"슬래시"') && p.includes('날짜가 YYYY-MM-DD 가 아님')) && probs.some((p) => p.includes('"없는 날"') && p.includes('날짜가')));
check('problems: 끝 날짜·시각·id·중복·글자 아님도 알림', ['"끝이 빠름": 끝 날짜가', '"한 자리 시": 시각이', '"이상한 id": id 가', '"같은 id": 같은 id', '"종류가 글자 아님": 글자여야'].every((w) => probs.some((p) => p.includes(w))));
check('problems: 몇 번째인지 적음', probs.some((p) => p.startsWith('7번째 "슬래시"')));
check('eventsOn: 날짜 모양이 틀린 건 빼고, 끝 날짜만 이상한 건 하루짜리로 봄', on6 === 'c,한글,k,ok,d');
check('problems: 정상 목록은 빈 배열', c.problems([{ id: 'x1', date: '2026-10-06', start: '10:00', end: '11:00' }]).length === 0 && c.problems([]).length === 0 && c.problems(undefined).length === 0);

// 파일 (내보내기 → 불러오기)
const round = c.parseFile(c.toFile([{ id: 'x1', title: '왕복', date: '2026-10-06', endDate: '2026-10-06', start: '', end: '' }]));
check('toFile → parseFile 왕복', !round.error && round.ok.length === 1 && round.ok[0].title === '왕복' && round.skipped.length === 0);
const mixed = c.parseFile(JSON.stringify({ format: 'calendar-template', ver: 1, events: [{ id: 'g', date: '2026-10-06' }, { id: 'h', date: '내일' }] }));
check('parseFile: 나쁜 항목은 건너뛰고 이유를 줌, 나머지는 불러옴', mixed.ok.length === 1 && mixed.skipped.length === 1 && mixed.skipped[0].startsWith('2번째') && mixed.skipped[0].includes('날짜가'));
check('parseFile: JSON 이 아니면 error', !!c.parseFile('이건 JSON 이 아님').error);
check('parseFile: 다른 파일(format 없음·배열·다른 format)은 error', !!c.parseFile('{"a":1}').error && !!c.parseFile('[{"id":"a","date":"2026-10-06"}]').error && !!c.parseFile('{"format":"wbs-template","events":[]}').error);
check('parseFile: events 목록이 없으면 error', !!c.parseFile('{"format":"calendar-template"}').error);

// 예시: 전부 정상이고, 오늘 둘레에 있고, 여러 날 일정이 걸친 날마다 보이고, 오늘은 4개
const sm = c.sample('2026-10-13');
check('sample: 모두 형식 검사 통과', c.problems(sm).length === 0 && sm.every((e) => c.validate({ ...e, endDate: e.endDate }) === ''));
check('sample: 오늘 4개 (월 보기 "+1개 더")', c.eventsOn(sm, '2026-10-13').length === 4);
check('sample: 여러 날 일정은 사흘 모두에 보임', ['2026-10-15', '2026-10-16', '2026-10-17'].every((d) => c.eventsOn(sm, d).some((e) => e.id === 's6')) && c.eventsOn(sm, '2026-10-18').every((e) => e.id !== 's6'));

if (fails.length) { console.error(`FAIL ${fails.length}/${n}개\n - ` + fails.join('\n - ')); process.exit(1); }
console.log(`OK ${n}개`);
