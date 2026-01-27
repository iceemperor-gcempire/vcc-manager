import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Tabs,
  Tab,
  Paper
} from '@mui/material';
import AdminDashboard from '../components/admin/AdminDashboard';
import UserManagement from '../components/admin/UserManagement';
import WorkboardManagement from '../components/admin/WorkboardManagement';
import ServerManagement from '../components/admin/ServerManagement';
import SystemStats from '../components/admin/SystemStats';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function AdminPanel() {
  const [tab, setTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        관리자 패널
      </Typography>
      
      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="대시보드" />
          <Tab label="사용자 관리" />
          <Tab label="작업판 관리" />
          <Tab label="서버 관리" />
          <Tab label="시스템 통계" />
        </Tabs>
        
        <TabPanel value={tab} index={0}>
          <AdminDashboard />
        </TabPanel>
        
        <TabPanel value={tab} index={1}>
          <UserManagement />
        </TabPanel>
        
        <TabPanel value={tab} index={2}>
          <WorkboardManagement />
        </TabPanel>
        
        <TabPanel value={tab} index={3}>
          <ServerManagement />
        </TabPanel>
        
        <TabPanel value={tab} index={4}>
          <SystemStats />
        </TabPanel>
      </Paper>
    </Container>
  );
}

export default AdminPanel;