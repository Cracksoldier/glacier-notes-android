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
  // The notes page filtered to one notebook — the same list, a different view.
  {
    path: 'notebooks/:notebookId',
    loadComponent: () => import('./features/notes/notes.page').then((m) => m.NotesPage),
  },
  {
    path: 'labels',
    loadComponent: () => import('./features/labels/labels.page').then((m) => m.LabelsPage),
  },
  // As with a notebook: the same list, a different view.
  {
    path: 'labels/:labelId',
    loadComponent: () => import('./features/notes/notes.page').then((m) => m.NotesPage),
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
