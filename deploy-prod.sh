#!/bin/bash

# VCC Manager Production Deployment Script
# 안전한 프로덕션 배포 스크립트 (데이터베이스 볼륨 보호)

set -e  # 에러 발생시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 환경 변수 파일 확인
ENV_FILE=".env.production"
COMPOSE_FILE="docker-compose.prod.yml"

echo -e "${BLUE}🚀 VCC Manager 프로덕션 배포 시작...${NC}"
echo "=================================="

# 환경 파일 존재 확인
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ 오류: $ENV_FILE 파일이 없습니다!${NC}"
    echo -e "${YELLOW}💡 해결방법: cp .env.production.example $ENV_FILE${NC}"
    echo -e "${YELLOW}   그 후 파일을 편집하여 실제 비밀번호와 설정을 입력하세요${NC}"
    exit 1
fi

# Docker Compose 파일 존재 확인
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ 오류: $COMPOSE_FILE 파일이 없습니다!${NC}"
    exit 1
fi

# 데이터베이스 백업 안내
echo -e "${YELLOW}⚠️  중요: 프로덕션 배포 전 데이터베이스 백업을 권장합니다${NC}"
read -p "백업을 완료했나요? (y/N): " backup_confirm
if [[ ! $backup_confirm =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}📝 백업 명령어:${NC}"
    echo "docker exec vcc-mongodb mongodump --uri=\"mongodb://admin:\$MONGO_ROOT_PASSWORD@localhost:27017/vcc-manager?authSource=admin\" --out=/tmp/backup"
    echo "docker cp vcc-mongodb:/tmp/backup ./backup-\$(date +%Y%m%d-%H%M%S)"
    echo ""
    read -p "백업 후 계속하려면 y를 입력하세요 (y/N): " continue_confirm
    if [[ ! $continue_confirm =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⏸️  배포가 취소되었습니다${NC}"
        exit 0
    fi
fi

# 현재 실행 중인 컨테이너 확인
echo -e "${BLUE}📊 현재 컨테이너 상태 확인 중...${NC}"
if docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE ps | grep -q "Up"; then
    CONTAINERS_RUNNING=true
    echo -e "${GREEN}✅ 실행 중인 컨테이너가 있습니다${NC}"
else
    CONTAINERS_RUNNING=false
    echo -e "${YELLOW}⚠️  실행 중인 컨테이너가 없습니다${NC}"
fi

# 기존 애플리케이션 컨테이너 중지 (볼륨은 유지)
echo -e "${BLUE}⏹️  기존 애플리케이션 컨테이너 중지 중...${NC}"
echo -e "${GREEN}✅ 데이터베이스 볼륨은 안전하게 보호됩니다${NC}"
docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE stop frontend backend nginx 2>/dev/null || true

# 이미지 캐시 없이 빌드
echo -e "${BLUE}🔨 애플리케이션 이미지를 캐시 없이 빌드 중...${NC}"
echo "이 과정은 몇 분 소요될 수 있습니다..."
docker-compose -f $COMPOSE_FILE build --no-cache frontend backend

# 기존 애플리케이션 컨테이너 제거 (볼륨과 데이터베이스는 유지)
echo -e "${BLUE}🗑️  기존 애플리케이션 컨테이너 제거 중...${NC}"
docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE rm -f frontend backend nginx 2>/dev/null || true

# 새 컨테이너로 시작
echo -e "${BLUE}🚀 새로운 애플리케이션 컨테이너 시작 중...${NC}"
docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d

# 컨테이너 시작 대기
echo -e "${BLUE}⏳ 컨테이너 시작 대기 중...${NC}"
sleep 10

# 배포 결과 확인
echo -e "${BLUE}📊 배포 결과 확인 중...${NC}"
echo "=================================="

# 컨테이너 상태 확인
echo -e "${BLUE}📦 컨테이너 상태:${NC}"
docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE ps

# 헬스 체크
echo -e "\n${BLUE}🏥 서비스 헬스 체크:${NC}"

# Backend 헬스 체크
BACKEND_PORT=$(grep BACKEND_PORT $ENV_FILE | cut -d '=' -f2 || echo "3000")
if curl -s http://localhost:$BACKEND_PORT/api >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend (포트 $BACKEND_PORT): 정상${NC}"
else
    echo -e "${RED}❌ Backend (포트 $BACKEND_PORT): 응답 없음${NC}"
fi

# Frontend 헬스 체크
FRONTEND_PORT=$(grep FRONTEND_PORT $ENV_FILE | cut -d '=' -f2 || echo "80")
if curl -s http://localhost:$FRONTEND_PORT >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend (포트 $FRONTEND_PORT): 정상${NC}"
else
    echo -e "${RED}❌ Frontend (포트 $FRONTEND_PORT): 응답 없음${NC}"
fi

# 로그 확인 안내
echo -e "\n${BLUE}📋 유용한 명령어:${NC}"
echo "🔍 로그 확인: docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE logs -f"
echo "⏹️  중지: docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE down"
echo "📊 상태 확인: docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE ps"

echo -e "\n${GREEN}🎉 프로덕션 배포가 완료되었습니다!${NC}"
echo -e "${GREEN}🌐 접속 주소: http://localhost:$FRONTEND_PORT${NC}"

# 데이터 보존 안내
echo -e "\n${YELLOW}💾 데이터 보존 정보:${NC}"
echo "• MongoDB 데이터: 안전하게 보존됨"
echo "• Redis 데이터: 안전하게 보존됨" 
echo "• 업로드된 파일: 안전하게 보존됨"

echo -e "\n${BLUE}배포 완료 시각: $(date)${NC}"