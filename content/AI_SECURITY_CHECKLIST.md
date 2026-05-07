# AI Pre-Launch Security Checklist

Reference for the AI Integration Lead agent (`SKILL_ai_integration_lead.md`).
Each item: what to verify, where to find evidence in a codebase, what counts as a pass, what counts as a fail.

Items grouped by domain. Within each domain, items are roughly ordered from highest-blast-radius to lowest.

---

## 1. Inputs

### 1.1 User input is treated as hostile by default
- **Verify:** prompts that include user-supplied content delimit it explicitly.
- **Look in:** prompt templates, system message construction, message-building functions.
- **Pass:** user content is wrapped in tags or delimiters; system prompt explicitly tells model to ignore instructions inside those tags.
- **Fail:** raw string concatenation of user input into system or assistant messages.

### 1.2 Prompt injection is actively defended, not assumed away
- **Verify:** sanitization or detection layer exists between user input and model.
- **Look in:** input pipeline, middleware, validation layer.
- **Pass:** known-injection patterns scanned; suspicious inputs flagged or stripped before model call.
- **Fail:** "we trust the model to ignore instructions" with no defensive layer.

### 1.3 Rate limits exist per user, per IP, per feature
- **Verify:** hard caps with backoff, not soft caps.
- **Look in:** API gateway config, middleware, redis/memcached limiters.
- **Pass:** documented limits per scope; budgets enforced server-side; backoff implemented.
- **Fail:** no rate limiting, or limits only at the LLM provider level (which protects them, not you).

### 1.4 Oversized inputs are rejected, not silently truncated
- **Verify:** token counting before send; explicit error when over budget.
- **Look in:** request validation, prompt construction.
- **Pass:** pre-flight token count; user sees a clear error; no DoS via long inputs.
- **Fail:** inputs are passed to the model and let the provider error out.

### 1.5 Tool-use parameters are sanitized before execution
- **Verify:** model-suggested arguments validated against a typed schema.
- **Look in:** tool execution layer, function-calling handlers.
- **Pass:** type checks, value whitelists, range validation; raw strings never passed to shell, SQL, file system.
- **Fail:** model output is passed directly to system calls or DB queries.

### 1.6 Multi-turn context is bounded
- **Verify:** conversation history can't grow unbounded.
- **Look in:** session management, message store.
- **Pass:** max turns enforced; old turns summarized or dropped; no per-user infinite memory.
- **Fail:** sessions retain everything indefinitely.

### 1.7 File uploads are scanned and bounded
- **Verify:** uploaded files have size limits, type checks, malware scanning.
- **Look in:** upload handlers, file processing pipeline.
- **Pass:** size cap, MIME type whitelist, virus scan, content-type validation.
- **Fail:** any upload accepted, no scanning, files passed directly to model.

---

## 2. Outputs

### 2.1 Model output is never executed without parsing
- **Verify:** outputs treated as strings until structurally validated.
- **Look in:** response handlers, downstream consumers.
- **Pass:** schema validation; sandboxed eval if code; HTML/SQL escaping on render.
- **Fail:** raw output passed to `eval()`, dangerouslySetInnerHTML, raw SQL, shell.

### 2.2 Output schema is validated, fails closed
- **Verify:** strict parsers; defined behavior on malformed output.
- **Look in:** response parsers, structured-output handlers.
- **Pass:** Zod/Pydantic/equivalent; reject malformed; explicit fallback path.
- **Fail:** "best effort" JSON parsing that silently degrades.

### 2.3 PII detection runs on outputs before return to user
- **Verify:** scanning layer between model and user.
- **Look in:** response middleware, post-processing.
- **Pass:** regex + NER pass; redaction or block; logged separately for audit.
- **Fail:** model outputs reach users unscanned.

