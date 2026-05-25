function getPagination(query = {}) {
  const pageNum = Math.max(Number(query.pageNum || 1), 1);
  const pageSize = Math.max(Number(query.pageSize || 10), 1);
  const offset = (pageNum - 1) * pageSize;

  return {
    pageNum,
    pageSize,
    offset
  };
}

function buildPageResult(list, total, pageNum, pageSize) {
  return {
    list,
    total,
    pageNum,
    pageSize
  };
}

module.exports = {
  getPagination,
  buildPageResult
};
