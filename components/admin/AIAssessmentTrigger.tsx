"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface AssessmentResult {
  total: number;
  processed: number;
  errors: Array<{ debateId: string; error: string }>;
  success: Array<{ debateId: string; motion: string }>;
}

interface DebateNeedingAssessment {
  id: string;
  motion: string;
  debaters: string;
  completedAt: string;
  hasWinner: boolean;
  hasJudgeResults: boolean;
}

export default function AIAssessmentTrigger() {
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [status, setStatus] = useState<{
    count: number;
    debates: DebateNeedingAssessment[];
  } | null>(null);

  const checkStatus = async () => {
    setCheckingStatus(true);
    try {
      const response = await fetch("/api/admin/trigger-ai-assessment");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("Failed to check status:", error);
      alert("Failed to check AI assessment status");
    } finally {
      setCheckingStatus(false);
    }
  };

  const triggerAssessment = async () => {
    if (!confirm("This will trigger AI assessment for all completed debates without results. This may take several minutes. Continue?")) {
      return;
    }

    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch("/api/admin/trigger-ai-assessment", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setResult(data.results);
      
      // Refresh status after processing
      await checkStatus();
      
    } catch (error) {
      console.error("Failed to trigger AI assessment:", error);
      alert("Failed to trigger AI assessment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[--radius] border border-border bg-surface p-5">
      <h2 className="font-semibold text-foreground mb-4">AI Assessment Tools</h2>
      
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Button
            onClick={checkStatus}
            disabled={checkingStatus}
            variant="secondary"
            size="sm"
          >
            {checkingStatus ? "Checking..." : "Check Status"}
          </Button>
          
          <Button
            onClick={triggerAssessment}
            disabled={loading || checkingStatus}
            size="sm"
          >
            {loading ? "Processing..." : "Trigger AI Assessment"}
          </Button>
        </div>

        {status && (
          <div className="text-sm">
            <p className={`font-medium ${status.count > 0 ? "text-amber-600" : "text-green-600"}`}>
              {status.count === 0 
                ? "✓ All completed debates have AI assessments" 
                : `${status.count} debates need AI assessment`
              }
            </p>
            
            {status.count > 0 && status.debates.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto">
                <p className="text-xs text-foreground-muted mb-1">Debates needing assessment:</p>
                <ul className="text-xs text-foreground-muted space-y-1">
                  {status.debates.slice(0, 5).map((debate) => (
                    <li key={debate.id} className="flex justify-between">
                      <span className="truncate">
                        {debate.debaters}: {debate.motion.substring(0, 40)}...
                      </span>
                      <span className="text-xs">
                        {!debate.hasWinner ? "No winner" : !debate.hasJudgeResults ? "No judges" : ""}
                      </span>
                    </li>
                  ))}
                  {status.debates.length > 5 && (
                    <li className="text-xs text-foreground-subtle">
                      ...and {status.debates.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="text-sm border-t border-border pt-3 mt-2">
            <h3 className="font-medium text-foreground mb-2">Processing Results</h3>
            <div className="space-y-2">
              <p className="text-foreground">
                <span className="font-medium">Total:</span> {result.total} debates found
              </p>
              <p className="text-green-600">
                <span className="font-medium">Success:</span> {result.success.length} debates processed
              </p>
              {result.errors.length > 0 && (
                <div>
                  <p className="text-red-600 font-medium">
                    Errors: {result.errors.length} failed
                  </p>
                  <ul className="text-xs text-red-500 mt-1 max-h-24 overflow-y-auto">
                    {result.errors.map((error, i) => (
                      <li key={i}>
                        Debate {error.debateId}: {error.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}