### 2.4 Hallucination has a defined failure path
- **Verify:** confidence-aware handling of model output.
- **Look in:** response handling, grounding/RAG layer if applicable.
- **Pass:** confidence thresholds, citation requirements where relevant, graceful "I don't know" path.
- **Fail:** model output is treated as ground truth without verification.

### 2.5 Outputs naming third parties are reviewed
- **Verify:** competitors, named individuals, prices, legal claims are gated.
- **Look in:** output filters, content moderation layer.
- **Pass:** entity recognition; allowlist or blocklist; manual review queue for sensitive cases.
- **Fail:** model can freely name any entity in user-facing output.

### 2.6 Model can refuse, and refusals are handled
- **Verify:** the system has a path for "model declined to answer."
- **Look in:** response handling logic.
- **Pass:** refusal detection, graceful UX, no infinite retry on refusals.
- **Fail:** refusals crash, retry forever, or are silently treated as empty results.

### 2.7 Streaming responses can be cancelled mid-stream
- **Verify:** if streaming, abort logic exists.
- **Look in:** streaming handlers, client cancellation paths.
- **Pass:** AbortController or equivalent; server-side cleanup on client disconnect.
- **Fail:** streams continue to consume tokens after user has left.

---

## 3. Secrets and data flow

### 3.1 No credentials in any prompt
- **Verify:** API keys, tokens, passwords never appear in messages sent to model.
- **Look in:** prompt construction, environment variable handling.
- **Pass:** credentials passed via reference (e.g., user ID → server-side lookup); never inline.
- **Fail:** API keys interpolated into system prompts or tool descriptions.

### 3.2 No cross-tenant data in shared prompts
- **Verify:** multi-tenant isolation in prompt construction and caching.
- **Look in:** prompt templates, cache keys, shared services.
- **Pass:** per-tenant cache keys; tenant ID validated server-side; no shared system prompts containing customer data.
- **Fail:** any chance of one customer's data appearing in another's session.

### 3.3 Vendor data retention is documented per provider
- **Verify:** for each LLM/embeddings/storage vendor: retention policy, training opt-out, region.
- **Look in:** vendor docs, DPAs, environment configs.
- **Pass:** documented in repo (`/docs/vendors.md` or equivalent); training opt-out where supported; alignment with data classification.
- **Fail:** unknown retention; default training opt-in; no vendor inventory.

### 3.4 Logs do not contain raw PII
- **Verify:** logging pipeline redacts before write.
- **Look in:** logging middleware, observability config.
- **Pass:** PII scrubbing pre-write; structured logs with redaction; access controls on log store.
- **Fail:** full prompts and responses logged in plaintext.

### 3.5 Customer data is region-pinned
- **Verify:** vendor calls respect data residency policy.
- **Look in:** vendor SDK config, environment per region.
- **Pass:** per-region endpoints; documented routing; legal sign-off.
- **Fail:** all calls go to default vendor region; cross-border without policy.

### 3.6 Embedding stores are isolated per tenant
- **Verify:** vector DB queries filter by tenant.
- **Look in:** vector DB queries, namespace/index design.
- **Pass:** namespace per tenant, or filter on every query, validated server-side.
- **Fail:** shared index with client-side filtering, or no filter at all.

### 3.7 Training data sources are inventoried
- **Verify:** if fine-tuning or RAG: known data provenance, licensed-or-owned content only.
- **Look in:** training data manifests, RAG document sources.
- **Pass:** documented sources; licenses checked; PII scrubbed before indexing.
- **Fail:** scraped or unknown-provenance data; no inventory.

---

## 4. Permissions and blast radius

### 4.1 Each agent has minimum-necessary permissions
- **Verify:** scoped tokens; least-privilege IAM; explicit grants per action.
- **Look in:** IAM policies, token scopes, agent configuration.
- **Pass:** read-only by default; writes require explicit scope; no admin tokens.
- **Fail:** agents run with broad credentials "for now."

