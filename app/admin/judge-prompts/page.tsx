"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

interface JudgePrompt {
  id?: string;
  type: string;
  prompt: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const promptTypeLabels: Record<string, string> = {
  judge1_grok: "Judge 1 (Grok)",
  judge2_claude: "Judge 2 (Claude)",
  judge3_chatgpt: "Judge 3 (ChatGPT)",
  private_feedback: "Private Feedback",
  official_result: "Official Result"
};

export default function JudgePromptsPage() {
  const { data: session, status } = useSession();
  const [prompts, setPrompts] = useState<JudgePrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || session?.user?.role !== "admin") {
      redirect("/auth/login");
    }
    
    loadPrompts();
  }, [status, session]);

  const loadPrompts = async () => {
    try {
      const response = await fetch("/api/admin/judge-prompts");
      if (response.ok) {
        const data = await response.json();
        setPrompts(data);
      }
    } catch (error) {
      console.error("Error loading prompts:", error);
      setMessage("Failed to load prompts");
    } finally {
      setLoading(false);
    }
  };

  const savePrompts = async () => {
    setSaving(true);
    setMessage("");
    
    try {
      const response = await fetch("/api/admin/judge-prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts })
      });

      if (response.ok) {
        setMessage("Prompts saved successfully!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        throw new Error("Failed to save prompts");
      }
    } catch (error) {
      console.error("Error saving prompts:", error);
      setMessage("Failed to save prompts");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!confirm("This will delete all saved prompts and reload the built-in defaults. Continue?")) return;
    setSeeding(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/judge-prompts", { method: "DELETE" });
      if (response.ok) {
        setMessage("Reset to defaults. Reloading...");
        await loadPrompts();
        setTimeout(() => setMessage(""), 3000);
      } else {
        throw new Error("Failed to reset");
      }
    } catch (error) {
      console.error("Error resetting prompts:", error);
      setMessage("Failed to reset prompts");
    } finally {
      setSeeding(false);
    }
  };

  const updatePrompt = (type: string, field: string, value: string | boolean) => {
    setPrompts(prevPrompts => 
      prevPrompts.map(p => 
        p.type === type ? { ...p, [field]: value } : p
      )
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <div className="text-lg">Loading judge prompts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Judge Prompts</h1>
          <p className="text-gray-600 mt-2">
            Persona and style instructions appended to each judge. Do <strong>not</strong> include JSON schemas here — only coaching/style text.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={resetToDefaults}
            disabled={seeding}
            className="bg-gray-600 hover:bg-gray-700"
          >
            {seeding ? "Resetting..." : "Reset to Defaults"}
          </Button>
          <Button
            onClick={savePrompts}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? "Saving..." : "Save All Changes"}
          </Button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.includes("success") 
            ? "bg-green-100 text-green-800" 
            : "bg-red-100 text-red-800"
        }`}>
          {message}
        </div>
      )}

      <div className="space-y-6">
        {prompts.map((prompt) => (
          <Card key={prompt.type} className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">
                  {promptTypeLabels[prompt.type] || prompt.type}
                </h3>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prompt.isActive}
                    onChange={(e) => updatePrompt(prompt.type, "isActive", e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Active</span>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prompt Text
                </label>
                <textarea
                  value={prompt.prompt}
                  onChange={(e) => updatePrompt(prompt.type, "prompt", e.target.value)}
                  className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="Enter prompt text..."
                />
              </div>
              
              <div className="text-xs text-gray-500">
                <strong>Type:</strong> {prompt.type}
                {prompt.updatedAt && (
                  <>
                    {" • "}
                    <strong>Last updated:</strong> {new Date(prompt.updatedAt).toLocaleString()}
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}