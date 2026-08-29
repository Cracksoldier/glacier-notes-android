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
  'sidebar.notebookName': 'Notebook name',
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
  'grid.pinned': 'Pinned',
  'grid.others': 'Others',

  'card.emptyNote': 'Empty note',
  'card.more': '+{count} more',

  'notebook.deleteTitle': 'Delete notebook "{name}"?',
  'notebook.containsOne': 'This notebook contains 1 note.',
  'notebook.containsMany': 'This notebook contains {count} notes.',
  'notebook.deleteNotes': 'Delete the notes too',
  'notebook.moveTo': 'Move them to:',
  'notebook.empty': 'This notebook is empty.',
  // android: the desktop's sidebar edits notebooks inline and never validates,
  // because an empty inline edit simply reverts. A prompt has to say why.
  'notebook.nameRequired': 'Enter a name for the notebook.',
  'notebook.create': 'New notebook',
  'notebook.default': 'Default notebook',
  // android: the desktop offers no way to change which notebook is the default.
  'notebook.setDefault': 'Set as default',
  'notebook.defaultHint': 'New notes go here unless you create them inside a notebook.',
  'notebook.none': 'No notebooks yet',

  'move.heading': 'Move to',
  'move.empty': 'No other notebooks',

  'label.create': 'New label',
  'label.deleteTitle': 'Delete label "{name}"?',
  // The desktop's delete strips the label from every note and keeps the notes
  // (label-repo.ts). Saying so removes the obvious fear.
  'label.deleteHint': 'The notes keeping this label are not deleted.',
  // android: the desktop edits labels inline, where an empty edit just reverts.
  'label.nameRequired': 'Enter a name for the label.',
  'label.name': 'Label name',
  'label.none': 'No labels yet',
  'label.assign': 'Labels',
  'label.noneAvailable': 'No labels yet. Create one first.',
  'label.empty': 'No notes carry this label.',

  'note.actions': 'Note actions',
  'note.pin': 'Pin',
  'note.unpin': 'Unpin',
  'note.color': 'Color',
  'note.colorNone': 'No color',
  'note.labels': 'Labels',
  'note.archive': 'Archive',
  'note.unarchive': 'Restore from archive',
  'note.moveToTrash': 'Move to trash',
  'note.restore': 'Restore',
  'note.deleteForever': 'Delete forever',
  'note.deleteForeverTitle': 'Delete this note forever?',
  'note.deleteForeverHint': 'This cannot be undone.',

  'color.red': 'Red',
  'color.orange': 'Orange',
  'color.yellow': 'Yellow',
  'color.green': 'Green',
  'color.teal': 'Teal',
  'color.blue': 'Blue',
  'color.purple': 'Purple',
  'color.pink': 'Pink',

  'trash.emptyAction': 'Empty trash',
  'trash.emptyTitle': 'Empty the trash?',
  'trash.emptyHint': 'All {count} notes in the trash are deleted forever.',
  'trash.emptyHintOne': 'The note in the trash is deleted forever.',
  // android: the desktop purges silently at startup and never explains itself.
  'trash.autoPurgeNotice': 'Notes here are deleted automatically after {days} days.',

  'editor.titlePlaceholder': 'Title',
  'editor.contentPlaceholder': 'Take a note…',
  'editor.edit': 'Edit',
  'editor.preview': 'Preview',
  // android: the desktop dialog cannot be reached with a stale link.
  'editor.notFound': 'This note no longer exists',
  'editor.notFoundHint': 'It may have been deleted on another screen.',
  // android: the desktop writes to a file it has already opened; a phone can
  // run out of storage mid-edit, so the failure needs its own wording.
  'editor.saveFailed': 'Could not save. Your text is still here — try again.',
  'editor.convertToText': 'Convert to text note',
  'editor.convertToChecklist': 'Convert to checklist',

  'checklist.addItem': 'Add item',
  'checklist.itemPlaceholder': 'List item',
  'checklist.removeItem': 'Remove item',
  'checklist.dragToReorder': 'Drag to reorder',

  'mdToolbar.bold': 'Bold',
  'mdToolbar.italic': 'Italic',
  'mdToolbar.h1': 'Heading 1',
  'mdToolbar.h2': 'Heading 2',
  'mdToolbar.ul': 'Bulleted list',
  'mdToolbar.ol': 'Numbered list',
  // android: no desktop counterpart -- the desktop toolbar has no quote button.
  'mdToolbar.quote': 'Quote',
  'mdToolbar.link': 'Link',
  'mdToolbar.code': 'Code',

  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.rename': 'Rename',
  'common.done': 'Done',

  // android: placeholder copy for destinations the desktop reaches differently.
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
  'settings.checklists': 'Checklists',
  'settings.moveCheckedToBottom': 'Move completed items to the bottom',
  // android: the desktop toggle carries no explanation. On a phone the stored
  // order is not otherwise visible, so it has to say that this is display only.
  'settings.moveCheckedToBottomHint':
    'Changes how items are shown. Their saved order stays as it is.',

  // android: the desktop keeps trashAutoPurgeDays in its settings file with no
  // way to change it (docs/desktop-audit.md §6, §11.7).
  'settings.trash': 'Trash',
  'settings.trashAutoPurge': 'Delete trashed notes after',
  'settings.trashAutoPurgeNever': 'Never',
  'settings.trashAutoPurgeDays': '{count} days',
  'settings.trashAutoPurgeHint': 'Checked once each time the app starts.',

  // android: the desktop is pointer-driven and has no equivalent labels.
  'a11y.openMenu': 'Open navigation menu',
  'a11y.searchNotes': 'Search notes',
  'a11y.newNote': 'New note',
  'a11y.newChecklist': 'New checklist',
  'a11y.checklistItems': 'Checklist items',
  'a11y.convertNote': 'Change note type',
  'a11y.themeMode': 'Theme mode',
  'a11y.language': 'Language',
  'a11y.noteLayout': 'Note layout',
  'a11y.formatting': 'Formatting',
  'a11y.notebookActions': 'Notebook actions',
  'a11y.noteNotebook': 'Notebook of this note',
  'a11y.newNotebook': 'New notebook',
  'a11y.noteActions': 'Note actions',
  'a11y.labelActions': 'Label actions',
  'a11y.newLabel': 'New label',
  'a11y.noteLabels': 'Labels of this note',
  'a11y.trashAutoPurge': 'Delete trashed notes after',
  'a11y.emptyTrash': 'Empty trash',
} as const;

export type TranslationKey = keyof typeof en;
