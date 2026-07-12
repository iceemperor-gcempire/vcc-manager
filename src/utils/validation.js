const Joi = require('joi');

const signupSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': '올바른 이메일 형식을 입력해주세요',
      'any.required': '이메일은 필수 입력 항목입니다'
    }),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])'))
    .required()
    .messages({
      'string.min': '비밀번호는 최소 8자 이상이어야 합니다',
      'string.max': '비밀번호는 128자를 초과할 수 없습니다',
      'string.pattern.base': '비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다',
      'any.required': '비밀번호는 필수 입력 항목입니다'
    }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': '비밀번호 확인이 일치하지 않습니다',
      'any.required': '비밀번호 확인은 필수 입력 항목입니다'
    }),
  nickname: Joi.string()
    .min(2)
    .max(50)
    .pattern(new RegExp('^[a-zA-Z0-9가-힣_\\s]+$'))
    .required()
    .messages({
      'string.min': '닉네임은 최소 2자 이상이어야 합니다',
      'string.max': '닉네임은 50자를 초과할 수 없습니다',
      'string.pattern.base': '닉네임은 한글, 영문, 숫자, 밑줄, 공백만 사용할 수 있습니다',
      'any.required': '닉네임은 필수 입력 항목입니다'
    })
});

const signinSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': '올바른 이메일 형식을 입력해주세요',
      'any.required': '이메일은 필수 입력 항목입니다'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': '비밀번호는 필수 입력 항목입니다'
    })
});

const profileUpdateSchema = Joi.object({
  nickname: Joi.string()
    .min(2)
    .max(50)
    .pattern(new RegExp('^[a-zA-Z0-9가-힣_\\s]+$'))
    .optional()
    .messages({
      'string.min': '닉네임은 최소 2자 이상이어야 합니다',
      'string.max': '닉네임은 50자를 초과할 수 없습니다',
      'string.pattern.base': '닉네임은 한글, 영문, 숫자, 밑줄, 공백만 사용할 수 있습니다'
    }),
  preferences: Joi.object({
    language: Joi.string().valid('ko', 'en').optional(),
    theme: Joi.string().valid('light', 'dark').optional()
  }).optional()
});

const passwordChangeSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'any.required': '현재 비밀번호는 필수 입력 항목입니다'
    }),
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])'))
    .required()
    .messages({
      'string.min': '새 비밀번호는 최소 8자 이상이어야 합니다',
      'string.max': '새 비밀번호는 128자를 초과할 수 없습니다',
      'string.pattern.base': '새 비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다',
      'any.required': '새 비밀번호는 필수 입력 항목입니다'
    }),
  confirmNewPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': '새 비밀번호 확인이 일치하지 않습니다',
      'any.required': '새 비밀번호 확인은 필수 입력 항목입니다'
    })
});

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path[0],
        message: detail.message
      }));

      return res.status(400).json({
        message: 'Validation failed',
        errors
      });
    }

    next();
  };
};

// ─── 리소스 라우트 스키마 (#698) ─────────────────────────────────
// 타입/필수/enum 만 검증하는 앞단 게이트 — DB 중복 검사·동적 기본값 등 도메인 검증은
// 핸들러에 그대로 둔다. 클라이언트가 추가 필드를 보내는 기존 계약을 깨지 않도록
// unknown 키는 허용. 에러 메시지는 기존 핸들러의 수동 검증 메시지와 동일하게 유지.

const SERVER_TYPES = ['ComfyUI', 'OpenAI', 'OpenAI Compatible', 'Gemini'];

const REQUIRED_FIELD_MESSAGES = {
  'any.required': '필수 필드가 누락되었습니다.',
  'string.empty': '필수 필드가 누락되었습니다.',
};

const serverCreateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required().messages(REQUIRED_FIELD_MESSAGES),
  description: Joi.string().allow('', null).max(2000),
  serverType: Joi.string().valid(...SERVER_TYPES).required().messages({
    ...REQUIRED_FIELD_MESSAGES,
    'any.only': '지원하지 않는 서버 타입입니다.',
  }),
  serverUrl: Joi.string().trim().min(1).required().messages(REQUIRED_FIELD_MESSAGES),
  configuration: Joi.object().unknown(true),
}).unknown(true);

