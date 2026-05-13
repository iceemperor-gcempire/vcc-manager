const mongoose = require('mongoose');

// Phase D (#200): 구 ModelCache 모델 (collection: `modelcaches`) 가 ServerModelCache 로
// 대체됨. 구 collection 은 더 이상 참조되지 않으므로 drop.
async function dropLegacyModelCacheCollection() {
  try {
    const collections = await mongoose.connection.db.listCollections({ name: 'modelcaches' }).toArray();
    if (collections.length === 0) {
      console.log('[Migration] modelcaches collection drop 불필요 (대상 없음)');
      return;
    }

    await mongoose.connection.db.dropCollection('modelcaches');
    console.log('[Migration] modelcaches collection drop 완료 (ServerModelCache 로 대체)');
  } catch (error) {
    // collection 이 이미 없으면 no-op
    if (error.codeName === 'NamespaceNotFound') {
      console.log('[Migration] modelcaches collection 없음');
      return;
    }
    console.error('[Migration] modelcaches drop 오류:', error);
  }
}

module.exports = dropLegacyModelCacheCollection;
