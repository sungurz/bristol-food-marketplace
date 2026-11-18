import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, open, readFile, rm } from 'node:fs/promises';
import { join, parse, resolve } from 'node:path';


export function createFileStore({ directory } = {}) {
  if (typeof directory !== 'string' || !directory.trim()) {
    throw new TypeError('Provide an order-data directory.');
  }
  const root = resolve(directory);
  if (root === parse(root).root) {
    throw new Error('The order-data directory must not be the filesystem root.');
  }

  const fileFor = (key) => {
    if (typeof key !== 'string' || !key.trim()) {
      throw new TypeError('An order-store key must be a non-empty string.');
    }
    // Hashing keeps checkout/order IDs out of filenames and prevents path traversal.
    return join(root, `${createHash('sha256').update(key).digest('hex')}.json`);
  };

  const get = async (key) => {
    const path = fileFor(key);
    let content;
    try {
      content = await readFile(path, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') return undefined;
      throw error;
    }

    let record;
    try {
      record = JSON.parse(content);
    } catch {
      throw new Error('A saved order record is unreadable; do not overwrite it.');
    }
    if (record === null || typeof record !== 'object' || Array.isArray(record)
        || record.key !== key || !Object.hasOwn(record, 'value')) {
      throw new Error('A saved order record is invalid; do not overwrite it.');
    }
    return record.value;
  };

  const setIfAbsent = async (key, value) => {
    const path = fileFor(key);
    const json = JSON.stringify({ key, value });
    if (value === undefined || json === undefined) {
      throw new TypeError('Order-store values must be JSON-serializable.');
    }
    await mkdir(root, { recursive: true, mode: 0o700 });

    // Write a complete temporary record first. A hard link then creates the
    // final name atomically; another process cannot overwrite the winner.
    const temporary = join(root, `.pending-${randomUUID()}`);
    try {
      const handle = await open(temporary, 'wx', 0o600);
      try {
        await handle.writeFile(json, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        await link(temporary, path);
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
      }
      return await get(key);
    } finally {
      await rm(temporary, { force: true });
    }
  };

  return { get, setIfAbsent };
}
