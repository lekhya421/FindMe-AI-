const Item = require('../models/Item');
const { uploadToCloudinary } = require('../services/cloudinaryService');
const { getEmbedding, transcribeAudio } = require('../services/aiService');
const { findMatches } = require('../services/matchingService');

exports.createItem = async (req, res, next) => {
  try {
    const { type, title, description, verificationInfo, category, date, location } = req.body;
    let parsedLocation = null;

    if (typeof location === 'string') {
      try {
        parsedLocation = JSON.parse(location);
      } catch (parseError) {
        return res.status(400).json({ message: 'Invalid location format' });
      }
    } else if (location && typeof location === 'object') {
      parsedLocation = location;
    }

    if (!parsedLocation || !parsedLocation.address) {
      return res.status(400).json({ message: 'Location address is required' });
    }
    
    const itemData = {
      user: req.user.id,
      type,
      title,
      description: (description || '').trim(),
      category,
      date,
      location: parsedLocation
    };

    // Add verification info if provided (for lost items)
    if (verificationInfo) {
      itemData.verificationInfo = verificationInfo;
    }

    // Handle image upload
    if (req.files && req.files.image) {
      const imageUrl = await uploadToCloudinary(req.files.image[0]);
      itemData.imageUrl = imageUrl;
      
      // Only get image embedding if we have a real image URL (not placeholder)
      if (imageUrl && !imageUrl.includes('placeholder')) {
        try {
          const embedding = await getEmbedding(imageUrl);
          itemData.imageEmbedding = embedding;
        } catch (error) {
          console.log('Warning: Could not generate image embedding:', error.message);
          // Continue without embedding - will use text matching
        }
      }
    }

    // Handle audio upload
    if (req.files && req.files.audio) {
      const audioUrl = await uploadToCloudinary(req.files.audio[0]);
      itemData.audioUrl = audioUrl;
      
      // Transcribe audio; continue with existing description if transcription fails.
      try {
        const transcript = await transcribeAudio(audioUrl);
        if (transcript) {
          itemData.audioTranscript = transcript;
          itemData.description = transcript;
        }
      } catch (error) {
        console.log('Warning: Could not transcribe audio:', error.message);
      }

      if (!itemData.description) {
        itemData.description = 'Voice recording submitted';
      }
    }

    const item = await Item.create(itemData);

    // Trigger async matching
    findMatches(item).catch(err => console.error('Matching error:', err));

    res.status(201).json({ success: true, item });
  } catch (error) {
    next(error);
  }
};

exports.getItems = async (req, res, next) => {
  try {
    const { type, category, status } = req.query;
    const filter = {};
    
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (status) filter.status = status;

    const items = await Item.find(filter)
      .populate('user', 'name email')
      .sort('-createdAt');

    res.json({ success: true, count: items.length, items });
  } catch (error) {
    next(error);
  }
};

exports.getMyItems = async (req, res, next) => {
  try {
    const items = await Item.find({ user: req.user.id })
      .sort('-createdAt');

    res.json({ success: true, count: items.length, items });
  } catch (error) {
    next(error);
  }
};

exports.getItem = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('user', 'name email phone');

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json({ success: true, item });
  } catch (error) {
    next(error);
  }
};

exports.updateItem = async (req, res, next) => {
  try {
    let item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Check ownership
    if (item.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    item = await Item.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.json({ success: true, item });
  } catch (error) {
    next(error);
  }
};

exports.deleteItem = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Check ownership
    if (item.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await item.deleteOne();

    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    next(error);
  }
};
