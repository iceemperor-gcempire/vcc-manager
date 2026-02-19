import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p', 'br', 'a', 'strong', 'em', 'b', 'i', 'u',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'code', 'pre', 'span', 'div', 'hr'];

const ALLOWED_ATTR = ['href', 'target', 'rel'];

export function sanitizeHtml(dirty) {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
