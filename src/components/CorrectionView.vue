<script setup>
import { ref, onMounted } from 'vue'
import { useVocabulary } from '../composables/useVocabulary.js'

const props = defineProps({
  lessonId: { type: String, required: true },
  lessonTitle: { type: String, required: true },
  pairs: { type: Array, required: true },
  rawText: { type: String, default: '' },
})

const emit = defineEmits(['saved', 'cancel'])

const { addBatch } = useVocabulary()

const editablePairs = ref([])

onMounted(() => {
  editablePairs.value = props.pairs.map((p, i) => ({
    key: i,
    german: p.german,
    arabic: p.arabic,
  }))
  // Always add one empty row at the end
  if (editablePairs.value.length === 0) addRow()
})

let nextKey = 1000

function addRow() {
  editablePairs.value.push({ key: nextKey++, german: '', arabic: '' })
}

function removeRow(index) {
  editablePairs.value.splice(index, 1)
}

function save() {
  const validPairs = editablePairs.value.filter(
    (p) => p.german.trim() || p.arabic.trim()
  )
  if (validPairs.length === 0) return

  addBatch(
    props.lessonId,
    validPairs.map((p) => ({ german: p.german, arabic: p.arabic }))
  )
  emit('saved')
}

const showRaw = ref(false)
</script>

<template>
  <div class="correction-view">
    <div class="flex items-center justify-between mb-2">
      <h2>✏️ Vokabeln prüfen</h2>
      <span class="text-light" style="font-size: 0.85rem">
        Lektion: <strong>{{ lessonTitle }}</strong>
      </span>
    </div>

    <p class="text-light mb-2" style="font-size: 0.9rem">
      {{ editablePairs.length }} Einträge erkannt. Bitte prüfe und korrigiere die Vokabeln.
    </p>

    <!-- Vocabulary pairs table -->
    <div class="pairs-list">
      <div class="pairs-header">
        <span class="col-de">Deutsch</span>
        <span class="col-ar">Arabisch</span>
        <span class="col-action"></span>
      </div>

      <div
        v-for="(pair, index) in editablePairs"
        :key="pair.key"
        class="pair-row"
      >
        <input
          type="text"
          class="ltr"
          v-model="pair.german"
          placeholder="Deutsch"
        />
        <input
          type="text"
          class="rtl"
          v-model="pair.arabic"
          placeholder="عربي"
          dir="rtl"
        />
        <button
          class="btn btn-sm btn-danger"
          @click="removeRow(index)"
          title="Zeile entfernen"
        >
          ✕
        </button>
      </div>
    </div>

    <button class="btn btn-sm btn-outline mt-1" @click="addRow">
      + Zeile hinzufügen
    </button>

    <!-- Raw text toggle -->
    <div class="mt-2" v-if="rawText">
      <button
        class="btn btn-sm btn-outline"
        @click="showRaw = !showRaw"
      >
        {{ showRaw ? 'Rohtext ausblenden' : 'Rohtext anzeigen' }}
      </button>
      <pre v-if="showRaw" class="raw-text mt-1">{{ rawText }}</pre>
    </div>

    <!-- Action buttons -->
    <div class="flex mt-3" style="gap: 0.75rem">
      <button class="btn btn-outline" @click="emit('cancel')">
        Abbrechen
      </button>
      <button
        class="btn btn-success btn-lg"
        style="flex: 1"
        @click="save"
      >
        ✓ Speichern ({{ editablePairs.filter(p => p.german.trim() || p.arabic.trim()).length }} Vokabeln)
      </button>
    </div>
  </div>
</template>

<style scoped>
.pairs-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.pairs-header {
  display: grid;
  grid-template-columns: 1fr 1fr 36px;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-light);
  padding: 0 0.25rem;
}

.pair-row {
  display: grid;
  grid-template-columns: 1fr 1fr 36px;
  gap: 0.5rem;
  align-items: center;
}

.pair-row input {
  width: 100%;
}

.raw-text {
  background: #f0f0f0;
  padding: 0.75rem;
  border-radius: var(--radius);
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}
</style>
