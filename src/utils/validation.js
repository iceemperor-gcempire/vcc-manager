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
    console.log('Validation input:', JSON.stringify(req.body, null, 2));
    
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path[0],
        message: detail.message
      }));
      
      console.log('Validation errors:', errors);
      
      return res.status(400).json({
        message: 'Validation failed',
        errors
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
  validate
};