import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Chip,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CircularProgress,
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import {
  LocalOffer,
  Image as ImageIcon,
  TextSnippet
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { tagAPI } from '../services/api';
import TagInput from '../components/common/TagInput';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index} style={{ paddingTop: 16 }}>
      {value === index && children}
    </div>
  );
}

function TagSearch() {
  const [selectedTags, setSelectedTags] = useState([]);
  const [tabValue, setTabValue] = useState(0);

  const { data, isLoading, error } = useQuery(
    ['tagSearch', selectedTags.map(t => t._id).join(',')],
    () => tagAPI.search({ tags: selectedTags.map(t => t._id).join(',') }),
    { enabled: selectedTags.length > 0 }
  );

  const results = data?.data?.results || {};
  const generatedImages = results.generatedImages || [];
  const uploadedImages = results.uploadedImages || [];
  const promptData = results.promptData || [];

  const totalResults = generatedImages.length + uploadedImages.length + promptData.length;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <LocalOffer color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4">태그 검색</Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          검색할 태그를 선택하세요
        </Typography>
        <TagInput
          value={selectedTags}
          onChange={setSelectedTags}
          label="태그 선택"
          placeholder="태그를 검색하거나 선택..."
        />
      </Paper>

      {selectedTags.length === 0 ? (
        <Alert severity="info">
          태그를 선택하면 해당 태그가 붙은 이미지, 프롬프트 데이터를 검색합니다.
        </Alert>
      ) : isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">검색 중 오류가 발생했습니다.</Alert>
      ) : totalResults === 0 ? (
        <Alert severity="warning">선택한 태그에 해당하는 항목이 없습니다.</Alert>
      ) : (
        <Paper sx={{ p: 2 }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab 
              icon={<ImageIcon />} 
              label={`생성 이미지 (${generatedImages.length})`} 
              iconPosition="start" 
            />
            <Tab 
              icon={<ImageIcon />} 
              label={`업로드 이미지 (${uploadedImages.length})`} 
              iconPosition="start" 
            />
            <Tab 
              icon={<TextSnippet />} 
              label={`프롬프트 (${promptData.length})`} 
              iconPosition="start" 
            />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            {generatedImages.length === 0 ? (
              <Typography color="textSecondary">결과 없음</Typography>
            ) : (
              <Grid container spacing={2}>
                {generatedImages.map((img) => (
                  <Grid item xs={6} sm={4} md={3} key={img._id}>
                    <Card>
                      <CardMedia
                        component="img"
                        height="150"
                        image={img.url}
                        alt={img.originalName}
                        sx={{ objectFit: 'cover' }}
                      />
                      <CardContent sx={{ p: 1 }}>
                        <Typography variant="caption" noWrap display="block">
                          {img.generationParams?.prompt?.substring(0, 50)}...
                        </Typography>
                        <Box mt={0.5}>
                          {img.tags?.map(tag => (
                            <Chip
                              key={tag._id}
                              size="small"
                              label={tag.name}
                              sx={{ bgcolor: tag.color, color: 'white', mr: 0.5, mb: 0.5, fontSize: '0.7rem' }}
                            />
                          ))}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {uploadedImages.length === 0 ? (
              <Typography color="textSecondary">결과 없음</Typography>
            ) : (
              <Grid container spacing={2}>
                {uploadedImages.map((img) => (
                  <Grid item xs={6} sm={4} md={3} key={img._id}>
                    <Card>
                      <CardMedia
                        component="img"
                        height="150"
                        image={img.url}
                        alt={img.originalName}
                        sx={{ objectFit: 'cover' }}
                      />
                      <CardContent sx={{ p: 1 }}>
                        <Typography variant="caption" noWrap display="block">
                          {img.originalName}
                        </Typography>
                        <Box mt={0.5}>
                          {img.tags?.map(tag => (
                            <Chip
                              key={tag._id}
                              size="small"
                              label={tag.name}
                              sx={{ bgcolor: tag.color, color: 'white', mr: 0.5, mb: 0.5, fontSize: '0.7rem' }}
                            />
                          ))}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            {promptData.length === 0 ? (
              <Typography color="textSecondary">결과 없음</Typography>
            ) : (
              <Grid container spacing={2}>
                {promptData.map((pd) => (
                  <Grid item xs={12} sm={6} key={pd._id}>
                    <Card>
                      <Box sx={{ display: 'flex' }}>
                        {pd.representativeImage?.url ? (
                          <CardMedia
                            component="img"
                            sx={{ width: 100, height: 100, objectFit: 'cover' }}
                            image={pd.representativeImage.url}
                            alt={pd.name}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: 100,
                              height: 100,
                              bgcolor: 'grey.200',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <TextSnippet sx={{ color: 'grey.400', fontSize: 40 }} />
                          </Box>
                        )}
                        <CardContent sx={{ flex: 1, py: 1 }}>
                          <Typography variant="subtitle1" noWrap>{pd.name}</Typography>
                          <Typography variant="body2" color="textSecondary" sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {pd.prompt}
                          </Typography>
                          <Box mt={0.5}>
                            {pd.tags?.map(tag => (
                              <Chip
                                key={tag._id}
                                size="small"
                                label={tag.name}
                                sx={{ bgcolor: tag.color, color: 'white', mr: 0.5, fontSize: '0.7rem' }}
                              />
                            ))}
                          </Box>
                        </CardContent>
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </TabPanel>
        </Paper>
      )}
    </Container>
  );
}

export default TagSearch;
