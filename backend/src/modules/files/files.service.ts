import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  S3,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
// ✅ interop: CommonJS import assignment cho sharp
// eslint-disable-next-line @typescript-eslint/no-require-imports
import sharp = require('sharp');
import { fileTypeFromBuffer } from 'file-type';
import { extname } from 'path';
import { PrismaService } from 'src/prisma/prisma.service';

// ==== MIME WHITELIST ====
// Gộp audio + fallback `video/webm` (do MediaRecorder) vào ALLOWED_MIMES
const AUDIO_MIMES = [
  'audio/mpeg', // mp3
  'audio/mp4', // mp4/m4a (Safari)
  'audio/ogg', // ogg/opus
  'audio/wav',
  'audio/webm', // webm/opus
  'audio/aac',
  'audio/x-m4a',
  'audio/3gpp',
  'audio/opus',
  'video/webm', // fallback khi MediaRecorder gắn video/*
];

const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'video/mp4',
  ...AUDIO_MIMES,
];

// robust: hỗ trợ Node Readable, WebStream, Blob
async function streamToBuffer(stream: any): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);

  if (typeof stream.transformToByteArray === 'function') {
    const arr = await stream.transformToByteArray();
    return Buffer.from(arr);
  }
  if (typeof stream.arrayBuffer === 'function') {
    const ab = await stream.arrayBuffer();
    return Buffer.from(ab);
  }
  if (typeof Blob !== 'undefined' && stream instanceof Blob) {
    const ab = await stream.arrayBuffer();
    return Buffer.from(ab);
  }

  const chunks: Buffer[] = [];
  return await new Promise((resolve, reject) => {
    stream.on?.('data', (c: Buffer) => chunks.push(c));
    stream.on?.('end', () => resolve(Buffer.concat(chunks)));
    stream.on?.('error', reject);
  });
}

@Injectable()
export class FilesService {
  private readonly bucket = process.env.R2_BUCKET!;
  private readonly s3 = new S3({
    endpoint: process.env.R2_S3_ENDPOINT,
    region: process.env.R2_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  constructor(private prisma: PrismaService) {}

  private isR2() {
    return (process.env.R2_S3_ENDPOINT || '').includes(
      '.r2.cloudflarestorage.com',
    );
  }

  /** ✅ Presigned PUT (khuyên dùng cho R2) */
  async presignPut(filename: string, mime: string, sizeMax = 25 * 1024 * 1024) {
    if (!ALLOWED_MIMES.includes(mime)) {
      throw new BadRequestException(`Mime không được phép: ${mime}`);
    }

    const fileId = randomUUID();
    const key = `uploads/${fileId}/${filename}`;

    await this.prisma.fileObject.create({
      data: {
        id: fileId,
        bucket: this.bucket,
        key,
        mime,
        status: 'UPLOADING' as any,
      },
    });

    const url = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mime,
      }),
      { expiresIn: 600 },
    );

