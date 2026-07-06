/**
 * 경량 인메모리 검색.
 *
 * 데이터 규모(성취기준 3,285건 + 자료 933건)가 작으므로 색인 없이
 * 가중치 스코어링 선형 스캔으로 충분하다 (<10ms).
 *
 * 한국어 매칭: 질의어를 공백 기준으로 나눈 뒤 부분 문자열 포함 여부로
 * 매칭하고, 불일치 시 어미/조사를 감안해 끝 글자를 줄여가며 재시도한다.
 * (예: "기후변화의" → "기후변화")
 */
import { RESOURCES, STANDARDS } from './data.js';
import type { Resource, Standard } from './types.js';

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenize(query: string): string[] {
  return norm(query)
    .split(/[\s,;/·]+/)
    .filter((t) => t.length > 0);
}

/** 단일 질의어가 텍스트와 얼마나 맞는지 (0 = 불일치) */
function termScore(text: string, term: string): number {
  if (text.includes(term)) return 1;
  // 조사/어미 완화: 끝에서 한두 글자 제거 후 재시도 (최소 2글자 유지)
  if (term.length > 2 && text.includes(term.slice(0, -1))) return 0.7;
  if (term.length > 3 && text.includes(term.slice(0, -2))) return 0.4;
  return 0;
}

interface Field {
  text: string;
  weight: number;
}

function scoreFields(fields: Field[], terms: string[]): number {
  let total = 0;
  for (const term of terms) {
    let best = 0;
    for (const f of fields) {
      const s = termScore(f.text, term) * f.weight;
      if (s > best) best = s;
    }
    total += best;
  }
  return total;
}

// ---------------------------------------------------------------------------
// 자료 검색
// ---------------------------------------------------------------------------

export interface ResourceFilters {
  schoolLevel?: string;
  subject?: string;
  envTopic?: string;
  sdg?: string;
  office?: string;
  materialType?: string;
}

export function searchResources(
  query: string | undefined,
  filters: ResourceFilters,
  limit: number
): { total: number; items: Resource[] } {
  let candidates = RESOURCES;

  if (filters.schoolLevel) {
    const lv = filters.schoolLevel;
    candidates = candidates.filter((r) => r.schoolLevels.includes(lv));
  }
  if (filters.subject) {
    const sub = norm(filters.subject);
    candidates = candidates.filter((r) =>
      r.subjects.some((s) => norm(s).includes(sub))
    );
  }
  if (filters.envTopic) {
    const t = norm(filters.envTopic);
    candidates = candidates.filter((r) =>
      r.envTopics.some((s) => norm(s).includes(t))
    );
  }
  if (filters.sdg) {
    const g = norm(filters.sdg);
    candidates = candidates.filter((r) =>
      r.sdgs.some((s) => norm(s).includes(g))
    );
  }
  if (filters.office) {
    const o = norm(filters.office);
    candidates = candidates.filter((r) => norm(r.office).includes(o));
  }
  if (filters.materialType) {
    const m = norm(filters.materialType);
    candidates = candidates.filter((r) => norm(r.materialType).includes(m));
  }

  if (!query || tokenize(query).length === 0) {
    return { total: candidates.length, items: candidates.slice(0, limit) };
  }

  const terms = tokenize(query);
  const scored = candidates
    .map((r) => {
      const fields: Field[] = [
        { text: norm(r.title), weight: 3 },
        { text: norm(r.collection), weight: 2 },
        { text: norm(r.envTopics.join(' ')), weight: 2 },
        { text: norm(r.activityTypes.join(' ')), weight: 1.5 },
        { text: norm(r.subjects.join(' ')), weight: 1.5 },
        { text: norm(r.methods.join(' ')), weight: 1 },
        { text: norm(r.competencies.join(' ')), weight: 1 },
        { text: norm(r.sdgs.join(' ')), weight: 1 },
        { text: norm(r.standards.map((s) => s.text).join(' ')), weight: 0.8 },
        { text: norm(r.place), weight: 0.5 },
      ];
      return { r, score: scoreFields(fields, terms) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return { total: scored.length, items: scored.slice(0, limit).map((x) => x.r) };
}

// ---------------------------------------------------------------------------
// 성취기준 검색
// ---------------------------------------------------------------------------

export interface StandardFilters {
  school?: string;
  subject?: string;
  grade?: string;
  code?: string;
}

export function searchStandards(
  query: string | undefined,
  filters: StandardFilters,
  limit: number
): { total: number; items: Standard[] } {
  let candidates = STANDARDS;

  if (filters.code) {
    const code = filters.code.replace(/[\[\]]/g, '').trim().toLowerCase();
    candidates = candidates.filter((s) =>
      s.code.toLowerCase().startsWith(code)
    );
  }
  if (filters.school) {
    const sc = filters.school;
    candidates = candidates.filter((s) => s.school === sc);
  }
  if (filters.subject) {
    const sub = norm(filters.subject);
    candidates = candidates.filter((s) => norm(s.subject).includes(sub));
  }
  if (filters.grade) {
    const g = norm(filters.grade).replace(/\s/g, '');
    candidates = candidates.filter((s) =>
      norm(s.grade).replace(/\s/g, '').includes(g)
    );
  }

  if (!query || tokenize(query).length === 0) {
    return { total: candidates.length, items: candidates.slice(0, limit) };
  }

  const terms = tokenize(query);
  const scored = candidates
    .map((s) => {
      const fields: Field[] = [
        { text: norm(s.content), weight: 2 },
        { text: norm(s.subject), weight: 1.5 },
        { text: s.code.toLowerCase(), weight: 3 },
      ];
      return { s, score: scoreFields(fields, terms) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return { total: scored.length, items: scored.slice(0, limit).map((x) => x.s) };
}
