const Item = require('../models/Item');
const Match = require('../models/Match');
const { v4: uuidv4 } = require('uuid');
const { sendMatchNotifications } = require('./notificationService');

const IMAGE_THRESHOLD = parseFloat(process.env.IMAGE_SIMILARITY_THRESHOLD) || 0.78;
const TEXT_THRESHOLD = parseFloat(process.env.TEXT_SIMILARITY_THRESHOLD) || 0.55;

const itemTextBlob = (item) => {
  const parts = [item.title, item.description, item.audioTranscript].filter(Boolean);
  return parts.join(' ');
};

const cosineSimilarity = (vecA, vecB) => {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
};

exports.findMatches = async (newItem) => {
  try {
    console.log(`🔍 Starting match search for item: ${newItem.title} (${newItem.type})`);
    
    // Determine opposite type
    const oppositeType = newItem.type === 'lost' ? 'found' : 'lost';
    console.log(`   Looking for ${oppositeType} items in category: ${newItem.category}`);

    // Find active items of opposite type in same category
    const candidates = await Item.find({
      type: oppositeType,
      category: newItem.category,
      status: 'active',
      _id: { $ne: newItem._id }
    });

    console.log(`   Found ${candidates.length} candidate(s)`);

    if (candidates.length === 0) {
      console.log('   ❌ No candidates found for matching');
      return;
    }

    for (const candidate of candidates) {
      console.log(`   📝 Comparing with: ${candidate.title}`);
      const text1 = itemTextBlob(newItem);
      const text2 = itemTextBlob(candidate);
      const textScore = calculateTextSimilarity(text1, text2);

      let imageScore = null;
      const hasBothEmbeddings =
        newItem.imageEmbedding && candidate.imageEmbedding &&
        Array.isArray(newItem.imageEmbedding) && Array.isArray(candidate.imageEmbedding) &&
        newItem.imageEmbedding.length > 0 && candidate.imageEmbedding.length > 0;

      if (hasBothEmbeddings) {
        try {
          imageScore = cosineSimilarity(newItem.imageEmbedding, candidate.imageEmbedding);
          if (isNaN(imageScore) || !isFinite(imageScore)) {
            imageScore = null;
          } else {
            console.log(`      Image similarity: ${(imageScore * 100).toFixed(2)}%`);
          }
        } catch (error) {
          console.log(`      Image matching failed, using text only: ${error.message}`);
          imageScore = null;
        }
      }

      console.log(`      Text similarity: ${(textScore * 100).toFixed(2)}%`);

      const imageOk = imageScore !== null && imageScore >= IMAGE_THRESHOLD;
      const textOk = textScore >= TEXT_THRESHOLD;

      let matchScore = 0;
      let matchType = '';

      if (imageOk || textOk) {
        if (imageOk && (!textOk || imageScore >= textScore)) {
          matchScore = imageScore;
          matchType = 'image';
        } else {
          matchScore = textScore;
          matchType = 'text';
        }
        console.log(`   ✅ MATCH FOUND! (${matchType}) Score: ${(matchScore * 100).toFixed(2)}%`);
        await createMatch(newItem, candidate, matchScore, matchType);
      } else {
        const imgPart = imageScore !== null ? `${(imageScore * 100).toFixed(0)}% (need ${(IMAGE_THRESHOLD * 100).toFixed(0)}%)` : 'n/a';
        console.log(`   ❌ No match — text ${(textScore * 100).toFixed(0)}% (need ${(TEXT_THRESHOLD * 100).toFixed(0)}%), image ${imgPart}`);
      }
    }
  } catch (error) {
    console.error('❌ Matching service error:', error);
    throw error;
  }
};

const createMatch = async (item1, item2, matchScore, matchType) => {
  try {
    const lostItem = item1.type === 'lost' ? item1 : item2;
    const foundItem = item1.type === 'found' ? item1 : item2;

    const chatRoomId = uuidv4();

    console.log(`   💾 Creating match record...`);
    const match = await Match.create({
      lostItem: lostItem._id,
      foundItem: foundItem._id,
      lostUser: lostItem.user,
      foundUser: foundItem.user,
      matchScore,
      matchType,
      chatRoomId
    });

    console.log(`   ✅ Match created with ID: ${match._id}`);

    // Update items status
    await Item.findByIdAndUpdate(lostItem._id, {
      status: 'matched',
      matchedWith: foundItem._id,
      matchScore
    });

    await Item.findByIdAndUpdate(foundItem._id, {
      status: 'matched',
      matchedWith: lostItem._id,
      matchScore
    });

    console.log(`   📧 Sending notifications...`);
    // Send notifications
    await sendMatchNotifications(match);
    console.log(`   ✅ Match process complete!`);

    return match;
  } catch (error) {
    console.error('   ❌ Error creating match:', error);
    throw error;
  }
};

const calculateTextSimilarity = (text1, text2) => {
  // Enhanced text similarity with better preprocessing
  const normalize = (text) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2); // Remove short words like "a", "is", "the"
  };

  const words1 = normalize(text1);
  const words2 = normalize(text2);
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  // Calculate Jaccard similarity (intersection / union)
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  const jaccardScore = intersection.size / union.size;
  
  // Also calculate word frequency overlap for better matching
  const allWords = [...words1, ...words2];
  const freq1 = {};
  const freq2 = {};
  
  words1.forEach(w => freq1[w] = (freq1[w] || 0) + 1);
  words2.forEach(w => freq2[w] = (freq2[w] || 0) + 1);
  
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  const allUniqueWords = new Set(allWords);
  allUniqueWords.forEach(word => {
    const f1 = freq1[word] || 0;
    const f2 = freq2[word] || 0;
    dotProduct += f1 * f2;
    mag1 += f1 * f1;
    mag2 += f2 * f2;
  });
  
  const cosineScore = mag1 && mag2 ? dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2)) : 0;
  
  // Combine both scores (weighted average)
  const finalScore = (jaccardScore * 0.4) + (cosineScore * 0.6);
  
  console.log(`      📊 Jaccard: ${(jaccardScore * 100).toFixed(2)}%, Cosine: ${(cosineScore * 100).toFixed(2)}%, Final: ${(finalScore * 100).toFixed(2)}%`);
  
  return finalScore;
};
