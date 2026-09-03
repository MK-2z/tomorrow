import React from 'react';

/**
 * ErrorRender 替代组件
 * 简单的错误渲染组件
 */
export const ErrorRender: React.FC<{ error?: Error; resetError?: () => void }> = ({ error, resetError }) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded-lg bg-white p-8 text-center shadow-lg">
        <h2 className="mb-4 text-xl font-bold text-red-600">页面出错了</h2>
        {error && <p className="mb-4 text-gray-600">{error.message}</p>}
        {resetError && (
          <button
            onClick={resetError}
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            重试
          </button>
        )}
      </div>
    </div>
  );
};
