import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { newId } from '../models/entity-id';
import { createTestRepositories, type TestRepositories } from '../repositories/testing';
import { validateEnvelope } from './envelope-validation';
import { ExportService } from './export.service';

/**
 * Over the real SQLite engine and the real repositories, for the reason
 * `createTestRepositories` gives: what is worth asserting here is what the
 * database actually hands back, including the trash and the derived columns it
 * must not leak.
 */
describe('ExportService', () => {
  let repos: TestRepositories;
  let exporter: ExportService;

  beforeEach(async () => {
    repos = await createTestRepositories();
    exporter = TestBed.inject(ExportService);
  });

  afterEach(async () => {
    await repos.adapter.close();
  });

  function create(title: string, content = '') {
    return repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'text',
      title,
      content,
    });
  }

  /** One image, stored the way an attach leaves it: metadata row plus bytes. */
  async function storeImage(base64 = 'AAAA'): Promise<string> {
    const id = newId();
    await repos.images.insert({ id, mimeType: 'image/png', fileName: 'shot.png' });
    await repos.files.write(id, base64, 'image/png');
    return id;
  }

  function onlyWrittenFile(): [string, string] {
    expect(repos.exports.files.size).toBe(1);
    const [entry] = [...repos.exports.files.entries()];
    return entry as [string, string];
  }

  it('writes one dated file and reports its counts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 6, 19, 12));
    try {
      await create('One');
      await repos.labels.create('Urgent');

      const result = await exporter.exportAll('save');

      expect(result).toMatchObject({
        status: 'saved',
        fileName: 'glacier-export-2026-07-19.glacier.json',
        counts: { notebooks: 1, notes: 1, labels: 1, images: 0 },
      });
      expect(onlyWrittenFile()[0]).toBe('glacier-export-2026-07-19.glacier.json');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports the UTF-8 byte length rather than the string length', async () => {
    await create('Straße');

    const result = await exporter.exportAll('save');

    expect(result.status).toBe('saved');
    if (result.status !== 'saved') return;
    const [, json] = onlyWrittenFile();
    expect(result.byteLength).toBe(new TextEncoder().encode(json).length);
    expect(result.byteLength).toBeGreaterThan(json.length);
  });

  it('produces a file that validates as an envelope', async () => {
    await create('One', 'Body');

    await exporter.exportAll('save');

    const validation = validateEnvelope(JSON.parse(onlyWrittenFile()[1]));
    expect(validation.ok).toBe(true);
  });

  it('exports trashed and archived notes alongside the active ones', async () => {
    const active = await create('active');
    const archived = await create('archived');
    const trashed = await create('trashed');
    await repos.notes.setArchived(archived.id, true);
    await repos.notes.trash(trashed.id);

    const result = await exporter.exportAll('save');

    expect(result).toMatchObject({ status: 'saved', counts: { notes: 3 } });
    const envelope = JSON.parse(onlyWrittenFile()[1]) as {
      notes: { id: string; deletedAt?: string; archived: boolean }[];
    };
    expect(new Set(envelope.notes.map((note) => note.id))).toEqual(
      new Set([active.id, archived.id, trashed.id]),
    );
    expect(envelope.notes.find((note) => note.id === trashed.id)?.deletedAt).toBeTypeOf('string');
    expect(envelope.notes.find((note) => note.id === archived.id)?.archived).toBe(true);
  });

  it('carries the image bytes of an image referenced only from the body', async () => {
    const imageId = await storeImage('AQIDBA==');
    await create('With image', `![x](glacier-img://${imageId})`);

    const result = await exporter.exportAll('save');

    expect(result).toMatchObject({ status: 'saved', counts: { images: 1 } });
    const envelope = JSON.parse(onlyWrittenFile()[1]) as {
      images: { id: string; mimeType: string; fileName?: string; base64: string }[];
    };
    expect(envelope.images).toEqual([
      { id: imageId, mimeType: 'image/png', fileName: 'shot.png', base64: 'AQIDBA==' },
    ]);
  });

  it('does not export an image no note references', async () => {
    await storeImage();
    await create('No image');

    const result = await exporter.exportAll('save');

    expect(result).toMatchObject({ status: 'saved', counts: { images: 0 } });
  });

  /**
   * The deliberate deviation from the desktop, which drops the unreadable image
   * and writes anyway — producing a file with a dangling reference that its own
   * import then rejects. `envelope-validation.spec.ts` proves that rejection.
   */
  it('refuses to write anything when an image file is gone', async () => {
    const imageId = await storeImage();
    await create('With image', `![x](glacier-img://${imageId})`);
    await repos.files.delete(imageId);

    const result = await exporter.exportAll('save');

    expect(result).toEqual({ status: 'missing-images', imageCount: 1 });
    expect(repos.exports.files.size).toBe(0);
  });

  it('refuses to write when the metadata row is gone but the file remains', async () => {
    const imageId = await storeImage();
    const note = await create('With image', `![x](glacier-img://${imageId})`);
    await repos.notes.purge(note.id);
    await repos.images.delete(imageId);
    await create('Still referencing', `![x](glacier-img://${imageId})`);

    const result = await exporter.exportAll('save');

    expect(result).toEqual({ status: 'missing-images', imageCount: 1 });
    expect(repos.exports.files.size).toBe(0);
  });

  it('passes the destination through and reports it back', async () => {
    await create('One');

    const result = await exporter.exportAll('share');

    expect(result).toMatchObject({ status: 'saved', destination: 'share' });
    expect(repos.exports.destinations.get(onlyWrittenFile()[0])).toBe('share');
  });

  /**
   * A dismissed save dialog is not a failure, and must not leave a "saved
   * <file>" line on screen for a file that was never written.
   */
  it('reports a dismissed destination as cancelled', async () => {
    await create('One');
    vi.spyOn(repos.exports, 'write').mockResolvedValueOnce('cancelled');

    const result = await exporter.exportAll('save');

    expect(result).toEqual({ status: 'cancelled' });
  });

  it('reports a storage failure without writing a partial file', async () => {
    await create('One');
    vi.spyOn(repos.exports, 'write').mockRejectedValueOnce(new Error('ENOSPC /data/user/0'));

    const result = await exporter.exportAll('save');

    expect(result).toEqual({ status: 'failed' });
    expect(repos.exports.files.size).toBe(0);
  });

  it('leaks neither the derived search column nor any device path', async () => {
    const imageId = await storeImage();
    await create('Findable', `body ![x](glacier-img://${imageId})`);
    await repos.notes.create({
      notebookId: repos.defaultNotebookId,
      type: 'checklist',
      title: 'List',
      checklist: [{ id: newId(), text: 'milk', checked: false, sortOrder: 0 }],
    });

    await exporter.exportAll('save');
    const [, json] = onlyWrittenFile();

    expect(json).not.toContain('search_text');
    expect(json).not.toContain('searchText');
    expect(json).not.toContain('/data/');
    expect(json).not.toContain('file://');
  });

  it("writes the desktop's two-space indentation", async () => {
    await create('One');

    await exporter.exportAll('save');
    const [, json] = onlyWrittenFile();

    expect(json).toContain('\n  "format": "glacier-notes-export"');
    expect(json).toBe(JSON.stringify(JSON.parse(json), null, 2));
  });
});
