function add(left, right) {
  return left + right;
}

function formatTotal(label, total) {
  return `${label}: ${total} EUR`;
}

module.exports = { add, formatTotal };
