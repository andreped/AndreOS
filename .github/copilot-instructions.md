# AndreOS — Copilot instructions

Modular guidance lives in [.github/instructions/](instructions/). Files with
`applyTo: "**"` are always active; narrower `applyTo` globs load only when you
touch matching files.

- **Always on:** [ponytail.instructions.md](instructions/ponytail.instructions.md) — lazy senior dev mode (how we decide what to build and how small the diff should be).

Add new topic-specific rules as their own `*.instructions.md` file with an
`applyTo` glob rather than growing this file.

