import React from 'react';
import { Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { projectAPI } from '../../services/api';

function ProjectTagChip({ tag, size = 'small', ...chipProps }) {
  const navigate = useNavigate();

  if (!tag) return null;

  const isProjectTag = tag.isProjectTag === true;

  const handleClick = async (e) => {
    e.stopPropagation();
    if (!isProjectTag) return;

    try {
      const response = await projectAPI.getByTag(tag._id);
      const projectId = response.data?.data?.projectId;
      if (projectId) {
        navigate(`/projects/${projectId}`);
      }
    } catch (error) {
      console.error('Failed to navigate to project:', error);
    }
  };

  return (
    <Chip
      label={tag.name || tag}
      size={size}
      onClick={isProjectTag ? handleClick : undefined}
      sx={{
        mr: 0.5,
        mb: 0.5,
        bgcolor: tag.color || undefined,
        color: tag.color ? 'white' : undefined,
        cursor: isProjectTag ? 'pointer' : 'default',
        '&:hover': isProjectTag ? { opacity: 0.85 } : {},
        ...chipProps.sx
      }}
      {...chipProps}
    />
  );
}

export default ProjectTagChip;
