import * as github from '@actions/github';
import { generateCommentBody } from '../comment-poster';
import type { Config, UploadedScreenshot } from '../types';

// Mock data for testing comment generation
const mockScreenshots: UploadedScreenshot[] = [
  {
    name: 'product-detail',
    browser: 'chromium',
    url: 'https://example.com/screenshot1.png'
  },
  {
    name: 'cart-with-items',
    browser: 'chromium', 
    url: 'https://example.com/screenshot2.png'
  }
];

const mockConfig: Config = {
  version: 1,
  screenshots: [
    {
      name: 'product-detail',
      url: 'http://localhost:3000/products/example-product',
      viewport: { width: 1440, height: 900 },
      steps: [
        { waitFor: '[data-testid="add-to-cart"]' },
        { click: '[data-testid="add-to-cart"]' },
        { wait: 500 }
      ]
    },
    {
      name: 'cart-with-items',
      url: 'http://localhost:3000/cart',
      viewport: { width: 1440, height: 900 },
      steps: [
        { fill: { selector: 'input[name="email"]', text: 'test@example.com' } },
        { click: '[data-testid="submit"]' }
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
console.log('Generated comment HTML:');
console.log('====================================');
console.log(commentBody);
console.log('====================================');

// Save to file for inspection
const fs = require('fs');
fs.writeFileSync('/tmp/generated-comment.html', commentBody);
console.log('\nSaved to /tmp/generated-comment.html for inspection');