### 4.2 Spend caps exist per hour, per agent, per workflow
- **Verify:** hard cost ceilings with auto-shutoff.
- **Look in:** cost-tracking middleware, vendor billing config, alert configuration.
- **Pass:** per-scope caps; auto-cutoff at limit; alerts at 50/80/100%.
- **Fail:** soft alerts only; no auto-cutoff; runaway loops can exhaust budget.

### 4.3 Killswitch exists and was tested in last 30 days
- **Verify:** documented procedure; recent test evidence.
- **Look in:** runbooks, deployment configs, incident drills.
- **Pass:** documented kill procedure, multiple authorized operators, drill log within 30 days.
- **Fail:** "we have a feature flag" that was never tested.

### 4.4 Bad outputs cannot cascade at scale
- **Verify:** batch processing has sample-then-scale gates.
- **Look in:** batch job logic, queue processing.
- **Pass:** sample run with human review before full execution; per-stage rollback; circuit breaker at error threshold.
- **Fail:** bulk operations execute against full set without intermediate gate.

### 4.5 No irreversible actions without human gate
- **Verify:** sends, deletes, transactions, public posts require approval.
- **Look in:** action handlers, HITL implementation.
- **Pass:** approval queue, dry-run mode, audit log per executed action.
- **Fail:** agents can autonomously send email, delete records, post publicly, transact.

### 4.6 Tool-use surface is allowlisted, not blocklisted
- **Verify:** tools available to model are explicitly enumerated.
- **Look in:** tool registry, function-calling config.
- **Pass:** finite list; new tools require code change; tool descriptions reviewed.
- **Fail:** dynamic tool loading; agent can introspect and call arbitrary functions.

### 4.7 Agent loops have step caps
- **Verify:** max iterations per agent invocation.
- **Look in:** agent orchestration, loop handlers.
- **Pass:** hard step limit; cost-aware termination; exit on repeated state.
- **Fail:** agent runs until task completes or token budget exhausts.

---

## 5. Failure and resilience

### 5.1 Provider failures degrade gracefully
- **Verify:** fallback chain when primary model fails.
- **Look in:** model routing, error handling.
- **Pass:** primary → secondary → deterministic fallback; timeouts enforced; user-visible behavior defined.
- **Fail:** single-vendor dependency; provider outage = feature outage.

### 5.2 Retries have budgets, not infinite loops
- **Verify:** retry logic has bounded attempts.
- **Look in:** retry middleware, error handlers.
- **Pass:** N retries with exponential backoff; total time-bounded; circuit breaker after threshold.
- **Fail:** retry-until-success; fixed-interval retries; no upper bound.

### 5.3 Timeouts are set on every external call
- **Verify:** every model and tool call has a timeout.
- **Look in:** HTTP clients, SDK config, tool handlers.
- **Pass:** per-call wall-clock timeout; aggregate timeout per request; user-visible degradation.
- **Fail:** infinite waits possible; one slow vendor blocks the whole pipeline.

### 5.4 Circuit breakers exist for flaky vendors
- **Verify:** sustained failures trip a breaker that stops calling the vendor.
- **Look in:** vendor middleware, error handlers.
- **Pass:** error-rate threshold; cool-down period; auto-recovery; fallback engaged during open state.
- **Fail:** every request hits the vendor regardless of recent failure rate.

### 5.5 Dead-letter queue for failed work
- **Verify:** failed AI tasks land somewhere, not nowhere.
- **Look in:** queue config, error handlers, batch processors.
- **Pass:** DLQ with retention; alerting on growth; replay tooling.
- **Fail:** failed tasks are dropped or buried in logs.

### 5.6 Rollback is documented and tested
- **Verify:** prior version of prompts and models can be restored fast.
- **Look in:** prompt versioning, model pinning, deployment pipeline.
- **Pass:** rollback in <5 minutes; documented procedure; test within 90 days.
- **Fail:** rollback requires "I think the old prompt is in this Notion page somewhere."

---

## 6. Observability

