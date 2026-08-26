import { inject, provideAppInitializer } from '@angular/core';
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
import { CapacitorPreferencesAdapter } from './app/core/preferences/capacitor-preferences.adapter';
import { PREFERENCES_ADAPTER } from './app/core/preferences/preferences-adapter';
import { SettingsStore } from './app/core/preferences/settings.store';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    { provide: PREFERENCES_ADAPTER, useExisting: CapacitorPreferencesAdapter },
    // Angular holds the first render until this resolves, so the stored theme
    // and language are in place before anything paints.
    provideAppInitializer(() => inject(SettingsStore).init()),
  ],
});
