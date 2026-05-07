<h1 align="center">AI Security Review MCP</h1>

<p align="center">
  <b>One URL. Any LLM. A pre-launch security audit on your AI project.</b>
</p>

<p align="center">
  <a href="https://ai-security-review-mcp.levitin.workers.dev"><img alt="Live" src="https://img.shields.io/badge/live-ai--security--review--mcp.levitin.workers.dev-00C7B7?style=flat-square"></a>
  <img alt="MCP" src="https://img.shields.io/badge/MCP-Streamable_HTTP-7C3AED?style=flat-square">
  <img alt="Cloudflare" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square">
</p>

---

## What this is

A remote **Model Context Protocol** server that turns your favorite LLM — Claude, ChatGPT, or Gemini — into an **AI Integration Lead** that audits your project for production readiness.

Add the URL to your MCP-aware client. Run `start_security_audit`. Your LLM walks the repo and produces a structured audit covering 60+ items across:

> **Inputs · Outputs · Secrets · Permissions · Resilience · Observability · Versioning · Internal agents · Compliance**

The server itself runs no LLM. It delivers a battle-tested skill + checklist into whatever LLM you're already paying for. Free to use, free to host, identical behavior across all three vendors.

---

## Quick install

> **Endpoint** — `https://ai-security-review-mcp.levitin.workers.dev/mcp`

<details open>
<summary><b>Claude Desktop</b></summary>

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "ai-security-review": {
      "url": "https://ai-security-review-mcp.levitin.workers.dev/mcp"
    }
  }
}
```

Restart Claude Desktop. The `start_security_audit` tool and `security-review` prompt will appear.
</details>

<details>
<summary><b>Claude.ai (web)</b></summary>

Settings → **Connectors** → **Add custom connector** → paste:

```
https://ai-security-review-mcp.levitin.workers.dev/mcp
```
</details>

<details>
<summary><b>ChatGPT</b> (Pro / Team / Enterprise)</summary>

Settings → **Connectors** → **Custom MCP** → paste the URL above. Tools surface; prompts may not be exposed in ChatGPT's UI — call `start_security_audit` directly.
</details>

<details>
<summary><b>OpenAI Responses API</b></summary>

```ts
const response = await openai.responses.create({
  model: "gpt-4.1",
  tools: [{
    type: "mcp",
    server_label: "ai-security-review",
    server_url: "https://ai-security-review-mcp.levitin.workers.dev/mcp",
  }],
  input: "Audit my project for production readiness.",
});
```
</details>

<details>
<summary><b>Gemini CLI</b></summary>

`~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "ai-security-review": {
      "httpUrl": "https://ai-security-review-mcp.levitin.workers.dev/mcp"
    }
  }
}
```
</details>

---

## How to use it

After install, in any conversation with your LLM:

```
You: audit this project for production readiness
LLM: [calls start_security_audit, then walks your repo]
```

That's it. The model handles the rest: scoping the codebase, checking each item, classifying findings as PASS / FAIL / GAP / INACCESSIBLE, and producing a verdict — **SHIP**, **SHIP WITH CONDITIONS**, or **HOLD**.

For an incremental audit on a large project, the model can pull one domain at a time:

```
You: just audit the secrets-handling slice
LLM: [calls get_checklist_section("3"), checks just that domain]
```

---

## What the audit looks like

```markdown
# AI Pre-Launch Audit
## Project: invoice-classifier
## Date: 2026-05-07
## Scope: src/ai, src/api, prompt templates, vendor configs

## Verdict
SHIP WITH CONDITIONS — three hard fails, two of which gate launch.
F1 leaks customer data; F2 enables runaway spend.

## Hard Fails
### F1. User input concatenated into system prompt
- What I found: src/ai/classify.ts:47 interpolates `req.body.note`
  directly into the system message.
- Why it matters: standard prompt-injection vector. Attacker overrides
  classification rules.
- Fix: wrap user content in <user_input> tags; instruct model to
  ignore instructions inside them.

### F2. No spend cap
- What I found: no per-hour cost ceiling; agent loop in
  src/agent/runner.ts has step cap of 50 but no $ cap.
- Why it matters: a stuck agent can burn $1k+ before someone notices.
- Fix: add cost-tracking middleware with auto-cutoff at $X/hour.

