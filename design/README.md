# OpRouter design system and frontend workflow

**Status:** design stage in progress. This file records the rules and provenance; it is not a claim that the app kit or visual audit is complete.

## Design authority

- **Product Engineering `ui-design`** governs the product jobs map, truthful data and state semantics, the in-repo design kit, accessible controls, responsive app behavior, visual review and owner decisions.
- **Taste Skill `design-taste-frontend` 2.5.1** governs frontend visual craft: software/AI/developer-tool classification, dealt visual direction, typography and copy discipline, layout, motion, real product UI, and its browser checker/finish gate.
- Taste source pinned for this design stage: [leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill/tree/f6b76575f949707b4e3c37cd86cb44b0b98643e8), skill path `skills/taste-skill/SKILL.md`.
- Install in a local screen-building agent with:
  `npx skills add https://github.com/leonxlnx/taste-skill --skill "design-taste-frontend"`
  The upstream skill requires Node 22+ and Chrome/Edge/Chromium. Keep the skill in the agent's skill directory; do not vendor its 1,600+ asset files into the application repository.
- Figma is not used for OpRouter UI. Design and review the real Next.js app screens in-browser.

## How the two methods fit

OpRouter is a software / AI developer-tool product. Use Taste's software rules for the product's visual character, own product UI, type, palette, interaction details, and frontend polish. Use PE's app-screen rules for dense authenticated workspaces, tables, navigation, state coverage, and truthful operational data.

The following product-app adaptations are deliberate:

1. Taste's marketing-site rule of one section per viewport is not imposed on dense workspace screens; information density follows the mapped developer job and PE app-screen review.
2. PE's explicit sample/fixture labelling wins for simulated workspace data. Never present invented request counts, latency, spend, provider health or model rankings as live facts.
3. No fabricated customer logos, testimonials, awards, provider availability, prices or performance claims. Model/provider facts must come from the actual catalogue/API and carry source/freshness context where appropriate.
4. Taste's software-only visual effects are used only when they explain the developer product; no decorative shader/scene is required for an ordinary table, form or request trace.
5. Keep the existing Next.js App Router, TypeScript and Supabase stack. Do not convert the app to a static export just to follow a static-site example.

## Kit contract

Before the next new application screen is implemented, establish and maintain:

- `design/tokens.css`: the only source of raw colour, typography, spacing, radius, elevation, motion, z-index, control-size and icon-size values.
- `design/kit.css`: reusable app primitives built from tokens only; no raw colour or spacing literals.
- `design/README.md`: this file, extended with the dealt palette/type/layout, rationale, component variants, theme behavior, and any owner-approved departures.

Import tokens once from the root layout, then the kit. Tailwind utilities and screen components must resolve to tokens; screens compose primitives instead of inventing local styles.

## Review gates

- Every screen maps to a user job and one primary action.
- Include populated, first-use empty, no-results, loading, error and permission states where applicable.
- Capture desktop (1440), tablet (768) and phone (390); also verify reflow at 320.
- Check keyboard, focus, contrast, forced colours, reduced motion, text wrapping, no horizontal overflow and 44px targets.
- Run Taste's copy/consistency/layout/performance/finish checks where the Next.js app can be served to its local browser scripts; report any checker that cannot run rather than claiming a pass.
- Run PE's newcomer walkthrough, visual critique and scored audit before owner click-through. Fix rule violations; ask the owner only for genuine taste decisions.
- Never use a successful build or CI run as evidence that a screen looks correct.

## Current status

- Taste Skill source and required core references have been read for this workflow.
- Existing `src/app/globals.css` is still the legacy styling source; the formal tokens/primitive kit has not yet been created or migrated.
- No OpRouter screens have yet passed the Taste browser gate or PE screenshot review.
- The prior Figma file is abandoned and is not a design deliverable.
