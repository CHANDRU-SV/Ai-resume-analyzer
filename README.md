# AI Resume Analyzer

A web-based platform for students and job seekers to upload resumes, analyze them with Gemini AI, discover jobs, apply for jobs, and track applications.

## Features

- Supabase authentication and student profiles
- Private PDF resume storage
- Gemini AI resume analysis with score, detected skills, recommendations, and suggestions
- Job search and duplicate-safe applications
- Application tracking and an admin dashboard

## Technology

HTML, CSS, vanilla JavaScript, Supabase Authentication, PostgreSQL, Supabase Storage, Supabase Edge Functions, Gemini API, and PDF.js.

## Setup

1. Configure the Supabase URL and publishable key in `js/supabase.js`.
2. Keep the existing database tables, RLS policies, and private `resumes` Storage bucket.
3. In Supabase Edge Function secrets, set `GEMINI_API_KEY` to a valid Gemini API key. Never put this key in frontend files.
4. Deploy `supabase/functions/analyze-resume` as the `analyze-resume` Edge Function.
5. Serve the project with Live Server and open `index.html`.