## Inaccessible
### I1. Vendor data retention policy
- What I'd need: /docs/vendors.md or DPAs.
- Why this matters: can't confirm training opt-out for OpenAI calls.
...
```

The full audit format is defined by the [skill](content/SKILL_ai_integration_lead.md) — every audit produces the same shape.

---

## What gets checked

The reference checklist has nine domains. Highlights:

| Domain | What this catches |
|---|---|
| **1. Inputs** | Prompt injection, oversized requests, unsanitized tool args, unbounded context, malicious uploads |
| **2. Outputs** | `eval()` of model output, schema-less parsing, PII leaks, hallucinations as ground truth, runaway streams |
| **3. Secrets & data flow** | Credentials in prompts, cross-tenant bleed, undocumented vendor retention, plaintext logs, region violations |
| **4. Permissions & blast radius** | Broad agent tokens, no spend caps, no killswitch, batch cascades, irreversible auto-actions |
| **5. Failure & resilience** | Single-vendor dependency, infinite retries, missing timeouts, no circuit breakers, no DLQ, no rollback |
| **6. Observability** | No trace IDs, monthly bill as the only cost signal, no anomaly detection, no per-user audit trail |
| **7. Versioning** | Prompts in Notion, model "latest" not pinned, evals not versioned, can't replay past requests |
| **8. Internal agents** | Write-by-default tokens, unrestricted egress, no HITL on external effects, agent-as-user logging |
| **9. Compliance** | Undocumented data classes, no AI disclosure, deletion misses embeddings, no fairness review for high-stakes |

The full checklist is at [content/AI_SECURITY_CHECKLIST.md](content/AI_SECURITY_CHECKLIST.md).

---

## How it works

```
┌────────────────┐      MCP      ┌──────────────────┐      reads      ┌──────────────┐
│  Your LLM      │ ───────────►  │  This server     │                 │  Your repo   │
│  (Claude /     │  start_audit  │  (Cloudflare     │                 │  (filesystem │
│   ChatGPT /    │ ◄───────────  │   Worker)        │                 │   tools used │
│   Gemini)      │   skill +     │                  │                 │   by your    │
└────────────────┘   checklist   └──────────────────┘                 │   LLM)       │
       │                                                              └──────┬───────┘
       │                       walks code, checks each item                 │
       └──────────────────────────────────────────────────────────────────► │
                              produces audit report
```

**Passive design.** The server returns text; the LLM does the audit. This is deliberate:

- **Free.** No LLM costs on the server side. Cloudflare Workers free tier covers it.
- **Private.** Your code never leaves your machine. The server only sees the audit's `start` call.
- **Portable.** Works the same in Claude, ChatGPT, and Gemini — no vendor-specific glue.

---

## What the server exposes

| Type | Name | Description |
|---|---|---|
| Tool | `start_security_audit` | Begin the audit. Returns the skill + checklist + a directive to scope the project first. Optional args: `project_hint`, `depth` (`quick` or `full`). |
| Tool | `get_checklist_section` | Fetch one domain (`"4"`) or item (`"4.4"`) without loading the whole checklist. |
| Prompt | `security-review` | Same as the tool; surfaces in clients that show prompts (Claude Desktop, Claude.ai). |
| Resource | `skill://ai-integration-lead` | The audit skill as an attachable markdown resource. |
| Resource | `checklist://ai-security` | The checklist as an attachable markdown resource. |

---

## Privacy

- **No authentication.** Public read-only endpoint.
- **No tracking.** No analytics, no per-user logs, no data collection.
- **No code uploads.** The server only sees that an audit started, not what's being audited.
- **Cloudflare's standard logs** apply (request IPs, timing) — typical for any Workers deployment.

If you'd rather not send any signal to this server, fork and host your own copy in 5 minutes.

---

## Run your own copy

```bash
git clone git@github.com:teionarr/ai-security-review-mcp.git
cd ai-security-review-mcp
npm install
npx wrangler login
npm run deploy
```

Free Cloudflare account is enough. After first deploy you'll have your own `https://ai-security-review-mcp.<your-subdomain>.workers.dev`.

To bind a custom domain (`mcp.example.com`), the zone must be on Cloudflare DNS — uncomment the `routes` block in `wrangler.toml`.

---

## Local development

```bash
npm install
npm run dev          # boots wrangler on :8787
```

Test the protocol with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector
```

Point it at `http://localhost:8787/mcp`. List tools, prompts, and resources. Call `start_security_audit` and confirm the kit returns.

Or with curl:

```bash
curl -i -X POST http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

---

## Project layout

```
ai-security-review-mcp/
├── src/
│   ├── index.ts             # Worker entry: tools, prompt, resources, landing
│   ├── kit.ts               # Builds the audit kit (skill + checklist + begin block)
│   ├── content.ts           # Generated string constants — do not edit
│   └── checklist-index.ts   # Section parser for get_checklist_section
├── content/
│   ├── SKILL_ai_integration_lead.md
│   └── AI_SECURITY_CHECKLIST.md
├── scripts/
│   └── sync-content.mjs     # Regenerates src/content.ts from content/*.md
├── wrangler.toml
└── package.json
```

To edit the audit content, change the markdown in `content/`, then `npm run sync-content`.

---

## Why this exists

Most AI features ship without a security review because there's no shared checklist for what to even look at. Generic web-app pen-tests miss prompt injection, runaway spend, vendor retention, agent blast radius, hallucinations as ground truth — the things that actually go wrong with LLM features.

This is the checklist I run before letting an AI feature ship. It's deliberately opinionated and field-tested. Read it, fork it, hold it against your own project.

---

## License

MIT. The skill and checklist content is original work by [@teionarr](https://github.com/teionarr).

If this saves you a real incident, [say hi](https://github.com/teionarr/ai-security-review-mcp/issues).
