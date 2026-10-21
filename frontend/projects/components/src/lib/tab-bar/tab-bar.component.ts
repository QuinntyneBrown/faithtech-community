import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon';

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
 * takes over. Tabs are links, not ARIA tabs.
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
}
