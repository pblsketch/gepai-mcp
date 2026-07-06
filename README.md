# gepai-mcp

**GEP-AI 환경교육 수업 설계 MCP 서버** — 별도 서비스 구독 없이, 이미 사용 중인 AI(Claude, Gemini, ChatGPT/Codex)에서 환경교육 수업을 설계하세요.

교육부 연구 사업으로 개발된 GEP-AI 플랫폼의 핵심 자산을 [MCP(Model Context Protocol)](https://modelcontextprotocol.io) 서버로 재포장했습니다. LLM 호출은 사용자의 AI가 수행하므로 **운영 비용 없이** 지속 가능한 구조입니다.

> **설계 철학 — '딸깍'이 아니라 대화.** GEP-AI의 목적은 버튼 한 번으로 어디에나 있을 법한 자료를 뽑아내는 것이 아닙니다. 교사와 AI가 질의응답을 주고받으며 아이디어를 심화·확장하고, **그 교사의 교실·학교·지역사회 맥락에 맞는** 환경 수업을 함께 설계하는 것입니다. 모든 프롬프트는 "한 번에 질문 하나, 선택지와 추천 제공, 요약 확인 후 생성" 원칙으로 이 철학을 강제합니다.

## 무엇이 들어있나

| 자산 | 규모 | 설명 |
|---|---|---|
| 성취기준 DB | 3,285건 | 2022 개정 교육과정 초·중·고 전 과목 성취기준 |
| 환경교육 자료 카탈로그 | 933건 | 전국 12개 시도교육청 자료 (교육부 자원맵) — 학교급·과목·환경주제·SDGs·성취기준 매핑 포함 |
| **원문 문서 카탈로그 + 전문 텍스트** | 1,113건 / 22,341청크 | 교육청 자료 PDF 원문 텍스트 — 본문 전문 검색(BM25) 및 문서 읽기 지원 |
| 배움의 수레바퀴 모형 | — | 이재영 교수의 환경교육 학습 모형 (4단계 + 4연결고리) |
| 수업 설계 절차 | — | GEP-AI 실서비스에서 검증된 9단계 설계 프롬프트 |

모든 데이터는 패키지에 내장되어 있어 **외부 DB·API 키가 필요 없습니다.**

### 내장 DB 상세

**① 성취기준 DB** (`standards.json`, 3,285건)

- 출처: 2022 개정 교육과정 (교육부 고시)
- 구성: 초등학교 653건 · 중학교 580건 · 고등학교 2,052건, 160개 과목
- 필드: `code`(성취기준 코드), `school`(학교급), `subject`(과목), `grade`(학년군), `content`(성취기준 내용)

**② 환경교육 자료 카탈로그** (`resources.json`, 933건)

- 출처: 교육부 자원맵 입력 데이터 — 12개 시도교육청
- 교육청별: 경기 254 · 충북 131 · 서울 121 · 광주 98 · 충남 65 · 대전 54 · 제주 49 · 경남 46 · 부산 40 · 인천 38 · 전남 32 · 경북 5
- 학교급: 초등 518 · 중등 332 · 고등 207 · 유치원 13 (자료당 복수 태그 가능)
- 자료유형(상위): 교사용 지도안+학생용 활동지 348 · 학생용 활동지 138 · 사례 모음 134 · 교사용 지도안 125
- 환경주제: 생활환경 458 · 지구환경 386 · 자연환경 373 · 환경문화 171 외
- 성취기준 연계: 838건 자료가 성취기준 2,837건을 참조 (①번 DB와 코드로 교차 조회 — `map_standard_to_resources`)
- 필드: `office`, `collection`(자료집), `title`(활동명), `materialType`, `activityTypes`, `schoolLevels`, `hours`(차시), `subjects`, `competencies`(환경교육역량), `place`, `envTopics`, `sdgs`, `methods`(교수학습방법), `standards[{code, text}]`
- 자료 **원문 파일은 포함되지 않습니다** — 메타데이터로 검색·추천하고 출처(교육청·자료집명)를 안내합니다.

**③ 원문 문서 카탈로그 + 전문 텍스트** (`documents.json` 1,113건 + `chunks.jsonl.br` 22,341청크)

- 출처: GEP-AI 실서비스 RAG 파이프라인 — 교육청 자료 PDF 1,113건을 문서 단위로 AI 메타데이터 강화(지역·학교급·과목·환경주제·SDGs·역량·교수법·시맨틱 키워드) 후 본문을 청크로 추출
- 지역: 14개 (경기 249 · 충북 144 · 서울 125 · 광주 98 등, "전국" 포함)
- 본문 텍스트: 청크 22,341건 (평균 686자, brotli 압축 7.7MB 내장) — `search_fulltext`로 본문 검색, `get_document_text`로 이어 읽기
- 정선 카탈로그(②)와 파일명 기준 742건 자동 연결 — 자료 상세에서 원문 텍스트로 바로 이동
- 필드: `fileName`, `region`, `schoolLevel`, `subjects`, `envTopics`, `sdgs`, `competencies`, `methods`, `resourceType`, `activityType`, `keywords`(AI 생성), `standards`, `resourceIds`

**④ 배움의 수레바퀴 모형** — 4단계·4연결고리 정의, 단계별 예시 활동, 차시 수별 권장 구성 (`gepai://learning-wheel` 리소스로도 제공)

## 도구 (Tools)

| 도구 | 설명 |
|---|---|
| `search_standards` | 성취기준 검색 (키워드·학교급·과목·학년군·코드) |
| `search_resources` | 환경교육 자료 검색 (키워드·학교급·과목·환경주제·SDGs·교육청) |
| `get_resource_detail` | 자료 상세 + 연계 성취기준 전문 + 원문 찾기 안내(sourceGuide) |
| `map_standard_to_resources` | 성취기준 코드 → 연계 자료 목록 |
| `search_fulltext` | **자료 원문 본문 검색** — 활동 방법·실험 절차·사례를 PDF 본문 텍스트에서 직접 검색 (BM25) |
| `get_document_text` | 원문 문서 읽기 — 검색으로 찾은 문서의 본문을 청크 단위로 이어 읽기 |
| `explore_topics` | 환경주제 지도 탐색 — 주제별 자료 수, 관련 주제·SDGs·성취기준·키워드 (몰랐던 자료 발견) |
| `related_resources` | 유사 자료 추천 — 공유 성취기준·주제·과목 근거 제시 |

## 프롬프트 (Prompts)

| 프롬프트 | 설명 |
|---|---|
| `design_lesson` | 배움의 수레바퀴 기반 수업 설계 전체 절차 (정보 수집 → 성취기준 → 자료 → 지도안 → 평가 → 활동지) |
| `context_interview` | **딸깍 방지 인터뷰** — 수업 의도·학생 맥락·교실/학교/지역 맥락·평가 증거·예상 오개념을 한 번에 하나씩 질문 |
| `local_pbl_coach` | 학교·지역사회의 실제 환경 문제 기반 프로젝트 학습(PBL) 설계 — driving question, 학생 역할·실제 청중, 과정 평가 |
| `reflect_lesson` | 수업 실행 후 증거 기반 성찰 — 반증 가능한 가설로 원인 진단, 다음 차시 최소 수정안 (수레바퀴의 다음 순환) |
| `lesson_brief` | 설계 대화를 한 페이지 브리프로 정리 (미확정 표시, 동료 공유·다음 AI 작업 인계용) |
| `learning_wheel_guide` | 배움의 수레바퀴 모형 해설 |

`context_interview`, `local_pbl_coach`, `reflect_lesson`, `lesson_brief`는 같은 제작자의 교사용 스킬팩 [k-teacher-skills](https://github.com/pblsketch/k-teacher-skills)의 검증된 인터뷰·설계 방법론을 환경교육에 맞게 이식한 것입니다.

## 설치

Node.js 18 이상이 필요합니다.

### Claude Code

```bash
claude mcp add gepai -- npx -y gepai-mcp
```

### Claude Desktop

`claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "gepai": {
      "command": "npx",
      "args": ["-y", "gepai-mcp"]
    }
  }
}
```

### Gemini CLI

`~/.gemini/settings.json`에 추가:

```json
{
  "mcpServers": {
    "gepai": {
      "command": "npx",
      "args": ["-y", "gepai-mcp"]
    }
  }
}
```

### Codex CLI

`~/.codex/config.toml`에 추가:

```toml
[mcp_servers.gepai]
command = "npx"
args = ["-y", "gepai-mcp"]
```

### Cursor

전역 `~/.cursor/mcp.json` 또는 프로젝트의 `.cursor/mcp.json`에 추가 (Cursor Settings → MCP → **Add new MCP Server** UI로도 가능):

```json
{
  "mcpServers": {
    "gepai": {
      "command": "npx",
      "args": ["-y", "gepai-mcp"]
    }
  }
}
```

### Google Antigravity (CLI · IDE)

Antigravity 제품군은 통합 MCP 설정 파일 하나를 CLI와 IDE가 공유합니다: `~/.gemini/config/mcp_config.json`

```json
{
  "mcpServers": {
    "gepai": {
      "command": "npx",
      "args": ["-y", "gepai-mcp"]
    }
  }
}
```

- **CLI**: 프로젝트 단위로 쓰려면 저장소 루트에 `.agents/mcp_config.json`을 두면 됩니다. 터미널에서 `/mcp` 명령으로 등록된 서버를 확인·관리할 수 있습니다.
- **IDE**: MCP 스토어 상단 **Manage MCP Servers** → **View raw config**로 같은 파일을 열어 편집할 수 있습니다.

> 위에 없는 도구라도 MCP를 지원한다면 같은 형식(`command: npx`, `args: [-y, gepai-mcp]`)으로 등록하면 됩니다.

## 사용 예

설치 후 AI에게 이렇게 말해보세요:

- "초등학교 5학년 기후변화 4차시 수업을 설계해줘" (또는 `design_lesson` 프롬프트 실행)
- "중학교 과학에서 생태계 관련 성취기준을 찾아줘"
- "플라스틱 주제로 쓸 수 있는 교육청 자료가 있어?"
- "[6과05-03] 성취기준과 연계된 자료를 보여줘"

## 원격(HTTP) 모드

조직 공용 서버로 띄우려면:

```bash
npx gepai-mcp --http --port 3737
# 헬스 체크: GET /healthz, MCP 엔드포인트: POST /
```

검색만 수행하고 LLM을 호출하지 않으므로 무료 티어 수준의 서버로 충분합니다.

## 개발

```bash
npm install        # 의존성 설치 (prepare에서 자동 빌드)
npm run build:data # data/source/*.csv → data/generated/*.json 재생성
npm run build      # TypeScript 컴파일
npm test           # 스모크 테스트 (MCP 클라이언트-서버 왕복)
```

```
data/source/     원본 CSV (성취기준, 자원맵 카탈로그)
data/generated/  빌드된 JSON (패키지에 번들, 커밋됨)
src/             MCP 서버 (도구·프롬프트·검색)
src/prompts/     수업 설계 절차 프롬프트
```

## 데이터 출처와 라이선스

- **코드**: MIT License
- **성취기준**: 2022 개정 교육과정 (교육부 고시) 공공 데이터
- **자료 카탈로그**: 교육부 자원맵 입력 데이터 기반 메타데이터. 자료 원문은 각 시도교육청에 저작권이 있으며, 이 서버는 메타데이터(제목·출처·분류)만 제공합니다.
- **배움의 수레바퀴 모형**: 이재영 교수의 학습 모형. 이 서버에는 모형의 구조 요약만 포함됩니다.

## 로드맵

- [x] npm 패키지 배포 (`npx gepai-mcp`) — [gepai-mcp@0.1.0](https://www.npmjs.com/package/gepai-mcp)
- [ ] 원격 MCP 배포 (Cloudflare Workers) — 교사가 URL 등록만으로 사용
- [x] 자료 원문 심층 검색 — v0.3.0: 원문 22,341청크 내장 BM25 전문 검색 (임베딩 불필요, 의미 재랭킹은 호출하는 AI가 수행)
- [x] 자료 원본 링크 1차 확보 — v0.4.0: 자료집 41개의 공식 페이지 URL(교육청 자료실·웹진·전자책, 전수 웹 검증) → 자료 517건·문서 487건에 연결. 나머지는 웹 미게시 자료가 다수(내부 자료실 전용·보도만 존재)로, 검증된 링크만 채택하고 미확보분은 검색 안내로 대체
- [ ] 원본 링크 커버리지 확대 (미게시 자료는 교육청 협조 필요)
- [ ] 플랫폼별 설치 가이드 (스크린샷 포함)

---

*GEP-AI: 교육부 환경교육 연구 사업의 결과물을 모두가 쓸 수 있는 형태로.*
