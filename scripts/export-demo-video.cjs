/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = process.cwd();
const testResultsDir = path.join(repoRoot, 'test-results');
const outputDir = path.join(repoRoot, 'demo-output');
const outputBase = 'reddit-multi-poster_product-hunt_demo_60s_1080p';

const fileExists = async (filePath) => {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const listFilesRecursive = async (dir) => {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listFilesRecursive(fullPath);
      return [fullPath];
    })
  );
  return files.flat();
};

const getMostRecent = async (files) => {
  const stats = await Promise.all(
    files.map(async (filePath) => ({ filePath, stat: await fs.promises.stat(filePath) }))
  );
  stats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  return stats[0]?.filePath ?? null;
};

const hasFfmpeg = () => {
  const result = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  return result.status === 0;
};

const convertToMp4 = (inputPath, outputPath) => {
  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputPath,
    ],
    { stdio: 'inherit' }
  );

  if (result.status !== 0) {
    throw new Error('ffmpeg conversion failed');
  }
};

const main = async () => {
  if (!(await fileExists(testResultsDir))) {
    throw new Error('No test-results/ directory found. Run `npm run demo:video` first.');
  }

  const allFiles = await listFilesRecursive(testResultsDir);
  const videoFiles = allFiles.filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  const latestVideo = await getMostRecent(videoFiles);

  if (!latestVideo) {
    throw new Error('No Playwright video found under test-results/. Run `npm run demo:video` first.');
  }

  await fs.promises.mkdir(outputDir, { recursive: true });

  const mp4Target = path.join(outputDir, `${outputBase}.mp4`);
  const webmTarget = path.join(outputDir, `${outputBase}.webm`);

  if (latestVideo.endsWith('.mp4')) {
    await fs.promises.copyFile(latestVideo, mp4Target);
    console.log(`Exported: ${mp4Target}`);
    return;
  }

  if (hasFfmpeg()) {
    convertToMp4(latestVideo, mp4Target);
    console.log(`Exported: ${mp4Target}`);
    return;
  }

  await fs.promises.copyFile(latestVideo, webmTarget);
  console.log(`Exported (ffmpeg not found; kept .webm): ${webmTarget}`);
};

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

