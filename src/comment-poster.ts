import * as github from '@actions/github';
import { commentLogger as logger } from './logger';
import type { Config, ScreenshotError, UploadedScreenshot } from './types';

interface CommentOptions {
  token: string;
  context: typeof github.context;
  config: Config;
  showAttribution: boolean;
}

const COMMENT_MARKER = '<!-- auto-pr-screenshots -->';

export async function postInitialComment(options: CommentOptions): Promise<number | null> {
  const { token, context } = options;

  // Only post comments on pull requests
  if (context.eventName !== 'pull_request' || !context.payload.pull_request) {
    logger.warn('Not in a pull request context, skipping comment');
    return null;
  }

  const octokit = github.getOctokit(token);
  const { owner, repo } = context.repo;
  const prNumber = context.payload.pull_request.number;
  const commitSha = context.payload.pull_request.head.sha.substring(0, 7);

  logger.info(`💬 Posting initial comment to PR #${prNumber}`);

  try {
    const commentBody = generateInitialCommentBody(commitSha);

    // Find existing comment
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    const existingComment = comments.find(
      (comment) => comment.body?.includes(COMMENT_MARKER) && comment.user?.type === 'Bot',
    );

    if (existingComment) {
      // Update existing comment
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingComment.id,
        body: commentBody,
      });
      logger.success('✅ Updated existing comment with initial status');
      return existingComment.id;
    } else {
      // Create new comment
      const { data: comment } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: commentBody,
      });
      logger.success('✅ Created initial comment');
      return comment.id;
    }
  } catch (error) {
    logger.error(
      'Failed to post initial comment:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

export async function updateComment(
  commentId: number,
  screenshots: UploadedScreenshot[],
  errors: ScreenshotError[],
  options: CommentOptions,
  status: 'in_progress' | 'complete',
): Promise<void> {
  const { token, context, config } = options;

  if (context.eventName !== 'pull_request' || !context.payload.pull_request) {
    return;
  }

  const octokit = github.getOctokit(token);
  const { owner, repo } = context.repo;
  const commitSha = context.payload.pull_request.head.sha.substring(0, 7);

  try {
    const commentBody = generateCommentBody(
      screenshots,
      errors,
      context,
      config,
      options.showAttribution,
      status,
      commitSha,
    );

    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: commentId,
      body: commentBody,
    });
    logger.success(`✅ Updated comment (${status})`);
  } catch (error) {
    logger.error(
      'Failed to update comment:',
      error instanceof Error ? error.message : String(error),
    );
  }
}

function generateInitialCommentBody(commitSha: string): string {
  const timestamp = new Date().toISOString();
  let body = `${COMMENT_MARKER}\n`;
  body += '## 📸 Auto PR Screenshots\n\n';
  body += `🔄 Screenshot capture has started for commit \`${commitSha}\`\n\n`;
  body += `*Started <relative-time datetime="${timestamp}">${timestamp}</relative-time>*\n\n`;
  body += '*Capturing screenshots...*';
  return body;
}

