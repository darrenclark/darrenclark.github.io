---
title: "Bashing Safely: set -euo pipefail"
date: 2022-03-05T17:27:32-05:00
tags: ['shell']
draft: true
---

<div style='text-align: center'>

*'Bashing Safely' is a series about writing safe and maintainable shell scripts.*

</div>

---

Out of the box, `bash` and other shells are configured for interactive use.

This includes conveniences like not crashing when a command fails.  This is
great when running commands by hand - how annoying would it be if we had to
restart our terminal every time we typo-ed a command?  However, this behaviour
isn't really suitable for shell scripts.  If one command fails, generally we
probably want the whole shell script to exit.

For that reason, and a few more, I recommend starting all `bash` scripts with:

```shell
#!/usr/bin/env bash

set -euo pipefail
```

The `set -euo pipefail` tells `bash` to be stricter when it comes to errors.
Read on for the specifics.

# Aside: exit codes

Every command returns a "exit code" to signal if it succeeded or not. It's a
number between 0-255, with:

- `0` means the command completed successfully.

- `1`-`255` means the command failed.  Some programs will return different
numbers to signal different errors.

We can use `echo $?` to get the previous command's exit code.  For example:

```bash
# changing to our home directory successfully:

$ cd ~/
$ echo $?
0
```

```bash
# trying to delete a file that doesn't exit:

$ rm /tmp/four-oh-four
rm: /tmp/four-oh-four: No such file or directory
$ echo $?
1
```

```bash
# trying to run a program that doesn't exist:

$ /bin/four-oh-four
bash: /bin/four-oh-four: No such file or directory
$ echo $?
127
```

A key part of writing reliable shell scripts - like writing almost any
software - is properly handling errors (non-zero exit codes).

# set -e

`set -e` tells `bash` to exit a script immediately if any "statement" fails.

Check out this simple script:

```shell
#!/usr/bin/env bash

set -e

rm /tmp/four-oh-four

echo "Done"
```

When we run it, the `rm` command returns a non-zero exit code, and the script
is halted before the `echo` command.

```
$ /tmp/set_e.sh
rm: /tmp/four-oh-four: No such file or directory
```

Try seeing what happens if `set -e` is removed!

## "Catching" errors

Sometimes errors are expected and we may not want our script to exit.  We can
use the `||` operator to handle these situations:

```bash
command_one || command_two
```

`bash` will run `command_one` *or* (only if it failed), run `command_two`.

Combined with `true` (a program that always exits successfully), it's easy to
ignore non-fatal errors that may happen.  For example:

```bash
#!/usr/bin/env bash

set -e

# cleanup from previous runs of this script (if necessary)
rm -rf /tmp/some-cache || true
mkdir /tmp/some-cache

# ... rest of script ...
```

# set -u

`set -u` tells `bash` to exit a script immediately if an undefined variable
is used.

By default, an undefined variable becomes an empty string:

```bash
$ echo "Hello, $person."
Hello, .

# and if we set $person
$ person=Bob
$ echo "Hello, $person."
Hello, Bob.
```

This is quite

# set -o pipefail

