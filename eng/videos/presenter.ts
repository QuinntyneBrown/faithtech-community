import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Locator, Page } from '@playwright/test';

/** One narration paragraph, synthesized by Record-JourneyVideos.ps1 before the take. */
interface Clip {
  id: string;
  chapter: string;
  text: string;
  duration: number;
}

interface Manifest {
  slug: string;
  title: string;
  clips: Clip[];
}

/** What the overlay shows. Re-applied by an init script after every full navigation. */
interface OverlayState {
  caption: string | null;
  card: { kind: 'opening' | 'closing'; title: string; lines: string[] } | null;
  position: 'top' | 'bottom';
  logo: string;
}

interface StepOptions {
  /** Put the caption at the top when the bottom of the screen holds what the step shows. */
  position?: 'top' | 'bottom';
  /** Use a frame from this step as the video's poster. */
  poster?: boolean;
}

const MARGIN_MS = 700;
const REPO = join(__dirname, '..', '..');
/**
 * When set, the stories only capture one screenshot per step into `<dir>/<slug>/screenshots`:
 * no overlay, no narration timing, no video. Used to review the UI against the mocks.
 */
const SHOTS = process.env['DEMO_SCREENSHOTS'];

/**
 * Shows the opening card, captions and closing card over the app, holds each narration paragraph
 * for at least its synthesized length, and logs when each caption appeared so the audio track can
 * be laid against the video afterwards. Draws in a closed shadow root with pointer-events off, so
 * it never changes the app's layout or behaviour.
 */
export class Presenter {
  private readonly started = Date.now();
  private readonly timeline: { id: string; start: number; poster: boolean }[] = [];
  private state: OverlayState;
  private shots = 0;

  private constructor(
    private readonly page: Page,
    private readonly manifest: Manifest,
    private readonly runDir: string,
  ) {
    this.state = { caption: null, card: null, position: 'bottom', logo: logoMarkup() };
  }

  static async start(page: Page, slug: string): Promise<Presenter> {
    if (SHOTS) return new Presenter(page, readNarration(slug), SHOTS);
    const runDir = join(process.env['DEMO_RUN_DIR'] ?? join(__dirname, '.run'), slug);
    const manifest = JSON.parse(readFileSync(join(runDir, 'manifest.json'), 'utf8')) as Manifest;
    const presenter = new Presenter(page, manifest, runDir);
    await page.addInitScript(installOverlay);
    await page.evaluate(installOverlay); // The page is still about:blank, which init scripts skip.
    return presenter;
  }

  get title(): string {
    return this.manifest.title;
  }

  /** A full-screen card with the FaithTech logo, narrated by the paragraph `id`. */
  async card(
    id: string,
    kind: 'opening' | 'closing',
    lines: string[],
    during?: () => Promise<void>,
  ): Promise<void> {
    await this.present(id, { card: { kind, title: this.manifest.title, lines } }, during);
    await this.render({ card: null, caption: null });
  }

  /** Captions the paragraph `id`, runs `action` while it is read, then holds until it ends. */
  async step(id: string, action?: () => Promise<void>, options: StepOptions = {}): Promise<void> {
    await this.present(id, { card: null, position: options.position ?? 'bottom' }, action, options);
  }

  /** Clears the captions and writes the timeline the audio track is assembled from. */
  async finish(): Promise<void> {
    if (SHOTS) return;
    await this.render({ caption: null, card: null });
    await this.page.waitForTimeout(600);
    const unused = this.manifest.clips.filter((c) => !this.timeline.some((t) => t.id === c.id));
    if (unused.length) throw new Error(`Narration never shown: ${unused.map((c) => c.id)}`);
    writeFileSync(
      join(this.runDir, 'timeline.json'),
      JSON.stringify(
        {
          slug: this.manifest.slug,
          end: (Date.now() - this.started) / 1000,
          steps: this.timeline,
        },
        null,
        2,
      ),
    );
  }

  private async present(
    id: string,
    change: Partial<OverlayState>,
    action?: () => Promise<void>,
    options: StepOptions = {},
  ): Promise<void> {
    const clip = this.manifest.clips.find((c) => c.id === id);
    if (!clip) throw new Error(`No narration paragraph "${id}" in ${this.manifest.slug}`);
    if (SHOTS) {
      if (action) await action();
      if (!change.card) await this.capture(id);
      return;
    }
    await this.render({ ...change, caption: clip.text });
    const shownAt = Date.now();
    this.timeline.push({
      id,
      start: (shownAt - this.started) / 1000,
      poster: options.poster ?? false,
    });
    if (action) await action();
    const remaining = shownAt + clip.duration * 1000 + MARGIN_MS - Date.now();
    if (remaining > 0) await this.page.waitForTimeout(remaining);
  }

  private async capture(id: string): Promise<void> {
    await this.page.waitForTimeout(500);
    const dir = join(this.runDir, this.manifest.slug, 'screenshots');
    mkdirSync(dir, { recursive: true });
    const n = String(++this.shots).padStart(2, '0');
    await this.page.screenshot({ path: join(dir, `${n}-${id}.png`) });
  }

  private async render(change: Partial<OverlayState>): Promise<void> {
    this.state = { ...this.state, ...change };
    // The newest init script runs last, so a navigation redraws the current state.
    await this.page.addInitScript((s) => {
      const w = window as unknown as { __demoRender?: (s: unknown) => void; __demoState: unknown };
      w.__demoState = s;
      w.__demoRender?.(s);
    }, this.state);
    await this.page.evaluate((s) => {
      const w = window as unknown as { __demoRender?: (s: unknown) => void; __demoState: unknown };
      w.__demoState = s;
      w.__demoRender?.(s);
    }, this.state);
  }
}

