import { Role, isLead } from '@faithtech-community/api';

export interface Section {
  label: string;
  href: string;
  icon: string;
  /** Hidden from the top bar between 768px and 1023px (design system, top bar). */
  secondary?: boolean;
  /** Whether a member holding these roles may open the section; the API refuses the rest. */
  opens: (roles: readonly Role[]) => boolean;
}

const anyone = () => true;
const has =
  (...allowed: Role[]) =>
  (roles: readonly Role[]) =>
    roles.some((r) => allowed.includes(r));

/**
 * Every section in the order the top bar, the tab bar and the menu show them
 * (docs/adr/0009-shell-navigation-by-role.md).
 */
export const SECTIONS: readonly Section[] = [
  { label: 'Home', href: '/', icon: 'home', opens: anyone },
  { label: 'Events', href: '/events', icon: 'events', opens: anyone },
  // Private contacts belong to the lead who created them; System Admin may see all (L2-012).
  { label: 'Contacts', href: '/contacts', icon: 'contacts', opens: isLead },
  // One shared pipeline for leads, read-only for Staff (L2-017).
  {
    label: 'Partners',
    href: '/partners',
    icon: 'partners',
    opens: (roles) => isLead(roles) || roles.includes('Staff'),
  },
  // Workspaces are for leads and volunteers; Staff and System Admin see all of them (L2-050).
  {
    label: 'Workspaces',
    href: '/workspaces',
    icon: 'workspaces',
    secondary: true,
    opens: (roles) => isLead(roles) || has('Volunteer', 'Staff', 'SystemAdmin')(roles),
  },
  { label: 'Team', href: '/team', icon: 'team', secondary: true, opens: anyone },
  {
    label: 'Announcements',
    href: '/announcements',
    icon: 'announcements',
    secondary: true,
    opens: anyone,
  },
  // The people directory (L2-053).
  {
    label: 'People',
    href: '/people',
    icon: 'team',
    secondary: true,
    opens: has('CityLead', 'Staff', 'SystemAdmin'),
  },
  // Only System Admins see the admin area (L2-040).
  { label: 'Admin', href: '/admin', icon: 'admin', secondary: true, opens: has('SystemAdmin') },
];

export const SEARCH_SECTION: Section = {
  label: 'Search',
  href: '/search',
  icon: 'search',
  opens: anyone,
};

/** The sections a member holding `roles` may open, in order. */
export function sectionsFor(roles: readonly Role[]): Section[] {
  return SECTIONS.filter((s) => s.opens(roles));
}

/**
 * The phone tab bar's links: Home, Events, Search and the member's next section. A More tab
 * follows them and opens the menu of every section.
 */
export function tabsFor(roles: readonly Role[]): Section[] {
  const [home, events, ...rest] = sectionsFor(roles);
  return [home, events, SEARCH_SECTION, ...rest.slice(0, 1)];
}
