export function errorHandler(err, req, res, _next) {
  console.error('[Error]', err.message);

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: '数据已存在' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: '关联数据不存在' });
  }
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  res.status(500).json({ error: '服务器内部错误' });
}
