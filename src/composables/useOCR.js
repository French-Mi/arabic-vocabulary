import { ref } from 'vue'
import Tesseract from 'tesseract.js'

export function useOCR() {
  const isProcessing = ref(false)
  const progress = ref(0)
  const progressLabel = ref('')

  async function recognizeImage(imageSource) {
    isProcessing.value = true
    progress.value = 0
    progressLabel.value = 'Initialisiere OCR…'

    try {
      const result = await Tesseract.recognize(imageSource, 'deu+ara', {
        logger: (info) => {
          if (info.status === 'recognizing text') {
            progress.value = Math.round(info.progress * 100)
            progressLabel.value = `Texterkennung: ${progress.value}%`
          } else if (info.status) {
            progressLabel.value = info.status
          }
        },
      })

      return result.data.text
    } finally {
      isProcessing.value = false
      progress.value = 100
      progressLabel.value = 'Fertig'
    }
  }

  return {
    isProcessing,
    progress,
    progressLabel,
    recognizeImage,
  }
}
