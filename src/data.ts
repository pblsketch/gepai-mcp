/**
 * 번들된 데이터(data/generated/*.json) 로더.
 * src/(개발)과 dist/(빌드) 모두 패키지 루트의 data/와 형제 관계이므로
 * import.meta.url 기준 상대 경로가 동일하게 동작한다.
 */
import { readFileSync } from 'node:fs';
import type { Doc, Resource, Standard } from './types.js';

function loadJson<T>(relative: string): T {
  const url = new URL(relative, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf-8')) as T;
}

export const STANDARDS: Standard[] = loadJson<Standard[]>(
  '../data/generated/standards.json'
);

export const RESOURCES: Resource[] = loadJson<Resource[]>(
  '../data/generated/resources.json'
);

/** 성취기준 코드 → 성취기준 (중복 코드는 첫 항목 우선) */
export const STANDARD_BY_CODE: Map<string, Standard> = new Map();
for (const s of STANDARDS) {
  if (!STANDARD_BY_CODE.has(s.code)) STANDARD_BY_CODE.set(s.code, s);
}

/** 성취기준 코드 → 해당 코드를 참조하는 자료 목록 */
export const RESOURCES_BY_STANDARD: Map<string, Resource[]> = new Map();
for (const r of RESOURCES) {
  for (const ref of r.standards) {
    const list = RESOURCES_BY_STANDARD.get(ref.code);
    if (list) list.push(r);
    else RESOURCES_BY_STANDARD.set(ref.code, [r]);
  }
}

export const RESOURCE_BY_ID: Map<number, Resource> = new Map(
  RESOURCES.map((r) => [r.id, r])
);

export const DOCUMENTS: Doc[] = loadJson<Doc[]>(
  '../data/generated/documents.json'
);

export const DOC_BY_ID: Map<number, Doc> = new Map(
  DOCUMENTS.map((d) => [d.id, d])
);

/** 정선 카탈로그 자료 id → 연결된 원문 문서 목록 */
export const DOCS_BY_RESOURCE: Map<number, Doc[]> = new Map();
for (const d of DOCUMENTS) {
  for (const rid of d.resourceIds) {
    const list = DOCS_BY_RESOURCE.get(rid);
    if (list) list.push(d);
    else DOCS_BY_RESOURCE.set(rid, [d]);
  }
}
