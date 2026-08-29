import { bootstrapApplication } from '@angular/platform-browser';
import {
  PreloadAllModules,
  RouteReuseStrategy,
  provideRouter,
  withComponentInputBinding,
  withPreloading,
} from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { DATABASE_ADAPTER } from './app/core/database/database-adapter';
import { CapacitorPreferencesAdapter } from './app/core/preferences/capacitor-preferences.adapter';
import { PREFERENCES_ADAPTER } from './app/core/preferences/preferences-adapter';
import { provideStartup } from './app/core/startup';
import { createDatabaseAdapter } from './environments/environment';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    { provide: PREFERENCES_ADAPTER, useExisting: CapacitorPreferencesAdapter },
    { provide: DATABASE_ADAPTER, useFactory: createDatabaseAdapter },
    // Settings, the database and the startup trash purge, in that order — see
    // provideStartup() for why the ordering cannot be expressed as three
    // separate initializers.
    provideStartup(),
  ],
});
