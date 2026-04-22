<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useVocabulary } from '../composables/useVocabulary.js'

const { getLessons, getAllVocabs, updateScore, updateMastery } = useVocabulary()

const lessons = computed(() => getLessons())
const selectedLessonIds = ref([])
const direction = ref('de-ar') // 'de-ar' or 'ar-de'
const isFlipped = ref(false)
const currentIndex = ref(0)
const sessionStarted = ref(false)
const sessionFinished = ref(false)

// Stage management: 'setup' | 'learn' | 'dragdrop' | 'flashcard'
const stage = ref('setup')

// Batch size selection
const batchSize = ref(10)

// Stats for current round
const known = ref(0)
const notKnown = ref(0)

// Current deck being studied
const deck = ref([])
// Cards missed in this round (for repeat)
const missedCards = ref([])
// Is this a "repeat mistakes only" round?
const isRepeatRound = ref(false)

// Pool management: all vocabs shuffled, with a pointer to track how far we've gone
const pool = ref([])         // shuffled full pool
const poolPointer = ref(0)   // how many cards have been drawn from pool so far

// The set of cards from the current "batch" (persists for "Nochmal")
const currentBatchCards = ref([])

// Round counter for display
const roundNumber = ref(1)

// --- Learn & Drag-Drop stage state ---
const learnGroups = ref([])       // currentBatchCards split into groups of 4
const learnGroupIndex = ref(0)    // which group we're currently on

// Drag-and-drop state
const ddGermanItems = ref([])     // German words (drop targets), in original order
const ddArabicItems = ref([])     // Arabic words (draggable), shuffled
const ddMatches = ref({})         // vocabId → true/false (matched correctly)
const ddDragId = ref(null)        // currently dragged vocab id
const ddHoverId = ref(null)       // currently hovered drop target vocab id
const ddWrongId = ref(null)       // flash wrong match
const ddAllMatched = computed(() => {
  const group = learnGroups.value[learnGroupIndex.value]
  if (!group || group.length === 0) return false
  return group.every(v => ddMatches.value[v.id])
})

// Available vocabs for selected lessons
const availableVocabs = computed(() => {
  return getAllVocabs(
    selectedLessonIds.value.length > 0 ? selectedLessonIds.value : null
  )
})

// Batch size options (steps of 5 up to max)
const batchOptions = computed(() => {
  const total = availableVocabs.value.length
  if (total === 0) return []
  const options = []
  for (let i = 5; i < total; i += 5) {
    options.push(i)
  }
  options.push(total)
  return options
})

// Whether there are still new cards left in the pool
const hasMoreNewCards = computed(() => poolPointer.value < pool.value.length)

watch(availableVocabs, (vocabs) => {
  if (vocabs.length > 0 && batchSize.value > vocabs.length) {
    batchSize.value = vocabs.length
  }
  if (vocabs.length > 0 && batchSize.value < 5) {
    batchSize.value = Math.min(5, vocabs.length)
  }
})

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Draw N new cards from the pool (never the same card twice)
function drawFromPool(count) {
  const drawn = pool.value.slice(poolPointer.value, poolPointer.value + count)
  poolPointer.value += drawn.length
  return drawn
}

