const { execSync } = require('child_process');

const baseRef = process.env.GITHUB_BASE_REF || 'main';
const sha = process.env.GITHUB_SHA || 'HEAD';

const getChangedFiles = () => {
  try {
    const raw = execSync(`git diff --name-only origin/${baseRef}...${sha}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();

    if (!raw) return [];
    return raw.split('\n').filter(Boolean);
  } catch {
    return [];
  }
};

const files = getChangedFiles();

const recommendations = [];
if (files.some(file => file.startsWith('components/subreddit-picker/'))) {
  recommendations.push('Add or update `@flow-core` tests for subreddit selection and post customization.');
}
if (files.some(file => file.startsWith('pages/api/queue') || file.startsWith('hooks/usePostingQueue'))) {
  recommendations.push('Add or update `@flow-edge` tests for queue state transitions and partial failures.');
}
if (files.some(file => file.startsWith('pages/api/auth') || file.startsWith('hooks/useAuth'))) {
  recommendations.push('Add `@flow-edge` tests for auth-expiry and relogin recovery.');
}
if (files.some(file => file.startsWith('lib/errorClassification'))) {
  recommendations.push('Add contract tests for unknown/error payload fallback behavior.');
}

console.log('# AI Flow Case Suggestions');
console.log('');

if (files.length === 0) {
  console.log('No changed files detected for flow suggestions.');
  process.exit(0);
}

console.log('Changed files considered:');
files.slice(0, 20).forEach(file => console.log(`- ${file}`));
console.log('');

if (recommendations.length === 0) {
  console.log('No high-risk flow areas detected from changed files.');
  process.exit(0);
}

console.log('Suggested flow tests to add/update:');
recommendations.forEach(rec => console.log(`- ${rec}`));
