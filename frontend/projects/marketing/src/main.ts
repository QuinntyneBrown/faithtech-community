import { bootstrapApplication } from '@angular/platform-browser';

import { MarketingAppComponent } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(MarketingAppComponent, appConfig).catch((err) => console.error(err));
