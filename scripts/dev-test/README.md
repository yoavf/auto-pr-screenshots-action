# Development Testing Scripts

This directory contains scripts and utilities for testing the action during development.

## Scripts

### test-local.ts
Main script for testing the action locally without GitHub Actions environment.

```bash
pnpm test:local ../path/to/your/project
```

### test-todo-house.sh
Example script showing how to test with a Next.js app that requires environment variables.

```bash
./scripts/dev-test/test-todo-house.sh
```

### test-event.json
Mock GitHub event data used by the test scripts to simulate a PR context.

### test-workflow.yml
Example workflow configuration showing how to use the action in a real GitHub workflow.

## Usage

1. Build the action first:
   ```bash
   pnpm build
   ```

2. Run a test against your project:
   ```bash
   pnpm test:local ../your-project
   ```

3. For projects requiring environment variables, create a test script like `test-todo-house.sh`

## Tips

- Use `RUNNER_DEBUG=1` to see detailed logs
- Screenshots are saved in the target project's `screenshots/` directory
- The upload step will fail locally (expected) since there's no real GitHub token