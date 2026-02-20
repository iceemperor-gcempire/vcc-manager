/**
 * Escape special regex characters in user input for safe use in MongoDB $regex queries.
 * Prevents ReDoS by converting user input to a literal string pattern.
 *
 * @param {string} str - User input string
 * @returns {string} Escaped string safe for RegExp construction
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
