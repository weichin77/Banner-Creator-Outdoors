
interface GenerateResponse {
  imageUrl: string | null;
  credits: number;
}

interface UserProfile {
  credits: number;
  isPro: boolean;
  email: string;
}

export const getUserProfile = async (email: string): Promise<UserProfile | null> => {
  try {
    const response = await fetch(`/api/user?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error('Failed to fetch user');
    return await response.json();
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
};

export const generateNewPrompt = async (theme: string, email: string): Promise<{prompt: string | null, credits: number}> => {
  try {
    const response = await fetch('/api/generate-prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ theme, email }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Backend prompt generation failed');
    }

    const data = await response.json();
    return {
      prompt: data.prompt,
      credits: data.credits
    };
  } catch (error) {
    console.error("Frontend error calling prompt proxy:", error);
    return { prompt: null, credits: -1 }; 
  }
};

export const generateOutdoorBackground = async (prompt: string, email: string): Promise<GenerateResponse> => {
  try {
    const response = await fetch('/api/generate-background', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, email }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Backend generation failed');
    }

    const data = await response.json();
    return {
      imageUrl: data.imageUrl,
      credits: data.credits
    };
  } catch (error) {
    console.error("Frontend error calling background proxy:", error);
    // Return empty result, handling error in UI
    return { imageUrl: null, credits: -1 }; 
  }
};