### 6.1 Per-request trace IDs exist end-to-end
- **Verify:** every AI request has a traceable ID across services.
- **Look in:** logging middleware, request handlers.
- **Pass:** trace ID in every log line; queryable; spans across services.
- **Fail:** logs by service with no correlation; can't reconstruct a request.

### 6.2 Cost telemetry per feature, per user
- **Verify:** AI spend is attributable.
- **Look in:** cost-tracking middleware, observability dashboards.
- **Pass:** dollars per feature per day; dollars per user per period; rate-of-change alerts.
- **Fail:** monthly bill is the only signal.

### 6.3 Anomaly detection on cost and quality
- **Verify:** alerts fire before incidents become billing problems.
- **Look in:** monitoring config, alerting rules.
- **Pass:** statistical anomaly detection on spend, latency, output quality; alerts route to humans.
- **Fail:** alerts only on hard failures; gradual drift goes unnoticed.

### 6.4 Output quality is monitored in production
- **Verify:** running eval or sampling in prod, not just at launch.
- **Look in:** evaluation pipeline, sampling middleware.
- **Pass:** ongoing quality scoring; drift detection; weekly review.
- **Fail:** evals run once at launch and never again.

### 6.5 Logs detailed enough for one-hour incident response
- **Verify:** prompt + output + metadata retained for investigation.
- **Look in:** log retention config, observability stack.
- **Pass:** full request retention 30+ days; searchable by user/time/feature; PII-redacted.
- **Fail:** logs too sparse to reconstruct what happened.

### 6.6 Per-user audit trail
- **Verify:** "what did the AI do for user X yesterday at 3pm" is answerable.
- **Look in:** audit logging, user activity store.
- **Pass:** per-user log; queryable in production; compliance retention.
- **Fail:** no per-user view; reconstruction requires DBA.

### 6.7 Drift alerts when production diverges from eval baseline
- **Verify:** baseline expectations exist; deviation alerts.
- **Look in:** eval pipeline, monitoring config.
- **Pass:** baseline metrics defined; weekly comparison; alert on N-sigma drift.
- **Fail:** no baseline; no comparison; "it feels different lately."

---

## 7. Versioning and reproducibility

### 7.1 Prompts are version-controlled
- **Verify:** prompts live in code or a versioned store, not docs.
- **Look in:** prompt files, prompt management system.
- **Pass:** prompts in git or PromptLayer/Langfuse equivalent; diffable; history retained.
- **Fail:** prompts live in Notion or Slack; current version unclear.

### 7.2 Model versions are pinned
- **Verify:** model identifier specifies version, not "latest."
- **Look in:** vendor SDK calls, model configs.
- **Pass:** explicit model version per call; upgrades are deliberate; deprecation alerts watched.
- **Fail:** "claude-3-5-sonnet" or "gpt-4o" without version pin.

### 7.3 Eval datasets are versioned
- **Verify:** test sets are reproducible.
- **Look in:** eval pipeline, test data storage.
- **Pass:** dataset versions; results tied to dataset version; can re-run any past eval.
- **Fail:** "the test set" with no version; results can't be reproduced.

### 7.4 Schema migrations are coordinated with prompt changes
- **Verify:** when output schema changes, prompts and consumers are updated together.
- **Look in:** deployment pipeline, schema definitions.
- **Pass:** schema + prompt + consumer deployed atomically; backward compatibility documented.
- **Fail:** schema changes silently; consumers break in production.

### 7.5 Past production runs can be replayed
- **Verify:** can re-run any past request with original inputs and prompt version.
- **Look in:** request logging, prompt version log.
- **Pass:** input + prompt version + model version retained; replay tooling exists.
- **Fail:** can't reproduce a past failure to debug it.

---

## 8. Internal agents (additional)

