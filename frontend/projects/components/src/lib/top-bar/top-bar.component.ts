import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LogoMarkComponent } from '../logo-mark';

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
  imports: [LogoMarkComponent],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBarComponent {
  readonly links = input<TopBarLink[]>([]);
  readonly homeHref = input('/');
  readonly anonymous = input(false);
  readonly navLabel = input('Primary');
  readonly searchLabel = input('Search FaithTech');
  readonly searchPlaceholder = input('Search people, events, partners');
  /** Emits the trimmed query when the search form is submitted. */
  readonly searchSubmit = output<string>();

  protected readonly searchId = `ft-top-bar-search-${nextId++}`;

  protected onSearch(event: Event, value: string): void {
    event.preventDefault();
    this.searchSubmit.emit(value.trim());
  }
}
