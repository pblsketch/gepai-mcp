/**
 * 원문 문서 카탈로그 빌드: data/source/rag_documents.jsonl → data/generated/documents.json
 *
 * rag_documents = GEPAI 실서비스에서 PDF 1,113건을 AI로 메타데이터 강화한 문서 단위 카탈로그.
 * (출처: Supabase 백업 2026-07-06, supabase-backup-20260706/rag_documents.jsonl)
 *
 * - region 명칭 정규화 (경기도→경기 등)
 * - env_topics/sdgs 문자열 필드를 배열로 분해
 * - achievements 텍스트에서 성취기준 [코드] 파싱
 * - 정선 카탈로그(resources.json)와 파일명 스템으로 연결 (resourceIds)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const p = (...seg: string[]) => path.join(root, ...seg);

const REGION_MAP: Record<string, string> = {
  서울특별시: '서울',
  인천광역시: '인천',
  경기도: '경기',
  충청북도: '충북',
  충청남도: '충남',
  대전광역시: '대전',
  광주광역시: '광주',
  전라남도: '전남',
  전라북도: '전북',
  경상남도: '경남',
  경상북도: '경북',
  부산광역시: '부산',
  대구광역시: '대구',
  울산광역시: '울산',
  세종특별자치시: '세종',
  제주특별자치도: '제주',
  강원도: '강원',
  강원특별자치도: '강원',
};

function normRegion(raw: string | null | undefined): string {
  const r = (raw ?? '').trim();
  return REGION_MAP[r] ?? r;
}

/** 배열 또는 쉼표 구분 문자열 → 정리된 배열 */
function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  if (typeof v === 'string')
    return v
      .split(/[,、;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

function parseStandardRefs(raw: unknown): { code: string; text: string }[] {
  const s = Array.isArray(raw) ? raw.join('\n') : typeof raw === 'string' ? raw : '';
  const refs: { code: string; text: string }[] = [];
  const re = /\[([^\]]+)\]\s*([^\[]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const code = m[1].replace(/[\[\]]/g, '').trim();
    const text = m[2].replace(/\s+/g, ' ').trim();
    if (code) refs.push({ code, text });
  }
  return refs;
}

function stem(name: string): string {
  return name
    .replace(/\.pdf$/i, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/** 공개 부적합 제외 목록: 개별 학교 제출 행정 보고서·정산서 (Drive 보관소에서도 삭제됨) */
function isExcluded(fileName: string): boolean {
  return (
    fileName.startsWith('충남_2023_자연생태학습장 구축_') ||
    fileName.startsWith('충남_학교숲 조성 사업_') ||
    fileName.includes('조성사업_부여_송간초등학교')
  );
}

// --- 입력 로드 -------------------------------------------------------------

const allRawDocs = readFileSync(p('data', 'source', 'rag_documents.jsonl'), 'utf-8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as Record<string, unknown>);

const rawDocs = allRawDocs.filter((d) => !isExcluded(String(d.file_name ?? '')));
const excludedCount = allRawDocs.length - rawDocs.length;

/** 원문 PDF Drive 직링크: data/source/drive-links.json ({t: 파일명, u: URL}[]) */
const driveLinks: { t: string; u: string }[] = JSON.parse(
  readFileSync(p('data', 'source', 'drive-links.json'), 'utf-8')
);
const driveByName = new Map<string, string>();
const driveByStem = new Map<string, string>();
for (const l of driveLinks) {
  if (!l.t || !l.u) continue;
  if (!driveByName.has(l.t)) driveByName.set(l.t, l.u);
  const s = stem(l.t);
  if (!driveByStem.has(s)) driveByStem.set(s, l.u);
}

const resources = JSON.parse(
  readFileSync(p('data', 'generated', 'resources.json'), 'utf-8')
) as { id: number; title: string; link?: string }[];

const linkByResourceId = new Map(
  resources.filter((r) => r.link).map((r) => [r.id, r.link as string])
);

const resourceByStem = new Map<string, number[]>();
for (const r of resources) {
  const key = stem(r.title);
  if (!key) continue;
  const list = resourceByStem.get(key);
  if (list) list.push(r.id);
  else resourceByStem.set(key, [r.id]);
}

// --- 변환 -------------------------------------------------------------------

const documents = rawDocs.map((d, i) => {
  const fileName = String(d.file_name ?? '');
  const resourceIds = resourceByStem.get(stem(fileName)) ?? [];
  return {
    id: i + 1,
    uuid: String(d.id ?? ''),
    fileName,
    filePath: String(d.file_path ?? ''),
    region: normRegion(d.region as string),
    schoolLevel: String(d.school_level ?? '').trim(),
    grade: String(d.grade ?? '').trim() || undefined,
    subjects: toList(d.subjects),
    envTopics: toList(d.env_topics),
    sdgs: toList(d.sdgs),
    competencies: toList(d.competencies),
    methods: toList(d.teaching_methods),
    resourceType: String(d.resource_type ?? '').trim(),
    activityType: String(d.activity_type ?? '').trim(),
    location: String(d.location ?? '').trim(),
    keywords: toList(d.semantic_keywords),
    standards: parseStandardRefs(d.achievements),
    gcsUri: String(d.gcs_uri ?? ''),
    resourceIds,
    link: resourceIds.map((rid) => linkByResourceId.get(rid)).find(Boolean),
    fileUrl: driveByName.get(fileName) ?? driveByStem.get(stem(fileName)),
  };
});

// --- 검증 및 저장 ------------------------------------------------------------

if (documents.length < 1000) {
  throw new Error(`문서 수가 예상보다 적음: ${documents.length} (>1000 필요)`);
}

const withRegion = documents.filter((d) => d.region && d.region !== 'Unknown');
const withTopics = documents.filter((d) => d.envTopics.length > 0);
const withStandards = documents.filter((d) => d.standards.length > 0);
const linked = documents.filter((d) => d.resourceIds.length > 0);

writeFileSync(p('data', 'generated', 'documents.json'), JSON.stringify(documents), 'utf-8');

console.log('=== build-documents 완료 ===');
console.log(`문서: ${documents.length}건 (공개 부적합 ${excludedCount}건 제외)`);
console.log(`  Drive 파일 링크: ${documents.filter((d) => d.fileUrl).length}건 (수집 ${driveLinks.length}건 중 매칭)`);
console.log(`  region: ${withRegion.length}, envTopics: ${withTopics.length}, standards: ${withStandards.length}, keywords: ${documents.filter((d) => d.keywords.length).length}`);
console.log(`  정선 카탈로그와 연결(resourceIds): ${linked.length}건`);
console.log(`  원본 링크 전파: ${documents.filter((d) => d.link).length}건`);
console.log(
  `  region 분포: ${[...new Set(documents.map((d) => d.region))].filter(Boolean).join(', ')}`
);
