import React from 'react';

/**
 * AppContainer 替代组件
 * 简单的应用容器，包裹整个应用
 */
export const AppContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="app-container min-h-screen bg-gray-50">{children}</div>;
};
