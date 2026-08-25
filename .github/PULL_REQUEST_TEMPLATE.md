# What this changes

<!-- What the change does and why. Link the issue it closes, if there is one. -->

Closes #

## How you verified it

<!--
Not "tests pass" - what you actually observed. If it is visible in the UI, say what you saw on
screen; if it changes agent behaviour, paste the request or command you ran against a real host.
-->

## Checks

All four run in CI, so a PR that skips them will fail there instead:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes

## If this touches `agent/server.js`

The agent runs as root and is the project's security boundary. Delete this section if it does not
apply.

- [ ] Every new endpoint requires the bearer token (only `/health` may not)
- [ ] Filesystem access goes through `resolveSafePath()`
- [ ] Child processes use `execFile` with an argument array, never string concatenation into a shell
- [ ] Added a test in `tests/agentServer.test.ts`
- [ ] Bumped `AGENT_VERSION` if the API surface changed, so a stale install is detectable

## If this adds or changes a reading shown in the UI

- [ ] Every value comes from the host - nothing is defaulted, guessed or filled in when the agent
      cannot determine it. A field that is genuinely unknown is `null`, and the UI says so.
- [ ] A loading state is rendered while the request is in flight, so an empty result is not
      mistaken for "nothing there".

## Anything reviewers should know

<!-- Trade-offs you made, things you deliberately left out, follow-up work. -->
