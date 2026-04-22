<script setup>
import { computed, ref } from 'vue'
import { useVocabulary } from '../composables/useVocabulary.js'

const { getLessons, deleteLesson, deletePair, renameLesson, importLesson } = useVocabulary()

const lessons = computed(() => getLessons())
const expandedLessons = ref(new Set())
const editingLessonId = ref(null)
const editTitle = ref('')
const exportModalOpen = ref(false)
const exportModalLesson = ref(null)
const exportCopied = ref(false)
const importModalOpen = ref(false)
const importData = ref('')
const importTitle = ref('')
const importError = ref('')
const importSuccess = ref('')

function toggleLesson(id) {
  if (expandedLessons.value.has(id)) {
    expandedLessons.value.delete(id)
  } else {
    expandedLessons.value.add(id)
  }
}

function startRename(lesson) {
  editingLessonId.value = lesson.id
  editTitle.value = lesson.title
}

function confirmRename(lessonId) {
  if (editTitle.value.trim()) {
    renameLesson(lessonId, editTitle.value)
  }
  editingLessonId.value = null
}

function confirmDeleteLesson(lesson) {
  if (confirm(`Lektion "${lesson.title}" mit ${lesson.vocabs.length} Vokabeln wirklich löschen?`)) {
    deleteLesson(lesson.id)
    expandedLessons.value.delete(lesson.id)
  }
}

function confirmDeletePair(lessonId, vocab) {
  deletePair(lessonId, vocab.id)
}

function openExportModal(lesson) {
  exportModalLesson.value = lesson
  exportModalOpen.value = true
  exportCopied.value = false
}

function getExportData(lesson) {
  return lesson.vocabs
    .map(v => `"german": "${v.german}",\n      "arabic": "${v.arabic}"`)
    .join(',\n      ')
}

function copyToClipboard() {
  if (!exportModalLesson.value) return
  const data = getExportData(exportModalLesson.value)
  navigator.clipboard.writeText(data).then(() => {
    exportCopied.value = true
    setTimeout(() => {
      exportCopied.value = false
    }, 2000)
  })
}

function closeExportModal() {
  exportModalOpen.value = false
  exportModalLesson.value = null
}

function openImportModal() {
  importModalOpen.value = true
  importData.value = ''
  importTitle.value = ''
  importError.value = ''
  importSuccess.value = ''
}

function closeImportModal() {
  importModalOpen.value = false
  importData.value = ''
  importTitle.value = ''
  importError.value = ''
  importSuccess.value = ''
}

function performImport() {
  importError.value = ''
  importSuccess.value = ''
  
  if (!importData.value.trim()) {
    importError.value = 'Bitte füge Vokabel-Daten ein'
    return
  }

  try {
    let vocabs = []
    const text = importData.value
    
    // Extract all "german": "..." entries
    const germanRegex = /"german":\s*"([^"]*)"/g
    const arabicRegex = /"arabic":\s*"([^"]*)"/g
    
    const germanMatches = [...text.matchAll(germanRegex)].map(m => m[1])
    const arabicMatches = [...text.matchAll(arabicRegex)].map(m => m[1])
    
    // Pair up german and arabic values
    for (let i = 0; i < Math.min(germanMatches.length, arabicMatches.length); i++) {
      vocabs.push({
        german: germanMatches[i],
        arabic: arabicMatches[i]
      })
    }
    
    if (vocabs.length === 0) {
      importError.value = 'Keine gültigen Vokabeln gefunden'
      return
    }
    
    const lesson = importLesson(vocabs, importTitle.value)
    importSuccess.value = `"${lesson.title}" mit ${lesson.vocabs.length} Vokabeln erfolgreich importiert!`
    setTimeout(() => {
      closeImportModal()
    }, 2000)
  } catch (error) {
    importError.value = error.message
  }
}
</script>

