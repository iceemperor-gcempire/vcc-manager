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
  server.tool(
    'download_result',
    isHttp
      ? 'Get a generated image or video. Images are returned as inline base64 data. Videos return metadata with size info. Get media IDs from get_job_status results.'
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

      const downloadPath = mediaType === 'image'
        ? `/images/generated/${mediaId}/download`
        : `/images/videos/${mediaId}/download`;

      const filename = mediaItem.originalName || `${mediaId}.${mediaType === 'image' ? 'png' : 'mp4'}`;
      const ext = extname(filename).toLowerCase();
      const mimeType = MIME_TYPES[ext] || (mediaType === 'image' ? 'image/png' : 'video/mp4');

      // ── HTTP mode: fetch via authenticated API and return inline ───
      if (isHttp) {
        const { buffer } = await apiRequest(downloadPath, {
          method: 'POST',
          responseType: 'buffer',
        });

        // Build result metadata
        const resultMeta = { filename, size: buffer.length, mediaType };

        // If VCC_PUBLIC_URL is set, also generate a signed URL for direct browser access
        if (process.env.VCC_PUBLIC_URL && mediaItem.url) {
          try {
            const signResult = await apiRequest('/files/sign', {
              params: { path: mediaItem.url },
            });
            if (signResult.success && signResult.data?.signedUrl) {
              resultMeta.signedUrl = `${process.env.VCC_PUBLIC_URL}${signResult.data.signedUrl}`;
            }
          } catch {
            // Signed URL generation failed — continue without it
          }
        }

        // Images: return as base64 MCP image content
        if (mediaType === 'image') {
          return {
            content: [
              {
                type: 'image',
                data: buffer.toString('base64'),
                mimeType,
              },
              {
                type: 'text',
                text: JSON.stringify(resultMeta, null, 2),
              },
            ],
          };
        }

        // Videos: too large for inline, return metadata with size
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ...resultMeta,
              note: 'Video files are too large to transfer inline. Use the VCC Manager web UI to view/download videos.',
            }, null, 2),
          }],
        };
      }

      // ── stdio mode: download to local disk ──────────────────────────
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
