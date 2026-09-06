import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { logger } from './logger';
import type { QualityEvalRecord, EvalCategory, EvalItem, EvalReason, ProofFile } from '@shared/api.interface';

/**
 * 导出证明材料为ZIP压缩包
 * 文件夹结构：证明材料 > 班级 > 学生姓名 > 一级指标 > 二级指标 > 证明文件
 */
export async function exportProofFilesToZip(
  records: QualityEvalRecord[],
  options?: {
    onlyWithProof?: boolean; // 只导出有证明文件的记录
  },
): Promise<void> {
  const zip = new JSZip();
  const rootFolder = zip.folder('证明材料');
  if (!rootFolder) {
    throw new Error('创建ZIP根目录失败');
  }

  let totalFiles = 0;
  let totalRecords = 0;

  for (const record of records) {
    const hasProof = record.categories.some((cat: EvalCategory) =>
      cat.items.some((item: EvalItem) =>
        item.reasons.some((reason: EvalReason) =>
          reason.proofFiles && reason.proofFiles.length > 0,
        ),
      ),
    );

    if (options?.onlyWithProof && !hasProof) continue;
    if (!hasProof) continue;

    totalRecords++;

    // 班级文件夹
    const className = record.className || '未分班';
    const classFolder = rootFolder.folder(sanitizeFileName(className));
    if (!classFolder) continue;

    // 学生姓名文件夹（格式：姓名_学号）
    const studentFolderName = sanitizeFileName(`${record.studentName || '未命名'}_${record.studentId}`);
    const studentFolder = classFolder.folder(studentFolderName);
    if (!studentFolder) continue;

    // 遍历一级指标
    for (const category of record.categories) {
      const categoryFolder = studentFolder.folder(sanitizeFileName(category.categoryName));
      if (!categoryFolder) continue;

      // 遍历二级指标
      for (const item of category.items) {
        const itemFolder = categoryFolder.folder(sanitizeFileName(item.itemName));
        if (!itemFolder) continue;

        // 遍历评分原因
        for (const reason of item.reasons) {
          if (!reason.proofFiles || reason.proofFiles.length === 0) continue;

          // 遍历证明文件
          for (const proofFile of reason.proofFiles) {
            try {
              const fileBlob = await downloadFile(proofFile.url);
              const fileName = sanitizeFileName(proofFile.name || `file_${proofFile.id}`);
              itemFolder.file(fileName, fileBlob);
              totalFiles++;
            } catch (err) {
              logger.error(`下载证明文件失败: ${proofFile.name} (${proofFile.url})`, err);
              // 跳过失败的文件，继续处理其他文件
            }
          }
        }
      }
    }
  }

  if (totalFiles === 0) {
    throw new Error('没有可导出的证明文件');
  }

  // 生成ZIP并下载
  const content = await zip.generateAsync({ type: 'blob' });
  const timestamp = new Date().toISOString().slice(0, 10);
  saveAs(content, `证明材料_${timestamp}_${totalRecords}人_${totalFiles}文件.zip`);

  logger.log(`证明材料导出完成: ${totalRecords}人, ${totalFiles}个文件`);
}

/**
 * 下载文件为Blob
 */
async function downloadFile(url: string): Promise<Blob> {
  // 如果是相对路径，拼接当前域名
  const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error(`下载失败: ${response.status} ${response.statusText}`);
  }
  return response.blob();
}

/**
 * 清理文件名中的非法字符
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}
