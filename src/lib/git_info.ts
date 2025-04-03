import { execSync } from 'child_process';

function getGitHash(): string {
  let gitHash = '';
  try {
    gitHash = execSync('git rev-parse HEAD').toString().trim();
  } catch (error) {
    console.error('Failed to get git hash:', error);
  }
  return gitHash;
}

function getGitBranch(): string {
  let gitBranch = '';
  try {
    gitBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (error) {
    console.error('Failed to get git branch:', error);
  }
  return gitBranch;
}

function getGitTag(): string {
  let gitTag = '';
  try {
    gitTag = execSync('git describe --tags --abbrev=0').toString().trim();
  } catch (error) {
    console.error('Failed to get git tag:', error);
  }
  return gitTag;
}

export const gitInfo = {
  hash: getGitHash(),
  branch: getGitBranch(),
  tag: getGitTag(),
};
