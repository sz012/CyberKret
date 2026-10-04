import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { makeTimeline, sceneAt } from './timeline'

type Voice = { url: string; duration: number; name: string }

function readVoice(file: File): Promise<Voice> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const media = new Audio()
    const fail = () => {
      clearTimeout(timeout)
      media.removeAttribute('src')
      URL.revokeObjectURL(url)
      reject(new Error(`Nie można odczytać nagrania ${file.name}. Wybierz MP3 lub WAV.`))
    }
    const timeout = window.setTimeout(fail, 10000)
    media.preload = 'metadata'
    media.onloadedmetadata = () => {
      if (!Number.isFinite(media.duration) || media.duration <= 0 || media.duration > 180) return fail()
      clearTimeout(timeout)
      const duration = media.duration
      media.removeAttribute('src')
      resolve({ url, duration, name: file.name })
    }
    media.onerror = fail
    media.src = url
  })
}

export function useDemoPlayer() {
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [voices, setVoices] = useState<Record<number, Voice>>({})
  const [error, setError] = useState('')
  const [loadingVoice, setLoadingVoice] = useState(false)
  const position = useRef(0)
  const media = useRef<HTMLAudioElement | null>(null)
  const urls = useRef(new Set<string>())
  const timeline = useMemo(() => makeTimeline(Object.fromEntries(Object.entries(voices).map(([key, voice]) => [key, voice.duration]))), [voices])
  const duration = timeline.at(-1)!.end
  const index = sceneAt(time, timeline)
  const shot = timeline[index]

  useEffect(() => {
    const element = new Audio()
    media.current = element
    const allUrls = urls.current
    return () => {
      element.pause()
      element.removeAttribute('src')
      allUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const seek = useCallback((seconds: number) => {
    const value = Math.min(duration, Math.max(0, seconds))
    position.current = value
    setTime(value)
    const nextIndex = sceneAt(value, timeline)
    if (nextIndex === index && media.current && voices[index]) {
      media.current.currentTime = Math.min(voices[index].duration, value - timeline[index].start)
    }
    if (value >= duration) setPlaying(false)
  }, [duration, index, timeline, voices])

  useEffect(() => {
    const element = media.current!
    let cancelled = false
    element.pause()
    const voice = voices[index]
    if (!voice) {
      element.removeAttribute('src')
      return
    }
    if (element.src !== voice.url) element.src = voice.url
    element.currentTime = Math.min(voice.duration, Math.max(0, position.current - shot.start))
    if (playing && element.currentTime < voice.duration) {
      element.play().catch(() => {
        if (cancelled) return
        setPlaying(false)
        setError('Przeglądarka zatrzymała lektora. Naciśnij Odtwórz, aby wznowić.')
      })
    }
    return () => { cancelled = true; element.pause() }
  }, [index, playing, voices, shot.start])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      const element = media.current
      const voice = voices[index]
      const increment = Math.max(0, (now - previous) / 1000)
      previous = now
      const audioActive = voice && element && !element.ended && position.current - shot.start < voice.duration
      const next = audioActive ? shot.start + element.currentTime : position.current + increment
      position.current = Math.min(duration, next)
      setTime(position.current)
      if (position.current >= duration) setPlaying(false)
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, duration, index, voices, shot.start])

  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) setPlaying(false) }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  const toggle = useCallback(() => {
    setError('')
    if (position.current >= duration) seek(0)
    setPlaying((value) => !value)
  }, [duration, seek])

  const loadVoices = async (files: FileList | null) => {
    if (!files?.length) return
    setPlaying(false)
    setError('')
    setLoadingVoice(true)
    const loaded: Record<number, Voice> = {}
    try {
      for (const file of Array.from(files)) {
        const match = file.name.match(/^0([1-7])(?:[._ -]|$)/)
        if (!match || !/\.(mp3|wav|m4a)$/i.test(file.name) || file.size > 50 * 1024 * 1024) {
          throw new Error('Nazwij pliki 01-intro, 02-firma, aż do 07-final. Wybierz MP3, WAV lub M4A do 50 MB każdy.')
        }
        const key = Number(match[1]) - 1
        if (loaded[key]) throw new Error(`Wybrano dwa nagrania do sceny ${match[1]}. Wybierz jedno.`)
        loaded[key] = await readVoice(file)
      }
      for (const [key, voice] of Object.entries(loaded)) {
        if (voices[Number(key)]) {
          URL.revokeObjectURL(voices[Number(key)].url)
          urls.current.delete(voices[Number(key)].url)
        }
        urls.current.add(voice.url)
      }
      setVoices((current) => ({ ...current, ...loaded }))
      position.current = 0
      setTime(0)
    } catch (cause) {
      Object.values(loaded).forEach((voice) => URL.revokeObjectURL(voice.url))
      setError(cause instanceof Error ? cause.message : 'Nie udało się wczytać lektora.')
    } finally {
      setLoadingVoice(false)
    }
  }

  return { time, playing, setPlaying, duration, timeline, index, shot, seek, toggle, voices, error, setError, loadVoices, loadingVoice }
}
