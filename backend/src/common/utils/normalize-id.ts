export function normalizeId(id: string) {
  if (!id) return id;
  let s = id.trim();
  // Nếu bị kiểu "\"cmg95...\"" thì parse ra chuỗi thật
  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      s = JSON.parse(s);
    } catch {
      s = s.slice(1, -1);
    }
  }
  return s;
}
