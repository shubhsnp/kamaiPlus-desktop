/**
 * In-app replacements for the browser's alert() / confirm().
 *
 * Browser popups look foreign in a desktop POS, freeze the whole window and show
 * the app's internal address as their title. These open a styled dialog rendered
 * by <DialogHost> (root layout) and return a promise, so callers read naturally:
 *
 *   showAlert('Invoice must have at least 1 item.');
 *   if (!(await showConfirm('Delete this entry?', { danger: true }))) return;
 *
 * Works from any module (no React context needed). Dialogs queue: one at a time.
 */

export interface DialogOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, for deletes and other irreversible actions. */
  danger?: boolean;
}

export interface DialogRequest extends DialogOptions {
  id: number;
  kind: 'alert' | 'confirm';
  message: string;
  resolve: (ok: boolean) => void;
}

type Listener = (queue: DialogRequest[]) => void;

let queue: DialogRequest[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(queue));
}

function open(kind: DialogRequest['kind'], message: string, opts: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    // No host mounted (e.g. a unit test): answer immediately instead of hanging.
    if (listeners.size === 0) return resolve(kind === 'alert');
    queue = [...queue, { ...opts, id: nextId++, kind, message: String(message ?? ''), resolve }];
    emit();
  });
}

export function showAlert(message: string, opts: DialogOptions = {}): Promise<void> {
  return open('alert', message, opts).then(() => undefined);
}

export function showConfirm(message: string, opts: DialogOptions = {}): Promise<boolean> {
  return open('confirm', message, opts);
}

/** Called by <DialogHost> when the user answers the dialog on top. */
export function answerDialog(id: number, ok: boolean): void {
  const req = queue.find((q) => q.id === id);
  if (!req) return;
  queue = queue.filter((q) => q.id !== id);
  emit();
  req.resolve(ok);
}

export function subscribeDialogs(listener: Listener): () => void {
  listeners.add(listener);
  listener(queue);
  return () => {
    listeners.delete(listener);
  };
}
