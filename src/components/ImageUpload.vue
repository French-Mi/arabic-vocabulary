<script setup>
import { ref, computed } from 'vue'
import { useVocabulary } from '../composables/useVocabulary.js'
import { useOCR } from '../composables/useOCR.js'
import { parseVocabularyTable } from '../utils/parseVocabularyTable.js'

const emit = defineEmits(['ocr-complete'])

const { getLessons, createLesson } = useVocabulary()
const { isProcessing, progress, progressLabel, recognizeImage } = useOCR()

// Input mode: 'images' or 'text'
const inputMode = ref('images')

// Multi-image state: array of { file, dataUrl }
const images = ref([])
const isDragging = ref(false)

// Text paste state
const pastedText = ref('')

// Lesson selection
const lessonMode = ref('new') // 'new' or 'existing'
const newLessonTitle = ref('')
const selectedLessonId = ref('')

// OCR multi-image progress
const currentImageIndex = ref(0)
const totalImages = ref(0)

const lessons = computed(() => getLessons())

const hasInput = computed(() => {
  if (inputMode.value === 'images') return images.value.length > 0
  return pastedText.value.trim().length > 0
})

const canStart = computed(() => {
  if (!hasInput.value) return false
  if (lessonMode.value === 'new' && !newLessonTitle.value.trim()) return false
  if (lessonMode.value === 'existing' && !selectedLessonId.value) return false
  return true
})

// --- Image handling ---
function handleFileSelect(event) {
  const files = Array.from(event.target.files || [])
  addImages(files)
  // Reset input so same file can be re-selected
  event.target.value = ''
}

function handleDrop(event) {
  isDragging.value = false
  const files = Array.from(event.dataTransfer?.files || []).filter((f) =>
    f.type.startsWith('image/')
  )
  addImages(files)
}

function addImages(files) {
  for (const file of files) {
    const reader = new FileReader()
    reader.onload = (e) => {
      images.value.push({ file, dataUrl: e.target.result })
    }
    reader.readAsDataURL(file)
  }
}

function removeImage(index) {
  images.value.splice(index, 1)
}

function clearAll() {
  images.value = []
  pastedText.value = ''
}

// --- Resolve target lesson ---
function resolveLesson() {
  let targetLessonId, targetLessonTitle

  if (lessonMode.value === 'new') {
    const lesson = createLesson(newLessonTitle.value)
    targetLessonId = lesson.id
    targetLessonTitle = lesson.title
  } else {
    targetLessonId = selectedLessonId.value
    const allLessons = getLessons()
    const existing = allLessons.find((l) => l.id === targetLessonId)
    targetLessonTitle = existing ? existing.title : ''
  }

  return { targetLessonId, targetLessonTitle }
}

// --- Start processing ---
async function startProcessing() {
  if (!canStart.value || isProcessing.value) return

  const { targetLessonId, targetLessonTitle } = resolveLesson()

  if (inputMode.value === 'text') {
    // Direct text parsing – no OCR needed
    const pairs = parseVocabularyTable(pastedText.value)

    emit('ocr-complete', {
      lessonId: targetLessonId,
      lessonTitle: targetLessonTitle,
      pairs,
      rawText: pastedText.value,
    })
    return
  }

  // OCR mode – process all images sequentially, merge results
  totalImages.value = images.value.length
  currentImageIndex.value = 0

  let allRawText = ''
  let allPairs = []

  for (let i = 0; i < images.value.length; i++) {
    currentImageIndex.value = i + 1
    const rawText = await recognizeImage(images.value[i].dataUrl)
    allRawText += (allRawText ? '\n---\n' : '') + rawText
    allPairs = allPairs.concat(parseVocabularyTable(rawText))
  }

  emit('ocr-complete', {
    lessonId: targetLessonId,
    lessonTitle: targetLessonTitle,
    pairs: allPairs,
    rawText: allRawText,
  })
}
</script>

