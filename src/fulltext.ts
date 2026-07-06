/**
 * 원문 전문 검색 (BM25, 인메모리).
 *
 * - 데이터: data/generated/chunks.jsonl.br (22,341 청크, PDF 1,112건에서 추출)
 * - 첫 검색 호출 시 lazy 로드·색인 (약 1~2초). 이후 쿼리는 수 ms.
 * - 임베딩 없음: 한국어 형태 변화는 "접두 확장"(물 → 물의/물순환…)으로 흡수하고,
 *   의미적 재랭킹은 결과를 읽는 사용자 AI의 몫으로 남긴다.
 */
import { readFileSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import type { Doc } from './types.js';
import { DOC_BY_ID, resolveDataFile } from './data.js';

interface ChunkRec {
  d: number; // document id
  i: number; // chunk index within document
  t: string; // text
}

const K1 = 1.2;
const B = 0.75;

let chunks: ChunkRec[] | null = null;
let postings: Map<string, [number, number][]> = new Map(); // token -> [chunkIdx, tf][]
let sortedTokens: string[] = [];
let chunkLens: number[] = [];
let avgLen = 1;
let chunksByDoc: Map<number, number[]> = new Map(); // docId -> chunkIdx[] (chunk_index 순)

function tokenizeRaw(text: string): string[] {
  const out: string[] = [];
  const re = /[가-힣]+|[a-zA-Z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[0].toLowerCase());
  }
  return out;
}

function ensureLoaded(): void {
  if (chunks) return;
  const raw = brotliDecompressSync(
    readFileSync(resolveDataFile('chunks.jsonl.br'))
  ).toString('utf-8');
  chunks = raw
    .split('\n')
    .filter((l) => l)
    .map((l) => JSON.parse(l) as ChunkRec);

  let totalLen = 0;
  for (let ci = 0; ci < chunks.length; ci++) {
    const c = chunks[ci];
    const tokens = tokenizeRaw(c.t);
    totalLen += tokens.length;
    chunkLens.push(tokens.length);

    const tf = new Map<string, number>();
    for (const tok of tokens) {
      if (tok.length < 2) continue; // 1글자 토큰은 색인 제외 (노이즈)
      tf.set(tok, (tf.get(tok) ?? 0) + 1);
    }
    for (const [tok, n] of tf) {
      const list = postings.get(tok);
      if (list) list.push([ci, n]);
      else postings.set(tok, [[ci, n]]);
    }

    const byDoc = chunksByDoc.get(c.d);
    if (byDoc) byDoc.push(ci);
    else chunksByDoc.set(c.d, [ci]);
  }
  avgLen = totalLen / chunks.length;
  for (const list of chunksByDoc.values()) {
    list.sort((a, b) => chunks![a].i - chunks![b].i);
  }
  sortedTokens = [...postings.keys()].sort();
}

/** 정렬된 토큰 배열에서 prefix로 시작하는 토큰들 (이진 탐색, cap 제한) */
function prefixTokens(prefix: string, cap: number): string[] {
  let lo = 0;
  let hi = sortedTokens.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedTokens[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  const out: string[] = [];
  for (let i = lo; i < sortedTokens.length && out.length < cap; i++) {
    if (!sortedTokens[i].startsWith(prefix)) break;
    out.push(sortedTokens[i]);
  }
  return out;
}

export interface FulltextHit {
  doc: Doc;
  chunkIndex: number;
  excerpt: string;
  score: number;
}

export function searchFulltext(
  query: string,
  docFilter: ((doc: Doc) => boolean) | null,
  limit: number,
  perDocCap = 2
): { totalChunks: number; hits: FulltextHit[] } {
  ensureLoaded();
  const N = chunks!.length;

  const qTerms = [...new Set(tokenizeRaw(query))];
  if (qTerms.length === 0) return { totalChunks: 0, hits: [] };

  // 질의어별 색인 토큰 확장: 정확 일치(1.0) + 접두 일치(0.5) + 어미 축약(0.7)
  const expansions: { token: string; weight: number }[] = [];
  const seen = new Set<string>();
  const add = (token: string, weight: number) => {
    if (seen.has(token) || !postings.has(token)) return;
    seen.add(token);
    expansions.push({ token, weight });
  };
  for (const term of qTerms) {
    add(term, 1.0);
    if (term.length >= 3) add(term.slice(0, -1), 0.7);
    const cap = term.length === 1 ? 30 : 40;
    if (term.length >= 1) {
      for (const tok of prefixTokens(term, cap)) add(tok, term.length === 1 ? 0.3 : 0.5);
    }
  }

  const scores = new Map<number, number>();
  for (const { token, weight } of expansions) {
    const list = postings.get(token)!;
    const df = list.length;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    for (const [ci, tf] of list) {
      const denom = tf + K1 * (1 - B + (B * chunkLens[ci]) / avgLen);
      const s = weight * idf * ((tf * (K1 + 1)) / denom);
      scores.set(ci, (scores.get(ci) ?? 0) + s);
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);

  const hits: FulltextHit[] = [];
  const perDoc = new Map<number, number>();
  let totalChunks = 0;
  for (const [ci, score] of ranked) {
    const c = chunks![ci];
    const doc = DOC_BY_ID.get(c.d);
    if (!doc) continue;
    if (docFilter && !docFilter(doc)) continue;
    totalChunks++;
    const used = perDoc.get(c.d) ?? 0;
    if (used >= perDocCap || hits.length >= limit) continue;
    perDoc.set(c.d, used + 1);
    hits.push({ doc, chunkIndex: c.i, excerpt: makeExcerpt(c.t, qTerms), score });
  }
  return { totalChunks, hits };
}

function makeExcerpt(text: string, qTerms: string[], span = 500): string {
  const lower = text.toLowerCase();
  let pos = -1;
  for (const t of qTerms) {
    const p = lower.indexOf(t);
    if (p >= 0 && (pos < 0 || p < pos)) pos = p;
  }
  if (pos < 0) pos = 0;
  const start = Math.max(0, pos - Math.floor(span / 3));
  const end = Math.min(text.length, start + span);
  const cleaned = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${cleaned}${end < text.length ? '…' : ''}`;
}

/** 문서의 연속 청크 원문 읽기 */
export function getDocumentChunks(
  docId: number,
  fromChunk: number,
  count: number
): { totalChunks: number; parts: { chunkIndex: number; text: string }[] } {
  ensureLoaded();
  const refs = chunksByDoc.get(docId) ?? [];
  const parts = refs
    .filter((ci) => chunks![ci].i >= fromChunk)
    .slice(0, count)
    .map((ci) => ({ chunkIndex: chunks![ci].i, text: chunks![ci].t }));
  return { totalChunks: refs.length, parts };
}
