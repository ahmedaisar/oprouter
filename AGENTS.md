# Agent instructions

## Product workflow
- Follow the Product Engineering lifecycle and use PE MCP skills for proposals, planning, implementation, independent review and release gates as applicable.
- For any OpRouter UI work, load PE `app-stack/ui-design` and Taste Skill `design-taste-frontend` (Taste Skill 2.5.1; see [design system workflow](design/README.md)).
- Do not use Figma for OpRouter UI. Design and review real Next.js screens in the application.
- PE `ui-design` owns app semantics, truthful data, jobs, states, accessibility, kit invariants and owner review. Taste Skill owns frontend visual craft and its applicable copy/layout/motion/checker rules. Follow the product-specific reconciliations in `design/README.md`.
- Do not implement new screen-specific raw styles. Establish and use `design/tokens.css` and `design/kit.css` first.
- Keep PRs focused. Never merge with required CI pending or failing; poll checks to completion and independently review the exact diff before merge.
