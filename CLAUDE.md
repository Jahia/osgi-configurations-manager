# CLAUDE.md

Project guidance for Claude Code and other AI agents.

**Start here: [AGENTS.md](AGENTS.md).** It is the single source of truth for this module's
architecture, the data-loss-risk invariants (decrypt-in-memory, fail-closed encryption, visual↔raw
reserialization), the backend action protocol, and how to build, test, and run the E2E suite.

Quick pointers:

- User-facing features: [README.md](README.md)
- Security model: [SECURITY.md](SECURITY.md)
- Contributor/agent map, build & test commands, E2E gotchas: [AGENTS.md](AGENTS.md)

Before analyzing code, this repo has a CodeGraph index (`.codegraph/`); follow the CodeGraph rules in
`~/.claude/CLAUDE.md` (run `codegraph sync` first, query via the MCP tools, and spawn an Explore agent
for broad exploration rather than dumping source into the main session).
