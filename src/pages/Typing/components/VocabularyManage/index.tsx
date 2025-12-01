import type { responseDataType, wordBookRow } from '@/api/type/WordBookType'
import wordBookAPI from '@/api/wordBookAPI'
import Layout from '@/components/Layout'
import { LoadingUI } from '@/components/Loading'
import BubbleConfirmTemplate from '@/pages/Typing/components/VocabularyManage/BubbleConfirmTemplate'
import BubbleDelWordsBookConfirm from '@/pages/Typing/components/VocabularyManage/BubbleDelWordsBookConfirm'
import { refreshWordBookAtom, wordBookListAtom, wordBookListCountAtom } from '@/store'
import type { PaginationProps } from '@arco-design/web-react'
import { Message } from '@arco-design/web-react'
import { Notification } from '@arco-design/web-react'
import { Card } from '@arco-design/web-react'
import { Button, Input, Popconfirm, Table } from '@arco-design/web-react'
import type { RefInputType } from '@arco-design/web-react/es/Input'
import type { ColumnProps } from '@arco-design/web-react/es/Table'
import { IconDelete, IconImport, IconSearch } from '@arco-design/web-react/icon'
import { useAtomValue, useSetAtom } from 'jotai'
import type { Ref } from 'react'
import { useEffect } from 'react'
import { useRef, useState } from 'react'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import IconX from '~icons/tabler/x'

