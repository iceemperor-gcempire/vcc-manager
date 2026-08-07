const express = require('express');
const router = express.Router();
const PromptGuide = require('../models/PromptGuide');
const Workboard = require('../models/Workboard');
const { requireAdmin, verifyJWT } = require('../middleware/auth');

// 프롬프트 가이드 (#766) — 모델별 프롬프트 작성 가이드를 작업판에 연결한다.
//
// 소유자 개념이 없는 전역 문서다. 작성/수정/삭제는 admin 전용, 조회는 인증 사용자면 가능.
// (작업판 편집기 · 생성 화면의 "가이드 적용됨" 표시가 제목을 필요로 한다. 본문은 목록에서
//  제외하므로 41K 자가 통째로 실려 나가지 않는다.)

// 목록 — 본문 제외 (길이만). ?includeInactive=true 면 비활성 포함 (admin UI 용)
router.get('/', verifyJWT, async (req, res) => {
  try {
    const filter = req.query.includeInactive === 'true' ? {} : { isActive: true };
    const guides = await PromptGuide.find(filter, { content: 0 })
      .sort({ updatedAt: -1 })
      .populate('createdBy', 'nickname email')
      .lean();

    // 본문 길이는 편집기에서 토큰 비용을 가늠하는 데 필요하다 (#766 — 41K 자 ≈ 10~14K 토큰).
    const lengths = await PromptGuide.aggregate([
      { $match: filter },
      { $project: { contentLength: { $strLenCP: { $ifNull: ['$content', ''] } } } },
    ]);
    const lengthById = new Map(lengths.map((l) => [String(l._id), l.contentLength]));

    res.json({
      success: true,
      data: {
        guides: guides.map((g) => ({ ...g, contentLength: lengthById.get(String(g._id)) || 0 })),
      },
    });
  } catch (error) {
    console.error('프롬프트 가이드 목록 오류:', error);
    res.status(500).json({ success: false, message: '가이드 목록을 불러오지 못했습니다.' });
  }
});

// 단건 조회 (본문 포함)
router.get('/:id', verifyJWT, async (req, res) => {
  try {
    const guide = await PromptGuide.findById(req.params.id)
      .populate('createdBy', 'nickname email')
      .lean();
    if (!guide) {
      return res.status(404).json({ success: false, message: '가이드를 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: { guide } });
  } catch (error) {
    console.error('프롬프트 가이드 조회 오류:', error);
    res.status(500).json({ success: false, message: '가이드를 불러오지 못했습니다.' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { title, description, content, targetModel, source } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: '제목과 본문은 필수입니다.' });
    }
    const guide = await PromptGuide.create({
      title,
      description: description || '',
      content,
      targetModel: targetModel || '',
      source: { url: source?.url || '', ref: source?.ref || '' },
      createdBy: req.user.id || req.user._id,
    });
    res.status(201).json({ success: true, data: { guide }, message: '가이드가 생성되었습니다.' });
  } catch (error) {
    console.error('프롬프트 가이드 생성 오류:', error);
    res.status(500).json({ success: false, message: '가이드 생성에 실패했습니다.' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const guide = await PromptGuide.findById(req.params.id);
    if (!guide) {
      return res.status(404).json({ success: false, message: '가이드를 찾을 수 없습니다.' });
    }
    const { title, description, content, targetModel, source, isActive } = req.body;
    if (title !== undefined) guide.title = title;
    if (description !== undefined) guide.description = description;
    if (content !== undefined) guide.content = content;
    if (targetModel !== undefined) guide.targetModel = targetModel;
    if (source !== undefined) {
      guide.source = { url: source?.url || '', ref: source?.ref || '' };
    }
    if (isActive !== undefined) guide.isActive = !!isActive;
    await guide.save();
    res.json({ success: true, data: { guide }, message: '가이드가 수정되었습니다.' });
  } catch (error) {
    console.error('프롬프트 가이드 수정 오류:', error);
    res.status(500).json({ success: false, message: '가이드 수정에 실패했습니다.' });
  }
});

// 삭제 — 연결된 작업판이 있으면 차단한다.
// 그룹 삭제가 Workboard.allowedGroupIds 를 방치해 유령 권한을 만든 사고(#740)의 재발 방지.
// 여기서는 참조를 조용히 $pull 하지 않고 막는다 — 가이드가 빠지면 LLM 출력 품질이
// 조용히 달라지므로, admin 이 어느 작업판이 영향받는지 보고 판단해야 한다.
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const guide = await PromptGuide.findById(req.params.id);
    if (!guide) {
      return res.status(404).json({ success: false, message: '가이드를 찾을 수 없습니다.' });
    }
    const linked = await Workboard.find({ promptGuideIds: guide._id }, { name: 1 }).lean();
    if (linked.length > 0) {
      return res.status(400).json({
        success: false,
        message: `작업판 ${linked.length}개가 이 가이드를 사용 중입니다. 연결을 먼저 해제하세요.`,
        data: { linkedWorkboards: linked.map((w) => ({ _id: w._id, name: w.name })) },
      });
    }
    await PromptGuide.findByIdAndDelete(guide._id);
    res.json({ success: true, message: '가이드가 삭제되었습니다.' });
  } catch (error) {
    console.error('프롬프트 가이드 삭제 오류:', error);
    res.status(500).json({ success: false, message: '가이드 삭제에 실패했습니다.' });
  }
});

module.exports = router;
