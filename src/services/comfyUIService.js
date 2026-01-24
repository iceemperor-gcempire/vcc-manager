const axios = require('axios');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// 히스토리 결과 처리 함수
const processHistoryResult = async (serverUrl, history) => {
  const images = [];
  console.log(`🔍 Processing history outputs...`);
  
  if (history.outputs) {
    console.log(`📋 Found ${Object.keys(history.outputs).length} output nodes`);
    
    for (const nodeId of Object.keys(history.outputs)) {
      const nodeOutput = history.outputs[nodeId];
      console.log(`🔍 Node ${nodeId} output:`, nodeOutput);
      
      if (nodeOutput.images) {
        console.log(`🖼️ Node ${nodeId} has ${nodeOutput.images.length} images`);
        
        for (const imageInfo of nodeOutput.images) {
          console.log(`⬇️ Downloading image:`, imageInfo);
          
          const imageUrl = `${serverUrl}/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder || ''}&type=${imageInfo.type || 'output'}`;
          console.log(`🔗 Image URL: ${imageUrl}`);
          
          const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          
          console.log(`✅ Downloaded image: ${imageInfo.filename}, size: ${imageResponse.data.byteLength} bytes`);
          
          images.push({
            buffer: Buffer.from(imageResponse.data),
            filename: imageInfo.filename,
            width: imageInfo.width || null,
            height: imageInfo.height || null
          });
        }
      } else {
        console.log(`ℹ️ Node ${nodeId} has no images`);
      }
    }
  } else {
    console.warn('⚠️ No outputs in history');
  }
  
  console.log(`🎉 Successfully processed ${images.length} images`);
  return { images };
};

const submitWorkflow = async (serverUrl, workflowJson, progressCallback) => {
  const clientId = uuidv4();
  
  console.log(`🔗 ComfyUI Service: Connecting to ${serverUrl}`);
  console.log(`🆔 Client ID: ${clientId}`);
  
  try {
    console.log(`📤 Submitting workflow to ComfyUI...`);
    const promptResponse = await axios.post(`${serverUrl}/prompt`, {
      prompt: workflowJson,
      client_id: clientId
    });
    
    const promptId = promptResponse.data.prompt_id;
    console.log(`✅ Workflow submitted successfully, Prompt ID: ${promptId}`);
    console.log(`📊 Prompt response:`, promptResponse.data);
    
    // 캐시된 결과 즉시 확인 (ComfyUI가 즉시 응답하는 경우 대비)
    const checkCachedResult = async () => {
      try {
        const historyResponse = await axios.get(`${serverUrl}/history/${promptId}`);
        const history = historyResponse.data[promptId];
        
        if (history && history.outputs) {
          console.log(`🚀 Found cached result for prompt ${promptId}`);
          return await processHistoryResult(serverUrl, history);
        }
        return null;
      } catch (error) {
        // 히스토리가 아직 없으면 null 반환 (정상적인 상황)
        return null;
      }
    };
    
    return new Promise(async (resolve, reject) => {
      // 먼저 캐시된 결과가 있는지 확인
      const cachedResult = await checkCachedResult();
      if (cachedResult) {
        console.log(`⚡ Using cached result for prompt ${promptId}`);
        return resolve(cachedResult);
      }
      
      const ws = new WebSocket(`${serverUrl.replace('http', 'ws')}/ws?clientId=${clientId}`);
      
      let currentProgress = 0;
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Workflow execution timeout'));
      }, 300000); // 5 minutes timeout
      
      ws.on('open', () => {
        console.log(`WebSocket connected to ComfyUI for prompt ${promptId}`);
      });
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'progress') {
            currentProgress = Math.round((message.data.value / message.data.max) * 100);
            if (progressCallback) {
              progressCallback(currentProgress);
            }
          }
          
          if (message.type === 'executing' && message.data.node === null) {
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
              
              ws.close();
              resolve({ ...result, promptId });
            } catch (error) {
              ws.close();
              reject(error);
            }
          }
          
          if (message.type === 'execution_error') {
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

module.exports = {
  submitWorkflow,
  getServerInfo,
  getObjectInfo,
  validateWorkflow,
  interruptExecution,
  getQueue
};