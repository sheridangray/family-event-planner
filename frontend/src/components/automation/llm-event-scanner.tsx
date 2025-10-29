"use client";

import { useState } from "react";
import { SparklesIcon, PaperAirplaneIcon, ClipboardDocumentIcon } from "@heroicons/react/24/outline";

const DEFAULT_PROMPT = `You are an expert family event discovery assistant for the San Francisco Bay Area. Search for family-friendly events across multiple sources.

FAMILY CONTEXT:
- Children: {{children_names}} (Ages: {{children_ages}})
- Age Range: {{age_range_min}} to {{age_range_max}} years old
- Interests: {{children_interests}}
- Home Location: {{home_location}}
- Search Radius: {{max_distance}} miles
- Current Date: {{current_date}}

TASK:
Search the following sources for events happening between {{target_date_range}}:
1. SF Recreation & Parks (sfrecpark.org)
2. California Academy of Sciences (calacademy.org)
3. Exploratorium (exploratorium.edu)
4. Chase Center (chasecenter.com/events)
5. SF Public Library (sfpl.org)
6. FunCheapSF (funcheapsf.com)
7. Bay Area Kid Fun (bayareakidfun.com)
8. Kids Out & About (kidsoutandabout.com)
9. Yerba Buena Gardens Festival (ybgfestival.org)

WEATHER FORECAST (next 14 days):
{{weather_forecast}}

For outdoor events, consider the weather conditions and recommend accordingly.

REQUIREMENTS:
- Focus on events appropriate for ages {{children_ages}} (suitable for {{age_range_min}}-{{age_range_max}} year olds)
- Rank results by relevance and quality (1-10 scale)
- **TOP 3 RECOMMENDATIONS** should be clearly marked with reasoning
- Include free and low-cost options
- Provide event name, date, time, location, cost, and brief description
- Note if registration is required
- Highlight events matching interests: {{children_interests}}
- For outdoor events, mention weather suitability

**RANKING FORMAT:**
1. **TOP PICK** - [Event Name] (Score: 9/10)
   - Reasoning: [Why this is the best choice]
   - [Event details...]

2. **SECOND CHOICE** - [Event Name] (Score: 8/10)
   - [Event details...]

3. **THIRD CHOICE** - [Event Name] (Score: 7/10)
   - [Event details...]

[Additional events ranked 4-10...]

Format your response as a structured markdown list with clear sections for each date.`;

const VARIABLE_BUTTONS = [
  { label: 'Children Names', variable: '{{children_names}}' },
  { label: 'Children Ages', variable: '{{children_ages}}' },
  { label: 'Age Range Min', variable: '{{age_range_min}}' },
  { label: 'Age Range Max', variable: '{{age_range_max}}' },
  { label: 'Interests', variable: '{{children_interests}}' },
  { label: 'Home Location', variable: '{{home_location}}' },
  { label: 'Max Distance', variable: '{{max_distance}}' },
  { label: 'Current Date', variable: '{{current_date}}' },
  { label: 'Date Range', variable: '{{target_date_range}}' },
  { label: 'Weather', variable: '{{weather_forecast}}' },
];

export function LLMEventScanner() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('prompt-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = prompt.substring(0, start) + variable + prompt.substring(end);
      setPrompt(newText);
      
      // Set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setLoading(true);
    setError("");
    setResponse("");

    try {
      const res = await fetch('/api/llm-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Request failed');
      }

      setResponse(data.response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(response);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <SparklesIcon className="h-6 w-6 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900">LLM Event Scanner</h2>
        </div>
        <div className="text-sm text-gray-500">
          Powered by Together AI
        </div>
      </div>

      <div className="space-y-4">
        {/* Variable Helper Buttons */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quick Insert Variables:
          </label>
          <div className="flex flex-wrap gap-2">
            {VARIABLE_BUTTONS.map((btn) => (
              <button
                key={btn.variable}
                onClick={() => insertVariable(btn.variable)}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                title={`Insert ${btn.variable}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Textarea */}
        <div>
          <label htmlFor="prompt-textarea" className="block text-sm font-medium text-gray-700 mb-2">
            LLM Prompt Template:
          </label>
          <textarea
            id="prompt-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 font-mono text-sm"
            placeholder="Enter your LLM prompt with {{variables}}..."
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={loading || !prompt.trim()}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                Scan for Events
              </>
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Response Display */}
        {response && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                LLM Response:
              </label>
              <button
                onClick={copyToClipboard}
                className="flex items-center text-xs text-gray-500 hover:text-gray-700"
              >
                <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                Copy
              </button>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                {response}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

