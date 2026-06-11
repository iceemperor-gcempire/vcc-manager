import React, { useState, useMemo } from 'react';
import {
  Typography,
  Box,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputBase,
  Paper,
  CircularProgress,
  Alert,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Add,
  Star,
  StarBorder,
  Edit,
  Delete,
  Image as ImageIcon,
  TextSnippet,
  History,
  Search,
  MoreVert,
  GridView,
  ViewList,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { projectAPI } from '../services/api';
import ProjectEditDialog from '../components/common/ProjectEditDialog';
import { MONO } from '../theme';
import { gradientForId } from '../utils/brandGradients';
import { relativeTime } from '../utils/relativeTime';


function TagPill({ tag }) {
  if (!tag?.name) return null;
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', height: 18, px: '7px', borderRadius: 999,
      fontSize: 10.5, fontWeight: 600, color: '#fff', bgcolor: tag.color || '#7c4dff', whiteSpace: 'nowrap',
    }}>
      {tag.name}
    </Box>
  );
}

function StatRow({ project, mono }) {
  const c = project.counts || {};
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontSize: 11, color: 'text.disabled', fontFamily: mono ? MONO : undefined }}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><ImageIcon sx={{ fontSize: 13 }} /> {c.images || 0}</Box>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><TextSnippet sx={{ fontSize: 13 }} /> {c.promptData || 0}</Box>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><History sx={{ fontSize: 13 }} /> {c.jobs || 0}</Box>
    </Box>
  );
}

