// 단순 debounce — lodash 의존 제거 (#526). 마지막 호출 기준 wait ms 후 실행.
export function debounce(fn, wait) {
  let t;
  const debounced = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(t);
  return debounced;
}
