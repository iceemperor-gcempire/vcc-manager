import React from 'react';
import { Container } from '@mui/material';
import AdminDashboard from '../../components/admin/AdminDashboard';

function AdminDashboardPage() {
  return (
    <Container maxWidth="xl" sx={{ mb: 8 }}>
      <AdminDashboard />
    </Container>
  );
}

export default AdminDashboardPage;
