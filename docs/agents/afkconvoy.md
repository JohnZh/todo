# afkconvoy config

```yaml
base_branch: "main"
gate_command: ./gate.sh
gate_seconds: 900
concurrency: 3
```

The gate runs `npm ci`, `tsc --noEmit` and `vitest run`, then `swift build`
and `swift test` for the Mac app in `mac/`. Label an issue
`ready-for-agent` to hand it to the fleet; one it cannot finish comes back
as `ready-for-human`.
