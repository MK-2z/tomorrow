import { SetMetadata } from '@nestjs/common';

export const NEED_LOGIN_KEY = 'needLogin';

/**
 * 简单的登录校验装饰器
 * 实际的登录校验在 controller 方法内部通过 x-student-id 请求头完成
 * 这个装饰器仅用于标记需要登录的接口
 */
export const NeedLogin = () => SetMetadata(NEED_LOGIN_KEY, true);
