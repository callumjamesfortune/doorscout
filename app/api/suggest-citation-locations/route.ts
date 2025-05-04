export const maxDuration = 30;

import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { SuggestedCitationLocation } from '@/lib/types';
import { extractJson } from '@/lib/utils';

export async function POST(request: Request): Promise<Response> {
  try {
    const { text }: { text: string } = await request.json();
    console.log(`\nText received by citations API: ${text}`);

    const suggestedCitationLocations = await suggestCitationLocations(text);
    console.log(`\nCitation locations suggested: ${JSON.stringify(suggestedCitationLocations)}`);

    return NextResponse.json({ suggestedCitationLocations }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: `Unexpected error occurred: ${(error as Error).message}` }, { status: 500 });
  }
}

const suggestCitationLocations = async (text: string): Promise<SuggestedCitationLocation[]> => {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? '' });

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: `Identify as many areas in the following text that would benefit from a citation, ideally most of the sentences, and suggest a detailed, contextual and relevant Google search query to help find them. do not use dorking techniques. The suggested query must also take into consideration the surrounding text to ensure context is kept in the query. Assign an relevance percentage to the suggestions based on how critical a citation is (100 = very relevant). Return the response as a JSON object in the format:

          {
            "citations": [
              { 
                "section": "<text requiring citation>",
                "suggestedQuery": "<search query>",
                "relevance": <relevance ranking i.e 100>
              }
            ]
          }
            
          Here is the Text, do not check the truth of any of the details you receive and do not edit them: ${text}`
        }
      ],
      model: process.env.LLM_MODEL || 'llama3-70b-8192',
    });

    console.log(`\nCompletion for suggested citation locations: ${JSON.stringify(chatCompletion)}`);

    const jsonResponse = (extractJson(chatCompletion.choices[0]?.message?.content || '') as { citations }).citations as SuggestedCitationLocation[];

    if (!jsonResponse) {
      throw new Error('JSON not received from Groq (suggestions stage)');
    }

    return jsonResponse;
  } catch (error: unknown) {
    throw new Error(`No citations suggested: ${(error as Error).message}`);
  }
};