function generateCommentBody(
  screenshots: UploadedScreenshot[],
  errors: ScreenshotError[],
  context: typeof github.context,
  config: Config,
  showAttribution: boolean = false,
  status: 'in_progress' | 'complete' = 'complete',
  commitSha: string,
): string {
  const timestamp = new Date().toISOString();
  const runUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

  let body = `${COMMENT_MARKER}\n`;
  body += '## 📸 Auto PR Screenshots\n\n';

  if (status === 'in_progress') {
    body += `🔄 Screenshot capture in progress for commit \`${commitSha}\`\n\n`;
    body += `*Last updated <relative-time datetime="${timestamp}">${timestamp}</relative-time>*\n\n`;
  } else {
    body += `✅ Screenshot capture complete for commit \`${commitSha}\`\n\n`;
    body += `*Completed <relative-time datetime="${timestamp}">${timestamp}</relative-time>*\n\n`;
  }

  if (screenshots.length === 0 && errors.length === 0) {
    body += `⚠️ No screenshots were captured. Check the [action logs](${runUrl}) for details.\n`;
    return body;
  }

  // Show successful screenshots first
  if (screenshots.length > 0) {
    body += '### ✅ Successful Screenshots\n\n';

    // Group screenshots based on config
    if (config.output.comment.group_by === 'viewport') {
      const desktop = screenshots.filter((s) => s.name.includes('desktop'));
      const mobile = screenshots.filter((s) => s.name.includes('mobile'));
      const tablet = screenshots.filter((s) => s.name.includes('tablet'));
      const other = screenshots.filter(
        (s) =>
          !s.name.includes('desktop') && !s.name.includes('mobile') && !s.name.includes('tablet'),
      );

      if (desktop.length > 0) {
        body += '### 🖥️ Desktop\n\n';
        body += generateScreenshotGrid(desktop, 3, 250, config);
      }

      if (tablet.length > 0) {
        body += '### 📱 Tablet\n\n';
        body += generateScreenshotGrid(tablet, 4, 200, config);
      }

      if (mobile.length > 0) {
        body += '### 📱 Mobile\n\n';
        body += generateScreenshotGrid(mobile, 5, 150, config);
      }

      if (other.length > 0) {
        body += '### 📸 Other\n\n';
        body += generateScreenshotGrid(other, 4, 200, config);
      }
    } else {
      // Default: show all screenshots in a grid
      body += generateScreenshotGrid(screenshots, 4, 200, config);
    }
  }

  // Show errors after successful screenshots
  if (errors.length > 0) {
    body += '### ❌ Failed Screenshots\n\n';
    body += 'The following screenshots could not be captured:\n\n';

    for (const error of errors) {
      const name = formatScreenshotName(error.name);
      // Clean up error message: remove "Call log:" prefix and format nicely
      let errorMsg = error.error;
      let logDetails = '';

      if (errorMsg.includes('Call log:')) {
        // Extract just the timeout message before "Call log:"
        const parts = errorMsg.split('Call log:');
        errorMsg = parts[0].trim();
        // Extract bullet points if they exist
        if (parts[1]) {
          const logLines = parts[1]
            .trim()
            .split('\n')
            .filter((line) => line.trim().startsWith('-'))
            .map((line) => line.trim().substring(2).trim()); // Remove "- " prefix
          if (logLines.length > 0) {
            logDetails = logLines.map((line) => `\`${line}\``).join('<br>');
          }
        }
      }

      body += `${name} (${error.browser}): ${errorMsg}`;
      if (logDetails) {
        body += `<br>${logDetails}`;
      }
      body += '\n\n';
    }

    body += `Check the [action logs](${runUrl}) for more details.\n\n`;
  }

  if (showAttribution) {
    body += `*Generated by [Auto PR Screenshots](https://github.com/yoavf/auto-pr-screenshots-action) • [View Run](${runUrl})*`;
  }

  return body;
}

function generateScreenshotGrid(
  screenshots: UploadedScreenshot[],
  columns: number,
  width: number,
  config: Config,
): string {
  let grid = '<table>\n';

  for (let i = 0; i < screenshots.length; i += columns) {
    grid += '<tr>\n';

    for (let j = 0; j < columns && i + j < screenshots.length; j++) {
      const screenshot = screenshots[i + j];
      const name = formatScreenshotName(screenshot.name);

      // Find the corresponding config for this screenshot to get steps
      const screenshotConfig = config.screenshots.find((sc) => sc.name === screenshot.name);

      grid += '<td align="center">\n';
      grid += `<b>${name}</b><br>\n`;
      grid += `<sub>${screenshot.browser}</sub><br>\n`;
      grid += `<a href="${screenshot.url}" target="_blank">\n`;
      grid += `<img src="${screenshot.url}" alt="${name}" width="${width}">\n`;
      grid += '</a>\n';

      // Add playwright actions if they exist
      function escapeHtml(text: string): string {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      // Add playwright actions if they exist
      if (screenshotConfig?.steps && screenshotConfig.steps.length > 0) {
        grid += '<br>\n';
        grid += '<details>\n';
        grid += '<summary><sub>🎭 Actions</sub></summary>\n';
        grid += '<div align="left">\n';
        grid += '<br>\n';

        for (const step of screenshotConfig.steps) {
          if (step.click) {
            grid += `<code>click("${escapeHtml(step.click)}")</code><br>\n`;
          }
          if (step.fill) {
            grid += `<code>fill("${escapeHtml(step.fill.selector)}", "${escapeHtml(step.fill.text)}")</code><br>\n`;
          }
          if (step.wait) {
            grid += `<code>wait(${step.wait}ms)</code><br>\n`;
          }
          if (step.waitFor) {
            grid += `<code>waitFor("${escapeHtml(step.waitFor)}")</code><br>\n`;
          }
        }

        grid += '</div>\n';
        grid += '</details>\n';
      }

      grid += '</td>\n';
    }

    grid += '</tr>\n';
  }

  grid += '</table>\n\n';
  return grid;
}

function formatScreenshotName(name: string): string {
  let formattedName = name;

  // Remove file extension
  formattedName = formattedName.replace(/\.(png|jpg|jpeg)$/i, '');

  // Remove browser suffix
  formattedName = formattedName.replace(/-(chromium|firefox|webkit)$/i, '');

  // Convert kebab-case to Title Case
  return formattedName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
