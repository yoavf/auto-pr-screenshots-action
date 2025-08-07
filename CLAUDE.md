# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Auto PR Screenshots is a GitHub Action that automatically captures screenshots of web applications and posts them to pull requests. It uses Playwright for cross-browser screenshot capture and supports multiple viewports, browsers, and interaction steps.

## Common Development Commands

### Build and Development
```bash
# Install dependencies
pnpm install

# Build the action (bundles to dist/index.js)
pnpm build

# Development build with watch mode
pnpm dev

# Format and lint code
pnpm format
pnpm lint

# Type checking
pnpm typecheck
```

### Testing
```bash
# Run local test script
pnpm test:local

# The test script simulates GitHub Actions environment locally
# Configure test parameters in scripts/dev-test/test-local.ts
```

## Architecture Overview

### Core Flow
1. **Entry Point** (`src/index.ts`): GitHub Action entry that orchestrates the workflow
2. **Configuration Loading** (`src/config-loader.ts`): Loads from YAML file or URL input
3. **Framework Detection** (`src/framework-detector.ts`): Auto-detects frameworks when no config provided
4. **Screenshot Capture** (`src/screenshot-capture.ts`): Uses Playwright to capture screenshots
5. **File Upload** (`src/screenshot-uploader.ts`): Uploads to GitHub branch
6. **Comment Posting** (`src/comment-poster.ts`): Posts organized PR comments

### Key Design Patterns
- **Type Safety**: All modules use TypeScript interfaces from `src/types.ts`
- **Error Handling**: Non-critical errors are logged but don't fail the action (unless `fail-on-error` is set)
- **Configuration Flexibility**: Supports simple URL input, YAML config, or framework auto-detection
- **Modular Architecture**: Each responsibility is isolated in its own module

### GitHub Action Integration
- Uses `@actions/core` for input/output handling
- Uses `@actions/github` with Octokit for API operations
- Requires `GITHUB_TOKEN` with write permissions for PR comments and content

## Code Style Guidelines

- **Formatter**: Biome (configuration in `biome.json`)
- **Style**: 2-space indentation, single quotes, trailing commas
- **Line Width**: 100 characters maximum
- **TypeScript**: Strict mode enabled, avoid `any` types
- **Imports**: Use absolute imports from `src/`

## Testing Approach

For local testing:
1. Set environment variables in `scripts/dev-test/test-local.ts`
2. The script simulates GitHub Actions environment
3. Test against real repositories using a GitHub token
4. Verify screenshot uploads and PR comments

## Important Notes

- **Build Before Commit**: Always run `pnpm build` before committing (handled by prepare script)
- **Node Version**: Action runs on Node.js v24 runtime
- **Bundle Size**: Keep dependencies minimal as everything bundles into `dist/index.js`
- **Playwright**: Browser binaries are downloaded at runtime, not bundled
- **Error Messages**: Include actionable information for users debugging their workflows