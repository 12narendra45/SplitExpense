const express = require('express');
const multer = require('multer');
const supabase = require('../config/supabase');
const { PROFILES, ROOMS, ROOM_MEMBERS, EXPENSES, EXPENSE_SPLITS, NOTIFICATIONS } = require('../models/tables');

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

const joinRoomByCode = async (profile, roomCode) => {
  if (!roomCode) return null;

  const { data: roomData, error: roomError } = await supabase
    .from(ROOMS)
    .select('id, room_code')
    .eq('room_code', roomCode)
    .maybeSingle();

  if (roomError) throw roomError;
  if (!roomData) return null;

  const { data: existingMember, error: memberCheckError } = await supabase
    .from(ROOM_MEMBERS)
    .select('id')
    .eq('room_id', roomData.id)
    .or(`user_id.eq.${profile.id},email.eq.${profile.email}`)
    .maybeSingle();

  if (memberCheckError) throw memberCheckError;

  if (!existingMember) {
    const { error: memberInsertError } = await supabase
      .from(ROOM_MEMBERS)
      .insert([{ room_id: roomData.id, user_id: profile.id, email: profile.email, role: 'member' }]);

    if (memberInsertError) throw memberInsertError;
  }

  return roomData;
};

router.post('/signup', async (req, res) => {
  const { name, email, password, room_code } = req.body;

  try {
    const { data, error } = await supabase
      .from(PROFILES)
      .insert([{ name, email, password, room_code: room_code || null }])
      .select();

    if (error) throw error;

    const user = data?.[0] || null;
    let joinedRoom = null;

    if (user) {
      joinedRoom = await joinRoomByCode(user, room_code);
      await supabase
        .from(PROFILES)
        .update({ room_code: room_code || null })
        .eq('id', user.id);
    }

    res.status(201).json({ message: 'User created', user, joinedRoom });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password, room_code } = req.body;

  try {
    const { data, error } = await supabase
      .from(PROFILES)
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    let joinedRoom = null;
    if (room_code) {
      joinedRoom = await joinRoomByCode(data, room_code);
      await supabase
        .from(PROFILES)
        .update({ room_code: room_code })
        .eq('id', data.id);
    }

    res.json({ message: 'Login successful', user: data, joinedRoom });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

router.get('/profiles/exists', async (req, res) => {
  const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : null;
  if (!email) {
    return res.status(400).json({ message: 'Email query is required' });
  }

  try {
    const { data, error } = await supabase
      .from(PROFILES)
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    res.json({ exists: !!data });
  } catch (err) {
    res.status(500).json({ message: 'Failed to check profile', error: err.message });
  }
});

router.post('/upload/bill', upload.single('bill'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileName = `${Date.now()}_${req.file.originalname}`;
    const { data, error: uploadError } = await supabase.storage
      .from('bills')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData, error: publicError } = await supabase.storage
      .from('bills')
      .createSignedUrl(fileName, 60 * 60 * 24); // 24 hours

    if (publicError) {
      throw publicError;
    }

    res.status(201).json({ url: publicData.signedUrl, path: fileName });
  } catch (err) {
    res.status(500).json({ message: 'Failed to upload bill', error: err.message });
  }
});

router.post('/rooms', async (req, res) => {
  const { name, created_by, created_by_email, member_emails = [] } = req.body;

  try {
    const room_code = Math.random().toString(36).slice(2, 8).toUpperCase();
    let creatorId = typeof created_by === 'string' && created_by.length > 0 ? created_by : null;
    const creatorEmail = typeof created_by_email === 'string' && created_by_email.length > 0 ? created_by_email.trim().toLowerCase() : null;
    const uniqueMemberEmails = Array.from(new Set(member_emails.map((email) => email.trim().toLowerCase()).filter(Boolean)));
    const requestedEmails = Array.from(new Set([...(creatorEmail ? [creatorEmail] : []), ...uniqueMemberEmails]));

    if (requestedEmails.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from(PROFILES)
        .select('id,email')
        .in('email', requestedEmails);

      if (profileError) throw profileError;

      const foundEmails = profileData.map((profile) => profile.email.toLowerCase());
      const missingEmails = requestedEmails.filter((email) => !foundEmails.includes(email));

      if (missingEmails.length > 0) {
        return res.status(400).json({
          message: 'Room creation failed. The following emails are not registered: ' + missingEmails.join(', '),
          missingEmails
        });
      }

      if (!creatorId && creatorEmail) {
        const creatorProfile = profileData.find((profile) => profile.email.toLowerCase() === creatorEmail);
        if (creatorProfile) creatorId = creatorProfile.id;
      }
    }

    const insertData = { name, room_code };
    if (creatorId) insertData.created_by = creatorId;

    const { data: roomData, error: roomError } = await supabase
      .from(ROOMS)
      .insert([insertData])
      .select();

    if (roomError) throw roomError;

    const room = roomData?.[0];
    const members = [];

    if (creatorId) {
      members.push({ room_id: room.id, user_id: creatorId, role: 'admin' });
      const { error: profileUpdateError } = await supabase
        .from(PROFILES)
        .update({ room_code })
        .eq('id', creatorId);
      if (profileUpdateError) throw profileUpdateError;
    } else if (created_by_email) {
      members.push({ room_id: room.id, email: created_by_email.toLowerCase(), role: 'admin' });

      const { error: profileUpdateError } = await supabase
        .from(PROFILES)
        .update({ room_code })
        .eq('email', created_by_email.toLowerCase());
      if (profileUpdateError) throw profileUpdateError;
    }

    for (const email of uniqueMemberEmails) {
      const normalizedEmail = email.toLowerCase();
      const alreadyAdded = creatorEmail === normalizedEmail || members.some((member) => member.email === normalizedEmail);
      if (!alreadyAdded) {
        members.push({ room_id: room.id, email: normalizedEmail, role: 'member' });
      }
    }

    if (members.length > 0) {
      const { error: memberError } = await supabase.from(ROOM_MEMBERS).insert(members);
      if (memberError) throw memberError;
    }

    res.status(201).json({ message: 'Room created', room, room_code });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create room', error: err.message });
  }
});

router.post('/expenses', async (req, res) => {
  const {
    room_id,
    room_code,
    paid_by,
    paid_by_email,
    amount,
    category,
    description,
    split_between = [],
    split_between_emails = [],
    image_url
  } = req.body;

  try {
    let resolvedRoomId = room_id;
    if (!resolvedRoomId && room_code) {
      const { data: roomData, error: roomError } = await supabase
        .from(ROOMS)
        .select('id')
        .eq('room_code', room_code)
        .maybeSingle();

      if (roomError) throw roomError;
      if (!roomData) return res.status(400).json({ message: 'Invalid room code' });
      resolvedRoomId = roomData.id;
    }

    let resolvedPaidBy = paid_by;
    if (!resolvedPaidBy && paid_by_email) {
      const { data: userData, error: userError } = await supabase
        .from(PROFILES)
        .select('id')
        .eq('email', paid_by_email)
        .maybeSingle();

      if (userError) throw userError;
      if (!userData) return res.status(400).json({ message: 'Invalid payer email' });
      resolvedPaidBy = userData.id;
    }

    if (!resolvedRoomId) {
      return res.status(400).json({ message: 'room_id or room_code is required' });
    }

    if (!resolvedPaidBy) {
      return res.status(400).json({ message: 'paid_by or paid_by_email is required' });
    }

    const { data: expenseData, error: expenseError } = await supabase
      .from(EXPENSES)
      .insert([{ room_id: resolvedRoomId, paid_by: resolvedPaidBy, amount, category, description, image_url: image_url || null }])
      .select();

    if (expenseError) throw expenseError;

    const expense = expenseData?.[0];

    const { data: roomMembers, error: membersError } = await supabase
      .from(ROOM_MEMBERS)
      .select('user_id,email')
      .eq('room_id', resolvedRoomId);

    if (membersError) throw membersError;

    // Determine users to split between.
    // Priority: if frontend provided split ids or emails, use those.
    // Otherwise, default to all members of the room.
    const splitEmails = Array.isArray(split_between_emails) ? split_between_emails.map((e) => e.trim().toLowerCase()) : [];
    const splitIds = Array.isArray(split_between) ? split_between : [];

    const emailUserIds = [];
    for (const email of splitEmails) {
      const { data: userData, error: userError } = await supabase
        .from(PROFILES)
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (userError) throw userError;
      if (userData) {
        emailUserIds.push(userData.id);
      }
    }

    let splitUserIds = [];

    if ((splitIds && splitIds.length > 0) || (emailUserIds && emailUserIds.length > 0)) {
      splitUserIds = [...new Set([...splitIds, ...emailUserIds])];
    } else {
      const memberIds = [];
      for (const m of roomMembers || []) {
        if (m.user_id) memberIds.push(m.user_id);
        else if (m.email) {
          const { data: u, error: ue } = await supabase
            .from(PROFILES)
            .select('id')
            .eq('email', m.email)
            .maybeSingle();
          if (ue) throw ue;
          if (u) memberIds.push(u.id);
        }
      }

      splitUserIds = Array.from(new Set(memberIds));
    }

    // Ensure payer is included
    if (resolvedPaidBy) splitUserIds = Array.from(new Set([...splitUserIds, resolvedPaidBy]));

    const splitCount = splitUserIds.length || 1;
    const perPerson = Number(amount) / splitCount;

    const splits = splitUserIds.map((user_id) => ({ expense_id: expense.id, user_id, amount: perPerson }));

    if (splits.length > 0) {
      const { error: splitError } = await supabase.from(EXPENSE_SPLITS).insert(splits);
      if (splitError) throw splitError;
    }

    const notificationUserIds = Array.from(new Set(
      (roomMembers || [])
        .map((member) => {
          if (member.user_id) return member.user_id;
          if (member.email) {
            return null;
          }
          return null;
        })
        .filter((userId) => userId && userId !== resolvedPaidBy)
    ));

    if (notificationUserIds.length > 0) {
      const notifications = notificationUserIds.map((userId) => ({
        room_id: resolvedRoomId,
        user_id: userId,
        message: `${description || 'Expense'} added for ${amount}`
      }));

      const { error: notifyError } = await supabase.from(NOTIFICATIONS).insert(notifications);
      if (notifyError) throw notifyError;
    }

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

router.get('/rooms/code/:roomCode/balances', async (req, res) => {
  try {
    const { data: roomData, error: roomError } = await supabase
      .from(ROOMS)
      .select('id')
      .eq('room_code', req.params.roomCode)
      .maybeSingle();

    if (roomError) throw roomError;
    if (!roomData) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const { data: roomMembers, error: membersError } = await supabase
      .from(ROOM_MEMBERS)
      .select('user_id,email')
      .eq('room_id', roomData.id);

    if (membersError) throw membersError;

    const memberUserIds = (roomMembers || []).map((member) => member.user_id).filter(Boolean);
    const memberEmails = (roomMembers || []).map((member) => member.email?.trim().toLowerCase()).filter(Boolean);

    const { data: expenses, error: expensesError } = await supabase
      .from(EXPENSES)
      .select('*, expense_splits(*)')
      .eq('room_id', roomData.id)
      .order('created_at', { ascending: false });

    if (expensesError) throw expensesError;

    const expenseUserIds = new Set(memberUserIds);
    const expenseEmails = new Set(memberEmails);

    (expenses || []).forEach((expense) => {
      if (expense.paid_by) {
        expenseUserIds.add(expense.paid_by);
      }
      const splits = Array.isArray(expense.expense_splits) ? expense.expense_splits : [];
      splits.forEach((split) => {
        if (split.user_id) expenseUserIds.add(split.user_id);
        if (split.email) expenseEmails.add(split.email.trim().toLowerCase());
      });
    });

    const profileById = new Map();
    const profileByEmail = new Map();

    if (expenseUserIds.size > 0) {
      const { data: profileDataById, error: profileIdError } = await supabase
        .from(PROFILES)
        .select('id,name,email')
        .in('id', Array.from(expenseUserIds));

      if (profileIdError) throw profileIdError;
      (profileDataById || []).forEach((profile) => {
        profileById.set(profile.id, profile);
      });
    }

    if (expenseEmails.size > 0) {
      const { data: profileDataByEmail, error: profileEmailError } = await supabase
        .from(PROFILES)
        .select('id,name,email')
        .in('email', Array.from(expenseEmails));

      if (profileEmailError) throw profileEmailError;
      (profileDataByEmail || []).forEach((profile) => {
        profileByEmail.set(profile.email?.toLowerCase(), profile);
      });
    }

    const getProfileName = (userId, email) => {
      if (userId && profileById.has(userId)) return profileById.get(userId).name;
      if (email) return profileByEmail.get(email.trim().toLowerCase())?.name || null;
      return null;
    };

    const expensesWithNames = (expenses || []).map((expense) => {
      const expenseSplits = (Array.isArray(expense.expense_splits) ? expense.expense_splits : []).map((split) => {
        const splitName = getProfileName(split.user_id, split.email);
        const displayName = splitName || split.user_name || split.display_name || split.email || null;

        return {
          ...split,
          user_name: splitName || split.user_name || split.email || null,
          display_name: displayName
        };
      });

      const paidByName = getProfileName(expense.paid_by, null);

      return {
        ...expense,
        paid_by_name: paidByName || expense.paid_by_name || null,
        expense_splits: expenseSplits
      };
    });

    res.json({ expenses: expensesWithNames });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch balances', error: err.message });
  }
});

router.get('/rooms', async (req, res) => {
  const { user_id, email } = req.query;

  if (!user_id && !email) {
    return res.status(400).json({ message: 'user_id or email is required' });
  }

  try {
    const rooms = [];

    if (user_id) {
      const { data: creatorRooms, error: creatorError } = await supabase
        .from(ROOMS)
        .select('*')
        .eq('created_by', user_id);

      if (creatorError) throw creatorError;
      if (creatorRooms) rooms.push(...creatorRooms);
    }

    let memberRoomIds = [];
    if (user_id || email) {
      let memberQuery = supabase.from(ROOM_MEMBERS).select('room_id');
      if (user_id && email) {
        memberQuery = memberQuery.or(`user_id.eq.${user_id},email.eq.${email}`);
      } else if (user_id) {
        memberQuery = memberQuery.eq('user_id', user_id);
      } else {
        memberQuery = memberQuery.eq('email', email);
      }

      const { data: memberRooms, error: memberError } = await memberQuery;
      if (memberError) throw memberError;
      memberRoomIds = memberRooms?.map((item) => item.room_id) || [];
    }

    if (memberRoomIds.length > 0) {
      const { data: joinedRooms, error: joinedError } = await supabase
        .from(ROOMS)
        .select('*')
        .in('id', memberRoomIds);
      if (joinedError) throw joinedError;
      if (joinedRooms) rooms.push(...joinedRooms);
    }

    const uniqueRooms = Array.from(new Map(rooms.map((room) => [room.id, room])).values());
    res.json({ rooms: uniqueRooms });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch rooms', error: err.message });
  }
});

router.get('/rooms/:roomId/notifications', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(NOTIFICATIONS)
      .select('*')
      .eq('room_id', req.params.roomId)
      .order('id', { ascending: false });

    if (error) throw error;
    res.json({ notifications: data || [] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
  }
});

// Settle (clear) all expenses for a room — resets balances to zero
router.post('/rooms/:roomId/settle', async (req, res) => {
  const roomId = req.params.roomId;
  try {
    // fetch expense ids for the room
    const { data: expenses, error: expError } = await supabase
      .from(EXPENSES)
      .select('id')
      .eq('room_id', roomId);

    if (expError) throw expError;

    const expenseIds = Array.isArray(expenses) ? expenses.map((e) => e.id).filter(Boolean) : [];

    if (expenseIds.length > 0) {
      // delete splits
      const { error: splitDelError } = await supabase.from(EXPENSE_SPLITS).delete().in('expense_id', expenseIds);
      if (splitDelError) throw splitDelError;

      // delete expenses
      const { error: expDelError } = await supabase.from(EXPENSES).delete().in('id', expenseIds);
      if (expDelError) throw expDelError;
    }

    res.json({ message: 'Room settled', deleted: expenseIds.length });
  } catch (err) {
    res.status(500).json({ message: 'Failed to settle room', error: err.message });
  }
});

module.exports = router;
