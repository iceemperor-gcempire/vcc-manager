import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import ServerManagement from '../../components/admin/ServerManagement';

function ServerManagementPage() {
  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          서버 관리
        </Typography>
      </Box>
      <ServerManagement />
    </Container>
  );
}

export default ServerManagementPage;
