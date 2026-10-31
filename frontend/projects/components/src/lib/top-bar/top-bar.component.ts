import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LogoMarkComponent } from '../logo-mark';
import { ORGANISATION_NAMES } from '../organisation-names/organisation-names';
import { TextFieldComponent } from '../text-field';

export interface TopBarLink {
  label: string;
  href: string;
  /** Marks the current page (`aria-current="page"`). */
  current?: boolean;
  /** Secondary links hide between 768px and 1023px so the row never wraps. */
  secondary?: boolean;
}

let nextId = 0;

/**
 * The floating capsule across the top of every page: brand, primary nav, global search and an
 * actions slot (`ftTopBarActions`) for the notification bell and profile avatar. Anonymous
 * visitors get the brand and actions only.
 */
@Component({
  selector: 'ft-top-bar',
  imports: [LogoMarkComponent, TextFieldComponent],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBarComponent {
  readonly links = input<TopBarLink[]>([]);
  readonly homeHref = input('/');
  readonly anonymous = input(false);
  readonly navLabel = input('Primary');
  /** The search field's label; "Search {short name}" when not given. */
  readonly searchLabel = input<string | null>(null);
  readonly searchPlaceholder = input('Search people, events, partners');
  /** Emits the trimmed query when the search form is submitted. */
  readonly searchSubmit = output<string>();
  /**
   * Label of a More button at the end of the nav, shown only from 768px to 1023px where the
   * secondary links are hidden, so every section stays reachable; no button when null.
   */
  readonly moreLabel = input<string | null>(null);
  /** Emits when More is pressed, to open the menu of every section. */
  readonly more = output<void>();

  /** The organisation's short name is the product name in the brand (L2-134 AC1). */
  protected readonly organisation = inject(ORGANISATION_NAMES);
  protected readonly search = computed(
    () => this.searchLabel() ?? `Search ${this.organisation.shortName()}`,
  );
  protected readonly searchId = `ft-top-bar-search-${nextId++}`;

  protected onSearch(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const field = form.elements.namedItem('q') as HTMLInputElement | null;
    this.searchSubmit.emit((field?.value ?? '').trim());
  }
}
