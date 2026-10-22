import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

/** `unsaved`: changes wait for the next save, so nothing is claimed yet. */
export type SaveState = 'unsaved' | 'saved' | 'saving' | 'failed';

/**
 * Autosave status (design system, save status): "Saving…" and "Saved" through a polite live region, "Couldn’t
 * save" through an assertive one with Retry (L2-086 AC8, AC9, L2-099 AC6).
 */
@Component({
  selector: 'ft-save-status',
  imports: [ButtonComponent, IconComponent],
  templateUrl: './save-status.component.html',
  styleUrl: './save-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaveStatusComponent {
  readonly state = input<SaveState>('saved');
  readonly retry = output<void>();
}
