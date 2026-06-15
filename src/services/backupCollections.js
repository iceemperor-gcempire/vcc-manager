/**
 * 백업 / 복원 대상 컬렉션 — 단일 소스 (#588)
 *
 * backupService 와 restoreService 가 각자 목록을 하드코딩하다 drift 가 생겨
 * (초기 이미지 중심 목록에 머물러 Project/세계관/파이프라인/대화 등 누락) 데이터 유실
 * 위험이 있었음. 이 모듈을 단일 소스로 사용한다.
 *
 * 순서: 복원 시 의존성(참조 대상) 우선으로 배치. 복원은 _id 보존 create 라 순서가
 *       참조 무결성에 결정적이진 않지만 가독성/안전 차원에서 정렬.
 *
 * 제외 대상:
 * - 운영성: BackupJob / RestoreJob (백업 작업 기록 자체)
 * - 캐시성(재생성 가능): LoraCache / ServerLoraCache / ServerModelCache
 *   → 서버 동기화로 다시 채워지므로 백업 불필요 (이전엔 LoraCache 만 백업돼 우선순위 역전)
 *
 * 필드 처리:
 * - sensitiveFields: 백업 시 제외 (복원 불가). 평문 민감정보 중 복원이 무의미/위험한 것.
 * - encryptFields:  백업 시 AES-256-GCM 암호화, 복원 시 동일 키로 복호화. 평문 secret 보존용.
 *
 * 비밀값 저장 형태 메모:
 * - User.password        : bcrypt 해시 (단방향) → 그대로 백업·복원해도 안전 + 로그인 동작
 * - ApiKey.keyHash       : SHA-256 해시 (단방향) → 그대로 백업해도 안전 + 키 검증 동작
 * - Server.configuration.apiKey, SystemSettings.*.civitaiApiKey : #594 이후 DB 에 at-rest
 *   암호화(enc:v1:) 문자열로 저장됨. backup encryptFields 는 그대로 두어 백업 안에서 한 번 더
 *   감싸지만, 복원 시 정확히 round-trip 되고 구버전(평문) 백업도 호환됨 (#594 PR 설명 참고).
 */

const User = require('../models/User');
const Group = require('../models/Group');
const Tag = require('../models/Tag');
const Server = require('../models/Server');
const Project = require('../models/Project');
const Workboard = require('../models/Workboard');
const UploadedText = require('../models/UploadedText');
const UploadedImage = require('../models/UploadedImage');
const PromptData = require('../models/PromptData');
const Pipeline = require('../models/Pipeline');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const ConversationJob = require('../models/ConversationJob');
const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const GeneratedText = require('../models/GeneratedText');
const PipelineRun = require('../models/PipelineRun');
const ApiKey = require('../models/ApiKey');
const SystemSettings = require('../models/SystemSettings');

const BACKUP_COLLECTIONS = [
  // 참조 대상 (사용자 / 그룹 / 태그 / 서버)
  { name: 'User', model: User, sensitiveFields: ['googleId'] },
  { name: 'Group', model: Group },
  { name: 'Tag', model: Tag },
  { name: 'Server', model: Server, encryptFields: ['configuration.apiKey'] },
  // 워크스페이스 / 작업판 / 문서
  { name: 'Project', model: Project },
  { name: 'Workboard', model: Workboard },
  { name: 'UploadedText', model: UploadedText },
  { name: 'UploadedImage', model: UploadedImage },
  { name: 'PromptData', model: PromptData },
  { name: 'Pipeline', model: Pipeline },
  // 작업 / 생성 결과
  { name: 'ImageGenerationJob', model: ImageGenerationJob },
  { name: 'ConversationJob', model: ConversationJob },
  { name: 'GeneratedImage', model: GeneratedImage },
  { name: 'GeneratedVideo', model: GeneratedVideo },
  { name: 'GeneratedText', model: GeneratedText },
  { name: 'PipelineRun', model: PipelineRun },
  // 인증 / 시스템 설정
  { name: 'ApiKey', model: ApiKey },
  { name: 'SystemSettings', model: SystemSettings, encryptFields: ['external.civitaiApiKey', 'lora.civitaiApiKey'] },
];

module.exports = { BACKUP_COLLECTIONS };
