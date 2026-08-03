const express = require('express');
const dotenv = require('dotenv');
const supabase = require('./config/supabase');
const { PROFILES } = require('./models/tables');
const userRoute = require('./router/userroute');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use('/api', userRoute);

app.get('/hc', async (req, res) => {
  res.send('Hello the server is running fine');
});

supabase.from(PROFILES).select('id').limit(1)
  .then(() => {
    console.log('Supabase connection check passed');
  })
  .catch((err) => {
    console.error('Supabase connection check failed:', err.message);
  });

app.listen(port, () => {
  console.log(`The server is running on port ${port}`);
});