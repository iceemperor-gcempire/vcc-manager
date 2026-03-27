const axios = require('axios');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const getMediaTypeFromFilename = (filename) => {
  const ext = filename.toLowerCase().split('.').pop();
  const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
  const animatedExts = ['gif', 'webp', 'apng'];
  
  if (videoExts.includes(ext)) return 'video';
  if (animatedExts.includes(ext)) return 'animated';
  if (imageExts.includes(ext)) return 'image';
  return 'unknown';
};

const getMimeType = (filename) => {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'apng': 'image/apng',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska'
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

// 히스토리에서 노드 실행 순서 추출
const getNodeExecutionOrder = (history) => {
  // status.messages에서 실행 완료 순서 추출
  if (history.status && history.status.messages) {
    const executionOrder = [];
    for (const message of history.status.messages) {
      // message 형식: ["execution_cached", { nodes: [...] }] 또는 ["executing", { node: "id" }]
      if (Array.isArray(message) && message[0] === 'execution_cached' && message[1]?.nodes) {
        for (const nodeId of message[1].nodes) {
          if (!executionOrder.includes(String(nodeId))) {
            executionOrder.push(String(nodeId));
          }
        }
      } else if (Array.isArray(message) && message[0] === 'executing' && message[1]?.node) {
        const nodeId = String(message[1].node);
        if (!executionOrder.includes(nodeId)) {
          executionOrder.push(nodeId);
        }
      }
    }
    if (executionOrder.length > 0) {
      return executionOrder;
    }
  }
  // fallback: Object.keys 순서 (숫자 키 오름차순)
  return null;
};

// 히스토리 결과 처리 함수
const processHistoryResult = async (serverUrl, history) => {
  const images = [];
  const videos = [];
  console.log(`🔍 Processing history outputs...`);

  if (history.outputs) {
    // 실행 순서 기반으로 출력 노드 순서 결정
    const executionOrder = getNodeExecutionOrder(history);
    const outputNodeIds = Object.keys(history.outputs);

    let orderedNodeIds;
    if (executionOrder) {
      // 실행 순서에서 출력이 있는 노드만 필터링 (실행 순서 유지)
      orderedNodeIds = executionOrder.filter(id => outputNodeIds.includes(id));
      // 실행 순서에 없는 출력 노드가 있으면 뒤에 추가
      for (const id of outputNodeIds) {
        if (!orderedNodeIds.includes(id)) {
          orderedNodeIds.push(id);
        }
      }
      console.log(`📋 Found ${outputNodeIds.length} output nodes (execution order preserved)`);
    } else {
      orderedNodeIds = outputNodeIds;
      console.log(`📋 Found ${outputNodeIds.length} output nodes (default key order)`);
    }

    for (const nodeId of orderedNodeIds) {
      const nodeOutput = history.outputs[nodeId];
      console.log(`🔍 Node ${nodeId} output:`, nodeOutput);
      
      if (nodeOutput.images) {
        console.log(`🖼️ Node ${nodeId} has ${nodeOutput.images.length} images`);
        
        for (const imageInfo of nodeOutput.images) {
          console.log(`⬇️ Downloading media:`, imageInfo);
          
          const mediaUrl = `${serverUrl}/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder || ''}&type=${imageInfo.type || 'output'}`;
          console.log(`🔗 Media URL: ${mediaUrl}`);
          
          const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
          const mediaType = getMediaTypeFromFilename(imageInfo.filename);
          const mimeType = getMimeType(imageInfo.filename);
          
          console.log(`✅ Downloaded ${mediaType}: ${imageInfo.filename}, size: ${mediaResponse.data.byteLength} bytes, mime: ${mimeType}`);
          
          const mediaData = {
            buffer: Buffer.from(mediaResponse.data),
            filename: imageInfo.filename,
            width: imageInfo.width || null,
            height: imageInfo.height || null,
            mediaType,
            mimeType
          };
          
          if (mediaType === 'video') {
            videos.push(mediaData);
          } else {
            images.push(mediaData);
          }
        }
      }
      
      if (nodeOutput.gifs) {
        console.log(`🎬 Node ${nodeId} has ${nodeOutput.gifs.length} gifs/videos`);
        
        for (const gifInfo of nodeOutput.gifs) {
          console.log(`⬇️ Downloading gif/video:`, gifInfo);
          
          const mediaUrl = `${serverUrl}/view?filename=${gifInfo.filename}&subfolder=${gifInfo.subfolder || ''}&type=${gifInfo.type || 'output'}`;
          console.log(`🔗 Media URL: ${mediaUrl}`);
          
          const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
          const mediaType = getMediaTypeFromFilename(gifInfo.filename);
          const mimeType = getMimeType(gifInfo.filename);
          
          console.log(`✅ Downloaded ${mediaType}: ${gifInfo.filename}, size: ${mediaResponse.data.byteLength} bytes, mime: ${mimeType}`);
          
          const mediaData = {
            buffer: Buffer.from(mediaResponse.data),
            filename: gifInfo.filename,
            width: gifInfo.width || null,
            height: gifInfo.height || null,
            mediaType,
            mimeType
          };
          
          if (mediaType === 'video' || mediaType === 'animated') {
            videos.push(mediaData);
          } else {
            images.push(mediaData);
          }
        }
      }
      
      if (!nodeOutput.images && !nodeOutput.gifs) {
        console.log(`ℹ️ Node ${nodeId} has no images or gifs`);
      }
    }
  } else {
    console.warn('⚠️ No outputs in history');
  }
  
  console.log(`🎉 Successfully processed ${images.length} images and ${videos.length} videos`);
  return { images, videos };
};

const submitWorkflow = async (serverUrl, workflowJson, progressCallback) => {
  const clientId = uuidv4();

  console.log(`🔗 ComfyUI Service: Connecting to ${serverUrl}`);
  console.log(`🆔 Client ID: ${clientId}`);

  try {
    // 1. WebSocket을 먼저 연결 (ComfyUI 공식 패턴: connect → prompt 순서)
    //    캐시 히트나 빠른 모델의 경우 POST 직후 완료 메시지가 발생하므로
    //    반드시 WebSocket이 먼저 준비되어야 메시지를 놓치지 않음
    const ws = new WebSocket(`${serverUrl.replace('http', 'ws')}/ws?clientId=${clientId}`);

    // WebSocket 연결 대기
    await new Promise((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      ws.on('open', () => {
        clearTimeout(connectTimeout);
        console.log(`WebSocket connected to ComfyUI`);
        resolve();
      });

      ws.on('error', (error) => {
        clearTimeout(connectTimeout);
        reject(new Error(`WebSocket connection error: ${error.message}`));
      });
    });

    // 2. WebSocket 연결 후 워크플로우 제출
    console.log(`📤 Submitting workflow to ComfyUI...`);
    const promptResponse = await axios.post(`${serverUrl}/prompt`, {
      prompt: workflowJson,
      client_id: clientId
    });

    const promptId = promptResponse.data.prompt_id;
    console.log(`✅ Workflow submitted successfully, Prompt ID: ${promptId}`);
    console.log(`📊 Prompt response:`, promptResponse.data);

    // 3. WebSocket으로 완료 대기
    //    executing { node: null }은 히스토리 저장 후 전송되므로 가장 안전한 완료 신호
    return new Promise((resolve, reject) => {
      let currentProgress = 0;
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Workflow execution timeout'));
      }, 300000); // 5 minutes timeout

      ws.on('message', async (data, isBinary) => {
        // ComfyUI sends binary messages (image previews, etc.) — skip them
        if (isBinary) return;

        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'progress' && message.data.prompt_id === promptId) {
            currentProgress = Math.round((message.data.value / message.data.max) * 100);
            if (progressCallback) {
              progressCallback(currentProgress);
            }
          }

          if (message.type === 'executing' && message.data.prompt_id === promptId && message.data.node === null) {
            clearTimeout(timeout);

            try {
              console.log(`📚 Fetching history for prompt ${promptId}...`);
              const historyResponse = await axios.get(`${serverUrl}/history/${promptId}`);
              const history = historyResponse.data[promptId];

              console.log(`📖 History response:`, history);

              if (!history) {
                console.error('❌ No history found for prompt');
                throw new Error('No history found for prompt');
              }

              const result = await processHistoryResult(serverUrl, history);

              ws.close(1000);
              resolve({ ...result, promptId });
            } catch (error) {
              ws.close();
              reject(error);
            }
          }

          if (message.type === 'execution_error' && message.data.prompt_id === promptId) {
            clearTimeout(timeout);
            ws.close();
            reject(new Error(`ComfyUI execution error: ${message.data.exception_message || 'Unknown error'}`));
          }
        } catch (parseError) {
          console.error('Error parsing WebSocket message:', parseError);
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${error.message}`));
      });

      ws.on('close', (code, reason) => {
        clearTimeout(timeout);
        if (code !== 1000) {
          reject(new Error(`WebSocket closed unexpectedly: ${code} ${reason}`));
        }
      });
    });
  } catch (error) {
    throw new Error(`Failed to submit workflow: ${error.message}`);
  }
};

const getServerInfo = async (serverUrl) => {
  try {
    const response = await axios.get(`${serverUrl}/system_stats`, {
      timeout: 5000
    });
    return {
      available: true,
      stats: response.data
    };
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
};

const getObjectInfo = async (serverUrl) => {
  try {
    const response = await axios.get(`${serverUrl}/object_info`, {
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get object info: ${error.message}`);
  }
};

const validateWorkflow = async (serverUrl, workflowJson) => {
  try {
    const response = await axios.post(`${serverUrl}/prompt`, {
      prompt: workflowJson,
      validate_only: true
    });
    
    return {
      valid: true,
      errors: []
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error.response?.data?.error || error.message]
    };
  }
};

