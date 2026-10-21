import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LogoMarkComponent } from '../logo-mark/logo-mark.component';

/**
 * The centred auth card used by sign in, sign up, verify email, forgot and reset password and accept
 * invite (docs/design-system/components/layout.html, "Auth layout"). It owns the page's main landmark.
 */
@Component({
  selector: 'ft-auth-layout',
  imports: [LogoMarkComponent],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayoutComponent {}
