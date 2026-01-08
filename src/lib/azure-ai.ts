/**
 * Azure OpenAI API client
 * This module handles communication with Azure OpenAI service
 */

export interface AzureAIConfig {
  endpoint: string;
  apiKey: string;
  modelName?: string;
  apiVersion?: string;
}

export interface AzureAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Generate content using Azure OpenAI
 */
export async function generateContentWithAzureAI(
  prompt: string,
  config: AzureAIConfig,
): Promise<string> {
  const {
    endpoint,
    apiKey,
    modelName = "gpt-4o",
    apiVersion = "2025-04-01-preview",
  } = config;

  // Azure OpenAI endpoint format:
  // https://{resource}.openai.azure.com/openai/deployments/{deployment-name}/chat/completions
  // OR if endpoint already includes the full path, use it directly
  let apiUrl: string;
  
  if (endpoint.includes("/openai/deployments/")) {
    // Endpoint already includes the full path
    apiUrl = `${endpoint}/chat/completions?api-version=${apiVersion}`;
  } else if (endpoint.includes("/chat/completions")) {
    // Endpoint already includes chat/completions
    apiUrl = `${endpoint}?api-version=${apiVersion}`;
  } else {
    // Endpoint is just the base URL, need to construct full path
    // Extract resource name from endpoint if it's in format: https://{resource}.openai.azure.com
    const resourceMatch = endpoint.match(/https:\/\/([^.]+)\.openai\.azure\.com/);
    if (resourceMatch) {
      // Standard Azure OpenAI format
      apiUrl = `${endpoint}/openai/deployments/${modelName}/chat/completions?api-version=${apiVersion}`;
    } else {
      // Assume it's already a full endpoint or use as-is
      apiUrl = `${endpoint}/chat/completions?api-version=${apiVersion}`;
    }
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_completion_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Azure AI API error: ${response.status} ${response.statusText}. ${errorText}`,
    );
  }

  const data = (await response.json()) as AzureAIResponse;

  // Debug logging
  console.log("Azure AI API Response:", JSON.stringify(data, null, 2));
  console.log("API URL used:", apiUrl);

  if (!data.choices || data.choices.length === 0) {
    console.error("Azure AI API returned no choices. Full response:", data);
    throw new Error("Azure AI API returned no choices");
  }

  const content = data.choices[0].message.content;
  console.log("Extracted content length:", content?.length || 0);
  console.log("Content preview:", content?.substring(0, 200) || "No content");

  return content;
}

