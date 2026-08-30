jest.mock('../models/GeneratedImage', () => ({ countDocuments: jest.fn().mockResolvedValue(3) }));
jest.mock('../models/GeneratedVideo', () => ({ countDocuments: jest.fn().mockResolvedValue(2) }));
jest.mock('../models/GeneratedAudio', () => ({ countDocuments: jest.fn().mockResolvedValue(4) }));
jest.mock('../models/PromptData', () => ({ countDocuments: jest.fn().mockResolvedValue(5) }));
jest.mock('../models/ImageGenerationJob', () => ({ countDocuments: jest.fn().mockResolvedValue(9) }));

const GeneratedAudio = require('../models/GeneratedAudio');
const PromptData = require('../models/PromptData');
const { buildProjectCounts } = require('../utils/projectCounts');

describe('buildProjectCounts (#838)', () => {
  test('오디오가 집계에 들어가고, images 는 호환용 합계, byType 은 내역', async () => {
    const c = await buildProjectCounts('u1', 't1');
    expect(c.byType).toEqual({ image: 3, video: 2, audio: 4 });
    expect(c.media).toBe(9);
    expect(c.images).toBe(9);           // 이전 의미(이미지+영상)에 오디오가 더해진 호환 필드
    expect(c.promptData).toBe(5);
    expect(c.jobs).toBe(9);
    expect(GeneratedAudio.countDocuments).toHaveBeenCalledWith({ userId: 'u1', tags: 't1' });
    expect(PromptData.countDocuments).toHaveBeenCalledWith({ createdBy: 'u1', tags: 't1' });
  });
});
