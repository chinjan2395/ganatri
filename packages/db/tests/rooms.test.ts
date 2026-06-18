import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, seedUser, uuid, type TestDb } from './helpers/pglite';

describe('rooms (pg)', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.close();
  });

  it('recordRoomCreated round-trips', async () => {
    const host = await seedUser(t, 'Host');
    const room = await t.repo.recordRoomCreated({
      roomCode: 'ABC123',
      hostUserId: host,
      configSnapshot: { turnTimeoutMs: 30000 },
    });
    expect(room.roomCode).toBe('ABC123');
    expect(room.status).toBe('LOBBY');
    expect(room.hostUserId).toBe(host);
    expect(room.configSnapshot).toEqual({ turnTimeoutMs: 30000 });
    expect(room.closedAt).toBeNull();
  });

  it('enforces unique room_code', async () => {
    const host = await seedUser(t);
    await t.repo.recordRoomCreated({ roomCode: 'DUP123', hostUserId: host });
    await expect(
      t.repo.recordRoomCreated({ roomCode: 'DUP123', hostUserId: host })
    ).rejects.toThrow();
  });

  it('enforces FK on host_user_id', async () => {
    await expect(
      t.repo.recordRoomCreated({ roomCode: 'NOHOST', hostUserId: uuid() })
    ).rejects.toThrow();
  });

  it('updateRoomStatus updates status and closed_at', async () => {
    const host = await seedUser(t);
    const room = await t.repo.recordRoomCreated({ roomCode: 'CLOSE1', hostUserId: host });
    const closedAt = new Date();
    const updated = await t.repo.updateRoomStatus(room.id, 'DONE', closedAt);
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('DONE');
    expect(updated!.closedAt).toBeInstanceOf(Date);
  });

  it('updateRoomStatus returns null for unknown room', async () => {
    const res = await t.repo.updateRoomStatus(uuid(), 'DONE');
    expect(res).toBeNull();
  });
});
