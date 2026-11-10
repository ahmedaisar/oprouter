# OpRouter product plan

**Product objective:** compete with the complete OpenRouter platform, while making the product materially more developer-friendly. This is a staged product ambition, not a claim of current feature parity. The source-backed capability matrix and research notes live in [competitive-benchmark.md](./competitive-benchmark.md). The core developer jobs and screen map live in [jobs-map.md](./jobs-map.md).

## Product shape and decisions

- Product: OpRouter — a developer-first AI model platform to discover, compare, route, integrate and operate models through one unified workspace and API.
- Competitive scope: broad parity with the OpenRouter web/API experience: model/provider discovery, chat playground, unified API, multimodal capabilities, routing/fallback, BYOK, activity/analytics, budgets, privacy/governance, credits/billing, SDKs, CLI/DevTools and MCP.
- Differentiator: explainable routing, reproducible request replay, built-in model evaluation, local-first debugging, environment-aware controls, portability and honest performance metadata.
- Initial beachhead hypothesis: independent developers and small AI product teams. This is not yet validated demand.
- Workspace: retain personal account support now; design data ownership for future workspace/environment isolation. Team/org roles are later.
- Identity: Supabase Auth.
- Current stack: Next.js App Router + TypeScript + Supabase Postgres; Vercel hosting. Keep unless measured constraints require change.
- Provider architecture: provider-neutral adapter interface. OpenRouter may be an initial upstream for catalogue/inference breadth, but must not be the only supported provider or a permanent architectural dependency.
- Billing: no live charges or prices until the owner approves a fee model, legal text and reconciliation design.
- Gateway: retain the existing OpenAI-compatible chat-completions route while expanding the versioned API surface and compatibility matrix.
- Secrets: provider credentials are server-only and encrypted at rest; never returned to clients or logged.

## Current implementation baseline (2026-11-10)

- Existing code: Next.js workspace, basic model catalogue, text playground, Supabase auth, activity/settings routes, API key management and an OpenAI-compatible chat-completions gateway.
- Existing gateway controls: hashed API keys, optional model allowlists, monthly token quotas/reservations and persistent per-key fixed-window rate limits.
- Not yet proven: production authenticated/provider flow, complete RPC privilege/RLS matrix, route fallback, direct provider adapters, multimodal endpoints, billing ledger, BYOK, workspaces, guardrails, SDKs, CLI, MCP, complete analytics and production readiness.
- PRs #13, #15 and #16 remain the immediate engineering/documentation queue at the time of this plan update. Recheck live status before merging.
- Current status is not feature parity. See the competitive benchmark for capability-by-capability state.

## Lifecycle and delivery phases

### Phase 0 — Product definition and design (current strategic update)
- Source-backed competitor benchmark, capability matrix, differentiator hypotheses and initial beachhead.
- Map each core job to a screen and its question/primary action.
- Produce two visual directions for the first key screens, then implement from the approved design system.
- Done when the owner approves the direction, jobs map and first-screen designs.

### Phase 1 — Foundation and developer experience
- Complete gateway hardening, integration tests and safe release evidence.
- Model and provider discovery: search, filters, detailed capabilities, pricing and provider availability.
- Playground: saved prompts, parameter controls, tool-call/structured-output visibility, side-by-side comparison, export.
- Developer onboarding: quickstart, API reference, errors, curl and TypeScript/Python examples.
- Done when a developer can discover, compare, test and integrate a model in under five minutes using the documented flow.

### Phase 2 — Routing and observability
- Model-level fallbacks and provider routing policies: order, only/ignore, fallback behavior and cost/latency/throughput preferences.
- Per-attempt routing trace, provider health, latency, throughput, errors and request replay.
- Request explorer, usage export, per-key/environment analytics, budgets and notifications.
- Done when routing and accounting are deterministic, explainable and covered by integration tests.

### Phase 3 — Provider independence and multimodal API
- Add direct provider adapters selected by model demand; OpenRouter remains optional, not the sole upstream.
- Add vision/PDF/audio inputs, image generation, speech, transcription, embeddings and async video jobs where provider capabilities permit.
- Add encrypted BYOK credentials, scoped provider use, priority/fallback and safe key rotation.
- Done when every advertised provider/modality has contract tests, accurate capability metadata and cost accounting.

### Phase 4 — Billing, governance and workspaces
- Immutable credit ledger, top-ups, refunds and invoices after owner-approved fee/pricing policy.
- Budgets, alerts, model/provider allowlists, privacy/data policies, guardrails and audit trail.
- Multiple personal workspaces/environments; team/org RBAC after individual tenancy is proven.
- Done when ledger reconciliation, policy precedence and authorization/tenant-isolation matrices pass.

### Phase 5 — Developer ecosystem and scale
- Official TypeScript SDK first, then Python and Go.
- CLI, local request capture/replay viewer, MCP server and cookbook.
- Public status/incident history and provider performance reporting.
- Enterprise features such as SSO/SCIM, regional routing, private endpoints and workload identity only after validated demand.

## Immediate execution order

1. Recheck and complete PR #13 gateway timeout/integration work; verify tests actually exercise route behavior and timeout/fallback semantics.
2. Recheck PR #16 lightweight PR CI + scheduled/manual release validation. Keep fast PR checks lightweight; comprehensive validation stays at release/stage boundaries.
3. Recheck PR #15 and include this competitive scope, feature matrix and jobs map in its authoritative documentation.
4. Run a fresh independent review of the current gateway slice; fix any confirmed high-impact findings before merge.
5. Complete the PE design stage: jobs map, navigation, two visual directions, approved tokens/components and high-fidelity key screens before broad feature expansion.
6. Build Phase 1 in small vertical PRs: model/provider detail and metadata, then playground improvements, then developer docs/onboarding.
7. Continue through routing, observability, multimodal/provider independence, governance/billing and developer ecosystem in the phase order above.

## Definition of done

- A stage is complete only when its PE lifecycle done-when is evidenced; a green CI run is not proof of user flow, isolation or production behavior.
- Every PR has focused scope, tests and documentation; bug fixes include a regression test that fails before the fix.
- No merge while required CI is pending or failing. Use fast PR checks and comprehensive release checks at stage/release boundaries.
- Production migrations, production data writes, payment activation and release actions require the applicable owner approval.
- Every competitive capability is labelled existing, partial, gap or later; never present roadmap items as shipped.
- Routing decisions, costs, performance and provider availability must be evidence-backed and include freshness/sample context.

## Deferred until evidence supports them

- Enterprise SSO/SCIM, private endpoints, regional residency and contractual SLAs.
- Team billing/seat plans and enterprise sales motion.
- Proprietary inference infrastructure or foundation-model training.
- Public price/fee commitments and live payment activation.
