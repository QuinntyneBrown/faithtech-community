import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AUTH_SERVICE } from '@faithtech-community/api';
import {
  AlertComponent,
  AuthLayoutComponent,
  LinkComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

/** Completes the authorization code + PKCE exchange and returns the member to the page they asked for. */
@Component({
  selector: 'ft-auth-callback-page',
  imports: [AuthLayoutComponent, AlertComponent, LinkComponent],
  templateUrl: './auth-callback.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCallbackPage implements OnInit {
  private readonly auth = inject(AUTH_SERVICE);
  private readonly router = inject(Router);

  protected readonly failed = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const returnUrl = await this.auth.completeSignIn(window.location.search);
      await firstValueFrom(this.auth.loadCurrentUser());
      await this.router.navigateByUrl(returnUrl, { replaceUrl: true });
    } catch {
      this.failed.set(true);
    }
  }
}
