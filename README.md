# Auto PR Screenshots 📸

Automatically capture and post screenshots of your web app to pull requests. Perfect for visual regression testing, UI/UX reviews, and keeping stakeholders in the loop.

## Features

- 🌐 **URL-based** - Simply provide your app's URL 
- 📸 **Multi-viewport** screenshots (desktop & mobile)
- 🌐 **Multi-browser** support (Chromium, Firefox, WebKit)
- 💬 **Smart PR comments** that update with each push
- 🗂️ **Organized storage** in a dedicated branch
- ⚡ **Simple setup** - no complex configuration needed

## Quick Start

### Basic Usage (Recommended)

```yaml
name: Screenshots
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  screenshots:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      # Start your app (example)
      - run: npm install
      - run: npm run dev &
      
      # Wait for your app to be ready
      - run: npx wait-on http://localhost:3000
      
      - name: Take screenshots
        uses: yoavf/auto-pr-screenshots@v1
        with:
          url: http://localhost:3000
```

### With Custom Configuration

For more control over screenshots, create `.github/screenshots.config.yml`:

```yaml
version: 1

# Screenshot definitions
screenshots:
  - name: home-desktop
    url: http://localhost:3000
    viewport:
      width: 1440
      height: 900
    wait_for: '[data-testid="hero-section"]'
    
  - name: home-mobile
    url: http://localhost:3000
    viewport:
      width: 390
      height: 844
      deviceScaleFactor: 3
    
  - name: dashboard
    url: http://localhost:3000/dashboard
    viewport:
      width: 1440
      height: 900
    steps:
      - click: '[data-testid="login-button"]'
      - fill:
          selector: 'input[name="email"]'
          text: test@example.com
      - fill:
          selector: 'input[name="password"]'
          text: password123
      - click: 'button[type="submit"]'
      - wait_for: '[data-testid="dashboard-loaded"]'

# Output configuration
output:
  branch: gh-screenshots
  comment:
    template: default
    group_by: viewport
```

## Action Inputs

All inputs are optional. The action needs either a `url`, a `config-file`, or will fall back to framework auto-detection.

| Input | Description | Default |
|-------|-------------|---------|
| `url` | URL of your frontend application | - |
| `config-file` | Path to config file | `.github/screenshots.config.yml` |
| `browsers` | Browsers to use (chromium, firefox, webkit) | `chromium` |
| `skip-comment` | Skip posting comment to PR | `false` |
| `fail-on-error` | Fail if screenshot capture fails | `true` |
| `branch` | Branch for storing screenshots | `gh-screenshots` |
| `github-token` | GitHub token | `${{ github.token }}` |
| `working-directory` | Working directory to run the action in | `.` |

## Configuration Options

### Screenshot Configuration

Each screenshot can have:

- `name`: Unique identifier for the screenshot
- `url`: The URL to capture
- `viewport`: Viewport dimensions and settings
  - `width`: Viewport width in pixels
  - `height`: Viewport height in pixels
  - `deviceScaleFactor`: Device scale factor (default: 2)
- `fullPage`: Capture full page (default: false)
- `wait_for`: CSS selector to wait for before capture
- `wait`: Time to wait in milliseconds
- `steps`: Array of interaction steps

### Interaction Steps

Available step types:

- `click`: Click an element
- `fill`: Fill a form field
  - `selector`: CSS selector
  - `text`: Text to enter
- `wait`: Wait for milliseconds
- `wait_for`: Wait for element

## Examples

### Next.js App

```yaml
- name: Setup and start Next.js
  run: |
    npm install
    npm run build
    npm start &
    npx wait-on http://localhost:3000

- name: Take screenshots
  uses: yoavfarhi/auto-pr-screenshots@v1
  with:
    url: http://localhost:3000
```

### Docker Compose Setup

```yaml
- name: Start services
  run: docker-compose up -d

- name: Wait for app
  run: npx wait-on http://localhost:8080

- name: Take screenshots
  uses: yoavfarhi/auto-pr-screenshots@v1
  with:
    url: http://localhost:8080
```

### Multiple Pages

Create a config file with multiple screenshot definitions:

```yaml
version: 1
screenshots:
  - name: home
    url: http://localhost:3000
    viewport:
      width: 1440
      height: 900
  
  - name: about
    url: http://localhost:3000/about
    viewport:
      width: 1440
      height: 900
  
  - name: contact
    url: http://localhost:3000/contact
    viewport:
      width: 1440
      height: 900
```

## Framework Auto-Detection (Fallback)

If no URL or config is provided, the action will attempt to detect and use common frameworks:

- Next.js
- Vite
- Create React App
- Angular
- Vue CLI
- SvelteKit
- Gatsby
- Nuxt

## Troubleshooting

### Screenshots are blank or show loading state

Add a `wait_for` selector to ensure the page is fully loaded:

```yaml
screenshots:
  - name: home
    url: http://localhost:3000
    wait_for: '[data-testid="content-loaded"]'
```

### App takes time to start

Use `wait-on` or similar tools:

```bash
npm run dev &
npx wait-on http://localhost:3000 --timeout 60000
```

### Need to test authenticated pages

Use the `steps` array to interact with your app:

```yaml
steps:
  - click: 'button[id="login"]'
  - fill:
      selector: 'input[name="username"]'
      text: testuser
  - fill:
      selector: 'input[name="password"]'  
      text: testpass
  - click: 'button[type="submit"]'
  - wait_for: '[data-testid="user-dashboard"]'
```

## License

MIT