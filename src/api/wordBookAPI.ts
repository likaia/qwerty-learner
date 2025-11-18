import base from '@/api/base'
import type { wordBookRow } from '@/api/type/WordBookType'
import services from '@/config/axios'

// 定义参数类型

const wordBookAPI = {
  getWordBookList(params: { pageNo?: number; pageSize?: number }) {
    return services.get(`${base.lkBaseURL}/wordBook/getWordBookList`, {
      params: params,
    })
  },
  addWords(params: wordBookRow) {
    return services.post(`${base.lkBaseURL}/wordBook/addWords`, params)
  },
  delWords(params: { id: number }) {
    return services.post(`${base.lkBaseURL}/wordBook/delWords`, params)
  },
  delWordBook(params: { name: string }) {
    return services.post(`${base.lkBaseURL}/wordBook/delWordBook`, params)
  },
  // 批量导入
  importWords(file: FormData) {
    return services.post(`${base.lkBaseURL}/wordBook/importWords`, file, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  // 批量导入
  importWordsForExcel(file: FormData) {
    return services.post(`${base.lkBaseURL}/wordBook/importWordsForExcel`, file, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  textToVoice(params: { text: string }) {
    return services.get(`${base.lkBaseURL}/wordBook/textToVoice`, {
      params,
    })
  },
}

export default wordBookAPI
