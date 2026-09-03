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
import { EXPORT_FILE_WRITER } from './app/core/filesystem/export-file-writer';
import { IMAGE_FILE_STORE } from './app/core/images/image-file-store';
import { DOCUMENT_GATEWAY } from './app/core/native/document-gateway';
import { SHARE_GATEWAY } from './app/core/native/share-gateway';
import { CapacitorPreferencesAdapter } from './app/core/preferences/capacitor-preferences.adapter';
import { PREFERENCES_ADAPTER } from './app/core/preferences/preferences-adapter';
import { provideStartup } from './app/core/startup';
import {
  createDatabaseAdapter,
  createDocumentGateway,
  createExportFileWriter,
  createImageFileStore,
  createShareGateway,
} from './environments/environment';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // `useSetInputAPI` decides how Ionic hands `componentProps` to a component
    // it creates for an overlay. Left off, it `Object.assign`s them, which
    // overwrites an `input()` signal with a plain value — the template then
    // calls a string and the overlay silently renders nothing.
    provideIonicAngular({ useSetInputAPI: true }),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    { provide: PREFERENCES_ADAPTER, useExisting: CapacitorPreferencesAdapter },
    { provide: DATABASE_ADAPTER, useFactory: createDatabaseAdapter },
    { provide: IMAGE_FILE_STORE, useFactory: createImageFileStore },
    { provide: DOCUMENT_GATEWAY, useFactory: createDocumentGateway },
    { provide: SHARE_GATEWAY, useFactory: createShareGateway },
    // After the two gateways it dispatches over.
    { provide: EXPORT_FILE_WRITER, useFactory: createExportFileWriter },
    // Settings, the database, the startup trash purge, the image sweep and the
    // staged-share sweep, in that order — see provideStartup() for why the
    // ordering cannot be expressed as separate initializers.
    provideStartup(),
  ],
});