// Split array into chunks of given size
function chunkArray(arr, size) {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

// --- Start a fresh learning session ---
function startSession() {
  const vocabs = availableVocabs.value
  if (vocabs.length === 0) return

  pool.value = shuffle(vocabs)
  poolPointer.value = 0
  roundNumber.value = 1

  const firstBatch = drawFromPool(batchSize.value)
  currentBatchCards.value = firstBatch

  sessionStarted.value = true
  sessionFinished.value = false

  // Only show learn+dragdrop for vocabs that have no mastery yet (grey/new)
  const newVocabs = firstBatch.filter(v => !v.mastery)
  if (newVocabs.length > 0) {
    learnGroups.value = chunkArray(newVocabs, 4)
    learnGroupIndex.value = 0
    stage.value = 'learn'
  } else {
    // All vocabs already studied before → skip to flashcards
    deck.value = shuffle(firstBatch)
    beginFlashcardRound()
  }
}

// Move from learn table to drag-drop for current group
function startDragDrop() {
  const group = learnGroups.value[learnGroupIndex.value]
  ddGermanItems.value = [...group]
  ddArabicItems.value = shuffle(group)
  ddMatches.value = {}
  ddDragId.value = null
  ddHoverId.value = null
  ddWrongId.value = null
  stage.value = 'dragdrop'
}

// Drag-and-drop handlers
function onDragStart(vocabId) {
  ddDragId.value = vocabId
}
function onDragEnd() {
  ddDragId.value = null
  ddHoverId.value = null
}
function onDragOver(e, vocabId) {
  e.preventDefault()
  ddHoverId.value = vocabId
}
function onDragLeave() {
  ddHoverId.value = null
}
function onDrop(e, targetVocabId) {
  e.preventDefault()
  ddHoverId.value = null
  if (!ddDragId.value) return

  if (ddDragId.value === targetVocabId) {
    // Correct match
    ddMatches.value = { ...ddMatches.value, [targetVocabId]: true }
  } else {
    // Wrong match – flash
    ddWrongId.value = targetVocabId
    setTimeout(() => { ddWrongId.value = null }, 600)
  }
  ddDragId.value = null
}

// Touch-based drag-and-drop
const touchDragId = ref(null)
const touchClone = ref(null)
const touchPressingId = ref(null)
let touchPressTimer = null
let touchStartX = 0
let touchStartY = 0
let touchLastX = 0
let touchLastY = 0
const LONG_PRESS_MS = 260
const PRESS_CANCEL_MOVE_PX = 12

function clearTouchPressTimer() {
  if (touchPressTimer) {
    clearTimeout(touchPressTimer)
    touchPressTimer = null
  }
}

function activateTouchDrag(vocabId, sourceEl, x, y) {
  if (!sourceEl) return
  if (touchPressingId.value !== vocabId) return

  touchDragId.value = vocabId
  ddDragId.value = vocabId
  ddHoverId.value = null

  const clone = sourceEl.cloneNode(true)
  clone.classList.add('dd-touch-clone')
  clone.style.position = 'fixed'
  clone.style.left = (x - 60) + 'px'
  clone.style.top = (y - 20) + 'px'
  clone.style.zIndex = '1000'
  clone.style.pointerEvents = 'none'
  document.body.appendChild(clone)
  touchClone.value = clone

  // Prevent page scroll while dragging on mobile devices.
  document.body.style.overflow = 'hidden'
}

function cleanupTouchDrag() {
  clearTouchPressTimer()
  if (touchClone.value) {
    touchClone.value.remove()
    touchClone.value = null
  }
  touchPressingId.value = null
  touchDragId.value = null
  ddDragId.value = null
  ddHoverId.value = null
  document.body.style.overflow = ''
}

function onTouchStart(e, vocabId) {
  const touch = e.touches[0]
  const sourceEl = e.currentTarget
  if (!touch || !sourceEl) return

  clearTouchPressTimer()
  touchPressingId.value = vocabId
  ddHoverId.value = null
  touchStartX = touch.clientX
  touchStartY = touch.clientY
  touchLastX = touch.clientX
  touchLastY = touch.clientY

  touchPressTimer = setTimeout(() => {
    activateTouchDrag(vocabId, sourceEl, touchLastX, touchLastY)
  }, LONG_PRESS_MS)
}

function onTouchMove(e) {
  const touch = e.touches[0]
  if (!touch) return

  touchLastX = touch.clientX
  touchLastY = touch.clientY

  if (!touchDragId.value) {
    const movedX = Math.abs(touch.clientX - touchStartX)
    const movedY = Math.abs(touch.clientY - touchStartY)
    if (movedX > PRESS_CANCEL_MOVE_PX || movedY > PRESS_CANCEL_MOVE_PX) {
      clearTouchPressTimer()
      touchPressingId.value = null
    }
    return
  }

  e.preventDefault()
  if (!touchClone.value) return
  touchClone.value.style.left = (touch.clientX - 60) + 'px'
  touchClone.value.style.top = (touch.clientY - 20) + 'px'

  const hoverEl = document.elementFromPoint(touch.clientX, touch.clientY)
  const hoverTarget = hoverEl?.closest('[data-vocab-id]')
  ddHoverId.value = hoverTarget ? hoverTarget.getAttribute('data-vocab-id') : null
}
function onTouchEnd(e) {
  clearTouchPressTimer()

  if (!touchDragId.value) {
    touchPressingId.value = null
    return
  }

  const touch = e.changedTouches[0]
  const dropEl = document.elementFromPoint(touch.clientX, touch.clientY)
  const targetEl = dropEl?.closest('[data-vocab-id]')

  if (targetEl) {
    const targetId = targetEl.getAttribute('data-vocab-id')
    const draggedId = String(touchDragId.value)
    if (draggedId === targetId) {
      ddMatches.value = { ...ddMatches.value, [targetId]: true }
    } else {
      ddWrongId.value = targetId
      setTimeout(() => { ddWrongId.value = null }, 600)
    }
  }
  cleanupTouchDrag()
}

function onTouchCancel() {
  cleanupTouchDrag()
}

// Advance from drag-drop: next group or flashcard stage
function advanceFromDragDrop() {
  if (learnGroupIndex.value < learnGroups.value.length - 1) {
    learnGroupIndex.value++
    stage.value = 'learn'
  } else {
    // All groups done → start flashcard stage
    deck.value = shuffle(currentBatchCards.value)
    beginFlashcardRound()
  }
}

// --- "Nochmal": repeat exactly the same cards (skip learn phase) ---
function repeatSameBatch() {
  roundNumber.value++
  deck.value = shuffle(currentBatchCards.value)
  beginFlashcardRound()
}

// --- "Weiter": missed cards + new cards to fill up to batchSize ---
function nextRound() {
  roundNumber.value++
  isRepeatRound.value = false

  const carried = [...missedCards.value]
  const slotsForNew = Math.max(0, batchSize.value - carried.length)
  const newCards = drawFromPool(slotsForNew)
  const nextBatch = [...carried, ...newCards]

  currentBatchCards.value = nextBatch

  // Only show learn+dragdrop for truly new cards (no mastery yet)
  const newForLearn = newCards.filter(v => !v.mastery)
  if (newForLearn.length > 0) {
    learnGroups.value = chunkArray(newForLearn, 4)
    learnGroupIndex.value = 0
    stage.value = 'learn'
  } else {
    // No new vocabs to learn → skip to flashcards
    deck.value = shuffle(nextBatch)
    beginFlashcardRound()
  }
  sessionStarted.value = true
  sessionFinished.value = false
}

// startRepeatRound is no longer needed – errors auto-repeat

// Common flashcard round setup
function beginFlashcardRound() {
  currentIndex.value = 0
  isFlipped.value = false
  known.value = 0
  notKnown.value = 0
  missedCards.value = []
  isRepeatRound.value = false
  sessionStarted.value = true
  sessionFinished.value = false
  stage.value = 'flashcard'
}

const currentCard = computed(() => deck.value[currentIndex.value] || null)

const frontText = computed(() => {
  if (!currentCard.value) return ''
  return direction.value === 'de-ar'
    ? currentCard.value.german
    : currentCard.value.arabic
})

const backText = computed(() => {
  if (!currentCard.value) return ''
  return direction.value === 'de-ar'
    ? currentCard.value.arabic
    : currentCard.value.german
})

const frontDir = computed(() => (direction.value === 'de-ar' ? 'ltr' : 'rtl'))
const backDir = computed(() => (direction.value === 'de-ar' ? 'rtl' : 'ltr'))

const progressPercent = computed(() => {
  if (deck.value.length === 0) return 0
  return Math.round((currentIndex.value / deck.value.length) * 100)
})

// --- TTS ---
function getArabicVoice() {
  const voices = speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang === 'ar-EG') ||
    voices.find((v) => v.lang.startsWith('ar')) ||
    null
  )
}

