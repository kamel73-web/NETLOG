---
name: npm firewall recovery
description: Recover when Replit's package firewall blocks a vulnerable transitive npm dependency.
---

When `npm ci` is blocked by Replit's package firewall on a vulnerable transitive dependency, inspect which direct dependency brings it in and check for a patched, semver-compatible release. A lockfile can keep selecting a blocked version even when the parent package's allowed range includes the fix; use a package-manager override only when needed to resolve that safely. Never bypass the firewall.

**Why:** the post-merge hook initially failed because the lockfile selected a vulnerable `proxy-addr` release that the firewall denied.

**How to apply:** inspect the install error and dependency tree, update the direct parent to a safe compatible release, update the lockfile to the patched transitive version, then rerun the post-merge hook.
