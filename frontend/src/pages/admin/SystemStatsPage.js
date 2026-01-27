import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import SystemStats from '../../components/admin/SystemStats';

function SystemStatsPage() {
  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          시스템 통계
        </Typography>
      </Box>
      <SystemStats />
    </Container>
  );
}

export default SystemStatsPage;
