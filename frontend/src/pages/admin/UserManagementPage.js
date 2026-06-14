import React from 'react';
import { Container } from '@mui/material';
import UserManagement from '../../components/admin/UserManagement';

function UserManagementPage() {
  return (
    <Container maxWidth="xl" sx={{ mb: 8 }}>
      <UserManagement />
    </Container>
  );
}

export default UserManagementPage;
