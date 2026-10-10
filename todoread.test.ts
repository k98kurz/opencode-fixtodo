import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { PluginInput } from "@opencode-ai/plugin"
import { TodoPlugin } from "./todoread.ts"

const MARKER = "## Current Todo List"

interface Todo {
  id: string
  status: string
  priority: string
  content: string
}

function todo(status: string, content: string, priority = "medium"): Todo {
  return { id: `t_${content}`, status, priority, content }
}

interface ClientOptions {
  todos?: Todo[]
  info?: { role: string; mode?: string; summary?: boolean }
  parts?: unknown[]
  todoError?: boolean
  messageError?: boolean
  messageNoData?: boolean
  messages?: Array<{ info?: { role: string; mode?: string; summary?: boolean }; parts?: unknown[] }>
}

function makeClient(opts: ClientOptions = {}): {
  client: Record<string, unknown>
  calls: { todo: number; message: number; todoPaths: string[]; messagePaths: Array<{ id: string; messageID: string }> }
} {
  const calls = { todo: 0, message: 0, todoPaths: [] as string[], messagePaths: [] as Array<{ id: string; messageID: string }> }
  const messages = opts.messages ?? [{ info: opts.info, parts: opts.parts ?? [] }]
  const client = {
    session: {
      todo: async ({ path }: { path: { id: string } }) => {
        calls.todo += 1
        calls.todoPaths.push(path.id)
        if (opts.todoError) throw new Error("todo fetch failed")
        return { data: opts.todos ?? [] }
      },
      message: async ({ path }: { path: { id: string; messageID: string } }) => {
        calls.message += 1
        calls.messagePaths.push({ id: path.id, messageID: path.messageID })
        if (opts.messageError) throw new Error("message fetch failed")
        if (opts.messageNoData) return { data: undefined }
        const next = messages.length > 1 ? messages.shift()! : messages[0]
        return { data: { info: next.info, parts: next.parts ?? [] } }
      },
    },
  }
  return { client, calls }
}

async function makeHooks(client: Record<string, unknown>, options?: Record<string, unknown>) {
  return (await TodoPlugin({ client } as unknown as PluginInput, options)) as {
    tool?: { todoread: { execute(args: unknown, ctx: unknown): Promise<unknown> } }
    "experimental.text.complete"?: (
      input: { sessionID: string; messageID: string; partID: string },
      output: { text: string },
    ) => Promise<void>
  }
}

function executeTool(hooks: Awaited<ReturnType<typeof makeHooks>>, sessionID = "sess_1") {
  return hooks.tool!.todoread.execute({}, { sessionID })
}

function runHook(
  hooks: Awaited<ReturnType<typeof makeHooks>>,
  messageID = "msg_1",
  text = "Summary text",
) {
  const output = { text }
  const promise = hooks["experimental.text.complete"]!(
    { sessionID: "sess_1", messageID, partID: "part_1" },
    output,
  )
  return { output, promise }
}

const SUMMARY_INFO = { role: "assistant", mode: "compaction", summary: true } as const

describe("todoread tool", () => {
  it("returns non-completed count, JSON output, and metadata", async () => {
    const todos = [todo("completed", "done", "high"), todo("pending", "next"), todo("in_progress", "doing")]
    const { client, calls } = makeClient({ todos })
    const hooks = await makeHooks(client)

    const res = (await executeTool(hooks)) as { title: string; output: string; metadata: { todos: Todo[] } }
    assert.equal(res.title, "2 todos")
    assert.deepEqual(JSON.parse(res.output), todos)
    assert.deepEqual(res.metadata.todos, todos)
    assert.deepEqual(calls.todoPaths, ["sess_1"])
  })

  it("returns an empty list when no todos exist", async () => {
    const { client } = makeClient({ todos: [] })
    const hooks = await makeHooks(client)

    const res = (await executeTool(hooks)) as { title: string; output: string; metadata: { todos: Todo[] } }
    assert.equal(res.title, "0 todos")
    assert.deepEqual(JSON.parse(res.output), [])
    assert.deepEqual(res.metadata.todos, [])
  })

  it("returns a failure result instead of throwing when the client fails", async () => {
    const { client } = makeClient({ todoError: true })
    const hooks = await makeHooks(client)

    const res = (await executeTool(hooks)) as { title: string; output: string; metadata: { todos: Todo[] } }
    assert.equal(res.title, "todos")
    assert.equal(res.output, "Failed to read the todo list.")
    assert.deepEqual(res.metadata.todos, [])
  })

  it("is absent when the tool is disabled", async () => {
    const { client } = makeClient()
    const hooks = await makeHooks(client, { tool: false })
    assert.equal(hooks.tool, undefined)
  })
})

