import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Box,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { useQuery } from 'react-query';
import { imageAPI } from '../../services/api';
import Pagination from './Pagination';

function ImageSelectDialog({ open, onClose, onSelect, title = '이미지 선택' }) {
  const [tab, setTab] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadedPage, setUploadedPage] = useState(1);
  const [generatedPage, setGeneratedPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 12;

  const { data: uploadedData, isLoading: uploadedLoading } = useQuery(
    ['uploadedImages', uploadedPage, limit],
    () => imageAPI.getUploaded({ page: uploadedPage, limit }),
    { enabled: open && tab === 0 }
  );

  const { data: generatedData, isLoading: generatedLoading } = useQuery(
    ['generatedImages', generatedPage, limit],
    () => imageAPI.getGenerated({ page: generatedPage, limit }),
    { enabled: open && tab === 1 }
  );

  const uploadedImages = uploadedData?.data?.images || [];
  const uploadedPagination = uploadedData?.data?.pagination || { total: 0, pages: 1 };
  
  const generatedImages = generatedData?.data?.images || [];
  const generatedPagination = generatedData?.data?.pagination || { total: 0, pages: 1 };

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
    setSelectedImage(null);
  };

  const handleImageClick = (image, imageType) => {
    setSelectedImage({ image, imageType });
  };

  const handleConfirm = () => {
    if (selectedImage) {
      onSelect({
        imageId: selectedImage.image._id,
        imageType: selectedImage.imageType,
        url: selectedImage.image.url
      });
      onClose();
      setSelectedImage(null);
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedImage(null);
  };

  const isLoading = tab === 0 ? uploadedLoading : generatedLoading;
  const images = tab === 0 ? uploadedImages : generatedImages;
  const pagination = tab === 0 ? uploadedPagination : generatedPagination;
  const currentPage = tab === 0 ? uploadedPage : generatedPage;
  const setCurrentPage = tab === 0 ? setUploadedPage : setGeneratedPage;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label="업로드한 이미지" />
          <Tab label="생성한 이미지" />
        </Tabs>

        {isLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : images.length === 0 ? (
          <Alert severity="info">
            {tab === 0 ? '업로드한 이미지가 없습니다.' : '생성한 이미지가 없습니다.'}
          </Alert>
        ) : (
          <>
            <Grid container spacing={2}>
              {images.map((image) => {
                const isSelected = selectedImage?.image._id === image._id;
                return (
                  <Grid item xs={6} sm={4} md={3} key={image._id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: isSelected ? '3px solid' : '1px solid',
                        borderColor: isSelected ? 'primary.main' : 'grey.300',
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: 'primary.light',
                          transform: 'scale(1.02)'
                        }
                      }}
                      onClick={() => handleImageClick(image, tab === 0 ? 'UploadedImage' : 'GeneratedImage')}
                    >
                      <CardMedia
                        component="img"
                        height="120"
                        image={image.url}
                        alt={image.originalName || 'Image'}
                        sx={{ objectFit: 'cover' }}
                      />
                      <CardContent sx={{ p: 1 }}>
                        <Typography variant="caption" noWrap>
                          {image.originalName || new Date(image.createdAt).toLocaleDateString()}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>

            {pagination.pages > 1 && (
              <Box mt={2}>
                <Pagination
                  currentPage={currentPage}
                  totalPages={pagination.pages}
                  totalItems={pagination.total}
                  onPageChange={setCurrentPage}
                />
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>취소</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!selectedImage}
        >
          선택
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ImageSelectDialog;
