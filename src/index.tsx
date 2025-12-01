import Loading from './components/Loading'
import './index.scss'
import { ErrorBook } from './pages/ErrorBook'
import { FriendLinks } from './pages/FriendLinks'
import MobilePage from './pages/Mobile'
import TypingPage from './pages/Typing'
import type { responseDataType, wordBookCountType, wordBookListType, wordBookRow } from '@/api/type/WordBookType'
import wordBookAPI from '@/api/wordBookAPI'
import VocabularyManage from '@/pages/Typing/components/VocabularyManage'
import {
  isOpenDarkModeAtom,
  needLogin,
  refreshWordBookAtom,
  refreshWordBookDescAtom,
  wordBookListAtom,
  wordBookListCountAtom,
} from '@/store'
import type { DictionaryResource } from '@/typings'
import { calcChapterCount } from '@/utils'
import { Notification } from '@arco-design/web-react'
import 'animate.css'
import { useAtom, useAtomValue } from 'jotai'
import { useSetAtom } from 'jotai/index'
import mixpanel from 'mixpanel-browser'
import process from 'process'
import React, { Suspense, lazy, useEffect, useState } from 'react'
import 'react-app-polyfill/stable'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

const AnalysisPage = lazy(() => import('./pages/Analysis'))
const GalleryPage = lazy(() => import('./pages/Gallery-N'))
const AddWordPage = lazy(() => import('@/pages/Typing/components/AddWord'))
const LoginPage = lazy(() => import('@/pages/Typing/components/Login'))

if (process.env.NODE_ENV === 'production') {
  // for prod
  mixpanel.init('bdc492847e9340eeebd53cc35f321691')
} else {
  // for dev
  mixpanel.init('5474177127e4767124c123b2d7846e2a', { debug: true })
}

function Root() {
  const [wordBookLoadState, setWordBookLoadState] = useState(false)
  const darkMode = useAtomValue(isOpenDarkModeAtom)
  const setNeedToLogIn = useSetAtom(needLogin)
  const setWordBookListAtom = useSetAtom(wordBookListAtom)
  const setWordBookListCount = useSetAtom(wordBookListCountAtom)
  const [refreshWordBook, setRefreshWordBookAtom] = useAtom(refreshWordBookAtom)
  const setRefreshWordBookDescState = useSetAtom(refreshWordBookDescAtom)
  const getWordbooksCount = (data: Array<wordBookRow>) => {
    const categoryData: Set<string> = new Set()
    data.forEach((item) => {
      categoryData.add(item.bookName || '')
    })
    // 遍历categoryData, 计算单词和例句总数
    const wordBooksCount: Array<wordBookCountType> = []
    categoryData.forEach((value) => {
      // 计算出单词和例句的总数
      let totalWordCount = 0
      let totalPhraseCount = 0
      for (let i = 0; i < data.length; i++) {
        const item = data[i]
        if (item.type === 1 && value === item.bookName) {
          totalPhraseCount++
        }
        if (item.type === 0 && value === item.bookName) {
          totalWordCount++
        }
      }
      wordBooksCount.push({ name: value, totalWordCount, totalPhraseCount })
    })
    return wordBooksCount
  }

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600)

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= 600
      setIsMobile(isMobile)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const mergeData = (data: Array<wordBookRow>, countInfo: Array<wordBookCountType>): DictionaryResource[] => {
      const seen: Record<string, boolean> = {} // 记录已添加的组合
      const result: DictionaryResource[] = []
      data.forEach((item) => {
        let totalPhraseCount = 0
        let totalWordCount = 0
        for (let i = 0; i < countInfo.length; i++) {
          if (item.bookName === countInfo[i].name) {
            totalWordCount = countInfo[i].totalWordCount
            totalPhraseCount = countInfo[i].totalPhraseCount
            break
          }
        }
        const bookNameWithPhrase = item.type === 1 ? item.bookName + ' Phrase' : item.bookName
        const key = `${bookNameWithPhrase} - ${item.description}` // 创建一个独特的键
        if (!seen[key]) {
          const resultItem: DictionaryResource = {
            id: item.type === 1 ? item.bookName + '-Phrase' : item.bookName || '',
            name: bookNameWithPhrase || '',
            description: item.description || '',
            chapterCount: item.type === 1 ? calcChapterCount(totalPhraseCount) : calcChapterCount(totalWordCount),
            category: '英文书籍',
            tags: item.type === 1 ? ['例句'] : ['单词'],
            url: '',
            length: item.type === 1 ? totalPhraseCount : totalWordCount,
            language: 'en',
            languageCategory: 'VocabularyBook',
          }
          result.push(resultItem)
          seen[key] = true
        }
      })
      return result
    }

    if (!wordBookLoadState || refreshWordBook) {
      // 获取单词本数据，将其放入本地存储中
      wordBookAPI
        .getWordBookList({ pageNo: 1, pageSize: 10000 })
        .then((res: responseDataType<wordBookListType>) => {
          const { data, code, msg } = res
          if (code === 0) {
            const wordBookList = data.wordBookList
            const countInfo = getWordbooksCount(wordBookList)
            setWordBookListAtom(wordBookList)
            setWordBookListCount(data.count)
            // 生成分类数据
            const remoteClassifiedData = mergeData(wordBookList, countInfo)
            localStorage.setItem('remoteClassifiedData', JSON.stringify(remoteClassifiedData))
            // 刷新单词本的描述字段
            setRefreshWordBookDescState(true)
            // 还原单词本刷新状态
            setRefreshWordBookAtom(false)
            setWordBookLoadState(true)
            return
          }
          Notification.error({
            title: code,
            content: msg,
            showIcon: true,
            position: 'bottomRight',
          })
        })
        .catch(() => {
          setWordBookLoadState(true)
        })
    }
    if (darkMode) {
      document.body.setAttribute('arco-theme', 'dark')
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.body.setAttribute('arco-theme', 'light')
    }
    const handleAxiosCatchEvent = (event: CustomEventInit) => {
      // 更新状态
      const { type } = event.detail
      if (type === 'needLogin') {
        setNeedToLogIn(true)
      }
    }
    window.addEventListener('axiosCatchEvent', handleAxiosCatchEvent)
    return () => {
      window.removeEventListener('axiosCatchEvent', handleAxiosCatchEvent)
    }
  }, [darkMode, setNeedToLogIn, refreshWordBook, wordBookLoadState, setRefreshWordBookDescState, setRefreshWordBookAtom])

  if (!wordBookLoadState) {
    return <Loading />
  }

  return (
    <React.StrictMode>
      <BrowserRouter basename={process.env.NODE_ENV === 'development' ? '' : '/english-study'}>
        <Suspense fallback={<Loading />}>
          <Routes>
            {isMobile ? (
              <Route path="/*" element={<Navigate to="/mobile" />} />
            ) : (
              <>
                <Route index element={<TypingPage />} />
                <Route path="/gallery" element={<GalleryPage />} />
                <Route path="/analysis" element={<AnalysisPage />} />
                <Route path="/error-book" element={<ErrorBook />} />
                <Route path="/friend-links" element={<FriendLinks />} />
                <Route path="/add-word" element={<AddWordPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/mange-word" element={<VocabularyManage />} />
                <Route path="/*" element={<Navigate to="/" />} />
              </>
            )}
            <Route path="/mobile" element={<MobilePage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </React.StrictMode>
  )
}

const container = document.getElementById('root')

container && createRoot(container).render(<Root />)
