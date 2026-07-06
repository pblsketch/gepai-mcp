/**
 * 발견성 도구: 주제 탐색(explore_topics)과 유사 자료 추천(related_resources).
 *
 * 실서비스의 온톨로지 설계(자료-주제-성취기준-SDGs 관계)를 계승하되,
 * 별도 그래프 DB 없이 카탈로그 933건 + 문서 1,113건의 태그 동시출현으로
 * 런타임에 계산한다 (데이터 규모가 작아 수 ms).
 */
import {
  DOCUMENTS,
  RESOURCES,
  STANDARD_BY_CODE,
  DOC_BY_ID,
  RESOURCE_BY_ID,
} from './data.js';
import type { Doc, Resource } from './types.js';

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

function topOf(counter: Map<string, number>, n: number): { name: string; count: number }[] {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

function bump(counter: Map<string, number>, key: string): void {
  if (!key) return;
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

// ---------------------------------------------------------------------------
// explore_topics
// ---------------------------------------------------------------------------

export function listTopics(): { name: string; resources: number; documents: number }[] {
  const res = new Map<string, number>();
  const doc = new Map<string, number>();
  for (const r of RESOURCES) for (const t of r.envTopics) bump(res, t);
  for (const d of DOCUMENTS) for (const t of d.envTopics) bump(doc, t);
  const names = new Set([...res.keys(), ...doc.keys()]);
  return [...names]
    .map((name) => ({
      name,
      resources: res.get(name) ?? 0,
      documents: doc.get(name) ?? 0,
    }))
    .sort((a, b) => b.resources + b.documents - (a.resources + a.documents));
}

export function exploreTopic(topic: string) {
  const t = norm(topic);
  const matchedResources = RESOURCES.filter((r) =>
    r.envTopics.some((x) => norm(x).includes(t))
  );
  const matchedDocs = DOCUMENTS.filter(
    (d) =>
      d.envTopics.some((x) => norm(x).includes(t)) ||
      d.keywords.some((x) => norm(x).includes(t))
  );

  const coTopics = new Map<string, number>();
  const sdgs = new Map<string, number>();
  const competencies = new Map<string, number>();
  const subjects = new Map<string, number>();
  const methods = new Map<string, number>();
  const standards = new Map<string, number>();
  const keywords = new Map<string, number>();

  for (const r of matchedResources) {
    for (const x of r.envTopics) if (!norm(x).includes(t)) bump(coTopics, x);
    for (const x of r.sdgs) bump(sdgs, x);
    for (const x of r.competencies) bump(competencies, x);
    for (const x of r.subjects) bump(subjects, x);
    for (const x of r.methods) bump(methods, x);
    for (const s of r.standards) bump(standards, s.code);
  }
  for (const d of matchedDocs) {
    for (const x of d.envTopics) if (!norm(x).includes(t)) bump(coTopics, x);
    for (const x of d.sdgs) bump(sdgs, x);
    for (const x of d.competencies) bump(competencies, x);
    for (const x of d.subjects) bump(subjects, x);
    for (const x of d.methods) bump(methods, x);
    for (const s of d.standards) bump(standards, s.code);
    for (const x of d.keywords) if (!norm(x).includes(t)) bump(keywords, x);
  }

  return {
    topic,
    matched: { resources: matchedResources.length, documents: matchedDocs.length },
    relatedTopics: topOf(coTopics, 10),
    sdgs: topOf(sdgs, 8),
    competencies: topOf(competencies, 6),
    subjects: topOf(subjects, 8),
    methods: topOf(methods, 6),
    relatedKeywords: topOf(keywords, 12),
    topStandards: topOf(standards, 10).map(({ name, count }) => {
      const std = STANDARD_BY_CODE.get(name);
      return {
        code: name,
        count,
        school: std?.school,
        subject: std?.subject,
        content: std?.content ?? '(2022 개정 DB 외 코드)',
      };
    }),
    sampleResources: matchedResources.slice(0, 6).map((r) => ({
      id: r.id,
      office: r.office,
      collection: r.collection,
      title: r.title,
      schoolLevel: r.schoolLevelRaw,
    })),
    sampleDocuments: matchedDocs.slice(0, 6).map((d) => ({
      documentId: d.id,
      region: d.region,
      fileName: d.fileName,
      schoolLevel: d.schoolLevel,
      keywords: d.keywords.slice(0, 5),
    })),
  };
}

// ---------------------------------------------------------------------------
// related_resources
// ---------------------------------------------------------------------------

interface FeatureSet {
  standards: Set<string>;
  topics: Set<string>;
  sdgs: Set<string>;
  subjects: Set<string>;
  schoolLevels: Set<string>;
}

function featuresOfResource(r: Resource): FeatureSet {
  return {
    standards: new Set(r.standards.map((s) => s.code)),
    topics: new Set(r.envTopics.map(norm)),
    sdgs: new Set(r.sdgs.map(norm)),
    subjects: new Set(r.subjects.map(norm)),
    schoolLevels: new Set(r.schoolLevels),
  };
}

function featuresOfDoc(d: Doc): FeatureSet {
  const levels = new Set<string>();
  for (const lv of ['유치원', '초등학교', '중학교', '고등학교']) {
    if (d.schoolLevel.includes(lv)) levels.add(lv);
  }
  return {
    standards: new Set(d.standards.map((s) => s.code)),
    topics: new Set(d.envTopics.map(norm)),
    sdgs: new Set(d.sdgs.map(norm)),
    subjects: new Set(d.subjects.map(norm)),
    schoolLevels: levels,
  };
}

function overlap(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const x of a) if (b.has(x)) out.push(x);
  return out;
}

function scorePair(target: FeatureSet, other: FeatureSet) {
  const sharedStandards = overlap(target.standards, other.standards);
  const sharedTopics = overlap(target.topics, other.topics);
  const sharedSdgs = overlap(target.sdgs, other.sdgs);
  const sharedSubjects = overlap(target.subjects, other.subjects);
  const levelMatch = overlap(target.schoolLevels, other.schoolLevels).length > 0;
  const score =
    sharedStandards.length * 3 +
    sharedTopics.length * 2 +
    sharedSdgs.length * 1 +
    sharedSubjects.length * 1 +
    (levelMatch ? 1 : 0);
  return { score, sharedStandards, sharedTopics, sharedSubjects, levelMatch };
}

export function relatedItems(
  target: { resourceId?: number; documentId?: number },
  limit: number
) {
  let features: FeatureSet | null = null;
  let selfResource: number | undefined;
  let selfDoc: number | undefined;

  if (target.resourceId !== undefined) {
    const r = RESOURCE_BY_ID.get(target.resourceId);
    if (!r) return { error: `resource_id ${target.resourceId}를 찾을 수 없습니다.` };
    features = featuresOfResource(r);
    selfResource = r.id;
  } else if (target.documentId !== undefined) {
    const d = DOC_BY_ID.get(target.documentId);
    if (!d) return { error: `document_id ${target.documentId}를 찾을 수 없습니다.` };
    features = featuresOfDoc(d);
    selfDoc = d.id;
  } else {
    return { error: 'resource_id 또는 document_id 중 하나를 지정하세요.' };
  }

  const scored: {
    kind: 'resource' | 'document';
    id: number;
    label: string;
    office: string;
    schoolLevel: string;
    score: number;
    why: string;
  }[] = [];

  for (const r of RESOURCES) {
    if (r.id === selfResource) continue;
    const s = scorePair(features, featuresOfResource(r));
    if (s.score <= 0) continue;
    scored.push({
      kind: 'resource',
      id: r.id,
      label: `${r.collection} — ${r.title}`,
      office: r.office,
      schoolLevel: r.schoolLevelRaw,
      score: s.score,
      why: buildWhy(s),
    });
  }
  for (const d of DOCUMENTS) {
    if (d.id === selfDoc) continue;
    const s = scorePair(features, featuresOfDoc(d));
    if (s.score <= 0) continue;
    scored.push({
      kind: 'document',
      id: d.id,
      label: d.fileName,
      office: d.region,
      schoolLevel: d.schoolLevel,
      score: s.score,
      why: buildWhy(s),
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return { items: scored.slice(0, limit) };
}

function buildWhy(s: {
  sharedStandards: string[];
  sharedTopics: string[];
  sharedSubjects: string[];
  levelMatch: boolean;
}): string {
  const parts: string[] = [];
  if (s.sharedStandards.length)
    parts.push(`성취기준 공유: ${s.sharedStandards.slice(0, 3).join(', ')}`);
  if (s.sharedTopics.length) parts.push(`주제 공유: ${s.sharedTopics.slice(0, 3).join(', ')}`);
  if (s.sharedSubjects.length) parts.push(`과목 공유: ${s.sharedSubjects.slice(0, 2).join(', ')}`);
  if (s.levelMatch) parts.push('학교급 일치');
  return parts.join(' · ');
}
