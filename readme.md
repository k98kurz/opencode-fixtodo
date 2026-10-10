# opencode-fixtodo

## Status

Open issues can be tracked [here](https://github.com/k98kurz/opencode-fixtodo/issues).
Historical changes can be found in the
[changelog](https://github.com/k98kurz/opencode-fixtodo/blob/master/changelog.md).


## Usage

### Installation

Add the plugin to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-fixtodo"]
}
```

A local checkout works too: use the file path instead, e.g.
`"./path/to/todoread.ts"`.

### Configuration

Options are passed via the tuple form of the plugin entry (the options object
is scoped to the plugin, so keys are flat):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    ["opencode-fixtodo", { "compaction": false, "tool": true }]
  ]
}
```

| Option      | Default | Description                                                          |
| ----------- | ------- | -------------------------------------------------------------------- |
| `compaction` | `true`  | Append the current todo list to compaction summary messages.         |
| `tool`       | `true`  | Register the `todoread` tool so the agent can read the todo list.    |

Both options default to `true`; omit either to keep the default. Config is
loaded at startup, so restart opencode after changing it.

### Testing

First, clone the repo, set up ...

```bash
# commands
```

## Contributing

Check out the [Pycelium discord server](https://discord.gg/b2QFEJDX69). If you
experience a problem, please discuss it on the Discord server. All suggestions
for improvement are also welcome, and the best place for that is also Discord.
If you experience a bug and do not use Discord, open an issue or discussion on
Github.

## ISC License

Copyright (c) 2026 Jonathan Voss (k98kurz)

Permission to use, copy, modify, and/or distribute this software
for any purpose with or without fee is hereby granted, provided
that the above copyright notice and this permission notice appear in
all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL
WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR
CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
