import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

let nextId = 0;

/**
 * One tab of `ft-tabs`. With `href` it is a navigation tab (a link to its own page). Without it
 * the projected content is the tab's panel, shown while the tab is selected.
 */
@Component({
  selector: 'ft-tab',
  templateUrl: './tab.component.html',
  styleUrl: './tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'panelMode() ? "tabpanel" : null',
    '[attr.id]': 'panelMode() ? panelId : null',
    '[attr.aria-labelledby]': 'panelMode() ? tabId : null',
    '[attr.tabindex]': 'panelMode() ? 0 : null',
    '[hidden]': 'panelMode() ? !active() : true',
  },
})
export class TabComponent {
  readonly label = input.required<string>();
  readonly href = input<string | null>(null);
  /** Navigation tabs only: the tab for the current page. */
  readonly current = input(false);

  /** Set by `ft-tabs`: this tab is the selected one. */
  readonly active = signal(false);
  /** Set by `ft-tabs`: the tabs are APG tabs with panels. */
  readonly panelMode = signal(false);

  readonly tabId = `ft-tab-${nextId}`;
  readonly panelId = `ft-tab-panel-${nextId++}`;
}
