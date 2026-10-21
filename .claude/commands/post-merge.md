---
description: After the PR is merged on GitHub, clean up branches and tag the spec.
allowed-tools: Read, Bash(git:*)
---

1. `BRANCH=$(git branch --show-current)`. Stop if on `main` or `dev` and ask which branch was merged.
2. `git fetch origin --prune`.
3. Verify the merge against `origin/dev` (rebase changes hashes, so do not use `git branch --merged`):
   `FILES=$(git diff --name-only $(git merge-base origin/dev $BRANCH) $BRANCH)`
   then `git diff --quiet origin/dev $BRANCH -- $FILES`. No output and exit 0 means merged.
   Otherwise stop with: "This branch has changes that are not on dev yet. Merge the PR first."
4. `git checkout dev && git pull --ff-only`.
5. `git branch -D $BRANCH`. If `origin/$BRANCH` still exists: `git push origin --delete $BRANCH`.
6. For `spec/NNN-...`: `git tag -a spec-NNN-done -m "Spec NNN done"` on `dev`, then `git push origin spec-NNN-done`. Skip with a note if the tag exists. Releases are tagged by `/release`, not here.
7. Summary: merged branch, deleted local and remote, tag pushed, and the next Todo spec from @docs/ROADMAP.md with the command to start it (`/create-spec NNN slug`).
