import * as github from '@actions/github';
import { logger } from './logger';

interface CleanupOptions {
  token: string;
  branch: string;
  context: typeof github.context;
}

export async function cleanupScreenshots(options: CleanupOptions): Promise<void> {
  const { token, branch, context } = options;
  const octokit = github.getOctokit(token);

  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const prNumber = context.payload.pull_request?.number;

  if (!prNumber) {
    logger.warn('No PR number found in context, skipping cleanup');
    return;
  }

  logger.info(`🧹 Starting cleanup for PR #${prNumber}`);

  try {
    // Delete PR comments containing screenshots
    await deleteScreenshotComments(octokit, owner, repo, prNumber);

    // Delete screenshot branch if it exists
    await deleteScreenshotBranch(octokit, owner, repo, branch);

    logger.success('✅ Cleanup completed successfully');
  } catch (error) {
    logger.error('Failed to cleanup screenshots:', error);
    throw error;
  }
}

async function deleteScreenshotComments(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<void> {
  try {
    // Get all comments on the PR
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    // Find comments created by this action (look for our signature)
    const screenshotComments = comments.filter(
      (comment) =>
        comment.body?.includes('<!-- auto-pr-screenshots -->') ||
        comment.body?.includes('📸 **PR Screenshots**'),
    );

    logger.info(`Found ${screenshotComments.length} screenshot comments to delete`);

    // Delete each comment
    for (const comment of screenshotComments) {
      await octokit.rest.issues.deleteComment({
        owner,
        repo,
        comment_id: comment.id,
      });
      logger.debug(`Deleted comment #${comment.id}`);
    }

    if (screenshotComments.length > 0) {
      logger.success(`✅ Deleted ${screenshotComments.length} screenshot comments`);
    }
  } catch (error) {
    logger.error('Failed to delete comments:', error);
    // Don't throw - continue with branch deletion
  }
}

async function deleteScreenshotBranch(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  branch: string,
): Promise<void> {
  try {
    // Check if branch exists
    try {
      await octokit.rest.repos.getBranch({
        owner,
        repo,
        branch,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        'status' in error &&
        (error as { status: number }).status === 404
      ) {
        logger.info(`Branch ${branch} not found, nothing to delete`);
        return;
      }
      throw error;
    }

    // Delete the branch
    await octokit.rest.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });

    logger.success(`✅ Deleted branch: ${branch}`);
  } catch (error) {
    logger.error(`Failed to delete branch ${branch}:`, error);
    // Don't throw - this is not critical
  }
}
