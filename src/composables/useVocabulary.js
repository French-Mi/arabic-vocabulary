import { ref, watchEffect } from 'vue'

const STORAGE_KEY = 'arabisch-vokabeln-data'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (Array.isArray(data.lessons)) return data
    }
  } catch {
    // corrupted data, start fresh
  }
  return { lessons: [] }
}

const state = ref(loadFromStorage())

watchEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value))
})

export function useVocabulary() {
  function getLessons() {
    return state.value.lessons
  }

  function getLesson(lessonId) {
    return state.value.lessons.find((l) => l.id === lessonId) || null
  }

  function createLesson(title) {
    const lesson = {
      id: generateId(),
      title: title.trim(),
      createdAt: new Date().toISOString(),
      vocabs: [],
    }
    state.value.lessons.push(lesson)
    // trigger reactivity
    state.value = { ...state.value }
    return lesson
  }

  function renameLesson(lessonId, newTitle) {
    const lesson = getLesson(lessonId)
    if (lesson) {
      lesson.title = newTitle.trim()
      state.value = { ...state.value }
    }
  }

  function deleteLesson(lessonId) {
    state.value.lessons = state.value.lessons.filter((l) => l.id !== lessonId)
    state.value = { ...state.value }
  }

  function addBatch(lessonId, pairs) {
    const lesson = getLesson(lessonId)
    if (!lesson) return
    const newVocabs = pairs
      .filter((p) => p.german.trim() || p.arabic.trim())
      .map((p) => ({
        id: generateId(),
        german: p.german.trim(),
        arabic: p.arabic.trim(),
        score: 0,
      }))
    lesson.vocabs.push(...newVocabs)
    state.value = { ...state.value }
  }

  function deletePair(lessonId, vocabId) {
    const lesson = getLesson(lessonId)
    if (!lesson) return
    lesson.vocabs = lesson.vocabs.filter((v) => v.id !== vocabId)
    state.value = { ...state.value }
  }

  function updateScore(lessonId, vocabId, known) {
    const lesson = getLesson(lessonId)
    if (!lesson) return
    const vocab = lesson.vocabs.find((v) => v.id === vocabId)
    if (vocab) {
      vocab.score += known ? 1 : -1
      state.value = { ...state.value }
    }
  }

  // Mastery levels: 'green' (best) > 'yellow' > 'red' > undefined (not yet studied)
  const MASTERY_RANK = { green: 3, yellow: 2, red: 1 }

  function updateMastery(lessonId, vocabId, level) {
    const lesson = getLesson(lessonId)
    if (!lesson) return
    const vocab = lesson.vocabs.find((v) => v.id === vocabId)
    if (!vocab) return
    const currentRank = MASTERY_RANK[vocab.mastery] || 0
    const newRank = MASTERY_RANK[level] || 0
    if (newRank > currentRank) {
      vocab.mastery = level
      state.value = { ...state.value }
    }
  }

  function getAllVocabs(lessonIds = null) {
    let lessons = state.value.lessons
    if (lessonIds && lessonIds.length > 0) {
      lessons = lessons.filter((l) => lessonIds.includes(l.id))
    }
    return lessons.flatMap((l) =>
      l.vocabs.map((v) => ({ ...v, lessonId: l.id, lessonTitle: l.title }))
    )
  }

  return {
    state,
    getLessons,
    getLesson,
    createLesson,
    renameLesson,
    deleteLesson,
    addBatch,
    deletePair,
    updateScore,
    updateMastery,
    getAllVocabs,
  }
}
