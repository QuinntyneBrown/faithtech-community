import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Demo photos for the profile journeys, shared with the mocks (docs/mocks/assets/photos, credited
 * in CREDITS.md there). Portraits are AI-generated, so no real person stands in for a member.
 */
export type Scene =
  'leah-thompson' | 'samuel-mensah' | 'city' | 'hackathon-pairing' | 'whiteboard-talk';

const FILES: Record<Scene, string> = {
  'leah-thompson': 'people/leah-thompson.jpg',
  'samuel-mensah': 'people/samuel-mensah.jpg',
  city: 'city.jpg',
  'hackathon-pairing': 'hackathon-pairing.jpg',
  'whiteboard-talk': 'whiteboard-talk.jpg',
};

export const SCENE_ALT: Record<Scene, string> = {
  'leah-thompson': 'Leah smiling, in a head-and-shoulders portrait',
  'samuel-mensah': 'Samuel in a dark jacket against a brick wall',
  city: 'The Toronto skyline at dusk from the waterfront',
  'hackathon-pairing': 'Samuel helping two hackathon teammates debug their prototype on laptops',
  'whiteboard-talk': 'Samuel walking the Toronto team through an API sketch on the whiteboard',
};

export interface Picture {
  name: string;
  mimeType: string;
  buffer: Buffer;
  dataUrl: string;
}

const PHOTOS_DIR = join(__dirname, '..', '..', 'docs', 'mocks', 'assets', 'photos');

/** Reads a demo photo and returns it as a JPEG file and data URL. */
export function loadPicture(scene: Scene): Picture {
  const buffer = readFileSync(join(PHOTOS_DIR, FILES[scene]));
  return {
    name: `${scene}.jpg`,
    mimeType: 'image/jpeg',
    buffer,
    dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`,
  };
}
