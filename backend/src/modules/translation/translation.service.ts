import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
// Nếu bạn dùng đường dẫn generate riêng thì giữ như bạn đang dùng:
import { PrismaClientKnownRequestError } from 'generated/prisma/runtime/library';

@Injectable()
export class TranslationService {
  constructor(private prisma: PrismaService) {}

  /** Chuẩn hoá & whitelist ngôn ngữ đích */
  private normalizeLang(lang: string) {
    const v = (lang || '').trim().toLowerCase();
    const allow = new Set([
      'en',
      'vi',
      'ja',
      'zh',
      'ko',
      'fr',
      'es',
      'de',
      'ru',
      'ar',
    ]);
    if (!allow.has(v)) throw new BadRequestException('Unsupported language');
    return v;
  }

  /** Cho phép bỏ qua check membership trong demo/test */
  private shouldSkipMembershipCheck(userId?: string, conversationId?: string) {
    return (
      process.env.SKIP_MEMBERSHIP_CHECK === 'true' ||
      (conversationId && conversationId.startsWith('test-')) ||
      (userId && (userId.startsWith('demo-') || userId === 'system'))
    );
  }

  /**
   * Dịch 1 message sang ngôn ngữ đích.
   * - Cache DB theo (messageId, targetLanguage)
   * - Demo/test: persist mock (idempotent)
   * - Kiểm quyền xem conversation
   * - Ưu tiên LibreTranslate (source:auto) → fallback MyMemory (cần source cụ thể)
   * - Timeout + quality gate cho TViệt (không dấu thì thử lại Libre)
   */
  async translateMessage(
    messageId: string,
    targetLanguage: string,
    userId: string,
  ) {
    const lang = this.normalizeLang(targetLanguage);

    // 1) Cache
    const existing = await this.prisma.messageTranslation.findUnique({
      where: { messageId_targetLanguage: { messageId, targetLanguage: lang } },
    });
    if (existing) return existing;

    // 2) Demo/test mode: persist mock
    if (messageId.startsWith('test-')) {
      const mockText = "Hello, how are you? I hope you're having a great day!";
      const mockMap: Record<string, string> = {
        vi: 'Xin chào, bạn khỏe không? Tôi hy vọng bạn đang có một ngày tuyệt vời!',
        ja: 'こんにちは、お元気ですか？素晴らしい一日をお過ごしください！',
        es: '¡Hola, cómo estás? ¡Espero que estés teniendo un gran día!',
        fr: "Bonjour, comment allez-vous ? J'espère que vous passez une excellente journée !",
        de: 'Hallo, wie geht es dir? Ich hoffe, du hast einen tollen Tag!',
        ko: '안녕하세요, 어떻게 지내세요? 좋은 하루 보내시길 바랍니다!',
        zh: '你好，你好吗？我希望你今天过得很愉快！',
        en: mockText,
      };
      const translatedText = mockMap[lang] || mockText;

      return this.prisma.messageTranslation.upsert({
        where: {
          messageId_targetLanguage: { messageId, targetLanguage: lang },
        },
        create: { messageId, targetLanguage: lang, translatedText },
        update: { translatedText },
      });
    }

    // 3) Lấy message + kiểm quyền
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { content: true, conversationId: true },
    });
    if (!message?.content) {
      throw new BadRequestException('Message not found or has no content');
    }

    if (!this.shouldSkipMembershipCheck(userId, message.conversationId)) {
      const member = await this.prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: message.conversationId,
            userId,
          },
        },
      });
      if (!member) throw new ForbiddenException('Unauthorized');
    }

    // 4) Gọi provider
    const translatedText = await this.callTranslationAPI(message.content, lang);
    const finalText =
      !translatedText || translatedText.trim() === message.content.trim()
        ? message.content
        : translatedText;

    // 5) Lưu (idempotent + chống race)
    try {
      return await this.prisma.messageTranslation.create({
        data: { messageId, targetLanguage: lang, translatedText: finalText },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        return this.prisma.messageTranslation.findUnique({
          where: {
            messageId_targetLanguage: { messageId, targetLanguage: lang },
          },
        });
      }
      throw e;
    }
  }

  /**
   * Ưu tiên LibreTranslate (source: 'auto'), fallback MyMemory (cần source).
   * Có timeout & “quality gate” cho tiếng Việt (nếu toàn ASCII thì thử lại Libre).
   * Trả về string hoặc null nếu cả hai provider đều fail.
   */
  private async callTranslationAPI(
    text: string,
    targetLang: string,
  ): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const libreBase =
      process.env.LIBRETRANSLATE_URL ?? 'https://libretranslate.de';

    // 1) LibreTranslate trước
    try {
      const r1 = await fetch(`${libreBase}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: 'auto',
          target: targetLang,
          format: 'text',
        }),
        signal: controller.signal,
      });
      if (r1.ok) {
        const d1 = await r1.json();
        const out1 = d1?.translatedText?.toString();
        if (out1 && out1.trim()) {
          clearTimeout(timeout);
          return out1;
        }
      }
    } catch (_) {
      // ignore, thử fallback
    }

    // 2) Fallback MyMemory (cần source)
    let src = await this.detectLanguage(text); // en/ja/vi/zh/...
    if (src === 'zh') src = 'zh-CN'; // MyMemory ưa zh-CN
    const u = new URL('https://api.mymemory.translated.net/get');
    u.searchParams.set('q', text);
    u.searchParams.set('langpair', `${src}|${targetLang}`);
    // Optional: tăng quota miễn phí
    if (process.env.MYMEMORY_EMAIL)
      u.searchParams.set('de', process.env.MYMEMORY_EMAIL);

    try {
      const r2 = await fetch(u.toString(), { signal: controller.signal });
      if (r2.ok) {
        const d2 = await r2.json();
        let out2: string | null =
          d2?.responseData?.translatedText?.toString() ?? null;

        // Gate chất lượng: nếu dịch sang VI mà toàn ASCII → thử lại Libre lần nữa
        const isAscii = out2 ? /^[\x00-\x7F]+$/.test(out2) : false;
        if (targetLang === 'vi' && isAscii) {
          try {
            const r3 = await fetch(`${libreBase}/translate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                q: text,
                source: 'auto',
                target: targetLang,
                format: 'text',
              }),
              signal: controller.signal,
            });
            if (r3.ok) {
              const d3 = await r3.json();
              out2 = d3?.translatedText?.toString() ?? out2;
            }
          } catch {}
        }

        clearTimeout(timeout);
        return out2;
      }
    } catch (e) {
      console.error('[translation] fallback failed:', (e as Error).message);
    } finally {
      clearTimeout(timeout);
    }

    return null;
  }

  /** Lấy các bản dịch đã lưu cho 1 message */
  async getTranslations(messageId: string) {
    return await this.prisma.messageTranslation.findMany({
      where: { messageId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Detect ngôn ngữ (ưu tiên LibreTranslate).
   * Nếu lỗi → trả 'en' để an toàn.
   */
  async detectLanguage(text: string): Promise<string> {
    const endpoint =
      process.env.LIBRETRANSLATE_URL || 'https://libretranslate.de';
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(`${endpoint}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => []);
      clearTimeout(t);
      return data?.[0]?.language || 'en';
    } catch {
      clearTimeout(t);
      return 'en';
    }
  }
}
