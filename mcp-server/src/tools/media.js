import { z } from 'zod';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_DOWNLOAD_DIR = process.env.VCC_DOWNLOAD_DIR
  ? process.env.VCC_DOWNLOAD_DIR.replace(/^~/, homedir())
  : join(homedir(), 'Downloads', 'vcc');

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

/**
 * Register media-related tools on the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {(path: string, options?: object) => Promise<any>} apiRequest
 * @param {{ transport?: 'stdio' | 'http' }} options
 */
export function registerMediaTools(server, apiRequest, options = {}) {
  const isHttp = options.transport === 'http';

  // ── download_result ────────────────────────────────────────────────
  const vccBaseUrl = process.env.VCC_BASE_URL_FOR_MCP;

  server.tool(
    'download_result',
    isHttp
      ? vccBaseUrl
        ? 'Get a generated image or video via signed URL. Returns a direct-access URL for the media file. Get media IDs from get_job_status results. Response includes responseType field to identify the format.'
        : 'Get a generated image or video. Images are returned as inline base64 data. Videos return metadata with size info. Get media IDs from get_job_status results. Response includes responseType field to identify the format.'
      : 'Download a generated image or video file to local disk. Get media IDs from get_job_status results. Response includes responseType field to identify the format.',
    {
      mediaId: z.string().describe('Media ID (from get_job_status resultImages/resultVideos)'),
      mediaType: z.enum(['image', 'video']).describe('Type of media to download'),
      ...(!isHttp ? {
        downloadDir: z.string().optional().describe('Download directory (default: ~/Downloads/vcc or VCC_DOWNLOAD_DIR)'),
      } : {}),
    },
    async ({ mediaId, mediaType, downloadDir }) => {
      // Get media metadata
      const metaPath = mediaType === 'image'
        ? `/images/generated/${mediaId}`
        : `/images/videos/${mediaId}`;
      const meta = await apiRequest(metaPath);
      const mediaItem = mediaType === 'image' ? meta.image : meta.video;

      if (!mediaItem) {
        throw new Error(`${mediaType} not found`);
      }

      const filename = mediaItem.originalName || `${mediaId}.${mediaType === 'image' ? 'png' : 'mp4'}`;
      const ext = extname(filename).toLowerCase();
      const mimeType = MIME_TYPES[ext] || (mediaType === 'image' ? 'image/png' : 'video/mp4');

      // ── HTTP mode ─────────────────────────────────────────────────
      if (isHttp) {
        const resultMeta = { filename, mediaType, size: mediaItem.size };

        // VCC_BASE_URL_FOR_MCP 설정 시: signed URL 우선 반환 (바이너리 다운로드 불필요)
        if (vccBaseUrl && mediaItem.url) {
          try {
            const signResult = await apiRequest('/files/sign', {
              params: { path: mediaItem.url },
            });
            if (signResult.success && signResult.data?.signedUrl) {
              const signedUrl = `${vccBaseUrl}${signResult.data.signedUrl}`;
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({ responseType: 'signedUrl', ...resultMeta, signedUrl }, null, 2),
                }],
              };
            }
          } catch {
            // Signed URL 생성 실패 시 아래 fallback으로 진행
          }
        }

        // Fallback: VCC_BASE_URL_FOR_MCP 미설정 또는 signed URL 생성 실패
        const downloadPath = mediaType === 'image'
          ? `/images/generated/${mediaId}/download`
          : `/images/videos/${mediaId}/download`;

        // 이미지: base64 인라인 반환
        if (mediaType === 'image') {
          const { buffer } = await apiRequest(downloadPath, {
            method: 'POST',
            responseType: 'buffer',
          });
          resultMeta.size = buffer.length;

          return {
            content: [
              {
                type: 'image',
                data: buffer.toString('base64'),
                mimeType,
              },
              {
                type: 'text',
                text: JSON.stringify({ responseType: 'base64', ...resultMeta }, null, 2),
              },
            ],
          };
        }

        // 비디오: 메타데이터만 반환
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              responseType: 'metadata',
              ...resultMeta,
              note: 'VCC_BASE_URL_FOR_MCP가 설정되지 않아 signed URL을 제공할 수 없습니다. VCC Manager 웹 UI에서 다운로드하거나, VCC_BASE_URL_FOR_MCP 환경 변수를 설정해주세요.',
            }, null, 2),
          }],
        };
      }

      // ── stdio mode: download to local disk ──────────────────────────
      const downloadPath = mediaType === 'image'
        ? `/images/generated/${mediaId}/download`
        : `/images/videos/${mediaId}/download`;

      const targetDir = downloadDir
        ? downloadDir.replace(/^~/, homedir())
        : DEFAULT_DOWNLOAD_DIR;

      await mkdir(targetDir, { recursive: true });

      const { buffer } = await apiRequest(downloadPath, {
        method: 'POST',
        responseType: 'buffer',
      });

      const filePath = join(targetDir, filename);
      await writeFile(filePath, buffer);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            responseType: 'file',
            saved: filePath,
            filename,
            size: buffer.length,
            mediaType,
          }, null, 2),
        }],
      };
    },
  );
}
