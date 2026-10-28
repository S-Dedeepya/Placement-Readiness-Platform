# Placement Readiness Platform

A full-stack web application that helps students prepare for placements by comparing their current skills with the requirements of their target job roles and identifying areas for improvement.

The platform allows students to manage their profiles, record skill proficiency, maintain project and certification details, and receive role-specific placement preparation guidance.

## Features

- **Authentication:** Sign up, log in, and log out.
- **Student Profile:** Manage academic information, including name, branch, year of study, college, and CGPA.
- **Skills Management:** Add, update, and remove skills with proficiency levels from 1 to 10.
- **Project Management:** Maintain a portfolio of projects, including descriptions, technologies, and repository links.
- **Certifications:** Record certifications, issuers, and earned dates.
- **Job Role Selection:** Explore available target job roles.
- **Skill-Gap Analysis:** Compare current skill proficiency with the requirements of a selected job role.
- **Personalized Feedback:** Identify missing skills and areas where proficiency needs improvement.
- **Personalized Learning Roadmap (V2):** Generate a structured learning report with recommendations organized into learning phases.
- **Evidence-Based Recommendations:** Use recorded skills, projects, and certifications as contextual evidence when generating roadmap recommendations.
- **Semantic Matching:** Match student evidence to relevant skills using semantic similarity.
- **Data Protection:** Use Supabase authentication and Row Level Security (RLS) to help protect student data.

## Roadmap V2

Roadmap V2 focuses on presenting personalized placement preparation recommendations as a concise learning report rather than a task-tracking interface.

The roadmap generation approach combines:

- Role-specific skill requirements and skill-gap prioritization.
- Semantic matching between required skills and recorded student evidence.
- Rule-based recommendation templates customized using available student information.
- Learning phases that organize recommendations into a more coherent preparation path.

Recommendations depend on the information available in the student's profile and the requirements associated with the selected role. The current approach uses semantic matching and predefined recommendation rules; it is not a newly trained recommendation model.

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

Replace `YOUR_USERNAME` with your GitHub username and adjust the repository URL if necessary.

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

Replace the placeholders with the appropriate values from your Supabase project. Confirm the variable names against your application's configuration if it uses different names.

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

Verify the endpoint paths against the current source code before relying on this table as a complete API reference.

## Project Goals

The goal of this project is to help students understand their placement readiness, identify skills to improve, and follow a structured preparation path for their desired job roles.

The project also serves as a practical application of full-stack web development, API design, database integration, authentication, and access control.

## Future Improvements

- Improve personalization and recommendation quality.
- Expand supported job roles and skill requirements.
- Incorporate relevant learning resources into roadmap recommendations.
- Evaluate recommendation quality using real usage and feedback.
- Improve deployment, monitoring, and production reliability.

## Status

**Version:** V2 — Personalized Learning Roadmap Report

Roadmap V2 focuses on presenting role-specific, evidence-informed learning recommendations in a concise report format.

Built as a full-stack portfolio project.