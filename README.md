# Deep Talk

A romantic question box for collecting deep-talk prompts first, then opening them later.
Built with React, Vite, Tailwind CSS, Framer Motion, and Supabase. Made with AI.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example` and add your Supabase values:

   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Replace the dummy mp3 files in `public/audio/` when you have final sounds.
   The current names match their effect so they are easy to search for.

4. Lock or unlock the Question Box in:

   ```text
   src/config/questionBoxSettings.js
   ```

5. Run the app:

   ```bash
   npm run dev
   ```

## Supabase Table

The app expects a `questions` table with:

| Column | Type |
| --- | --- |
| `id` | `int8` identity primary key |
| `created_at` | `timestamptz` |
| `text` | `text` |
| `category` | `text` |
| `is_opened` | `bool` |

`category` should be either `self` or `relationship`.

If your existing table does not have `category` yet, the app can still save the
question text, but categories will only persist after you add that column.
