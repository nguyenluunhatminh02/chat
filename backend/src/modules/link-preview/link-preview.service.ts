import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { request } from 'undici';
import * as dns from 'node:dns/promises';
import * as net from 'node:net';
import * as cheerio from 'cheerio';

const TTL_SEC = 6 * 3600; // cache 6h
const UA = 'ChatAppBot/1.0 (+https://yourdomain.example)';
const MAX_BYTES = 1_000_000; // 1MB

function isPrivate(host: string, addrs: any[]) {
  for (const a of addrs) {
    const ip = a.address as string;
    if (net.isIP(ip) === 4) {
      const n = ip.split('.').map(Number);
      const v4Private =
        n[0] === 10 ||
        (n[0] === 172 && n[1] >= 16 && n[1] <= 31) ||
        (n[0] === 192 && n[1] === 168) ||
        n[0] === 127;
      if (v4Private) return true;
    }
    if (net.isIP(ip) === 6) {
      if (ip.startsWith('fc') || ip.startsWith('fd') || ip === '::1')
        return true;
      if (ip.startsWith('fe80')) return true; // link-local
    }
  }
  return false;
}

function onlyHttpHttps(u: URL) {
  return u.protocol === 'http:' || u.protocol === 'https:';
}

function firstDefined(...xs: (string | undefined)[]) {
  return xs.find((x) => !!x);
}

@Injectable()
export class LinkPreviewService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /** Trả preview; dùng cache (Redis + DB). SSRF-safe bằng DNS allowlist. */
  async fetch(urlStr: string) {
    try {
      const key = `lp:${urlStr}`;
      const cached = await this.cache.get<any>(key);
      if (cached) return cached;

      const url = new URL(urlStr);
      if (!onlyHttpHttps(url)) throw new Error('Invalid scheme');

      // DNS resolve & chặn private IP
      const addrs = await dns.lookup(url.hostname, { all: true });
      if (!addrs.length || isPrivate(url.hostname, addrs))
        throw new Error('Blocked host');

      // Fetch (HEAD->GET), giới hạn bytes
      const res = await request(url.toString(), {
        method: 'GET',
        headers: {
          'user-agent': UA,
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/*;q=0.8,*/*;q=0.7',
        },
      });
      const ctype = res.headers['content-type'] ?? '';
      let preview: any = { url: urlStr };

      if (String(ctype).startsWith('image/')) {
        preview = {
          ...preview,
          mediaType: 'image',
          imageUrl: urlStr,
          title: url.hostname,
        };
      } else if (String(ctype).includes('html')) {
        // đọc có giới hạn
        const reader = res.body;
        let buf = Buffer.alloc(0);
        for await (const chunk of reader) {
          const c = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          buf = Buffer.concat([buf, c]);
          if (buf.length > MAX_BYTES) break;
        }
        const html = buf.toString('utf8');
        const $ = cheerio.load(html);

        const og = (p: string) =>
          $(`meta[property="og:${p}"]`).attr('content') ||
          $(`meta[name="og:${p}"]`).attr('content');
        const tw = (p: string) =>
          $(`meta[name="twitter:${p}"]`).attr('content');
        const titleTag = $('title').first().text()?.trim();

        const siteName = firstDefined(
          og('site_name'),
          $('meta[name="application-name"]').attr('content'),
        );
        const title = firstDefined(
          og('title'),
          tw('title'),
          titleTag as string | undefined,
        );
        const description = firstDefined(
          og('description'),
          tw('description'),
          $('meta[name="description"]').attr('content'),
        );
        let imageUrl = firstDefined(og('image'), tw('image'));
        if (imageUrl && imageUrl.startsWith('/'))
          imageUrl = new URL(imageUrl, url).toString();

        // icon
        let iconUrl =
          $('link[rel="icon"]').attr('href') ||
          $('link[rel="shortcut icon"]').attr('href') ||
          '';
        if (iconUrl) iconUrl = new URL(iconUrl, url).toString();

        preview = {
          url: urlStr,
          siteName: siteName ?? url.hostname,
          title: title ?? url.hostname,
          description: description ?? undefined,
          imageUrl: imageUrl ?? undefined,
          iconUrl: iconUrl || undefined,
          mediaType: og('type') || 'article',
        };
      } else {
        preview = {
          url: urlStr,
          siteName: url.hostname,
          title: url.hostname,
          mediaType: 'file',
        };
      }

      // Lưu DB (upsert), cache Redis
      await this.prisma.linkPreview.upsert({
        where: { url: urlStr },
        update: { ...preview },
        create: { url: urlStr, ...preview },
      });
      await this.cache.set(key, preview, TTL_SEC);
      return preview;
    } catch {
      // fallback DB
      const db = await this.prisma.linkPreview.findUnique({
        where: { url: urlStr },
      });
      if (db) return db;
      return {
        url: urlStr,
        title: new URL(urlStr).hostname,
        mediaType: 'unknown',
      };
    }
  }

  /** Trích URL từ text (đã sanitize) */
  extractUrls(text: string): string[] {
    const re = /\bhttps?:\/\/[^\s<>)\]]+/gi;
    const set = new Set<string>();
    for (const m of text.matchAll(re)) {
      try {
        set.add(new URL(m[0]).toString());
      } catch {
        // Invalid URL, skip
      }
    }
    return [...set].slice(0, 5); // tối đa 5 link / message
  }

  async attachToMessage(messageId: string, urls: string[]) {
    if (!urls.length) return;
    await this.prisma.messageLink.createMany({
      data: urls.map((url) => ({ messageId, url })),
      skipDuplicates: true,
    });
  }

  async previewsForMessage(messageId: string) {
    const links = await this.prisma.messageLink.findMany({
      where: { messageId },
      select: { url: true },
    });
    const out: any[] = [];
    for (const l of links) {
      const url = l.url;
      out.push(await this.fetch(url));
    }
    return out;
  }
}
