import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  effect,
  ElementRef,
  input,
  model,
  viewChildren,
} from '@angular/core';
import { TabComponent } from './tab.component';

/**
 * Tabs for sibling views. When the `ft-tab`s have `href` they render as a `<nav>` of links with
 * `aria-current` (the default for pages with their own URL). Otherwise they render as an APG
 * tablist with panels: roving tabindex, arrow keys, Home and End, `selectedIndex` two-way.
 */
@Component({
  selector: 'ft-tabs',
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsComponent {
  /** Accessible name of the tab list or navigation. */
  readonly label = input.required<string>();
  readonly selectedIndex = model(0);

  protected readonly tabs = contentChildren(TabComponent);
  protected readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');
  protected readonly navMode = computed(() => this.tabs().some((t) => t.href() !== null));

  constructor() {
    effect(() => {
      const selected = this.selectedIndex();
      const panels = !this.navMode();
      this.tabs().forEach((tab, i) => {
        tab.panelMode.set(panels);
        tab.active.set(panels && i === selected);
      });
    });
  }

  protected select(index: number): void {
    this.selectedIndex.set(index);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const last = this.tabs().length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = index === last ? 0 : index + 1;
        break;
      case 'ArrowLeft':
        next = index === 0 ? last : index - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.select(next);
    this.buttons()[next]?.nativeElement.focus();
  }
}
