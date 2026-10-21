import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AUTH_SERVICE } from '@faithtech-community/api';
import { BannerComponent, ButtonComponent } from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

/** The signed-in chrome around every member page. */
@Component({
  selector: 'ft-app-shell',
  imports: [RouterOutlet, BannerComponent, ButtonComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly auth = inject(AUTH_SERVICE);

  protected readonly user = this.auth.currentUser;
  /** Unverified members can browse but must verify to RSVP, create content or invite (L2-002 AC3). */
  protected readonly unverified = computed(() => this.user()?.emailVerified === false);
  protected readonly resend = signal<'idle' | 'sending' | 'sent' | 'limited'>('idle');

  protected async sendAgain(): Promise<void> {
    const email = this.user()?.email;
    if (!email) return;
    this.resend.set('sending');
    try {
      await firstValueFrom(this.auth.resendVerification(email));
      this.resend.set('sent');
    } catch (error) {
      this.resend.set(
        error instanceof HttpErrorResponse && error.status === 429 ? 'limited' : 'idle',
      );
    }
  }
}
