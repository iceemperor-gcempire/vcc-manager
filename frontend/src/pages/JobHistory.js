import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Tabs,
  Tab
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useQueryClient } from 'react-query';
import { jobAPI } from '../services/api';
import JobHistoryPanel from '../components/common/JobHistoryPanel';
import ConversationHistoryPanel from '../components/common/ConversationHistoryPanel';

function JobHistory() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('image');

  const handleRefresh = () => {
    if (tab === 'image') {
      queryClient.invalidateQueries('jobs');
    } else {
      queryClient.invalidateQueries('conversations');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">작업 히스토리</Typography>
        <Button
          variant="outlined"
          onClick={handleRefresh}
          startIcon={<Refresh />}
        >
          새로고침
        </Button>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="이미지" value="image" />
          <Tab label="텍스트" value="text" />
        </Tabs>
      </Box>

      {tab === 'image' && (
        <JobHistoryPanel
          fetchFn={jobAPI.getMy}
          queryKey="jobs"
          showTags={true}
        />
      )}
      {tab === 'text' && <ConversationHistoryPanel />}
    </Container>
  );
}

export default JobHistory;
