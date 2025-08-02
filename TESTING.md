# Testing Auto PR Screenshots Locally

## Prerequisites

1. Install dependencies in the action directory:
   ```bash
   cd /path/to/auto-pr-screenshots
   pnpm install
   ```

2. Build the action (optional, for testing compiled version):
   ```bash
   pnpm build
   ```

## Method 1: Direct TypeScript Testing (Recommended)

This is the fastest way to test during development:

```bash
# Install tsx globally (if not already installed)
pnpm add -g tsx

# Run the test script
pnpm test:local /path/to/your/project
```

### What it does:
- Sets up fake GitHub Actions environment
- Changes to your project directory
- Runs the action
- Skips PR comment posting (local testing)
- Shows debug output

### Customize the test:

Edit `test-local.ts` to:
- Change browsers: `process.env.INPUT_BROWSERS = 'chromium,firefox'`
- Use a config file: `process.env.INPUT_CONFIG_FILE = 'my-config.yml'`
- Test upload (needs real GitHub token): `process.env.INPUT_SKIP_COMMENT = 'false'`

## Method 2: Test with a Real Project

1. **Create a test config** in your project:

   ```bash
   cd /path/to/your/project
   mkdir -p .github
   ```

   Create `.github/screenshots.config.yml`:
   ```yaml
   version: 1
   screenshots:
     - name: test-home
       url: http://localhost:3000
       viewport: desktop
   ```

2. **Run the test**:
   ```bash
   cd /path/to/auto-pr-screenshots
   pnpm test:local /path/to/your/project
   ```

## Method 3: Using act (GitHub Actions Emulator)

Install [act](https://github.com/nektos/act):
```bash
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

Run the test workflow:
```bash
cd /path/to/auto-pr-screenshots
act pull_request -W test-workflow.yml
```

## Method 4: Test in a Real Repository

1. **Fork/create a test repository**
2. **Copy the action files**:
   ```bash
   cp -r /path/to/auto-pr-screenshots/.github/workflows/test-workflow.yml your-repo/.github/workflows/
   ```

3. **Create a PR in your test repo**
4. **Use the local action**:
   ```yaml
   - uses: ./path/to/auto-pr-screenshots
   ```

## Debugging Tips

1. **Enable debug logging**:
   ```bash
   export RUNNER_DEBUG=1
   export DEBUG=screenshots:*
   ```

2. **Check framework detection**:
   ```bash
   # Just test framework detection
   cd your-project
   node -e "require('/path/to/auto-pr-screenshots/dist/index.js')"
   ```

3. **Test without services**:
   Create a minimal config that doesn't start services:
   ```yaml
   version: 1
   services: []  # No services
   screenshots:
     - name: test
       url: https://example.com
       viewport: desktop
   ```

## Common Issues

### Port already in use
- Stop any running dev servers
- Or change the port in your config

### Screenshots not capturing
- Check the `wait_for` selectors
- Increase wait times
- Use `RUNNER_DEBUG=1` for detailed logs

### Framework not detected
- Check package.json has the framework dependency
- Use a config file to override detection

### Missing environment variables
- The action will clearly report missing env vars in the logs
- Set required variables before running:
  ```bash
  export NEXT_PUBLIC_API_URL="http://localhost:3001"
  pnpm test:local ../your-project
  ```
- Or create a test script (see test-todo-house.sh for example)

### Process hangs after error
- Fixed in latest version - processes are properly cleaned up
- If still hanging, use Ctrl+C to exit

## Testing Checklist

- [ ] Framework detection works
- [ ] Services start correctly
- [ ] Screenshots are captured
- [ ] Multiple viewports work
- [ ] Browser interactions work (click, fill)
- [ ] Error handling works (invalid config, missing selectors)
- [ ] Debug output is helpful
- [ ] Missing environment variables are clearly reported
- [ ] Action fails with 0 screenshots (regardless of fail-on-error)
- [ ] Services timeout after max 30 seconds
- [ ] Processes are properly cleaned up on exit