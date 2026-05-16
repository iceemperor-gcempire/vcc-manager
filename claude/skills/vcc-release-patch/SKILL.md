---
name: vcc-release-patch
description: vcc-manager 의 patch / minor 출시 흐름을 자동화 — PR 머지 → updatelog 추가 → dev→main PR → tag → GitHub Release 까지 단일 명령으로 진행
argument-hint: <semver> (예: v2.1.3 또는 2.1.3)
---

# vcc-release-patch 스킬

vcc-manager 의 표준 patch / minor 출시 절차. CLAUDE.md 의 \`버전 릴리스 시\` 항목 자동화.

---

## 전제 조건

1. **모든 변경은 이미 \`dev\` 브랜치에 머지된 상태** — 출시 PR 생성 직전에 release-blocker 변경 머지 완료
2. \`docs/updatelogs/v{major}.md\` 파일 존재 — 없으면 신규 생성
3. \`frontend/src/config.js\` 의 \`version.major\` / \`version.minor\` 가 출시 버전과 일치 (minor 변경 시 수동 업데이트 후 진행)
4. 사용자 권한 — git push, gh PR/release 권한

---

## 실행 단계

### 1단계: 변경 사항 요약 (dev vs main)

\`\`\`
git fetch origin main dev
git log --oneline origin/main..origin/dev
\`\`\`

이번 patch 에 포함된 commit / PR 들을 식별. updatelog 작성 재료.

### 2단계: updatelog 추가 (\`docs/updatelogs/v{major}.md\`)

파일 상단 (\`# v2 업데이트 내역\` 제목 바로 아래) 에 \`## v{version}\` 섹션 추가.
구조 예시:

\`\`\`markdown
## v2.1.3

### 수정
- fix: 변경 내용 (#PR번호 — closes #이슈번호)
  - 상세 설명

### 신규 기능
- feat: ...

### Breaking
- ... (있는 경우)
\`\`\`

각 항목은 PR 본문에서 발췌. 사용자가 admin 으로서 알아야 할 행동 (마이그레이션 / 설정 변경) 도 명시.

### 3단계: updatelog 커밋 + dev 푸시

\`\`\`bash
git checkout dev && git pull origin dev
git add docs/updatelogs/v{major}.md
git commit -m "docs: v{version} updatelog 추가

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin dev
\`\`\`

### 4단계: dev → main PR 생성

\`\`\`bash
gh pr create --base main --head dev --title "release: v{version}" --body "## v{version} {patch|minor}

- 항목 1 (#PR번호)
- 항목 2 (#PR번호)

상세: [docs/updatelogs/v2.md](docs/updatelogs/v2.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
\`\`\`

### 5단계: PR 머지 (merge commit — squash 금지)

\`\`\`bash
gh pr merge {PR번호} --merge
\`\`\`

> 리포지토리 설정 \`delete_branch_on_merge\` 는 **off** (#329). 릴리스 PR 머지 후 dev 브랜치는 자동 삭제되지 않음. 만에 하나 누군가 수동으로 dev 를 지운 경우 아래 \`주의사항 4\` 의 복구 절차 사용.

### 6단계: main 동기화 + 태그 + Release 생성

\`\`\`bash
git checkout main && git pull origin main
git tag -a v{version} -m "v{version} — 한줄 요약"
git push origin v{version}

gh release create v{version} --target main --title "v{version}" --notes "{updatelog 본문 발췌}"
\`\`\`

### 7단계: 사용자 안내

배포 안내:
- production 에서 \`git pull origin main\` + \`./scripts/deploy-prod.sh\` 재배포 필요
- breaking change 있다면 admin 의 작업판 / 설정 수정 안내 명시

---

## 주의사항

1. **squash merge 금지** — main 의 머지 commit 은 항상 merge commit (이 프로젝트 정책)
2. **\`--no-verify\` 사용 금지** — pre-commit hook 우회 안 함
3. **\`force push\` 금지** (특히 main / dev) — 머지 후 원격 브랜치 자동 삭제됨
4. **dev 브랜치가 머지로 사라지면 재생성**:
   \`\`\`bash
   git push origin main:dev
   \`\`\`
5. **minor 출시 시 \`frontend/src/config.js\` 의 minor 증가** 를 별도 PR 또는 updatelog PR 안에서 함께 처리
6. **태그는 항상 \`v\` prefix 포함** (예: \`v2.1.3\`, \`v2.2.0\`)

---

## 출시 후 확인 사항

1. GitHub Releases 페이지에 새 release 표시 확인
2. \`git tag\` 로컬 / 원격 동기화 확인
3. production 재배포 후 \`/health\` endpoint 정상 반환 확인
4. (필요시) 사용자에게 breaking change 안내

---

## 사용자 요청

$ARGUMENTS
