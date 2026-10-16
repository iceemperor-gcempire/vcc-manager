const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const SequenceDoc = require('../models/SequenceDoc');
const Sequence = require('../models/Sequence');

const router = express.Router();

// 작업 절차 문서 (#952). mounted at /api/sequence-docs
// 소유자 없는 문서다. 열람·변경 모두 admin 전용 — 실행자에게는 주입만 되고 본문은 열리지 않는다.

const NOT_FOUND = '문서를 찾을 수 없습니다';
const isId = (v) => /^[a-f0-9]{24}$/i.test(String(v));

// 문서를 참조하는 작업 절차 (컨텍스트·시스템 프롬프트 어느 쪽이든)
function sequencesUsing(docId) {
  return Sequence.find(
    { $or: [{ 'steps.contextDocIds': docId }, { 'steps.systemPromptDocId': docId }] },
    { name: 1 },
  ).lean();
}

function handleError(res, error, message) {
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ success: false, message: error.message });
  }
  console.error(`${message}:`, error);
  return res.status(500).json({ success: false, message });
}

// 목록 — 본문 제외, 길이와 사용처만
router.get('/', requireAdmin, async (req, res) => {
  try {
    const docs = await SequenceDoc.find({}, { content: 0 })
      .sort({ updatedAt: -1 })
      .populate('createdBy', 'nickname email')
      .lean();
    const lengths = await SequenceDoc.aggregate([
      { $project: { contentLength: { $strLenCP: { $ifNull: ['$content', ''] } } } },
    ]);
    const lengthById = new Map(lengths.map((l) => [String(l._id), l.contentLength]));

    // 사용처 — 작업 절차는 운영자 자산이라 수가 적다. 전부 읽어 센다.
    const sequences = await Sequence.find({}, { name: 1, 'steps.contextDocIds': 1, 'steps.systemPromptDocId': 1 }).lean();
    const usedBy = new Map();
    for (const seq of sequences) {
      const ids = new Set((seq.steps || []).flatMap((s) => [...(s.contextDocIds || []), s.systemPromptDocId]
        .filter(Boolean)
        .map(String)));
      for (const id of ids) {
        if (!usedBy.has(id)) usedBy.set(id, []);
        usedBy.get(id).push({ _id: seq._id, name: seq.name });
      }
    }

    res.json({
      success: true,
      data: {
        docs: docs.map((d) => ({
          ...d,
          contentLength: lengthById.get(String(d._id)) || 0,
          usedBy: usedBy.get(String(d._id)) || [],
        })),
      },
    });
  } catch (error) {
    handleError(res, error, '문서 목록을 불러오지 못했습니다');
  }
});

router.get('/:id', requireAdmin, async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: NOT_FOUND });
    const doc = await SequenceDoc.findById(req.params.id).populate('createdBy', 'nickname email').lean();
    if (!doc) return res.status(404).json({ success: false, message: NOT_FOUND });
    const usedBy = await sequencesUsing(doc._id);
    res.json({ success: true, data: { doc: { ...doc, usedBy } } });
  } catch (error) {
    handleError(res, error, '문서를 불러오지 못했습니다');
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { title, description, content } = req.body || {};
    if (typeof title !== 'string' || !title.trim() || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, message: '제목과 본문은 필수입니다' });
    }
    const doc = await SequenceDoc.create({
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      content,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: { doc }, message: '문서가 생성되었습니다' });
  } catch (error) {
    handleError(res, error, '문서 생성에 실패했습니다');
  }
});

// 수정 — 이 문서를 쓰는 모든 작업 절차에 다음 실행부터 반영된다
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: NOT_FOUND });
    const doc = await SequenceDoc.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: NOT_FOUND });
    const { title, description, content } = req.body || {};
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ success: false, message: '제목은 비울 수 없습니다' });
      }
      doc.title = title.trim();
    }
    if (content !== undefined) {
      if (typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ success: false, message: '본문은 비울 수 없습니다' });
      }
      doc.content = content;
    }
    if (typeof description === 'string') doc.description = description.trim();
    await doc.save();
    res.json({ success: true, data: { doc }, message: '문서가 수정되었습니다' });
  } catch (error) {
    handleError(res, error, '문서 수정에 실패했습니다');
  }
});

// 삭제 — 쓰는 작업 절차가 있으면 막는다. 조용히 빼면 LLM 출력이 이유 없이 달라진다 (PromptGuide 와 같은 정책).
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: NOT_FOUND });
    const doc = await SequenceDoc.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: NOT_FOUND });
    const linked = await sequencesUsing(doc._id);
    if (linked.length > 0) {
      return res.status(400).json({
        success: false,
        message: `작업 절차 ${linked.length}개가 이 문서를 사용 중입니다. 단계에서 먼저 빼세요`,
        data: { linkedSequences: linked.map((s) => ({ _id: s._id, name: s.name })) },
      });
    }
    await SequenceDoc.findByIdAndDelete(doc._id);
    res.json({ success: true, message: '문서가 삭제되었습니다' });
  } catch (error) {
    handleError(res, error, '문서 삭제에 실패했습니다');
  }
});

module.exports = router;
