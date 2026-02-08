import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import { useQuery } from 'react-query';
import { workboardAPI } from '../../services/api';

function WorkboardSelectDialog({ open, onClose, onSelect }) {
  const { data, isLoading } = useQuery(
    ['workboards'],
    () => workboardAPI.getAll({ isActive: true }),
    { enabled: open }
  );

  const workboards = data?.data?.workboards || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>작업판 선택</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : workboards.length === 0 ? (
          <Alert severity="info">사용 가능한 작업판이 없습니다.</Alert>
        ) : (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {workboards.map((workboard) => (
              <Grid item xs={12} key={workboard._id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                  onClick={() => onSelect(workboard)}
                >
                  <CardContent>
                    <Typography variant="subtitle1">{workboard.name}</Typography>
                    {workboard.description && (
                      <Typography variant="body2" color="textSecondary">
                        {workboard.description}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
      </DialogActions>
    </Dialog>
  );
}

export default WorkboardSelectDialog;
