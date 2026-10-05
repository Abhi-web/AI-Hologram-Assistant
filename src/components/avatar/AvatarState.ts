import { useState, useCallback } from 'react'

/**
 * Supported states for the 3D Avatar:
 * IDLE, LISTENING, THINKING, SPEAKING, HAPPY, SURPRISED, CONFUSED
 */
export type AvatarState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'happy'
  | 'surprised'
  | 'confused'
  | 'concerned'
  | 'curious'
  | 'playful'
  | 'excited'
  | 'interrupted'

export interface AvatarStateConfig {
  state: AvatarState
  displayName: string
  description: string
}

export const AVATAR_STATE_CONFIGS: Record<AvatarState, AvatarStateConfig> = {
  idle: {
    state: 'idle',
    displayName: 'Neutral Idle',
    description: 'Relaxed upright humanoid posture with subtle natural breathing and blinking',
  },
  listening: {
    state: 'listening',
    displayName: 'Active Listening',
    description: 'Attentive posture with inquisitive head tilt and focused gaze',
  },
  thinking: {
    state: 'thinking',
    displayName: 'Processing',
    description: 'Contemplative thinking posture with hand-to-chin gesture and gaze shift',
  },
  speaking: {
    state: 'speaking',
    displayName: 'Speaking',
    description: 'Engaged conversational posture with real-time lip sync and speech accents',
  },
  happy: {
    state: 'happy',
    displayName: 'Joyful / Happy',
    description: 'Warm, joyful smiling expression with cheerful open posture',
  },
  surprised: {
    state: 'surprised',
    displayName: 'Surprised',
    description: 'Wide-eyed alert expression with perked posture',
  },
  confused: {
    state: 'confused',
    displayName: 'Confused / Puzzled',
    description: 'Puzzled sideways head tilt with thoughtful inquiring brow',
  },
  concerned: {
    state: 'concerned',
    displayName: 'Concerned / Empathetic',
    description: 'Gentle, empathetic posture with caring expression and warm head tilt',
  },
  curious: {
    state: 'curious',
    displayName: 'Curious / Inquisitive',
    description: 'Alert, inquisitive expression with prominent head tilt and engaged eyes',
  },
  playful: {
    state: 'playful',
    displayName: 'Playful / Witty',
    description: 'Charming, playful smile with inquisitive head tilt and friendly demeanor',
  },
  excited: {
    state: 'excited',
    displayName: 'Excited / Radiant',
    description: 'Energetic cheerful posture with wide bright smile and celebration',
  },
  interrupted: {
    state: 'interrupted',
    displayName: 'Interrupted',
    description: 'Immediate conversational interruption with alert listening posture',
  },
}

/**
 * Hook to manage avatar state.
 */
export function useAvatarState(initialState: AvatarState = 'idle') {
  const [avatarState, setAvatarState] = useState<AvatarState>(initialState)

  const setIdle = useCallback(() => setAvatarState('idle'), [])
  const setListening = useCallback(() => setAvatarState('listening'), [])
  const setThinking = useCallback(() => setAvatarState('thinking'), [])
  const setSpeaking = useCallback(() => setAvatarState('speaking'), [])
  const setHappy = useCallback(() => setAvatarState('happy'), [])
  const setSurprised = useCallback(() => setAvatarState('surprised'), [])
  const setConfused = useCallback(() => setAvatarState('confused'), [])
  const setConcerned = useCallback(() => setAvatarState('concerned'), [])
  const setCurious = useCallback(() => setAvatarState('curious'), [])
  const setPlayful = useCallback(() => setAvatarState('playful'), [])
  const setExcited = useCallback(() => setAvatarState('excited'), [])

  return {
    avatarState,
    setAvatarState,
    setIdle,
    setListening,
    setThinking,
    setSpeaking,
    setHappy,
    setSurprised,
    setConfused,
    setConcerned,
    setCurious,
    setPlayful,
    setExcited,
    config: AVATAR_STATE_CONFIGS[avatarState],
  }
}
