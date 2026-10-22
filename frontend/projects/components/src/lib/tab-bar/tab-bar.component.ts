import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
} from '@angular/core';
import { IconComponent } from '../icon';
import { TabBarPresence } from './tab-bar-presence.service';

export interface TabBarItem {
  label: string;
  href: string;
  /** Name from the design system icon set. */
  icon: string;
  /** Marks the section's tab (`aria-current="page"`). */
  current?: boolean;
}

/**
 * Phone navigation pinned to the bottom of the screen. Hidden from 768px, where the top bar nav
 * takes over. Tabs are links, not ARIA tabs. With `moreLabel` the last tab is a button that opens
 * the menu of every section (`more`); it is current while the page is outside the other tabs.
 */
@Component({
  selector: 'ft-tab-bar',
  imports: [IconComponent],
  templateUrl: './tab-bar.component.html',
  styleUrl: './tab-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabBarComponent {
  readonly items = input<TabBarItem[]>([]);
  readonly label = input('Primary, phone');
  /** Label of the trailing More button; no button when null. */
  readonly moreLabel = input<string | null>(null);
  /** Marks More current (`aria-current="true"`) when no link tab is the current page. */
  readonly moreCurrent = input(false);
  /** Emits when More is pressed, to open the menu. */
  readonly more = output<void>();

  constructor() {
    // Toasts and other bottom overlays sit above the tab bar while it is on screen.
    inject(DestroyRef).onDestroy(inject(TabBarPresence).register());
  }
}
