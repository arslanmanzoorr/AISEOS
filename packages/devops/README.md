# @seos/devops

Phase 6 of the Engineering OS. SRE practices for solo founders.

## Tools

- **generate_infra** — Generate deployment infrastructure (Dockerfile, CI pipeline, health check) for a service.
- **generate_observability** — Generate logging, metrics and tracing scaffolding for a service.
- **check_reliability** — Check whether backup, restore and rollback strategies are defined; reports what's missing.

## Register with Claude Code

```json
{
  "mcpServers": {
    "seos-devops": {
      "command": "node",
      "args": ["./packages/devops/dist/index.js"]
    }
  }
}
```

> Generators emit conventional templated scaffolding, not provider-specific IaC — adapt to your platform.
