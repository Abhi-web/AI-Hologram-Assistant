/**
 * EmotionIntentDetector — Real-time linguistic and semantic classifier
 * that analyzes user inputs and AI assistant responses to detect
 * emotional valence, communicative intent, and expressive triggers
 * for the 3D Anime Avatar companion.
 */

export type CompanionEmotion =
  | 'neutral'
  | 'happy'
  | 'excited'
  | 'playful'
  | 'curious'
  | 'thoughtful'
  | 'surprised'
  | 'empathetic'
  | 'greeting'
  | 'concerned'
  | 'attentive'
  | 'sad'

export type CompanionIntent =
  | 'greeting'
  | 'question'
  | 'thinking'
  | 'farewell'
  | 'explanation'
  | 'casual'

export type CompanionGestureType =
  | 'none'
  | 'wave'
  | 'thinking_pose'
  | 'welcome'
  | 'speech_accent'
  | 'nod'
  | 'curious_tilt'

export interface EmotionAnalysisResult {
  emotion: CompanionEmotion
  intent: CompanionIntent
  intensity: number // 0.0 - 1.0
  valence: number // -1.0 (negative) to 1.0 (positive)
  recommendedGesture: CompanionGestureType
  headTiltAngle: number // radians
  smileWeight: number // 0.0 - 1.0
  surpriseWeight: number // 0.0 - 1.0
  thinkingWeight: number // 0.0 - 1.0
}

// ─── Lexicon Patterns ────────────────────────────────────────────────────────

const GREETING_PATTERNS = [
  /\b(hello|hi|hey|greetings|howdy|good\s+(morning|afternoon|evening|day)|welcome|yo)\b/i,
  /\b(nice\s+to\s+meet|pleased\s+to\s+meet|glad\s+to\s+see)\b/i,
  /\b(aria|assistant)\b/i,
]

const FAREWELL_PATTERNS = [
  /\b(bye|goodbye|see\s+you|later|farewell|goodnight|take\s+care|cya)\b/i,
]

const PLAYFUL_PATTERNS = [
  /\b(you('re| are)\s+funny|funny|joke|joking|kidding|haha|hehe|tease|silly|witty|playful|hilarious|make me laugh|humor|amusing)\b/i,
  /(😜|😋|😏|😂|🤣)/,
]

const EXCITED_PATTERNS = [
  /\b(so excited|can't wait|cannot wait|thrilled|super excited|pumped|hyped|lets go|let's go|huge news|incredible news)\b/i,
  /(🎉|🚀|🔥|🤩)/,
]

const ATTENTIVE_PATTERNS = [
  /\b(listen\s+(carefully|closely)|pay\s+attention|focus|important|critical|need\s+(your\s+)?advice|take\s+a\s+look|look\s+at\s+this)\b/i,
]

const SAD_PATTERNS = [
  /\b(sad|depressed|unhappy|crying|feeling\s+down|rough\s+day|bad\s+day|heartbroken|lonely|hurts|grief)\b/i,
  /(😭|😿|😞|😔)/,
]

const HAPPY_PATTERNS = [
  /\b(great|awesome|excellent|amazing|wonderful|fantastic|yay|cool|love|happy|glad|good job|brilliant|nice|perfect|thank|thanks|appreciate|smile|delighted)\b/i,
  /\b(finally\s+(completed|finished|did\s+it)|completed\s+my|finished\s+my|got\s+it\s+working|success|it\s+works?|worked|achieved|celebrat)\b/i,
  /(!{2,}|:\)|:-\)|😊|😄|✨|❤️)/,
]

const SURPRISED_PATTERNS = [
  /\b(wow|whoa|omg|unbelievable|really\??|no way|incredible|astonishing|fascinating|shocking|are you sure|seriously)\b/i,
  /(\?!+|\bwhat\?!\b|😮|😲|🤯)/,
]

