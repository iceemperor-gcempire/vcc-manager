import React, { useState, useEffect } from 'react';
import { Container, Box, Typography, Tabs, Tab } from '@mui/material';
import { useQuery } from 'react-query';
import LoraManagementPage from './LoraManagementPage';
import ModelManagementPage from './ModelManagementPage';
import CivitaiAdminHeader from '../../components/admin/CivitaiAdminHeader';
import { serverAPI, adminAPI } from '../../services/api';

const MODEL_SERVER_TYPES = ['ComfyUI', 'OpenAI', 'OpenAI Compatible', 'Gemini'];
const LORA_SERVER_TYPES = ['ComfyUI'];

const SELECTED_SERVER_KEY = 'vcc.metadataAdmin.selectedServerId';

// 통합 모델 admin 페이지 (#260 Phase 7, #337).
// LoRA 와 베이스 모델 (체크포인트) 을 단일 메뉴로 통합. 향후 Upscaler / VAE
// 등이 추가되면 탭으로 확장.
// 공용 헤더 (서버 선택기 / NSFW 이미지 토글 / Civitai API key) 를 두 탭이 공유 (#337).
function MetadataManagementPage() {
  const [tab, setTab] = useState('checkpoint');
  const [selectedServerId, setSelectedServerId] = useState(() => localStorage.getItem(SELECTED_SERVER_KEY) || '');
  const [nsfwFilter, setNsfwFilter] = useState(true);
  const [nsfwModelFilter, setNsfwModelFilter] = useState(true);
  const [hasCivitaiApiKey, setHasCivitaiApiKey] = useState(false);

  // 전체 서버 목록
  const { data: serversData } = useQuery(
    ['servers', { includeInactive: false }],
    () => serverAPI.getServers({ includeInactive: false })
  );
  const allServers = serversData?.data?.data?.servers || [];

  // 현재 탭에 호환되는 서버 목록
  const eligibleTypes = tab === 'checkpoint' ? MODEL_SERVER_TYPES : LORA_SERVER_TYPES;
  const eligibleServers = allServers.filter((s) => eligibleTypes.includes(s.serverType));

  // 탭 / 서버 목록 변경 시 선택된 서버가 호환되는지 확인. 아니면 첫 호환 서버로 fallback.
  useEffect(() => {
    if (eligibleServers.length === 0) {
      return;
    }
    const currentValid = eligibleServers.find((s) => s._id === selectedServerId);
    if (!currentValid) {
      setSelectedServerId(eligibleServers[0]._id);
    }
  }, [tab, eligibleServers, selectedServerId]);

  // selectedServerId localStorage 영속화
  useEffect(() => {
    if (selectedServerId) localStorage.setItem(SELECTED_SERVER_KEY, selectedServerId);
  }, [selectedServerId]);

  // 글로벌 settings (nsfwFilter / nsfwModelFilter / hasCivitaiApiKey) 로드
  useEffect(() => {
    adminAPI.getLoraSettings()
      .then((response) => {
        if (response.data.success) {
          const data = response.data.data;
          setNsfwFilter(data.nsfwFilter ?? true);
          setNsfwModelFilter(data.nsfwModelFilter ?? data.nsfwLoraFilter ?? true);
          setHasCivitaiApiKey(!!data.hasCivitaiApiKey);
        }
      })
      .catch((err) => console.error('Failed to fetch admin settings:', err));
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: 3, overflow: 'hidden' }}>
      <Typography variant="h5" gutterBottom>
        모델 관리
      </Typography>

      <CivitaiAdminHeader
        selectedServerId={selectedServerId}
        onServerChange={setSelectedServerId}
        eligibleServers={eligibleServers}
        nsfwFilter={nsfwFilter}
        onNsfwFilterChange={setNsfwFilter}
        nsfwModelFilter={nsfwModelFilter}
        onNsfwModelFilterChange={setNsfwModelFilter}
        hasCivitaiApiKey={hasCivitaiApiKey}
        onApiKeySaved={setHasCivitaiApiKey}
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value="checkpoint" label="베이스 모델" />
          <Tab value="lora" label="LoRA" />
        </Tabs>
      </Box>

      {tab === 'checkpoint' && (
        <ModelManagementPage
          selectedServerId={selectedServerId}
          servers={eligibleServers}
          nsfwModelFilter={nsfwModelFilter}
        />
      )}
      {tab === 'lora' && (
        <LoraManagementPage
          selectedServerId={selectedServerId}
          servers={eligibleServers}
          nsfwFilter={nsfwFilter}
          nsfwModelFilter={nsfwModelFilter}
        />
      )}
    </Container>
  );
}

export default MetadataManagementPage;
