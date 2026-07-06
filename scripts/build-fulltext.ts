/**
 * 전문 검색 데이터 빌드: rag_chunks 백업 → data/generated/chunks.jsonl.gz
 *
 * 입력(기본): e:/github/gepai2026/supabase-backup-20260706/rag_chunks.jsonl
 *   (인자로 다른 경로 지정 가능: npm run build:fulltext -- <path>)
 *
 * 출력 형식: 한 줄당 {d: 문서id(documents.json의 id), i: chunk_index, t: content}
 * 임베딩은 포함하지 않음 — 검색은 런타임 BM25 + 사용자 AI 재랭킹.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { brotliCompressSync, constants as zc } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const p = (...seg: string[]) => path.join(root, ...seg);

const chunksPath =
  process.argv[2] ??
  'e:/github/gepai2026/supabase-backup-20260706/rag_chunks.jsonl';

const documents = JSON.parse(
  readFileSync(p('data', 'generated', 'documents.json'), 'utf-8')
) as { id: number; uuid: string }[];

const docIdByUuid = new Map(documents.map((d) => [d.uuid, d.id]));

const lines = readFileSync(chunksPath, 'utf-8')
  .split('\n')
  .filter((l) => l.trim());

let kept = 0;
let dropped = 0;
const out: string[] = [];
for (const line of lines) {
  const c = JSON.parse(line) as {
    document_id: string;
    chunk_index: number;
    content: string | null;
  };
  const docId = docIdByUuid.get(c.document_id);
  const text = (c.content ?? '').trim();
  if (!docId || text.length < 20) {
    dropped++;
    continue;
  }
  out.push(JSON.stringify({ d: docId, i: c.chunk_index, t: text }));
  kept++;
}

if (kept < 20000) {
  throw new Error(`청크 수가 예상보다 적음: ${kept} (>20000 필요)`);
}

const raw = out.join('\n');
const br = brotliCompressSync(Buffer.from(raw, 'utf-8'), {
  params: { [zc.BROTLI_PARAM_QUALITY]: 11 },
});
writeFileSync(p('data', 'generated', 'chunks.jsonl.br'), br);

console.log('=== build-fulltext 완료 ===');
console.log(`청크: ${kept}건 유지, ${dropped}건 제외 (문서 미매칭/20자 미만)`);
console.log(`원본 ${(raw.length / 1e6).toFixed(1)} MB → brotli ${(br.length / 1e6).toFixed(1)} MB`);
