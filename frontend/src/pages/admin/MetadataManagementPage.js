import React, { useState } from 'react';
import { Container, Box, Typography, Tabs, Tab } from '@mui/material';
import LoraManagementPage from './LoraManagementPage';
import ModelManagementPage from './ModelManagementPage';

// 통합 모델 admin 페이지 (#260 Phase 7).
// LoRA 와 베이스 모델 (체크포인트) 을 단일 메뉴로 통합. 향후 Upscaler / VAE
// 등이 추가되면 탭으로 확장.
function MetadataManagementPage() {
  const [tab, setTab] = useState('checkpoint');

  return (
    <Container maxWidth="xl" sx={{ py: 3, overflow: 'hidden' }}>
      <Typography variant="h5" gutterBottom>
        모델 관리
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value="checkpoint" label="베이스 모델" />
          <Tab value="lora" label="LoRA" />
        </Tabs>
      </Box>

      {tab === 'checkpoint' && <ModelManagementPage />}
      {tab === 'lora' && <LoraManagementPage />}
    </Container>
  );
}

export default MetadataManagementPage;
