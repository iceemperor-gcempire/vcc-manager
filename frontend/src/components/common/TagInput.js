import React, { useState } from 'react';
import {
  Autocomplete,
  TextField,
  Chip,
  Box,
  CircularProgress
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { tagAPI } from '../../services/api';

function TagInput({ 
  value = [], 
  onChange, 
  label = '태그',
  placeholder = '태그 추가...',
  disabled = false,
  size = 'medium'
}) {
  const [inputValue, setInputValue] = useState('');
  const queryClient = useQueryClient();

  const { data: tagsData, isLoading } = useQuery(
    ['tags', inputValue],
    () => tagAPI.getAll({ search: inputValue, limit: 20 }),
    { 
      enabled: true,
      keepPreviousData: true
    }
  );

  const createTagMutation = useMutation(
    (name) => tagAPI.create({ name }),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('tags');
        const newTag = response.data.tag;
        onChange([...value, newTag]);
      }
    }
  );

  const availableTags = tagsData?.data?.tags || [];

  const handleChange = (event, newValue) => {
    const lastItem = newValue[newValue.length - 1];
    
    if (typeof lastItem === 'string') {
      const existingTag = availableTags.find(
        t => t.name.toLowerCase() === lastItem.toLowerCase()
      );
      
      if (existingTag) {
        if (!value.find(v => v._id === existingTag._id)) {
          onChange([...value.slice(0, -1), existingTag]);
        }
      } else {
        createTagMutation.mutate(lastItem);
      }
    } else {
      onChange(newValue);
    }
  };

  const getOptionLabel = (option) => {
    if (typeof option === 'string') return option;
    return option.name || '';
  };

  const isOptionEqualToValue = (option, val) => {
    if (!option || !val) return false;
    return option._id === val._id;
  };

  return (
    <Autocomplete
      multiple
      freeSolo
      options={availableTags.filter(t => !value.find(v => v._id === t._id))}
      value={value}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={(event, newInputValue) => setInputValue(newInputValue)}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={isOptionEqualToValue}
      disabled={disabled}
      loading={isLoading}
      size={size}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip
            {...getTagProps({ index })}
            key={option._id || index}
            label={option.name}
            size="small"
            sx={{ 
              bgcolor: option.color || '#1976d2',
              color: 'white',
              '& .MuiChip-deleteIcon': {
                color: 'rgba(255,255,255,0.7)',
                '&:hover': { color: 'white' }
              }
            }}
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={value.length === 0 ? placeholder : ''}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {isLoading || createTagMutation.isLoading ? (
                  <CircularProgress color="inherit" size={20} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <Box component="li" {...props}>
          <Chip
            size="small"
            label={option.name}
            sx={{ 
              bgcolor: option.color || '#1976d2',
              color: 'white',
              mr: 1
            }}
          />
          <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
            ({option.usageCount || 0})
          </Box>
        </Box>
      )}
    />
  );
}

export default TagInput;
