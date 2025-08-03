import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as github from '@actions/github';
import { uploadLogger as logger } from './logger';
import type { CapturedScreenshot, UploadedScreenshot } from './types';

interface UploadOptions {
  branch: string;
  token: string;
  context: typeof github.context;
}

export async function uploadScreenshots(
  screenshots: CapturedScreenshot[],
  options: UploadOptions,
): Promise<UploadedScreenshot[]> {
  const { branch, token, context } = options;
  const octokit = github.getOctokit(token);

  logger.info(`📤 Uploading ${screenshots.length} screenshots to branch: ${branch}`);

  try {
    // Get repository info
    const { owner, repo } = context.repo;
    const prNumber = context.payload.pull_request?.number || context.runNumber;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Create directory structure for this PR
    const screenshotDir = `pr-${prNumber}/${timestamp}`;

    logger.groupWithFunction(`Repository: ${owner}/${repo}`, async () => {
      logger.info(`PR/Run: #${prNumber}`);
      logger.info(`Directory: ${screenshotDir}`);
    });

    // Check if branch exists
    let branchExists = false;
    try {
      await octokit.rest.repos.getBranch({
        owner,
        repo,
        branch,
      });
      branchExists = true;
      logger.debug(`Branch ${branch} exists`);
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        logger.debug(`Branch ${branch} does not exist, will create`);
      } else {
        throw error;
      }
    }

    // Get the SHA of the main branch to create from
    let baseSha: string;
    if (!branchExists) {
      const { data: defaultBranch } = await octokit.rest.repos.get({
        owner,
        repo,
      });

      const { data: ref } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${defaultBranch.default_branch}`,
      });
      baseSha = ref.object.sha;

      // Create the branch
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: baseSha,
      });
      logger.success(`✅ Created branch: ${branch}`);
    } else {
      // Get current branch SHA
      const { data: ref } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });
      baseSha = ref.object.sha;
    }

    // Get the tree for the current commit
    const { data: baseCommit } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: baseSha,
    });

    // Upload each screenshot
    const uploadedScreenshots: UploadedScreenshot[] = [];
    const blobs: Array<{ path: string; sha: string }> = [];

    for (const screenshot of screenshots) {
      logger.info(`Uploading ${screenshot.name}...`);

      // Read file content
      const content = await fs.readFile(screenshot.path);
      const base64Content = content.toString('base64');

      // Create blob
      const { data: blob } = await octokit.rest.git.createBlob({
        owner,
        repo,
        content: base64Content,
        encoding: 'base64',
      });

      const filePath = `${screenshotDir}/${path.basename(screenshot.path)}`;
      blobs.push({
        path: filePath,
        sha: blob.sha,
      });

      uploadedScreenshots.push({
        name: screenshot.name,
        browser: screenshot.browser,
        url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`,
      });

      logger.debug(`Created blob: ${blob.sha} for ${filePath}`);
    }

    // Create README for the directory
    const readmeContent = `# Screenshots for PR #${prNumber}

Generated on: ${new Date().toISOString()}

## Screenshots
${screenshots.map((s) => `- ${s.name} (${s.browser})`).join('\n')}
`;

    const { data: readmeBlob } = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: Buffer.from(readmeContent).toString('base64'),
      encoding: 'base64',
    });

    blobs.push({
      path: `${screenshotDir}/README.md`,
      sha: readmeBlob.sha,
    });

    // Create latest pointer file
    const latestPath = `pr-${prNumber}/latest`;
    const latestContent = timestamp;

    const { data: latestBlob } = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: Buffer.from(latestContent).toString('base64'),
      encoding: 'base64',
    });

    blobs.push({
      path: latestPath,
      sha: latestBlob.sha,
    });

    // Create tree with all blobs (including latest pointer)
    const { data: tree } = await octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: baseCommit.tree.sha,
      tree: blobs.map((blob) => ({
        path: blob.path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      })),
    });

    // Create single commit with everything
    const { data: commit } = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: `Screenshots for PR #${prNumber} (${timestamp})`,
      tree: tree.sha,
      parents: [baseSha],
    });

    // Update branch reference once
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: commit.sha,
    });

    logger.success(`✅ Uploaded ${uploadedScreenshots.length} screenshots to ${branch}`);
    logger.info(`View at: https://github.com/${owner}/${repo}/tree/${branch}/${screenshotDir}`);

    return uploadedScreenshots;
  } catch (error) {
    logger.error(
      'Failed to upload screenshots:',
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
