import { Capability, hasAny } from '@faithtech-community/api';

export interface Section {
  label: string;
  href: string;
  icon: string;
  /** Hidden from the top bar between 768px and 1023px (design system, top bar). */
  secondary?: boolean;
  /**
   * Whether a member holding these capabilities may open the section. Hiding is a convenience; the API refuses
   * the rest (L2-133 AC2, L2-135 AC7).
   */
  opens: (capabilities: readonly Capability[]) => boolean;
}

const anyone = () => true;
const any =
  (...wanted: Capability[]) =>
  (capabilities: readonly Capability[]) =>
    hasAny(capabilities, ...wanted);

/**
 * Every section in the order the top bar, the tab bar and the menu show them, each opened by capabilities
 * (docs/adr/0009-shell-navigation-by-role.md as refined by ADR 0033, L2-045 AC4).
 */
export const SECTIONS: readonly Section[] = [
  { label: 'Home', href: '/', icon: 'home', opens: anyone },
  { label: 'Events', href: '/events', icon: 'events', opens: anyone },
  // Private contacts belong to the member who created them (L2-012).
  { label: 'Contacts', href: '/contacts', icon: 'contacts', opens: any('KeepContacts') },
  // One shared pipeline, read-only without ManagePartners (L2-017).
  {
    label: 'Partners',
    href: '/partners',
    icon: 'partners',
    opens: any('ViewPartners', 'ManagePartners'),
  },
  // Workspaces for owners and members; ReadAllWorkspaces sees all of them (L2-050).
  {
    label: 'Workspaces',
    href: '/workspaces',
    icon: 'workspaces',
    secondary: true,
    opens: any('OwnWorkspaces', 'JoinWorkspaces', 'ReadAllWorkspaces'),
  },
  { label: 'Team', href: '/team', icon: 'team', secondary: true, opens: anyone },
  {
    label: 'Announcements',
    href: '/announcements',
    icon: 'announcements',
    secondary: true,
    opens: anyone,
  },
  // Decks, logos, training and templates, for every signed-in member (L2-055).
  {
    label: 'Resources',
    href: '/resources',
    icon: 'resources',
    secondary: true,
    opens: anyone,
  },
  // Docs & notes: block-based pages, for every signed-in member (L2-085).
  {
    label: 'Notes',
    href: '/notes',
    icon: 'notes',
    secondary: true,
    opens: anyone,
  },
  // The people directory (L2-053).
  {
    label: 'People',
    href: '/people',
    icon: 'team',
    secondary: true,
    opens: any('ViewPeopleDirectory'),
  },
  // City-level numbers for ViewReports only (L2-123, ADR 0031).
  {
    label: 'Reports',
    href: '/reports',
    icon: 'reports',
    secondary: true,
    opens: any('ViewReports'),
  },
  // The organisation's settings for whoever manages its roles or its settings (L2-147 AC1).
  {
    label: 'Organisation',
    href: '/organisation',
    icon: 'organisation',
    secondary: true,
    opens: any('ManageRoles', 'ManageOrganisationSettings'),
  },
  // Only administrators see the admin area (L2-040).
  {
    label: 'Admin',
    href: '/admin',
    icon: 'admin',
    secondary: true,
    opens: (capabilities) => capabilities.includes('AdministerOrganisation'),
  },
];

export const SEARCH_SECTION: Section = {
  label: 'Search',
  href: '/search',
  icon: 'search',
  opens: anyone,
};

/** The sections a member holding `capabilities` may open, in order. */
export function sectionsFor(capabilities: readonly Capability[]): Section[] {
  return SECTIONS.filter((s) => s.opens(capabilities));
}

/**
 * The phone tab bar's links: Home, Events, Search and the member's next section. A More tab
 * follows them and opens the menu of every section.
 */
export function tabsFor(capabilities: readonly Capability[]): Section[] {
  const [home, events, ...rest] = sectionsFor(capabilities);
  return [home, events, SEARCH_SECTION, ...rest.slice(0, 1)];
}
