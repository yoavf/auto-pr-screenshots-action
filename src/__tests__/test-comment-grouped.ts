import * as github from '@actions/github';
import { generateCommentBody } from '../comment-poster';
import type { Config, UploadedScreenshot } from '../types';

// Mock data for testing desktop screenshots (with "desktop" in name)
const mockScreenshots: UploadedScreenshot[] = [
  {
    name: 'homepage-desktop',
    browser: 'chromium',
    url: 'https://example.com/screenshot1.png'
  },
  {
    name: 'products-desktop',
    browser: 'firefox', 
    url: 'https://example.com/screenshot2.png'
  },
  {
    name: 'checkout-mobile',
    browser: 'chromium',
    url: 'https://example.com/screenshot3.png'
  }
];

const mockConfig: Config = {
  version: 1,
  screenshots: [
    {
      name: 'homepage-desktop',
      url: 'http://localhost:3000/',
      viewport: { width: 1440, height: 900 },
      steps: [
        { waitFor: '.header' },
        { click: '.nav-button' },
        { wait: 1000 }
      ]
    },
    {
      name: 'products-desktop',
      url: 'http://localhost:3000/products',
      viewport: { width: 1440, height: 900 }
      // No steps for this one
    },
    {
      name: 'checkout-mobile',
      url: 'http://localhost:3000/checkout',
      viewport: { width: 390, height: 844 },
      steps: [
        { fill: { selector: 'input[type="email"]', text: 'user@example.com' } },
        { fill: { selector: 'input[type="password"]', text: 'password123' } },
        { click: 'button[type="submit"]' }
      ]
    }
  ],
  output: {
    branch: 'gh-screenshots',
    comment: {
      template: 'default',
      group_by: 'viewport'
    }
  }
};

const mockContext = {
  repo: { owner: 'test', repo: 'test' },
  runId: 123456
} as typeof github.context;

// Generate and print the comment body
const commentBody = generateCommentBody(mockScreenshots, mockContext, mockConfig, false);
console.log('Generated comment HTML with desktop/mobile grouping:');
console.log('====================================');
console.log(commentBody);
console.log('====================================');

// Save to file for inspection
const fs = require('fs');
fs.writeFileSync('/tmp/generated-comment-grouped.html', commentBody);
console.log('\nSaved to /tmp/generated-comment-grouped.html for inspection');