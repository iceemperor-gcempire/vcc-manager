// 브라우저 파일 다운로드 공용 유틸 (#697) — 뷰어/카드 5곳에 흩어져 있던
// createObjectURL + <a download> 클릭 패턴 통합. toast 등 UX 피드백은 호출부 책임.

// Blob 을 filename 으로 저장. objectURL 은 클릭 처리 후 revoke (기존 1초 지연 유지 —
// 일부 브라우저에서 즉시 revoke 시 다운로드가 끊기는 문제 회피).
export function downloadBlob(blob, filename) {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    window.URL.revokeObjectURL(blobUrl);
  }, 1000);
}

// URL 을 fetch 해 Blob 으로 저장 (signed URL 등 same-origin 미디어용)
export async function downloadFromUrl(url, filename) {
  const response = await fetch(url);
  const blob = await response.blob();
  downloadBlob(blob, filename);
}
