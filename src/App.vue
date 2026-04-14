<script setup>
import { ref } from 'vue'
import ImageUpload from './components/ImageUpload.vue'
import CorrectionView from './components/CorrectionView.vue'
import VocabularyList from './components/VocabularyList.vue'
import FlashcardView from './components/FlashcardView.vue'

const activeTab = ref('upload')

// OCR result state (passed from ImageUpload → CorrectionView)
const ocrResult = ref(null)

function handleOcrComplete(result) {
  ocrResult.value = result
  activeTab.value = 'correction'
}

function handleCorrectionSaved() {
  ocrResult.value = null
  activeTab.value = 'vocabs'
}

function handleCorrectionCancel() {
  ocrResult.value = null
  activeTab.value = 'upload'
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header flex items-center justify-between mb-2">
      <h1>عربي Vokabeltrainer</h1>
    </header>

    <nav class="tab-bar">
      <button
        :class="{ active: activeTab === 'upload' }"
        @click="activeTab = 'upload'"
      >
        📷 Upload
      </button>
      <button
        :class="{ active: activeTab === 'vocabs' }"
        @click="activeTab = 'vocabs'"
      >
        📚 Vokabeln
      </button>
      <button
        :class="{ active: activeTab === 'flashcards' }"
        @click="activeTab = 'flashcards'"
      >
        🗂️ Abfrage
      </button>
    </nav>

    <main>
      <ImageUpload
        v-if="activeTab === 'upload'"
        @ocr-complete="handleOcrComplete"
      />

      <CorrectionView
        v-if="activeTab === 'correction' && ocrResult"
        :lesson-id="ocrResult.lessonId"
        :lesson-title="ocrResult.lessonTitle"
        :pairs="ocrResult.pairs"
        :raw-text="ocrResult.rawText"
        @saved="handleCorrectionSaved"
        @cancel="handleCorrectionCancel"
      />

      <VocabularyList v-if="activeTab === 'vocabs'" />

      <FlashcardView v-if="activeTab === 'flashcards'" />
    </main>
  </div>
</template>

<style scoped>
.app-header {
  padding: 0.5rem 0;
}

.app-header h1 {
  font-size: 1.4rem;
}
</style>
