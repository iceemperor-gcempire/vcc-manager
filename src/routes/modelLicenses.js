const express = require('express');
const router = express.Router();
const ModelLicense = require('../models/ModelLicense');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const {
  COMMERCIAL_USE, MODEL_LICENSE_LIMITS, normalizeLicenseTarget, resolveModelLicense, comparableLicenseTarget,
} = require('../constants/modelLicense');

// 모델 라이선스 (#1073) — 관리자가 등록하고 모델 폴더·파일에 붙인다.
//
// 조회는 로그인한 사용자 누구나 (생성 화면이 고른 모델의 라이선스를 보여 준다), 등록·수정·삭제는 관리자.
// 관리자 계정의 API 용 키로도 된다 — AI 가 서버·작업판을 등록할 때 라이선스도 함께 적을 수 있게 (#1017, #1061).
// 어느 모델에 어느 라이선스가 붙는지는 constants/modelLicense.js 의 resolveModelLicense 한 곳에서만 판정한다.

/**
 * 요청 본문을 검사해 저장할 값으로 바꾼다. partial 이면 온 필드만.
 * @returns {{ value: object, error: string|null }}
 */
function parseBody(body, { partial = false } = {}) {
  const value = {};
  const has = (k) => body[k] !== undefined;
  const LABEL = { name: '이름', url: '원문 링크', note: '메모' };
  const text = (k, required) => {
    if (!has(k)) return required && !partial ? `${LABEL[k]}은(는) 필수입니다.` : null;
    if (typeof body[k] !== 'string') return `${LABEL[k]}은(는) 문자열이어야 합니다.`;
    const v = body[k].trim();
    if (required && !v) return `${LABEL[k]}은(는) 비울 수 없습니다.`;
    if (v.length > MODEL_LICENSE_LIMITS[k]) return `${LABEL[k]}은(는) ${MODEL_LICENSE_LIMITS[k]}자 이내여야 합니다.`;
    value[k] = v;
    return null;
  };
  const err = text('name', true) || text('url', false) || text('note', false);
  if (err) return { value, error: err };
  if (value.url && !/^https?:\/\//i.test(value.url)) return { value, error: '원문 링크는 http:// 또는 https:// 로 시작해야 합니다.' };

  if (has('commercialUse') || !partial) {
    if (!COMMERCIAL_USE.includes(body.commercialUse)) {
      return { value, error: `상업적 이용은 ${COMMERCIAL_USE.join(' / ')} 중 하나여야 합니다.` };
    }
    value.commercialUse = body.commercialUse;
  }

  if (has('targets') || !partial) {
    const raw = body.targets === undefined ? [] : body.targets;
    if (!Array.isArray(raw)) return { value, error: '붙일 폴더·파일(targets)은 배열이어야 합니다.' };
    const seen = new Set();
    const targets = [];
    for (const t of raw) {
      const { match, error } = normalizeLicenseTarget(typeof t === 'string' ? t : t && t.match);
      if (error) return { value, error };
      const key = comparableLicenseTarget(match);
      if (seen.has(key)) continue; // 같은 요청 안의 중복은 하나로
      seen.add(key);
      targets.push({ match });
    }
    if (targets.length > MODEL_LICENSE_LIMITS.targets) {
      return { value, error: `라이선스 하나에 붙일 수 있는 폴더·파일은 ${MODEL_LICENSE_LIMITS.targets}개까지입니다.` };
    }
    value.targets = targets;
  }
  return { value, error: null };
}

// 경로 하나는 라이선스 하나에만 — 다른 라이선스가 이미 쥔 경로를 찾는다
async function findTakenTargets(targets, exceptId) {
  if (!targets || !targets.length) return [];
  const others = await ModelLicense.find(exceptId ? { _id: { $ne: exceptId } } : {}, { name: 1, targets: 1 }).lean();
  const owner = new Map();
  for (const o of others) for (const t of o.targets || []) owner.set(comparableLicenseTarget(t.match), o.name);
  return targets
    .filter((t) => owner.has(comparableLicenseTarget(t.match)))
    .map((t) => ({ target: t.match, license: owner.get(comparableLicenseTarget(t.match)) }));
}

const conflictMessage = (taken) => `이미 다른 라이선스에 붙은 경로가 있습니다: ${taken.map((x) => `${x.target} (${x.license})`).join(', ')}`;

router.get('/', requireAuth, async (req, res) => {
  try {
    const licenses = await ModelLicense.find({}).sort({ name: 1 }).lean();
    res.json({ success: true, data: { licenses } });
  } catch (error) {
    console.error('모델 라이선스 목록 오류:', error);
    res.status(500).json({ success: false, message: '라이선스 목록을 불러오지 못했습니다.' });
  }
});

// 모델 파일 하나의 라이선스 — 생성 화면이 저장된 값(파일 이름)만 알 때 쓴다. 붙은 게 없으면 license: null
router.get('/resolve', requireAuth, async (req, res) => {
  try {
    const { filename } = req.query;
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ success: false, message: 'filename 이 필요합니다.' });
    }
    const licenses = await ModelLicense.find({}).lean();
    res.json({ success: true, data: { license: resolveModelLicense(filename, licenses) } });
  } catch (error) {
    console.error('모델 라이선스 조회 오류:', error);
    res.status(500).json({ success: false, message: '라이선스를 불러오지 못했습니다.' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { value, error } = parseBody(req.body || {});
    if (error) return res.status(400).json({ success: false, message: error });
    const taken = await findTakenTargets(value.targets);
    if (taken.length) return res.status(409).json({ success: false, message: conflictMessage(taken), data: { taken } });
    const license = await ModelLicense.create({ ...value, createdBy: req.user.id || req.user._id });
    res.status(201).json({ success: true, data: { license }, message: '라이선스를 등록했습니다.' });
  } catch (error) {
    console.error('모델 라이선스 등록 오류:', error);
    res.status(500).json({ success: false, message: '라이선스 등록에 실패했습니다.' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const license = await ModelLicense.findById(req.params.id);
    if (!license) return res.status(404).json({ success: false, message: '라이선스를 찾을 수 없습니다.' });
    const { value, error } = parseBody(req.body || {}, { partial: true });
    if (error) return res.status(400).json({ success: false, message: error });
    const taken = await findTakenTargets(value.targets, license._id);
    if (taken.length) return res.status(409).json({ success: false, message: conflictMessage(taken), data: { taken } });
    Object.assign(license, value);
    await license.save();
    res.json({ success: true, data: { license }, message: '라이선스를 수정했습니다.' });
  } catch (error) {
    console.error('모델 라이선스 수정 오류:', error);
    res.status(500).json({ success: false, message: '라이선스 수정에 실패했습니다.' });
  }
});

// 삭제 — 다른 문서가 참조하지 않는다. 붙어 있던 모델은 "라이선스 미등록" 으로 돌아간다
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const license = await ModelLicense.findByIdAndDelete(req.params.id);
    if (!license) return res.status(404).json({ success: false, message: '라이선스를 찾을 수 없습니다.' });
    res.json({ success: true, message: '라이선스를 삭제했습니다.' });
  } catch (error) {
    console.error('모델 라이선스 삭제 오류:', error);
    res.status(500).json({ success: false, message: '라이선스 삭제에 실패했습니다.' });
  }
});

module.exports = router;
