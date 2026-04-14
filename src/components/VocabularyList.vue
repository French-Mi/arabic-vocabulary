<script setup>
import { computed, ref } from 'vue'
import { useVocabulary } from '../composables/useVocabulary.js'

const { getLessons, deleteLesson, deletePair, renameLesson } = useVocabulary()

const lessons = computed(() => getLessons())
const expandedLessons = ref(new Set())
const editingLessonId = ref(null)
const editTitle = ref('')

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
</script>

<template>
  <div class="vocab-list-section">
    <h2>📚 Meine Vokabeln</h2>

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
</style>
