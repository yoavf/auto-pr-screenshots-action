# Testing Auto PR Screenshots Locally

## Prerequisites

1. Install dependencies in the action directory:
   ```bash
   cd /path/to/auto-pr-screenshots
   pnpm install
   ```

2. Build the action:
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
- Change URL: `process.env.INPUT_URL = 'http://localhost:8080'`
- Change browsers: `process.env.INPUT_BROWSERS = 'chromium,firefox'`
- Use a config file: `process.env.INPUT_CONFIG_FILE = 'my-config.yml'`
- Test upload (needs real GitHub token): `process.env.INPUT_SKIP_COMMENT = 'false'`

## Method 2: Test with a URL

The simplest way to test - just provide a URL:

```bash
# Start your app first
cd your-project
npm run dev &

# Wait for it to be ready
npx wait-on http://localhost:3000

# Run the action
cd /path/to/auto-pr-screenshots
pnpm test:local /path/to/your/project
```

## Method 3: Test with Custom Config

1. **Create a test config** in your project:

   ```bash
   cd /path/to/your/project
   mkdir -p .github
   ```

   Create `.github/screenshots.config.yml`:
   ```yaml
   version: 1
   screenshots:
     - name: home-large
       url: http://localhost:3000
       viewport:
         width: 1920
         height: 1080
       wait_for: '[data-testid="hero-section"]'
       
     - name: mobile-home
       url: http://localhost:3000
       viewport:
         width: 390
         height: 844
         deviceScaleFactor: 3
       
     - name: form-interaction
       url: http://localhost:3000/contact
       viewport:
         width: 1440
         height: 900
       steps:
         - click: 'button[data-testid="open-form"]'
         - wait: 500
         - fill:
             selector: 'input[name="email"]'
             text: 'test@example.com'
         - wait_for: '[data-testid="form-ready"]'
   ```

2. **Run the test**:
   ```bash
   pnpm test:local /path/to/your/project
   ```

## Method 4: Test Framework Auto-Detection

To test the fallback framework detection:

```bash
# Go to a Next.js, Vite, or other supported framework project
cd /path/to/nextjs-project

# Run without URL or config - should detect framework
cd /path/to/auto-pr-screenshots
pnpm test:local /path/to/nextjs-project
```

Note: Framework detection assumes your app runs on default ports (e.g., 3000 for Next.js).

## Debugging Tips

1. **Enable debug logging**:
   ```bash
   export RUNNER_DEBUG=1
   export DEBUG=screenshots:*
   ```

2. **Test different browsers**:
   ```bash
   export INPUT_BROWSERS='chromium,firefox,webkit'
   pnpm test:local /path/to/your/project
   ```

3. **Test error handling**:
   ```bash
   # Test with wrong URL
   export INPUT_URL='http://localhost:9999'
   export INPUT_FAIL_ON_ERROR='false'
   pnpm test:local /path/to/your/project
   ```

## Common Issues

### App not ready
- Make sure your app is running before starting the action
- Use `wait-on` to ensure the app is ready:
  ```bash
  npx wait-on http://localhost:3000 --timeout 60000
  ```

### Screenshots are blank
- Add a `wait_for` selector to ensure the page is loaded
- Increase wait times in your config
- Check if your app requires authentication

### Wrong viewport
- Specify exact viewport dimensions in config
- Use `deviceScaleFactor` for high-DPI screenshots

### Interactions not working
- Verify selectors are correct
- Add wait times between steps
- Use `wait_for` after interactions

## Testing Checklist

- [ ] URL-based capture works
- [ ] Config file is loaded correctly
- [ ] Multiple viewports work
- [ ] Multiple browsers work
- [ ] Interactions (click, fill, wait) work
- [ ] wait_for selectors work
- [ ] Full page screenshots work
- [ ] Error handling with fail-on-error: false
- [ ] Framework auto-detection (when no URL/config)
- [ ] Custom branch names
- [ ] Skip comment functionality