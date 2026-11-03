/** 一些琐碎但处处要用的工具。 */

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/** 19 位雪花 ID 的展示形式：头 6 位 … 尾 4 位；空值返回 `--` */
export function shortId(id: string | null | undefined): string {
  if (!id) return "--";
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

/** 毫秒时间戳（后端是字符串）→ 本地时间文本；空值或非法值返回 `--` */
export function formatMs(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "--";
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return "--";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "--";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 只取日期部分 */
export function formatDate(value: string | number | null | undefined): string {
  const text = formatMs(value);
  return text === "--" ? text : text.slice(0, 10);
}

/** 布尔展示 */
export function boolText(value: boolean | null | undefined, on = "是", off = "否"): string {
  return value ? on : off;
}

export function copyText(text: string): Promise<boolean> {
  return navigator.clipboard
    .writeText(text)
    .then(() => true)
    .catch(() => false);
}

/** 简单防抖，用于搜索框 */
export function debounce<T extends (...args: never[]) => void>(fn: T, wait: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  }) as T;
}
