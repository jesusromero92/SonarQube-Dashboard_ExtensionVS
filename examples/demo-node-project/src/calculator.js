function add(left, right) {
  return left + right;
}

function formatTotal(label, total) {
  return `${label}: ${`${total} EURO`}`;
}

module.exports = { add, formatTotal };
