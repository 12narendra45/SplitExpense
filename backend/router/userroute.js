const express = require('express');
const supabase = require('../config/supabase');
const { PROFILES, ROOMS, ROOM_MEMBERS, EXPENSES, EXPENSE_SPLITS, NOTIFICATIONS } = require('../models/tables');

const router = express.Router();

router.post('/signup', async (req, res) => {
  const { name, email, password, room_code } = req.body;

  try {
    const { data, error } = await supabase
      .from(PROFILES)
      .insert([{ name, email, password, room_code: room_code || null }])
      .select();

    if (error) throw error;
    res.status(201).json({ message: 'User created', user: data?.[1] });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
});

router.post('/rooms', async (req, res) => {
  const { name, created_by, member_emails = [] } = req.body;

  try {
    const room_code = Math.random().toString(36).slice(2, 8).toUpperCase();

    const { data: roomData, error: roomError } = await supabase
      .from(ROOMS)
      .insert([{ name, created_by, room_code }])
      .select();

    if (roomError) throw roomError;

    const room = roomData?.[0];
    const members = [{ room_id: room.id, user_id: created_by, role: 'admin' }];

    for (const email of member_emails) {
      members.push({ room_id: room.id, email, role: 'member' });
    }

    const { error: memberError } = await supabase.from(ROOM_MEMBERS).insert(members);
    if (memberError) throw memberError;

    res.status(201).json({ message: 'Room created', room, room_code });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create room', error: err.message });
  }
});

router.post('/expenses', async (req, res) => {
  const { room_id, paid_by, amount, category, description, split_between = [], image_url } = req.body;

  try {
    const { data: expenseData, error: expenseError } = await supabase
      .from(EXPENSES)
      .insert([{ room_id, paid_by, amount, category, description, image_url: image_url || null }])
      .select();

    if (expenseError) throw expenseError;

    const expense = expenseData?.[0];
    const splitCount = split_between.length || 1;
    const perPerson = Number(amount) / splitCount;

    const splits = split_between.map((user_id) => ({ expense_id: expense.id, user_id, amount: perPerson }));

    const { error: splitError } = await supabase.from(EXPENSE_SPLITS).insert(splits);
    if (splitError) throw splitError;

    const { error: notifyError } = await supabase.from(NOTIFICATIONS).insert([{ room_id, user_id: paid_by, message: `${description || 'Expense'} added for ${amount}` }]);
    if (notifyError) throw notifyError;

    res.status(201).json({ message: 'Expense added', expense, perPerson });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add expense', error: err.message });
  }
});

router.get('/rooms/:roomId/balances', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(EXPENSES)
      .select('*')
      .eq('room_id', req.params.roomId);

    if (error) throw error;
    res.json({ expenses: data || [] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch balances', error: err.message });
  }
});

module.exports = router;
