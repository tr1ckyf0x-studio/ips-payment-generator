/**
 * Remembering the payer must never be able to break the form.
 *
 * Safari in private mode and a browser with site data blocked both throw on
 * `localStorage`, so every path through the store is exercised against a storage that
 * refuses.
 */
import { describe, expect, it } from 'vitest';
import { createPayerStore } from '../src/storage/payerDetails.ts';

/** Minimal in-memory Storage. `failing` throws on every access, like a blocked browser. */
function fakeStorage({ failing = false } = {}): Storage {
  const map = new Map<string, string>();
  const guard = () => {
    if (failing) throw new DOMException('storage is disabled', 'SecurityError');
  };
  return {
    get length() {
      return map.size;
    },
    clear: () => {
      guard();
      map.clear();
    },
    getItem: (key) => {
      guard();
      return map.get(key) ?? null;
    },
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      guard();
      map.delete(key);
    },
    setItem: (key, value) => {
      guard();
      map.set(key, value);
    },
  };
}

describe('payer details store', () => {
  it('returns nothing before anything is saved', () => {
    expect(createPayerStore(fakeStorage()).load()).toBe('');
  });

  it('round-trips the payer', () => {
    const store = createPayerStore(fakeStorage());
    store.save('PETAR PETROVIĆ\nKNEZ MIHAILOVA 1, BEOGRAD');
    expect(store.load()).toBe('PETAR PETROVIĆ\nKNEZ MIHAILOVA 1, BEOGRAD');
  });

  it('survives a reload, since the value lives in the storage', () => {
    const storage = fakeStorage();
    createPayerStore(storage).save('PETAR PETROVIĆ');
    // A fresh store over the same storage is what a page reload amounts to.
    expect(createPayerStore(storage).load()).toBe('PETAR PETROVIĆ');
  });

  it.each(['', '   ', '\n'])('forgets rather than storing blank value %j', (blank) => {
    const store = createPayerStore(fakeStorage());
    store.save('PETAR PETROVIĆ');
    store.save(blank);
    expect(store.load()).toBe('');
  });

  it('forgets on request', () => {
    const store = createPayerStore(fakeStorage());
    store.save('PETAR PETROVIĆ');
    store.clear();
    expect(store.load()).toBe('');
  });

  it('keeps working when the browser refuses storage', () => {
    const store = createPayerStore(fakeStorage({ failing: true }));
    expect(() => store.save('PETAR PETROVIĆ')).not.toThrow();
    expect(() => store.clear()).not.toThrow();
    expect(store.load()).toBe('');
  });

  it('keeps working when there is no storage at all', () => {
    const store = createPayerStore(undefined);
    expect(() => store.save('PETAR PETROVIĆ')).not.toThrow();
    expect(store.load()).toBe('');
  });

  it('stores only the payer, under one key', () => {
    const storage = fakeStorage();
    createPayerStore(storage).save('PETAR PETROVIĆ');
    expect(storage.length).toBe(1);
  });
});