// PUT 은 부분 업데이트 — 빈 문자열 등 기존에 핸들러가 무시/통과시키던 값을
// 막지 않도록 타입만 본다 (min 제약 없음).
const serverUpdateSchema = Joi.object({
  name: Joi.string().allow('').max(200),
  description: Joi.string().allow('', null).max(2000),
  serverType: Joi.string().valid(...SERVER_TYPES)
    .messages({ 'any.only': '지원하지 않는 서버 타입입니다.' }),
  serverUrl: Joi.string().allow(''),
  configuration: Joi.object().unknown(true),
  isActive: Joi.boolean(),
}).unknown(true);

const workboardCreateSchema = Joi.object({
  serverId: Joi.string().required()
    .messages({
      'any.required': 'serverId is required. Please select a server.',
      'string.empty': 'serverId is required. Please select a server.',
    }),
  name: Joi.string().trim().max(200),
  description: Joi.string().allow('', null).max(2000),
  workboardType: Joi.string(),
  outputFormat: Joi.string(),
  // baseInputFields: legacy 필드 — 편집기가 객체를, 구버전 백업이 배열을 보낼 수 있어
  // 타입을 제약하지 않는다 (모델은 F4 에서 스키마 제거돼 저장 시 strip됨) (#706)
  baseInputFields: Joi.any(),
  additionalInputFields: Joi.array(),
  allowedModelTypes: Joi.array(),
  allowedGroupIds: Joi.array(),
  modelExposurePolicy: Joi.string(),
  modelWhitelist: Joi.array(),
  loraExposurePolicy: Joi.string(),
  loraWhitelist: Joi.array(),
  llmExtraParams: Joi.object().unknown(true).allow(null),
}).unknown(true);

const workboardUpdateSchema = Joi.object({
  serverId: Joi.string(),
  name: Joi.string().allow('').max(200),
  description: Joi.string().allow('', null).max(2000),
  workboardType: Joi.string(),
  outputFormat: Joi.string(),
  baseInputFields: Joi.any(), // legacy — 위 create 주석 참고 (#706)
  additionalInputFields: Joi.array(),
  allowedModelTypes: Joi.array(),
  allowedGroupIds: Joi.array(),
  modelExposurePolicy: Joi.string(),
  modelWhitelist: Joi.array(),
  loraExposurePolicy: Joi.string(),
  loraWhitelist: Joi.array(),
  llmExtraParams: Joi.object().unknown(true).allow(null),
  isActive: Joi.boolean(),
}).unknown(true);

const projectCreateSchema = Joi.object({
  name: Joi.string().trim().min(1).required()
    .messages({
      'any.required': '프로젝트 이름은 필수입니다',
      'string.empty': '프로젝트 이름은 필수입니다',
    }),
  tagName: Joi.string().trim().min(1).required()
    .messages({
      'any.required': '태그명은 필수입니다',
      'string.empty': '태그명은 필수입니다',
    }),
  description: Joi.string().allow('', null),
}).unknown(true);

const projectUpdateSchema = Joi.object({
  name: Joi.string().allow(''),
  description: Joi.string().allow('', null),
  coverImage: Joi.object().unknown(true).allow(null),
}).unknown(true);

const tagCreateSchema = Joi.object({
  name: Joi.string().trim().min(1).required()
    .messages({
      'any.required': 'Tag name is required',
      'string.empty': 'Tag name is required',
    }),
  color: Joi.string().allow('', null).max(50),
}).unknown(true);

const tagUpdateSchema = Joi.object({
  name: Joi.string().allow(''),
  color: Joi.string().allow('', null).max(50),
}).unknown(true);

// 리소스 라우트용 검증 미들웨어 — 기존 라우트 에러 형식({ success: false, message })에 맞춤.
// message 는 첫 번째 위반 항목 (abortEarly:false 로 전체 수집, errors 에 나열).
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
        errors: error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
    }

    next();
  };
};

module.exports = {
  signupSchema,
  signinSchema,
  profileUpdateSchema,
  passwordChangeSchema,
  serverCreateSchema,
  serverUpdateSchema,
  workboardCreateSchema,
  workboardUpdateSchema,
  projectCreateSchema,
  projectUpdateSchema,
  tagCreateSchema,
  tagUpdateSchema,
  validate,
  validateBody
};