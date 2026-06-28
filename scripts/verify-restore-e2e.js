#!/usr/bin/env node
/**
 * 백업/복원 e2e 회귀 검증 (#655 후속 — 실 데이터 end-to-end).
 *
 * 백업/복원은 단위/mock 으로 회귀를 못 잡는다(이중해싱·ZIP64·폴링 등 실환경에서만 발현).
 * 이 스크립트는 격리 temp DB 에 실제 백업을 여러 시나리오로 복원하고, 복원 후 불변식을
 * 실 데이터로 확인한다. 운영 DB 는 건드리지 않으며, 비밀번호 등 시크릿을 하드코딩하지 않는다
 * (컨테이너 env 의 MONGODB_URI 에서 DB명만 격리 temp 로 치환).
 *
 * 실행(컨테이너 내부):
 *   docker exec vcc-backend node scripts/verify-restore-e2e.js [백업파일.zip]
 * 인자 없으면 BACKUP_DIR 의 최신 zip 사용.
 *
 * 종료코드: 모든 검증 통과 0, 하나라도 실패 1.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');

const BACKUP_DIR = process.env.BACKUP_PATH || '/app/backups';
const baseUri = process.env.MONGODB_URI;
if (!baseUri) { console.error('MONGODB_URI 가 없습니다.'); process.exit(1); }

// DB명만 격리 temp 로 치환 (자격증명/호스트/옵션 보존 — 시크릿 노출 없음)
const TEMP_DB = 'vcc_verify_e2e_tmp';
const tempUri = baseUri.replace(/\/[^/?]+(\?|$)/, `/${TEMP_DB}$1`);

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'} :: ${name}${detail ? ` :: ${detail}` : ''}`);
}

async function openMeta(zip) {
  const dir = await unzipper.Open.file(zip);
  const e = dir.files.find((f) => f.path === 'metadata.json');
  return JSON.parse((await e.buffer()).toString());
}
async function openNdjson(zip, name) {
  const dir = await unzipper.Open.file(zip);
  const e = dir.files.find((f) => f.path === `database/${name}.ndjson`);
  if (!e) return [];
  return (await e.buffer()).toString().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

(async () => {
  const restoreService = require('/app/src/services/restoreService');
  const backupService = require('/app/src/services/backupService');
  const { BACKUP_COLLECTIONS } = require('/app/src/services/backupCollections');
  const User = require('/app/src/models/User');
  const GeneratedImage = require('/app/src/models/GeneratedImage');
  const Server = require('/app/src/models/Server');
  const BackupJob = require('/app/src/models/BackupJob');
  const { decryptSecret } = require('/app/src/utils/secretCrypto');

  // 사용할 백업 선택
  let zipName = process.argv[2];
  if (!zipName) {
    const zips = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.zip') && !f.startsWith('vcc-presnapshot'));
    zipName = zips.sort().reverse()[0];
  }
  const zip = path.join(BACKUP_DIR, zipName);
  console.log('USING_BACKUP=' + zip);
  const meta = await openMeta(zip);
  const backupUsers = await openNdjson(zip, 'User');
  const usersWithPw = backupUsers.filter((u) => u.password);
  // 백업 자체의 소유자 orphan 수 — vcc 는 User 삭제 시 콘텐츠 보존 설계라 백업부터 orphan 존재 가능.
  // 복원 무결성은 "추가 orphan 을 만들지 않음"으로 판정(0 이 아니라 백업 대비 동일).
  const backupUserIds = new Set(backupUsers.map((u) => String(u._id)));
  const backupOrphans = (await openNdjson(zip, 'GeneratedImage')).filter((g) => g.userId && !backupUserIds.has(String(g.userId))).length;

  await mongoose.connect(tempUri);
  if (mongoose.connection.name !== TEMP_DB) {
    console.error('격리 DB 치환 실패 — 운영 DB 보호를 위해 중단: ' + mongoose.connection.name);
    process.exit(1);
  }
  console.log('TEMP_DB=' + mongoose.connection.name + '\n');

  const reset = () => mongoose.connection.dropDatabase();
  const uid = () => new mongoose.Types.ObjectId();
  const restore = async (opts) => {
    const vjob = await restoreService.validateBackup(zip, uid());
    return restoreService.executeRestore(vjob._id, zip, opts);
  };
  const countAll = async () => {
    const out = {};
    for (const c of BACKUP_COLLECTIONS) out[c.name] = await c.model.countDocuments();
    return out;
  };
  const countsMatchMeta = (counts) => {
    let ok = true; let detail = '';
    for (const c of BACKUP_COLLECTIONS) {
      const exp = meta.collections[c.name] || 0;
      if ((counts[c.name] || 0) !== exp) { ok = false; detail += `${c.name}:${counts[c.name]}/${exp} `; }
    }
    return { ok, detail };
  };

  // ── 시나리오 1: 완전 교체(clean) — 전체 불변식 ──────────────────────────
  await reset();
  let rjob = await restore({ cleanRestore: true, skipFiles: true, skipSnapshot: true });
  check('[완전교체] 복원 완료·에러0', rjob.status === 'completed' && rjob.statistics.errors === 0, `status=${rjob.status} err=${rjob.statistics.errors}`);

  const c1 = await countAll();
  const cm = countsMatchMeta(c1);
  check('[완전교체] 컬렉션 카운트 == 백업 메타', cm.ok, cm.detail);

  // 비밀번호 해시 원본 보존 (재해싱=이중해싱 방지, #655)
  let pwHashOk = true; let pwDetail = '';
  for (const bu of usersWithPw) {
    const dbu = await User.findById(bu._id).lean();
    if (!dbu || dbu.password !== bu.password) { pwHashOk = false; pwDetail = `mismatch id=${bu._id}`; break; }
  }
  check('[완전교체] 비밀번호 해시 == 백업 원본(재해싱 없음)', pwHashOk, pwDetail);

  // 생성시각 원본 보존 (#646)
  let tsOk = true; let tsDetail = '';
  for (const bu of backupUsers) {
    if (!bu.createdAt) continue;
    const dbu = await User.findById(bu._id).lean();
    if (dbu && new Date(dbu.createdAt).toISOString() !== new Date(bu.createdAt).toISOString()) {
      tsOk = false; tsDetail = `id=${bu._id} db=${new Date(dbu.createdAt).toISOString()} backup=${new Date(bu.createdAt).toISOString()}`; break;
    }
  }
  check('[완전교체] createdAt 원본 보존(복원시점 아님)', tsOk, tsDetail);

  // 소유자(_id) 참조 무결성 — 복원이 백업 대비 추가 orphan 을 만들지 않았는지
  // (백업 원본부터 존재하는 orphan 은 복원 책임 아님 — User 삭제 시 콘텐츠 보존 설계)
  const userIdSet = new Set((await User.find({}, { _id: 1 }).lean()).map((u) => String(u._id)));
  const gisAll = await GeneratedImage.find({}, { userId: 1 }).lean();
  const restoredOrphans = gisAll.filter((g) => g.userId && !userIdSet.has(String(g.userId))).length;
  check('[완전교체] 소유자(_id) 참조 무결성(복원이 추가 orphan 없음)', restoredOrphans === backupOrphans, `restored=${restoredOrphans} backup=${backupOrphans}`);

  // provider 키 복호화 (Server.configuration.apiKey)
  const servers = await Server.find().lean();
  const withKey = servers.filter((s) => s.configuration && s.configuration.apiKey);
  let keyOk = true;
  for (const s of withKey) { const d = decryptSecret(s.configuration.apiKey); if (d === null || d === undefined || d === '') { keyOk = false; break; } }
  check('[완전교체] provider 키 복호화', withKey.length === 0 || keyOk, `${withKey.length} server keys`);

  // ── 시나리오 2: 덮어쓰기(overwrite) 멱등 — 같은 백업 재복원 ─────────────
  rjob = await restore({ overwriteExisting: true, skipFiles: true, skipSnapshot: true });
  const c2 = await countAll();
  const cm2 = countsMatchMeta(c2);
  check('[덮어쓰기·멱등] 카운트 불변 + 에러0', cm2.ok && rjob.statistics.errors === 0, `${cm2.detail}err=${rjob.statistics.errors}`);
  let pwHashOk2 = true;
  for (const bu of usersWithPw) { const dbu = await User.findById(bu._id).lean(); if (!dbu || dbu.password !== bu.password) { pwHashOk2 = false; break; } }
  check('[덮어쓰기·멱등] 비밀번호 해시 여전히 원본', pwHashOk2);

  // ── 시나리오 3: 빈 DB 일반 복원(overwrite=false) ──────────────────────
  await reset();
  rjob = await restore({ skipFiles: true, skipSnapshot: true });
  const c3 = await countAll();
  const cm3 = countsMatchMeta(c3);
  check('[빈DB 일반] 카운트 == 메타 + 에러0', cm3.ok && rjob.statistics.errors === 0, `${cm3.detail}err=${rjob.statistics.errors}`);

  // ── 시나리오 4: skipDatabase — DB 미변경 ──────────────────────────────
  await reset();
  rjob = await restore({ skipDatabase: true, skipFiles: true, skipSnapshot: true });
  const c4 = await countAll();
  const totalC4 = Object.values(c4).reduce((a, b) => a + b, 0);
  check('[skipDatabase] DB 미복원(0건)', totalC4 === 0, `total=${totalC4}`);

  // ── round-trip: 완전교체 복원 → 재백업 → 메타 동일 ────────────────────
  await reset();
  await restore({ cleanRestore: true, skipFiles: true, skipSnapshot: true });
  let rtZip = null;
  try {
    const bj = await backupService.initBackupJob(uid(), 'full');
    await backupService.executeBackup(bj._id);
    const saved = await BackupJob.findById(bj._id);
    rtZip = saved.filePath;
    const newMeta = await openMeta(rtZip);
    let rtOk = true; let rtDetail = '';
    for (const c of BACKUP_COLLECTIONS) {
      const a = newMeta.collections[c.name] || 0; const b = meta.collections[c.name] || 0;
      if (a !== b) { rtOk = false; rtDetail += `${c.name}:${a}/${b} `; }
    }
    check('[round-trip] 복원→재백업 컬렉션 카운트 동일', rtOk, rtDetail);
  } finally {
    if (rtZip && fs.existsSync(rtZip)) fs.unlinkSync(rtZip);
  }

  // ── 로그인 라이프사이클: 가입(평문비번)→백업→복원→bcrypt.compare ───────
  await reset();
  const KNOWN = 'KnownVerifyPass!2026';
  const ku = new User({
    email: 'verify-e2e@test.local', nickname: 'verifyE2E', password: KNOWN,
    authProvider: 'local', approvalStatus: 'approved', isActive: true, role: 'user'
  });
  await ku.save(); // pre-save 가 정상 1회 해시
  const kid = ku._id;
  let lifeZip = null;
  try {
    const bj = await backupService.initBackupJob(uid(), 'full');
    await backupService.executeBackup(bj._id);
    lifeZip = (await BackupJob.findById(bj._id)).filePath;
    await reset();
    const vj = await restoreService.validateBackup(lifeZip, uid());
    await restoreService.executeRestore(vj._id, lifeZip, { cleanRestore: true, skipFiles: true, skipSnapshot: true });
    const restored = await User.findById(kid).lean();
    const compareOk = !!restored && await bcrypt.compare(KNOWN, restored.password);
    check('[라이프사이클] 가입→백업→복원 후 실제 비밀번호 로그인(bcrypt.compare) 성공', compareOk);
  } finally {
    if (lifeZip && fs.existsSync(lifeZip)) fs.unlinkSync(lifeZip);
  }

  // 정리
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) console.log('FAILED: ' + failed.map((r) => r.name).join(' | '));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('SCRIPT_ERR=' + e.message); console.error(e.stack); process.exit(1); });
