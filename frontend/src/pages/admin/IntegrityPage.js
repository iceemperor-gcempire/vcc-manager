import React from 'react';
import { Container } from '@mui/material';
import IntegrityReport from '../../components/admin/IntegrityReport';

function IntegrityPage() {
  return (
    <Container maxWidth="lg" sx={{ mb: 8 }}>
      <IntegrityReport />
    </Container>
  );
}

export default IntegrityPage;
