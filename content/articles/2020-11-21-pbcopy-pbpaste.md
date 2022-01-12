---
title: "Copying and pasting to terminal programs on macOS"
date: 2020-11-21T17:43:07-05:00
draft: false
summary: "Two of my favourite shell commands on macOS are <code>pbcopy</code> and <code>pbpaste</code>."
tags: ["macos", "shell", "terminal"]
---

Two of my favourite shell commands on macOS are `pbcopy` and `pbpaste`.

`pbcopy` *("pasteboard-copy")* copies text from standard input, just like
Command-C.

```sh
echo "Hello, world" | pbcopy
```

Similarily, `pbpaste` *("pasteboard-paste")* pastes the contents of the
pasteboard to standard output - like Command-V.

```sh
pbpaste
# Hello, world
```

This is the same pasteboard the rest of macOS uses, making it easy to copy/paste
text to and from GUI programs.

The real beauty of these two becomes apparent when we compose them with other
tools, just like the [founders of Unix intended](https://en.wikipedia.org/wiki/Unix_philosophy).

Read on for some of my favourite use cases, pulled straight from my shell
history.


### Formatting JSON

Using [`jq`](https://stedolan.github.io/jq/) to format JSON:

```sh
# Pasteboard before:
# {"x":1  , "y" :  2, "z":3}

pbpaste | jq . | pbcopy

# Pasteboard after:
# {
#   "x": 1,
#   "y": 2,
#   "z": 3
# }
```

### Decoding base64

For peeking inside random base64 encoded values:

```sh
# Pasteboard:
# SGVsbG8sIHdvcmxkIQo=

pbpaste | base64 -D
# Hello, world!
```

### Uppercasing a string

Read as:

- transform - `tr`
- all lowercase characters - `'[[:lower:]]'`
- to uppercase - `'[[:upper:]]'`

```sh
# Pasteboard before:
# c600a378-2055-4f2f-82a2-fd00a6ea9629

pbpaste | tr '[[:lower:]]' '[[:upper:]]' | pbcopy

# Pasteboard after:
# C600A378-2055-4F2F-82A2-FD00A6EA9629
```

### How long is that string?

The `wc` (word count) command can be used to count characters (`-c`), lines
(`-l`), and of course, words (`-w`).

```sh
# Pasteboard contents:
# The quick brown fox jumps over the lazy dog

pbpaste | wc -w
#      9

pbpaste | wc -c
#      43
```

### And my favourite, `x = x`

Got a bunch of pesky text formatting in your pasteboard? Want to get rid of it?

```sh
pbpaste | pbcopy
```

---

Thanks for reading!  Got any novel use cases for `pbcopy`/`pbpaste`? I'd love to
hear about them, I'm [@darrenclark](https://twitter.com/darrenclark) on Twitter.
