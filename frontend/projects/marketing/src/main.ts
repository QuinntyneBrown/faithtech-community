import { bootstrapApplication } from '@angular/platform-browser';
import { fetchSite } from '@faithtech-community/api';

import { MarketingAppComponent } from './app/app';
import { marketingConfig } from './app/app.config';

// One build serves every public host: the host's site decides the community origin and the content (L2-134 AC3).
fetchSite()
  .then((site) => bootstrapApplication(MarketingAppComponent, marketingConfig(site)))
  .catch((err) => console.error(err));