function ProjectCreateDialog({ open, onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagName, setTagName] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation((data) => projectAPI.create(data), {
    onSuccess: () => {
      queryClient.invalidateQueries('projects');
      toast.success('프로젝트가 생성되었습니다');
      setName(''); setDescription(''); setTagName('');
      onClose();
    },
    onError: (error) => toast.error(error.response?.data?.message || '생성 실패'),
  });

  const handleSubmit = () => {
    if (!name.trim()) return toast.error('프로젝트 이름을 입력해주세요');
    if (!tagName.trim()) return toast.error('태그명을 입력해주세요');
    createMutation.mutate({ name: name.trim(), description: description.trim(), tagName: tagName.trim() });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>새 프로젝트</DialogTitle>
      <DialogContent>
        <TextField autoFocus fullWidth label="프로젝트 이름" value={name} onChange={(e) => setName(e.target.value)}
          required inputProps={{ maxLength: 100 }} sx={{ mt: 2, mb: 2 }} />
        <TextField fullWidth label="설명 (선택)" value={description} onChange={(e) => setDescription(e.target.value)}
          multiline rows={2} inputProps={{ maxLength: 500 }} sx={{ mb: 2 }} />
        <TextField fullWidth label="전용 태그명" value={tagName} onChange={(e) => setTagName(e.target.value)}
          required helperText="프로젝트에 자동 생성될 태그 이름입니다. 기존 태그와 중복되면 안 됩니다." inputProps={{ maxLength: 50 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={createMutation.isLoading}>생성</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── 그리드 카드 ─────────────────────────────────────────────
function ProjectGridCard({ project, isFav, onOpen, onToggleFav, onMenu }) {
  return (
    <Paper variant="outlined" onClick={onOpen}
      sx={{ p: 0, overflow: 'hidden', cursor: 'pointer', transition: 'all 150ms', height: '100%', display: 'flex', flexDirection: 'column',
        '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}>
      {/* cover — 설정된 커버 이미지가 있으면 그걸, 없으면 그라데이션 */}
      <Box sx={{ position: 'relative', height: 120, background: gradientForId(String(project._id)), overflow: 'hidden' }}>
        {project.coverImage?.url && (
          <Box component="img" src={project.coverImage.url} alt="" loading="lazy"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggleFav(project); }}
          sx={{ position: 'absolute', top: 6, left: 6, color: isFav ? 'warning.main' : 'rgba(255,255,255,0.85)',
            bgcolor: 'rgba(0,0,0,0.15)', '&:hover': { bgcolor: 'rgba(0,0,0,0.3)' } }}>
          {isFav ? <Star fontSize="small" /> : <StarBorder fontSize="small" />}
        </IconButton>
        <Box sx={{ position: 'absolute', top: 10, right: 44, width: 30, height: 30, borderRadius: 1.5,
          bgcolor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff',
          fontWeight: 700, fontSize: 14, display: 'grid', placeItems: 'center', backdropFilter: 'blur(8px)' }}>
          {(project.name || '?')[0]}
        </Box>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onMenu(e, project); }}
          sx={{ position: 'absolute', top: 6, right: 6, color: 'rgba(255,255,255,0.85)',
            bgcolor: 'rgba(0,0,0,0.15)', '&:hover': { bgcolor: 'rgba(0,0,0,0.3)' } }}>
          <MoreVert fontSize="small" />
        </IconButton>
      </Box>
      {/* body */}
      <Box sx={{ p: 3.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>{project.name}</Typography>
          <TagPill tag={project.tagId} />
        </Box>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5, textWrap: 'pretty', minHeight: 36,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {project.description || '설명이 없습니다.'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <StatRow project={project} mono />
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 11, color: 'text.disabled', fontFamily: MONO }}>{relativeTime(project.updatedAt)}</Typography>
        </Box>
      </Box>
    </Paper>
  );
}

// ── 목록 행 ─────────────────────────────────────────────────
function ProjectListRow({ project, isFav, onOpen, onToggleFav, onMenu, first }) {
  return (
    <Box onClick={onOpen} sx={{ px: 3.5, py: 3, display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer',
      borderTop: first ? 'none' : '1px solid', borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}>
      <Box sx={{ width: 36, height: 36, borderRadius: 1.5, flex: '0 0 auto', overflow: 'hidden', background: gradientForId(String(project._id)),
        color: '#fff', fontWeight: 700, display: 'grid', placeItems: 'center' }}>
        {project.coverImage?.url
          ? <Box component="img" src={project.coverImage.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (project.name || '?')[0]}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>{project.name}</Typography>
          <TagPill tag={project.tagId} />
          {isFav && <Star sx={{ fontSize: 13, color: 'warning.main' }} />}
        </Box>
        <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 0.25 }} noWrap>{project.description || '설명이 없습니다.'}</Typography>
      </Box>
      <Box sx={{ display: { xs: 'none', sm: 'flex' }, flex: '0 0 auto' }}><StatRow project={project} mono /></Box>
      <Typography sx={{ fontSize: 11, color: 'text.disabled', fontFamily: MONO, flex: '0 0 auto' }}>{relativeTime(project.updatedAt)}</Typography>
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onMenu(e, project); }}><MoreVert fontSize="small" /></IconButton>
    </Box>
  );
}

function ViewToggle({ view, setView }) {
  const item = (v, icon, label) => (
    <Box component="button" onClick={() => setView(v)} sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5, px: '10px', height: 26, borderRadius: 1, border: 0, cursor: 'pointer',
      fontSize: 12, fontWeight: 500, bgcolor: view === v ? 'background.paper' : 'transparent',
      color: view === v ? 'text.primary' : 'text.disabled', boxShadow: view === v ? 1 : 'none' }}>
      {icon} {label}
    </Box>
  );
  return (
    <Box sx={{ display: { xs: 'none', sm: 'inline-flex' }, p: '3px', borderRadius: 1.5, bgcolor: 'grey.100', border: '1px solid', borderColor: 'divider' }}>
      {item('grid', <GridView sx={{ fontSize: 14 }} />, '그리드')}
      {item('list', <ViewList sx={{ fontSize: 14 }} />, '목록')}
    </Box>
  );
}

function ProjectList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [deleteProject, setDeleteProject] = useState(null);
  const [view, setView] = useState('grid');
  const [filter, setFilter] = useState('all'); // all | fav
  const [search, setSearch] = useState('');
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuProject, setMenuProject] = useState(null);

  const { data, isLoading, error } = useQuery('projects', () => projectAPI.getAll());

  const deleteMutation = useMutation((id) => projectAPI.delete(id), {
    onSuccess: () => {
      queryClient.invalidateQueries('projects'); queryClient.invalidateQueries('favoriteProjects');
      toast.success('프로젝트가 삭제되었습니다'); setDeleteProject(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || '삭제 실패'),
  });
  const favoriteMutation = useMutation((id) => projectAPI.toggleFavorite(id), {
    onSuccess: (res) => {
      queryClient.invalidateQueries('projects'); queryClient.invalidateQueries('favoriteProjects');
      toast.success(res.data?.data?.isFavorite ? '즐겨찾기에 추가되었습니다' : '즐겨찾기에서 제거되었습니다');
    },
    onError: (e) => toast.error(e.response?.data?.message || '즐겨찾기 변경 실패'),
  });

  const projects = data?.data?.data?.projects || [];
  const favoriteIds = data?.data?.data?.favoriteIds || [];

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (filter === 'fav' && !favoriteIds.includes(p._id)) return false;
      if (q && !(`${p.name} ${p.tagId?.name || ''} ${p.description || ''}`).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, favoriteIds, filter, search]);

  const openMenu = (e, project) => { setMenuAnchor(e.currentTarget); setMenuProject(project); };
  const closeMenu = () => { setMenuAnchor(null); setMenuProject(null); };

  if (isLoading) return <Box><Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box></Box>;
  if (error) return <Box><Alert severity="error">프로젝트 목록을 불러올 수 없습니다.</Alert></Box>;

  return (
    <Box>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap', mb: 5 }}>
        <Box sx={{ flex: '1 1 360px', minWidth: 0 }}>
          <Typography variant="h1">프로젝트</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ textWrap: 'pretty', mt: 0.5 }}>
            세계관, 캠페인, 실험 모음을 프로젝트 단위로 묶어 관리합니다.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
          <ViewToggle view={view} setView={setView} />
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>새 프로젝트</Button>
        </Box>
      </Box>

      {/* 검색 / 필터 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Paper variant="outlined" sx={{ display: 'flex', alignItems: 'center', px: 1, height: 34, minWidth: { sm: 300 }, flex: { xs: 1, sm: '0 1 auto' } }}>
          <Search fontSize="small" sx={{ color: 'text.disabled', mr: 0.5 }} />
          <InputBase value={search} onChange={(e) => setSearch(e.target.value)} placeholder="프로젝트 이름 · 태그 · 설명 검색" sx={{ flex: 1, fontSize: 13 }} />
        </Paper>
        <Box sx={{ display: 'flex', gap: '4px', p: '3px', bgcolor: 'grey.100', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
          {[{ v: 'all', l: '전체' }, { v: 'fav', l: '즐겨찾기' }].map((f) => (
            <Box key={f.v} component="button" onClick={() => setFilter(f.v)} sx={{
              px: '10px', height: 26, borderRadius: 1, border: 0, cursor: 'pointer', fontSize: 12, fontWeight: 500,
              bgcolor: filter === f.v ? 'background.paper' : 'transparent', color: filter === f.v ? 'text.primary' : 'text.disabled',
              boxShadow: filter === f.v ? 1 : 'none' }}>{f.l}</Box>
          ))}
        </Box>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 12, color: 'text.disabled', fontFamily: MONO }}>{visible.length}개</Typography>
      </Box>

      {projects.length === 0 ? (
        <Box sx={{ p: 5, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>아직 프로젝트가 없습니다</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>첫 프로젝트를 만들어 보세요.</Typography>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={() => setCreateOpen(true)}>새 프로젝트</Button>
        </Box>
      ) : view === 'list' ? (
        <Paper variant="outlined">
          {visible.map((p, i) => (
            <ProjectListRow key={p._id} project={p} isFav={favoriteIds.includes(p._id)} first={i === 0}
              onOpen={() => navigate(`/projects/${p._id}`)} onToggleFav={() => favoriteMutation.mutate(p._id)} onMenu={openMenu} />
          ))}
          {visible.length === 0 && <Box sx={{ p: 4, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">조건에 맞는 프로젝트가 없습니다.</Typography></Box>}
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(280px, 1fr))' }, gap: 3.5 }}>
          {visible.map((p) => (
            <ProjectGridCard key={p._id} project={p} isFav={favoriteIds.includes(p._id)}
              onOpen={() => navigate(`/projects/${p._id}`)} onToggleFav={() => favoriteMutation.mutate(p._id)} onMenu={openMenu} />
          ))}
          {/* 새 프로젝트 만들기 affordance */}
          <Box onClick={() => setCreateOpen(true)} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 1, p: 3, minHeight: 200, border: '1px dashed', borderColor: 'divider', borderRadius: 2, color: 'text.disabled', cursor: 'pointer',
            transition: 'all 120ms', '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'action.hover' } }}>
            <Add />
            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>새 프로젝트 만들기</Typography>
          </Box>
        </Box>
      )}

      {/* 메뉴 */}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
        <MenuItem onClick={() => { favoriteMutation.mutate(menuProject._id); closeMenu(); }}>
          {favoriteIds.includes(menuProject?._id) ? <Star sx={{ mr: 1 }} fontSize="small" /> : <StarBorder sx={{ mr: 1 }} fontSize="small" />}
          {favoriteIds.includes(menuProject?._id) ? '즐겨찾기 해제' : '즐겨찾기'}
        </MenuItem>
        <MenuItem onClick={() => { setEditProject(menuProject); closeMenu(); }}><Edit sx={{ mr: 1 }} fontSize="small" />편집</MenuItem>
        <MenuItem onClick={() => { setDeleteProject(menuProject); closeMenu(); }} sx={{ color: 'error.main' }}><Delete sx={{ mr: 1 }} fontSize="small" />삭제</MenuItem>
      </Menu>

      <ProjectCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ProjectEditDialog open={!!editProject} onClose={() => setEditProject(null)} project={editProject} />

      <Dialog open={!!deleteProject} onClose={() => setDeleteProject(null)}>
        <DialogTitle>프로젝트 삭제</DialogTitle>
        <DialogContent>
          <Typography>"<strong>{deleteProject?.name}</strong>" 프로젝트를 삭제하시겠습니까?</Typography>
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            프로젝트 전용 태그도 함께 삭제되며, 관련 콘텐츠에서 태그가 해제됩니다. (콘텐츠 자체는 삭제되지 않습니다)
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteProject(null)}>취소</Button>
          <Button color="error" variant="contained" onClick={() => deleteMutation.mutate(deleteProject._id)} disabled={deleteMutation.isLoading}>삭제</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ProjectList;
