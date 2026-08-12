/**
 * #758 — 이미지/비디오/오디오 필드의 `{{##필드명_attached##}}` 자동 플레이스홀더 치환.
 * VCC Optional Image 노드/스위치 분기, `_vcc.omitInputsUnless` (#771) 조건의 vcc 쪽 계약을 가드한다.
 * 오디오 필드는 #772 에서 합류.
 */
const { injectInputsIntoWorkflow } = require('../services/queueService');

const workboard = {
  additionalInputFields: [
    { name: 'ref_image', label: '참조 이미지', type: 'image' },
    { name: 'ref_video', label: '참조 비디오', type: 'video' },
    { name: 'ref_audio', label: '참조 오디오', type: 'audio' },
  ],
};

const template = JSON.stringify({
  1: { class_type: 'VCCOptionalImage', inputs: { image: '{{##ref_image##}}', attached: '{{##ref_image_attached##}}' } },
  2: { class_type: 'VHS_LoadVideo', inputs: { video: '{{##ref_video##}}', attached: '{{##ref_video_attached##}}' } },
  3: { class_type: 'LoadAudio', inputs: { audio: '{{##ref_audio##}}', attached: '{{##ref_audio_attached##}}' } },
});

describe('_attached 플래그 치환 (#758)', () => {
  test('첨부 시 1 (number), 파일명 치환과 공존', async () => {
    const { workflowJson } = await injectInputsIntoWorkflow(
      template,
      { additionalParams: { ref_image: [{ imageId: 'x' }], ref_video: [{ videoId: 'y' }], ref_audio: [{ audioId: 'z' }] } },
      workboard,
      { ref_image: 'vcc_img.png', ref_video: 'vcc_vid.mp4', ref_audio: 'vcc_aud.wav' }
    );
    expect(workflowJson[1].inputs.image).toBe('vcc_img.png');
    expect(workflowJson[1].inputs.attached).toBe(1);
    expect(workflowJson[2].inputs.video).toBe('vcc_vid.mp4');
    expect(workflowJson[2].inputs.attached).toBe(1);
    expect(workflowJson[3].inputs.audio).toBe('vcc_aud.wav');
    expect(workflowJson[3].inputs.attached).toBe(1);
  });

  test('미첨부 시 0 (number) — 흰 PNG 주입 여부와 무관', async () => {
    const { workflowJson } = await injectInputsIntoWorkflow(
      template,
      { additionalParams: { ref_image: [], ref_video: [], ref_audio: [] } },
      workboard,
      { ref_image: 'blank_white.png' } // #230 흰 PNG 가 맵에 있어도 attached 는 0
    );
    expect(workflowJson[1].inputs.image).toBe('blank_white.png');
    expect(workflowJson[1].inputs.attached).toBe(0);
    expect(workflowJson[2].inputs.attached).toBe(0);
    // 오디오는 흰 PNG 같은 대체 주입이 없다 — 빈 문자열 + attached 0
    expect(workflowJson[3].inputs.audio).toBe('');
    expect(workflowJson[3].inputs.attached).toBe(0);
  });
});
