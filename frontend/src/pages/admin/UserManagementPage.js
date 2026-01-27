import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import UserManagement from '../../components/admin/UserManagement';

function UserManagementPage() {
  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          사용자 관리
        </Typography>
      </Box>
      <UserManagement />
    </Container>
  );
}

export default UserManagementPage;
