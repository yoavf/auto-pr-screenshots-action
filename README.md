# Auto PR Screenshots 📸

Automatically capture and post screenshots of your web app to pull requests.
Perfect for visual regression testing, UI/UX reviews, and keeping tabs of AI generated PRs.

<img width="767" height="778" alt="Screen showing comment posted by the Auto PR Screenshots GitHub action" src="https://github.com/user-attachments/assets/ab76177d-648a-452d-b548-29a893c1fd54" />

## Features

- ⚡ **Simple setup** - no complex configuration needed
- 💬 **Smart PR comments** that update with each push
- 🗂️ **Organized storage** in a dedicated branch
- 📸 **Multi-viewport** screenshots (desktop & mobile)
- 🌐 **Multi-browser** support (Chromium, Firefox, WebKit)

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
      contents: write      # Required for pushing screenshots
      pull-requests: write # Required for posting comments
    
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
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Required Permissions

This action requires specific permissions to function properly:

- **`contents: write`** - Required to create and push to the screenshots branch
- **`pull-requests: write`** - Required to post comments on pull requests

**Important:** You must always provide the `github-token` input, even when permissions are set. The token is required for authentication, while permissions define what the token can do.

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

The action needs either a `url`, a `config-file`, or will fall back to framework auto-detection.

| Input | Description | Default | Required |
|-------|-------------|---------|----------|
| `github-token` | GitHub token for posting comments and pushing screenshots | - | **Yes** |
| `url` | URL of your frontend application | - | No* |
| `config-file` | Path to config file | `.github/screenshots.config.yml` | No* |
| `browsers` | Browsers to use (chromium, firefox, webkit) | `chromium` | No |
| `skip-comment` | Skip posting comment to PR | `false` | No |
| `fail-on-error` | Fail if screenshot capture fails | `true` | No |
| `branch` | Branch for storing screenshots | `gh-screenshots` | No |
| `working-directory` | Working directory to run the action in | `.` | No |
| `show-attribution` | Show attribution link in PR comments | `false` | No |
| `skip-label` | Label name that when present on PR will skip the action | - | No |
| `skip-wip-titles` | Skip PRs with [wip] in title (case insensitive) | `true` | No |

*\* At least one of `url`, `config-file`, or auto-detection must work for the action to run.*

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

### Skip Configuration

You can configure when to skip screenshot capture:

#### Action Inputs

- `skip-label`: If this label is present on the PR, screenshots will be skipped
- `skip-wip-titles`: Skip PRs with `[wip]` in title (case insensitive). Default: `true`

#### Config File

```yaml
version: 1

skip:
  # Skip if PR has this label
  label: "skip-screenshots"
  
  # Skip PRs with [wip] in title (default: true)
  wipTitles: false  # Set to false to disable WIP skipping

screenshots:
  # ... your screenshot configs
```

**Examples of WIP titles that are skipped by default:**
- `[WIP] Feature implementation`
- `[wip] Bug fix in progress` 
- `Feature [WIP] needs review`

To disable WIP title skipping, either:
1. Set `skip-wip-titles: false` in action inputs, or
2. Set `wipTitles: false` in your config file

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
  uses: yoavf/auto-pr-screenshots-action@v1
  with:
    url: http://localhost:3000
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Docker Compose Setup

```yaml
- name: Start services
  run: docker-compose up -d

- name: Wait for app
  run: npx wait-on http://localhost:8080

- name: Take screenshots
  uses: yoavf/auto-pr-screenshots-action@v1
  with:
    url: http://localhost:8080
    github-token: ${{ secrets.GITHUB_TOKEN }}
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

#### Screenshots are blank or show loading state

Add a `wait_for` selector to ensure the page is fully loaded:

```yaml
screenshots:
  - name: home
    url: http://localhost:3000
    wait_for: '[data-testid="content-loaded"]'
```

#### App takes time to start

Use `wait-on` or similar tools:

```bash
npm run dev &
npx wait-on http://localhost:3000 --timeout 60000
```

#### Need to test authenticated pages

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

#### Permission Errors

If you see the error:
```
Error: Resource not accessible by integration
```

## License

MIT
