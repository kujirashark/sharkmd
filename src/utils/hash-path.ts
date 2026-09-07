// 注：函数名是 hashPath 不是 sha256；MVP 用 FNV-1a 64-bit 计算稳定 id，
// 不要求密码学强度，仅作路径去重 key。
export function hashPath(text: string): string {
  let h = BigInt('0xcbf29ce484222325');
  for (let i = 0; i < text.length; i++) {
    h = (h ^ BigInt(text.charCodeAt(i))) * BigInt('0x100000001b3');
    h &= BigInt('0xffffffffffffffff');
  }
  return h.toString(16).padStart(16, '0');
}