function speakArabic(text) {
  if (!text || !('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ar-EG'
  const voice = getArabicVoice()
  if (voice) utterance.voice = voice
  utterance.rate = 0.85
  speechSynthesis.speak(utterance)
}

function speakCurrentArabic() {
  if (!currentCard.value) return
  speakArabic(currentCard.value.arabic)
}

if ('speechSynthesis' in window) {
  speechSynthesis.getVoices()
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices()
}

// --- Card actions ---
function flipCard() {
  isFlipped.value = !isFlipped.value
}

function answer(isKnown) {
  if (!currentCard.value) return
  const card = currentCard.value

  updateScore(card.lessonId, card.id, isKnown)

  if (isKnown) {
    known.value++
    // Green: got it right in the main round
    // Yellow: got it right in the repeat round (but not in main round → only upgrades)
    updateMastery(card.lessonId, card.id, isRepeatRound.value ? 'yellow' : 'green')
  } else {
    notKnown.value++
    missedCards.value.push(card)
    // Red: failed in repeat round (still doesn't know it)
    // In main round: don't set red yet — give the repeat round a chance
    if (isRepeatRound.value) {
      updateMastery(card.lessonId, card.id, 'red')
    }
  }

  if (currentIndex.value < deck.value.length - 1) {
    currentIndex.value++
    isFlipped.value = false
  } else {
    // Round ended — if main round, mark all missed cards as red
    if (!isRepeatRound.value) {
      for (const missed of missedCards.value) {
        updateMastery(missed.lessonId, missed.id, 'red')
      }
    }

    // Auto-repeat missed cards until all correct
    if (missedCards.value.length > 0) {
      const toRepeat = [...missedCards.value]
      missedCards.value = []
      deck.value = shuffle(toRepeat)
      isRepeatRound.value = true
      currentIndex.value = 0
      isFlipped.value = false
      known.value = 0
      notKnown.value = 0
    } else {
      sessionFinished.value = true
    }
  }
}

function resetSession() {
  cleanupTouchDrag()
  sessionStarted.value = false
  sessionFinished.value = false
  isRepeatRound.value = false
  stage.value = 'setup'
  deck.value = []
  missedCards.value = []
  pool.value = []
  poolPointer.value = 0
  currentBatchCards.value = []
  learnGroups.value = []
  learnGroupIndex.value = 0
}

watch(selectedLessonIds, () => {
  if (sessionStarted.value) resetSession()
})
</script>

<template>
  <div class="flashcard-section">
    <h2>🗂️ Karteikarten</h2>

    <!-- Session setup -->
    <div v-if="!sessionStarted" class="card mt-2">
      <div class="mb-2">
        <label>Lektionen auswählen</label>
        <div class="lesson-checkboxes">
          <label v-for="lesson in lessons" :key="lesson.id" class="checkbox-label">
            <input
              type="checkbox"
              :value="lesson.id"
              v-model="selectedLessonIds"
            />
            {{ lesson.title }}
            <span class="text-light">({{ lesson.vocabs.length }})</span>
          </label>
        </div>
        <p v-if="lessons.length === 0" class="text-light mt-1">
          Noch keine Lektionen vorhanden. Lade zuerst Vokabeln hoch.
        </p>
      </div>

      <!-- Batch size -->
      <div v-if="availableVocabs.length > 0" class="mb-2">
        <label>Anzahl Vokabeln</label>
        <select v-model.number="batchSize">
          <option v-for="n in batchOptions" :key="n" :value="n">
            {{ n === availableVocabs.length ? `Alle (${n})` : n }}
          </option>
        </select>
      </div>

      <div class="mb-2">
        <label>Abfragerichtung</label>
        <div class="flex" style="gap: 0.5rem">
          <button
            class="btn btn-sm"
            :class="direction === 'de-ar' ? 'btn-primary' : 'btn-outline'"
            @click="direction = 'de-ar'"
          >
            Deutsch → Arabisch
          </button>
          <button
            class="btn btn-sm"
            :class="direction === 'ar-de' ? 'btn-primary' : 'btn-outline'"
            @click="direction = 'ar-de'"
          >
            Arabisch → Deutsch
          </button>
        </div>
      </div>

      <button
        class="btn btn-primary btn-lg"
        style="width: 100%"
        :disabled="availableVocabs.length === 0"
        @click="startSession"
      >
        Abfrage starten
      </button>
    </div>

    <!-- ========== LEARN STAGE ========== -->
    <div v-else-if="stage === 'learn'" class="card mt-2">
      <div class="learn-header">
        <span class="text-light" style="font-size: 0.85rem">
          📖 Lernphase – Gruppe {{ learnGroupIndex + 1 }} / {{ learnGroups.length }}
        </span>
      </div>
      <h3 class="mb-2">Präge dir diese Vokabeln ein:</h3>
      <table class="learn-table">
        <thead>
          <tr>
            <th style="text-align: left">Deutsch</th>
            <th style="text-align: right">Arabisch</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="vocab in learnGroups[learnGroupIndex]" :key="vocab.id">
            <td>{{ vocab.german }}</td>
            <td class="rtl" style="text-align: right; font-size: 1.3rem">{{ vocab.arabic }}</td>
          </tr>
        </tbody>
      </table>
      <button
        class="btn btn-primary btn-lg mt-3"
        style="width: 100%"
        @click="startDragDrop"
      >
        Weiter →
      </button>
      <button class="btn btn-outline btn-sm mt-2" @click="resetSession">
        Abbrechen
      </button>
    </div>

    <!-- ========== DRAG & DROP STAGE ========== -->
    <div v-else-if="stage === 'dragdrop'" class="card mt-2">
      <div class="learn-header">
        <span class="text-light" style="font-size: 0.85rem">
          🎯 Zuordnen – Gruppe {{ learnGroupIndex + 1 }} / {{ learnGroups.length }}
        </span>
      </div>
      <h3 class="mb-2">Ziehe das arabische Wort auf die passende Übersetzung:</h3>
      <p class="text-light" style="font-size: 0.85rem; margin-bottom: 0.6rem">
        Auf Mobilgeräten: Wort kurz gedrückt halten, dann ziehen.
      </p>

      <div class="dd-container">
        <!-- German drop targets -->
        <div class="dd-column">
          <div
            v-for="vocab in ddGermanItems"
            :key="'de-' + vocab.id"
            class="dd-german-item"
            :class="{
              'dd-matched': ddMatches[vocab.id],
              'dd-hover': ddHoverId === vocab.id && !ddMatches[vocab.id],
              'dd-wrong': ddWrongId === vocab.id
            }"
            :data-vocab-id="vocab.id"
            @dragover="!ddMatches[vocab.id] && onDragOver($event, vocab.id)"
            @dragleave="onDragLeave"
            @drop="!ddMatches[vocab.id] && onDrop($event, vocab.id)"
          >
            <span>{{ vocab.german }}</span>
            <span v-if="ddMatches[vocab.id]" class="dd-check">✓</span>
          </div>
        </div>

        <!-- Arabic draggable items -->
        <div class="dd-column">
          <div
            v-for="vocab in ddArabicItems"
            :key="'ar-' + vocab.id"
            class="dd-arabic-item rtl"
            :class="{
              'dd-matched': ddMatches[vocab.id],
              'dd-dragging': ddDragId === vocab.id,
              'dd-pressing': touchPressingId === vocab.id && ddDragId !== vocab.id
            }"
            :draggable="!ddMatches[vocab.id]"
            @dragstart="!ddMatches[vocab.id] && onDragStart(vocab.id)"
            @dragend="onDragEnd"
            @touchstart="!ddMatches[vocab.id] && onTouchStart($event, vocab.id)"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
            @touchcancel="onTouchCancel"
          >
            {{ vocab.arabic }}
          </div>
        </div>
      </div>

      <button
        v-if="ddAllMatched"
        class="btn btn-primary btn-lg mt-3"
        style="width: 100%"
        @click="advanceFromDragDrop"
      >
        {{ learnGroupIndex < learnGroups.length - 1 ? 'Nächste Gruppe →' : 'Weiter zu Karteikarten →' }}
      </button>
      <button class="btn btn-outline btn-sm mt-2" @click="resetSession">
        Abbrechen
      </button>
    </div>

    <!-- ========== FLASHCARD STAGE ========== -->
    <div v-else-if="stage === 'flashcard' && !sessionFinished">
      <!-- Progress -->
      <div class="flex items-center justify-between mt-2 mb-1">
        <span class="text-light" style="font-size: 0.85rem">
          <template v-if="isRepeatRound">🔁 Fehler wiederholen – </template>
          Karte {{ currentIndex + 1 }} / {{ deck.length }}
        </span>
        <span class="text-light" style="font-size: 0.85rem">
          ✓ {{ known }} &nbsp; ✗ {{ notKnown }}
        </span>
      </div>
      <div class="progress-bar mb-2">
        <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>

      <!-- Flashcard -->
      <div class="flashcard-container" @click="flipCard">
        <div class="flashcard" :class="{ 'flashcard--flipped': isFlipped }">
          <div class="flashcard-face flashcard-front" :class="frontDir">
            <span class="flashcard-text">{{ frontText }}</span>
            <!-- Speaker on front if Arabic is shown -->
            <button
              v-if="direction === 'ar-de'"
              class="speak-btn"
              @click.stop="speakCurrentArabic"
              title="Aussprechen"
            >🔊</button>
            <span class="flip-hint text-light">Klick zum Umdrehen</span>
          </div>
          <div class="flashcard-face flashcard-back" :class="backDir">
            <span class="flashcard-text">{{ backText }}</span>
            <!-- Speaker on back if Arabic is shown -->
            <button
              v-if="direction === 'de-ar'"
              class="speak-btn"
              @click.stop="speakCurrentArabic"
              title="Aussprechen"
            >🔊</button>
          </div>
        </div>
      </div>

      <!-- Answer buttons -->
      <div class="flex mt-2" style="gap: 0.75rem">
        <button
          class="btn btn-danger btn-lg"
          style="flex: 1"
          @click="answer(false)"
        >
          ✗ Nicht gewusst
        </button>
        <button
          class="btn btn-success btn-lg"
          style="flex: 1"
          @click="answer(true)"
        >
          ✓ Gewusst
        </button>
      </div>

      <button class="btn btn-outline btn-sm mt-2" @click="resetSession">
        Abbrechen
      </button>
    </div>

    <!-- Session finished (all cards answered correctly) -->
    <div v-else-if="sessionFinished" class="card mt-2 text-center">
      <h2>🎉 Alle richtig!</h2>

      <p class="mt-1">
        <strong>{{ deck.length }}</strong> Vokabeln abgefragt
      </p>
      <div class="flex justify-center mt-2" style="gap: 2rem; font-size: 1.2rem">
        <span style="color: var(--color-success)">✓ {{ known }}</span>
      </div>

      <div class="flex mt-2" style="gap: 0.75rem">
        <button class="btn btn-outline btn-lg" style="flex: 1" @click="repeatSameBatch">
          🔄 Nochmal
        </button>
        <button
          v-if="hasMoreNewCards"
          class="btn btn-primary btn-lg"
          style="flex: 1"
          @click="nextRound"
        >
          ▶ Nächste {{ Math.min(batchSize, pool.length - poolPointer) }} Vokabeln
        </button>
        <button class="btn btn-outline btn-lg" style="flex: 1" @click="resetSession">
          Zurück
        </button>
      </div>

      <p v-if="hasMoreNewCards" class="text-light mt-1" style="font-size: 0.8rem">
        {{ poolPointer }} / {{ pool.length }} Vokabeln gelernt
      </p>
    </div>
  </div>
