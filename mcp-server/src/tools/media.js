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
  // 오디오 (#805)
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.m4a': 'audio/mp4',
};

// mediaType → 조회 경로 · 응답 키 · 기본 확장자/MIME (#805)
const MEDIA_SPEC = {
  image: { path: (id) => `/images/generated/${id}`, key: 'image', ext: 'png', mime: 'image/png' },
  video: { path: (id) => `/images/videos/${id}`, key: 'video', ext: 'mp4', mime: 'video/mp4' },
  audio: { path: (id) => `/images/audios/${id}`, key: 'audio', ext: 'mp3', mime: 'audio/mpeg' },
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
        ? 'Get a generated image, video or audio via signed URL. Returns a direct-access URL for the media file. Get media IDs from get_job_status results. Response includes responseType field to identify the format.'
        : 'Get a generated image, video or audio. Images are returned as inline base64 data. Videos and audio return metadata with size info. Get media IDs from get_job_status results. Response includes responseType field to identify the format.'
      : 'Download a generated image, video or audio file to local disk. Get media IDs from get_job_status results. Response includes responseType field to identify the format.',
    {
      mediaId: z.string().describe('Media ID (from get_job_status resultImages/resultVideos/resultAudios)'),
      mediaType: z.enum(['image', 'video', 'audio']).describe('Type of media to download'),
      ...(!isHttp ? {
        downloadDir: z.string().optional().describe('Download directory (default: ~/Downloads/vcc or VCC_DOWNLOAD_DIR)'),
      } : {}),
    },
    async ({ mediaId, mediaType, downloadDir }) => {
      // Get media metadata
      const spec = MEDIA_SPEC[mediaType];
      const meta = await apiRequest(spec.path(mediaId));
      const mediaItem = meta[spec.key];

      if (!mediaItem) {
        throw new Error(`${mediaType} not found`);
      }

      const filename = mediaItem.originalName || `${mediaId}.${spec.ext}`;
      const ext = extname(filename).toLowerCase();
      const mimeType = MIME_TYPES[ext] || spec.mime;

      // ── HTTP mode ─────────────────────────────────────────────────
      if (isHttp) {
        const resultMeta = { filename, mediaType, size: mediaItem.size };

        // VCC_BASE_URL_FOR_MCP 설정 시: signed URL 반환 (바이너리 다운로드 불필요)
        // 백엔드 응답 미들웨어가 /uploads/ 경로를 signed URL (/api/files/...?sig=...)로 자동 변환하므로
        // mediaItem.url은 이미 서명된 경로 — VCC_BASE_URL_FOR_MCP를 앞에 붙여 완전한 URL로 반환
        if (vccBaseUrl && mediaItem.url) {
          const signedUrl = `${vccBaseUrl}${mediaItem.url}`;
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ responseType: 'signedUrl', ...resultMeta, signedUrl }, null, 2),
            }],
          };
        }

        // Fallback: VCC_BASE_URL_FOR_MCP 미설정 또는 signed URL 생성 실패
        const downloadPath = `${spec.path(mediaId)}/download`;

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

        // 비디오·오디오: 인라인으로 싣기엔 크므로 메타데이터만 반환 (#805)
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
      const downloadPath = `${spec.path(mediaId)}/download`;

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

  // ── upload_image ──────────────────────────────────────────────────
  server.tool(
    'upload_image',
    'Upload a base64-encoded image to VCC Manager. Returns an imageId that can be used as an image-type field value in generate/continue_job additionalParams.',
    {
      data: z.string().describe('Base64-encoded image data (without data URI prefix)'),
      filename: z.string().optional().describe('Filename (default: upload.png)'),
      mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']).optional()
        .describe('MIME type (default: image/png)'),
    },
    async ({ data, filename, mimeType }) => {
      const mime = mimeType || 'image/png';
      const fname = filename || `upload.${mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png'}`;

      // base64 → Blob → FormData
      const buffer = Buffer.from(data, 'base64');
      const blob = new Blob([buffer], { type: mime });
      const formData = new FormData();
      formData.append('image', blob, fname);

      const result = await apiRequest('/images/upload', {
        method: 'POST',
        formData,
      });

      const img = result.image;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            imageId: img._id,
            filename: img.originalName,
            size: img.size,
            width: img.metadata?.width,
            height: img.metadata?.height,
          }, null, 2),
        }],
      };
    },
  );
}
