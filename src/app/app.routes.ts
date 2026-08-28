import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'notes',
    loadComponent: () => import('./features/notes/notes.page').then((m) => m.NotesPage),
  },
  {
    path: 'notes/:id',
    loadComponent: () => import('./features/notes/note-editor.page').then((m) => m.NoteEditorPage),
  },
  {
    path: 'notebooks',
    loadComponent: () => import('./features/notebooks/notebooks.page').then((m) => m.NotebooksPage),
  },
  {
    path: 'labels',
    loadComponent: () => import('./features/labels/labels.page').then((m) => m.LabelsPage),
  },
  {
    path: 'archive',
    loadComponent: () => import('./features/archive/archive.page').then((m) => m.ArchivePage),
  },
  {
    path: 'trash',
    loadComponent: () => import('./features/trash/trash.page').then((m) => m.TrashPage),
  },
  {
    path: 'search',
    loadComponent: () => import('./features/search/search.page').then((m) => m.SearchPage),
  },
  {
    path: 'import-export',
    loadComponent: () =>
      import('./features/import-export/import-export.page').then((m) => m.ImportExportPage),
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage),
  },
  {
    path: '',
    redirectTo: 'notes',
    pathMatch: 'full',
  },
];
