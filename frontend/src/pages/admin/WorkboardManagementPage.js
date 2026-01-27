import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import WorkboardManagement from '../../components/admin/WorkboardManagement';

function WorkboardManagementPage() {
  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          작업판 관리
        </Typography>
      </Box>
      <WorkboardManagement />
    </Container>
  );
}

export default WorkboardManagementPage;
