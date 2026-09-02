/**
 * The desktop's default save name (`electron/export-import.ts:64`), reproduced
 * exactly so a file exported here is indistinguishable from one exported there.
 *
 * `toISOString()` is UTC, so the date can be a day off from the device's local
 * date near midnight. That is the desktop's behaviour and the name is cosmetic —
 * `exportedAt` inside the envelope is the timestamp that means anything.
 */
export function exportFileName(at: Date = new Date()): string {
  return `glacier-export-${at.toISOString().slice(0, 10)}.glacier.json`;
}
