#!/usr/bin/env node
// v2.0 마이그레이션 버그 (Phase B 가 mongoose strict 로 baseInputFields 를 못 읽어 customField 생성 실패) 의
// 일회성 데이터 복구 스크립트. v2.0 배포 직전 백업 ZIP 의 Workboard.json 을 읽어 현재 DB 의 작업판에
// 누락된 customField 를 추가한다.
//
// 사용법:
//   docker compose exec backend node /app/scripts/recover-workboard-base-input-fields.js /path/to/backup.zip
//
// 또는 호스트에서:
//   cd /Users/.../vcc-manager
//   docker compose run --rm -v /path/to/backup.zip:/tmp/backup.zip backend node /app/scripts/recover-workboard-base-input-fields.js /tmp/backup.zip
//
// 동작:
// - 백업의 Workboard.json 에서 각 작업판의 baseInputFields 추출
// - 현재 DB 의 작업판 (_id 매치) 의 additionalInputFields 검사
// - 누락된 well-known 필드 (aiModel/imageSizes 등) 를 buildEntryFromLegacy 로 변환해 추가
// - raw collection 으로 update 해 mongoose strict 우회

const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const mongoose = require('mongoose');
const { buildEntryFromLegacy } = require('../src/migrations/backfillCustomFieldRoles');
const { LEGACY_BASE_FIELD_TO_ROLE, WELL_KNOWN_FIELD_NAME_TO_ROLE } = require('../src/constants/fieldRoles');

const TYPE_TO_ROLE = { baseModel: 'model', lora: 'lora' };

async function extractWorkboardJson(zipPath) {
  return new Promise((resolve, reject) => {
    let found = null;
    fs.createReadStream(zipPath)
      .pipe(unzipper.Parse())
      .on('entry', (entry) => {
        if (entry.path === 'database/Workboard.json') {
          const chunks = [];
          entry.on('data', (c) => chunks.push(c));
          entry.on('end', () => {
            try {
              found = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            } catch (e) {
              reject(new Error(`Workboard.json parse failed: ${e.message}`));
            }
          });
        } else {
          entry.autodrain();
        }
      })
      .on('close', () => {
        if (!found) reject(new Error('database/Workboard.json not found in backup'));
        else resolve(found);
      })
      .on('error', reject);
  });
}

// 어떤 role 이 customField 에 이미 점유돼 있는지 — type 매핑까지 고려
function occupiedRoles(currentCustomFields) {
  const roles = new Set();
  for (const f of currentCustomFields || []) {
    if (!f) continue;
    if (f.role) roles.add(f.role);
    if (TYPE_TO_ROLE[f.type]) roles.add(TYPE_TO_ROLE[f.type]);
    // well-known 이름도 점유로 간주
    if (WELL_KNOWN_FIELD_NAME_TO_ROLE[f.name]) roles.add(WELL_KNOWN_FIELD_NAME_TO_ROLE[f.name]);
  }
  return roles;
}

async function run() {
  const zipPath = process.argv[2];
  if (!zipPath) {
    console.error('Usage: recover-workboard-base-input-fields.js <backup.zip>');
    process.exit(1);
  }
  if (!fs.existsSync(zipPath)) {
    console.error(`File not found: ${zipPath}`);
    process.exit(1);
  }

  console.log(`[Recover] Reading backup ZIP: ${zipPath}`);
  const backupWorkboards = await extractWorkboardJson(zipPath);
  console.log(`[Recover] Found ${backupWorkboards.length} workboards in backup`);

  const uri = process.env.MONGODB_URI || 'mongodb://admin:password@mongodb:27017/vcc-manager?authSource=admin';
  await mongoose.connect(uri);
  const collection = mongoose.connection.collection('workboards');

  let scanned = 0;
  let recovered = 0;
  let appendedFields = 0;
  let skippedNoMatch = 0;
  let skippedNoData = 0;

  for (const bwb of backupWorkboards) {
    scanned += 1;
    const id = bwb._id?.$oid || bwb._id;
    if (!id) continue;

    const base = bwb.baseInputFields || {};
    const hasMeaningful = Object.entries(LEGACY_BASE_FIELD_TO_ROLE).some(([k]) => {
      const v = base[k];
      if (v === undefined || v === null) return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'string') return v.length > 0;
      if (typeof v === 'number') return false;  // schema 기본값 (temperature 0.7 등) 은 의미 없음
      return Boolean(v);
    });
    if (!hasMeaningful) {
      skippedNoData += 1;
      continue;
    }

    const cur = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!cur) {
      skippedNoMatch += 1;
      continue;
    }

    const currentFields = cur.additionalInputFields || [];
    const occupied = occupiedRoles(currentFields);

    const newEntries = [];
    for (const [legacyKey, role] of Object.entries(LEGACY_BASE_FIELD_TO_ROLE)) {
      if (occupied.has(role)) continue;  // 이미 의미적으로 점유 → skip (중복 회피)
      const legacyValue = base[legacyKey];
      if (legacyValue === undefined || legacyValue === null) continue;
      const entry = buildEntryFromLegacy(legacyKey, legacyValue);
      if (!entry) continue;
      if (entry.type === 'select' && (!entry.options || entry.options.length === 0)) continue;
      if (entry.type === 'string' && (entry.defaultValue === undefined || entry.defaultValue === '')) continue;
      // F4 에서 role 필드 drop 됨 — entry 의 role 도 제거 (mongoose 가 어차피 strip 하지만 명시적으로)
      delete entry.role;
      newEntries.push(entry);
    }

    if (newEntries.length === 0) continue;

    await collection.updateOne(
      { _id: cur._id },
      { $push: { additionalInputFields: { $each: newEntries } } }
    );
    recovered += 1;
    appendedFields += newEntries.length;
    console.log(`  ✓ ${cur.name}: +${newEntries.length} field(s) — ${newEntries.map(e => `${e.name}(${e.type})`).join(', ')}`);
  }

  console.log(`\n[Recover] Summary: scanned=${scanned}, recovered=${recovered}, fields appended=${appendedFields}, skipped (no match)=${skippedNoMatch}, skipped (no data)=${skippedNoData}`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error('[Recover] Fatal:', e);
  process.exit(1);
});
