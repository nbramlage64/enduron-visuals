# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This repo currently contains a single project, `enduron-graphics/` — a Remotion project (React-based programmatic video) that produces video overlays/graphics for Enduron. All commands below are run from within `enduron-graphics/`.

## Commands

```console
npm i                    # install dependencies
npm run dev              # launch Remotion Studio (interactive preview)
npm run build             # bundle the project (remotion bundle)
npm run lint              # eslint src && tsc (typecheck, no emit)
npx remotion render <composition-id> <output>   # render a specific composition to a file
npx remotion upgrade      # upgrade the Remotion framework version
```

There is no separate test suite — correctness is verified via `npm run lint` (ESLint + `tsc --noEmit`) and by visually checking compositions in Remotion Studio (`npm run dev`).

## Architecture

- `src/index.ts` registers the root component (`registerRoot`) — the entry point Remotion loads.
- `src/Root.tsx` (`RemotionRoot`) mounts every `<Composition>` the project defines. **New compositions must be added here** or they won't show up in Studio/render.
- Each visual/graphic is its own module exporting both a `<Composition>` wrapper (declares `id`, `component`, `durationInFrames`, `fps`, `width`, `height`) and the underlying React component that renders the frame content, e.g. `src/LowerThird.tsx` exports `LowerThirdComposition` + `LowerThird`.
- Animation is driven by `useCurrentFrame()` plus `interpolate()`/`Easing` from `remotion` — components are pure functions of the current frame, not stateful/time-based. Frame-count constants (enter/hold/exit durations) are typically defined at the top of the file and combined into a total `durationInFrames`.
- Compositions intended as overlays (e.g. lower thirds) use `AbsoluteFill` with a transparent background so they can be composited over other video.
- Styling is inline (`style={{...}}`) per-element in most existing components; Tailwind v4 (`@remotion/tailwind-v4`) is configured and available via `src/index.css` (`@import "tailwindcss"`) if needed for new work.
- `src/Composition.tsx` (`id: "MyComp"`) is the default Remotion scaffold composition — treat it as a template/placeholder, not a real deliverable.

## Conventions

- TypeScript strict mode is on, with `noUnusedLocals` enabled — unused variables fail `tsc`.
- Formatting follows `.prettierrc` (2-space indent, no tabs).
- ESLint config comes from `@remotion/eslint-config-flat` (`eslint.config.mjs`) — don't hand-roll a different lint config.
