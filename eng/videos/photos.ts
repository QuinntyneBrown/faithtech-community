import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Demo photos for the profile journeys, shared with the mocks (docs/mocks/assets/photos, credited
 * in CREDITS.md there). Portraits are AI-generated, so no real person stands in for a member.
 */
export type Scene =
  | 'leah-thompson'
  | 'samuel-mensah'
  | 'grace-okonkwo'
  | 'priya-shah'
  | 'victor-kane'
  | 'esther-nakamura'
  | 'tomas-ortega'
  | 'marcus-lee'
  | 'hannah-kim'
  | 'ruth-alvarez'
  | 'city'
  | 'hackathon-pairing'
  | 'whiteboard-talk';

const FILES: Record<Scene, string> = {
  'leah-thompson': 'people/leah-thompson.jpg',
  'samuel-mensah': 'people/samuel-mensah.jpg',
  'grace-okonkwo': 'people/grace-okonkwo.jpg',
  'priya-shah': 'people/priya-shah.jpg',
  'victor-kane': 'people/victor-kane.jpg',
  'esther-nakamura': 'people/esther-nakamura.jpg',
  'tomas-ortega': 'people/tomas-ortega.jpg',
  'marcus-lee': 'people/marcus-lee.jpg',
  'hannah-kim': 'people/hannah-kim.jpg',
  'ruth-alvarez': 'people/ruth-alvarez.jpg',
  city: 'city.jpg',
  'hackathon-pairing': 'hackathon-pairing.jpg',
  'whiteboard-talk': 'whiteboard-talk.jpg',
};

export const SCENE_ALT: Record<Scene, string> = {
  'leah-thompson': 'Leah smiling, in a head-and-shoulders portrait',
  'samuel-mensah': 'Samuel in a dark jacket against a brick wall',
  'grace-okonkwo': 'Grace smiling, in a head-and-shoulders portrait',
  'priya-shah': 'Priya in a head-and-shoulders portrait',
  'victor-kane': 'Victor in a head-and-shoulders portrait',
  'esther-nakamura': 'Esther in a head-and-shoulders portrait',
  'tomas-ortega': 'Tomás in a head-and-shoulders portrait',
  'marcus-lee': 'Marcus in a head-and-shoulders portrait',
  'hannah-kim': 'Hannah in a head-and-shoulders portrait',
  'ruth-alvarez': 'Ruth in a head-and-shoulders portrait',
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

/** A demo portrait stored as a member's featured photo, shaped as the fake API's profile photos. */
export function featuredPhoto(scene: Scene): {
  id: string;
  url: string;
  altText: string;
  isFeatured: boolean;
  uploadedAt: string;
} {
  return {
    id: `${scene}-featured`,
    url: loadPicture(scene).dataUrl,
    altText: SCENE_ALT[scene],
    isFeatured: true,
    uploadedAt: '2026-10-01T10:00:00Z',
  };
}

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
