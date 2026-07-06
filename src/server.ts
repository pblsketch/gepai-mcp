import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  RESOURCE_BY_ID,
  RESOURCES_BY_STANDARD,
  STANDARD_BY_CODE,
  RESOURCES,
  STANDARDS,
  DOCUMENTS,
  DOC_BY_ID,
  DOCS_BY_RESOURCE,
} from './data.js';
import { searchFulltext, getDocumentChunks } from './fulltext.js';
import { listTopics, exploreTopic, relatedItems } from './discovery.js';
import { searchResources, searchStandards } from './search.js';
import { renderWheelMarkdown } from './learning-wheel.js';
import { buildDesignLessonPrompt } from './prompts/design-lesson.js';
import { buildWheelGuidePrompt } from './prompts/learning-wheel-guide.js';
import { buildContextInterviewPrompt } from './prompts/context-interview.js';
import { buildLocalPblPrompt } from './prompts/local-pbl-coach.js';
import { buildReflectLessonPrompt } from './prompts/reflect-lesson.js';
import { buildLessonBriefPrompt } from './prompts/lesson-brief.js';
import type { Resource } from './types.js';

export const SERVER_VERSION = '0.3.0';

const SCHOOL_LEVELS = ['유치원', '초등학교', '중학교', '고등학교'] as const;

/** 목록 응답용 자료 요약 (성취기준 본문 제외로 토큰 절약) */
function resourceSummary(r: Resource) {
  return {
    id: r.id,
    office: r.office,
    collection: r.collection,
    title: r.title,
    materialType: r.materialType,
    schoolLevel: r.schoolLevelRaw,
    hours: r.hours || undefined,
    subjects: r.subjects,
    envTopics: r.envTopics,
    sdgs: r.sdgs,
    methods: r.methods,
    place: r.place || undefined,
    activityTypes: r.activityTypes,
    standardCodes: r.standards.map((s) => s.code),
  };
}

function jsonResult(data: unknown) {
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify(data, null, 2) },
    ],
  };
}

