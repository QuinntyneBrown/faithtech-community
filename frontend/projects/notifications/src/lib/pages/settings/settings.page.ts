import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ANNOUNCEMENTS_SERVICE } from '@faithtech-community/api';
import {
  CardComponent,
  InlineMessageComponent,
  PageHeaderComponent,
  RadioComponent,
  RadioGroupComponent,
  StackComponent,
  SwitchComponent,
  ThemePreference,
  ThemeService,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * Settings (mock `pages/settings`). Appearance applies the chosen theme at once and remembers it
 * on this device (L2-045 AC6). "Email me announcements" saves the announcement email opt-out when it is
 * flipped (L2-030 AC2, ADR 0015). The account card joins when its design is built.
 */
@Component({
  selector: 'ft-settings-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CardComponent,
    InlineMessageComponent,
    PageHeaderComponent,
    RadioComponent,
    RadioGroupComponent,
    StackComponent,
    SwitchComponent,
  ],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly theme = inject(ThemeService);
  private readonly announcements = inject(ANNOUNCEMENTS_SERVICE);

  protected readonly preference = this.theme.preference;
  /** "Email me announcements" is on while the member has not opted out; disabled until it is read. */
  protected readonly emailAnnouncements = new FormControl(
    { value: true, disabled: true },
    { nonNullable: true },
  );
  protected readonly save = signal<SaveState>('idle');

  constructor() {
    this.emailAnnouncements.valueChanges.subscribe((on) => void this.setEmailAnnouncements(on));
    void this.load();
  }

  protected choose(preference: ThemePreference): void {
    this.theme.set(preference);
  }

  private async setEmailAnnouncements(on: boolean): Promise<void> {
    this.save.set('saving');
    try {
      await firstValueFrom(this.announcements.setEmailOptOut(!on));
      this.save.set('saved');
    } catch {
      this.emailAnnouncements.setValue(!on, { emitEvent: false });
      this.save.set('failed');
    }
  }

  private async load(): Promise<void> {
    try {
      const optedOut = await firstValueFrom(this.announcements.getEmailOptOut());
      this.emailAnnouncements.setValue(!optedOut, { emitEvent: false });
    } catch {
      // The switch shows the default; flipping it still saves the member's choice.
    }
    this.emailAnnouncements.enable({ emitEvent: false });
  }
}
