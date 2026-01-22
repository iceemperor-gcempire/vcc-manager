import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  TablePagination
} from '@mui/material';
import {
  Search,
  Delete,
  AdminPanelSettings,
  Person,
  Refresh
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { adminAPI } from '../../services/api';

function UserManagement() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery(
    ['adminUsers', { search, page: page + 1, limit: rowsPerPage }],
    () => adminAPI.getUsers({ search, page: page + 1, limit: rowsPerPage }),
    { keepPreviousData: true }
  );

  const deleteMutation = useMutation(
    adminAPI.deleteUser,
    {
      onSuccess: () => {
        toast.success('사용자가 삭제되었습니다');
        queryClient.invalidateQueries('adminUsers');
        setDeleteDialogOpen(false);
      },
      onError: (error) => {
        toast.error('삭제 실패: ' + error.message);
      }
    }
  );

  const users = data?.data?.users || [];
  const pagination = data?.data?.pagination || { total: 0, pages: 0 };

  const handleDeleteClick = (user) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedUser) {
      deleteMutation.mutate(selectedUser._id);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">사용자 관리</Typography>
        <Button
          variant="outlined"
          onClick={() => refetch()}
          startIcon={<Refresh />}
        >
          새로고침
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Box mb={3}>
            <TextField
              fullWidth
              placeholder="이메일 또는 닉네임으로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ maxWidth: 400 }}
            />
          </Box>

          {isLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : users.length === 0 ? (
            <Alert severity="info">
              {search ? '검색 결과가 없습니다.' : '등록된 사용자가 없습니다.'}
            </Alert>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>사용자</TableCell>
                      <TableCell>이메일</TableCell>
                      <TableCell>권한</TableCell>
                      <TableCell>상태</TableCell>
                      <TableCell>가입일</TableCell>
                      <TableCell>마지막 로그인</TableCell>
                      <TableCell align="right">작업</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user._id}>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={2}>
                            <Avatar src={user.avatar} sx={{ width: 40, height: 40 }}>
                              {user.nickname?.charAt(0).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2">
                              {user.nickname}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {user.isAdmin ? (
                            <Chip
                              label="관리자"
                              color="secondary"
                              size="small"
                              icon={<AdminPanelSettings fontSize="small" />}
                            />
                          ) : (
                            <Chip
                              label="일반 사용자"
                              color="default"
                              size="small"
                              icon={<Person fontSize="small" />}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={user.isActive ? '활성' : '비활성'}
                            color={user.isActive ? 'success' : 'default'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            color="error"
                            onClick={() => handleDeleteClick(user)}
                            disabled={user.isAdmin}
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={pagination.total}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="페이지당 행 수:"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>사용자 삭제 확인</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            이 작업은 되돌릴 수 없습니다!
          </Alert>
          <Typography>
            <strong>{selectedUser?.nickname}</strong> 사용자를 삭제하시겠습니까?
          </Typography>
          <Typography variant="body2" color="textSecondary" mt={1}>
            사용자의 모든 데이터(이미지, 작업 히스토리 등)가 함께 삭제됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>취소</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleteMutation.isLoading}
          >
            {deleteMutation.isLoading ? '삭제 중...' : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default UserManagement;