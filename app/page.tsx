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
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const renderFormattedText = (text: string) => {
    // Split text into paragraphs
    const paragraphs = text.split("\n\n");

    return paragraphs.map((paragraph, pIndex) => {
      let formatted = paragraph;

      // Handle headings (###, ####)
      formatted = formatted.replace(/^###\s+(.*)$/gm, (_, h) => `<h3>${h}</h3>`);
      formatted = formatted.replace(/^####\s+(.*)$/gm, (_, h) => `<h4>${h}</h4>`);

      // Handle bold text (**text** or __text__)
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, (_, b) => `<strong>${b}</strong>`);
      formatted = formatted.replace(/__(.*?)__/g, (_, b) => `<strong>${b}</strong>`);

      // Handle bullet lists (- item or * item)
      const bulletListRegex = /^([\s]*)([-*])\s+(.*)$/gm;
      let listStarted = false;
      let inList = false;
      let listItems: string[] = [];
      let result = "";
      const lines = formatted.split("\n");

      lines.forEach((line, index) => {
        const bulletMatch = line.match(bulletListRegex);
        if (bulletMatch) {
          if (!inList) {
            inList = true;
            listStarted = true;
            result += "<ul>";
          }
          const itemText = line.replace(/^[\s]*[-*]\s+/, "");
          result += `<li>${itemText}</li>`;
        } else {
          const numMatch = line.match(/^[\s]*(\d+)\.\s+(.*)$/);
          if (numMatch) {
            if (!inList) {
              inList = true;
              listStarted = true;
              result += "<ol>";
            }
            result += `<li>${numMatch[2]}</li>`;
          } else {
            if (inList) {
              result += "</ul>";
              inList = false;
            }
            if (line.trim() && !line.startsWith("<h") && !line.startsWith("<li") && !line.startsWith("<ul") && !line.startsWith("<ol")) {
              result += `<p>${line}</p>`;
            } else {
              result += line;
            }
          }
        }
      });

      if (inList) {
        result += "</ul>";
      }

      return (
        <div
          key={pIndex}
          dangerouslySetInnerHTML={{ __html: result }}
        />
      );
    });
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-primary/10 border border-primary/20">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Orion AI Router
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Intelligently routes your requests to the optimal LLM based on cost, quality, and task complexity.
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-card rounded-lg border border-border p-6 space-y-4 shadow-sm">
          <Textarea
            placeholder="Ask anything. Orion will find the best model for your task..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="min-h-[120px] text-base resize-none"
          />
          <Button
            onClick={handleSubmit}
            disabled={loading || !prompt.trim()}
            size="lg"
            className="w-full md:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Ask Orion
              </>
            )}
          </Button>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <h3 className="font-semibold text-destructive mb-1">Error</h3>
            <p className="text-sm text-destructive/90">{error}</p>
          </div>
        )}

        {/* Results */}
        {response && (
          <div className="space-y-6">
            {/* Routing Decision */}
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Brain className="w-5 h-5 text-primary" />
                  <div>
                    <CardTitle>Routing Decision</CardTitle>
                    <CardDescription>Model: <span className="font-semibold text-foreground">{response.routerDecision.selectedModel}</span></CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-lg bg-secondary p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Task Type</p>
                    <p className="font-semibold text-sm capitalize">
                      {response.routerDecision.taskType}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Complexity</p>
                    <p className="font-semibold text-sm capitalize">
                      {response.routerDecision.complexity}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confidence</p>
                    <p className="font-semibold text-sm text-primary">
                      {response.routerDecision.confidence}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      Est. Cost
                    </p>
                    <p className="font-semibold text-sm">
                      ${response.routerDecision.estimatedCost.toFixed(6)}
                    </p>
                  </div>
                </div>

                {/* Token Info */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Prompt Tokens</p>
                    <p className="font-semibold">{response.routerDecision.estimatedPromptTokens}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Completion Tokens</p>
                    <p className="font-semibold">{response.routerDecision.estimatedCompletionTokens}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Reasoning</p>
                    <p className="font-semibold">{response.routerDecision.reasoningNeeded ? "Yes" : "No"}</p>
                  </div>
                </div>

                {/* Reasoning */}
                <div className="rounded-lg bg-primary/5 border border-primary/10 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold">Reasoning</p>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {response.routerDecision.reason}
                  </p>
                </div>

                {/* Alternatives */}
                {response.routerDecision.alternatives.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Alternative Models</p>
                    <div className="grid grid-cols-1 gap-2">
                      {response.routerDecision.alternatives.map((alt, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-sm">{alt.model}</span>
                            <span
                              className={`text-xs font-medium px-2.5 py-1 rounded-full ${alt.status === "Rejected"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-accent/10 text-accent"
                                }`}
                            >
                              {alt.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {alt.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Response */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>AI Response</CardTitle>
                <CardDescription>
                  Powered by {response.routerDecision.selectedModel}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm leading-relaxed [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-1.5 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_strong]:font-semibold [&_strong]:text-foreground [&_p]:mb-2">
                  {renderFormattedText(response.answer)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
