import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Stack,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Autocomplete,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Group as GroupIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { groupAPI, adminAPI } from '../../services/api';

// 그룹 생성/편집 다이얼로그
function GroupFormDialog({ open, onClose, group, onSave }) {
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [isDefault, setIsDefault] = useState(group?.isDefault || false);

  React.useEffect(() => {
    if (open) {
      setName(group?.name || '');
      setDescription(group?.description || '');
      setIsDefault(group?.isDefault || false);
    }
  }, [open, group]);

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('그룹 이름은 필수입니다.');
      return;
    }
    onSave({ name: name.trim(), description: description.trim(), isDefault });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{group ? '그룹 편집' : '새 그룹'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="그룹 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            size="small"
          />
          <TextField
            label="설명"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            size="small"
          />
          <FormControlLabel
            control={
              <Switch
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                disabled={group?.isDefault}
              />
            }
            label={
              <Box>
                <Typography variant="body2">기본 그룹</Typography>
                <Typography variant="caption" color="text.secondary">
                  신규 가입 사용자가 자동으로 추가됩니다. 시스템에 하나만 존재 가능.
                </Typography>
              </Box>
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button onClick={handleSave} variant="contained">저장</Button>
      </DialogActions>
    </Dialog>
  );
}

// 멤버 관리 다이얼로그
function GroupMembersDialog({ open, onClose, group }) {
  const [memberFilter, setMemberFilter] = useState('');
  const queryClient = useQueryClient();

  const { data: usersData, isLoading } = useQuery(
    ['adminUsers'],
    () => adminAPI.getUsers({ limit: 1000 }),
    { enabled: open }
  );

  const users = usersData?.data?.users || [];

  const memberMutation = useMutation(
    ({ userId, action }) => groupAPI.setMember(group._id, userId, action),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['adminUsers']);
        queryClient.invalidateQueries(['groups']);
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || '멤버 변경 실패');
      }
    }
  );

  const isMember = (user) => (user.groupIds || []).some((g) => String(g) === String(group?._id));

  const filteredUsers = users.filter((u) => {
    if (u.isAdmin) return false;  // admin 은 implicit all-access
    if (!memberFilter) return true;
    const q = memberFilter.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.nickname || '').toLowerCase().includes(q);
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        멤버 관리 — {group?.name}
        <Typography variant="caption" display="block" color="text.secondary">
          admin 사용자는 implicit all-access 이므로 표시되지 않습니다.
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <TextField
          placeholder="이메일 / 닉네임 검색"
          fullWidth
          size="small"
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          sx={{ mb: 2 }}
        />
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <List dense>
            {filteredUsers.map((u) => {
              const member = isMember(u);
              return (
                <ListItem key={u._id} divider>
                  <ListItemText
                    primary={u.nickname || u.email}
                    secondary={u.email}
                  />
                  <ListItemSecondaryAction>
                    {member ? (
                      <Button
                        size="small"
                        color="warning"
                        startIcon={<PersonRemoveIcon />}
                        onClick={() => memberMutation.mutate({ userId: u._id, action: 'remove' })}
                        disabled={memberMutation.isLoading}
                      >
                        제거
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        startIcon={<PersonAddIcon />}
                        onClick={() => memberMutation.mutate({ userId: u._id, action: 'add' })}
                        disabled={memberMutation.isLoading}
                      >
                        추가
                      </Button>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
            {filteredUsers.length === 0 && (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                일치하는 사용자가 없습니다.
              </Typography>
            )}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}

function GroupManagementPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const queryClient = useQueryClient();

  const { data: groupsData, isLoading } = useQuery(
    ['groups'],
    () => groupAPI.getAll(),
    { refetchInterval: 30000 }
  );

  const groups = groupsData?.data?.data?.groups || [];

  const createMutation = useMutation(
    (data) => groupAPI.create(data),
    {
      onSuccess: () => {
        toast.success('그룹이 생성되었습니다.');
        queryClient.invalidateQueries(['groups']);
        setFormOpen(false);
        setEditingGroup(null);
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || '그룹 생성 실패');
      }
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => groupAPI.update(id, data),
    {
      onSuccess: () => {
        toast.success('그룹이 수정되었습니다.');
        queryClient.invalidateQueries(['groups']);
        setFormOpen(false);
        setEditingGroup(null);
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || '그룹 수정 실패');
      }
    }
  );

  const deleteMutation = useMutation(
    (id) => groupAPI.delete(id),
    {
      onSuccess: () => {
        toast.success('그룹이 삭제되었습니다.');
        queryClient.invalidateQueries(['groups']);
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || '그룹 삭제 실패');
      }
    }
  );

  const handleNew = () => {
    setEditingGroup(null);
    setFormOpen(true);
  };

  const handleEdit = (group) => {
    setEditingGroup(group);
    setFormOpen(true);
  };

  const handleDelete = (group) => {
    if (group.isDefault) {
      toast.error('기본 그룹은 삭제할 수 없습니다.');
      return;
    }
    if (window.confirm(`"${group.name}" 그룹을 삭제하시겠습니까? 멤버는 해제됩니다.`)) {
      deleteMutation.mutate(group._id);
    }
  };

  const handleManageMembers = (group) => {
    setSelectedGroup(group);
    setMembersOpen(true);
  };

  const handleFormSave = (data) => {
    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5">그룹 관리</Typography>
          <Typography variant="body2" color="text.secondary">
            사용자 그룹을 정의하고, 작업판 단위 접근 권한을 관리합니다. admin 은 implicit all-access 이므로 그룹과 무관합니다.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleNew}>
          새 그룹
        </Button>
      </Stack>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : groups.length === 0 ? (
        <Alert severity="info">그룹이 없습니다. "새 그룹" 으로 생성하세요.</Alert>
      ) : (
        <Stack spacing={2}>
          {groups.map((group) => (
            <Paper key={group._id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                    <GroupIcon color="action" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight="medium">
                      {group.name}
                    </Typography>
                    {group.isDefault && (
                      <Chip label="기본" size="small" color="primary" variant="outlined" />
                    )}
                    <Chip
                      label={`${group.memberCount || 0}명`}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                  {group.description && (
                    <Typography variant="body2" color="text.secondary">
                      {group.description}
                    </Typography>
                  )}
                  {group.permissions && group.permissions.length > 0 && (
                    <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {group.permissions.map((p) => (
                        <Chip key={p} label={p} size="small" variant="outlined" />
                      ))}
                    </Box>
                  )}
                </Box>
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="멤버 관리">
                    <IconButton size="small" onClick={() => handleManageMembers(group)}>
                      <PersonAddIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="편집">
                    <IconButton size="small" onClick={() => handleEdit(group)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={group.isDefault ? '기본 그룹은 삭제할 수 없습니다' : '삭제'}>
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(group)}
                        disabled={group.isDefault}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <GroupFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingGroup(null); }}
        group={editingGroup}
        onSave={handleFormSave}
      />

      <GroupMembersDialog
        open={membersOpen}
        onClose={() => { setMembersOpen(false); setSelectedGroup(null); }}
        group={selectedGroup}
      />
    </Container>
  );
}

export default GroupManagementPage;
