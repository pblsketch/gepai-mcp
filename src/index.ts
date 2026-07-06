#!/usr/bin/env node
/**
 * gepai-mcp 엔트리포인트
 *
 * 기본: stdio 트랜스포트 (Claude Desktop/Code, Gemini CLI, Codex CLI 등)
 * --http [--port N]: Streamable HTTP 트랜스포트 (원격/조직 공용 배포)
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer as createHttpServer } from 'node:http';
import { createServer, SERVER_VERSION } from './server.js';

const args = process.argv.slice(2);

if (args.includes('--version') || args.includes('-v')) {
  console.log(`gepai-mcp ${SERVER_VERSION}`);
  process.exit(0);
}

if (args.includes('--http')) {
  const portIdx = args.indexOf('--port');
  const port =
    portIdx >= 0 && args[portIdx + 1] ? Number(args[portIdx + 1]) : 3737;

  const httpServer = createHttpServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', server: 'gepai-mcp', version: SERVER_VERSION }));
        return;
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Method not allowed (stateless mode)' },
            id: null,
          })
        );
        return;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

      // stateless 모드: 요청마다 서버/트랜스포트 생성 (세션 불필요한 검색 서버라 적합)
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on('close', () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: `Internal error: ${String(err)}` },
            id: null,
          })
        );
      }
    }
  });

  httpServer.listen(port, () => {
    console.log(`gepai-mcp HTTP server listening on http://localhost:${port} (POST /)`);
  });
} else {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio 모드에서는 stdout이 프로토콜 채널이므로 로그는 stderr로만
  console.error(`gepai-mcp ${SERVER_VERSION} running on stdio`);
}
