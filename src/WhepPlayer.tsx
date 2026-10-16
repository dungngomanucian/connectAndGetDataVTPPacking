import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

import { getAuthToken } from './api'

function whepAuthorization() { const token = getAuthToken(); return token ? `Bearer ${token}` : undefined }

function waitForIceGathering(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise<void>((resolve) => {
    const finish = () => {
      peer.removeEventListener('icegatheringstatechange', finish)
      resolve()
    }
    peer.addEventListener('icegatheringstatechange', finish)
  })
}

function getWhepBaseUrl() { return window.location.origin }

export function whepUrl(streamPath: string) {
  const base = getWhepBaseUrl()
  const cleanPath = streamPath.replace(/^\/+|\/+$/g, '')
  return base ? `${base}/${cleanPath}/whep` : `/${cleanPath}/whep`
}

export function hlsUrl(streamPath: string) {
  const cleanPath = streamPath.replace(/^\/+|\/+$/g, '')
  return `/${cleanPath}/index.m3u8`
}

export function WhepPlayer({ streamPath, label, muted = true, playbackRate = 1, paused = false, onStateChange }: { streamPath: string; label: string; muted?: boolean; playbackRate?: number; paused?: boolean; onStateChange?: (state: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState('CONNECTING')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    onStateChange?.(state)
  }, [onStateChange, state])

  useEffect(() => {
    let disposed = false
    let fallbackStarted = false
    const controller = new AbortController()
    let resourceUrl: string | null = null
    let hlsInstance: Hls | null = null
    let connectionTimeout: any = null
    let nativeHlsErrorListener: (() => void) | null = null
    const peer = new RTCPeerConnection()
    const mediaStream = new MediaStream()
    const video = videoRef.current
    const url = whepUrl(streamPath)
    setErrorMessage('')
    setState('CONNECTING')

    const startHls = () => {
      if (disposed || fallbackStarted) return
      fallbackStarted = true
      if (connectionTimeout) clearTimeout(connectionTimeout)
      peer.ontrack = null
      peer.onconnectionstatechange = null
      peer.close()
      controller.abort()
      mediaStream.getTracks().forEach(track => track.stop())
      setState('CONNECTING')
      setErrorMessage('Đang kết nối HLS…')
      const playlist = hlsUrl(streamPath)
      if (Hls.isSupported()) {
        const hls = new Hls({
          lowLatencyMode: true,
          liveSyncDurationCount: 1,
          liveMaxLatencyDurationCount: 3,
          enableWorker: true,
          xhrSetup: (xhr) => {
            const authorization = whepAuthorization()
            if (authorization) xhr.setRequestHeader('Authorization', authorization)
          },
        })
        hlsInstance = hls
        hls.loadSource(playlist)
        if (video) {
          video.srcObject = null
          hls.attachMedia(video)
        }
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!disposed) {
            setErrorMessage('')
            setState('LIVE')
            video?.play().catch(() => undefined)
          }
        })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal && !disposed) {
            const status = data.response?.code
            setErrorMessage(status ? `HLS HTTP ${status}` : 'HLS stream unavailable')
            setState('OFFLINE')
          }
        })
      } else if (video && video.canPlayType('application/vnd.apple.mpegurl')) {
        video.srcObject = null
        video.src = playlist
        nativeHlsErrorListener = () => {
          if (!disposed) {
            setErrorMessage('HLS playback failed')
            setState('OFFLINE')
          }
        }
        video.addEventListener('error', nativeHlsErrorListener)
        video.play().catch(() => undefined)
        setState('LIVE')
      } else {
        if (!disposed) setState('OFFLINE')
      }
    }

    const fail = (reason = 'WebRTC connection failed') => {
      if (!disposed && !fallbackStarted) {
        setErrorMessage(reason)
        startHls()
      }
    }

    peer.addTransceiver('video', { direction: 'recvonly' })
    peer.addTransceiver('audio', { direction: 'recvonly' })

    peer.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => mediaStream.addTrack(track))
      } else if (event.track) {
        mediaStream.addTrack(event.track)
      }
      if (video) {
        video.srcObject = mediaStream
        video.play().catch(() => undefined)
      }
    }

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        if (connectionTimeout) clearTimeout(connectionTimeout)
        setState('LIVE')
      }
      if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
        fail('WebRTC connection failed')
      }
    }

    connectionTimeout = setTimeout(() => {
      if (peer.connectionState !== 'connected' && !disposed) {
        fail('WebRTC connection timeout')
      }
    }, 3500)

    void (async () => {
      try {
        await peer.setLocalDescription(await peer.createOffer())
        await waitForIceGathering(peer)
        const response = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Accept: 'application/sdp',
            'Content-Type': 'application/sdp',
            ...(whepAuthorization() ? { Authorization: whepAuthorization() } : {}),
          },
          body: peer.localDescription?.sdp,
        })
        if (!response.ok) throw new Error(`WHEP HTTP ${response.status}`)
        if (disposed || fallbackStarted) return
        const location = response.headers.get('Location')
        resourceUrl = location ? new URL(location, window.location.origin).toString() : null
        if (resourceUrl && new URL(resourceUrl).origin !== window.location.origin) resourceUrl = null
        await peer.setRemoteDescription({ type: 'answer', sdp: await response.text() })
      } catch (reason) {
        fail(reason instanceof Error ? reason.message : 'WebRTC request failed')
      }
    })()

    return () => {
      disposed = true
      controller.abort()
      if (connectionTimeout) clearTimeout(connectionTimeout)
      if (hlsInstance) {
        hlsInstance.destroy()
        hlsInstance = null
      }
      peer.close()
      mediaStream.getTracks().forEach((track) => track.stop())
      if (video) {
        if (nativeHlsErrorListener) video.removeEventListener('error', nativeHlsErrorListener)
        video.srcObject = null
        video.removeAttribute('src')
      }
      if (resourceUrl) {
        const authorization = whepAuthorization()
        void fetch(resourceUrl, {
          method: 'DELETE',
          ...(authorization ? { headers: { Authorization: authorization } } : {}),
        }).catch(() => undefined)
      }
    }
  }, [streamPath])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = muted
    video.playbackRate = playbackRate
    if (paused) video.pause()
    else void video.play().catch(() => undefined)
  }, [muted, paused, playbackRate])

  return <div className="whep-player"><video ref={videoRef} autoPlay muted={muted} playsInline aria-label={label} />{state !== 'LIVE' && <div className="no-signal" role="status"><span>Không có tín hiệu</span>{errorMessage && <small>{errorMessage}</small>}</div>}<span className={state === 'LIVE' ? 'is-live' : ''}>{state}</span></div>
}
