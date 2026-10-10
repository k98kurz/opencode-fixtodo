# About this Project

This is a plugin for OpenCode v1 (NOT v2) that restores the `todoread` tool and
automatically appends the current todo list to the end of compaction messages
(summaries that are reported as the AI's 1st message in the conversation history
post-compaction).

# Forbidden Commands

- NEVER, under ANY CIRCUMSTANCES, run `pip install` on ANYTHING. NEVER.
- NEVER, under ANY CIRCUMSTANCES, run `npm install` on ANYTHING. NEVER.
- NEVER, under ANY CIRCUMSTANCES, run `git checkout` on a file. NEVER.
- NEVER, under ANY CIRCUMSTANCES, run `git stash`. NEVER.
- NEVER, under ANY CIRCUMSTANCES, run `git reset` or `git reset --hard`. NEVER.
- Do NOT run `git add` -- leave changes unstaged for review.

# Build agent guidelines

- Use a todo list for any non-trivial or long-running task.
  - If you have access to BOTH the todoread and todowrite tools, use them.
  - If you lack access to one of those tools, use a todo.md file.
  - ALWAYS check both todoread and the todo.md file when continuing after compaction.
- When refactoring, verify that it works with one case before copying throughout.

# Memory

Major architectural decisions, best practices, and other things worth remembering
long-term are stored in docs/memory.md.

# Changelog

Do NOT record changes to intermediate states in the change log. ONLY record things
that ACTUALLY CHANGE BETWEEN RELEASES in the changelog.

# Discovery of Development Practices

If you encounter a substantial issue that bogged down development, in particular
something that is likely to cause problems in the future, and you discovered a
solution, create an entry in docs/memory.md concisely explaining the problem and
solution for future development efforts, and alert your human that you did. Such
entries must be concise and contain actionable information.
