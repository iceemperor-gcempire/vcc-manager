#!/usr/bin/env node
/**
 * 데이터 정합성 점검·정제 CLI (#662 P0/P1).
 *
 * 사용법 (backend 컨테이너 안에서 — 이미지에 src/ 로 포함됨):
 *   docker compose exec backend node src/scripts/integrityCheck.js              # 진단 리포트 (읽기전용)
 *   docker compose exec backend node src/scripts/integrityCheck.js --files      # 파일↔DB 정합성 포함 (느릴 수 있음)
 *   docker compose exec backend node src/scripts/integrityCheck.js --fix-owner-orphans           # 정제 dry-run
 *   docker compose exec backend node src/scripts/integrityCheck.js --fix-owner-orphans --apply   # 실제 삭제
 *
 * 정책:
 * - 기본은 전부 읽기전용. --apply 없이는 어떤 것도 삭제하지 않는다.
 * - 정제 대상은 개인 콘텐츠(소유자 orphan)만 — 구조 리소스/끊긴 jobId 는 리포트 전용.
 * - 삭제 전 백업 권장 (백업에는 orphan 이 그대로 담기므로 되돌림 안전망이 된다).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const {
  checkOwnerOrphans,
  cleanupOwnerOrphans,
  checkDanglingJobRefs,
  checkFileIntegrity,
} = require('../services/integrityService');

const args = process.argv.slice(2);
const FLAG_FILES = args.includes('--files');
const FLAG_FIX = args.includes('--fix-owner-orphans');
const FLAG_APPLY = args.includes('--apply');

function printSection(title) {
  console.log(`\n═══ ${title} ═══`);
}

function printOrphanRows(rows) {
  for (const r of rows) {
    const mark = r.count > 0 ? '⚠️ ' : '  ';
    console.log(`${mark}${r.collection.padEnd(20)} ${String(r.count).padStart(6)}건` +
      (r.orphanOwners.length ? `  (orphan 소유자 ${r.orphanOwners.length}명)` : ''));
    for (const s of r.sample || []) {
      console.log(`     · ${s._id}  owner=${s[r.field]}  ${s.createdAt ? new Date(s.createdAt).toISOString() : s.name || ''}`);
    }
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI 환경변수가 필요합니다. (backend 컨테이너 안에서 실행하세요)');
    process.exit(1);
  }
  await mongoose.connect(uri);

  try {
    printSection('소유자 orphan (개인 콘텐츠 — 정제 대상)');
    const owners = await checkOwnerOrphans();
    printOrphanRows(owners.userContent);
    console.log(`  합계: ${owners.totalOrphanDocs}건`);

    printSection('소유자 orphan (구조 리소스 — 리포트 전용, 소유권 이전 정책 별개)');
    printOrphanRows(owners.structural);

    printSection('끊긴 jobId 참조 (리포트 전용 — jobId:null 은 보존 설계라 정상)');
    const dangling = await checkDanglingJobRefs();
    for (const r of dangling) {
      const mark = r.count > 0 ? '⚠️ ' : '  ';
      console.log(`${mark}${r.collection.padEnd(20)} ${String(r.count).padStart(6)}건`);
    }

    if (FLAG_FILES) {
      printSection('파일↔DB 정합성 (P1)');
      const files = await checkFileIntegrity();
      console.log(`  DB→디스크 누락(missing): ${files.missingCount}건`);
      for (const m of files.missing.slice(0, 10)) {
        console.log(`     · ${m.collection} ${m.id} ${m.field}=${m.url}`);
      }
      console.log(`  디스크 고아 파일(DB 참조 없음): ${files.orphanFileCount}건`);
      for (const f of files.orphanFiles.slice(0, 10)) {
        console.log(`     · ${f}`);
      }
    }

    if (FLAG_FIX) {
      printSection(FLAG_APPLY ? '소유자 orphan 정제 — 실제 삭제 (--apply)' : '소유자 orphan 정제 — dry-run (--apply 없음)');
      const cleanup = await cleanupOwnerOrphans({ apply: FLAG_APPLY });
      for (const r of cleanup.results) {
        console.log(`  ${r.collection.padEnd(20)} matched ${String(r.matched).padStart(6)}  deleted ${String(r.deleted).padStart(6)}`);
      }
      if (!FLAG_APPLY) {
        console.log('\n  실제 삭제하려면 --apply 를 붙이세요. 삭제 전 백업을 권장합니다.');
      }
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('integrity check failed:', err);
  process.exit(1);
});
