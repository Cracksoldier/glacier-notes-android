import { newId } from '../../core/models/entity-id';
import type { ChecklistItem } from '../../core/models/checklist-item';

/**
 * Ported from the desktop's `src/app/features/notes/checklist-model.ts`.
 *
 * Every decision the checklist UI makes lives here rather than in the component,
 * for the reason `docs/notebooks.md` gives: logic inside a template or an Ionic
 * callback cannot be tested under jsdom.
 *
 * Two orderings exist and must not be confused. `sortOrder` is canonical and is
 * what `checklist_items.sort_order` stores; `displayOrder` is a view over it.
 * See `docs/checklists.md`.
 */

export function newItem(text: string, sortOrder: number): ChecklistItem {
  return { id: newId(), text, checked: false, sortOrder };
}

function bySortOrder(a: ChecklistItem, b: ChecklistItem): number {
  return a.sortOrder - b.sortOrder;
}

function canonical(items: readonly ChecklistItem[]): ChecklistItem[] {
  return [...items].sort(bySortOrder);
}

/**
 * Display only — the returned grouping is never written back on its own. A
 * checked item keeps its `sortOrder`, so unchecking it returns it to where it
 * was rather than to the end.
 */
export function displayOrder(
  items: readonly ChecklistItem[],
  moveCheckedToBottom: boolean,
): ChecklistItem[] {
  const sorted = canonical(items);
  if (!moveCheckedToBottom) {
    return sorted;
  }
  return [...sorted.filter((item) => !item.checked), ...sorted.filter((item) => item.checked)];
}

/** Array position is the source of truth; `note-writes.ts` re-derives it the same way. */
export function resequence(items: readonly ChecklistItem[]): ChecklistItem[] {
  return items.map((item, index) => ({ ...item, sortOrder: index }));
}

/**
 * Both of these take an *item id* rather than a display index, and rebuild from
 * the canonical order. Splicing the displayed array and resequencing it — which
 * is what they used to do — writes the completed-item grouping back into
 * `sortOrder`, so adding or deleting an unrelated row silently stranded every
 * ticked item at the bottom for good. Only a drag may commit that grouping.
 */
export function insertItemAfter(
  items: readonly ChecklistItem[],
  anchorId: string,
  item: ChecklistItem,
): ChecklistItem[] {
  const order = canonical(items);
  order.splice(order.findIndex((entry) => entry.id === anchorId) + 1, 0, item);
  return resequence(order);
}

export function removeItem(items: readonly ChecklistItem[], id: string): ChecklistItem[] {
  return resequence(canonical(items).filter((entry) => entry.id !== id));
}

/**
 * `from`/`to` index the *displayed* list, so with `moveCheckedToBottom` on a
 * drag commits the grouped order to `sortOrder`. That is the desktop's
 * behaviour and the one place the two orderings merge — a deliberate user
 * action, never a side effect of ticking a box.
 */
export function reorderItems(
  items: readonly ChecklistItem[],
  from: number,
  to: number,
  moveCheckedToBottom: boolean,
): ChecklistItem[] {
  const display = displayOrder(items, moveCheckedToBottom);
  const [moved] = display.splice(from, 1);
  if (!moved) {
    return resequence(display);
  }
  display.splice(to, 0, moved);
  return resequence(display);
}

/**
 * Parses Markdown task lists, plain bullets and ordered lists alike, so a text
 * note written by either app converts sensibly. Blank lines are dropped.
 */
export function textToChecklist(content: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const rawLine of content.split('\n')) {
    let line = rawLine.trim().replace(/^(?:[-*+]|\d+\.)\s+/, '');
    let checked = false;
    const task = /^\[( |x|X)\]\s*(.*)$/.exec(line);
    if (task) {
      checked = task[1]?.toLowerCase() === 'x';
      line = task[2] ?? '';
    }
    if (!line) {
      continue;
    }
    items.push({ id: newId(), text: line, checked, sortOrder: items.length });
  }
  return items;
}

/** The inverse, in canonical order — the grouped display is not what gets written. */
export function checklistToText(items: readonly ChecklistItem[]): string {
  return canonical(items)
    .map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`)
    .join('\n');
}
