import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import AdminDashboard from '../../components/admin/AdminDashboard';

function AdminDashboardPage() {
  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          관리자 대시보드
        </Typography>
      </Box>
      <AdminDashboard />
    </Container>
  );
}

export default AdminDashboardPage;
