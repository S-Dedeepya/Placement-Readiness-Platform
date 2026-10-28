
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthTestPage() {
  const [result, setResult] = useState("Not tested");

  async function callFastAPI(endpoint: string, options?: RequestInit) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setResult("No active session. Please log in first.");
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:8001${endpoint}`,
        {
          ...options,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            ...options?.headers,
          },
        }
      );

      const body = await response.json();
      setResult(`Status: ${response.status}\n${JSON.stringify(body, null, 2)}`);
    } catch (error) {
      setResult(
        "Could not connect to FastAPI on port 8001. Check the server and CORS settings."
      );
    }
  }

  function testStudentData() {
    return callFastAPI("/student-data-check");
  }

  function testRoadmap() {
    return callFastAPI("/roadmap", {
      method: "POST",
      body: JSON.stringify({ role_id: "R1008" }),
    });
  }

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <h1 className="mb-4 text-xl font-bold">FastAPI Tests</h1>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={testStudentData}
          className="rounded border border-zinc-700 px-4 py-2"
        >
          Test Student Data
        </button>

        <button
          onClick={testRoadmap}
          className="rounded border border-zinc-700 px-4 py-2"
        >
          Test Roadmap (R1008)
        </button>
      </div>

      <pre className="mt-4 whitespace-pre-wrap break-words">
        {result}
      </pre>
    </main>
  );
}
