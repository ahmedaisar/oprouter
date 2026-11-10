# OpRouter user jobs and screen map

**Version:** 2026-11-10  
**Status:** Proposed job map for owner review. This is a product/design artifact, not evidence that every mapped screen exists.

The map starts from developer jobs, not database tables. Every screen should answer one question and have one primary action. Sample data must be labelled as sample; empty, loading, error and zero states must be designed alongside populated states.

| Job in the developer's words | Screen | One question the screen answers | Primary action |
|---|---|---|---|
| "Help me find the right model for this task." | Model explorer | Which models fit my task, modalities, quality, speed and budget? | Open a model |
| "Show me where I can run this model." | Model detail / provider availability | Which providers serve this model and what are their current trade-offs? | Try this model |
| "Let me compare a few models on my own prompt." | Playground / compare | Which candidate gives the best result for my prompt and constraints? | Run comparison |
| "Let me keep prompts and reproduce a result." | Prompt library / evaluation run | Can I rerun this exact input and compare versions fairly? | Save or rerun |
| "Give me one API and let me switch models safely." | API quickstart / integration guide | What is the smallest working integration for my stack? | Copy a working example |
| "Tell me what happened to a production request." | Request explorer / trace detail | Which model/provider ran, what did it cost, how long did it take and why did it fail? | Replay safely |
| "Help me route for my constraints." | Routing policies | Which providers/models may be used and what is the fallback order? | Create policy |
| "Keep my keys and environments safe." | API keys / environments | Which credential belongs to which app/environment and what can it access? | Create scoped key |
| "Use my own provider account." | Provider integrations / BYOK | Which provider credentials are configured and how are they prioritized? | Add provider key |
| "Help me control spend and data exposure." | Budgets / guardrails / privacy | What limits and data policies are active for this key or workspace? | Create a control |
| "Show me usage and what I owe." | Usage, credits and billing | Where did usage and cost come from, and what is my available balance? | Inspect or export |
| "Let my tools use OpRouter without custom glue." | SDKs / CLI / MCP docs | How do I integrate OpRouter into my existing toolchain? | Install or copy setup |

## Navigation proposal

### Public surface
- Home / product overview
- Models and providers (read-only discovery)
- Docs / API reference / quickstarts
- Pricing (only after fee policy is approved)
- Status

### Signed-in developer workspace
- Overview
- Discover: Models, Providers, Compare
- Build: Playground, Prompts, Evaluations, API quickstart
- Operate: Requests, Usage, Routing, API keys, Provider integrations
- Govern: Budgets, Guardrails, Privacy
- Account: Workspaces, Credits/Billing, Settings

Keep routes shallow and task-oriented. Do not expose future sections as working navigation until their core flow exists; roadmap items can be labelled "Coming later" in a deliberate product roadmap, not as fake controls.

## Cross-screen state requirements

For every screen, specify:
- Loading state with stable layout.
- First-use empty state with a next action.
- No-results state distinct from an empty account.
- Error state with a retry path and a useful, non-sensitive explanation.
- Populated state using realistic, explicitly labelled sample data until connected to real records.
- Permission/plan-limited state only when the restriction is implemented and derived from authoritative policy.
- Responsive layout at 1440, 768 and 390 px.

## Design-stage acceptance

1. Owner reviews and accepts or changes the job map and navigation.
2. Produce two visual directions in the real design tokens for the key screens; owner chooses one.
3. Establish `design/tokens.css`, `design/kit.css` and a kit README before implementing new screens.
4. Implement first screens from the kit, with populated and empty states.
5. Run the UI-design walkthrough, screenshot critique and scored audit before owner click-through.
