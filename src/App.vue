<script setup>
import { ref } from 'vue'
import VocabularyList from './components/VocabularyList.vue'
import FlashcardView from './components/FlashcardView.vue'

const activeTab = ref('vocabs')
</script>

<template>
  <div class="app-shell">
    <header class="app-header flex items-center justify-between mb-2">
      <h1>عربي Vokabeltrainer</h1>
    </header>

    <nav class="tab-bar">
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