const VocabularyManage = () => {
  const navigate = useNavigate()
  const setRefreshWordBookAtom = useSetAtom(refreshWordBookAtom)
  const wordBookList = useAtomValue(wordBookListAtom)
  const wordBookListCount = useAtomValue(wordBookListCountAtom)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const inputRef: Ref<RefInputType> | undefined = useRef(null)
  const filterRef: Ref<HTMLDivElement> = useRef(null)
  const [tableHeight, setTableHeight] = useState(0)
  const uploadRef: Ref<HTMLInputElement> = useRef(null)
  const onBack = useCallback(() => {
    navigate('/')
  }, [navigate])
  const [pagination, setPagination] = useState({
    sizeCanChange: true,
    showTotal: true,
    total: wordBookListCount,
    pageSize: 10,
    current: 1,
    pageSizeChangeResetCurrent: true,
  })

  const [data, setData] = useState(wordBookList)
  const [selectedRows, setSelectedRows] = useState<wordBookRow[]>([])
  const [delBookName, setDelBookName] = useState<string>('')
  const columns: Array<ColumnProps> = [
    {
      title: '单词或短语',
      dataIndex: 'name',
      filterIcon: <IconSearch />,
      filterDropdown: ({ filterKeys, setFilterKeys }) => {
        return (
          <div className="arco-table-custom-filter" ref={filterRef}>
            <Input.Search
              ref={inputRef}
              searchButton
              placeholder=""
              value={(filterKeys && filterKeys[0]) || ''}
              onChange={(value) => {
                setFilterKeys && setFilterKeys(value ? [value] : [])
              }}
              onSearch={(value) => {
                const filterData = wordBookList.filter((item) => {
                  // 不区分大小写
                  return item.name.toLowerCase().indexOf(value.toLowerCase()) !== -1
                })
                setData(filterData)
                setPagination((pagination) => ({ ...pagination, current: 1, total: filterData.length }))
                // 获取筛选栏的搜索图标dom，通过点击事件来关闭展开的搜索框（因为自定义了搜索逻辑，不能通过confirm回调来关闭了）
                const arcoTableSearchPanels = document.getElementsByClassName('arco-table-filters')
                if (arcoTableSearchPanels.length > 0) {
                  const searchPanel = arcoTableSearchPanels[0] as HTMLDivElement
                  searchPanel.click()
                }
              }}
            />
          </div>
        )
      },
      onFilterDropdownVisibleChange: (visible: boolean) => {
        if (visible) {
          setTimeout(() => inputRef?.current?.focus(), 150)
        }
      },
    },
    {
      title: '中文释义',
      dataIndex: 'trans',
    },
    {
      title: '美音音标',
      dataIndex: 'usphone',
    },
    {
      title: '美音音标',
      dataIndex: 'ukphone',
    },
    {
      title: '单词本名称',
      dataIndex: 'bookName',
    },
    {
      title: '创建人',
      dataIndex: 'userName',
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
    },
    {
      title: '操作',
      dataIndex: 'op',
      render: (_: Record<string, string>, record: wordBookRow) => (
        <Button onClick={() => removeRow(record.id)} type="primary" status="danger">
          删除
        </Button>
      ),
    },
  ]

  const onChangeTable = (pagination: PaginationProps) => {
    const { current, pageSize } = pagination
    setLoading(true)
    if (current && pageSize) {
      setTimeout(() => {
        setData(wordBookList.slice((current - 1) * pageSize, current * pageSize))
        setPagination((pagination) => ({ ...pagination, current, pageSize }))
        setLoading(false)
      }, 300)
    }
  }

  const delBook = () => {
    console.log('待删除的单词本', delBookName)
    wordBookAPI.delWordBook({ name: delBookName }).then((res: responseDataType<string>) => {
      if (res.code === 0) {
        // 刷新单词本数据
        setRefreshWordBookAtom(true)
        // 删除成功
        Notification.success({
          title: '删除成功',
          content: `单词本${delBookName}已删除`,
          showIcon: true,
          position: 'bottomRight',
        })
        return
      }
      // 删除失败
      Notification.error({
        title: '删除失败',
        content: res.msg,
        showIcon: true,
        position: 'bottomRight',
      })
    })
  }

  const removeRows = (ids: Array<number>) => {
    if (ids.length <= 0) {
      Notification.info({
        title: '未勾选数据',
        content: '请勾选要删除的数据',
        showIcon: true,
        position: 'topRight',
      })
      return
    }
    // 将每个删除请求封装为 Promise
    const deletePromises = ids.map((id) => wordBookAPI.delWords({ id }))
    // 使用 Promise.all 来并行执行删除请求
    Promise.all(deletePromises)
      .then((results) => {
        // 结果数组，每个删除请求的返回值
        const successCount = results.filter((res) => res.code === 0).length
        const failureCount = results.length - successCount

        if (successCount > 0) {
          setRefreshWordBookAtom(true)
          Notification.success({
            title: '批量删除成功',
            content: `成功删除了 ${successCount} 个单词`,
            showIcon: true,
            position: 'bottomRight',
          })
        }
        if (failureCount > 0) {
          Notification.error({
            title: '批量删除失败',
            content: `有 ${failureCount} 个单词删除失败`,
            showIcon: true,
            position: 'bottomRight',
          })
        }
      })
      .catch((error) => {
        // 处理请求失败的情况
        Notification.error({
          title: '批量删除失败',
          content: `发生了错误: ${error.message}`,
          showIcon: true,
          position: 'bottomRight',
        })
      })
  }

  const removeRow = (id?: number) => {
    if (id == null) {
      Notification.error({
        title: '删除失败',
        content: '单词id不存在',
        showIcon: true,
        position: 'bottomRight',
      })
      return
    }
    // 调用删除接口
    wordBookAPI.delWords({ id }).then((res: responseDataType<string>) => {
      if (res.code === 0) {
        // 刷新单词本数据
        setRefreshWordBookAtom(true)
        // 删除成功
        Notification.success({
          title: '删除成功',
          content: `id=${id}的单词已删除`,
          showIcon: true,
          position: 'bottomRight',
        })
        return
      }
      // 删除失败
      Notification.error({
        title: '删除失败',
        content: res.msg,
        showIcon: true,
        position: 'bottomRight',
      })
    })
  }

  // wordBookList或者wordBookListCount改变时刷新表格数据
  useEffect(() => {
    setData(wordBookList)
    let current = pagination.current
    const maxPage = Math.ceil(wordBookListCount / pagination.pageSize)
    // 如果当前页数大于最大页数则修改current
    if (current > maxPage) {
      current = maxPage
    }
    if (wordBookListCount > 0 && current < 1) {
      current = 1
    }
    setTableHeight(window.innerHeight - 150)
    setPagination((pagination) => ({ ...pagination, current, total: wordBookListCount }))
  }, [wordBookList, wordBookListCount])

  // 处理批量导入
  useEffect(() => {
    const handleChange = () => {
      const file = uploadRef.current?.files?.[0]
      if (file == null) {
        return
      }
      const maxSize = 3 * 1024 * 1024
      if (file.size > maxSize) {
        Message.error('文件必须小于3MB')
        return
      }

      // 构造form对象
      const formData = new FormData()
      // 后台取值字段 | blob文件数据 | 文件名称
      formData.append('file', file, file.name)
      const resetUploadState = () => {
        if (uploadRef?.current) {
          uploadRef.current.value = ''
        }
        setImporting(false)
      }
      const handleImport = (importRequest: (formData: FormData) => Promise<responseDataType>) => {
        setImporting(true)
        importRequest(formData)
          .then((res: responseDataType) => {
            if (res.code === 0) {
              // 刷新单词本数据
              setRefreshWordBookAtom(true)
              // 导入成功
              Notification.success({
                title: '导入成功',
                content: '批量导入成功',
                showIcon: true,
                position: 'bottomRight',
              })
              return
            }
            // 导入失败
            Notification.error({
              title: '导入失败',
              content: res.msg,
              showIcon: true,
              position: 'bottomRight',
            })
          })
          .catch((error) => {
            // 导入失败
            Notification.error({
              title: '导入失败',
              content: error?.data?.msg || '发生未知错误',
              showIcon: true,
              position: 'bottomRight',
            })
          })
          .finally(() => {
            resetUploadState()
          })
      }
      switch (file.type) {
        case 'application/json':
          handleImport((formData: FormData) => wordBookAPI.importWords(formData))
          break
        case 'application/vnd.ms-excel':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
          handleImport((formData: FormData) => wordBookAPI.importWordsForExcel(formData))
          break
        default:
          break
      }
    }
    // 绑定事件处理函数
    const fileInput = uploadRef.current
    if (!fileInput) return
    fileInput.addEventListener('change', handleChange)
    // 清理函数：组件卸载时移除事件监听
    return () => {
      fileInput.removeEventListener('change', handleChange)
    }
  }, [])

  const handleDescriptionChange = (value: string) => {
    setDelBookName(value)
  }

  return (
    <Layout>
      {importing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white px-6 py-5 shadow-xl dark:bg-[#1f1f1f]">
            <LoadingUI />
            <div className="text-sm text-gray-700 dark:text-gray-200">导入中，请稍候...</div>
          </div>
        </div>
      )}
      <div className="relative mb-auto mt-auto flex w-full flex-1 flex-col overflow-y-auto pl-20">
        <IconX className="absolute right-20 top-10 mr-2 h-7 w-7 cursor-pointer text-gray-400" onClick={onBack} />
        <div className="mt-20 flex w-full flex-1 flex-col items-center justify-center">
          <Card
            style={{ width: '85%', overflowY: 'auto' }}
            title="单词管理"
            extra={
              <div>
                <Popconfirm
                  focusLock
                  title="导入确认"
                  content={BubbleConfirmTemplate}
                  onOk={() => {
                    uploadRef.current?.click()
                  }}
                >
                  <div className="trigger" style={{ display: 'none' }}></div>
                  <Button type="text" icon={<IconImport />}>
                    批量导入
                  </Button>
                </Popconfirm>
                <Button onClick={() => removeRows(selectedRows.map((row) => row.id))} type="text" status="danger" icon={<IconDelete />}>
                  批量删除
                </Button>
                <Popconfirm
                  focusLock
                  title="删除确认"
                  content={<BubbleDelWordsBookConfirm onSelect={handleDescriptionChange} />}
                  onOk={() => {
                    delBook()
                  }}
                >
                  <div className="trigger" style={{ display: 'none' }}></div>
                  <Button type="primary" icon={<IconDelete />}>
                    删除单词本
                  </Button>
                </Popconfirm>
              </div>
            }
            className={' overflow-y-auto'}
          >
            <Table
              loading={loading}
              columns={columns}
              data={data}
              rowKey="id"
              pagination={pagination}
              onChange={onChangeTable}
              scroll={{ y: tableHeight - 100 }}
              rowSelection={{
                selectedRowKeys: selectedRows.map((row) => row.id),
                onChange: (selectedRowKeys, selectedRows) => {
                  setSelectedRows(selectedRows)
                },
              }}
            />
            <input type="file" ref={uploadRef} style={{ display: 'none' }} accept=".json, .xls, .xlsx" />
          </Card>
        </div>
      </div>
    </Layout>
  )
}

export default VocabularyManage
