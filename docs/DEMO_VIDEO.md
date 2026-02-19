# Product Hunt Demo Video (45–60s)

This repo includes a deterministic, **safe** demo-video capture flow that **never posts to Reddit**. It uses a demo-only streamed queue endpoint and a Playwright spec that records the UI flow.

## 1) Record the demo (Playwright)

```bash
npm run demo:video
```

For the settings-management demo (new list + add communities):

```bash
npm run demo:video:settings
```

Notes:
- This sets `NEXT_PUBLIC_QUEUE_DEMO_MODE=1` so the client posts to `POST /api/queue/demo` (simulated streaming).
- Video is forced **on** via `playwright.demo.config.ts`.
- The capture includes simple title cards via `/demo/cards?variant=...`.
- The raw video is written under `test-results/` (Playwright output).

## 2) Export to a shareable file

```bash
npm run demo:export
```

For the settings-management demo export:

```bash
npm run demo:export:settings
```

For the settings-management demo final export (padded to 1080x1920 + voiceover):

```bash
brew install ffmpeg
export OPENAI_API_KEY=...
npm run demo:tts:settings
npm run demo:export:settings:final
```

Output:
- `demo-output/reddit-multi-poster_product-hunt_demo_60s_1080p.mp4` (if `ffmpeg` is installed)
- otherwise `demo-output/reddit-multi-poster_product-hunt_demo_60s_1080p.webm`
- settings demo: `demo-output/reddit-multi-poster_settings-demo.mp4` (if `ffmpeg` is installed)
- otherwise `demo-output/reddit-multi-poster_settings-demo.webm`
- settings final (vertical): `demo-output/reddit-multi-poster_settings-demo_1080x1920.mp4`

## 3) Voiceover + captions (AI polish)

Suggested voiceover text: `docs/demo/product-hunt-demo-voiceover.md`
Settings voiceover text: `docs/demo/settings-demo-voiceover.md`

If you want to paste captions manually (or as a base for auto-captions): `docs/demo/product-hunt-demo.srt`
Settings captions base: `docs/demo/settings-demo.srt`
