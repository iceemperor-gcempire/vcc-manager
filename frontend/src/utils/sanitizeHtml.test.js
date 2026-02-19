import { sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml', () => {
  it('returns empty string for falsy input', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml('')).toBe('');
  });

  it('preserves allowed formatting tags', () => {
    const html = '<p>Hello <strong>bold</strong> and <em>italic</em></p>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('preserves links with href, target, rel', () => {
    const html = '<a href="https://example.com" target="_blank" rel="noopener">Link</a>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('strips script tags', () => {
    const html = '<p>Hello</p><script>alert("xss")</script>';
    expect(sanitizeHtml(html)).toBe('<p>Hello</p>');
  });

  it('strips iframe tags', () => {
    const html = '<p>Content</p><iframe src="https://evil.com"></iframe>';
    expect(sanitizeHtml(html)).toBe('<p>Content</p>');
  });

  it('strips img tags (prevents onerror XSS)', () => {
    const html = '<img src="x" onerror="alert(1)">';
    expect(sanitizeHtml(html)).toBe('');
  });

  it('strips event handler attributes', () => {
    const html = '<div onclick="alert(1)">Click</div>';
    expect(sanitizeHtml(html)).toBe('<div>Click</div>');
  });

  it('strips style tags', () => {
    const html = '<style>body{display:none}</style><p>Text</p>';
    expect(sanitizeHtml(html)).toBe('<p>Text</p>');
  });

  it('strips data attributes', () => {
    const html = '<span data-payload="malicious">Text</span>';
    expect(sanitizeHtml(html)).toBe('<span>Text</span>');
  });

  it('strips disallowed attributes on links', () => {
    const html = '<a href="https://example.com" onclick="alert(1)">Link</a>';
    expect(sanitizeHtml(html)).toBe('<a href="https://example.com">Link</a>');
  });

  it('preserves list markup', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('preserves code blocks', () => {
    const html = '<pre><code>const x = 1;</code></pre>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('strips javascript: protocol in href', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">Click</a>');
    expect(result).not.toContain('javascript:');
  });
});