    return {
      fileId,
      bucket: this.bucket,
      key,
      url,
      expiresIn: 600,
      method: 'PUT' as const,
    };
  }

  /** Presigned POST (S3/MinIO). Nếu là R2 → ném lỗi hướng dẫn dùng PUT. */
  async presign(filename: string, mime: string, sizeMax = 25 * 1024 * 1024) {
    if (this.isR2()) {
      throw new BadRequestException(
        'Cloudflare R2 không hỗ trợ Presigned POST. Dùng /files/presign-put.',
      );
    }
    if (!ALLOWED_MIMES.includes(mime)) {
      throw new BadRequestException(`Mime không được phép: ${mime}`);
    }

    const fileId = randomUUID();
    const key = `uploads/${fileId}/${filename}`;

    await this.prisma.fileObject.create({
      data: {
        id: fileId,
        bucket: this.bucket,
        key,
        mime,
        status: 'UPLOADING' as any,
      },
    });

    const { url, fields } = await createPresignedPost(this.s3, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 0, sizeMax],
        ['eq', '$Content-Type', mime],
      ],
      Fields: { 'Content-Type': mime },
      Expires: 600,
    });

    return {
      fileId,
      bucket: this.bucket,
      key,
      url,
      fields,
      expiresIn: 600,
      method: 'POST' as const,
    };
  }

  /** HEAD + sniff 128KB → mark READY */
  async complete(fileId: string) {
    const f = await this.prisma.fileObject.findUnique({
      where: { id: fileId },
    });
    if (!f) throw new NotFoundException('file not found');

    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: f.bucket, Key: f.key }),
    );
    const size = Number(head.ContentLength ?? 0);

    const part = await this.s3.send(
      new GetObjectCommand({
        Bucket: f.bucket,
        Key: f.key,
        Range: 'bytes=0-131071', // 128KB
      }),
    );
    const buf = await streamToBuffer(part.Body as any);
    const sniff = await fileTypeFromBuffer(buf);

    if (sniff?.mime) {
      if (!ALLOWED_MIMES.includes(sniff.mime)) {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: f.bucket, Key: f.key }),
        );
        throw new BadRequestException(`File type không hợp lệ: ${sniff.mime}`);
      }
      if (f.mime !== sniff.mime) {
        await this.prisma.fileObject.update({
          where: { id: fileId },
          data: { mime: sniff.mime },
        });
      }
    } else {
      if (!ALLOWED_MIMES.includes(f.mime)) {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: f.bucket, Key: f.key }),
        );
        throw new BadRequestException(
          'File không nhận diện được định dạng an toàn',
        );
      }
    }

    return this.prisma.fileObject.update({
      where: { id: fileId },
      data: { status: 'READY' as any, size },
    });
  }

  /** Presigned GET (private) */
  async presignGet(key: string, expiresIn = 600) {
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
    return { url, expiresIn };
  }

  /** Tạo thumbnail cho ảnh (robust) */
  async createThumbnail(fileId: string, maxSize = 512) {
    const f = await this.prisma.fileObject.findUnique({
      where: { id: fileId },
    });
    if (!f) throw new NotFoundException('file not found');
    if (f.status !== 'READY') throw new ConflictException('File chưa READY');

    if (
      !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.mime)
    ) {
      throw new BadRequestException(
        `Chỉ tạo thumbnail cho ảnh, mime hiện tại: ${f.mime}`,
      );
    }

    const obj = await this.s3.send(
      new GetObjectCommand({ Bucket: f.bucket, Key: f.key }),
    );
    const buf = await streamToBuffer(obj.Body as any);

    if (!buf?.length) {
      throw new BadRequestException('Object rỗng hoặc tải thất bại (size=0)');
    }

    // Kiểm PNG signature (tránh 1 số PNG lỗi)
    if (f.mime === 'image/png') {
      const sig = buf.subarray(0, 8).toString('hex');
      const PNG_SIG = '89504e470d0a1a0a';
      if (sig !== PNG_SIG) {
        throw new BadRequestException('PNG hỏng/không hợp lệ (signature sai)');
      }
    }

    let meta: sharp.Metadata | undefined;
    let resized: Buffer;

    try {
      const base = sharp(buf, { failOnError: false }).rotate();
      meta = await base.metadata();
      resized = await base
        .resize({
          width: maxSize,
          height: maxSize,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (e: any) {
      throw new BadRequestException(
        'Không đọc được ảnh nguồn; file có thể bị hỏng hoặc định dạng không hợp lệ',
      );
    }

    const thumbKey = `${f.key}.thumb.jpg`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: f.bucket,
        Key: thumbKey,
        Body: resized,
        ContentType: 'image/jpeg',
      }),
    );

    const width = meta?.width ?? null;
    const height = meta?.height ?? null;

    const updated = await this.prisma.fileObject.update({
      where: { id: fileId },
      data: {
        thumbKey,
        width: width ?? undefined,
        height: height ?? undefined,
      },
    });

    const thumbUrl = await this.presignGet(thumbKey).then((x) => x.url);
    return { ...updated, thumbUrl };
  }

  /** Xoá file (force=1 để xoá cả khi đã attach) */
  async deleteFile(fileId: string, force = false) {
    const f = await this.prisma.fileObject.findUnique({
      where: { id: fileId },
      include: { attachments: { select: { id: true } } },
    });
    if (!f) throw new NotFoundException('file not found');

    if (f.attachments.length > 0 && !force) {
      throw new ConflictException(
        'File đang được gắn vào message, thêm ?force=1 để xoá',
      );
    }

    await this.s3
      .send(new DeleteObjectCommand({ Bucket: f.bucket, Key: f.key }))
      .catch(() => undefined);
    if (f.thumbKey) {
      await this.s3
        .send(new DeleteObjectCommand({ Bucket: f.bucket, Key: f.thumbKey }))
        .catch(() => undefined);
    }

    await this.prisma.fileObject.delete({ where: { id: fileId } });
    return { ok: true, deleted: fileId };
  }

  /** Upload buffer trực tiếp lên R2/S3 */
  async putObjectFromBuffer(params: {
    key: string;
    mime: string;
    buffer: Buffer;
  }) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.mime,
      }),
    );
    return { bucket: this.bucket, key: params.key };
  }

  /** Helper: upload buffer + tạo FileObject READY */
  async createFileFromBuffer(params: {
    buffer: Buffer;
    mime: string;
    size?: number;
    filename?: string;
    keyPrefix?: string;
    allowedMimes?: string[];
  }) {
    const {
      buffer,
      mime,
      size,
      filename,
      keyPrefix = 'uploads',
      allowedMimes,
    } = params;

    if (allowedMimes && !allowedMimes.includes(mime)) {
      throw new BadRequestException(
        `Mime không được phép: ${mime}. Allowed: ${allowedMimes.join(', ')}`,
      );
    }
    // Nếu không truyền allowedMimes riêng: vẫn enforce ALLOWED_MIMES chung
    if (!allowedMimes && !ALLOWED_MIMES.includes(mime)) {
      throw new BadRequestException(`Mime không được phép: ${mime}`);
    }

    const fileId = randomUUID();
    const safeExt = filename ? extname(filename) : '';
    const key = `${keyPrefix}/${new Date().toISOString().slice(0, 10)}/${fileId}${safeExt}`;

    await this.putObjectFromBuffer({ key, mime, buffer });

    return this.prisma.fileObject.create({
      data: {
        id: fileId,
        bucket: this.bucket,
        key,
        mime,
        size: size ?? buffer.length,
        status: 'READY' as any,
      },
    });
  }

  getPublicUrl(key?: string | null): string | undefined {
    if (!key) return undefined;
    const base = process.env.FILES_CDN_BASE_URL?.replace(/\/+$/, '');
    return base ? `${base}/${key.replace(/^\/+/, '')}` : undefined;
  }

  // tuỳ bạn, có thể có helper "serialize" để gắn url vào file object
  attachPublicUrl<T extends { key?: string | null }>(
    file: T,
  ): T & { url?: string } {
    return { ...file, url: this.getPublicUrl(file.key || undefined) };
  }
}
