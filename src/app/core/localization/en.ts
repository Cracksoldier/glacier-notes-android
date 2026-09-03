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
  'grid.noMatches': 'No matches',
  'grid.noMatchesHint': 'Try a different search term.',

  // android: the desktop has no load-failure state at all — it renders an empty
  // list and says nothing. On a phone the database is the only copy, so a
  // failure must not look like "you have no notes".
  'error.loadTitle': 'Could not load',
  'error.loadNotes': 'Your notes are still on this device. Nothing has been deleted.',
  'error.loadNotebooks': 'Your notebooks are still on this device. Nothing has been deleted.',
  'error.retry': 'Try again',

  'card.emptyNote': 'Empty note',
  'card.more': '+{count} more',
  'card.archived': 'Archived',

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
  'note.share': 'Share',
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
  'mdToolbar.image': 'Image',

  // android: the desktop shows images in a resizable window and never has to
  // explain a picker, a size limit or a failed write to app-private storage.
  'image.viewer': 'Image',
  'image.remove': 'Remove image',
  'image.removeTitle': 'Remove this image?',
  'image.removeHint': 'It is taken out of the note and deleted from this device.',
  'image.unsupportedType': 'That file type is not supported. Pick a PNG, JPEG, WebP or GIF.',
  'image.tooLarge': 'That image is larger than 10 MB.',
  'image.attachFailed': 'Could not add the image. There may be no space left on the device.',

  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.rename': 'Rename',
  'common.done': 'Done',

  // Desktop searches from a field in its header, over one scope toggle. A phone
  // has no room for either beside the note list, so search is a page and the
  // scope is a chip row on it; these strings are this app's own.
  'search.placeholder': 'Search notes…',
  'search.scopeAll': 'All',
  'search.scopeNotebook': 'This notebook',
  'search.scopeLabel': 'This label',
  'search.scopeArchive': 'Archive',
  'search.scopeTrash': 'Trash',
  'search.prompt': 'Search your notes',
  'search.promptHint': 'Titles, note text and checklist items.',

  // android: the desktop reaches export through a save dialog. Here there are
  // two destinations — the system's create-document screen and the share sheet —
  // so the "where did it go" line depends on which button was pressed.
  'importExport.exportHeading': 'Export',
  'importExport.exportHint':
    'Writes a .glacier.json archive of every note, notebook, label and image. Glacier Notes on the desktop can import it.',
  'importExport.exportSave': 'Save to a file…',
  'importExport.exportShare': 'Share…',
  'importExport.exporting': 'Exporting…',
  'importExport.exportDone': 'Saved {fileName} ({size}).',
  'importExport.exportShared': 'Shared {fileName} ({size}).',
  'importExport.exportCounts':
    '{notebooks} notebooks · {notes} notes · {labels} labels · {images} images',
  'importExport.exportSavedWhere': 'Saved where you chose. It is not stored inside the app.',
  'importExport.exportSharedWhere':
    'Handed to the app you picked. Nothing is kept here once you share again or restart.',
  'importExport.errorMissingImages':
    'Nothing was exported: {count} attached images are missing from this device. The desktop app would refuse a file with images it cannot find.',
  'importExport.errorInvalid': 'Nothing was exported: the archive failed an internal check.',
  'importExport.errorWrite': 'Could not write the export. Free up some space and try again.',

  // The strategy labels, hints, conflict message and `moreErrors` are the
  // desktop's `transfer.*` copy verbatim, so both apps describe the same choice
  // in the same words. The rest is authored here to match that register.
  'importExport.importHeading': 'Import',
  'importExport.importHint':
    'Reads a .glacier.json archive written by Glacier Notes. Nothing is changed until you confirm.',
  'importExport.importAction': 'Choose a file…',
  // A document provider need not report a display name, and the URI's last path
  // segment is an opaque document id rather than one.
  'importExport.importUnnamedFile': 'The chosen file',
  'importExport.importConfirm': 'Import',
  'importExport.importCancel': 'Cancel',
  'importExport.importing': 'Importing…',
  'importExport.importNoConflicts': 'Nothing in this file exists here yet. Everything is added.',
  'importExport.importConflicts':
    'Some entries already exist here. Choose how they should be handled.',
  'importExport.importAddCopies': 'Add as copies',
  'importExport.importAddCopiesHint': 'All imported items get new IDs. Nothing is overwritten.',
  'importExport.importReplaceById': 'Replace existing',
  'importExport.importReplaceByIdHint': 'Items with matching IDs are overwritten (backup restore).',
  'importExport.importDone':
    'Imported {notebooks} notebooks · {notes} notes · {labels} labels · {images} images.',
  'importExport.importErrorHeading': 'This file cannot be imported.',
  'importExport.importMoreErrors': '{count} further problems are not shown.',
  'importExport.importErrorRead': 'The file could not be read.',
  'importExport.importErrorTooLarge': 'That file is too large to read on this device.',
  'importExport.importErrorApply':
    'The import failed and nothing was changed. Your notes are as they were.',

  // android: no desktop equivalent. Replace is the only action in the app that
  // overwrites notes without leaving them in the trash, so it is confirmed.
  'importExport.replaceWarningTitle': 'Overwrite existing notes?',
  'importExport.replaceWarningHint':
    'Notes, notebooks and labels with matching IDs are replaced by the ones in this file. This cannot be undone.',

  // android: the desktop is a local app on a machine the user administers; a
  // phone is not, so the two things a backup file implies are stated outright.
  'importExport.disclosureHeading': 'Before you back up',
  'importExport.disclosureUnencrypted':
    'A .glacier.json file is not encrypted. Anyone who can open it can read every note. Keep it somewhere you trust.',
  'importExport.disclosureUninstall':
    'Everything is stored only on this device. Uninstalling the app deletes all notes and images with it.',

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

  // android: the desktop stores sortOrder but offers only `updatedDesc` and no
  // way to change it (docs/desktop-audit.md §6). The wording is this app's own.
  'settings.notes': 'Notes',
  'settings.sortOrder': 'Sort notes by',
  'settings.sortUpdatedDesc': 'Last edited',
  'settings.sortCreatedDesc': 'Date created',
  'settings.sortTitleAsc': 'Title',
  'settings.sortOrderHint': 'Pinned notes stay at the top. The trash is always newest first.',

  'settings.about': 'About',
  'settings.aboutApp': 'Glacier Notes for Android',
  'settings.aboutVersion': 'Version {version}',
  // The Font Awesome CC BY 4.0 licence requires the credit to be visible in the
  // app itself; docs/design-system.md is the record of the obligation.
  'settings.attributionIcons': 'Icons by Font Awesome Free, licensed CC BY 4.0.',

  // android: the desktop keeps trashAutoPurgeDays in its settings file with no
  // way to change it (docs/desktop-audit.md §6, §11.7).
  'settings.trash': 'Trash',
  'settings.trashAutoPurge': 'Delete trashed notes after',
  'settings.trashAutoPurgeNever': 'Never',
  'settings.trashAutoPurgeDays': '{count} days',
  'settings.trashAutoPurgeHint': 'Checked once each time the app starts.',

  'settings.backup': 'Backup',
  'settings.backupOpen': 'Import and export',
  'settings.backupHint': 'Write a .glacier.json archive, or read one back in.',

  // android: the desktop has no diagnostics surface. This is the one place the
  // engine's own message is shown, so that a database failure is nameable
  // rather than just an empty list on every page.
  'settings.diagnostics': 'Diagnostics',
  'settings.databaseFailed': 'The database could not be opened. Restarting the app may fix it.',

  // android: the desktop is pointer-driven and has no equivalent labels.
  'a11y.openMenu': 'Open navigation menu',
  'a11y.searchNotes': 'Search notes',
  'a11y.searchScope': 'Where to search',
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
  'a11y.noteImages': 'Images in this note',
  'a11y.trashAutoPurge': 'Delete trashed notes after',
  'a11y.emptyTrash': 'Empty trash',
  // A card is one button, which hides its own heading, preview and labels from
  // assistive technology. These restate what it hides.
  'a11y.notePinned': 'Pinned',
  'a11y.noteLabelList': 'Labels: {names}',
  // "Images: 1" rather than "{count} images", which has no singular here.
  'a11y.noteImageCount': 'Images: {count}',
  'a11y.checklistItem': 'Item {position}',
} as const;

export type TranslationKey = keyof typeof en;
