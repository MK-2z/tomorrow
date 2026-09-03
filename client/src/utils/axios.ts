import axios from 'axios';

/**
 * 后端 API 请求的 axios 实例
 * 替代 @lark-apaas/client-toolkit 中的 axiosForBackend
 */
export const axiosForBackend = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：自动添加认证头
axiosForBackend.interceptors.request.use(
  (config) => {
    try {
      const userStr = localStorage.getItem('quality_eval_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.studentId) config.headers['x-student-id'] = user.studentId;
        if (user.role) config.headers['x-user-role'] = user.role;
        if (user.displayName) config.headers['x-user-name'] = user.displayName;
      }
      const token = localStorage.getItem('quality_eval_token');
      if (token) config.headers['x-auth-token'] = token;
    } catch {
      // ignore
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// 响应拦截器：统一错误处理
axiosForBackend.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API请求失败:', error?.message || error);
    return Promise.reject(error);
  },
);
