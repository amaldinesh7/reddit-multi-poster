/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = process.cwd();
const testResultsDir = path.join(repoRoot, 'test-results');
const outputDir = path.join(repoRoot, 'demo-output');
const variantArg = process.argv.find((arg) => arg.startsWith('--variant='));
const variant = variantArg ? variantArg.split('=')[1] : 'product-hunt';
const padArg = process.argv.find((arg) => arg.startsWith('--pad='));
const pad = padArg ? padArg.split('=')[1] : null;
const audioArg = process.argv.find((arg) => arg.startsWith('--audio='));
const audioPath = audioArg ? audioArg.split('=')[1] : null;

const outputBaseByVariant = {
  'product-hunt': 'reddit-multi-poster_product-hunt_demo_60s_1080p',
  settings: 'reddit-multi-poster_settings-demo',
};

const outputBase = outputBaseByVariant[variant] || outputBaseByVariant['product-hunt'];
const outputBaseFinal =
  variant === 'settings' && pad ? `${outputBaseByVariant.settings}_${pad}` : outputBase;

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

const parsePad = (value) => {
  if (!value) return null;
  const match = value.match(/^(\d+)x(\d+)$/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
};

const fileExistsSync = (filePath) => {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
};

const exportWithPadAndOptionalAudio = ({ inputPath, outputPath, padSize, audio }) => {
  const { width, height } = padSize;

  // Blurred background + centered foreground. Safe defaults for most social platforms.
  const filter = [
    `[0:v]split=2[bg][fg]`,
    `[bg]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},gblur=sigma=20[bg2]`,
    `[fg]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg2]`,
    `[bg2][fg2]overlay=(W-w)/2:(H-h)/2,format=yuv420p[vout]`,
  ].join(';');

  const args = ['-y', '-i', inputPath];

  if (audio) {
    args.push('-i', audio);
  }

  args.push(
    '-filter_complex',
    filter,
    '-map',
    '[vout]',
    '-c:v',
    'libx264',
    '-crf',
    '20',
    '-preset',
    'medium',
    '-movflags',
    '+faststart'
  );

  if (audio) {
    args.push('-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k', '-shortest');
  }

  args.push(outputPath);

  const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error('ffmpeg export failed');
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

  const mp4Target = path.join(outputDir, `${outputBaseFinal}.mp4`);
  const webmTarget = path.join(outputDir, `${outputBaseFinal}.webm`);

  const padSize = parsePad(pad);

  if (audioPath && !fileExistsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  if (padSize) {
    if (!hasFfmpeg()) {
      throw new Error('ffmpeg not found. Install with: brew install ffmpeg');
    }
    exportWithPadAndOptionalAudio({
      inputPath: latestVideo,
      outputPath: mp4Target,
      padSize,
      audio: audioPath,
    });
    console.log(`Exported: ${mp4Target}`);
    return;
  }

  if (audioPath) {
    if (!hasFfmpeg()) {
      throw new Error('ffmpeg not found. Install with: brew install ffmpeg');
    }
    // If audio is requested without pad, keep video size unchanged and just mux audio.
    const args = [
      '-y',
      '-i',
      latestVideo,
      '-i',
      audioPath,
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      mp4Target,
    ];
    const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });
    if (result.status !== 0) {
      throw new Error('ffmpeg audio overlay failed');
    }
    console.log(`Exported: ${mp4Target}`);
    return;
  }

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
