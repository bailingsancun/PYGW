/**
 * 实现功能：v1 envelope 与字段命名工具
 * 职责：统一生成 {code, message, data} 响应体；提供 snake_case → camelCase 转换。
 *       命名规则见 HANDOFF §6，做错会导致前端整页「暂无数据」。
 * 接口/函数清单：
 *   - toCamel(key)：单个键名转换
 *   - rowToCamel(row)：单行转换
 *   - rowsToCamel(rows)：多行转换
 *   - ok(data)：成功 envelope
 *   - fail(message, code)：失败 envelope
 */
export const toCamel = (key = '') => String(key).replace(/_([a-z0-9])/g, (_, ch) => ch.toUpperCase());

export const rowToCamel = (row) => {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) out[toCamel(key)] = value;
  return out;
};

export const rowsToCamel = (rows) => (Array.isArray(rows) ? rows.map(rowToCamel) : []);

export const ok = (data) => ({ code: 200, message: 'ok', data });

export const fail = (message = '服务异常', code = 500) => ({ code, message: String(message), data: null });