const interruptExecution = async (serverUrl) => {
  try {
    await axios.post(`${serverUrl}/interrupt`);
    return true;
  } catch (error) {
    console.error('Failed to interrupt execution:', error);
    return false;
  }
};

const getQueue = async (serverUrl) => {
  try {
    const response = await axios.get(`${serverUrl}/queue`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get queue: ${error.message}`);
  }
};

const getLoraModels = async (serverUrl) => {
  try {
    const response = await axios.get(`${serverUrl}/object_info/LoraLoader`);
    const loraLoader = response.data?.LoraLoader;
    
    if (loraLoader && loraLoader.input && loraLoader.input.required && loraLoader.input.required.lora_name) {
      const models = loraLoader.input.required.lora_name[0] || [];
      return [...models].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
    
    return [];
  } catch (error) {
    throw new Error(`Failed to get LoRA models: ${error.message}`);
  }
};

const getCheckpointModels = async (serverUrl) => {
  try {
    const response = await axios.get(`${serverUrl}/object_info/CheckpointLoaderSimple`);
    const checkpointLoader = response.data?.CheckpointLoaderSimple;

    if (checkpointLoader && checkpointLoader.input && checkpointLoader.input.required && checkpointLoader.input.required.ckpt_name) {
      const models = checkpointLoader.input.required.ckpt_name[0] || [];
      return [...models].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }

    return [];
  } catch (error) {
    throw new Error(`Failed to get checkpoint models: ${error.message}`);
  }
};

const uploadImage = async (serverUrl, imageBuffer, filename) => {
  const FormData = require('form-data');
  
  try {
    const form = new FormData();
    form.append('image', imageBuffer, {
      filename: filename,
      contentType: 'image/png'
    });
    form.append('overwrite', 'true');
    
    console.log(`📤 Uploading image to ComfyUI: ${filename}`);
    
    const response = await axios.post(`${serverUrl}/upload/image`, form, {
      headers: {
        ...form.getHeaders()
      },
      timeout: 30000
    });
    
    console.log(`✅ Image uploaded successfully:`, response.data);
    
    return {
      success: true,
      name: response.data.name,
      subfolder: response.data.subfolder || '',
      type: response.data.type || 'input'
    };
  } catch (error) {
    console.error(`❌ Failed to upload image to ComfyUI:`, error.message);
    throw new Error(`Failed to upload image to ComfyUI: ${error.message}`);
  }
};

module.exports = {
  submitWorkflow,
  getServerInfo,
  getObjectInfo,
  validateWorkflow,
  interruptExecution,
  getQueue,
  getLoraModels,
  getCheckpointModels,
  uploadImage
};
