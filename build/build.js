const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');
const PACKAGE_LOCK_PATH = path.join(ROOT, 'package-lock.json');

// RedditNSFW release metadata paths.
const BUILD_CONFIG = {
    defaultVersion: '0.1.0',
    versionFile: path.join(__dirname, 'version.txt'),
    changelogPath: path.join(ROOT, 'docs', 'CHANGELOG.md'),
    readmePath: path.join(ROOT, 'README.md'),
    readmeVersionPattern: /Current:\s+\*\*\d+\.\d+\.\d+\*\*/g,
    artifactScript: 'build:artifacts',
    changelogCommitLimit: 10
};

const VALID_BUMPS = new Set(['patch', 'minor', 'major', 'none']);

const ensureDir = (targetPath) => {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
};

const readJson = (targetPath) => JSON.parse(fs.readFileSync(targetPath, 'utf8'));

const writeJson = (targetPath, value) => {
    fs.writeFileSync(targetPath, JSON.stringify(value, null, 2) + '\n');
};

const packageJson = fs.existsSync(PACKAGE_JSON_PATH) ? readJson(PACKAGE_JSON_PATH) : null;
const packageScripts = packageJson && packageJson.scripts ? packageJson.scripts : {};

const normalizeBump = (value) => {
    if (!value) return null;
    const normalized = String(value).trim().toLowerCase();
    return VALID_BUMPS.has(normalized) ? normalized : null;
};

const parseVersion = (raw) => {
    const normalized = String(raw || '').trim();
    if (!/^\d+\.\d+\.\d+$/.test(normalized)) {
        throw new Error(`[build] Invalid semantic version: ${normalized || '(empty)'}`);
    }
    return normalized.split('.').map(Number);
};

const formatVersion = (parts) => parts.join('.');

const readCurrentVersion = () => {
    if (fs.existsSync(BUILD_CONFIG.versionFile)) {
        return fs.readFileSync(BUILD_CONFIG.versionFile, 'utf8').trim() || BUILD_CONFIG.defaultVersion;
    }
    if (packageJson && typeof packageJson.version === 'string' && packageJson.version.trim()) {
        return packageJson.version.trim();
    }
    return BUILD_CONFIG.defaultVersion;
};

const bumpVersion = (currentVersion, bumpType) => {
    const parts = parseVersion(currentVersion);
    if (bumpType === 'major') {
        parts[0] += 1;
        parts[1] = 0;
        parts[2] = 0;
    } else if (bumpType === 'minor') {
        parts[1] += 1;
        parts[2] = 0;
    } else if (bumpType === 'patch') {
        parts[2] += 1;
    }
    return formatVersion(parts);
};

const syncVersionFiles = (version) => {
    ensureDir(BUILD_CONFIG.versionFile);
    fs.writeFileSync(BUILD_CONFIG.versionFile, `${version}\n`);

    if (packageJson) {
        packageJson.version = version;
        writeJson(PACKAGE_JSON_PATH, packageJson);
    }

    if (fs.existsSync(PACKAGE_LOCK_PATH)) {
        const packageLock = readJson(PACKAGE_LOCK_PATH);
        packageLock.version = version;
        if (packageJson && packageJson.name) {
            packageLock.name = packageJson.name;
        }
        if (packageLock.packages && packageLock.packages['']) {
            packageLock.packages[''].version = version;
            if (packageJson && packageJson.name) {
                packageLock.packages[''].name = packageJson.name;
            }
        }
        writeJson(PACKAGE_LOCK_PATH, packageLock);
    }

    if (fs.existsSync(BUILD_CONFIG.readmePath)) {
        const existing = fs.readFileSync(BUILD_CONFIG.readmePath, 'utf8');
        const updated = existing.replace(BUILD_CONFIG.readmeVersionPattern, `Current: **${version}**`);
        if (updated !== existing) {
            fs.writeFileSync(BUILD_CONFIG.readmePath, updated);
        }
    }
};

const getShortHead = () => {
    try {
        return execSync('git rev-parse --short HEAD', {
            cwd: ROOT,
            stdio: ['ignore', 'pipe', 'ignore']
        }).toString().trim();
    } catch (error) {
        return null;
    }
};

const getCommitSubjects = () => {
    try {
        return execSync(`git log -n ${BUILD_CONFIG.changelogCommitLimit} --pretty=format:%s`, {
            cwd: ROOT,
            stdio: ['ignore', 'pipe', 'ignore']
        }).toString().trim().split(/\r?\n/).filter(Boolean);
    } catch (error) {
        return [];
    }
};

const updateChangelog = (previousVersion, nextVersion) => {
    ensureDir(BUILD_CONFIG.changelogPath);

    const existing = fs.existsSync(BUILD_CONFIG.changelogPath)
        ? fs.readFileSync(BUILD_CONFIG.changelogPath, 'utf8')
        : '# Changelog\n';
    const newline = existing.includes('\r\n') ? '\r\n' : '\n';
    const commit = getShortHead();
    const subjects = getCommitSubjects();
    const lines = [
        `## ${nextVersion} - ${new Date().toISOString()}`,
        `Previous: ${previousVersion}`,
        commit ? `Commit: ${commit}` : 'Commit: (git unavailable)',
        'Changes:',
        ...(subjects.length ? subjects.map((subject) => `- ${subject}`) : ['- No commits detected']),
        ''
    ];
    const entry = lines.join(newline);
    const header = '# Changelog';
    const withoutHeader = existing.replace(/^# Changelog\s*/m, '').trimStart();
    const updated = [header, '', entry, withoutHeader].filter(Boolean).join(newline).trimEnd() + newline;
    fs.writeFileSync(BUILD_CONFIG.changelogPath, updated);
};

const runScript = (scriptName) => {
    if (!packageScripts[scriptName]) {
        console.log(`[build] No ${scriptName} script configured; skipping.`);
        return;
    }

    const isWin = process.platform === 'win32';
    const npmCmd = isWin ? 'npm.cmd' : 'npm';
    const cmd = isWin ? 'cmd.exe' : npmCmd;
    const args = isWin ? ['/c', npmCmd, 'run', scriptName] : ['run', scriptName];
    const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
};

const args = process.argv.slice(2);
let bumpType = 'patch';
if (args.includes('--major')) {
    bumpType = 'major';
} else if (args.includes('--minor')) {
    bumpType = 'minor';
} else if (args.includes('--no-bump')) {
    bumpType = 'none';
}

if (process.env.BUMP) {
    const normalized = normalizeBump(process.env.BUMP);
    if (!normalized) {
        console.error(`[build] Invalid BUMP="${process.env.BUMP}". Expected patch, minor, major, or none.`);
        process.exit(1);
    }
    bumpType = normalized;
}

const currentVersion = readCurrentVersion();
if (bumpType === 'none') {
    syncVersionFiles(currentVersion);
    console.log(`[build] Version unchanged: ${currentVersion} (no bump)`);
} else {
    const nextVersion = bumpVersion(currentVersion, bumpType);
    syncVersionFiles(nextVersion);
    updateChangelog(currentVersion, nextVersion);
    console.log(`[build] Version: ${currentVersion} -> ${nextVersion} (${bumpType})`);
}

runScript(BUILD_CONFIG.artifactScript);
