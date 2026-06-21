#!/usr/bin/env bash
# 백업 .zip 파일을 실행 중인 backend 컨테이너의 /app/backups 로 올린다 (#634).
# 대용량 백업을 브라우저로 업로드하지 않고, 이 한 줄로 서버에 넣은 뒤
# 웹 UI(관리자 > 백업/복구 > "서버 백업")에서 선택해 복원한다.
#
# 사용법:
#   ./scripts/upload-backup-file.sh <백업파일.zip>
#   ./scripts/upload-backup-file.sh --dev <백업파일.zip>   # 개발(docker-compose.yml) 환경
set -euo pipefail

MODE="prod"
if [ "${1:-}" = "--dev" ]; then MODE="dev"; shift; fi

FILE="${1:-}"
if [ -z "$FILE" ]; then
  echo "사용법: $0 [--dev] <백업파일.zip>"
  exit 1
fi
if [ ! -f "$FILE" ]; then
  echo "❌ 파일을 찾을 수 없습니다: $FILE"
  exit 1
fi
case "$FILE" in
  *.zip) ;;
  *) echo "❌ .zip 백업 파일이어야 합니다: $FILE"; exit 1 ;;
esac

# repo 루트로 이동 (스크립트 위치 기준)
cd "$(dirname "$0")/.."

# compose 명령 구성 (prod 우선, 없으면 dev)
if [ "$MODE" = "prod" ] && [ -f docker-compose.prod.yml ] && [ -f .env.production ]; then
  COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.production)
else
  COMPOSE=(docker compose)
fi

# backend 컨테이너가 떠 있는지 확인
if ! "${COMPOSE[@]}" ps backend 2>/dev/null | grep -q "Up\|running"; then
  echo "❌ backend 컨테이너가 실행 중이 아닙니다. 먼저 서비스를 기동하세요 (예: ./scripts/deploy-prod.sh)."
  exit 1
fi

BN="$(basename "$FILE")"
SIZE="$(du -h "$FILE" | cut -f1)"
echo "📦 백업 파일 업로드: $BN ($SIZE) → backend:/app/backups/"
"${COMPOSE[@]}" cp "$FILE" "backend:/app/backups/$BN"

echo "✅ 완료했습니다."
echo "   다음: 웹 UI 관리자 > 백업/복구 > '서버 백업' 탭에서 '$BN' 을 선택해 복원하세요."
