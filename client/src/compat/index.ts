/**
 * 平台兼容层 - 替代 @lark-apaas/client-toolkit 的所有功能
 */

// ============ 确认对话框 ============
export async function showConfirm(options: {
  title?: string;
  content?: string;
  confirmText?: string;
  cancelText?: string;
}): Promise<boolean> {
  const message = options.content || options.title || '确定执行此操作吗？';
  return window.confirm(message);
}

// ============ 环境变量 ============
export function getEnv(key: string): string | undefined {
  // 浏览器环境下从 window 或 import.meta.env 获取
  const env = (import.meta as any).env || {};
  return env[key] || (window as any)[key];
}

// ============ 文件存储 ============
export interface DataloomFile {
  url: string;
  name: string;
  size: number;
}

export function getDataloom(): any {
  // 简单的本地文件处理替代
  return {
    upload: async (file: File): Promise<DataloomFile> => {
      // 转为 base64 或 ObjectURL
      const url = URL.createObjectURL(file);
      return { url, name: file.name, size: file.size };
    },
  };
}

export function getDefaultBucketId(): string {
  return 'default-bucket';
}

// ============ 类型定义 ============
export interface UserInfo {
  id: string;
  name?: string;
  avatar?: string;
  studentId?: string;
}

export interface DepartmentInfo {
  id: string;
  name: string;
}

export interface SearchAvatar {
  url?: string;
}

export type AccountType = string;

// ============ 服务工具（空实现） ============
export const services = {
  users: {
    search: async (): Promise<UserInfo[]> => [],
    get: async (): Promise<UserInfo | null> => null,
  },
  departments: {
    list: async (): Promise<DepartmentInfo[]> => [],
  },
  files: {
    upload: async (file: File): Promise<DataloomFile> => {
      const url = URL.createObjectURL(file);
      return { url, name: file.name, size: file.size };
    },
  },
  chats: {
    list: async (): Promise<any[]> => [],
  },
  userProfiles: {
    get: async (): Promise<any> => null,
  },
};
