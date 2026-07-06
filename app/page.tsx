"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Sparkles, Brain, Zap, DollarSign, Lightbulb } from "lucide-react";
import type { FinalRouterDecision } from "@/types";


interface ChatResponse {
  routerDecision: FinalRouterDecision;
  answer: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      const data: ChatResponse = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Orion AI Router
          </h1>
          <p className="text-muted-foreground">
            Balances cost, quality, and capability to find the perfect LLM for your task
          </p>
        </div>

        <div className="space-y-4">
          <Textarea
            placeholder="Enter your prompt here..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="min-h-[120px] text-base resize-none"
          />
          <Button
            onClick={handleSubmit}
            disabled={loading || !prompt.trim()}
            className="w-full md:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Ask Orion
                <Zap className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {response && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  <CardTitle>Routing Decision</CardTitle>
                </div>
                <CardDescription>
                  How Orion decided which model to use
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Task Type</p>
                    <p className="font-medium capitalize">
                      {response.routerDecision.taskType}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Complexity</p>
                    <p className="font-medium capitalize">
                      {response.routerDecision.complexity}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      Estimated Cost
                    </p>
                    <p className="font-medium text-green-600 dark:text-green-400">
                      ${response.routerDecision.estimatedCost.toFixed(6)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Confidence</p>
                    <p className="font-medium">
                      {response.routerDecision.confidence}%
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Needs Reasoning</p>
                    <p className="font-medium">
                      {response.routerDecision.reasoningNeeded ? "Yes" : "No"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Estimated Prompt Tokens</p>
                    <p className="font-medium">
                      {response.routerDecision.estimatedPromptTokens}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Estimated Completion Tokens</p>
                    <p className="font-medium">
                      {response.routerDecision.estimatedCompletionTokens}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Selected Model</p>
                  <p className="font-medium text-lg">
                    {response.routerDecision.selectedModel}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <Lightbulb className="w-3 h-3 inline mr-1" />
                    Reasoning
                  </p>
                  <p className="text-sm leading-relaxed bg-secondary/50 p-3 rounded-md">
                    {response.routerDecision.reason}
                  </p>
                </div>

                {response.routerDecision.alternatives.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Alternative Models</p>
                    <div className="grid grid-cols-1 gap-3">
                      {response.routerDecision.alternatives.map((alt, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-md bg-secondary/30 border border-border"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{alt.model}</span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                alt.status === "Rejected"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              }`}
                            >
                              {alt.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {alt.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Response</CardTitle>
                <CardDescription>
                  From {response.routerDecision.selectedModel}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {response.answer}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
