const Tag = require('../models/Tag');
const User = require('../models/User');

// 세계관 (사전 컨텍스트) 역할 태그 자동 시드 (#396).
// 각 사용자에게 isWorldviewTag=true 인 단일 태그 ("세계관") 가 없으면 생성.
// idempotent — 이미 있으면 skip.
async function ensureWorldviewTag() {
  const users = await User.find({}, { _id: 1 }).lean();
  let created = 0;
  for (const user of users) {
    const existing = await Tag.findOne({ userId: user._id, isWorldviewTag: true });
    if (existing) continue;
    // 같은 이름의 일반 태그가 이미 있다면 그것을 isWorldviewTag 로 승격
    const sameName = await Tag.findOne({ userId: user._id, name: '세계관' });
    if (sameName) {
      sameName.isWorldviewTag = true;
      await sameName.save();
      created += 1;
      continue;
    }
    await Tag.create({
      userId: user._id,
      createdBy: user._id,
      name: '세계관',
      color: '#9c27b0',
      isWorldviewTag: true,
    });
    created += 1;
  }
  if (created > 0) {
    console.log(`[Migration] 세계관 태그 시드: ${created}명 처리`);
  } else {
    console.log('[Migration] 세계관 태그 시드 불필요 (모두 보유)');
  }
}

module.exports = ensureWorldviewTag;
