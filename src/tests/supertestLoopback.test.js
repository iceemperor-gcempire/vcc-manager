// supertest 가 테스트 서버를 127.0.0.1 에 여는지 고정한다 (#1051)
//
// supertest 6 은 서버를 모든 주소(`::`)에 열고 127.0.0.1 로 요청했다. macOS 는 다른 프로세스가
// 127.0.0.1 에만 열어 둔 포트를 같은 번호로 내줄 수 있어서, 그때 요청은 그 프로세스가 받았다.
// 개발 머신의 로컬 도구들이 401 을 돌려줘 전체 실행 몇 번에 한 번 아무 테스트나 실패했다
// (#1180·#1196·#1232). supertest 7.3.1 부터 서버를 127.0.0.1 에 연다.
// 그 실패는 확률적이라 전체 실행에서 드물게만 드러나므로, 여기서는 서버가 연 주소를 직접 본다.
const express = require('express');
const request = require('supertest');

test('supertest 로 보낸 요청은 127.0.0.1 에 열린 서버가 받는다 (#1051)', async () => {
  const app = express();
  app.get('/', (req, res) => res.json({ localAddress: req.socket.localAddress }));

  const res = await request(app).get('/');

  expect(res.status).toBe(200);
  // 모든 주소(`::`)에 열렸다면 127.0.0.1 로 들어온 연결이 `::ffff:127.0.0.1` 로 보인다
  expect(res.body.localAddress).toBe('127.0.0.1');
});
