#!/usr/bin/env node
// Builds the marketing page's brochure video (ADR 0019) from script.md and deck.html:
//   narration  edge-tts (default) or the offline espeak-ng + MBROLA voice (--engine espeak)
//   frames     each deck slide captured with Playwright's Chromium at 1280x720
//   output     frontend/projects/marketing/public/brochure/brochure.webm, brochure-poster.jpg and
//              brochure.en.vtt (one caption per narration paragraph)
// Usage: node eng/videos/brochure/build.mjs [--engine edge|espeak] [--check]
// Needs node, ffmpeg, ffprobe, the e2e packages (npm --prefix e2e ci) and the chosen voice.
// Fails when the video is longer than 30 seconds (L2-056 AC1).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MAX_SECONDS = 30;
const GAP_SECONDS = 0.5;
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const out = join(root, 'frontend/projects/marketing/public/brochure');
const work = join(root, '.cache/brochure');
const args = process.argv.slice(2);
const engine = args.includes('--engine') ? args[args.indexOf('--engine') + 1] : 'edge';
const checkOnly = args.includes('--check');
const python = process.env.PYTHON ?? 'python3';
const voice = process.env.EDGE_VOICE ?? 'en-US-AndrewMultilingualNeural';

/** `## id` sections of script.md, each with the paragraph that is spoken over that slide. */
function readScript() {
  const text = readFileSync(join(here, 'script.md'), 'utf8');
  return text
    .split(/^## /m)
    .slice(1)
    .map((block) => {
      const [id, ...rest] = block.split('\n');
      return { id: id.trim(), text: rest.join(' ').replace(/\s+/g, ' ').trim() };
    });
}

function run(cmd, cmdArgs) {
  return execFileSync(cmd, cmdArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function duration(file) {
  return Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]));
}

function speak(text, wav) {
  if (engine === 'espeak') {
    run('espeak-ng', ['-v', 'mb-us2', '-s', '150', '-w', wav, text.replace(/’/g, "'")]);
  } else {
    const mp3 = wav.replace(/\.wav$/, '.mp3');
    const proxy = process.env.HTTPS_PROXY ? ['--proxy', process.env.HTTPS_PROXY] : [];
    run(python, ['-m', 'edge_tts', ...proxy, '--voice', voice, '--text', text, '--write-media', mp3]);
    run('ffmpeg', ['-y', '-v', 'error', '-i', mp3, wav]);
  }
  // One sample rate and channel layout so the clips concatenate cleanly.
  const norm = wav.replace(/\.wav$/, '.norm.wav');
  run('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-ar', '48000', '-ac', '1', norm]);
  return norm;
}

function vttTime(seconds) {
  const ms = Math.round(seconds * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0');
  const s = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
  return `${h}:${m}:${s}.${String(ms % 1000).padStart(3, '0')}`;
}

async function capture(slides) {
  const require = createRequire(join(root, 'e2e/package.json'));
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(pathToFileURL(join(here, 'deck.html')).href);
  for (const slide of slides) {
    await page.evaluate((id) => {
      document.querySelectorAll('section').forEach((s) => s.classList.toggle('current', s.id === id));
    }, slide.id);
    await page.waitForLoadState('networkidle');
    slide.png = join(work, `${slide.id}.png`);
    await page.screenshot({ path: slide.png });
  }
  await browser.close();
}

const slides = readScript();
if (checkOnly) {
  const words = slides.reduce((n, s) => n + s.text.split(' ').length, 0);
  console.log(`${slides.length} slides, ${words} words, about ${Math.round((words / 150) * 60)} s`);
  process.exit(0);
}

mkdirSync(work, { recursive: true });
mkdirSync(out, { recursive: true });

let at = 0;
const cues = [];
for (const slide of slides) {
  slide.wav = speak(slide.text, join(work, `${slide.id}.wav`));
  slide.seconds = duration(slide.wav) + GAP_SECONDS;
  cues.push({ start: at, end: at + slide.seconds - GAP_SECONDS, text: slide.text });
  at += slide.seconds;
}
if (at > MAX_SECONDS) {
  console.error(`The brochure is ${at.toFixed(1)} s; it must be ${MAX_SECONDS} s or less (L2-056).`);
  process.exit(1);
}
await capture(slides);

// Audio: each clip followed by a short silence, as one track.
const audioList = join(work, 'audio.txt');
const silence = join(work, 'gap.wav');
run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', `${GAP_SECONDS}`, silence]);
writeFileSync(audioList, slides.map((s) => `file '${s.wav}'\nfile '${silence}'`).join('\n'));
const audio = join(work, 'narration.wav');
run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', audioList, audio]);

// Video: each slide held for its narration.
const videoList = join(work, 'video.txt');
writeFileSync(
  videoList,
  slides.map((s) => `file '${s.png}'\nduration ${s.seconds.toFixed(3)}`).join('\n') +
    `\nfile '${slides.at(-1).png}'\n`,
);
const webm = join(out, 'brochure.webm');
run('ffmpeg', [
  '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', videoList, '-i', audio,
  '-vf', 'fps=25,format=yuv420p', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-row-mt', '1',
  '-c:a', 'libopus', '-b:a', '64k', '-shortest', webm,
]);
run('ffmpeg', ['-y', '-v', 'error', '-i', slides[0].png, '-q:v', '4', join(out, 'brochure-poster.jpg')]);
writeFileSync(
  join(out, 'brochure.en.vtt'),
  'WEBVTT\n\n' + cues.map((c, i) => `${i + 1}\n${vttTime(c.start)} --> ${vttTime(c.end)}\n${c.text}\n`).join('\n'),
);

const total = duration(webm);
if (total > MAX_SECONDS) {
  console.error(`The brochure is ${total.toFixed(1)} s; it must be ${MAX_SECONDS} s or less (L2-056).`);
  process.exit(1);
}
console.log(`brochure.webm ${total.toFixed(1)} s (${engine}), poster and captions written to ${out}`);