function clampLimit(limit: number | undefined, fallback = 10): number {
  if (!limit || Number.isNaN(limit)) return fallback;
  return Math.max(1, Math.min(30, Math.floor(limit)));
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'gepai-mcp',
    version: SERVER_VERSION,
  });

  // -------------------------------------------------------------------------
  // 도구 1: 환경교육 자료 검색
  // -------------------------------------------------------------------------
  server.registerTool(
    'search_resources',
    {
      title: '환경교육 자료 검색',
      description:
        `전국 시도교육청 환경교육 자료 ${RESOURCES.length}건(교육부 자원맵)에서 수업 자료를 검색합니다. ` +
        '키워드와 필터(학교급/과목/환경주제/SDGs/교육청/자료유형)를 조합할 수 있습니다. ' +
        '결과의 standardCodes는 해당 자료와 연계된 성취기준 코드입니다. ' +
        '상세 내용은 get_resource_detail로 조회하세요.',
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe('검색 키워드 (예: "기후변화 놀이", "플라스틱")'),
        school_level: z
          .enum(SCHOOL_LEVELS)
          .optional()
          .describe('학교급 필터'),
        subject: z.string().optional().describe('과목 필터 (예: "과학")'),
        env_topic: z
          .string()
          .optional()
          .describe(
            '환경주제 필터 (자연환경, 지구환경, 생활환경, 물환경, 환경문화 등)'
          ),
        sdg: z.string().optional().describe('SDGs 목표 필터 (예: "기후변화 대응")'),
        office: z.string().optional().describe('시도교육청 필터 (예: "서울")'),
        material_type: z
          .string()
          .optional()
          .describe('자료유형 필터 (예: "참고자료", "활동지")'),
        limit: z.number().optional().describe('최대 결과 수 (기본 10, 최대 30)'),
      },
    },
    async (args) => {
      const { total, items } = searchResources(
        args.query,
        {
          schoolLevel: args.school_level,
          subject: args.subject,
          envTopic: args.env_topic,
          sdg: args.sdg,
          office: args.office,
          materialType: args.material_type,
        },
        clampLimit(args.limit)
      );
      if (total === 0) {
        return jsonResult({
          total: 0,
          hint: '결과가 없습니다. 키워드를 줄이거나 필터를 완화해 보세요. 환경주제 필터 값 예시: 자연환경, 지구환경, 생활환경, 물환경, 환경문화, 인문사회환경, 지역환경',
        });
      }
      return jsonResult({
        total,
        showing: items.length,
        items: items.map(resourceSummary),
      });
    }
  );

  // -------------------------------------------------------------------------
  // 도구 2: 성취기준 검색
  // -------------------------------------------------------------------------
  server.registerTool(
    'search_standards',
    {
      title: '성취기준 검색',
      description:
        `2022 개정 교육과정 성취기준 ${STANDARDS.length}건(초·중·고 전 과목)에서 검색합니다. ` +
        '키워드(성취기준 내용), 학교급, 과목, 학년군, 코드로 검색할 수 있습니다. ' +
        '환경 수업 설계 시 관련 교과의 성취기준을 찾을 때 사용하세요.',
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe('내용 키워드 (예: "생태계 보전", "에너지")'),
        school_level: z
          .enum(['초등학교', '중학교', '고등학교'])
          .optional()
          .describe('학교급 필터'),
        subject: z.string().optional().describe('과목 필터 (예: "과학", "도덕")'),
        grade: z
          .string()
          .optional()
          .describe('학년군 필터 (예: "1~2학년", "5~6학년")'),
        code: z
          .string()
          .optional()
          .describe('성취기준 코드 (전체 또는 접두어, 예: "6과05" 또는 "6과05-03")'),
        limit: z.number().optional().describe('최대 결과 수 (기본 10, 최대 30)'),
      },
    },
    async (args) => {
      const { total, items } = searchStandards(
        args.query,
        {
          school: args.school_level,
          subject: args.subject,
          grade: args.grade,
          code: args.code,
        },
        clampLimit(args.limit)
      );
      if (total === 0) {
        return jsonResult({
          total: 0,
          hint: '결과가 없습니다. 키워드를 바꾸거나 필터를 완화해 보세요.',
        });
      }
      return jsonResult({ total, showing: items.length, items });
    }
  );

  // -------------------------------------------------------------------------
  // 도구 3: 자료 상세 조회
  // -------------------------------------------------------------------------
  server.registerTool(
    'get_resource_detail',
    {
      title: '자료 상세 조회',
      description:
        '자료 id로 상세 정보를 조회합니다. 연계 성취기준의 전체 내용(자료 원문 표기 + 2022 개정 교육과정 DB 대조)을 포함합니다.',
      inputSchema: {
        id: z.number().describe('search_resources가 반환한 자료 id'),
      },
    },
    async ({ id }) => {
      const r = RESOURCE_BY_ID.get(id);
      if (!r) {
        return jsonResult({
          error: `id ${id} 자료를 찾을 수 없습니다 (유효 범위: 1~${RESOURCES.length}).`,
        });
      }
      const linkedDocs = DOCS_BY_RESOURCE.get(id) ?? [];
      const searchQuery = `${r.office}교육청 ${r.collection}`;
      return jsonResult({
        ...r,
        standards: r.standards.map((ref) => {
          const official = STANDARD_BY_CODE.get(ref.code);
          return {
            code: ref.code,
            textInResource: ref.text,
            official2022: official
              ? {
                  school: official.school,
                  subject: official.subject,
                  grade: official.grade,
                  content: official.content,
                }
              : '(2022 개정 성취기준 DB에 없음 — 2015 개정 등 이전 교육과정 코드일 수 있음)',
          };
        }),
        fulltextDocumentIds: linkedDocs.map((d) => d.id),
        sourceGuide: {
          note: '자료 원문 파일은 패키지에 포함되지 않습니다.',
          fulltext: linkedDocs.length
            ? `이 자료의 원문 텍스트가 연결되어 있습니다 — get_document_text(document_id: ${linkedDocs[0].id})로 본문을 읽을 수 있습니다.`
            : 'search_fulltext로 제목·주제 키워드를 검색하면 관련 원문을 찾을 수 있습니다.',
          findOriginal: `${r.office}교육청 자료실에서 "${r.collection}"을(를) 검색하세요.`,
          webSearchUrl:
            'https://www.google.com/search?q=' + encodeURIComponent(searchQuery),
        },
      });
    }
  );

  // -------------------------------------------------------------------------
  // 도구 4: 성취기준 → 연계 자료 매핑
  // -------------------------------------------------------------------------
  server.registerTool(
    'map_standard_to_resources',
    {
      title: '성취기준 연계 자료 찾기',
      description:
        '성취기준 코드를 주면 그 성취기준과 연계된 환경교육 자료 목록을 반환합니다. ' +
        '수업에서 다룰 성취기준을 확정한 뒤, 바로 활용할 수 있는 자료를 찾을 때 사용하세요.',
      inputSchema: {
        code: z
          .string()
          .describe('성취기준 코드 (예: "6과05-03" 또는 "[6과05-03]")'),
        limit: z.number().optional().describe('최대 결과 수 (기본 10, 최대 30)'),
      },
    },
    async ({ code, limit }) => {
      const normalized = code.replace(/[\[\]]/g, '').trim();
      const standard = STANDARD_BY_CODE.get(normalized) ?? null;
      const linked = RESOURCES_BY_STANDARD.get(normalized) ?? [];
      const max = clampLimit(limit);
      return jsonResult({
        code: normalized,
        standard:
          standard ??
          '(2022 개정 성취기준 DB에 없는 코드 — 코드 오타이거나 이전 교육과정일 수 있음)',
        totalLinkedResources: linked.length,
        items: linked.slice(0, max).map(resourceSummary),
        hint:
          linked.length === 0
            ? '직접 연계된 자료가 없습니다. search_resources로 성취기준의 핵심 키워드를 검색해 보세요.'
            : undefined,
      });
    }
  );

  // -------------------------------------------------------------------------
  // 도구 5: 원문 전문 검색
  // -------------------------------------------------------------------------
  server.registerTool(
    'search_fulltext',
    {
      title: '원문 전문 검색',
      description:
        `전국 시도교육청 환경교육 자료 PDF ${DOCUMENTS.length}건의 원문 텍스트(약 2.2만 청크)에서 본문 내용을 검색합니다. ` +
        '메타데이터 검색(search_resources)으로 찾기 어려운 구체적 활동 방법, 실험 절차, 개념 설명, 사례를 찾을 때 사용하세요. ' +
        '발췌가 잘려 있으면 get_document_text로 해당 문서의 전체 맥락을 이어 읽으세요. 첫 호출은 색인 구축으로 1~2초 걸립니다.',
      inputSchema: {
        query: z.string().describe('본문 검색 키워드 (예: "탄소발자국 계산 활동")'),
        region: z.string().optional().describe('지역/교육청 필터 (예: "경기", "전국")'),
        school_level: z
          .enum(SCHOOL_LEVELS)
          .optional()
          .describe('학교급 필터'),
        subject: z.string().optional().describe('과목 필터'),
        limit: z.number().optional().describe('최대 결과 수 (기본 8, 최대 20)'),
      },
    },
    async (args) => {
      const lim = Math.max(1, Math.min(20, Math.floor(args.limit ?? 8)));
      const filter =
        args.region || args.school_level || args.subject
          ? (doc: (typeof DOCUMENTS)[number]) => {
              if (args.region && !doc.region.includes(args.region)) return false;
              if (args.school_level && !doc.schoolLevel.includes(args.school_level))
                return false;
              if (
                args.subject &&
                !doc.subjects.some((s) => s.includes(args.subject!))
              )
                return false;
              return true;
            }
          : null;
      const { totalChunks, hits } = searchFulltext(args.query, filter, lim);
      if (hits.length === 0) {
        return jsonResult({
          total: 0,
          hint: '결과가 없습니다. 키워드를 더 일반적인 표현으로 바꾸거나 필터를 제거해 보세요.',
        });
      }
      return jsonResult({
        totalMatchingChunks: totalChunks,
        showing: hits.length,
        items: hits.map((h) => ({
          documentId: h.doc.id,
          fileName: h.doc.fileName,
          region: h.doc.region,
          schoolLevel: h.doc.schoolLevel,
          subjects: h.doc.subjects,
          resourceType: h.doc.resourceType,
          chunkIndex: h.chunkIndex,
          excerpt: h.excerpt,
        })),
        hint: '더 읽으려면 get_document_text(document_id, from_chunk)를 호출하세요.',
      });
    }
  );

  // -------------------------------------------------------------------------
  // 도구 6: 원문 문서 읽기
  // -------------------------------------------------------------------------
  server.registerTool(
    'get_document_text',
    {
      title: '원문 문서 읽기',
      description:
        '원문 문서의 메타데이터와 본문 텍스트를 연속 청크 단위로 읽습니다. search_fulltext가 반환한 documentId로 호출하세요. ' +
        'count 기본 5청크(약 3~4천 자), 최대 10청크씩 from_chunk를 늘려가며 이어 읽을 수 있습니다.',
      inputSchema: {
        document_id: z.number().describe('문서 id (search_fulltext 결과의 documentId)'),
        from_chunk: z.number().optional().describe('시작 청크 번호 (기본 0)'),
        count: z.number().optional().describe('읽을 청크 수 (기본 5, 최대 10)'),
      },
    },
    async ({ document_id, from_chunk, count }) => {
      const doc = DOC_BY_ID.get(document_id);
      if (!doc) {
        return jsonResult({
          error: `document_id ${document_id}를 찾을 수 없습니다 (유효 범위: 1~${DOCUMENTS.length}).`,
        });
      }
      const c = Math.max(1, Math.min(10, Math.floor(count ?? 5)));
      const { totalChunks, parts } = getDocumentChunks(
        document_id,
        Math.max(0, Math.floor(from_chunk ?? 0)),
        c
      );
      return jsonResult({
        document: {
          id: doc.id,
          fileName: doc.fileName,
          region: doc.region,
          schoolLevel: doc.schoolLevel,
          subjects: doc.subjects,
          envTopics: doc.envTopics,
          sdgs: doc.sdgs,
          resourceType: doc.resourceType,
          activityType: doc.activityType,
          keywords: doc.keywords,
          standards: doc.standards,
          linkedResourceIds: doc.resourceIds,
        },
        totalChunks,
        parts,
        sourceGuide: `원문 PDF는 ${doc.region || '해당'} 교육청 자료실에서 "${doc.fileName.replace(/\.pdf$/i, '').replace(/_\d+$/, '')}"으로 검색하세요.`,
      });
    }
  );

  // -------------------------------------------------------------------------
  // 도구 7: 환경주제 탐색
  // -------------------------------------------------------------------------
  server.registerTool(
    'explore_topics',
    {
      title: '환경주제 탐색',
      description:
        '환경주제 지도를 탐색합니다. topic 없이 호출하면 전체 주제 목록과 자료 수를, topic을 주면 관련 주제·SDGs·역량·과목·대표 성취기준·연관 키워드·추천 자료를 보여줍니다. ' +
        '교사가 무엇이 있는지 둘러보거나 수업 아이디어를 확장할 때 사용하세요.',
      inputSchema: {
        topic: z
          .string()
          .optional()
          .describe('탐색할 환경주제 (예: "자원순환", "생태전환"). 생략 시 전체 목록'),
      },
    },
    async ({ topic }) => {
      if (!topic || !topic.trim()) {
        return jsonResult({
          topics: listTopics(),
          hint: 'topic 인자로 특정 주제를 탐색하세요.',
        });
      }
      const result = exploreTopic(topic.trim());
      if (result.matched.resources === 0 && result.matched.documents === 0) {
        return jsonResult({
          topic,
          matched: result.matched,
          hint: '이 주제로 태깅된 자료가 없습니다. explore_topics()로 전체 주제 목록을 확인하거나 search_fulltext로 본문 검색을 해보세요.',
        });
      }
      return jsonResult(result);
    }
  );

  // -------------------------------------------------------------------------
  // 도구 8: 유사 자료 추천
  // -------------------------------------------------------------------------
  server.registerTool(
    'related_resources',
    {
      title: '유사 자료 추천',
      description:
        '특정 자료(resource_id) 또는 원문 문서(document_id)와 유사한 자료를 근거(공유 성취기준·주제·과목)와 함께 추천합니다. ' +
        '교사가 어떤 자료를 마음에 들어 하며 "비슷한 것 더"를 원할 때 사용하세요.',
      inputSchema: {
        resource_id: z
          .number()
          .optional()
          .describe('기준 자료 id (search_resources 결과)'),
        document_id: z
          .number()
          .optional()
          .describe('기준 문서 id (search_fulltext 결과)'),
        limit: z.number().optional().describe('최대 추천 수 (기본 8, 최대 20)'),
      },
    },
    async ({ resource_id, document_id, limit }) => {
      const lim = Math.max(1, Math.min(20, Math.floor(limit ?? 8)));
      const result = relatedItems(
        { resourceId: resource_id, documentId: document_id },
        lim
      );
      return jsonResult(result);
    }
  );

  // -------------------------------------------------------------------------
  // 프롬프트
  // -------------------------------------------------------------------------
  server.registerPrompt(
    'design_lesson',
    {
      title: '배움의 수레바퀴 수업 설계',
      description:
        '배움의 수레바퀴 모형에 따라 환경교육 수업(지도안·평가·활동지)을 설계하는 전체 절차를 시작합니다.',
      argsSchema: {
        topic: z.string().optional().describe('수업 주제 (예: "기후변화")'),
        school_level: z
          .string()
          .optional()
          .describe('학교급 (초등학교/중학교/고등학교)'),
        grade: z.string().optional().describe('학년 (예: "3학년")'),
        sessions: z.string().optional().describe('차시 수 (예: "4")'),
      },
    },
    (args) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: buildDesignLessonPrompt(args),
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'context_interview',
    {
      title: '맥락 인터뷰 (딸깍 방지)',
      description:
        '자료를 바로 만들지 않고 수업 의도·학생 맥락·교실/학교/지역 맥락·평가 증거·예상 오개념을 한 번에 하나씩 질문하는 인터뷰를 시작합니다. 수업 설계 전 공유된 이해를 만들 때 사용하세요.',
      argsSchema: {
        topic: z.string().optional().describe('환경 주제 (예: "기후변화")'),
        school_level: z.string().optional().describe('학교급'),
      },
    },
    (args) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: buildContextInterviewPrompt(args),
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'local_pbl_coach',
    {
      title: '학교·지역 환경 PBL 코치',
      description:
        '학교와 지역사회의 실제 환경 문제를 기반으로 driving question, 학생 역할·청중, 프로젝트 흐름, 과정 평가가 연결된 프로젝트 학습(PBL)을 설계합니다.',
      argsSchema: {
        problem: z
          .string()
          .optional()
          .describe('잠정 문제 (예: "급식 음식물 쓰레기")'),
        school_level: z.string().optional().describe('학교급'),
        region: z.string().optional().describe('지역/시도 (예: "충북")'),
      },
    },
    (args) => ({
      messages: [
        {
          role: 'user' as const,
          content: { type: 'text' as const, text: buildLocalPblPrompt(args) },
        },
      ],
    })
  );

  server.registerPrompt(
    'reflect_lesson',
    {
      title: '수업 성찰·다음 차시 개선',
      description:
        '실행한 수업이 기대와 달랐을 때, 관찰 가능한 증거로 원인을 진단하고(반증 가능한 가설) 다음 차시의 최소 수정안을 만듭니다. 수레바퀴의 다음 순환을 준비합니다.',
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: { type: 'text' as const, text: buildReflectLessonPrompt() },
        },
      ],
    })
  );

  server.registerPrompt(
    'lesson_brief',
    {
      title: '수업 설계 브리프 정리',
      description:
        '지금까지의 설계 대화를 새 질문 없이 한 페이지 브리프로 정리합니다 (미확정 항목 표시, 동료 공유·다음 AI 작업 인계용).',
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: { type: 'text' as const, text: buildLessonBriefPrompt() },
        },
      ],
    })
  );

  server.registerPrompt(
    'learning_wheel_guide',
    {
      title: '배움의 수레바퀴 모형 안내',
      description:
        "환경교육 학습 모형 '배움의 수레바퀴'(4단계 + 4연결고리)의 구조와 활용법을 설명합니다.",
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: { type: 'text' as const, text: buildWheelGuidePrompt() },
        },
      ],
    })
  );

  // -------------------------------------------------------------------------
  // 리소스
  // -------------------------------------------------------------------------
  server.registerResource(
    'learning-wheel',
    'gepai://learning-wheel',
    {
      title: '배움의 수레바퀴 모형',
      description: '4단계 + 4연결고리 학습 모형 요약',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: renderWheelMarkdown(),
        },
      ],
    })
  );

  return server;
}