</template>

<style scoped>
.lesson-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.25rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 400;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
}

/* Flashcard */
.flashcard-container {
  perspective: 800px;
  cursor: pointer;
}

.flashcard {
  position: relative;
  width: 100%;
  min-height: 220px;
  transition: transform 0.5s ease;
  transform-style: preserve-3d;
}

.flashcard--flipped {
  transform: rotateY(180deg);
}

.flashcard-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  background: var(--color-card);
}

.flashcard-front {
  background: linear-gradient(135deg, #ffffff 0%, #f0f4f8 100%);
}

.flashcard-back {
  transform: rotateY(180deg);
  background: linear-gradient(135deg, #f0f8f4 0%, #ffffff 100%);
}

.flashcard-text {
  font-size: 1.6rem;
  font-weight: 600;
  line-height: 1.4;
}

.flip-hint {
  font-size: 0.8rem;
  margin-top: 1rem;
}

.rtl .flashcard-text {
  font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif;
  direction: rtl;
}

/* Speaker button */
.speak-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  font-size: 1.4rem;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity var(--transition), transform var(--transition);
  padding: 0.25rem;
  line-height: 1;
}

.speak-btn:hover {
  opacity: 1;
  transform: scale(1.15);
}

/* Accent button for repeat round */
.btn-accent {
  background: var(--color-accent);
  color: #fff;
}

.btn-accent:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

/* ===== Learn Table ===== */
.learn-header {
  margin-bottom: 0.5rem;
}

.learn-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
}

