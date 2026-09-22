// controllers/studentController.js
const Attempt = require('../models/Attempt');
const Gift = require('../models/Gift');

exports.listAttempts = async (req, res, next) => {
  try {
    const userId = req.query.userId || null;
    const filter = userId ? { userId } : {};
    const attempts = await Attempt.find(filter).sort({ startedAt: -1 }).lean();
    res.json({ success:true, attempts });
  } catch (err) { next(err); }
};

exports.getAttempt = async (req, res, next) => {
  try {
    const att = await Attempt.findById(req.params.id).lean();
    if (!att) return res.status(404).json({ success:false, error:'Attempt not found' });
    res.json({ success:true, attempt: att });
  } catch (err) { next(err); }
};

exports.listGifts = async (req, res, next) => {
  try {
    const userId = req.query.userId || null;
    if (userId) {
      const gifts = await Gift.find({ 'issuedTo.userId': userId }).lean();
      return res.json({ success:true, gifts });
    }
    const gifts = await Gift.find({ active: true }).lean();
    res.json({ success:true, gifts });
  } catch (err) { next(err); }
};

exports.claimGift = async (req, res, next) => {
  try {
    const { userId, giftId, attemptId } = req.body;
    if (!userId || !giftId) return res.status(400).json({ success:false, error:'userId and giftId required' });

    const gift = await Gift.findById(giftId);
    if (!gift) return res.status(404).json({ success:false, error:'Gift not found' });
    if (!gift.active) return res.status(400).json({ success:false, error:'Gift not active' });

    gift.issuedTo.push({ userId, attemptId: attemptId || null, issuedAt: new Date() });
    await gift.save();

    res.json({ success:true, gift });
  } catch (err) { next(err); }
};
