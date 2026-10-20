# Placement Readiness Platform

A web application that helps students prepare for placements by comparing their current skills with the requirements of their target job roles.

The platform allows students to manage their profiles, track skill proficiency, and identify the skills they need to improve for their desired career path.

## Features

- **Authentication:** Sign up, log in, and log out.
- **Student Profile:** Manage academic information, including name, branch, year of study, college, and CGPA.
- **Skills Management:** Add, update, and remove skills with proficiency levels from 1 to 10.
- **Project Management:** Maintain a portfolio of projects, including descriptions, technologies, and repository links.
- **Certifications:** Track certifications, issuers, and earned dates.
- **Job Role Selection:** Explore available target job roles.
- **Skill-Gap Analysis:** Compare current skill proficiency against the requirements of a selected role.
- **Personalized Feedback:** Identify missing skills and proficiency gaps.
- **Data Protection:** Use Supabase authentication and Row Level Security (RLS) to protect student data.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript
- **Styling:** Tailwind CSS, shadcn/ui components
- **Backend:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Version Control:** Git and GitHub

## Getting Started

### Prerequisites

- Node.js and npm
- A Supabase project
- Git

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/placement-readiness-platform.git
cd placement-readiness-platform
```

Replace `YOUR_USERNAME` with your GitHub username.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root and add your Supabase project credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Replace the placeholders with the appropriate values from your Supabase project.

**Security:** Never commit `.env.local`, passwords, service-role keys, or other private credentials to GitHub.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for production

```bash
npm run build
```

## API Overview

The application exposes Next.js API routes for authentication, profile management, job roles, skill requirements, and student data.

| Endpoint | Purpose |
|---|---|
| `/api/auth/signup` | User registration |
| `/api/auth/login` | User login |
| `/api/profile` | Student profile management |
| `/api/job-roles` | Retrieve available job roles |
| `/api/skills` | Retrieve available skills |
| `/api/role-requirements` | Retrieve role-specific skill requirements |
| `/api/skill-gap` | Analyze skill gaps for a selected role |
| `/api/student-skills` | Manage student skills |
| `/api/student-projects` | Manage student projects |
| `/api/student-certifications` | Manage student certifications |

## Project Goals

The goal of this project is to help students understand their placement readiness through structured skill tracking and role-specific comparisons.

It also serves as a practical application of full-stack web development, API design, database integration, authentication, and access control.

## Future Improvements

- Personalized learning roadmaps
- AI-assisted skill recommendations
- Progress tracking and readiness reports
- Additional job roles and skill requirements
- Deployment and production monitoring

## Status

**Version:** V1 — Core placement-readiness features

Built as a full-stack portfolio project.