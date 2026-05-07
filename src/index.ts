import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { buildAuditKit } from "./kit.js";
import { SKILL_TEXT, CHECKLIST_TEXT } from "./content.js";
import { getSection, knownSectionIds } from "./checklist-index.js";

const SERVER_NAME = "ai-security-review";
const SERVER_VERSION = "1.0.0";

export class SecurityReviewMCP extends McpAgent {
  server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  async init() {
    this.server.registerTool(
      "start_security_audit",
      {
        title: "Start AI security audit",
        description:
          "Begin an AI pre-launch security audit on the user's current project. " +
          "Returns the AI Integration Lead skill instructions plus the full " +
          "reference checklist, with a directive to perform Step 1 (scope the " +
          "project) using your own filesystem/repo tools before producing findings.",
        inputSchema: {
          project_hint: z
            .string()
            .max(500)
            .optional()
            .describe(
              "Optional one-line note from the user about what the project is " +
                "(e.g. 'Next.js app with one Gemini API route'). Helps anchor the audit."
            ),
          depth: z
            .enum(["quick", "full"])
            .optional()
            .describe(
              "'full' (default) runs the full audit format. 'quick' returns " +
                "only verdict + top 3 findings + inaccessible list."
            ),
        },
      },
      async ({ project_hint, depth }) => ({
        content: [
          {
            type: "text",
            text: buildAuditKit({ projectHint: project_hint, depth }),
          },
        ],
      })
    );

    this.server.registerTool(
      "get_checklist_section",
      {
        title: "Get checklist section",
        description:
          "Return a single domain or item from the AI security checklist. Use " +
          "this when you want to fetch one slice at a time during a long audit " +
          "instead of loading the whole checklist into context. Accepts a " +
          "domain id like '4' or an item id like '4.4'.",
        inputSchema: {
          section_id: z
            .string()
            .regex(/^\d+(\.\d+)?$/)
            .describe(
              "Section identifier. Examples: '1' (whole Inputs domain), " +
                "'1.1' (single item), '4.4' (single item)."
            ),
        },
      },
      async ({ section_id }) => {
        const body = getSection(section_id);
        if (!body) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text:
                  `Unknown section_id '${section_id}'. ` +
                  `Known ids: ${knownSectionIds().join(", ")}`,
              },
            ],
          };
        }
        return { content: [{ type: "text", text: body }] };
      }
    );

    this.server.registerPrompt(
      "security-review",
      {
        title: "AI security review",
        description:
          "Run an AI Integration Lead pre-launch security audit on the current " +
          "project. Loads the skill + checklist and starts at Step 1 (scope).",
        argsSchema: {
          project_hint: z.string().max(500).optional(),
          depth: z.enum(["quick", "full"]).optional(),
        },
      },
      ({ project_hint, depth }) => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: buildAuditKit({ projectHint: project_hint, depth }),
            },
          },
        ],
      })
    );

    this.server.registerResource(
      "skill",
      "skill://ai-integration-lead",
      {
        title: "AI Integration Lead skill",
        description:
          "The audit skill instructions: identity, activation, four-step procedure, " +
          "output format, behavior rules, edge cases, anti-patterns.",
        mimeType: "text/markdown",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: SKILL_TEXT,
          },
        ],
      })
    );

    this.server.registerResource(
      "checklist",
      "checklist://ai-security",
      {
        title: "AI Pre-Launch Security Checklist",
        description:
          "Reference checklist: inputs, outputs, secrets, permissions, " +
          "resilience, observability, versioning, internal agents, compliance.",
        mimeType: "text/markdown",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: CHECKLIST_TEXT,
          },
        ],
      })
    );
  }
}

const LANDING_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AI Security Review MCP</title>
  <style>
    :root { color-scheme: light dark; }
    body { font: 16px/1.6 -apple-system, system-ui, sans-serif; max-width: 640px; margin: 4rem auto; padding: 0 1.5rem; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    @media (prefers-color-scheme: dark) { pre { background: #1a1a1a; } }
    h1 { margin-bottom: 0.25rem; }
    .sub { color: #666; margin-top: 0; }
    .endpoints { margin-top: 2rem; }
    .endpoint { font-family: ui-monospace, monospace; font-size: 0.95rem; }
  </style>
</head>
<body>
  <h1>AI Security Review MCP</h1>
  <p class="sub">A remote MCP server that runs the AI Integration Lead pre-launch audit through your own LLM.</p>

  <p>Add this server to Claude, ChatGPT, or Gemini and run <code>start_security_audit</code> on any AI project. Your client LLM walks the repo using its own filesystem tools and produces a structured audit report.</p>

  <h2>Endpoints</h2>
  <ul class="endpoints">
    <li class="endpoint">Streamable HTTP: <code>/mcp</code></li>
    <li class="endpoint">SSE (legacy): <code>/sse</code></li>
  </ul>

  <h2>Add to Claude Desktop</h2>
  <pre>{
  "mcpServers": {
    "ai-security-review": {
      "url": "https://ai-security-review-mcp.levitin.workers.dev/mcp"
    }
  }
}</pre>

  <p>See the README on GitHub for ChatGPT and Gemini CLI install snippets.</p>
</body>
</html>`;

type Env = Record<string, unknown>;

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return SecurityReviewMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    if (url.pathname === "/mcp") {
      return SecurityReviewMCP.serve("/mcp").fetch(request, env, ctx);
    }

    if (url.pathname === "/healthz") {
      return new Response("ok", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(LANDING_HTML, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