.learn-table th {
  padding: 0.5rem 0.75rem;
  border-bottom: 2px solid var(--color-border);
  font-size: 0.85rem;
  color: var(--color-text-light);
  font-weight: 600;
}

.learn-table td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--color-border);
  font-size: 1.1rem;
}

.learn-table tr:last-child td {
  border-bottom: none;
}

.learn-table .rtl {
  font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif;
  direction: rtl;
}

/* ===== Drag & Drop ===== */
.dd-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 0.5rem;
}

.dd-column {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dd-german-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--color-card);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius);
  font-size: 1rem;
  min-height: 3rem;
  transition: all 0.2s ease;
}

.dd-german-item.dd-hover {
  border-color: var(--color-primary);
  background: rgba(42, 111, 151, 0.08);
  transform: scale(1.02);
}

.dd-german-item.dd-matched {
  border-color: var(--color-success);
  border-style: solid;
  background: rgba(45, 134, 89, 0.1);
}

.dd-german-item.dd-wrong {
  border-color: var(--color-danger);
  background: rgba(192, 57, 43, 0.1);
  animation: shake 0.4s ease;
}

.dd-check {
  color: var(--color-success);
  font-weight: bold;
  font-size: 1.2rem;
}

.dd-arabic-item {
  padding: 0.75rem 1rem;
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius);
  font-size: 1.2rem;
  font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif;
  direction: rtl;
  text-align: center;
  cursor: grab;
  user-select: none;
  transition: all 0.2s ease;
  min-height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-user-select: none;
  touch-action: pan-y;
}

.dd-arabic-item:active {
  cursor: grabbing;
}

.dd-arabic-item.dd-dragging {
  opacity: 0.4;
  transform: scale(0.95);
}

.dd-arabic-item.dd-pressing {
  transform: scale(0.97);
  box-shadow: 0 0 0 3px rgba(42, 111, 151, 0.25);
}

.dd-arabic-item.dd-matched {
  background: var(--color-success);
  cursor: default;
  opacity: 0.7;
}

.dd-touch-clone {
  padding: 0.75rem 1rem;
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius);
  font-size: 1.2rem;
  font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif;
  direction: rtl;
  text-align: center;
  box-shadow: var(--shadow-lg);
  opacity: 0.9;
  white-space: nowrap;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
</style>
