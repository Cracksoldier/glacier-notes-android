import { type EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';

import { DatabaseService } from './database/database.service';
import { IMAGE_FILE_STORE } from './images/image-file-store';
import { ImageGcService } from './images/image-gc.service';
import { TrashMaintenanceService } from './maintenance/trash-maintenance.service';
import { SHARE_GATEWAY } from './native/share-gateway';
import { SettingsStore } from './preferences/settings.store';

/**
 * The whole of the app's startup work, as one initializer.
 *
 * It has to be one. Angular calls every app initializer before awaiting any of
 * them — `ApplicationInitStatus.runInitializers` invokes them in a loop,
 * collects the promises and `Promise.all`s them — so registering three in
 * dependency order sequences nothing. Split up, the purge ran against a
 * database still reporting `initializing` and a settings store still holding
 * defaults, returned at its own readiness guard, and deleted nothing on every
 * launch without ever failing.
 *
 * Angular holds the first render until this resolves, so the stored theme and
 * language are also in place before anything paints.
 */
export function provideStartup(): EnvironmentProviders {
  return provideAppInitializer(() => {
    // Injected up front: an injection context does not survive an `await`.
    const settings = inject(SettingsStore);
    const database = inject(DatabaseService);
    const images = inject(IMAGE_FILE_STORE);
    const trash = inject(TrashMaintenanceService);
    const imageGc = inject(ImageGcService);
    const shares = inject(SHARE_GATEWAY);

    // Loading preferences, opening the database and creating the image
    // directory are independent, and `DatabaseService.init` deliberately cannot
    // reject. The purge needs the first two.
    return (
      Promise.all([settings.init(), database.init(), images.init()])
        .then(() => trash.runStartupPurge())
        // Then, so that whatever the purge just freed is collected in the same
        // pass, and so a file written by an attach the app was killed in the
        // middle of does not leak forever.
        .then(() => imageGc.sweep())
        // Last, and touching nothing above: an export staged for the share sheet
        // is deliberately not deleted when the share sheet closes, so a relaunch
        // is what bounds its life. See `CapacitorShareGateway.sweep()`.
        .then(() => shares.sweep())
    );
  });
}
