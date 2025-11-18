import base from '@/api/base'
import wordBookAPI from '@/api/wordBookAPI'
import { pronunciationConfigAtom } from '@/store'
import type { PronunciationType } from '@/typings'
import { addHowlListener } from '@/utils'
import { romajiToHiragana } from '@/utils/kana'
import { Howl } from 'howler'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const VOICE_PREFIX = `${base.lkBaseURL}/uploads/`
const FALLBACK_VOICE_API = 'https://dict.youdao.com/dictvoice?audio='
const pronunciationCache = new Map<string, string>()
const pendingPronunciationRequest = new Map<string, Promise<string>>()

const getPronunciationKey = (text: string, pronunciation: Exclude<PronunciationType, false>) => `${pronunciation}:${text}`

const transformTextByPronunciation = (word: string, pronunciation: Exclude<PronunciationType, false>) => {
  if (pronunciation === 'romaji') {
    return romajiToHiragana(word)
  }
  return word
}

const getFallbackPronunciationSrc = (word: string, pronunciation: Exclude<PronunciationType, false>) => {
  if (!word) return ''
  switch (pronunciation) {
    case 'uk':
      return `${FALLBACK_VOICE_API}${word}&type=1`
    case 'us':
      return `${FALLBACK_VOICE_API}${word}&type=2`
    case 'romaji':
      return `${FALLBACK_VOICE_API}${romajiToHiragana(word)}&le=jap`
    case 'zh':
      return `${FALLBACK_VOICE_API}${word}&le=zh`
    case 'ja':
      return `${FALLBACK_VOICE_API}${word}&le=jap`
    case 'de':
      return `${FALLBACK_VOICE_API}${word}&le=de`
    case 'hapin':
    case 'kk':
      return `${FALLBACK_VOICE_API}${word}&le=ru`
    case 'id':
      return `${FALLBACK_VOICE_API}${word}&le=id`
    default:
      return ''
  }
}

const fetchPronunciationAudio = async (word: string, pronunciation: Exclude<PronunciationType, false>) => {
  const safeWord = word?.trim()
  if (!safeWord) return ''
  const text = transformTextByPronunciation(safeWord, pronunciation)
  const cacheKey = getPronunciationKey(text, pronunciation)
  if (pronunciationCache.has(cacheKey)) {
    return pronunciationCache.get(cacheKey) as string
  }
  if (pendingPronunciationRequest.has(cacheKey)) {
    return pendingPronunciationRequest.get(cacheKey) as Promise<string>
  }
  const getFallback = () => {
    const fallback = getFallbackPronunciationSrc(safeWord, pronunciation)
    if (fallback) {
      pronunciationCache.set(cacheKey, fallback)
    }
    return fallback
  }
  const request = wordBookAPI
    .textToVoice({ text })
    .then((res) => {
      if (res.code === 0 && res.data?.audioFileName) {
        const src = `${VOICE_PREFIX}${res.data.audioFileName}`
        pronunciationCache.set(cacheKey, src)
        return src
      }
      return getFallback()
    })
    .catch(() => getFallback())
    .finally(() => {
      pendingPronunciationRequest.delete(cacheKey)
    })
  pendingPronunciationRequest.set(cacheKey, request)
  return request
}

export default function usePronunciationSound(word: string, isLoop?: boolean) {
  const pronunciationConfig = useAtomValue(pronunciationConfigAtom)
  const loop = useMemo(() => (typeof isLoop === 'boolean' ? isLoop : pronunciationConfig.isLoop), [isLoop, pronunciationConfig.isLoop])
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioSrc, setAudioSrc] = useState('')
  const soundRef = useRef<Howl | null>(null)
  const pendingPlayRef = useRef(false)

  useEffect(() => {
    let disposed = false
    const pronunciation = pronunciationConfig.type
    pendingPlayRef.current = false
    setIsPlaying(false)
    setAudioSrc('')
    if (!pronunciation) {
      return
    }
    fetchPronunciationAudio(word, pronunciation).then((src) => {
      if (disposed) return
      setAudioSrc(src)
    })
    return () => {
      disposed = true
    }
  }, [word, pronunciationConfig.type])

  useEffect(() => {
    const prevSound = soundRef.current
    if (prevSound) {
      prevSound.unload()
      soundRef.current = null
    }
    if (!audioSrc) return

    const sound = new Howl({
      src: [audioSrc],
      html5: true,
      loop,
      volume: pronunciationConfig.volume,
      rate: pronunciationConfig.rate,
      preload: true,
    })
    soundRef.current = sound
    const unListens = [
      addHowlListener(sound, 'play', () => setIsPlaying(true)),
      addHowlListener(sound, 'end', () => setIsPlaying(false)),
      addHowlListener(sound, 'pause', () => setIsPlaying(false)),
      addHowlListener(sound, 'stop', () => setIsPlaying(false)),
      addHowlListener(sound, 'playerror', () => setIsPlaying(false)),
      addHowlListener(sound, 'loaderror', () => setIsPlaying(false)),
    ]

    if (pendingPlayRef.current) {
      pendingPlayRef.current = false
      sound.stop()
      sound.play()
    }

    return () => {
      unListens.forEach((unListen) => unListen())
      if (soundRef.current === sound) {
        soundRef.current = null
      }
      sound.unload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在音频源变化时重新创建播放器实例
  }, [audioSrc])

  useEffect(() => {
    const sound = soundRef.current
    if (!sound) return
    sound.loop(loop)
    sound.volume(pronunciationConfig.volume)
    sound.rate(pronunciationConfig.rate)
  }, [loop, pronunciationConfig.rate, pronunciationConfig.volume])

  const play = useCallback(() => {
    const sound = soundRef.current
    if (!sound) {
      pendingPlayRef.current = true
      return
    }
    pendingPlayRef.current = false
    sound.stop()
    sound.play()
  }, [])

  const stop = useCallback(() => {
    pendingPlayRef.current = false
    const sound = soundRef.current
    if (!sound) return
    sound.stop()
    setIsPlaying(false)
  }, [])

  useEffect(
    () => () => {
      pendingPlayRef.current = false
      if (soundRef.current) {
        soundRef.current.unload()
        soundRef.current = null
      }
    },
    [],
  )

  return { play, stop, isPlaying }
}

export function usePrefetchPronunciationSound(word: string | undefined) {
  const pronunciationConfig = useAtomValue(pronunciationConfigAtom)

  useEffect(() => {
    if (!word) return

    let disposed = false
    let audioEl: HTMLAudioElement | null = null
    const pronunciation = pronunciationConfig.type
    if (!pronunciation) return

    fetchPronunciationAudio(word, pronunciation).then((src) => {
      if (disposed || !src) return
      const head = document.head
      const exists = Array.from(head.querySelectorAll('audio[data-pronunciation-src]')).some(
        (el) => el.getAttribute('data-pronunciation-src') === src,
      )
      if (exists) return

      audioEl = new Audio()
      audioEl.src = src
      audioEl.preload = 'auto'
      audioEl.crossOrigin = 'anonymous'
      audioEl.style.display = 'none'
      audioEl.setAttribute('data-pronunciation-src', src)

      head.appendChild(audioEl)
    })

    return () => {
      disposed = true
      if (audioEl) {
        document.head.removeChild(audioEl)
      }
    }
  }, [pronunciationConfig.type, word])
}