/** Reads docs/videos/journeys/<slug>/narration.md the way Record-JourneyVideos.ps1 does. */
function readNarration(slug: string): Manifest {
  const lines = readFileSync(
    join(REPO, 'docs', 'videos', 'journeys', slug, 'narration.md'),
    'utf8',
  ).split(String.fromCharCode(10)).map((l) => l.trim());
  const title = (lines.find((l) => l.startsWith('# ')) ?? '').slice(2);
  const clips: Clip[] = [];
  for (const line of lines) {
    const m = /^## ([a-z0-9-]+): (.+)$/.exec(line);
    if (m) clips.push({ id: m[1], chapter: m[2], text: '', duration: 0 });
    else if (clips.length && line.trim()) clips[clips.length - 1].text += ` ${line.trim()}`;
  }
  return { slug, title, clips };
}

/** The app's own logo artwork (components/logo-mark), without its Angular bindings. */
function logoMarkup(): string {
  const file = join(
    REPO,
    'frontend/projects/components/src/lib/logo-mark/logo-mark.component.html',
  );
  return readFileSync(file, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s\[[^\]]+\]="[^"]*"/g, '')
    .replace('<svg', '<svg aria-hidden="true"');
}

/** Runs in the page before any app script. Kept self-contained: it is serialized by Playwright. */
function installOverlay(): void {
  const w = window as unknown as {
    __demoRender: (s: OverlayState) => void;
    __demoState?: OverlayState;
  };
  let root: ShadowRoot | null = null;

  const css = `
    :host { all: initial; }
    .caption { position: fixed; left: 50%; transform: translateX(-50%); z-index: 2147483647;
      width: min(1040px, calc(100vw - 32px)); box-sizing: border-box; padding: 14px 22px;
      border-radius: 14px; background: rgba(20, 16, 40, 0.92); color: #fff;
      font: 500 clamp(15px, 2.6vw, 22px)/1.45 system-ui, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35); pointer-events: none; }
    .caption.bottom { bottom: 18px; }
    .caption.top { top: 18px; }
    .card { position: fixed; inset: 0; z-index: 2147483646; display: grid; place-content: center;
      justify-items: center; gap: 18px; padding: 32px 32px 140px; text-align: center;
      background: radial-gradient(circle at 30% 20%, #3b1d7a, #160f2e 70%); color: #fff;
      font-family: system-ui, 'Segoe UI', Roboto, sans-serif; pointer-events: none; }
    .card svg { width: 88px; height: 88px; }
    .kicker { font-size: 15px; letter-spacing: 0.14em; text-transform: uppercase; color: #d8c8ff; }
    h1 { margin: 0; font-size: clamp(30px, 5vw, 52px); font-weight: 700; }
    ul { margin: 6px 0 0; padding: 0; list-style: none; display: grid; gap: 8px;
      font-size: clamp(15px, 2.4vw, 21px); color: #ece6ff; }
  `;

  function render(s: OverlayState | undefined): void {
    if (!document.documentElement) {
      new MutationObserver((_, observer) => {
        observer.disconnect();
        render(w.__demoState);
      }).observe(document, { childList: true });
      return;
    }
    if (!root) {
      const host = document.createElement('div');
      host.setAttribute('data-demo-overlay', '');
      // A popover sits in the top layer, so modal dialogs (also top layer) cannot cover it.
      host.setAttribute('popover', 'manual');
      host.style.cssText =
        'all: initial; position: fixed; inset: 0; width: 0; height: 0; overflow: visible;' +
        'background: transparent; border: 0; padding: 0; margin: 0; pointer-events: none;';
      document.documentElement.appendChild(host);
      root = host.attachShadow({ mode: 'closed' });
      let queued = false;
      const raise = () => {
        queued = false;
        if (!host.isConnected) return;
        if (host.matches(':popover-open')) host.hidePopover();
        host.showPopover();
      };
      raise();
      // Dialogs and CDK overlays opened later join the top layer above the overlay; once per
      // frame after the DOM changes, move the overlay back on top.
      new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(raise);
      }).observe(document, { subtree: true, childList: true, attributeFilter: ['open'] });
    }
    root.replaceChildren();
    if (!s) return;
    const style = document.createElement('style');
    style.textContent = css;
    root.appendChild(style);
    if (s.card) {
      const card = document.createElement('div');
      card.className = 'card';
      const logo = document.createElement('div');
      logo.innerHTML = s.logo; // The repository's own logo file, not user content.
      const kicker = document.createElement('div');
      kicker.className = 'kicker';
      kicker.textContent =
        s.card.kind === 'opening' ? 'FaithTech Community · Journey' : 'What you saw';
      const title = document.createElement('h1');
      title.textContent = s.card.title;
      const list = document.createElement('ul');
      for (const line of s.card.lines) {
        const item = document.createElement('li');
        item.textContent = line;
        list.appendChild(item);
      }
      card.append(logo, kicker, title, list);
      root.appendChild(card);
    }
    if (s.caption) {
      const caption = document.createElement('div');
      caption.className = `caption ${s.card ? 'bottom' : s.position}`;
      caption.textContent = s.caption;
      root.appendChild(caption);
    }
  }

  w.__demoRender = (s) => {
    w.__demoState = s;
    render(s);
  };
  // Draw before the app's first paint, so a navigation never flashes the page without its caption.
  render(w.__demoState);
}

/** Types at a readable pace, so viewers see the field fill in. */
export async function typeInto(field: Locator, text: string): Promise<void> {
  await field.click();
  await field.clear();
  await field.pressSequentially(text, { delay: 45 });
}
