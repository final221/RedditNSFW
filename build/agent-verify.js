const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const packageJson = fs.existsSync(PACKAGE_JSON_PATH)
    ? JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'))
    : { scripts: {} };
const packageScripts = packageJson.scripts || {};

const run = (command, args) => {
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'cmd.exe' : command;
    const cmdArgs = isWin ? ['/c', command, ...args] : args;
    const result = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit' });
    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
};

const hasScript = (scriptName) => typeof packageScripts[scriptName] === 'string' && packageScripts[scriptName].trim().length > 0;

if (hasScript('sync-docs')) {
    run(npmCmd, ['run', 'sync-docs']);
}

if (hasScript('test')) {
    run(npmCmd, ['test']);
} else {
    console.log('[agent:verify] No test script configured; skipping tests.');
}

if (!hasScript('build')) {
    console.error('[agent:verify] Missing required build script.');
    process.exit(1);
}
run(npmCmd, ['run', 'build']);

if (hasScript('verify:extras')) {
    run(npmCmd, ['run', 'verify:extras']);
}

run('git', ['status', '-sb']);
