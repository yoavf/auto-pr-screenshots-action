import * as github from '@actions/github';
import { logger } from './logger';

interface CleanupOptions {
  branch: string;
  token: string;
  context: typeof github.context;
}

export async function cleanupScreenshots(options: CleanupOptions): Promise<void> {
  const { branch, token, context } = options;
  const octokit = github.getOctokit(token);

  logger.info('🧹 Starting screenshot cleanup...');

  try {
    // Get repository info
    const { owner, repo } = context.repo;
    const prNumber = context.payload.pull_request?.number;

    if (!prNumber) {
      logger.warn('⚠️  No PR number found, skipping cleanup');
      return;
    }

    logger.info(`Cleaning up screenshots for PR #${prNumber}`);

    // Check if screenshots branch exists
    let branchExists = false;
    let branchRef: { data: { object: { sha: string } } };

    try {
      branchRef = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });
      branchExists = true;
      logger.debug(`Branch ${branch} exists`);
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        logger.info(`Branch ${branch} does not exist, nothing to clean up`);
        return;
      }
      throw error;
    }

    const currentSha = branchRef.data.object.sha;

    // Get the current tree
    const { data: currentCommit } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: currentSha,
    });

    const { data: currentTree } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: currentCommit.tree.sha,
      recursive: 'true',
    });

    // Filter out all files under pr-{number}/
    const prPrefix = `pr-${prNumber}/`;
    const remainingFiles = currentTree.tree.filter((item) => {
      const path = item.path || '';
      return !path.startsWith(prPrefix);
    });

    // Check if there are any files to delete
    const deletedCount = currentTree.tree.length - remainingFiles.length;
    if (deletedCount === 0) {
      logger.info(`No screenshots found for PR #${prNumber}, nothing to clean up`);
      return;
    }

    logger.info(`Found ${deletedCount} file(s) to delete for PR #${prNumber}`);

    // Create new tree without the PR's screenshots
    const { data: newTree } = await octokit.rest.git.createTree({
      owner,
      repo,
      tree: remainingFiles.map((item) => ({
        path: item.path,
        mode: item.mode as '100644' | '100755' | '040000' | '160000' | '120000',
        type: item.type as 'commit' | 'tree' | 'blob',
        sha: item.sha,
      })),
    });

    // Create commit
    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: `🧹 Cleanup screenshots for PR #${prNumber}`,
      tree: newTree.sha,
      parents: [currentSha],
    });

    // Update branch reference
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    logger.success(`✅ Successfully cleaned up screenshots for PR #${prNumber}`);
    logger.info(`Deleted ${deletedCount} file(s) from ${branch} branch`);
  } catch (error) {
    logger.error(
      'Failed to cleanup screenshots:',
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
