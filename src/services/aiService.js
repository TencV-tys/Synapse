// src/services/aiService.js
export class AIService {
  static async generateTags(content) {
    // Simple keyword extraction - replace with actual AI service
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
    const words = content.toLowerCase().split(/\W+/);
    
    const wordFreq = words.reduce((freq, word) => {
      if (word.length > 3 && !commonWords.includes(word)) {
        freq[word] = (freq[word] || 0) + 1;
      }
      return freq;
    }, {});

    return Object.keys(wordFreq)
      .sort((a, b) => wordFreq[b] - wordFreq[a])
      .slice(0, 5);
  }

  static async summarizeContent(content) {
    // Simple summarization - replace with actual AI service
    const sentences = content.split('.');
    if (sentences.length <= 3) return content;
    
    return sentences.slice(0, 3).join('. ') + '.';
  }

  static async suggestRelatedNotes(currentNote, allNotes) {
    const currentTags = new Set(currentNote.tags || []);
    
    return allNotes.filter(note => {
      if (note.id === currentNote.id) return false;
      
      const noteTags = new Set(note.tags || []);
      const commonTags = [...currentTags].filter(tag => noteTags.has(tag));
      
      return commonTags.length > 0;
    });
  }
}