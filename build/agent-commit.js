const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const commitMessage = process.env.COMMIT_MSG || process.env.COMMIT_MESSAGE;

const run = (command, args, opts = {}) => {
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'cmd.exe' : command;
    const cmdArgs = isWin ? ['/c', command, ...args] : args;
    const result = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', ...opts });
    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
};

const runCapture = (command, args) => {
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'cmd.exe' : command;
    const cmdArgs = isWin ? ['/c', command, ...args] : args;
    return spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
};

const listRemotes = () => {
    const result = runCapture('git', ['remote']);
    if (result.status !== 0) return [];
    return (result.stdout || '')
        .toString()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
};

const getRemoteUrl = (remoteName) => {
    const result = runCapture('git', ['config', '--get', `remote.${remoteName}.url`]);
    if (result.status !== 0) return null;
    const value = (result.stdout || '').toString().trim();
    return value || null;
};

const listConfiguredRemoteNames = () => {
    const result = runCapture('git', ['config', '--name-only', '--get-regexp', '^remote\\..*\\.url$']);
    if (result.status !== 0) return [];
    return (result.stdout || '')
        .toString()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const match = line.match(/^remote\.([^.]+)\.url$/);
            return match ? match[1] : null;
        })
        .filter(Boolean);
};

const getPushRemote = () => {
    if (getRemoteUrl('origin')) return 'origin';
    const remotes = listRemotes();
    if (remotes.includes('origin')) return 'origin';
    if (remotes.length > 0) return remotes[0];

    const configuredRemotes = listConfiguredRemoteNames();
    if (configuredRemotes.includes('origin')) return 'origin';
    if (configuredRemotes.length > 0) return configuredRemotes[0];

    return null;
};

const getCurrentBranch = () => {
    const result = runCapture('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
    if (result.status !== 0) return null;
    const branch = (result.stdout || '').toString().trim();
    if (!branch || branch === 'HEAD') return null;
    return branch;
};

const hasUpstream = () => {
    const result = runCapture('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
    return result.status === 0;
};

const pushWithTrackingIfNeeded = () => {
    const remote = getPushRemote();
    if (!remote) {
        console.warn('[agent:commit] No git remote configured; commit created locally only.');
        return;
    }

    if (hasUpstream()) {
        run('git', ['push']);
        return;
    }

    const branch = getCurrentBranch();
    if (!branch) {
        run('git', ['push']);
        return;
    }

    console.warn(`[agent:commit] No upstream for ${branch}; pushing with --set-upstream ${remote} ${branch}.`);
    run('git', ['push', '--set-upstream', remote, branch]);
};

if (!commitMessage) {
    console.error('[agent:commit] Missing COMMIT_MSG (or COMMIT_MESSAGE).');
    process.exit(1);
}

const filesToAdd = [
    'AGENTS.md',
    'AGENT_WORKFLOW.js',
    'README.md',
    'Unblur.txt',
    'image recreation.txt',
    'package.json',
    'package-lock.json',
    '.gitignore',
    '.gitattributes',
    '.editorconfig',
    'build/version.txt',
    'docs/CHANGELOG.md'
];

const rootsToAdd = [
    'src',
    'tests',
    'docs',
    'build',
    'scripts',
    'data'
];

const existingFiles = filesToAdd.filter((entry) => fs.existsSync(path.join(ROOT, entry)));
const existingRoots = rootsToAdd.filter((entry) => fs.existsSync(path.join(ROOT, entry)));

run('git', ['add', '-u']);

if (existingFiles.length || existingRoots.length) {
    run('git', ['add', ...existingFiles, ...existingRoots]);
}

run('git', ['commit', '-m', commitMessage]);
pushWithTrackingIfNeeded();
