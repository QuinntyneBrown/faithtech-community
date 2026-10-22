/** Inline icon set from docs/design-system/foundations/iconography.html: 24 unit grid, 2 unit stroke. */
export const ICONS: Readonly<Record<string, string>> = {
  brand: "<path d='M12 2v20M5 8h14'/><circle cx='12' cy='8' r='9' fill='none' opacity='.35'/>",
  notifications: "<path d='M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0'/>",
  move: "<path d='M5 12h14M13 6l6 6-6 6'/>",
  home: "<path d='M3 12 12 3l9 9M5 10v10h14V10'/>",
  events: "<rect x='3' y='5' width='18' height='16' rx='2'/><path d='M3 10h18M8 3v4M16 3v4'/>",
  search: "<circle cx='11' cy='11' r='7'/><path d='m20 20-3.5-3.5'/>",
  contacts:
    "<rect x='3' y='4' width='18' height='16' rx='2'/><circle cx='9' cy='11' r='2.5'/><path d='M5.5 17a3.5 3.5 0 0 1 7 0M15 9h3M15 13h3'/>",
  partners: "<path d='M2 12l4-4 4 2 4-4 4 4 4 2M6 8v7l4 4 2-2 2 2 4-4v-5'/>",
  more: "<circle cx='5' cy='12' r='1.5'/><circle cx='12' cy='12' r='1.5'/><circle cx='19' cy='12' r='1.5'/>",
  close: "<path d='M6 6l12 12M18 6 6 18'/>",
  error: "<circle cx='12' cy='12' r='9'/><path d='M12 8v4M12 16h.01'/>",
  add: "<path d='M12 5v14M5 12h14'/>",
  team: "<circle cx='9' cy='8' r='4'/><path d='M2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3'/>",
  archive: "<path d='M3 4h18v4H3zM5 8v12h14V8M10 12h4'/>",
  done: "<path d='M4 12l6 6L20 6'/>",
  delete: "<path d='M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'/>",
  link: "<path d='M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'/>",
  admin: "<path d='M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'/>",
  'remove-member':
    "<circle cx='9' cy='8' r='4'/><path d='M2 21a7 7 0 0 1 14 0M17 8l5 5M22 8l-5 5'/>",
  invite: "<path d='M22 2 11 13M22 2l-7 20-4-9-9-4z'/>",
  qr: "<rect x='3' y='3' width='7' height='7' rx='1'/><rect x='14' y='3' width='7' height='7' rx='1'/><rect x='3' y='14' width='7' height='7' rx='1'/><path d='M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3'/>",
  copy: "<rect x='9' y='9' width='12' height='12' rx='2'/><path d='M5 15V5a2 2 0 0 1 2-2h10'/>",
  download: "<path d='M12 3v12M7 10l5 5 5-5M4 21h16'/>",
  refresh: "<path d='M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5'/>",
  workspaces: "<path d='M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'/>",
  'planning-poker':
    "<path d='m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z'/>",
  // The Planning Poker star, named for Feature on a photo (iconography: Star).
  star: "<path d='m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z'/>",
  settings:
    "<circle cx='12' cy='12' r='3'/><path d='M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3.9a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 2.4a7 7 0 0 0-1.7 1L5.1 5.5l-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 1.7 1l.4 2.4h5l.4-2.4a7 7 0 0 0 1.7-1l2.3.9 2-3.4-2-1.5c.1-.3.1-.7.1-1z'/>",
  'read-only-view':
    "<path d='M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z'/><circle cx='12' cy='12' r='3'/>",
  success: "<circle cx='12' cy='12' r='9'/><path d='m8 12 3 3 5-6'/>",
  warning: "<path d='M12 3 2 20h20zM12 10v4M12 17h.01'/>",
  info: "<circle cx='12' cy='12' r='9'/><path d='M12 11v5M12 8h.01'/>",
  expired: "<circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 3'/>",
  restore: "<path d='M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5'/>",
  'try-again': "<path d='M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5'/>",
  locked: "<rect x='4' y='11' width='16' height='10' rx='2'/><path d='M8 11V7a4 4 0 0 1 8 0v4'/>",
  announcements:
    "<path d='M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM17 9a4 4 0 0 1 0 6'/>",
  export: "<path d='M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3'/>",
  edit: "<path d='M4 20h4L19 9l-4-4L4 16zM14 6l4 4'/>",
  email: "<rect x='3' y='5' width='18' height='14' rx='2'/><path d='m3 7 9 6 9-6'/>",
  offline:
    "<path d='M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5-2.7M19 12.5a10 10 0 0 0-2.1-1.5M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 11 5M12 20h.01'/>",
  location:
    "<path d='M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z'/><circle cx='12' cy='10' r='2.5'/>",
  photo:
    "<rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='9' cy='9' r='2'/><path d='m21 15-5-5L5 21'/>",
  'sign-out': "<path d='M15 4h4v16h-4M10 17l5-5-5-5M15 12H3'/>",
  resources: "<path d='M4 4h6l2 2h8v14H4z'/><path d='M8 12h8M8 16h5'/>",
  notes: "<path d='M5 3h10l4 4v14H5z'/><path d='M9 9h6M9 13h6M9 17h4'/>",
  deck: "<rect x='3' y='4' width='18' height='12' rx='1'/><path d='M12 16v4M8 20h8'/>",
  logo: "<circle cx='12' cy='12' r='9'/><path d='M12 7v10M8 10h8'/>",
  image:
    "<rect x='3' y='5' width='18' height='14' rx='2'/><circle cx='9' cy='10' r='2'/><path d='m21 16-5-5-9 8'/>",
  training: "<path d='M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5'/>",
  template: "<rect x='4' y='3' width='16' height='18' rx='2'/><path d='M4 9h16M10 9v12'/>",
  document: "<path d='M6 3h8l5 5v13H6zM14 3v5h5M9 13h6M9 17h6'/>",
  video: "<rect x='3' y='5' width='14' height='14' rx='2'/><path d='m17 10 4-2v8l-4-2'/>",
  file: "<path d='M6 3h8l5 5v13H6zM14 3v5h5'/>",
  external: "<path d='M14 4h6v6M20 4l-9 9M18 14v6H4V6h6'/>",
  upload: "<path d='M12 20V9M7 14l5-5 5 5M5 4h14'/>",
  shared:
    "<circle cx='9' cy='8' r='4'/><path d='M2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3'/>",
  transfer: "<path d='M4 8h14l-4-4M20 16H6l4 4'/>",
  suspended: "<circle cx='12' cy='12' r='9'/><path d='M5.6 5.6l12.8 12.8'/>",
};

export const ICON_NAMES = Object.keys(ICONS);
