/** Written as an escape because the character itself is invisible in a diff. */
const BOM = '\uFEFF';

/**
 * A UTF-8 BOM is legal in a file and illegal in JSON: `JSON.parse` throws on it,
 * and what V8 puts in that message is the offending character followed by the
 * user's own bytes.
 *
 * This exists because the two `DocumentGateway` implementations disagree without
 * it. `FileReader.readAsText` strips a BOM per the encoding standard, so the
 * browser never sees one; the native read hands back exactly the bytes the
 * document had, so on a device a file some desktop editor saved with a BOM would
 * be rejected as corrupt with nothing to show for it.
 */
export function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(BOM.length) : text;
}
