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
  'sidebar.notebookName': 'Name des Notizbuchs',
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
  'error.loadTitle': 'Laden fehlgeschlagen',
  'error.loadNotes': 'Deine Notizen sind weiterhin auf diesem Gerät. Es wurde nichts gelöscht.',
  'error.loadNotebooks':
    'Deine Notizbücher sind weiterhin auf diesem Gerät. Es wurde nichts gelöscht.',
  'error.retry': 'Erneut versuchen',

  'grid.pinned': 'Angeheftet',
  'grid.others': 'Weitere',
  'grid.noMatches': 'Keine Treffer',
  'grid.noMatchesHint': 'Versuche einen anderen Suchbegriff.',

  'card.emptyNote': 'Leere Notiz',
  'card.more': '+{count} weitere',
  'card.archived': 'Archiviert',

  'notebook.deleteTitle': 'Notizbuch "{name}" löschen?',
  'notebook.containsOne': 'Dieses Notizbuch enthält 1 Notiz.',
  'notebook.containsMany': 'Dieses Notizbuch enthält {count} Notizen.',
  'notebook.deleteNotes': 'Notizen ebenfalls löschen',
  'notebook.moveTo': 'Verschieben nach:',
  'notebook.empty': 'Dieses Notizbuch ist leer.',
  'notebook.nameRequired': 'Gib einen Namen für das Notizbuch ein.',
  'notebook.create': 'Neues Notizbuch',
  'notebook.default': 'Standard-Notizbuch',
  'notebook.setDefault': 'Als Standard festlegen',
  'notebook.defaultHint':
    'Neue Notizen landen hier, sofern du sie nicht in einem Notizbuch erstellst.',
  'notebook.none': 'Noch keine Notizbücher',

  'move.heading': 'Verschieben nach',
  'move.empty': 'Keine anderen Notizbücher',

  'label.create': 'Neues Label',
  'label.deleteTitle': 'Label "{name}" löschen?',
  'label.deleteHint': 'Die Notizen mit diesem Label werden nicht gelöscht.',
  'label.nameRequired': 'Gib einen Namen für das Label ein.',
  'label.name': 'Name des Labels',
  'label.none': 'Noch keine Labels',
  'label.assign': 'Labels',
  'label.noneAvailable': 'Noch keine Labels. Erstelle zuerst eines.',
  'label.empty': 'Keine Notiz trägt dieses Label.',

  'note.actions': 'Notizaktionen',
  'note.pin': 'Anheften',
  'note.unpin': 'Lösen',
  'note.color': 'Farbe',
  'note.colorNone': 'Keine Farbe',
  'note.labels': 'Labels',
  'note.archive': 'Archivieren',
  'note.unarchive': 'Aus dem Archiv holen',
  'note.moveToTrash': 'In den Papierkorb',
  'note.restore': 'Wiederherstellen',
  'note.deleteForever': 'Endgültig löschen',
  'note.deleteForeverTitle': 'Diese Notiz endgültig löschen?',
  'note.deleteForeverHint': 'Das lässt sich nicht rückgängig machen.',

  'color.red': 'Rot',
  'color.orange': 'Orange',
  'color.yellow': 'Gelb',
  'color.green': 'Grün',
  'color.teal': 'Petrol',
  'color.blue': 'Blau',
  'color.purple': 'Violett',
  'color.pink': 'Rosa',

  'trash.emptyAction': 'Papierkorb leeren',
  'trash.emptyTitle': 'Papierkorb leeren?',
  'trash.emptyHint': 'Alle {count} Notizen im Papierkorb werden endgültig gelöscht.',
  'trash.emptyHintOne': 'Die Notiz im Papierkorb wird endgültig gelöscht.',
  'trash.autoPurgeNotice': 'Notizen hier werden nach {days} Tagen automatisch gelöscht.',

  'editor.titlePlaceholder': 'Titel',
  'editor.contentPlaceholder': 'Notiz schreiben…',
  'editor.edit': 'Bearbeiten',
  'editor.preview': 'Vorschau',
  'editor.notFound': 'Diese Notiz existiert nicht mehr',
  'editor.notFoundHint': 'Sie wurde vielleicht an anderer Stelle gelöscht.',
  'editor.saveFailed': 'Speichern fehlgeschlagen. Dein Text ist noch da — versuche es erneut.',
  'editor.convertToText': 'In Textnotiz umwandeln',
  'editor.convertToChecklist': 'In Checkliste umwandeln',

  'checklist.addItem': 'Eintrag hinzufügen',
  'checklist.itemPlaceholder': 'Listeneintrag',
  'checklist.removeItem': 'Eintrag entfernen',
  'checklist.dragToReorder': 'Zum Sortieren ziehen',

  'mdToolbar.bold': 'Fett',
  'mdToolbar.italic': 'Kursiv',
  'mdToolbar.h1': 'Überschrift 1',
  'mdToolbar.h2': 'Überschrift 2',
  'mdToolbar.ul': 'Aufzählung',
  'mdToolbar.ol': 'Nummerierte Liste',
  'mdToolbar.quote': 'Zitat',
  'mdToolbar.link': 'Link',
  'mdToolbar.code': 'Code',
  'mdToolbar.image': 'Bild',

  'image.viewer': 'Bild',
  'image.remove': 'Bild entfernen',
  'image.removeTitle': 'Dieses Bild entfernen?',
  'image.removeHint': 'Es wird aus der Notiz genommen und von diesem Gerät gelöscht.',
  'image.unsupportedType':
    'Dieser Dateityp wird nicht unterstützt. Wähle PNG, JPEG, WebP oder GIF.',
  'image.tooLarge': 'Dieses Bild ist größer als 10 MB.',
  'image.attachFailed':
    'Bild konnte nicht hinzugefügt werden. Möglicherweise ist kein Speicher frei.',

  'common.back': 'Zurück',
  'common.cancel': 'Abbrechen',
  'common.delete': 'Löschen',
  'common.rename': 'Umbenennen',
  'common.done': 'Fertig',

  'search.placeholder': 'Notizen durchsuchen…',
  'search.scopeAll': 'Alle',
  'search.scopeNotebook': 'Dieses Notizbuch',
  'search.scopeLabel': 'Dieses Label',
  'search.scopeArchive': 'Archiv',
  'search.scopeTrash': 'Papierkorb',
  'search.prompt': 'Durchsuche deine Notizen',
  'search.promptHint': 'Titel, Notiztext und Checklisteneinträge.',

  'importExport.exportHeading': 'Export',
  'importExport.exportHint':
    'Schreibt ein .glacier.json-Archiv mit allen Notizen, Notizbüchern, Labels und Bildern. Glacier Notes auf dem Desktop kann es importieren.',
  'importExport.exportAction': 'Alle Notizen exportieren',
  'importExport.exporting': 'Wird exportiert…',
  'importExport.exportDone': '{fileName} gespeichert ({size}).',
  'importExport.exportCounts':
    '{notebooks} Notizbücher · {notes} Notizen · {labels} Labels · {images} Bilder',
  'importExport.exportLocation': 'Liegt im privaten Ordner dieser App auf dem Gerät.',
  'importExport.errorMissingImages':
    'Es wurde nichts exportiert: {count} angehängte Bilder fehlen auf diesem Gerät. Die Desktop-App würde eine Datei mit fehlenden Bildern ablehnen.',
  'importExport.errorInvalid':
    'Es wurde nichts exportiert: Das Archiv hat eine interne Prüfung nicht bestanden.',
  'importExport.errorWrite':
    'Der Export konnte nicht geschrieben werden. Gib Speicherplatz frei und versuche es erneut.',

  'importExport.importHeading': 'Import',
  'importExport.importHint':
    'Liest ein von Glacier Notes geschriebenes .glacier.json-Archiv. Es wird nichts geändert, bis du bestätigst.',
  'importExport.importAction': 'Datei auswählen…',
  'importExport.importConfirm': 'Importieren',
  'importExport.importCancel': 'Abbrechen',
  'importExport.importing': 'Wird importiert…',
  'importExport.importNoConflicts':
    'Nichts aus dieser Datei ist hier bereits vorhanden. Alles wird hinzugefügt.',
  'importExport.importConflicts':
    'Einige Einträge sind hier bereits vorhanden. Wähle, wie damit umgegangen werden soll.',
  'importExport.importAddCopies': 'Als Kopien hinzufügen',
  'importExport.importAddCopiesHint':
    'Alle importierten Einträge erhalten neue IDs. Nichts wird überschrieben.',
  'importExport.importReplaceById': 'Vorhandene ersetzen',
  'importExport.importReplaceByIdHint':
    'Einträge mit übereinstimmenden IDs werden überschrieben (Backup-Wiederherstellung).',
  'importExport.importDone':
    '{notebooks} Notizbücher · {notes} Notizen · {labels} Labels · {images} Bilder importiert.',
  'importExport.importErrorHeading': 'Diese Datei kann nicht importiert werden.',
  'importExport.importMoreErrors': '{count} weitere Probleme werden nicht angezeigt.',
  'importExport.importErrorRead': 'Die Datei konnte nicht gelesen werden.',
  'importExport.importErrorApply':
    'Der Import ist fehlgeschlagen, es wurde nichts geändert. Deine Notizen sind unverändert.',

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
  'settings.checklists': 'Checklisten',
  'settings.moveCheckedToBottom': 'Erledigte Einträge nach unten',
  'settings.moveCheckedToBottomHint':
    'Ändert nur die Anzeige. Die gespeicherte Reihenfolge bleibt unverändert.',

  'settings.notes': 'Notizen',
  'settings.sortOrder': 'Notizen sortieren nach',
  'settings.sortUpdatedDesc': 'Zuletzt bearbeitet',
  'settings.sortCreatedDesc': 'Erstellungsdatum',
  'settings.sortTitleAsc': 'Titel',
  'settings.sortOrderHint':
    'Angeheftete Notizen bleiben oben. Der Papierkorb ist immer nach Datum sortiert.',

  'settings.about': 'Über',
  'settings.aboutApp': 'Glacier Notes für Android',
  'settings.aboutVersion': 'Version {version}',
  'settings.attributionIcons': 'Symbole von Font Awesome Free, lizenziert unter CC BY 4.0.',

  'settings.trash': 'Papierkorb',
  'settings.trashAutoPurge': 'Notizen im Papierkorb löschen nach',
  'settings.trashAutoPurgeNever': 'Nie',
  'settings.trashAutoPurgeDays': '{count} Tagen',
  'settings.trashAutoPurgeHint': 'Wird bei jedem Start der App einmal geprüft.',

  'settings.diagnostics': 'Diagnose',
  'settings.databaseFailed':
    'Die Datenbank konnte nicht geöffnet werden. Ein Neustart der App hilft möglicherweise.',

  'a11y.openMenu': 'Navigationsmenü öffnen',
  'a11y.searchNotes': 'Notizen durchsuchen',
  'a11y.searchScope': 'Suchbereich',
  'a11y.newNote': 'Neue Notiz',
  'a11y.newChecklist': 'Neue Checkliste',
  'a11y.checklistItems': 'Checklisteneinträge',
  'a11y.convertNote': 'Notiztyp ändern',
  'a11y.themeMode': 'Designmodus',
  'a11y.language': 'Sprache',
  'a11y.noteLayout': 'Notizlayout',
  'a11y.formatting': 'Formatierung',
  'a11y.notebookActions': 'Aktionen für das Notizbuch',
  'a11y.noteNotebook': 'Notizbuch dieser Notiz',
  'a11y.newNotebook': 'Neues Notizbuch',
  'a11y.noteActions': 'Notizaktionen',
  'a11y.labelActions': 'Aktionen für das Label',
  'a11y.newLabel': 'Neues Label',
  'a11y.noteLabels': 'Labels dieser Notiz',
  'a11y.noteImages': 'Bilder in dieser Notiz',
  'a11y.trashAutoPurge': 'Notizen im Papierkorb löschen nach',
  'a11y.emptyTrash': 'Papierkorb leeren',
  'a11y.notePinned': 'Angeheftet',
  'a11y.noteLabelList': 'Labels: {names}',
  'a11y.noteImageCount': 'Bilder: {count}',
  'a11y.checklistItem': 'Eintrag {position}',
};
