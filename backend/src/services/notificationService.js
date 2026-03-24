const Notification = require('../models/Notification');
const Match = require('../models/Match');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
const { emitNotificationToUser, getIO } = require('../socket/socketHandler');

// Initialize Firebase Admin
let firebaseInitialized = false;
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== 'demo') {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
      })
    });
    firebaseInitialized = true;
    console.log('✅ Firebase initialized');
  } catch (error) {
    console.log('⚠️  Firebase not configured (push notifications disabled)');
  }
} else {
  console.log('⚠️  Firebase not configured (push notifications disabled)');
}

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

exports.sendMatchNotifications = async (match) => {
  try {
    // Populate match with full item details
    const populatedMatch = await Match.findById(match._id)
      .populate('lostItem')
      .populate('foundItem')
      .populate('lostUser')
      .populate('foundUser');

    const lostUser = populatedMatch.lostUser;
    const foundUser = populatedMatch.foundUser;
    const lostItem = populatedMatch.lostItem;
    const foundItem = populatedMatch.foundItem;

    const chatLink = `/chat/${match.chatRoomId}`;
    const fullChatLink = `${process.env.CLIENT_URL}${chatLink}`;

    // Create in-app notifications
    const [lostNotification, foundNotification] = await Promise.all([
      Notification.create({
        user: lostUser._id,
        type: 'match',
        title: 'Match Found!',
        message: `A similar item matched. Tap to open chat now.`,
        link: chatLink,
        data: { matchId: match._id, chatRoomId: match.chatRoomId }
      }),
      Notification.create({
        user: foundUser._id,
        type: 'match',
        title: 'Match Found!',
        message: `A similar item matched. Tap to open chat now.`,
        link: chatLink,
        data: { matchId: match._id, chatRoomId: match.chatRoomId }
      })
    ]);

    const io = getIO();
    emitNotificationToUser(io, lostUser._id, lostNotification);
    emitNotificationToUser(io, foundUser._id, foundNotification);

    // Send push notifications
    await Promise.all([
      sendPushNotification(lostUser, 'Match Found!', 'We found a potential match for your lost item!', chatLink),
      sendPushNotification(foundUser, 'Match Found!', 'Your found item matches someone\'s lost item!', chatLink)
    ]);

    // Prepare email content for lost item owner
    const lostUserEmailText = `
Hi ${lostUser.name},

Great news! We found a potential match for your lost item!

LOST ITEM DETAILS:
- Title: ${lostItem.title}
- Description: ${lostItem.description}
- Location: ${lostItem.location?.address || 'Not specified'}
- Date: ${lostItem.date ? new Date(lostItem.date).toLocaleDateString() : 'Not specified'}

FOUND ITEM DETAILS:
- Title: ${foundItem.title}
- Description: ${foundItem.description}
- Found by: ${foundUser.name}
- Location: ${foundItem.location?.address || 'Not specified'}

Match Score: ${(match.matchScore * 100).toFixed(0)}%

Click here to start chatting with the finder:
${fullChatLink}

Best regards,
FindMe Team
    `.trim();

    // Prepare email content for found item owner (includes verification info)
    let foundUserEmailText = `
Hi ${foundUser.name},

Great news! Your found item matches someone's lost item!

FOUND ITEM DETAILS:
- Title: ${foundItem.title}
- Description: ${foundItem.description}
- Location: ${foundItem.location?.address || 'Not specified'}

LOST ITEM DETAILS:
- Title: ${lostItem.title}
- Description: ${lostItem.description}
- Lost by: ${lostUser.name}
- Location: ${lostItem.location?.address || 'Not specified'}
- Date Lost: ${lostItem.date ? new Date(lostItem.date).toLocaleDateString() : 'Not specified'}
`;

    // Add verification info if available
    if (lostItem.verificationInfo) {
      foundUserEmailText += `
VERIFICATION INFORMATION (from owner):
${lostItem.verificationInfo}

⚠️ Please verify these details with the person before returning the item.
`;
    }

    foundUserEmailText += `
Match Score: ${(match.matchScore * 100).toFixed(0)}%

Click here to start chatting with the owner:
${fullChatLink}

Best regards,
FindMe Team
    `.trim();

    // Send emails
    await Promise.all([
      sendEmail(lostUser.email, '🎉 Match Found - FindMe', lostUserEmailText),
      sendEmail(foundUser.email, '🎉 Match Found - FindMe', foundUserEmailText)
    ]);

    await Match.findByIdAndUpdate(match._id, { notificationsSent: true });
  } catch (error) {
    console.error('Notification error:', error);
  }
};

const sendPushNotification = async (user, title, body, link) => {
  if (!firebaseInitialized || !user.fcmToken) return;

  try {
    await admin.messaging().send({
      token: user.fcmToken,
      notification: { title, body },
      data: { link },
      webpush: {
        fcmOptions: { link: `${process.env.CLIENT_URL}${link}` }
      }
    });
  } catch (error) {
    console.error('FCM error:', error.message);
  }
};

const sendEmail = async (to, subject, text) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text
    });
  } catch (error) {
    console.error('Email error:', error.message);
  }
};

exports.createNotification = async (userId, type, title, message, link, data) => {
  return await Notification.create({
    user: userId,
    type,
    title,
    message,
    link,
    data
  });
};
