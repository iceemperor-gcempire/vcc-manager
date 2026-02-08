import React from 'react';
import {
  Container,
  Typography,
  Box,
  Button
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useQueryClient } from 'react-query';
import { jobAPI } from '../services/api';
import JobHistoryPanel from '../components/common/JobHistoryPanel';

function JobHistory() {
  const queryClient = useQueryClient();

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">작업 히스토리</Typography>
        <Button
          variant="outlined"
          onClick={() => queryClient.invalidateQueries('jobs')}
          startIcon={<Refresh />}
        >
          새로고침
        </Button>
      </Box>

      <JobHistoryPanel
        fetchFn={jobAPI.getMy}
        queryKey="jobs"
        showTags={true}
      />
    </Container>
  );
}

export default JobHistory;
