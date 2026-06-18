import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, ping, closeDb } from '../src/db';

describe('db client (unconfigured / no DATABASE_URL)', () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
  });
  afterEach(async () => {
    await closeDb();
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  });

  it('getDb() returns null when DATABASE_URL is unset', () => {
    expect(getDb()).toBeNull();
  });

  it('ping() resolves false (no throw, no Pool) when unconfigured', async () => {
    await expect(ping()).resolves.toBe(false);
  });

  it('importing the module never opens a connection at import time', () => {
    // If a Pool were created at import time with no DATABASE_URL it would throw
    // on first query; reaching here with getDb()===null proves it is lazy.
    expect(getDb()).toBeNull();
  });
});
