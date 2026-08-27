import { Injectable, inject, signal } from '@angular/core';

import { DATABASE_ADAPTER } from './database-adapter';
import { runMigrations } from './migrations/migration-runner';

export type DatabaseStatus = 'initializing' | 'ready' | 'error';

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private readonly adapter = inject(DATABASE_ADAPTER);
  private readonly state = signal<DatabaseStatus>('initializing');
  private readonly failure = signal<string | null>(null);

  readonly status = this.state.asReadonly();
  readonly error = this.failure.asReadonly();

  /**
   * Opens the database and brings the schema up to date.
   *
   * **This never rejects.** It runs as an app initializer, and a rejected
   * initializer aborts bootstrap — the user would get a white screen with no
   * way to reach Settings or Import/Export. Instead the failure is recorded in
   * `status` so the UI can say what happened.
   *
   * Nothing here deletes or recreates the database file. A database this build
   * cannot migrate is left exactly as it was found, so a later build can still
   * read it; discarding it would be destroying the only copy of the user's
   * notes.
   */
  async init(): Promise<void> {
    try {
      await this.adapter.open();
      await runMigrations(this.adapter);
      this.state.set('ready');
    } catch (error) {
      this.failure.set(error instanceof Error ? error.message : String(error));
      this.state.set('error');
      // Safe to log: this runs before any note is read, so no note content,
      // title or image payload can be in scope.
      console.error('[glacier] database initialization failed', error);
    }
  }
}
