import React, { useState, useEffect } from 'react';
import { Upload, BookOpen, Download, Plus, X, Image, Mic } from 'lucide-react';

// Mock data for demonstration (in production, this comes from your database)
const VocabularyBuilder = () => {
  const [words, setWords] = useState([]);
  const [selectedWord, setSelectedWord] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [view, setView] = useState('upload'); // 'upload' or 'vocabulary'
  const [uploadProgress, setUploadProgress] = useState('');

  // Load words from storage
  useEffect(() => {
    loadWords();
  }, []);

  const loadWords = async () => {
    try {
      const result = await window.storage.list('word:');
      if (result && result.keys) {
        const wordData = await Promise.all(
          result.keys.map(async (key) => {
            try {
              const data = await window.storage.get(key);
              return data ? JSON.parse(data.value) : null;
            } catch {
              return null;
            }
          })
        );
        setWords(wordData.filter(Boolean).sort((a, b) => a.word.localeCompare(b.word)));
      }
    } catch (error) {
      console.log('No words stored yet');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadProgress('Reading file...');

    try {
      let text = '';
      
      if (file.type === 'application/pdf') {
        setUploadProgress('PDF processing requires backend. Simulating with sample text...');
        text = 'The serendipitous discovery led to a paradigm shift in our understanding of quantum mechanics.';
      } else {
        text = await file.text();
      }

      setUploadProgress('Extracting words...');
      await processText(text);
      setUploadProgress('Complete!');
      
      setTimeout(() => {
        setIsProcessing(false);
        setUploadProgress('');
        setView('vocabulary');
        loadWords();
      }, 1000);
    } catch (error) {
      console.error('Error processing file:', error);
      setUploadProgress('Error processing file');
      setIsProcessing(false);
    }
  };

  const processText = async (text) => {
    // Common words to filter out
    const commonWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'did', 'having', 'may', 'should', 'am']);

    // Split into sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    // Extract words
    const wordMap = new Map();
    sentences.forEach(sentence => {
      const wordsInSentence = sentence.toLowerCase().match(/\b[a-z]+\b/g) || [];
      wordsInSentence.forEach(word => {
        if (word.length > 3 && !commonWords.has(word)) {
          if (!wordMap.has(word)) {
            wordMap.set(word, sentence.trim());
          }
        }
      });
    });

    // Check existing words and add new ones
    for (const [word, sentence] of wordMap) {
      try {
        const existing = await window.storage.get(`word:${word}`);
        if (!existing) {
          // Simulate API call to Merriam-Webster
          const mockDefinition = `Definition of ${word}`;
          const mockPronunciation = `\\${word}\\`;
          
          const wordData = {
            word,
            definition: mockDefinition,
            pronunciation: mockPronunciation,
            exampleSentence: sentence,
            audioUrl: null,
            userImage: null,
            userAudio: null,
            dateAdded: new Date().toISOString()
          };

          await window.storage.set(`word:${word}`, JSON.stringify(wordData));
        }
      } catch (error) {
        console.error(`Error processing word ${word}:`, error);
      }
    }
  };

  const handleAddMedia = async (wordData, type, file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result;
      const updatedWord = {
        ...wordData,
        [type === 'image' ? 'userImage' : 'userAudio']: base64Data
      };
      
      try {
        await window.storage.set(`word:${wordData.word}`, JSON.stringify(updatedWord));
        await loadWords();
        if (selectedWord?.word === wordData.word) {
          setSelectedWord(updatedWord);
        }
      } catch (error) {
        console.error('Error saving media:', error);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteWord = async (word) => {
    try {
      await window.storage.delete(`word:${word}`);
      await loadWords();
      if (selectedWord?.word === word) {
        setSelectedWord(null);
      }
    } catch (error) {
      console.error('Error deleting word:', error);
    }
  };

  const exportToCSV = () => {
    const headers = ['Word', 'Definition', 'Pronunciation', 'Example Sentence', 'Date Added'];
    const rows = words.map(w => [
      w.word,
      w.definition,
      w.pronunciation,
      w.exampleSentence,
      new Date(w.dateAdded).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocabulary_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">Vocabulary Builder</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setView('upload')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  view === 'upload'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Upload className="w-4 h-4 inline mr-2" />
                Upload
              </button>
              <button
                onClick={() => setView('vocabulary')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  view === 'vocabulary'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <BookOpen className="w-4 h-4 inline mr-2" />
                Vocabulary ({words.length})
              </button>
              {words.length > 0 && (
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4 inline mr-2" />
                  Export CSV
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {view === 'upload' ? (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-semibold mb-4">Upload Document</h2>
            <p className="text-gray-600 mb-6">
              Upload a PDF or text file to extract vocabulary words. Common words will be filtered out automatically.
            </p>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <input
                type="file"
                accept=".pdf,.txt"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer inline-flex flex-col items-center"
              >
                <Upload className="w-16 h-16 text-gray-400 mb-4" />
                <span className="text-lg font-medium text-gray-700 mb-2">
                  Click to upload or drag and drop
                </span>
                <span className="text-sm text-gray-500">PDF or TXT files</span>
              </label>
            </div>

            {isProcessing && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                  <span className="text-indigo-700 font-medium">{uploadProgress}</span>
                </div>
              </div>
            )}

            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> This demo uses browser storage. In production with Vercel, you'll need to set up:
                <br />• PostgreSQL database for persistent storage
                <br />• API routes for Merriam-Webster integration
                <br />• File upload handling for PDFs
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Word List */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow-lg p-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">Your Vocabulary</h2>
              {words.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No words yet. Upload a document to get started!
                </p>
              ) : (
                <div className="space-y-2">
                  {words.map((word) => (
                    <button
                      key={word.word}
                      onClick={() => setSelectedWord(word)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedWord?.word === word.word
                          ? 'bg-indigo-100 border-2 border-indigo-600'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{word.word}</div>
                      <div className="text-sm text-gray-500">{word.pronunciation}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Word Details */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
              {selectedWord ? (
                <div>
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-3xl font-bold text-gray-900 mb-2">
                        {selectedWord.word}
                      </h2>
                      <p className="text-lg text-gray-600">{selectedWord.pronunciation}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteWord(selectedWord.word)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">Definition</h3>
                      <p className="text-gray-900">{selectedWord.definition}</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">Example Sentence</h3>
                      <p className="text-gray-900 italic bg-gray-50 p-4 rounded-lg">
                        "{selectedWord.exampleSentence}"
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2">Custom Image</h3>
                        {selectedWord.userImage ? (
                          <img
                            src={selectedWord.userImage}
                            alt="Custom memory aid"
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        ) : (
                          <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500 transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => e.target.files[0] && handleAddMedia(selectedWord, 'image', e.target.files[0])}
                            />
                            <Image className="w-8 h-8 text-gray-400 mb-2" />
                            <span className="text-sm text-gray-500">Upload Image</span>
                          </label>
                        )}
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2">Custom Audio</h3>
                        {selectedWord.userAudio ? (
                          <audio controls className="w-full">
                            <source src={selectedWord.userAudio} />
                          </audio>
                        ) : (
                          <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500 transition-colors">
                            <input
                              type="file"
                              accept="audio/*"
                              className="hidden"
                              onChange={(e) => e.target.files[0] && handleAddMedia(selectedWord, 'audio', e.target.files[0])}
                            />
                            <Mic className="w-8 h-8 text-gray-400 mb-2" />
                            <span className="text-sm text-gray-500">Upload Audio</span>
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-gray-500">
                      Added on {new Date(selectedWord.dateAdded).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>Select a word to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VocabularyBuilder;