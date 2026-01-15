### 📌 CORE PRINCIPLES (CRITICAL - READ FIRST)

1. **No dummy data or throwaway files.**

    - Always work with real project content.
    - Do **not** generate random files, fake examples, or placeholder data.
    - Remove any temp/test data immediately after use.

2. **Terminal-first verification.**

    - Test commands/scripts in the terminal **before** creating files or pushing changes.
    - Never assume shell behavior—always verify.

3. **Repo hygiene is non-negotiable.**

    - Keep the repo modular and clean.
    - No junk markdowns, scratch files, or lingering code snippets.
    - Run `git status` before every commit to ensure a clean state.
    - Keep commit messages concise (≤ 20 words).

4. **Official sources only.**

    - Always reference **official documentation**.
    - No assumptions or third-party guesses.
    - Cite sources if referencing external docs.

5. **Output only to `report.local`.**

    - All summaries, analysis, or extracted notes **must** be saved in `report.local` at project root.
    - Never scatter outputs into random Markdown or other files.

6. **Be concise. Work efficiently.**

    - No confirmations unless requested.
    - Skip greetings, small talk, or summaries.
    - Prioritize efficient execution to save time and API quota.

7. **Code generation requires verification.**

    - Re-evaluate logic before finalizing code.
    - Validate:
        - All variables, imports, and APIs exist.
        - No fabricated functions or paths.
    - Ask if unsure — don’t guess.

8. **Notion summary integration rules.**

    - Structure content for **clean copy-paste into Notion**.
    - Use clean headers, short paragraphs, and remove redundant phrasing.
    - Prioritize **actionable** takeaways over raw transcription.

9. **Export all UI components.**

    - Every new component in `ui/` must be exported via `**/index.ts`.
    - Simplify imports via centralized export paths.

10. **Use clean imports.**

    - Always use `@/` for internal imports.
    - Never use relative paths like `../`.

11. **Remove unused code.**

    - Scan and eliminate any unused variables or dead code.
    - Keep logic lean.

12. **Format & lint before commit.**

    - Run formatting and linting tools.
    - Resolve all issues—don’t skip.

13. **Respect project patterns.**

    - Follow existing architecture and naming conventions.
    - Match file structure and logic styles already in use.

14. **Context is king.**

    - Before editing or summarizing, **read the full surrounding context**.
    - Ensure your work fits into existing logic or documentation.

---

### PROJECT-SPECIFIC GUIDELINES

-   Stack: Node 20+, TypeScript ESM, pnpm, Fastify + Zod; enable permissive CORS for development.
-   API: GET /health -> { ok: true }; POST /api/chat -> normalize responses to { reply } and require `Authorization: Bearer <MASTER_API_KEY>` when MASTER_API_KEY is set (otherwise allow).
-   Orchestrator: always include critic agent; route/plan agents, run in parallel with concurrency + timeout guards, apply invalidation thresholds (soft 0.45, hard 0.60, treat risk >= 0.60 and confidence <= 0.45 as invalid), and aggregate with score = confidence - 0.75\*risk.
-   LLM: provide callLLM abstraction with deterministic dummy default; optionally use OPENAI_API_KEY via feature detection; do not hard-require external keys.
-   Logging: log requestId, routing plan, and per-agent timing; never log full Authorization tokens.
-   Imports: keep using @/ aliases, avoid new junk/placeholder files, and follow repo hygiene rules above.
