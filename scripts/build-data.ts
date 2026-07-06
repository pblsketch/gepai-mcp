/**
 * 데이터 빌드 스크립트: data/source/*.csv → data/generated/*.json
 *
 * - achievement-standards.csv (2022 개정 교육과정 성취기준)
 * - resource-catalog.csv (교육부 자원맵: 전국 시도교육청 환경교육 자료 카탈로그)
 *
 * 생성된 JSON은 저장소에 커밋되어 패키지에 번들됩니다 (사용자는 빌드 불필요).
 *
 * 실행: npm run build:data
 */
import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = (f: string) => path.join(root, 'data', 'source', f);
const out = (f: string) => path.join(root, 'data', 'generated', f);

// ---------------------------------------------------------------------------
// 공통 유틸
// ---------------------------------------------------------------------------

/** "[6과05-03]" → "6과05-03" */
function normalizeCode(raw: string): string {
  return raw.replace(/[\[\]]/g, '').trim();
}

/** 쉼표 구분 다중값 필드 → 배열 (공백/빈값 정리) */
function splitMulti(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,、;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 학교급 원문에서 표준 학교급 추출: "초등학교(5~6), 중학교" → ["초등학교","중학교"] */
function extractSchoolLevels(raw: string | undefined): string[] {
  if (!raw) return [];
  const levels: string[] = [];
  for (const level of ['유치원', '초등학교', '중학교', '고등학교']) {
    if (raw.includes(level)) levels.push(level);
  }
  return levels;
}

/**
 * 성취기준 셀 파싱: "[6과05-03] 생태계 보전의…\n[6도03-04] …"
 * → [{ code: "6과05-03", text: "생태계 보전의…" }, ...]
 */
function parseStandardRefs(raw: string | undefined): { code: string; text: string }[] {
  if (!raw) return [];
  const refs: { code: string; text: string }[] = [];
  const re = /\[([^\]]+)\]\s*([^\[]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const code = normalizeCode(m[1]);
    const text = m[2].replace(/\s+/g, ' ').trim();
    if (code) refs.push({ code, text });
  }
  return refs;
}

// ---------------------------------------------------------------------------
// 1. 성취기준 (achievement standards)
// ---------------------------------------------------------------------------

interface StandardRow {
  학교: string;
  과목: string;
  '학년(학년군)': string;
  '성취기준 코드': string;
  '성취기준 내용': string;
}

const standardsCsv = readFileSync(src('achievement-standards.csv'), 'utf-8');
const standardRows: StandardRow[] = parse(standardsCsv, {
  columns: true,
  bom: true,
  skip_empty_lines: true,
  relax_column_count: true,
  trim: true,
});

const standards = standardRows
  .filter((r) => r['성취기준 코드'] && r['성취기준 내용'])
  .map((r) => ({
    code: normalizeCode(r['성취기준 코드']),
    school: (r['학교'] ?? '').trim(),
    subject: (r['과목'] ?? '').trim(),
    grade: (r['학년(학년군)'] ?? '').trim(),
    content: (r['성취기준 내용'] ?? '').replace(/\s+/g, ' ').trim(),
  }));

// ---------------------------------------------------------------------------
// 2. 자원맵 카탈로그 (resource catalog)
// ---------------------------------------------------------------------------

/** 자료집 원본 링크 (수집·검증된 것만, data/source/collection-links.json) */
interface CollectionLink {
  office: string;
  collection: string;
  url: string | null;
  verified?: boolean;
  confidence?: string;
}
const collectionLinks: CollectionLink[] = JSON.parse(
  readFileSync(src('collection-links.json'), 'utf-8')
);
const linkByKey = new Map<string, string>();
for (const l of collectionLinks) {
  if (l.url) linkByKey.set(`${l.office}|${l.collection}`, l.url);
}

const catalogCsv = readFileSync(src('resource-catalog.csv'), 'utf-8');
const catalogRows: Record<string, string>[] = parse(catalogCsv, {
  columns: true,
  bom: true,
  skip_empty_lines: true,
  relax_column_count: true,
  trim: true,
});

const resources = catalogRows
  .filter((r) => r['자료명'] || r['파일명(활동명, 자료제목)'])
  .map((r, i) => ({
    id: i + 1,
    office: (r['시도교육청'] ?? '').trim(),
    collection: (r['자료명'] ?? '').trim(),
    title: (r['파일명(활동명, 자료제목)'] ?? '').trim(),
    materialType: (r['자료유형'] ?? '').trim(),
    activityTypes: splitMulti(r['활동 유형']),
    schoolLevelRaw: (r['학교급'] ?? '').trim(),
    schoolLevels: extractSchoolLevels(r['학교급']),
    hours: (r['시간(차시)'] ?? '').trim(),
    subjects: splitMulti(r['과목명']),
    competencies: splitMulti(r['환경교육역량']),
    place: (r['장소'] ?? '').trim(),
    envTopics: splitMulti(r['환경주제']),
    sdgs: splitMulti(r['SDGs목표']),
    methods: splitMulti(r['교수학습방법']),
    standards: parseStandardRefs(r['성취기준']),
    link: linkByKey.get(`${(r['시도교육청'] ?? '').trim()}|${(r['자료명'] ?? '').trim()}`),
  }));

// ---------------------------------------------------------------------------
// 검증 및 저장
// ---------------------------------------------------------------------------

if (standards.length < 3000) {
  throw new Error(`성취기준 수가 예상보다 적음: ${standards.length} (>3000 필요)`);
}
// 원본 CSV는 998행이지만 934~998행은 seq만 있는 빈 템플릿 행 → 실제 자료 933건
if (resources.length < 900) {
  throw new Error(`자료 수가 예상보다 적음: ${resources.length} (>900 필요)`);
}

const uniqueCodes = new Set(standards.map((s) => s.code));
const resourcesWithStandards = resources.filter((r) => r.standards.length > 0);
const standardCodeSet = uniqueCodes;
const linkedRefs = resources.flatMap((r) => r.standards.map((s) => s.code));
const matchedRefs = linkedRefs.filter((c) => standardCodeSet.has(c));

writeFileSync(out('standards.json'), JSON.stringify(standards), 'utf-8');
writeFileSync(out('resources.json'), JSON.stringify(resources), 'utf-8');

console.log('=== build-data 완료 ===');
console.log(`성취기준: ${standards.length}건 (고유 코드 ${uniqueCodes.size}개)`);
console.log(
  `  학교급: ${[...new Set(standards.map((s) => s.school))].join(', ')}`
);
console.log(`  과목 수: ${new Set(standards.map((s) => s.subject)).size}`);
console.log(`자료: ${resources.length}건 (${new Set(resources.map((r) => r.office)).size}개 교육청)`);
console.log(`  원본 링크: 자료집 ${linkByKey.size}개 수집됨 → 자료 ${resources.filter((r) => r.link).length}건에 연결`);
console.log(
  `  성취기준 연결 자료: ${resourcesWithStandards.length}건, 참조 ${linkedRefs.length}건 중 성취기준 DB 매칭 ${matchedRefs.length}건 (${Math.round((matchedRefs.length / Math.max(linkedRefs.length, 1)) * 100)}%)`
);
console.log(
  `  환경주제: ${[...new Set(resources.flatMap((r) => r.envTopics))].slice(0, 12).join(', ')}${new Set(resources.flatMap((r) => r.envTopics)).size > 12 ? ' …' : ''}`
);
