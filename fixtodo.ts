import type { Message, Part } from "@opencode-ai/sdk"
import { type Plugin, tool } from "@opencode-ai/plugin"

const DESCRIPTION = `Use this tool to read the current to-do list for the session.
This tool should be used after compactions or whenever you're unsure what to do next.

Usage:
- This tool takes in no parameters.
- Returns a list of todo items with their status, priority, and content
- If no todos exist yet, an empty list will be returned`

const MARKER = "## Current Todo List"

interface FixtodoOptions {
  compaction?: boolean
  tool?: boolean
}

const ICONS: Record<string, string> = {
  pending: "[ ]",
  in_progress: "[/]",
  completed: "[x]",
  cancelled: "[-]",
}

export const FixtodoPlugin: Plugin = async ({ client }, options) => {
  const opts = options as FixtodoOptions | undefined
  const compactionEnabled = opts?.compaction ?? true
  const toolEnabled = opts?.tool ?? true

  // messageID -> whether the message is a compaction summary; negative results are
  // cached so ordinary turns cost at most one local GET per assistant message
  const summaries = new Map<string, boolean>()

  return {
    ...(toolEnabled
      ? {
          tool: {
            todoread: tool({
              description: DESCRIPTION,
              args: {},
              async execute(_args, ctx) {
                try {
                  const res = await client.session.todo({ path: { id: ctx.sessionID } })
                  const todos = res.data ?? []
                  return {
                    title: `${todos.filter((x) => x.status !== "completed").length} todos`,
                    output: JSON.stringify(todos, null, 2),
                    metadata: { todos },
                  }
                } catch {
                  return {
                    title: "todos",
                    output: "Failed to read the todo list.",
                    metadata: { todos: [] },
                  }
                }
              },
            }),
          },
        }
      : {}),

    // Rewrites the compaction summary text before it is persisted so the live todo
    // list is anchored at the end of every autocompaction summary. The rewritten
    // text is durable: later compactions merge it via the prior-summary path.
    ...(compactionEnabled
      ? {
          "experimental.text.complete": async (
            input: { sessionID: string; messageID: string; partID: string },
            output: { text: string },
          ) => {
            try {
              let known = summaries.get(input.messageID)
              let parts: Part[] | undefined
              if (known === undefined) {
                const res = await client.session.message({
                  path: { id: input.sessionID, messageID: input.messageID },
                })
                if (!res.data) return
                const info: Message = res.data.info
                known = info.role === "assistant" && info.mode === "compaction" && info.summary === true
                summaries.set(input.messageID, known)
                parts = res.data.parts
              }
              if (!known) return
              // Multi-part guard: skip if a previously persisted part already carries the
              // marker (the current part's final text is only persisted after this hook).
              if (!parts) {
                parts = (await client.session.message({ path: { id: input.sessionID, messageID: input.messageID } })).data
                  ?.parts
              }
              if (!parts) return
              const persisted = parts
                .filter((part): part is Extract<Part, { type: "text" }> => part.type === "text")
                .map((part) => part.text)
                .join("\n\n")
              if (persisted.includes(MARKER)) return

              const todos = (await client.session.todo({ path: { id: input.sessionID } })).data ?? []
              if (todos.length === 0) return
              const lines = todos.map(
                (todo) => `- ${ICONS[todo.status] ?? "[ ]"} ${todo.content} (${todo.status}, ${todo.priority})`,
              )
              output.text = `${output.text.trimEnd()}\n\n${MARKER}\n${lines.join("\n")}`
            } catch {
              // Never reject: a failed trigger aborts the processor turn.
            }
          },
        }
      : {}),
  }
}
