/**
 * Remembers the payer's own details between visits.
 *
 * Everything else on a slip changes from payment to payment; the payer's name and
 * address do not, and retyping them each time is the one piece of pure friction in the
 * form.
 *
 * The store takes its `Storage` rather than reaching for `localStorage` itself, which
 * is what lets it be tested without a browser. Every access is guarded: Safari's private
 * mode and a browser with site data blocked both throw on `localStorage`, and a form
 * that crashes there would be worse than one that simply forgets.
 */

const KEY = 'nalog-za-uplatu.payer';

export interface PayerStore {
  load(): string;
  save(value: string): void;
  clear(): void;
}

/** A store backed by nothing, for when the browser denies storage entirely. */
const NULL_STORE: PayerStore = {
  load: () => '',
  save: () => {},
  clear: () => {},
};

export function createPayerStore(storage: Storage | undefined): PayerStore {
  if (!storage) return NULL_STORE;

  return {
    load() {
      try {
        return storage.getItem(KEY) ?? '';
      } catch {
        return '';
      }
    },
    save(value: string) {
      try {
        // An empty value means "forget", rather than storing a blank entry.
        if (value.trim()) storage.setItem(KEY, value);
        else storage.removeItem(KEY);
      } catch {
        // Storage denied or full: the form still works, it just will not remember.
      }
    },
    clear() {
      try {
        storage.removeItem(KEY);
      } catch {
        // As above.
      }
    },
  };
}

/** The store the app uses, or a store that forgets when the browser denies access. */
export function browserPayerStore(): PayerStore {
  try {
    return createPayerStore(typeof localStorage === 'undefined' ? undefined : localStorage);
  } catch {
    return NULL_STORE;
  }
}
