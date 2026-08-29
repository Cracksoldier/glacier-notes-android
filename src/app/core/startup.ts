import { type EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';

import { DatabaseService } from './database/database.service';
import { TrashMaintenanceService } from './maintenance/trash-maintenance.service';
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
    const trash = inject(TrashMaintenanceService);

    // Loading preferences and opening the database are independent, and
    // `DatabaseService.init` deliberately cannot reject. The purge needs both.
    return Promise.all([settings.init(), database.init()]).then(() => trash.runStartupPurge());
  });
}