### 8.1 Read-only by default, write access explicit
- **Verify:** agent tokens default to read; writes require dedicated scope.
- **Look in:** IAM, agent config.
- **Pass:** separate read and write tokens; writes audited; justification per workflow.
- **Fail:** single token with broad access.

### 8.2 No external API calls without allowlist
- **Verify:** outbound calls restricted to known endpoints.
- **Look in:** egress firewall, network policy, agent config.
- **Pass:** allowlist of permitted domains; alerts on new domains; default deny.
- **Fail:** agent can hit arbitrary URLs.

### 8.3 Prompt history auditable for 90+ days
- **Verify:** per-agent history retained beyond debug needs.
- **Look in:** logging config, audit store.
- **Pass:** per-agent log; queryable; 90+ day retention.
- **Fail:** debug logs only; no audit perspective.

### 8.4 No emails, payments, or public posts unsupervised
- **Verify:** external-effect actions require human approval.
- **Look in:** action handlers, HITL implementation.
- **Pass:** approval flow on external effects; thresholds for auto-approval if any; cooldowns.
- **Fail:** agent can send mail, transact, or post publicly without human in loop.

### 8.5 Agent identity is distinct from user identity
- **Verify:** logs and audits show "agent acted on behalf of user X" not "user X did this."
- **Look in:** authentication, audit logging.
- **Pass:** dual-identity model; agent ID + user ID both logged; clear distinction.
- **Fail:** agent actions logged as the user; can't tell who actually did what.

### 8.6 Human-in-the-loop approvals are time-bounded
- **Verify:** pending approvals expire.
- **Look in:** approval queue, HITL config.
- **Pass:** approvals auto-reject after N minutes; pending-approval alerts; default-deny on timeout.
- **Fail:** approvals sit indefinitely; idle approvals are a security hole.

---

## 9. Compliance and legal

### 9.1 Data classification is documented
- **Verify:** which data classes are processed; which are forbidden.
- **Look in:** `/docs/data-classification.md` or equivalent.
- **Pass:** documented classes (public, internal, PII, regulated); per-class handling rules.
- **Fail:** ad-hoc; "we'll figure it out per request."

### 9.2 Disclosure to users when AI is involved
- **Verify:** users are informed they're interacting with AI.
- **Look in:** UI, terms of service, in-product disclosure.
- **Pass:** clear UX disclosure; ToS includes AI clause; complies with applicable jurisdiction.
- **Fail:** users believe they're talking to a human.

### 9.3 Right-to-deletion handles AI-derived data
- **Verify:** deletion request removes prompts, embeddings, fine-tune data, logs.
- **Look in:** deletion pipeline, data retention policy.
- **Pass:** documented deletion of all derivatives; verified end-to-end; SLA for completion.
- **Fail:** "we delete the user record" but embeddings and logs remain.

### 9.4 Consent is captured for sensitive data processing
- **Verify:** explicit consent for processing PII, biometric, health data via AI.
- **Look in:** consent flows, UX, audit log.
- **Pass:** consent recorded; revocable; documented per data class.
- **Fail:** consent buried in ToS or assumed.

### 9.5 Bias and fairness reviews exist for high-stakes use
- **Verify:** if AI affects hiring, lending, housing, healthcare: fairness evals.
- **Look in:** evaluation pipeline, model governance docs.
- **Pass:** disparate-impact testing; documented; reviewed per release.
- **Fail:** "we don't test for that."

---

## Notes for the agent

- Items in this list are not all equally weighted. Surface only what's relevant to the feature being audited.
- Items in §9 (compliance) apply per jurisdiction and per use case. Don't flag GDPR-specific items for a US-only B2B tool.
- An item is a **gap** if the feature *should* have it but doesn't.
- An item is **inaccessible** if you can't determine whether it's implemented because the relevant code, config, or doc is not in scope.
- An item is **not applicable** if the feature legitimately doesn't need it (e.g., no batch processing → §4.4 is N/A).

*Last updated [date]. Skill version: see SKILL.md.*
