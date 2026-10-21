/** A localStorage stand-in for tests. `failWrites` simulates a full or blocked storage. */
export class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  failWrites = false
  failReads = false
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    if (this.failReads) throw new DOMException('The operation is insecure.', 'SecurityError')
    return this.map.get(key) ?? null
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    this.map.set(key, value)
  }
}
