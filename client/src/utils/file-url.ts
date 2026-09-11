import { logger } from './logger';

const IMAGE_EXT_REGEX = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const PREVIEW_EXT_REGEX = /\.(png|jpe?g|gif|webp|bmp|svg|pdf)$/i;

/**
 * 判断文件是否为图片（依据文件名 / url 的扩展名）
 */
export function isImageFileByName(nameOrUrl: string): boolean {
  return IMAGE_EXT_REGEX.test(nameOrUrl || '');
}

/**
 * 判断文件是否可在浏览器中直接内联预览（图片、PDF）
 */
export function isPreviewableByName(nameOrUrl: string): boolean {
  return PREVIEW_EXT_REGEX.test(nameOrUrl || '');
}

/**
 * 对文件 URL 做安全编码：
 * - 完整 http(s) 链接保留协议与主机，仅编码路径中的中文 / 特殊字符
 * - 相对路径（如 /uploads/证明.jpg）编码路径段，保留开头的 /
 * - 已经是百分号编码的内容不会被重复编码
 *
 * 解决历史中文磁盘文件名在浏览器 / fetch 下因未编码导致找不到文件的问题。
 */
export function encodeFileUrl(url: string): string {
  if (!url) return url;
  try {
    // 完整 URL：拆出协议+主机，仅编码路径
    if (/^https?:\/\//i.test(url)) {
      const match = url.match(/^(https?:\/\/[^/]+)(.*)$/i);
      if (match) {
        const [, origin, rest] = match;
        return origin + encodePathAndQuery(rest);
      }
    }
    return encodePathAndQuery(url);
  } catch {
    return url;
  }
}

function encodePathAndQuery(pathAndQuery: string): string {
  // 分离 query / hash，分别处理
  const hashIdx = pathAndQuery.indexOf('#');
  const hash = hashIdx >= 0 ? pathAndQuery.slice(hashIdx) : '';
  const noHash = hashIdx >= 0 ? pathAndQuery.slice(0, hashIdx) : pathAndQuery;
  const qIdx = noHash.indexOf('?');
  const pathname = qIdx >= 0 ? noHash.slice(0, qIdx) : noHash;
  const search = qIdx >= 0 ? noHash.slice(qIdx) : '';

  const encodedPath = pathname
    .split('/')
    .map((seg) => {
      // decode 后再 encode，避免对已编码内容二次编码
      try {
        return encodeURIComponent(decodeURIComponent(seg));
      } catch {
        return encodeURIComponent(seg);
      }
    })
    .join('/');

  return encodedPath + search + hash;
}

/**
 * 下载证明文件：以 Blob 方式获取并使用原始中文名保存。
 * 对图片 / PDF 之外的二进制文件（docx/xlsx/zip 等）尤其重要——
 * 直接用 <a> 打开可能被浏览器当文本渲染而乱码，Blob 下载可保证文件原样。
 */
export async function downloadProofFile(url: string, name: string): Promise<void> {
  const fullUrl = /^https?:\/\//i.test(url)
    ? encodeFileUrl(url)
    : `${window.location.origin}${encodeFileUrl(url)}`;

  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error(`下载失败: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = name || '证明文件';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // 释放对象 URL
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/**
 * 统一的证明文件打开行为：
 * - 图片 / PDF：新标签页内联预览
 * - 其他文件：Blob 下载（保证原始文件名、避免乱码）
 */
export async function openProofFile(
  url: string,
  name: string,
): Promise<void> {
  if (isPreviewableByName(name || url)) {
    window.open(encodeFileUrl(url), '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    await downloadProofFile(url, name);
  } catch (err) {
    logger.error(`证明文件打开/下载失败: ${name} (${url})`, err);
    throw err;
  }
}
