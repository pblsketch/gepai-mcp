# gepai-mcp

**GEP-AI 환경교육 수업 설계 MCP 서버** — 별도 서비스 구독 없이, 이미 사용 중인 AI(Claude, Gemini, ChatGPT/Codex)에서 환경교육 수업을 설계하세요.

교육부 연구 사업으로 개발된 GEP-AI 플랫폼의 핵심 자산을 [MCP(Model Context Protocol)](https://modelcontextprotocol.io) 서버로 재포장했습니다. LLM 호출은 사용자의 AI가 수행하므로 **운영 비용 없이** 지속 가능한 구조입니다.

## 무엇이 들어있나

| 자산 | 규모 | 설명 |
|---|---|---|
| 성취기준 DB | 3,285건 | 2022 개정 교육과정 초·중·고 전 과목 성취기준 |
| 환경교육 자료 카탈로그 | 933건 | 전국 12개 시도교육청 자료 (교육부 자원맵) — 학교급·과목·환경주제·SDGs·성취기준 매핑 포함 |
| 배움의 수레바퀴 모형 | — | 이재영 교수의 환경교육 학습 모형 (4단계 + 4연결고리) |
| 수업 설계 절차 | — | GEP-AI 실서비스에서 검증된 9단계 설계 프롬프트 |

모든 데이터는 패키지에 내장되어 있어 **외부 DB·API 키가 필요 없습니다.**

## 도구 (Tools)

| 도구 | 설명 |
|---|---|
| `search_standards` | 성취기준 검색 (키워드·학교급·과목·학년군·코드) |
| `search_resources` | 환경교육 자료 검색 (키워드·학교급·과목·환경주제·SDGs·교육청) |
| `get_resource_detail` | 자료 상세 + 연계 성취기준 전문 |
| `map_standard_to_resources` | 성취기준 코드 → 연계 자료 목록 |

## 프롬프트 (Prompts)

| 프롬프트 | 설명 |
|---|---|
| `design_lesson` | 배움의 수레바퀴 기반 수업 설계 전체 절차 (정보 수집 → 성취기준 → 자료 → 지도안 → 평가 → 활동지) |
| `learning_wheel_guide` | 배움의 수레바퀴 모형 해설 |

## 설치

Node.js 18 이상이 필요합니다.

### Claude Code

```bash
claude mcp add gepai -- npx -y github:pblsketch/gepai-mcp
```

### Claude Desktop

`claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "gepai": {
      "command": "npx",
      "args": ["-y", "github:pblsketch/gepai-mcp"]
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
      "args": ["-y", "github:pblsketch/gepai-mcp"]
    }
  }
}
```

### Codex CLI

`~/.codex/config.toml`에 추가:

```toml
[mcp_servers.gepai]
command = "npx"
args = ["-y", "github:pblsketch/gepai-mcp"]
```

> npm 배포 후에는 `github:pblsketch/gepai-mcp` 대신 `gepai-mcp`를 사용할 수 있습니다.

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

- [ ] npm 패키지 배포 (`npx gepai-mcp`)
- [ ] 원격 MCP 배포 (Cloudflare Workers) — 교사가 URL 등록만으로 사용
- [ ] 자료 원문 PDF 심층 검색 (사전 임베딩 + 로컬 벡터 검색)
- [ ] 플랫폼별 설치 가이드 (스크린샷 포함)

---

*GEP-AI: 교육부 환경교육 연구 사업의 결과물을 모두가 쓸 수 있는 형태로.*