<template>
  <div class="vocab-list-section">
    <div class="flex items-center justify-between" style="margin-bottom: 1rem">
      <h2>📚 Meine Vokabeln</h2>
      <button class="btn btn-sm btn-outline" @click="openImportModal" title="Importieren">
        📥 Importieren
      </button>
    </div>

    <p v-if="lessons.length === 0" class="text-light mt-2">
      Noch keine Vokabeln gespeichert. Lade ein Bild im Tab "Upload" hoch.
    </p>

    <div class="lessons-list mt-2">
      <div v-for="lesson in lessons" :key="lesson.id" class="lesson-group card mb-2">
        <!-- Lesson header -->
        <div class="lesson-header flex items-center justify-between" @click="toggleLesson(lesson.id)">
          <div class="flex items-center" style="gap: 0.5rem; flex: 1; min-width: 0">
            <span class="expand-icon">{{ expandedLessons.has(lesson.id) ? '▾' : '▸' }}</span>

            <template v-if="editingLessonId === lesson.id">
              <input
                type="text"
                v-model="editTitle"
                @click.stop
                @keyup.enter="confirmRename(lesson.id)"
                @blur="confirmRename(lesson.id)"
                style="flex: 1"
                autofocus
              />
            </template>
            <template v-else>
              <strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
                {{ lesson.title }}
              </strong>
              <span class="text-light" style="font-size: 0.85rem; white-space: nowrap">
                ({{ lesson.vocabs.length }} Vokabeln)
              </span>
            </template>
          </div>

          <div class="flex" style="gap: 0.25rem" @click.stop>
            <button class="btn btn-sm btn-outline" @click="startRename(lesson)" title="Umbenennen">
              ✎
            </button>
            <button class="btn btn-sm btn-outline" @click="openExportModal(lesson)" title="Exportieren">
              💾
            </button>
            <button class="btn btn-sm btn-danger" @click="confirmDeleteLesson(lesson)" title="Löschen">
              🗑
            </button>
          </div>
        </div>

        <!-- Vocab list (expanded) -->
        <div v-if="expandedLessons.has(lesson.id)" class="vocab-table mt-1">
          <div v-if="lesson.vocabs.length === 0" class="text-light" style="padding: 0.5rem; font-size: 0.9rem">
            Keine Vokabeln in dieser Lektion.
          </div>
          <div
            v-for="vocab in lesson.vocabs"
            :key="vocab.id"
            class="vocab-row"
          >
            <span
              class="mastery-dot"
              :class="vocab.mastery ? 'mastery-' + vocab.mastery : 'mastery-none'"
              :title="vocab.mastery === 'green' ? 'Sofort gewusst' : vocab.mastery === 'yellow' ? 'Nach Wiederholung gewusst' : vocab.mastery === 'red' ? 'Noch unsicher' : 'Noch nicht gelernt'"
            ></span>
            <span class="vocab-de ltr">{{ vocab.german }}</span>
            <span class="vocab-ar rtl">{{ vocab.arabic }}</span>
            <span class="vocab-score text-light" :title="'Score: ' + vocab.score">
              {{ vocab.score > 0 ? '+' : '' }}{{ vocab.score }}
            </span>
            <button
              class="btn btn-sm btn-outline"
              @click="confirmDeletePair(lesson.id, vocab)"
              title="Entfernen"
              style="padding: 0.2rem 0.4rem; font-size: 0.75rem"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Export Modal -->
  <div v-if="exportModalOpen" class="modal-overlay" @click.self="closeExportModal">
    <div class="modal-content">
      <div class="modal-header flex items-center justify-between">
        <h3>{{ exportModalLesson?.title }} exportieren</h3>
        <button class="modal-close" @click="closeExportModal">✕</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom: 1rem; font-size: 0.9rem">
          Kopiere die Daten unten und füge sie auf einem anderen Gerät mit dem 📥 Button ein.
        </p>
        <textarea
          :value="exportModalLesson ? getExportData(exportModalLesson) : ''"
          readonly
          class="export-textarea"
          rows="12"
        ></textarea>
      </div>
      <div class="modal-footer flex items-center justify-end" style="gap: 0.5rem">
        <button class="btn btn-outline" @click="closeExportModal">Schließen</button>
        <button
          class="btn btn-primary"
          @click="copyToClipboard"
          :class="{ 'btn-success': exportCopied }"
        >
          {{ exportCopied ? '✓ Kopiert!' : '📋 Kopieren' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Import Modal -->
  <div v-if="importModalOpen" class="modal-overlay" @click.self="closeImportModal">
    <div class="modal-content">
      <div class="modal-header flex items-center justify-between">
        <h3>Vokabeln importieren</h3>
        <button class="modal-close" @click="closeImportModal">✕</button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: 1rem">
          <label style="display: block; font-size: 0.9rem; margin-bottom: 0.25rem; font-weight: 500">
            Lektions-Titel:
          </label>
          <input
            v-model="importTitle"
            type="text"
            placeholder="z.B. Lektion 7"
            style="width: 100%; padding: 0.5rem; border: 1px solid var(--color-border); border-radius: 4px; box-sizing: border-box"
          />
        </div>

        <p style="margin-bottom: 0.5rem; font-size: 0.9rem">
          Kopiere die Vokable-Daten vom 💾 Export hier ein:
        </p>
        <textarea
          v-model="importData"
          placeholder='"german": "Snack",\n      "arabic": "نَقنَقَة"'
          class="export-textarea"
          rows="12"
        ></textarea>
        <div v-if="importError" style="color: #c0392b; margin-top: 0.75rem; font-size: 0.9rem">
          ⚠️ {{ importError }}
        </div>
        <div v-if="importSuccess" style="color: #2d8659; margin-top: 0.75rem; font-size: 0.9rem">
          ✓ {{ importSuccess }}
        </div>
      </div>
      <div class="modal-footer flex items-center justify-end" style="gap: 0.5rem">
        <button class="btn btn-outline" @click="closeImportModal">Abbrechen</button>
        <button class="btn btn-primary" @click="performImport">
          📥 Importieren
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lesson-header {
  cursor: pointer;
  padding: 0.25rem 0;
}

.expand-icon {
  font-size: 0.9rem;
  width: 1rem;
  text-align: center;
  flex-shrink: 0;
}

.vocab-table {
  border-top: 1px solid var(--color-border);
  padding-top: 0.5rem;
}

.vocab-row {
  display: grid;
  grid-template-columns: 12px 1fr 1fr 40px 32px;
  gap: 0.5rem;
  align-items: center;
  padding: 0.35rem 0.25rem;
  border-bottom: 1px solid #f0f0f0;
  font-size: 0.9rem;
}

.mastery-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.mastery-green {
  background: #2d8659;
}

.mastery-yellow {
  background: #d4a017;
}

.mastery-red {
  background: #c0392b;
}

.mastery-none {
  background: #ddd;
}

.vocab-row:last-child {
  border-bottom: none;
}

.vocab-de {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vocab-ar {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif;
}

.vocab-score {
  text-align: center;
  font-size: 0.8rem;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
}

.modal-close:hover {
  color: #000;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.export-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.85rem;
  resize: vertical;
}

.modal-footer {
  padding: 1rem;
  border-top: 1px solid var(--color-border);
}

.btn-success {
  background-color: #2d8659;
  color: white;
}
</style>
