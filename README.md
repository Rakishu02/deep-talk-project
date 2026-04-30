# Deep Talk Vault

A romantic, interactive deep-talk web app for couples built with React, Vite, Tailwind CSS, Framer Motion, and Supabase.

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

3. Audio is synthesized in the browser after the first tap, so the app no longer
   needs uploaded mp3 assets to feel alive.

4. Run the app:

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
| `is_opened` | `bool` |

When a question is submitted, the app inserts `{ text, is_opened: false }`.
When a vault card is closed or skipped forward, the app updates `is_opened` to `true`.

The deployed app also ships with a built-in starter deck. Those starter questions
do not need database rows, and their opened state is stored in each visitor's
browser.
