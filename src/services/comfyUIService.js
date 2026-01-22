const axios = require('axios');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const submitWorkflow = async (serverUrl, workflowJson, progressCallback) => {
  const clientId = uuidv4();
  
  try {
    const promptResponse = await axios.post(`${serverUrl}/prompt`, {
      prompt: workflowJson,
      client_id: clientId
    });
    
    const promptId = promptResponse.data.prompt_id;
    
    return new Promise((resolve, reject) => {
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
              const historyResponse = await axios.get(`${serverUrl}/history/${promptId}`);
              const history = historyResponse.data[promptId];
              
              if (!history) {
                throw new Error('No history found for prompt');
              }
              
              const images = [];
              if (history.outputs) {
                for (const nodeId of Object.keys(history.outputs)) {
                  const nodeOutput = history.outputs[nodeId];
                  if (nodeOutput.images) {
                    for (const imageInfo of nodeOutput.images) {
                      const imageResponse = await axios.get(
                        `${serverUrl}/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder || ''}&type=${imageInfo.type || 'output'}`,
                        { responseType: 'arraybuffer' }
                      );
                      
                      images.push({
                        buffer: Buffer.from(imageResponse.data),
                        filename: imageInfo.filename,
                        width: imageInfo.width || null,
                        height: imageInfo.height || null
                      });
                    }
                  }
                }
              }
              
              ws.close();
              resolve({ images, promptId });
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