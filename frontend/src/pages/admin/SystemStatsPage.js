import React from 'react';
import { Container } from '@mui/material';
import SystemStats from '../../components/admin/SystemStats';

function SystemStatsPage() {
  return (
    <Container maxWidth="xl" sx={{ mb: 8 }}>
      <SystemStats />
    </Container>
  );
}

export default SystemStatsPage;
