import { z } from 'zod';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { apiRequest } from '../utils/apiClient.js';

const DEFAULT_DOWNLOAD_DIR = process.env.VCC_DOWNLOAD_DIR
  ? process.env.VCC_DOWNLOAD_DIR.replace(/^~/, homedir())
  : join(homedir(), 'Downloads', 'vcc');

/**
 * Register media-related tools on the MCP server.
 */
export function registerMediaTools(server) {

  // ── download_result ────────────────────────────────────────────────
  server.tool(
    'download_result',
    'Download a generated image or video file to local disk. Get media IDs from get_job_status results.',
    {
      mediaId: z.string().describe('Media ID (from get_job_status resultImages/resultVideos)'),
      mediaType: z.enum(['image', 'video']).describe('Type of media to download'),
      downloadDir: z.string().optional().describe('Download directory (default: ~/Downloads/vcc or VCC_DOWNLOAD_DIR)'),
    },
    async ({ mediaId, mediaType, downloadDir }) => {
      const targetDir = downloadDir
        ? downloadDir.replace(/^~/, homedir())
        : DEFAULT_DOWNLOAD_DIR;

      // Ensure download directory exists
      await mkdir(targetDir, { recursive: true });

      // Get media metadata first
      const metaPath = mediaType === 'image'
        ? `/images/generated/${mediaId}`
        : `/images/videos/${mediaId}`;
      const meta = await apiRequest(metaPath);
      const mediaItem = mediaType === 'image' ? meta.image : meta.video;

      if (!mediaItem) {
        throw new Error(`${mediaType} not found`);
      }

      // Download the file
      const downloadPath = mediaType === 'image'
        ? `/images/generated/${mediaId}/download`
        : `/images/videos/${mediaId}/download`;

      const { buffer, headers } = await apiRequest(downloadPath, {
        method: 'POST',
        responseType: 'buffer',
      });

      // Determine filename
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
