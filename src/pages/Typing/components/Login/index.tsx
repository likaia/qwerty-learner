import authLoginAPI from '@/api/authLoginAPI'
import type { authLoginType, getAuthorizeDataType, responseDataType, userInfoType } from '@/api/type/WordBookType'
import { BaiduIcon, CodingIcon, GiteeIcon, GithubIcon, OSChinaIcon } from '@/assets/svg/AuthIcon'
import Layout from '@/components/Layout'
import { resetNeedLoginEvent } from '@/config/axios'
import { authInfoAtom, needLogin, refreshWordBookAtom, userInfoAtom } from '@/store'
import { Button, Card, Divider, Form, Grid, Input, Notification, Tooltip, Typography } from '@arco-design/web-react'
import { useAtom } from 'jotai'
import { useSetAtom } from 'jotai/index'
import { useCallback, useEffect } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'
import IconX from '~icons/tabler/x'

export default function Login() {
  const navigate = useNavigate()
  const setNeedToLogIn = useSetAtom(needLogin)
  const setRefreshWordBookAtom = useSetAtom(refreshWordBookAtom)
  const setUserInfo = useSetAtom(userInfoAtom)
  const [authInfo, setAuthInfo] = useAtom(authInfoAtom)
  const onBack = useCallback(() => {
    navigate('/')
  }, [navigate])
  const FormItem = Form.Item
  const Row = Grid.Row
  const Col = Grid.Col

  useHotkeys('esc', onBack, { preventDefault: true })

  const loginFn = (data: { userName: string; password: string }) => {
    authLoginAPI.login(data).then((res: responseDataType<userInfoType>) => {
      const { data } = res
      if (data && data.token) {
        Notification.success({
          title: '登录成功',
          content: '欢迎回来',
          showIcon: true,
          position: 'bottomRight',
        })
        setNeedToLogIn(false)
        resetNeedLoginEvent()
        localStorage.setItem('token', data.token)
        localStorage.setItem('refreshToken', data.refreshToken)
        localStorage.setItem('userId', data.userID)
        setUserInfo({ avatarSrc: data.avatarSrc, userID: data.userID, username: data.username })
        setRefreshWordBookAtom(true)
        navigate('/')
        return
      }
      Notification.error({
        title: '登录失败',
        content: res.msg,
        showIcon: true,
        position: 'bottomRight',
      })
    })
  }

  // 获取授权码
  const getAuthCode = useCallback(
    (event: StorageEvent) => {
      const authLogin = (state: string, code: string, platform: string) => {
        authLoginAPI
          .authorizeLogin({
            state,
            code,
            platform,
          })
          .then(async (res: responseDataType<userInfoType>) => {
            if (res.code == 0) {
              Notification.success({
                title: '登录成功',
                content: '欢迎回来',
                showIcon: true,
                position: 'bottomRight',
              })
              setNeedToLogIn(false)
              resetNeedLoginEvent()
              const userId = res.data.userID
              const username = res.data.username
              const token = res.data.token
              const refreshToken = res.data.refreshToken
              const profilePicture = res.data.avatarSrc
              const isInitPassword = res.data.isInitedPassword
              // 存储当前用户信息
              localStorage.setItem('token', token)
              localStorage.setItem('refreshToken', refreshToken)
              localStorage.setItem('profilePicture', profilePicture)
              localStorage.setItem('userId', userId)
              setUserInfo({ avatarSrc: res.data.avatarSrc, userID: userId, username: username })
              localStorage.setItem('isInitedPassword', String(isInitPassword))
              setRefreshWordBookAtom(true)
              navigate('/')
              return
            }
            // 弹出报错信息
            Notification.error({
              title: '登录失败',
              content: res.msg,
              showIcon: true,
              position: 'bottomRight',
            })
          })
      }
      // 如果当前改变的key是authCode则执行登录逻辑
      if (event.key === 'authCode') {
        const code = localStorage.getItem('authCode')
        localStorage.removeItem('authCode')
        if (code) {
          // 开始登录
          authLogin(authInfo.state, code, authInfo.platformName)
          return
        }
        throw authInfo.platformName + '授权码获取失败'
      }
    },
    [authInfo.platformName, authInfo.state, navigate, setNeedToLogIn],
  )

  // 获取授权链接
  const getAuthorize = (name: authLoginType) => {
    authLoginAPI.getAuthorize({ platform: name }).then((res: responseDataType<getAuthorizeDataType>) => {
      if (!res.data.state || !res.data.authorizeUrl) throw '服务器错误: 授权链接获取失败'
      // 更新状态码与登录平台名称
      setAuthInfo({ state: res.data.state, platformName: name })
      // 打开授权窗口
      window.open(res.data.authorizeUrl, '_blank', 'toolbar=no,width=800, height=600')
    })
  }

  useEffect(() => {
    // 开始监听localStorage,获取授权码
    window.addEventListener('storage', getAuthCode)
    // 组件卸载时移除监听器
    return () => {
      window.removeEventListener('storage', getAuthCode)
    }
  }, [getAuthCode])

  return (
    <Layout>
      <div className="relative mb-auto mt-auto flex w-full flex-1 flex-col overflow-y-auto pl-20">
        <IconX className="absolute right-20 top-10 mr-2 h-7 w-7 cursor-pointer text-gray-400" onClick={onBack} />
        <div className="mt-20 flex w-full flex-1 flex-col items-center justify-center overflow-y-auto">
          <Card style={{ width: 600 }} title="用户登录">
            <Form autoComplete="off" colon={true} onSubmit={loginFn}>
              <FormItem label="用户名" field="userName" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input placeholder="输入用户名" height={40} />
              </FormItem>
              <FormItem label="密码" field="password" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password placeholder="输入密码" height={40} />
              </FormItem>

              <FormItem wrapperCol={{ offset: 5 }}>
                <Button type="primary" htmlType="submit">
                  登录
                </Button>
              </FormItem>
            </Form>
            <Row>
              <Col span={24} className="flex justify-center">
                <Divider orientation="center">
                  <Typography.Text>通过第三方平台登录</Typography.Text>
                </Divider>
              </Col>
            </Row>
            <Row justify="center" align="center">
              <Col flex={1} className="flex justify-center">
                <Tooltip content="使用GitHub授权登录">
                  <GithubIcon width={40} height={40} onClick={() => getAuthorize('github')} className="cursor-pointer" />
                </Tooltip>
              </Col>
              <Col flex={1} className="flex justify-center">
                <Tooltip content="使用gitee授权登录">
                  <GiteeIcon width={35} height={35} className="cursor-pointer" onClick={() => getAuthorize('gitee')} />
                </Tooltip>
              </Col>
              <Col flex={1} className="flex justify-center">
                <Tooltip content="使用百度授权登录">
                  <BaiduIcon width={40} height={40} className="cursor-pointer" onClick={() => getAuthorize('baidu')} />
                </Tooltip>
              </Col>
              <Col flex={1} className="flex justify-center">
                <Tooltip content="使用开源中国授权登录">
                  <OSChinaIcon width={38} height={38} className="cursor-pointer" onClick={() => getAuthorize('oschina')} />
                </Tooltip>
              </Col>
              <Col flex={1} className="flex justify-center">
                <Tooltip content="使用coding授权登录">
                  <CodingIcon width={40} height={40} className="cursor-pointer" onClick={() => getAuthorize('coding')} />
                </Tooltip>
              </Col>
            </Row>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
