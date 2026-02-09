import { z } from 'zod';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { apiRequest } from '../utils/apiClient.js';

const DEFAULT_DOWNLOAD_DIR = process.env.VCC_DOWNLOAD_DIR
  ? process.env.VCC_DOWNLOAD_DIR.replace(/^~/, homedir())
  : join(homedir(), 'Downloads', 'vcc');

const VCC_API_URL = process.env.VCC_API_URL || 'http://localhost:3000';

/**
 * Register media-related tools on the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {{ transport?: 'stdio' | 'http' }} options
 */
export function registerMediaTools(server, options = {}) {
  const isHttp = options.transport === 'http';

  // ── download_result ────────────────────────────────────────────────
  server.tool(
    'download_result',
    isHttp
      ? 'Get download URL for a generated image or video. Returns a URL you can open in a browser. Get media IDs from get_job_status results.'
      : 'Download a generated image or video file to local disk. Get media IDs from get_job_status results.',
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

      // ── HTTP mode: return download URL ──────────────────────────────
      if (isHttp) {
        const downloadUrl = mediaType === 'image'
          ? `${VCC_API_URL}/api/images/generated/${mediaId}/download`
          : `${VCC_API_URL}/api/images/videos/${mediaId}/download`;

        const filename = mediaItem.originalName || `${mediaId}.${mediaType === 'image' ? 'png' : 'mp4'}`;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              downloadUrl,
              filename,
              mediaType,
              note: 'Open this URL in a browser to download the file. The URL requires authentication.',
            }, null, 2),
          }],
        };
      }

      // ── stdio mode: download to local disk ──────────────────────────
      const targetDir = downloadDir
        ? downloadDir.replace(/^~/, homedir())
        : DEFAULT_DOWNLOAD_DIR;

      await mkdir(targetDir, { recursive: true });

      const downloadPath = mediaType === 'image'
        ? `/images/generated/${mediaId}/download`
        : `/images/videos/${mediaId}/download`;

      const { buffer } = await apiRequest(downloadPath, {
        method: 'POST',
        responseType: 'buffer',
      });

      const filename = mediaItem.originalName || `${mediaId}.${mediaType === 'image' ? 'png' : 'mp4'}`;
      const filePath = join(targetDir, filename);

      await writeFile(filePath, buffer);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
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
