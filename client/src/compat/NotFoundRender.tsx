import React from 'react';

/**
 * NotFoundRender 替代组件
 */
export const NotFoundRender: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <h1 className="mb-4 text-6xl font-bold text-gray-300">404</h1>
      <p className="mb-6 text-xl text-gray-600">页面不存在</p>
      <a
        href="/"
        className="rounded bg-blue-500 px-6 py-2 text-white hover:bg-blue-600"
      >
        返回首页
      </a>
    </div>
  );
};
