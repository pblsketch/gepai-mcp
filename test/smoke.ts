/**
 * 스모크 테스트: InMemory 트랜스포트로 MCP 클라이언트-서버 왕복 검증.
 * 실행: npm test
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';

let failures = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`PASS ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function firstText(result: { content?: unknown }): string {
  const content = (result as { content: { type: string; text?: string }[] })
    .content;
  const t = content?.find((c) => c.type === 'text');
  return t?.text ?? '';
}

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const server = createServer();
const client = new Client({ name: 'smoke-test', version: '0.0.0' });

await Promise.all([
  server.connect(serverTransport),
  client.connect(clientTransport),
]);

// 1. 도구 목록
const tools = await client.listTools();
const toolNames = tools.tools.map((t) => t.name).sort();
check(
  'tools: 4개 등록',
  toolNames.length === 4 &&
    JSON.stringify(toolNames) ===
      JSON.stringify([
        'get_resource_detail',
        'map_standard_to_resources',
        'search_resources',
        'search_standards',
      ]),
  `got: ${toolNames.join(', ')}`
);

// 2. 성취기준 검색
const std = await client.callTool({
  name: 'search_standards',
  arguments: { query: '생태계 보전', school_level: '초등학교' },
});
const stdJson = JSON.parse(firstText(std));
check(
  'search_standards: "생태계 보전" 초등 결과 존재',
  stdJson.total > 0 && stdJson.items[0].code?.length > 0,
  `total=${stdJson.total}`
);
check(
  'search_standards: 6과05-03 포함',
  stdJson.items.some((s: { code: string }) => s.code === '6과05-03'),
  `codes=${stdJson.items?.map((s: { code: string }) => s.code).join(',')}`
);

// 3. 코드 조회
const byCode = await client.callTool({
  name: 'search_standards',
  arguments: { code: '6과05-03' },
});
const byCodeJson = JSON.parse(firstText(byCode));
check(
  'search_standards: 코드 직접 조회',
  byCodeJson.total >= 1 && byCodeJson.items[0].content.includes('생태계'),
  JSON.stringify(byCodeJson.items?.[0])
);

// 4. 자료 검색 (키워드 + 필터)
const res = await client.callTool({
  name: 'search_resources',
  arguments: { query: '기후변화', school_level: '중학교', limit: 5 },
});
const resJson = JSON.parse(firstText(res));
check(
  'search_resources: "기후변화" 중학교 결과 존재',
  resJson.total > 0 && resJson.items.length <= 5,
  `total=${resJson.total}`
);

// 5. 필터만으로 검색
const filterOnly = await client.callTool({
  name: 'search_resources',
  arguments: { env_topic: '물환경', limit: 3 },
});
const filterJson = JSON.parse(firstText(filterOnly));
check('search_resources: 환경주제 필터만', filterJson.total > 0, `total=${filterJson.total}`);

// 6. 상세 조회
const firstId = resJson.items[0]?.id ?? 1;
const detail = await client.callTool({
  name: 'get_resource_detail',
  arguments: { id: firstId },
});
const detailJson = JSON.parse(firstText(detail));
check(
  'get_resource_detail: 상세 반환',
  detailJson.id === firstId && Array.isArray(detailJson.standards),
  `id=${detailJson.id}`
);

// 7. 성취기준 → 자료 매핑 (실데이터에서 연계 많은 코드 사용)
const linkedCode = detailJson.standards?.[0]?.code ?? '6과05-03';
const mapped = await client.callTool({
  name: 'map_standard_to_resources',
  arguments: { code: `[${linkedCode}]` },
});
const mappedJson = JSON.parse(firstText(mapped));
check(
  'map_standard_to_resources: 괄호 포함 코드 정규화 + 결과',
  mappedJson.code === linkedCode,
  JSON.stringify({ code: mappedJson.code, total: mappedJson.totalLinkedResources })
);

// 8. 프롬프트
const prompts = await client.listPrompts();
check(
  'prompts: design_lesson + learning_wheel_guide',
  prompts.prompts.length === 2,
  prompts.prompts.map((p) => p.name).join(',')
);
const dp = await client.getPrompt({
  name: 'design_lesson',
  arguments: { topic: '기후변화', school_level: '초등학교', sessions: '4' },
});
const dpText = (dp.messages[0].content as { text: string }).text;
check(
  'design_lesson: 인자 반영 + 수레바퀴 포함',
  dpText.includes('기후변화') && dpText.includes('배움의 수레바퀴'),
  `len=${dpText.length}`
);

// 9. 리소스
const resources = await client.listResources();
check(
  'resources: learning-wheel 등록',
  resources.resources.some((r) => r.uri === 'gepai://learning-wheel')
);
const wheelDoc = await client.readResource({ uri: 'gepai://learning-wheel' });
check(
  'resources: 모형 마크다운 반환',
  (wheelDoc.contents[0] as { text: string }).text.includes('4연결고리')
);

await client.close();
await server.close();

if (failures > 0) {
  console.error(`\n${failures}개 실패`);
  process.exit(1);
}
console.log('\n모든 스모크 테스트 통과');
