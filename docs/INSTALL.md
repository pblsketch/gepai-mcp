# GEP-AI MCP 설치 가이드 — 누구나 따라하기

이 문서는 **개발자가 아닌 분(선생님!)도 그대로 따라할 수 있도록** 화면 순서대로 안내합니다.
각 플랫폼의 공식 문서([Claude Desktop](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) · [OpenAI Codex](https://developers.openai.com/codex/mcp) · [Google Antigravity](https://antigravity.google/docs/mcp))를 기준으로 작성했습니다.

---

## 0. 어떤 방법을 골라야 하나요?

방법은 딱 두 가지입니다.

| 나는… | 추천 방법 |
|---|---|
| Claude나 ChatGPT를 **웹사이트/앱으로** 쓴다 | **방법 A — URL 등록** (5분, 아무것도 설치 안 함) ⭐ |
| Claude Code, Codex, Gemini CLI, Antigravity, Cursor 같은 **개발 도구**를 쓴다 | **방법 B — 내 컴퓨터에 설치** (Node.js 필요) |

> 헷갈리면 **방법 A**부터 시도하세요. 컴퓨터에 아무것도 설치하지 않고, 주소 한 줄만 등록하면 끝납니다.

---

## 방법 A — URL만 등록하기 (설치 없음) ⭐

등록할 주소는 하나뿐입니다. 복사해 두세요:

```
https://gepai-mcp.vercel.app
```

### A-1. Claude (claude.ai 웹 · 데스크톱 앱)

1. 왼쪽 아래 프로필 → **설정(Settings)** 을 엽니다.
2. **커넥터(Connectors)** 메뉴로 갑니다.
3. **커스텀 커넥터 추가(Add custom connector)** 를 누릅니다.
4. 이름에 `gepai`, 원격 MCP 서버 URL에 `https://gepai-mcp.vercel.app` 을 입력하고 **추가**.
5. 채팅창의 **＋ 버튼 → 커넥터** 목록에 `gepai`가 보이면 성공입니다.

> 요금제나 버전에 따라 커스텀 커넥터 메뉴가 보이지 않을 수 있습니다. 그 경우 아래 **방법 B의 Claude Desktop** 절차를 사용하세요.

### A-2. ChatGPT

1. **설정 → 커넥터(Connectors)** 로 갑니다.
2. **고급(Advanced) → 개발자 모드(Developer mode)** 를 켭니다.
3. **만들기(Create)** 를 누르고 이름 `gepai`, URL `https://gepai-mcp.vercel.app` 을 입력합니다.
4. 채팅에서 커넥터를 켠 뒤 사용하면 됩니다.

> 개발자 모드는 요금제·지역에 따라 제공 여부가 다를 수 있습니다.

### A-3. Google Antigravity (IDE · CLI 공통)

설정 파일 `~/.gemini/config/mcp_config.json` 하나를 IDE와 CLI가 함께 사용합니다. 파일을 열어(없으면 새로 만들어) 아래를 넣으세요:

```json
{
  "mcpServers": {
    "gepai": {
      "serverUrl": "https://gepai-mcp.vercel.app"
    }
  }
}
```

> ⚠️ 원격 서버 키는 반드시 **`serverUrl`** 이어야 합니다. 공식 문서에 따르면 `url`, `httpUrl` 키는 지원하지 않습니다.

### A-4. Gemini CLI

`~/.gemini/settings.json` 의 `mcpServers` 에 추가:

```json
{
  "mcpServers": {
    "gepai": {
      "httpUrl": "https://gepai-mcp.vercel.app"
    }
  }
}
```

> Gemini CLI는 Antigravity와 반대로 `httpUrl` 키를 씁니다. 헷갈리기 쉬우니 주의!

---

## 방법 B — 내 컴퓨터에 설치하기

### 준비물: Node.js 18 이상 (딱 한 번만)

1. [nodejs.org](https://nodejs.org/ko) 에서 **LTS** 버전을 내려받아 설치합니다. (계속 → 계속 → 완료)
2. 설치 확인 — 터미널(Windows: `Win + R` → `cmd` → Enter)에서:

```
node --version
```

`v18` 이상 숫자가 나오면 준비 끝입니다.

> 설치 명령은 모든 플랫폼에서 동일하게 `npx -y gepai-mcp` 입니다. 별도 다운로드 없이 실행 시 자동으로 최신 버전을 받아옵니다.

### B-1. Claude Code

터미널에 한 줄:

```bash
claude mcp add gepai -- npx -y gepai-mcp
```

**확인:** `claude` 실행 후 `/mcp` 를 입력하면 `gepai` 서버와 도구 8종이 보입니다.

### B-2. Claude Desktop

> 공식 문서 기준 요즘 Claude Desktop의 기본 설치 방식은 **확장(Extensions, .mcpb 파일)** 입니다(설정 → 확장). gepai는 아직 확장 패키지가 없으므로, 위 **방법 A(커스텀 커넥터)** 가 가장 쉽고, 로컬 설치를 원하면 아래처럼 설정 파일을 편집합니다.

1. Claude Desktop → **설정 → 개발자(Developer) → 설정 편집(Edit Config)** 을 누르면 설정 파일 위치가 열립니다.
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json` (`Win + R` → `%APPDATA%\Claude` 로도 이동 가능)
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
2. 파일을 메모장 등으로 열어 아래 내용을 넣습니다 (파일이 비어 있을 때 전체 내용):

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

3. Claude Desktop을 **완전히 종료**(Windows는 작업 표시줄 트레이 아이콘에서 종료)한 뒤 다시 실행합니다.
4. **확인:** 채팅창 아래 도구(🔧/⚙) 아이콘을 눌렀을 때 `gepai` 가 보이면 성공입니다.

### B-3. OpenAI Codex (CLI · IDE 확장)

**CLI — 터미널에 한 줄** (공식 문서의 `codex mcp add` 명령):

```bash
codex mcp add gepai -- npx -y gepai-mcp
```

또는 `~/.codex/config.toml` 에 직접 추가:

```toml
[mcp_servers.gepai]
command = "npx"
args = ["-y", "gepai-mcp"]
```

**IDE 확장:** 톱니바퀴(⚙) 메뉴 → **MCP settings → Open config.toml** 로 같은 파일을 열어 편집합니다.

**확인:** `codex` 실행 후 `/mcp` 를 입력하면 연결된 서버가 보입니다.

### B-4. Gemini CLI

`~/.gemini/settings.json` 의 `mcpServers` 에 추가:

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

**확인:** `gemini` 실행 후 `/mcp`.

### B-5. Google Antigravity (IDE · CLI)

전역 설정 파일 `~/.gemini/config/mcp_config.json` (IDE·CLI 공유)에 추가:

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

- **IDE에서 열려면:** 에이전트 사이드 패널 상단 **"…" → MCP Servers → Manage MCP Servers → View raw config**. (Antigravity 2.0: **Settings → Customizations → Installed MCP Servers → Add MCP**)
- **프로젝트 단위로만 쓰려면:** 저장소 루트에 `.agents/mcp_config.json` 을 만들면 됩니다.
- **확인:** 프롬프트 창에 `/mcp` 를 입력하면 서버 상태와 연결 로그를 보는 MCP 관리 화면이 뜹니다.

### B-6. Cursor

전역 `~/.cursor/mcp.json` 또는 프로젝트의 `.cursor/mcp.json` 에 추가 (**Cursor Settings → MCP → Add new MCP Server** UI로도 가능):

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

---

## 설치가 잘 됐는지 확인하기

어느 플랫폼이든, AI에게 이렇게 물어보세요:

> "중학교 과학에서 생태계 관련 성취기준을 gepai로 찾아줘"

성취기준 코드(예: `[9과…]`)가 붙은 검색 결과가 나오면 성공입니다. 이어서 이렇게 써보세요:

- "초등학교 5학년 기후변화 4차시 수업을 설계해줘"
- "플라스틱 주제로 쓸 수 있는 교육청 자료가 있어?"
- "그 자료 원문에서 실험 절차를 찾아줘"

---

## 문제 해결 (FAQ)

**Q. 설정 파일에 이미 다른 서버가 들어 있어요.**
기존 `mcpServers` 괄호 안에 쉼표로 이어 붙이면 됩니다:

```json
{
  "mcpServers": {
    "기존서버": { "...": "..." },
    "gepai": {
      "command": "npx",
      "args": ["-y", "gepai-mcp"]
    }
  }
}
```

**Q. 저장했는데 목록에 안 나와요.**
① 앱/CLI를 완전히 종료 후 재시작했는지 확인하세요(특히 Claude Desktop은 트레이에서 종료). ② JSON 문법 오류(쉼표 누락, 괄호 짝)가 가장 흔한 원인입니다. 파일 내용을 AI에게 붙여 넣고 "문법 오류 찾아줘"라고 해도 됩니다.

**Q. Windows에서 서버가 시작되지 않아요 (`npx` 를 찾을 수 없음).**
일부 Windows 환경에서는 `npx` 를 직접 실행하지 못합니다. `command` 를 이렇게 바꿔보세요:

```json
"gepai": {
  "command": "cmd",
  "args": ["/c", "npx", "-y", "gepai-mcp"]
}
```

**Q. `node --version` 이 안 돼요.**
Node.js가 설치되지 않은 것입니다. [nodejs.org](https://nodejs.org/ko)에서 LTS를 설치한 뒤 터미널을 **새로 열어** 다시 확인하세요. Node.js 설치가 어려운 환경이라면 **방법 A(URL 등록)** 를 사용하세요 — 설치가 전혀 필요 없습니다.

**Q. 학교/기관 네트워크에서 원격 URL이 차단돼요.**
반대로 이 경우엔 **방법 B(로컬 설치)** 를 사용하세요. 데이터가 전부 패키지에 내장되어 있어 설치 후에는 외부 접속 없이 동작합니다(최초 `npx` 다운로드만 인터넷 필요).

**Q. API 키가 필요한가요?**
아니요. 이 서버는 검색만 수행하고 LLM 호출은 여러분이 쓰는 AI가 합니다. 외부 DB·API 키가 전혀 필요 없습니다.

---

문제가 계속되면 [GitHub Issues](https://github.com/pblsketch/gepai-mcp/issues)에 사용 중인 플랫폼과 오류 메시지를 남겨 주세요.
