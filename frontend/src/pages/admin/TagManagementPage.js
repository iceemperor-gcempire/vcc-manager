import React from 'react';
import { Container } from '@mui/material';
import TagManagement from '../../components/admin/TagManagement';

function TagManagementPage() {
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <TagManagement />
    </Container>
  );
}

export default TagManagementPage;
