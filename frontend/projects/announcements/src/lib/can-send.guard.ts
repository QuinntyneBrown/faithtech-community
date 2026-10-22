import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AUTH_SERVICE } from '@faithtech-community/api';

/**
 * Only Communications Leads and System Admins compose announcements; everyone else sees the
 * forbidden page. The API refuses them regardless (L2-029 AC3).
 */
export const canSendAnnouncements: CanActivateFn = () => {
  const roles = inject(AUTH_SERVICE).roles();
  return roles.includes('CommunicationsLead') || roles.includes('SystemAdmin')
    ? true
    : inject(Router).createUrlTree(['/forbidden']);
};
