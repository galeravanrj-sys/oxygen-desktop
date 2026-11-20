export type SecureDriver = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};
type Manifest = { generation: string; count: number };
function manifest(raw: string | null): Manifest | null {
  try {
    const value = JSON.parse(raw || "null");
    return value &&
      typeof value.generation === "string" &&
      /^[\w-]+$/.test(value.generation) &&
      Number.isInteger(value.count) &&
      value.count > 0 &&
      value.count <= 128
      ? value
      : null;
  } catch {
    return null;
  }
}
export function secureChunks(value: string) {
  const chunks: string[] = [];
  let chunk = "",
    bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    const length = code <= 127 ? 1 : code <= 2047 ? 2 : code <= 65535 ? 3 : 4;
    if (bytes + length > 1500) {
      chunks.push(chunk);
      chunk = "";
      bytes = 0;
    }
    chunk += character;
    bytes += length;
  }
  chunks.push(chunk);
  if (chunks.length > 128)
    throw new Error("Session is too large for secure storage.");
  return chunks;
}
export function makeSessionStorage(driver: SecureDriver) {
  const prefix = (key: string) => "m8-auth-" + key.replace(/[^\w.-]/g, "_");
  return {
    async getItem(key: string) {
      const base = prefix(key),
        current = manifest(await driver.getItemAsync(base));
      if (!current) return null;
      const chunks = await Promise.all(
        Array.from({ length: current.count }, (_, i) =>
          driver.getItemAsync(`${base}.${current.generation}.${i}`),
        ),
      );
      return chunks.every((c) => c !== null) ? chunks.join("") : null;
    },
    async setItem(key: string, value: string) {
      const base = prefix(key),
        old = manifest(await driver.getItemAsync(base)),
        generation = Date.now() + "-" + Math.random().toString(36).slice(2, 12),
        chunks = secureChunks(value);
      const staged: string[] = [];
      try {
        for (let i = 0; i < chunks.length; i++) {
          const part = `${base}.${generation}.${i}`;
          await driver.setItemAsync(part, chunks[i]);
          staged.push(part);
        }
        await driver.setItemAsync(
          base,
          JSON.stringify({ generation, count: chunks.length }),
        );
      } catch (error) {
        await Promise.allSettled(
          staged.map((part) => driver.deleteItemAsync(part)),
        );
        throw error;
      }
      if (old)
        await Promise.allSettled(
          Array.from({ length: old.count }, (_, i) =>
            driver.deleteItemAsync(`${base}.${old.generation}.${i}`),
          ),
        );
    },
    async removeItem(key: string) {
      const base = prefix(key),
        old = manifest(await driver.getItemAsync(base));
      await driver.deleteItemAsync(base);
      if (old)
        await Promise.all(
          Array.from({ length: old.count }, (_, i) =>
            driver.deleteItemAsync(`${base}.${old.generation}.${i}`),
          ),
        );
    },
  };
}
