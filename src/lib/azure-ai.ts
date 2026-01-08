/**
 * Azure AI Studio API client
 * This module handles communication with Azure AI Studio inference API
 */

export interface AzureAIConfig {
  endpoint: string;
  apiKey: string;
  modelName?: string;
}

export interface AzureAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Generate content using Azure AI Studio
 */
export async function generateContentWithAzureAI(
  prompt: string,
  config: AzureAIConfig,
): Promise<string> {
  const { endpoint, apiKey, modelName = "gpt-4o" } = config;

  // Azure AI Studio inference API endpoint format
  // The endpoint should be: https://{resource}.services.ai.azure.com/api/projects/{project-name}
  // We need to append /chat/completions for chat API
  const apiUrl = `${endpoint}/chat/completions?api-version=2024-02-15-preview`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Azure AI API error: ${response.status} ${response.statusText}. ${errorText}`,
    );
  }

  const data = (await response.json()) as AzureAIResponse;

  if (!data.choices || data.choices.length === 0) {
    throw new Error("Azure AI API returned no choices");
  }

  return data.choices[0].message.content;
}

