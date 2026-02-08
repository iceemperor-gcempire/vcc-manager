#!/bin/bash

# VCC Manager Production Stop Script
# This script stops the production Docker containers using docker-compose

set -e

# 프로젝트 루트로 이동
cd "$(dirname "$0")/.."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 환경 변수 파일 확인
ENV_FILE=".env.production"
COMPOSE_FILE="docker-compose.prod.yml"

echo -e "${BLUE}🛑 VCC Manager 프로덕션 서버 중지...${NC}"
echo "=================================="

# 환경 파일 존재 확인
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ 오류: $ENV_FILE 파일이 없습니다!${NC}"
    echo -e "${YELLOW}💡 해결방법: cp .env.production.example $ENV_FILE${NC}"
    exit 1
fi

# Docker Compose 파일 존재 확인
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ 오류: $COMPOSE_FILE 파일이 없습니다!${NC}"
    exit 1
fi

# 현재 실행 중인 컨테이너 확인
echo -e "${BLUE}📊 현재 컨테이너 상태 확인 중...${NC}"
if docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE ps | grep -q "Up"; then
    echo -e "${GREEN}✅ 실행 중인 컨테이너가 있습니다${NC}"
    
    # Docker Compose로 모든 서비스 중지
    echo -e "${BLUE}⏹️  Docker Compose 서비스 중지 중...${NC}"
    docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE down
    
    echo -e "${GREEN}✅ VCC Manager 프로덕션 서버가 성공적으로 중지되었습니다${NC}"
else
    echo -e "${YELLOW}⚠️  실행 중인 컨테이너가 없습니다${NC}"
fi

echo -e "\n${BLUE}📋 유용한 명령어:${NC}"
echo "🚀 재시작: ./scripts/deploy-prod.sh"
echo "📊 상태 확인: docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE ps"
echo "🔍 로그 확인: docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE logs"

echo -e "\n${GREEN}🎉 프로덕션 서버 중지 완료${NC}"
echo -e "${YELLOW}💾 참고: 데이터베이스 볼륨과 데이터는 안전하게 보존됩니다${NC}"
echo -e "\n${BLUE}중지 완료 시각: $(date)${NC}"