import { join } from 'path';
import * as fs from 'fs';

export class WhatsappUtils {
  /**
   * Prepares message options for Baileys, handling media and local paths.
   */
  static async prepareMessageOptions(message: string, mediaUrl?: string, mediaType?: string) {
    const caption = message ? String(message).trim() : '';

    if (mediaUrl && mediaUrl.trim() !== '') {
      let mediaSource: any;
      const cleanUrl = mediaUrl.split('?')[0];

      if (cleanUrl.includes('/uploads/')) {
        const filename = cleanUrl.split('/uploads/')[1];
        const filePath = join(process.cwd(), 'uploads', filename);
        if (fs.existsSync(filePath)) {
          mediaSource = { url: filePath };
        } else {
          mediaSource = { url: mediaUrl };
        }
      } else {
        mediaSource = { url: mediaUrl };
      }

      const type = mediaType || 'image';
      const options: any = {};

      if (type === 'image') options.image = mediaSource;
      else if (type === 'video') options.video = mediaSource;
      else if (type === 'audio') options.audio = mediaSource;
      else if (type === 'document') {
        options.document = mediaSource;
        options.mimetype = 'application/octet-stream';
        options.fileName = caption.slice(0, 30) || 'Document';
      }

      if (caption && type !== 'audio') {
        options.caption = caption;
      }

      return options;
    } else if (caption) {
      return { text: caption };
    }

    return null;
  }

  /**
   * Replaces variables in {{variable}} format from the context.
   */
  static replaceVariables(text: string, context: any): string {
    if (!text || !context) return text || '';
    return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
      const value = context[key.trim()];
      return value !== undefined ? value : match;
    });
  }

  /**
   * Checks if a message matches any of the keywords (exact or fuzzy).
   */
  static matchKeyword(input: string, keywords: string[]): boolean {
    const normalizedInput = input.toLowerCase().trim();
    return keywords.some(keyword => {
      const normalizedKeyword = keyword.toLowerCase().trim();
      // Exact match
      if (normalizedInput === normalizedKeyword) return true;
      // Fuzzy match (contained as a word)
      const regex = new RegExp(`\\b${this.escapeRegExp(normalizedKeyword)}\\b`, 'i');
      return regex.test(normalizedInput);
    });
  }

  private static escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
