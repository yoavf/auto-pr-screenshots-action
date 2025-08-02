#!/usr/bin/env tsx

import * as fs from 'node:fs';
// TypeScript test script to run the action locally
import * as path from 'node:path';

// Set up environment variables to simulate GitHub Actions
process.env.GITHUB_ACTIONS = 'true';
process.env.CI = 'true';
process.env.GITHUB_REPOSITORY = 'test-owner/test-repo';
process.env.GITHUB_REF = 'refs/pull/123/merge';
process.env.GITHUB_SHA = 'abcd1234';
process.env.GITHUB_RUN_ID = '12345';
process.env.GITHUB_RUN_NUMBER = '1';
process.env.GITHUB_EVENT_NAME = 'pull_request';
process.env.GITHUB_EVENT_PATH = path.join(__dirname, 'test-event.json');
process.env.LOCAL_TEST = 'true'; // Special flag for local testing

// Set action inputs
process.env.INPUT_CONFIG_FILE = '.github/screenshots.config.yml';
process.env.INPUT_BROWSERS = 'chromium';
process.env.INPUT_SKIP_COMMENT = 'true'; // Skip PR comment for local testing
process.env.INPUT_FAIL_ON_ERROR = 'true';
process.env.INPUT_BRANCH = 'gh-screenshots-test';
process.env.INPUT_GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'fake-token-for-local-testing';

// For better debugging
process.env.RUNNER_DEBUG = '1';

// Create a fake event payload
const eventPayload = {
  pull_request: {
    number: 123,
    head: {
      ref: 'feature-branch',
      sha: 'abcd1234',
    },
    base: {
      ref: 'main',
    },
  },
};
fs.writeFileSync('test-event.json', JSON.stringify(eventPayload, null, 2));

console.log('🧪 Testing Auto PR Screenshots locally...\n');
console.log('Environment:', {
  cwd: process.cwd(),
  node: process.version,
});

// Change to test project directory
const testProjectPath = process.argv[2];
if (!testProjectPath) {
  console.error('Usage: pnpm test:local /path/to/your/project');
  process.exit(1);
}

process.chdir(testProjectPath);
console.log('Changed to directory:', process.cwd());
console.log('');

// Import and run the action
import('./src/index')
  .then(({ run }) => {
    run()
      .then(() => {
        console.log('\n✅ Test completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Action failed:', error);
        process.exit(1);
      });
  })
  .catch((error) => {
    console.error('Failed to import action:', error);
    process.exit(1);
  });
