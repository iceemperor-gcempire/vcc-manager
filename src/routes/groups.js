const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const User = require('../models/User');
const { requireAdmin, verifyJWT } = require('../middleware/auth');

// 사용자 본인의 소속 그룹 조회 (일반 사용자도 호출 가능 — 자기 그룹만)
router.get('/me', verifyJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('groupIds', 'name description isDefault');
    res.json({
      success: true,
      data: {
        groups: user?.groupIds || [],
        isAdmin: !!user?.isAdmin
      }
    });
  } catch (error) {
    console.error('내 그룹 조회 오류:', error);
    res.status(500).json({ success: false, message: '그룹 조회 실패' });
  }
});

// 그룹 목록 조회 (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const groups = await Group.find({}).sort({ isDefault: -1, name: 1 }).populate('createdBy', 'email nickname');
    // 각 그룹의 사용자 수 (admin 포함, isAdmin: false 만으로 줄이는 건 다음 라운드)
    const groupIds = groups.map((g) => g._id);
    const userCounts = await User.aggregate([
      { $match: { groupIds: { $in: groupIds } } },
      { $unwind: '$groupIds' },
      { $group: { _id: '$groupIds', count: { $sum: 1 } } }
    ]);
    const countMap = new Map(userCounts.map((c) => [String(c._id), c.count]));
    const enriched = groups.map((g) => ({
      ...g.toObject(),
      memberCount: countMap.get(String(g._id)) || 0
    }));
    res.json({ success: true, data: { groups: enriched } });
  } catch (error) {
    console.error('그룹 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: '그룹 목록 조회 실패' });
  }
});

// 그룹 상세 조회 (admin)
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('createdBy', 'email nickname');
    if (!group) {
      return res.status(404).json({ success: false, message: '그룹을 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: { group } });
  } catch (error) {
    console.error('그룹 상세 조회 오류:', error);
    res.status(500).json({ success: false, message: '그룹 조회 실패' });
  }
});

// 그룹 생성 (admin)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, description, permissions, isDefault } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: '그룹 이름은 필수입니다.' });
    }

    const existing = await Group.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: '같은 이름의 그룹이 이미 존재합니다.' });
    }

    const group = new Group({
      name: name.trim(),
      description: description?.trim() || '',
      permissions: Array.isArray(permissions) ? permissions : [],
      isDefault: !!isDefault,
      createdBy: req.user.id
    });

    await group.save();

    res.status(201).json({ success: true, data: { group }, message: '그룹이 생성되었습니다.' });
  } catch (error) {
    console.error('그룹 생성 오류:', error);
    res.status(400).json({ success: false, message: error.message || '그룹 생성 실패' });
  }
});

// 그룹 수정 (admin)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: '그룹을 찾을 수 없습니다.' });
    }

    const { name, description, permissions, isDefault } = req.body;

    if (name !== undefined && name.trim() !== group.name) {
      const dup = await Group.findOne({ name: name.trim(), _id: { $ne: group._id } });
      if (dup) {
        return res.status(400).json({ success: false, message: '같은 이름의 그룹이 이미 존재합니다.' });
      }
      group.name = name.trim();
    }
    if (description !== undefined) group.description = description.trim();
    if (Array.isArray(permissions)) group.permissions = permissions;
    if (isDefault !== undefined) group.isDefault = !!isDefault;

    await group.save();
    res.json({ success: true, data: { group }, message: '그룹이 수정되었습니다.' });
  } catch (error) {
    console.error('그룹 수정 오류:', error);
    res.status(400).json({ success: false, message: error.message || '그룹 수정 실패' });
  }
});

// 그룹 삭제 (admin) — 기본 그룹은 차단
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: '그룹을 찾을 수 없습니다.' });
    }
    if (group.isDefault) {
      return res.status(400).json({
        success: false,
        message: '기본 그룹은 삭제할 수 없습니다. 다른 그룹을 기본으로 지정한 후 다시 시도하세요.'
      });
    }

    // 사용자에게서 이 그룹 제거
    await User.updateMany(
      { groupIds: group._id },
      { $pull: { groupIds: group._id } }
    );

    await Group.findByIdAndDelete(group._id);

    res.json({ success: true, message: '그룹이 삭제되었습니다.' });
  } catch (error) {
    console.error('그룹 삭제 오류:', error);
    res.status(500).json({ success: false, message: '그룹 삭제 실패' });
  }
});

// 사용자에게 그룹 추가 / 제거 (admin)
router.post('/:id/members', requireAdmin, async (req, res) => {
  try {
    const { userId, action = 'add' } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId 가 필요합니다.' });
    }
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: '그룹을 찾을 수 없습니다.' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }
    if (action === 'remove') {
      user.groupIds = user.groupIds.filter((g) => String(g) !== String(group._id));
    } else {
      if (!user.groupIds.some((g) => String(g) === String(group._id))) {
        user.groupIds.push(group._id);
      }
    }
    await user.save();
    res.json({
      success: true,
      message: action === 'remove' ? '사용자가 그룹에서 제거되었습니다.' : '사용자가 그룹에 추가되었습니다.'
    });
  } catch (error) {
    console.error('그룹 멤버 변경 오류:', error);
    res.status(500).json({ success: false, message: '그룹 멤버 변경 실패' });
  }
});

module.exports = router;
