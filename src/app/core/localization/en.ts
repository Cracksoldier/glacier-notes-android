/**
 * Keys and wording are taken from the desktop's src/app/core/i18n/en.ts wherever
 * an equivalent exists, so the two apps stay in step. Keys marked "android" have
 * no desktop counterpart -- their German is authored here, not ported.
 */
export const en = {
  'brand.name': 'Glacier Notes',

  'header.searchPlaceholder': 'Search notes…',

  'sidebar.notes': 'Notes',
  'sidebar.allNotes': 'All notes',
  'sidebar.notebooks': 'Notebooks',
  'sidebar.allNotebooks': 'All notebooks',
  'sidebar.newNotebook': 'New notebook',
  'sidebar.labels': 'Labels',
  'sidebar.allLabels': 'All labels',
  'sidebar.newLabel': 'New label',
  'sidebar.archive': 'Archive',
  'sidebar.trash': 'Trash',
  'sidebar.importExport': 'Import / Export',
  'sidebar.settings': 'Settings',
  'sidebar.search': 'Search',

  'grid.noNotes': 'No notes yet',
  'grid.noNotesHint': 'Create a note to get started.',
  'grid.nothingArchivedHint': 'Archived notes appear here.',
  'grid.trashEmptyHint': 'Deleted notes appear here.',

  // android: placeholder copy for destinations the desktop reaches differently.
  'placeholder.notebooks': 'Notebooks organise your notes.',
  'placeholder.labels': 'Labels let you tag notes across notebooks.',
  'placeholder.search': 'Full-text search over titles, bodies and checklists.',
  'placeholder.importExport': 'Exchange .glacier.json archives with Glacier Notes on the desktop.',

  'settings.title': 'Settings',
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.themeDark': 'Dark',
  'settings.themeLight': 'Light',
  'settings.themeSystem': 'System',
  'settings.language': 'Language',
  'settings.dateSample': 'Dates look like: {date}',
  'settings.localOnly':
    'These settings are stored on this device only. They are not part of a .glacier.json export.',

  // android: the desktop is pointer-driven and has no equivalent labels.
  'a11y.openMenu': 'Open navigation menu',
  'a11y.searchNotes': 'Search notes',
  'a11y.newNote': 'New note',
  'a11y.themeMode': 'Theme mode',
  'a11y.language': 'Language',
} as const;

export type TranslationKey = keyof typeof en;