const CONCERNED_PATTERNS = [
  /\b(don't\s+understand|do\s+not\s+understand|can't\s+understand|cannot\s+understand|not\s+sure\s+how|confused|help\s+me|having\s+trouble|struggling|error|failed|issue|problem|broken|stuck|lost|hard\s+to\s+grasp)\b/i,
  /\b(sorry|apologize|unfortunate|feel better|comfort|worried|stress|difficult|tough|it's okay|no worries|care for)\b/i,
  /(😢|🥺|💔)/,
]

const THOUGHTFUL_PATTERNS = [
  /\b(think|ponder|analyze|calculate|consider|reason|solve|complex|algorithm|code|debug|why does|how come|architect|explain the logic|hmm|let me see)\b/i,
  /\b(philosophy|deep|meaning|concept|evaluate|compare)\b/i,
]

const QUESTION_PATTERNS = [
  /\?$/,
  /\b(what|why|how|when|where|who|which|whose|can you|could you|would you|is it|are you|do you|tell me|explain|curious|wondering)\b/i,
]

export class EmotionIntentDetector {
  /**
   * Analyze input text (user message or AI response) and produce
   * an EmotionAnalysisResult driving facial expressions, head tilts, and gestures.
   */
  public analyze(text: string, isAssistant = false): EmotionAnalysisResult {
    const cleanText = (text || '').trim()
    if (!cleanText) {
      return this.getDefaultResult()
    }

    // 1. Detect Intent
    const intent = this.detectIntent(cleanText)

    // 2. Detect Primary Emotion & Intensity
    const { emotion, intensity, valence } = this.detectEmotion(cleanText, intent)

    // 3. Map to Recommended Gesture, Head Tilt, and Expression Weights
    return this.synthesizeResult(intent, emotion, intensity, valence, isAssistant)
  }

  private detectIntent(text: string): CompanionIntent {
    if (GREETING_PATTERNS.some((p) => p.test(text))) {
      return 'greeting'
    }
    if (FAREWELL_PATTERNS.some((p) => p.test(text))) {
      return 'farewell'
    }
    if (QUESTION_PATTERNS.some((p) => p.test(text))) {
      return 'question'
    }
    if (THOUGHTFUL_PATTERNS.some((p) => p.test(text))) {
      return 'thinking'
    }
    if (text.length > 250 || text.includes('```')) {
      return 'explanation'
    }
    return 'casual'
  }

  private detectEmotion(
    text: string,
    intent: CompanionIntent
  ): { emotion: CompanionEmotion; intensity: number; valence: number } {
    let happyScore = 0
    let playfulScore = 0
    let excitedScore = 0
    let surprisedScore = 0
    let concernedScore = 0
    let thoughtfulScore = 0
    let attentiveScore = 0
    let sadScore = 0
    let greetingScore = intent === 'greeting' ? 0.9 : 0

    // Match counts and scores
    if (PLAYFUL_PATTERNS.some((p) => p.test(text))) playfulScore += 0.9
    if (EXCITED_PATTERNS.some((p) => p.test(text))) excitedScore += 0.9
    if (ATTENTIVE_PATTERNS.some((p) => p.test(text))) attentiveScore += 0.85
    if (SAD_PATTERNS.some((p) => p.test(text))) sadScore += 0.85
    if (HAPPY_PATTERNS.some((p) => p.test(text))) happyScore += 0.85
    if (SURPRISED_PATTERNS.some((p) => p.test(text))) surprisedScore += 0.9
    if (CONCERNED_PATTERNS.some((p) => p.test(text))) concernedScore += 0.85
    if (THOUGHTFUL_PATTERNS.some((p) => p.test(text))) thoughtfulScore += 0.75

    // Exclamation bonus
    const exclamations = (text.match(/!/g) || []).length
    if (exclamations > 0) {
      happyScore += Math.min(exclamations * 0.1, 0.3)
      surprisedScore += Math.min(exclamations * 0.15, 0.4)
      excitedScore += Math.min(exclamations * 0.2, 0.4)
    }

    // Determine highest scoring emotion
    if (greetingScore > 0.6) {
      return { emotion: 'greeting', intensity: greetingScore, valence: 0.8 }
    }
    if (playfulScore >= 0.8) {
      return { emotion: 'playful', intensity: Math.min(playfulScore, 1.0), valence: 0.8 }
    }
    if (excitedScore >= 0.8) {
      return { emotion: 'excited', intensity: Math.min(excitedScore, 1.0), valence: 0.95 }
    }
    if (surprisedScore >= 0.8) {
      return { emotion: 'surprised', intensity: Math.min(surprisedScore, 1.0), valence: 0.6 }
    }
    if (concernedScore >= 0.8) {
      return { emotion: 'concerned', intensity: Math.min(concernedScore, 1.0), valence: 0.3 }
    }
    if (attentiveScore >= 0.8) {
      return { emotion: 'attentive', intensity: Math.min(attentiveScore, 1.0), valence: 0.4 }
    }
    if (sadScore >= 0.8) {
      return { emotion: 'sad', intensity: Math.min(sadScore, 1.0), valence: -0.6 }
    }
    if (happyScore >= 0.7) {
      return { emotion: 'happy', intensity: Math.min(happyScore, 1.0), valence: 0.9 }
    }
    if (thoughtfulScore >= 0.6 || intent === 'thinking') {
      return { emotion: 'thoughtful', intensity: Math.min(thoughtfulScore || 0.7, 1.0), valence: 0.1 }
    }
    if (intent === 'question') {
      return { emotion: 'curious', intensity: 0.75, valence: 0.4 }
    }

    return { emotion: 'neutral', intensity: 0.5, valence: 0.2 }
  }

  private synthesizeResult(
    intent: CompanionIntent,
    emotion: CompanionEmotion,
    intensity: number,
    valence: number,
    isAssistant: boolean
  ): EmotionAnalysisResult {
    let recommendedGesture: CompanionGestureType = 'none'
    let headTiltAngle = 0
    let smileWeight = 0.15
    let surpriseWeight = 0
    let thinkingWeight = 0

    switch (emotion) {
      case 'greeting':
        recommendedGesture = 'wave'
        smileWeight = 0.65 * intensity
        headTiltAngle = 0.05
        break

      case 'happy':
        recommendedGesture = isAssistant ? 'speech_accent' : 'welcome'
        smileWeight = 0.8 * intensity
        headTiltAngle = 0.03
        break

      case 'excited':
        recommendedGesture = 'welcome'
        smileWeight = 0.9 * intensity
        surpriseWeight = 0.35 * intensity
        headTiltAngle = 0.04
        break

      case 'playful':
        recommendedGesture = 'curious_tilt'
        smileWeight = 0.65 * intensity
        surpriseWeight = 0.15
        headTiltAngle = 0.065
        break

      case 'attentive':
        recommendedGesture = 'nod'
        smileWeight = 0.18
        surpriseWeight = 0.22
        headTiltAngle = 0.05
        break

      case 'sad':
        recommendedGesture = 'none'
        smileWeight = 0
        thinkingWeight = 0.4
        headTiltAngle = -0.04
        break

      case 'surprised':
        recommendedGesture = 'speech_accent'
        surpriseWeight = 0.85 * intensity
        smileWeight = 0.25
        headTiltAngle = -0.05
        break

      case 'concerned':
        recommendedGesture = 'speech_accent'
        headTiltAngle = -0.05 * intensity
        smileWeight = 0.12
        surpriseWeight = 0.08
        thinkingWeight = 0.2
        break

      case 'curious':
        recommendedGesture = 'curious_tilt'
        headTiltAngle = 0.085 * intensity
        smileWeight = 0.25
        surpriseWeight = 0.2
        break

      case 'thoughtful':
        recommendedGesture = 'thinking_pose'
        thinkingWeight = 0.7 * intensity
        headTiltAngle = -0.05
        smileWeight = 0.05
        break

      case 'empathetic':
        recommendedGesture = 'speech_accent'
        smileWeight = 0.25
        headTiltAngle = 0.04
        break

      case 'neutral':
      default:
        if (intent === 'greeting') {
          recommendedGesture = 'wave'
          smileWeight = 0.5
        } else if (intent === 'question') {
          headTiltAngle = 0.06
          smileWeight = 0.2
        } else if (isAssistant) {
          recommendedGesture = 'speech_accent'
          smileWeight = 0.2
        }
        break
    }

    return {
      emotion,
      intent,
      intensity,
      valence,
      recommendedGesture,
      headTiltAngle,
      smileWeight,
      surpriseWeight,
      thinkingWeight,
    }
  }

  public getDefaultResult(): EmotionAnalysisResult {
    return {
      emotion: 'neutral',
      intent: 'casual',
      intensity: 0.5,
      valence: 0.2,
      recommendedGesture: 'none',
      headTiltAngle: 0,
      smileWeight: 0.15,
      surpriseWeight: 0,
      thinkingWeight: 0,
    }
  }
}

export const emotionIntentDetector = new EmotionIntentDetector()
