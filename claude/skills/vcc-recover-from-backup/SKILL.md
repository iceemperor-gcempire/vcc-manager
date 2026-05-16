---
name: vcc-recover-from-backup
description: VCC 백업 ZIP 의 Workboard.json 에서 baseInputFields / customField 등 손실된 작업판 정의를 복구
argument-hint: <백업 파일 경로 또는 backupJobId>
---

# vcc-recover-from-backup 스킬

데이터베이스 마이그레이션 사고 / 운영자 실수로 작업판 정의 (특히 baseInputFields 의 options) 가 손실됐을 때 백업 ZIP 에서 복구.

v2.0.5 의 \`scripts/recover-workboard-base-input-fields.js\` 활용.

---

## 전제 조건

1. **백업 ZIP 보유** — v2.0 deploy 이전 또는 손실 시점 이전의 백업
2. **백업 파일 위치 확인 가능**:
   - admin UI \`/admin/backup\` 에서 fileName 확인
   - 또는 \`docker compose exec backend ls /app/backups\`
   - 또는 \`BackupJob\` 컬렉션 query
3. **v2.0.5 이상의 backend 코드** — recovery script 가 포함된 버전
4. **admin 권한** — DB write 권한 가진 사용자

---

## 동작 원리

1. 백업 ZIP 의 \`database/Workboard.json\` 에서 워크보드 entries 추출
2. 각 워크보드의 \`baseInputFields\` 에서 well-known 키 (aiModel / imageSizes / referenceImageMethods / stylePresets / upscaleMethods / systemPrompt / referenceImages / temperature / maxTokens) 검사
3. 현재 DB 의 동일 \`_id\` 워크보드 의 \`additionalInputFields\` 에 누락된 customField 만 append (멱등)
4. raw collection 사용 — mongoose strict 우회

---

## 실행 단계

### 1단계: 백업 파일 위치 확인

**A. admin UI**: \`/admin/backup\` 페이지에서 파일명 (예: \`vcc-backup-2026-05-13T...zip\`) 확인.

**B. 컨테이너 ls**:
\`\`\`bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend ls -la /app/backups
\`\`\`

**C. DB 조회**:
\`\`\`bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec mongodb mongosh \\
  -u admin -p <MONGO_ROOT_PASSWORD> --authenticationDatabase admin --quiet --eval \\
  'use(\"vcc-manager\"); db.backupjobs.find({status:\"completed\"}, {fileName:1, filePath:1, createdAt:1}).sort({createdAt:-1}).limit(5).toArray()'
\`\`\`

### 2단계: 복구 script 실행

\`\`\`bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend \\
  node /app/scripts/recover-workboard-base-input-fields.js /app/backups/<filename>.zip
\`\`\`

**중요:** \`exec\` 사용 (이미 실행 중인 backend 컨테이너에서). \`run --rm\` 도 가능하지만 mongo 연결 위한 환경변수 셋업이 컨테이너 image 의 \`ENV\` + .env.production 둘 다 필요.

호스트의 백업 파일을 컨테이너 안으로 마운트해서 사용하려면:
\`\`\`bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm \\
  -v /host/path/to/backup.zip:/tmp/backup.zip \\
  backend node /app/scripts/recover-workboard-base-input-fields.js /tmp/backup.zip
\`\`\`

### 3단계: 결과 로그 분석

script 가 작업판 별 어떤 customField 가 복구됐는지 출력:
\`\`\`
[Recover] Reading backup ZIP: /app/backups/vcc-backup-...zip
[Recover] Found N workboards in backup
  ✓ {workboard name}: +K field(s) — aiModel(select), imageSizes(select), ...
[Recover] Summary: scanned=N, recovered=M, fields appended=K, ...
\`\`\`

- \`recovered\` = 복구된 워크보드 수
- \`appended\` = 추가된 customField 총 개수
- \`skipped (no match)\` = 백업에는 있는데 현재 DB 에 \_id 매치 안 되는 워크보드 (삭제된 경우)
- \`skipped (no data)\` = baseInputFields 가 의미있는 데이터 없는 케이스

### 4단계: admin UI 에서 검증

복구된 작업판의 \"입력 양식\" 탭에서 새로 추가된 customField 들 확인:
- 이름 (camelCase plural 형태로 들어감 — e.g. \`aiModel\`, \`imageSizes\`)
- 사용자 페이지에서 동작 확인 위해 \`formatString\` 을 workflow placeholder 와 매칭되도록 admin 이 직접 수정 필요할 수 있음 (예: \`aiModel\` → formatString \`{{##base_model##}}\`)

---

## 주의사항

1. **멱등** — 이미 같은 role 의 customField 가 있으면 skip. 여러 번 실행해도 중복 추가 안 됨
2. **백업 ZIP 의 baseInputFields 가 비어있는 워크보드** — script 가 skip
3. **\_id 매칭 안 되는 경우** (워크보드 삭제 후 백업 사용) — script 가 skip. 워크보드 자체를 복구하려면 별도 절차 (DB 전체 restore)
4. **버전 호환성** — v1.x ~ v2.0.0 백업 모두 지원. v2.0.5+ 의 백업은 이미 customField 가 있어 거의 no-op
5. **백업 파일 보안** — production 환경에서 백업에 사용자 데이터 포함. 호스트로 다운로드 시 주의

---

## 사용자 요청

$ARGUMENTS
