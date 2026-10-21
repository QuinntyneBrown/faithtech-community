import type { Page } from '@playwright/test';

/** Synthetic pictures for the profile journeys: no real person or place appears in any video. */
export type Scene = 'sunset' | 'skyline' | 'workshop';

export const SCENE_ALT: Record<Scene, string> = {
  sunset: 'Illustration of green hills under an orange sunset',
  skyline: 'Illustration of a city skyline at dusk',
  workshop: 'Illustration of people around a table with laptops',
};

export interface Picture {
  name: string;
  mimeType: string;
  buffer: Buffer;
  dataUrl: string;
}

/** Draws a scene on a canvas in the page and returns it as a JPEG file and data URL. */
export async function drawPicture(page: Page, scene: Scene): Promise<Picture> {
  const dataUrl = await page.evaluate(async (kind) => {
    const canvas = new OffscreenCanvas(960, 720);
    const c = canvas.getContext('2d')!;
    const sky = c.createLinearGradient(0, 0, 0, 720);
    const circle = (x: number, y: number, r: number, fill: string) => {
      c.fillStyle = fill;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    };
    if (kind === 'sunset') {
      sky.addColorStop(0, '#2b1055');
      sky.addColorStop(0.6, '#f97316');
      sky.addColorStop(1, '#fde68a');
      c.fillStyle = sky;
      c.fillRect(0, 0, 960, 720);
      circle(620, 430, 110, '#fff7d6');
      for (const [y, colour] of [
        [470, '#15803d'],
        [540, '#166534'],
        [610, '#14532d'],
      ] as const) {
        c.fillStyle = colour;
        c.beginPath();
        c.moveTo(0, 720);
        for (let x = 0; x <= 960; x += 20) c.lineTo(x, y + Math.sin(x / 130 + y) * 40);
        c.lineTo(960, 720);
        c.fill();
      }
    } else if (kind === 'skyline') {
      sky.addColorStop(0, '#1e1b4b');
      sky.addColorStop(1, '#c084fc');
      c.fillStyle = sky;
      c.fillRect(0, 0, 960, 720);
      circle(180, 140, 46, '#fef9c3');
      let x = 0;
      for (const [w, h] of [
        [90, 300],
        [70, 420],
        [110, 260],
        [60, 520],
        [120, 340],
        [80, 460],
        [100, 300],
        [90, 380],
        [80, 280],
        [110, 440],
      ]) {
        c.fillStyle = '#111827';
        c.fillRect(x, 720 - h, w, h);
        c.fillStyle = '#fde047';
        for (let wy = 720 - h + 20; wy < 700; wy += 36) {
          for (let wx = x + 12; wx < x + w - 16; wx += 24) {
            if ((wx * 7 + wy * 3) % 5 < 3) c.fillRect(wx, wy, 10, 14);
          }
        }
        x += w + 6;
      }
    } else {
      c.fillStyle = '#ede9fe';
      c.fillRect(0, 0, 960, 720);
      c.fillStyle = '#a16207';
      c.fillRect(120, 420, 720, 60);
      const people = ['#6d28d9', '#0f766e', '#be123c', '#1d4ed8', '#c2410c'];
      people.forEach((colour, i) => {
        const px = 200 + i * 140;
        circle(px, 250, 42, '#f5d0b5');
        c.fillStyle = colour;
        c.fillRect(px - 55, 300, 110, 120);
        c.fillStyle = '#334155';
        c.fillRect(px - 45, 370, 90, 50);
        c.fillStyle = '#94a3b8';
        c.fillRect(px - 38, 377, 76, 36);
      });
    }
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return `data:image/jpeg;base64,${btoa(binary)}`;
  }, scene);
  return {
    name: `${scene}.jpg`,
    mimeType: 'image/jpeg',
    buffer: Buffer.from(dataUrl.split(',')[1], 'base64'),
    dataUrl,
  };
}