describe("compaction hook", () => {
  it("appends the marker and todo lines with status icons", async () => {
    const todos = [
      todo("completed", "ship it", "high"),
      todo("in_progress", "write tests", "high"),
      todo("pending", "review PR"),
      todo("cancelled", "old task", "low"),
    ]
    const { client, calls } = makeClient({ info: SUMMARY_INFO, todos })
    const hooks = await makeHooks(client)
    const { output, promise } = runHook(hooks)

    await promise
    assert.equal(
      output.text,
      `Summary text\n\n${MARKER}\n` +
        "- [x] ship it (completed, high)\n" +
        "- [/] write tests (in_progress, high)\n" +
        "- [ ] review PR (pending, medium)\n" +
        "- [-] old task (cancelled, low)",
    )
    assert.equal(calls.todoPaths[0], "sess_1")
    assert.deepEqual(calls.messagePaths, [{ id: "sess_1", messageID: "msg_1" }])
  })

  it("falls back to [ ] for unknown statuses", async () => {
    const { client } = makeClient({ info: SUMMARY_INFO, todos: [todo("mystery", "odd")] })
    const hooks = await makeHooks(client)
    const { output, promise } = runHook(hooks)

    await promise
    assert.ok(output.text.includes("- [ ] odd (mystery, medium)"))
  })

  it("trims trailing whitespace from the summary text", async () => {
    const { client } = makeClient({ info: SUMMARY_INFO, todos: [todo("pending", "task")] })
    const hooks = await makeHooks(client)
    const { output, promise } = runHook(hooks, "msg_1", "Summary text\n\n")

    await promise
    assert.equal(output.text, `Summary text\n\n${MARKER}\n- [ ] task (pending, medium)`)
  })

  it("leaves non-compaction messages unchanged", async () => {
    const { client, calls } = makeClient({ info: { role: "assistant", mode: "chat", summary: false }, todos: [todo("pending", "task")] })
    const hooks = await makeHooks(client)
    const { output, promise } = runHook(hooks)

    await promise
    assert.equal(output.text, "Summary text")
    assert.equal(calls.todo, 0)
  })

  it("leaves the text unchanged when there are no todos", async () => {
    const { client, calls } = makeClient({ info: SUMMARY_INFO, todos: [] })
    const hooks = await makeHooks(client)
    const { output, promise } = runHook(hooks)

    await promise
    assert.equal(output.text, "Summary text")
    assert.equal(calls.todo, 1)
  })

  it("does not append when a persisted part already carries the marker", async () => {
    const { client, calls } = makeClient({
      info: SUMMARY_INFO,
      parts: [{ type: "text", text: `older text\n${MARKER}\n- [ ] stale (pending, low)` }],
      todos: [todo("pending", "task")],
    })
    const hooks = await makeHooks(client)
    const { output, promise } = runHook(hooks)

    await promise
    assert.equal(output.text, "Summary text")
    assert.equal(calls.todo, 0)
  })

  it("does not reject when the message fetch fails", async () => {
    const { client } = makeClient({ messageError: true })
    const hooks = await makeHooks(client)
    const { output, promise } = runHook(hooks)

    await promise
    assert.equal(output.text, "Summary text")
  })

  it("does not reject when the todo fetch fails", async () => {
    const { client } = makeClient({ info: SUMMARY_INFO, todoError: true })
    const hooks = await makeHooks(client)
    const { output, promise } = runHook(hooks)

    await promise
    assert.equal(output.text, "Summary text")
  })

  it("leaves the text unchanged when the message fetch returns no data", async () => {
    const { client, calls } = makeClient({ messageNoData: true, todos: [todo("pending", "task")] })
    const hooks = await makeHooks(client)

    const first = runHook(hooks)
    await first.promise
    assert.equal(first.output.text, "Summary text")
    assert.equal(calls.todo, 0)

    const second = runHook(hooks)
    await second.promise
    assert.equal(second.output.text, "Summary text")
    assert.equal(calls.message, 2, "no-data results must not be cached as negatives")
  })

  it("is absent when compaction rewriting is disabled", async () => {
    const { client } = makeClient()
    const hooks = await makeHooks(client, { compaction: false })
    assert.equal(hooks["experimental.text.complete"], undefined)
  })
})

describe("summary cache", () => {
  it("fetches the message info only once per messageID", async () => {
    const { client, calls } = makeClient({
      messages: [
        { info: SUMMARY_INFO, parts: [] },
        { info: { role: "assistant", mode: "chat", summary: false }, parts: [] },
      ],
      todos: [todo("pending", "task")],
    })
    const hooks = await makeHooks(client)

    const first = runHook(hooks, "msg_cache")
    await first.promise
    assert.ok(first.output.text.includes(MARKER))

    const second = runHook(hooks, "msg_cache")
    await second.promise
    assert.ok(second.output.text.includes(MARKER), "cached compaction status must keep appending")
    assert.equal(calls.message, 2, "info is fetched once; the second call only re-reads parts")
    assert.deepEqual(calls.messagePaths, [{ id: "sess_1", messageID: "msg_cache" }, { id: "sess_1", messageID: "msg_cache" }])
  })

  it("caches negative results so ordinary messages cost one GET", async () => {
    const { client, calls } = makeClient({
      info: { role: "assistant", mode: "chat", summary: false },
      todos: [todo("pending", "task")],
    })
    const hooks = await makeHooks(client)

    const first = runHook(hooks, "msg_chat")
    await first.promise
    assert.equal(first.output.text, "Summary text")
    assert.equal(calls.message, 1)
    assert.equal(calls.todo, 0)

    const second = runHook(hooks, "msg_chat")
    await second.promise
    assert.equal(second.output.text, "Summary text")
    assert.equal(calls.message, 1, "negative result must be cached — no second GET")
    assert.equal(calls.todo, 0)
  })
})
