/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const https = require('https');

const repoRoot = process.cwd();

const readArg = (prefix, fallback = null) => {
  const arg = process.argv.find((value) => value.startsWith(prefix));
  if (!arg) return fallback;
  const parts = arg.split('=');
  return parts.length > 1 ? parts.slice(1).join('=') : fallback;
};

const stripMarkdown = (markdown) => {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('#'))
    .map((line) => line.replace(/^\-\s+/, ''))
    .join(' ');
};

const requestSpeech = async ({ apiKey, model, voice, format, input }) => {
  const body = JSON.stringify({
    model,
    voice,
    format,
    input,
  });

  return await new Promise((resolve, reject) => {
    const req = https.request(
      'https://api.openai.com/v1/audio/speech',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(buffer);
            return;
          }

          const text = buffer.toString('utf8');
          reject(new Error(`OpenAI TTS failed (${res.statusCode}): ${text}`));
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

const main = async () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY env var.');
  }

  const inputPath = readArg('--input=', path.join(repoRoot, 'docs', 'demo', 'settings-demo-voiceover.md'));
  const outputPath = readArg('--output=', path.join(repoRoot, 'demo-audio', 'settings-voiceover.m4a'));
  const model = readArg('--model=', 'gpt-4o-mini-tts');
  const voice = readArg('--voice=', 'alloy');
  const format = readArg('--format=', 'm4a');

  const markdown = await fs.promises.readFile(inputPath, 'utf8');
  const input = stripMarkdown(markdown);

  if (input.length === 0) {
    throw new Error(`No voiceover text found in ${inputPath}`);
  }

  // Keep this conservative to avoid hitting payload limits.
  const maxChars = 3500;
  const truncatedInput = input.length > maxChars ? input.slice(0, maxChars) : input;
  if (truncatedInput.length !== input.length) {
    console.warn(`Voiceover text truncated from ${input.length} to ${truncatedInput.length} chars.`);
  }

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  console.log(`Generating voiceover: model=${model} voice=${voice} format=${format}`);
  const audioBuffer = await requestSpeech({
    apiKey,
    model,
    voice,
    format,
    input: truncatedInput,
  });

  await fs.promises.writeFile(outputPath, audioBuffer);
  console.log(`Wrote: ${outputPath}`);
};

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

