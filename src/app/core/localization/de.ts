import type { TranslationKey } from './en';

/** Typed against TranslationKey so a missing key fails the build. */
export const de: Record<TranslationKey, string> = {
  'brand.name': 'Glacier Notes',

  'header.searchPlaceholder': 'Notizen durchsuchen…',

  'sidebar.notes': 'Notizen',
  'sidebar.allNotes': 'Alle Notizen',
  'sidebar.notebooks': 'Notizbücher',
  'sidebar.allNotebooks': 'Alle Notizbücher',
  'sidebar.newNotebook': 'Neues Notizbuch',
  'sidebar.labels': 'Labels',
  'sidebar.allLabels': 'Alle Labels',
  'sidebar.newLabel': 'Neues Label',
  'sidebar.archive': 'Archiv',
  'sidebar.trash': 'Papierkorb',
  'sidebar.importExport': 'Import / Export',
  'sidebar.settings': 'Einstellungen',
  'sidebar.search': 'Suche',

  'grid.noNotes': 'Noch keine Notizen',
  'grid.noNotesHint': 'Erstelle eine Notiz, um loszulegen.',
  'grid.nothingArchivedHint': 'Archivierte Notizen erscheinen hier.',
  'grid.trashEmptyHint': 'Gelöschte Notizen erscheinen hier.',
  'grid.pinned': 'Angeheftet',
  'grid.others': 'Weitere',

  'card.emptyNote': 'Leere Notiz',

  'editor.titlePlaceholder': 'Titel',
  'editor.contentPlaceholder': 'Notiz schreiben…',
  'editor.edit': 'Bearbeiten',
  'editor.preview': 'Vorschau',
  'editor.notFound': 'Diese Notiz existiert nicht mehr',
  'editor.notFoundHint': 'Sie wurde vielleicht an anderer Stelle gelöscht.',
  'editor.saveFailed': 'Speichern fehlgeschlagen. Dein Text ist noch da — versuche es erneut.',

  'mdToolbar.bold': 'Fett',
  'mdToolbar.italic': 'Kursiv',
  'mdToolbar.h1': 'Überschrift 1',
  'mdToolbar.h2': 'Überschrift 2',
  'mdToolbar.ul': 'Aufzählung',
  'mdToolbar.ol': 'Nummerierte Liste',
  'mdToolbar.quote': 'Zitat',
  'mdToolbar.link': 'Link',
  'mdToolbar.code': 'Code',

  'common.back': 'Zurück',

  'placeholder.notebooks': 'Notizbücher ordnen deine Notizen.',
  'placeholder.labels': 'Mit Labels kannst du Notizen notizbuchübergreifend kennzeichnen.',
  'placeholder.search': 'Volltextsuche über Titel, Inhalte und Checklisten.',
  'placeholder.importExport':
    'Tausche .glacier.json-Archive mit Glacier Notes auf dem Desktop aus.',

  'settings.title': 'Einstellungen',
  'settings.appearance': 'Darstellung',
  'settings.theme': 'Design',
  'settings.themeDark': 'Dunkel',
  'settings.themeLight': 'Hell',
  'settings.themeSystem': 'System',
  'settings.language': 'Sprache',
  'settings.dateSample': 'Datumsangaben sehen so aus: {date}',
  'settings.localOnly':
    'Diese Einstellungen werden nur auf diesem Gerät gespeichert. Sie sind nicht Teil eines .glacier.json-Exports.',

  'a11y.openMenu': 'Navigationsmenü öffnen',
  'a11y.searchNotes': 'Notizen durchsuchen',
  'a11y.newNote': 'Neue Notiz',
  'a11y.themeMode': 'Designmodus',
  'a11y.language': 'Sprache',
  'a11y.noteLayout': 'Notizlayout',
  'a11y.formatting': 'Formatierung',
};
