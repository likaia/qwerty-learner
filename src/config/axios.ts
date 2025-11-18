/**
 * 对axios稍作封装
 * 1. 设置请求超时时间
 * 2. 添加请求拦截器，在每个请求的头部添加token
 * 3. 添加响应拦截器，根据服务器返回状态进行相应的结果返回
 */
import authLoginAPI from '@/api/authLoginAPI'
import type { responseDataType } from '@/api/type/WordBookType'
import type { pendingRequest } from '@/config/type/AxiosCstType'
import { Notification } from '@arco-design/web-react'
import type { AxiosResponse } from 'axios'
import axiosObj from 'axios'

// 是否正在刷新的标记
let isRefreshing = false
// 重试队列，每一项将是一个待执行的函数形式
let requests: pendingRequest[] = []

const defaultConfig = {
  // baseURL在此处省略配置,考虑到项目可能由多人协作完成开发，域名也各不相同，此处通过对api的抽离，域名单独配置在base.js中
  // 请求超时时间
  timeout: 60 * 1000,
  headers: {
    get: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    post: {
      'Content-Type': 'application/json;charset=utf-8',
    },
  },
}

// 创建实例
const _axios = axiosObj.create(defaultConfig)

let hasDispatchNeedLoginEvent = false

const authRequestWhiteList = ['/user/login', '/user/tokenRenew', '/user/authorizeLogin', '/user/updateOnlineStatus']

const shouldSkipTokenAttach = (url?: string) => {
  if (!url) return false
  return authRequestWhiteList.some((item) => url.includes(item))
}

const shouldSkipTokenRenew = (url?: string) => shouldSkipTokenAttach(url)

export const resetNeedLoginEvent = () => {
  hasDispatchNeedLoginEvent = false
}

const clearAuthToken = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
}

const rejectPendingRequests = (reason: string) => {
  if (requests.length === 0) return
  requests.forEach((cb: pendingRequest) => cb(undefined, reason))
  requests = []
}

const notifyNeedLogin = (reason: string) => {
  if (hasDispatchNeedLoginEvent) return
  hasDispatchNeedLoginEvent = true
  // 触发自定义事件，告知组件需要更新全局状态
  const axiosCatchEvent = new CustomEvent('axiosCatchEvent', { detail: { reason, type: 'needLogin' } })
  window.dispatchEvent(axiosCatchEvent)
  // 如果localStorage中不包含userInfo则弹出体验帐号的信息
  if (!localStorage.getItem('userInfo')) {
    Notification.info({
      title: '体验账号',
      content: '用户名：test-1 密码：abcd1234',
      duration: 1000 * 60,
      showIcon: true,
      position: 'bottomRight',
    })
  }
  Notification.error({
    title: '未登录',
    content: '请先登录',
    showIcon: true,
    position: 'bottomRight',
  })
}

const handleTokenRenewFailure = (reason: string) => {
  clearAuthToken()
  rejectPendingRequests(reason)
  notifyNeedLogin(reason)
}

const setUserOffline = (reason: string) => {
  handleTokenRenewFailure(reason)
  authLoginAPI
    .updateOnlineStatus({
      userId: window.localStorage.getItem('userId') || '',
      status: false,
    })
    .catch(() => {
      // ignore offline errors
    })
}

// 请求拦截器
_axios.interceptors.request.use(
  function (config) {
    if (!shouldSkipTokenAttach(config.url)) {
      // 从本地存处理获取token
      const token = window.localStorage.getItem('token')
      // 如果token存在就在请求头里添加
      token && (config.headers.token = token)
    }
    return config
  },
  function (error) {
    // Do something with request error
    error.data = {}
    error.data.msg = '服务器异常'
    return Promise.reject(error)
  },
)
// 响应拦截器
_axios.interceptors.response.use(
  function (response: AxiosResponse) {
    // token过期，续期token
    if (response.data?.code === 401) {
      // 原请求的配置
      const config = response.config
      if (shouldSkipTokenRenew(config?.url)) {
        return response.data
      }
      if (!isRefreshing) {
        // 开始刷新token
        isRefreshing = true
        // 重新请求并更新token，执行未执行完的请求
        return authLoginAPI
          .tokenRenew({
            userId: window.localStorage.getItem('userId') || '',
            token: window.localStorage.getItem('refreshToken') || '',
          })
          .then((res: responseDataType) => {
            if (res.code === 0) {
              const token = res.data.token
              // 刷新未执行请求中的token
              config.headers.token = token
              config.baseURL = ''
              // 更新本地存储中的token
              window.localStorage.setItem('token', token)
              // 执行队列中的请求
              requests.forEach((cb: pendingRequest) => cb(token))
              // 清空队列
              requests = []
              // 重试当前请求并返回promise
              return _axios(config)
            }
            const reason = res.msg || 'token续期失败'
            setUserOffline(reason)
            return Promise.reject(reason)
          })
          .catch((reason) => {
            setUserOffline(reason)
            return Promise.reject(reason)
          })
          .finally(() => {
            // 改变刷新状态
            isRefreshing = false
          })
      } else {
        // 正在刷新token，返回一个未执行resolve的promise
        return new Promise((resolve, reject) => {
          // 将resolve放进队列，用一个函数形式来保存，等token刷新后直接执行
          requests.push((token?: string, error?: any) => {
            if (token) {
              config.headers.token = token
              config.baseURL = ''
              resolve(_axios(config))
              return
            }
            reject(error || 'token续期失败')
          })
        })
      }
    }
    if (response.status === 200) {
      // 处理接口中的data
      if (response.data?.data) {
        try {
          const dataObj = JSON.parse(response.data.data)
          if (typeof dataObj == 'object' && dataObj) {
            // 为json字符串将其转为json对象
            response.data.data = dataObj
          }
        } catch (e) {
          // 不是json字符串就不处理
          return response.data
        }
      }
      return response.data
    }
    response.data.code = -1
    response.data.msg = '服务器错误'
    return response
  },
  function (error) {
    if (error) {
      const data = {
        ...error,
        data: {
          code: -1,
          msg: '服务器错误',
        },
      }
      // 请求已发出，但不在2xx范围内
      return Promise.reject(data)
    } else {
      // 断网
      return Promise.reject({
        data: {
          code: -1,
          msg: '未连接到网络',
        },
      })
    }
  },
)

export default _axios
