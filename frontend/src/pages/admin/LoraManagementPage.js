import React from 'react';
import MetadataManagementBody from '../../components/admin/MetadataManagementBody';

// LoRA admin 페이지 — 공용 본문 (MetadataManagementBody) 의 얇은 wrapper (#344).
// selectedServerId / servers / nsfwModelFilter 는 부모 (MetadataManagementPage) 에서 공용 헤더와 함께 보유.
function LoraManagementPage({ selectedServerId, servers = [], nsfwModelFilter = true }) {
  const selectedServer = servers.find((s) => s._id === selectedServerId);
  return (
    <MetadataManagementBody
      kind="lora"
      selectedServerId={selectedServerId}
      selectedServer={selectedServer}
      nsfwModelFilter={nsfwModelFilter}
    />
  );
}

export default LoraManagementPage;
