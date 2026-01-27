import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  FirstPage,
  LastPage,
  ChevronLeft,
  ChevronRight,
  Input as InputIcon
} from '@mui/icons-material';

/**
 * 재사용 가능한 페이지네이션 컴포넌트
 * 
 * @param {Object} props
 * @param {number} props.currentPage - 현재 페이지 (1부터 시작)
 * @param {number} props.totalPages - 전체 페이지 수
 * @param {number} props.totalItems - 전체 아이템 수 (선택사항)
 * @param {function} props.onPageChange - 페이지 변경 콜백 (page) => void
 * @param {number} props.maxVisible - 표시할 최대 페이지 버튼 수 (기본값: 3)
 * @param {boolean} props.showInfo - 페이지 정보 표시 여부 (기본값: false)
 * @param {boolean} props.showFirstLast - 처음/끝 페이지 버튼 표시 여부 (기본값: true)
 * @param {boolean} props.showGoToPage - 직접 페이지 이동 버튼 표시 여부 (기본값: true)
 * @param {string} props.size - 버튼 크기 ('small' | 'medium' | 'large', 기본값: 'small')
 */
function Pagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  maxVisible = 3,
  showInfo = false,
  showFirstLast = true,
  showGoToPage = true,
  size = 'small'
}) {
  const [goToPageOpen, setGoToPageOpen] = useState(false);
  const [pageInput, setPageInput] = useState('');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // 페이지가 1개 이하면 페이지네이션을 표시하지 않음
  if (totalPages <= 1) {
    return null;
  }

  const handleGoToPageClick = () => {
    setPageInput(currentPage.toString());
    setGoToPageOpen(true);
  };

  const handleGoToPageSubmit = () => {
    const targetPage = parseInt(pageInput, 10);
    if (isNaN(targetPage) || targetPage < 1 || targetPage > totalPages) {
      return;
    }
    onPageChange(targetPage);
    setGoToPageOpen(false);
  };

  const handleGoToPageCancel = () => {
    setGoToPageOpen(false);
    setPageInput('');
  };

  // 스마트 페이지네이션 로직
  const getVisiblePages = () => {
    let startPage, endPage;

    if (totalPages <= maxVisible) {
      startPage = 1;
      endPage = totalPages;
    } else {
      const sidePages = Math.floor(maxVisible / 2);
      
      if (currentPage <= sidePages) {
        startPage = 1;
        endPage = maxVisible;
      } else if (currentPage >= totalPages - sidePages) {
        startPage = totalPages - maxVisible + 1;
        endPage = totalPages;
      } else {
        startPage = currentPage - sidePages;
        endPage = currentPage + sidePages;
      }
    }

    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <Box>
      {/* 페이지 정보 표시 */}
      {showInfo && (
        <Box display="flex" justifyContent="center" mb={2}>
          <Typography variant="body2" color="textSecondary">
            페이지 {currentPage} / {totalPages}
            {totalItems && ` (총 ${totalItems}개)`}
          </Typography>
        </Box>
      )}

      {/* 페이지네이션 버튼들 */}
      <Box display="flex" justifyContent="center" alignItems="center">
        <Box 
          display="flex" 
          gap={1} 
          alignItems="center"
          sx={{ 
            flexWrap: 'wrap', 
            justifyContent: 'center',
            maxWidth: '100%',
            overflow: 'hidden'
          }}
        >
          {/* 처음 페이지 버튼 */}
          {showFirstLast && currentPage > 1 && (
            <IconButton
              onClick={() => onPageChange(1)}
              size={size}
              disabled={currentPage === 1}
              sx={{ 
                border: 1, 
                borderColor: 'grey.300',
                minWidth: 'auto'
              }}
            >
              <FirstPage fontSize="small" />
            </IconButton>
          )}

          {/* 이전 페이지 버튼 */}
          {currentPage > 1 && (
            <IconButton
              onClick={() => onPageChange(currentPage - 1)}
              size={size}
              sx={{ 
                border: 1, 
                borderColor: 'grey.300',
                minWidth: 'auto'
              }}
            >
              <ChevronLeft fontSize="small" />
            </IconButton>
          )}

          {/* 페이지 번호 버튼들 */}
          {visiblePages.map((pageNum) => (
            <Button
              key={pageNum}
              variant={pageNum === currentPage ? "contained" : "outlined"}
              onClick={() => onPageChange(pageNum)}
              size={size}
              sx={{ 
                minWidth: isMobile ? 'auto' : 40,
                px: isMobile ? 1.5 : 2
              }}
            >
              {pageNum}
            </Button>
          ))}

          {/* 다음 페이지 버튼 */}
          {currentPage < totalPages && (
            <IconButton
              onClick={() => onPageChange(currentPage + 1)}
              size={size}
              sx={{ 
                border: 1, 
                borderColor: 'grey.300',
                minWidth: 'auto'
              }}
            >
              <ChevronRight fontSize="small" />
            </IconButton>
          )}

          {/* 마지막 페이지 버튼 */}
          {showFirstLast && currentPage < totalPages && (
            <IconButton
              onClick={() => onPageChange(totalPages)}
              size={size}
              disabled={currentPage === totalPages}
              sx={{ 
                border: 1, 
                borderColor: 'grey.300',
                minWidth: 'auto'
              }}
            >
              <LastPage fontSize="small" />
            </IconButton>
          )}

          {/* 직접 페이지 이동 버튼 */}
          {showGoToPage && totalPages > maxVisible && (
            <IconButton
              onClick={handleGoToPageClick}
              size={size}
              sx={{ 
                border: 1, 
                borderColor: 'primary.main',
                color: 'primary.main',
                minWidth: 'auto',
                ml: 1
              }}
              title="페이지 직접 이동"
            >
              <InputIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* 페이지 직접 이동 다이얼로그 */}
      <Dialog 
        open={goToPageOpen} 
        onClose={handleGoToPageCancel}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>페이지 이동</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            이동할 페이지 번호를 입력하세요 (1 ~ {totalPages})
          </Typography>
          <TextField
            autoFocus
            fullWidth
            type="number"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleGoToPageSubmit();
              }
            }}
            inputProps={{ 
              min: 1, 
              max: totalPages,
              style: { textAlign: 'center' }
            }}
            placeholder={`1 - ${totalPages}`}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleGoToPageCancel}>취소</Button>
          <Button 
            onClick={handleGoToPageSubmit}
            variant="contained"
            disabled={
              !pageInput || 
              isNaN(parseInt(pageInput, 10)) || 
              parseInt(pageInput, 10) < 1 || 
              parseInt(pageInput, 10) > totalPages
            }
          >
            이동
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Pagination;