<template>
  <div class="upload-section">
    <h2>📥 Vokabeln importieren</h2>

    <!-- Lesson selection -->
    <div class="card mb-2">
      <div class="lesson-toggle flex mb-1">
        <button
          class="btn btn-sm"
          :class="lessonMode === 'new' ? 'btn-primary' : 'btn-outline'"
          @click="lessonMode = 'new'"
        >
          Neue Lektion
        </button>
        <button
          class="btn btn-sm"
          :class="lessonMode === 'existing' ? 'btn-primary' : 'btn-outline'"
          @click="lessonMode = 'existing'"
          :disabled="lessons.length === 0"
        >
          Vorhandene Lektion
        </button>
      </div>

      <div v-if="lessonMode === 'new'">
        <label for="lesson-title">Lektions-Titel</label>
        <input
          id="lesson-title"
          type="text"
          v-model="newLessonTitle"
          placeholder="z.B. Lektion 5 – Im Restaurant"
        />
      </div>

      <div v-else>
        <label for="lesson-select">Lektion auswählen</label>
        <select id="lesson-select" v-model="selectedLessonId">
          <option value="" disabled>— Lektion wählen —</option>
          <option v-for="lesson in lessons" :key="lesson.id" :value="lesson.id">
            {{ lesson.title }} ({{ lesson.vocabs.length }} Vokabeln)
          </option>
        </select>
      </div>
    </div>

    <!-- Input mode toggle -->
    <div class="input-mode-toggle flex mb-2">
      <button
        class="btn btn-sm"
        :class="inputMode === 'images' ? 'btn-primary' : 'btn-outline'"
        @click="inputMode = 'images'"
      >
        📷 Bilder (OCR)
      </button>
      <button
        class="btn btn-sm"
        :class="inputMode === 'text' ? 'btn-primary' : 'btn-outline'"
        @click="inputMode = 'text'"
      >
        📋 Text einfügen
      </button>
    </div>

    <!-- IMAGE MODE -->
    <template v-if="inputMode === 'images'">
      <!-- Drop zone (always visible for adding more) -->
      <div
        class="drop-zone"
        :class="{ 'drop-zone--active': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
        @click="$refs.fileInput.click()"
      >
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          style="display: none"
          @change="handleFileSelect"
        />
        <div class="drop-zone-placeholder">
          <span class="drop-icon">📁</span>
          <p>Bilder hierher ziehen oder klicken</p>
          <p class="text-light" style="font-size: 0.85rem">
            Mehrere Screenshots möglich – JPG, PNG
          </p>
        </div>
      </div>

      <!-- Image previews -->
      <div v-if="images.length > 0" class="image-grid mt-2">
        <div
          v-for="(img, index) in images"
          :key="index"
          class="image-thumb"
        >
          <img :src="img.dataUrl" :alt="'Bild ' + (index + 1)" />
          <button
            class="btn btn-sm btn-danger thumb-remove"
            @click="removeImage(index)"
          >
            ✕
          </button>
          <span class="thumb-label">{{ index + 1 }}</span>
        </div>
      </div>
    </template>

    <!-- TEXT MODE -->
    <template v-else>
      <div>
        <label for="paste-area">Text aus Tabelle einfügen</label>
        <textarea
          id="paste-area"
          v-model="pastedText"
          rows="10"
          placeholder="Deutsch ↹ Arabisch (Tab- oder Leerzeichen-getrennt)&#10;&#10;z.B.:&#10;Hallo ⟶ مرحبا&#10;Danke ⟶ شكرا"
        ></textarea>
        <p class="text-light mt-1" style="font-size: 0.8rem">
          Pro Zeile ein Vokabelpaar. Spalten mit Tab, | oder mehreren Leerzeichen trennen.
        </p>
      </div>
    </template>

    <!-- Progress (OCR) -->
    <div v-if="isProcessing" class="mt-2">
      <div class="progress-bar">
        <div class="progress-bar-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <p class="text-light mt-1" style="font-size: 0.85rem">
        <template v-if="totalImages > 1">
          Bild {{ currentImageIndex }} / {{ totalImages }} –
        </template>
        {{ progressLabel }}
      </p>
    </div>

    <!-- Validation hint -->
    <p v-if="!canStart && !isProcessing" class="validation-hint mt-1">
      <template v-if="!hasInput && inputMode === 'images'">Bitte mindestens ein Bild hochladen.</template>
      <template v-else-if="!hasInput && inputMode === 'text'">Bitte Text einfügen.</template>
      <template v-else-if="lessonMode === 'new' && !newLessonTitle.trim()">Bitte einen Lektions-Titel eingeben.</template>
      <template v-else-if="lessonMode === 'existing' && !selectedLessonId">Bitte eine Lektion auswählen.</template>
    </p>

    <!-- Start button -->
    <button
      class="btn btn-primary btn-lg mt-2"
      style="width: 100%"
      :disabled="!canStart || isProcessing"
      @click="startProcessing"
    >
      <template v-if="isProcessing">Erkennung läuft…</template>
      <template v-else-if="inputMode === 'text'">Text verarbeiten</template>
      <template v-else>
        Texterkennung starten{{ images.length > 1 ? ` (${images.length} Bilder)` : '' }}
      </template>
    </button>
  </div>
</template>

<style scoped>
.lesson-toggle,
.input-mode-toggle {
  gap: 0.5rem;
}

.drop-zone {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius);
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition);
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-zone:hover,
.drop-zone--active {
  border-color: var(--color-primary);
  background: rgba(42, 111, 151, 0.04);
}

.drop-zone-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.drop-icon {
  font-size: 2rem;
  margin-bottom: 0.25rem;
}

/* Thumbnail grid */
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
}

.image-thumb {
  position: relative;
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow);
  aspect-ratio: 4 / 3;
}

.image-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 0.15rem 0.35rem;
  font-size: 0.75rem;
}

.thumb-label {
  position: absolute;
  bottom: 4px;
  left: 4px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

textarea {
  resize: vertical;
  min-height: 120px;
}

.validation-hint {
  font-size: 0.85rem;
  color: var(--color-accent);
}
</style>
