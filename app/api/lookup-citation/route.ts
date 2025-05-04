export const maxDuration = 30;

import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  Citation,
  TextAndCitation,
  WebpageContent
} from '@/lib/types';
import { extractJson } from '@/lib/utils';

const GOOGLE_API_KEY: string | undefined = process.env.GOOGLE_API_KEY;
const CSE_ID: string | undefined = process.env.CSE_ID;

export async function POST(request: Request): Promise<Response> {
  try {
    const { section, suggestedQuery }: { section: string, suggestedQuery: string } = await request.json();
    console.log(`\nText received by citation API: ${section} with query: ${suggestedQuery}`);

    const webPageContentList = await fetchWebContentForQuery(suggestedQuery);

    const citation = await findSupportingSentenceRecursively(webPageContentList, section, suggestedQuery);

    console.log(`\nResponse found: ${JSON.stringify(citation)}`);

    const response = {
      citation: citation.citation,
      correctFact: citation.correctFact,
      factSource: citation.factSource,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: `Unexpected error occurred: ${(error as Error).message}` }, { status: 500 });
  }
}

const fetchWebContentForQuery = async (query: string): Promise<WebpageContent[]> => {
  try {

    const excludedSites = ['reddit.com', 'en.wikipedia.org'];

    const excludedQuery = `${query} ${excludedSites.map(site => `-site:${site}`).join(' ')}`;

    const { data } = await axios.get(`https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(excludedQuery)}&key=${GOOGLE_API_KEY}&cx=${CSE_ID}`);

    if (!data || !data.items) {
      throw new Error('Failed to fetch search results');
    }

    const results: WebpageContent[] = [];
    for (const item of data.items.slice(0, 10)) {
      try {
        const pageContent = await scrapeWebpage(item.link);
        results.push({ link: item.link, content: pageContent });
      } catch (error: unknown) {
        console.log(`Error scraping ${item.link}: ${(error as Error).message}`);
      }
    }

    return results;
  } catch (error: unknown) {
    console.log(`Error fetching search results for query "${query}": ${(error as Error).message}`);
    return [];
  }
};

const findSupportingSentenceRecursively = async (
  webPageContentList: WebpageContent[],
  section: string,
  suggestedQuery: string
): Promise<{ citation?: Citation; correctFact?: string, factSource?: string }> => {
  if (webPageContentList.length === 0) {
    return {};
  }

  const [currentWebPage, ...remainingPages] = webPageContentList;

  try {
    const textAndCitation = await findSupportingSentence(currentWebPage.content, new URL(currentWebPage.link), section);

    if (textAndCitation.supportingSentence && currentWebPage.content.includes(textAndCitation.supportingSentence)) {
      const citation: Citation = {
        textToSupport: section,
        supportingText: textAndCitation.supportingSentence,
        harvardCitation: textAndCitation.harvardCitation,
        query: suggestedQuery,
        url: currentWebPage.link
      };
      return { citation };  // Return a single citation directly
    } else {
      console.log(`No supporting sentence found for ${currentWebPage.link}, searching for the correct fact.`);
      
      if (textAndCitation.correctFact && textAndCitation.factSource) {
        return {
          correctFact: textAndCitation.correctFact,
          factSource: textAndCitation.factSource
        };
      }
    }
  } catch (error: unknown) {
    console.log(`Error processing ${currentWebPage.link}: ${(error as Error).message}`);
  }

  return await findSupportingSentenceRecursively(remainingPages, section, suggestedQuery);
};

const findSupportingSentence = async (webpageContent: string, source: URL, statement: string): Promise<TextAndCitation> => {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? '' });

    const chatCompletion = await groq.chat.completions.create({
      messages: [{
        role: 'user',
        content: `
          Your task is to analyze the webpage content and identify if it supports or contradicts a given statement. Please follow the instructions carefully:
    
          1. **Supporting Sentence**: Find an extract of text that directly supports the statement provided. The supporting sentence should address **each key point** in the statement. Only return a sentence if it fully aligns with the statement.
    
          2. **Fact Check**: If the webpage content contradicts the statement, extract the exact content from the webpage that proves the statement to be incorrect and return this exact **textual content** as the **correctFact** (do not reword or paraphrase). Also, provide the **factSource** (URL) where this information is found. If no contradiction exists, skip this step and leave **correctFact** and **factSource** as null.
    
          3. **Return Structure**: Provide your response in the following JSON format:
    
          \`\`\`
          {
            "supportingSentence": "<sentence or null>",  
            "harvardCitation": "<author(s) or organisation (Year) Title of webpage. Available at: URL (Accessed: ${new Date().toLocaleDateString('en-GB')})>", 
            "correctFact": "<exact content from webpage or null>",  
            "factSource": "<URL or null>"
          }
          \`\`\`
    
          4. **Details**:
            - If the statement is supported, return the exact sentence that confirms the statement.
            - It is not acceptable to return a correction just because the content could not be found in the page. Only return a correction if the content is found and contradicts the statement.
            - If the statement is contradicted, return the **exact** textual content from the webpage as **correctFact** (do not modify or paraphrase the content). Simply saying "there is no mention of [stated fact] in the webpage content" is not sufficient. You must provide the exact content that contradicts the statement.
            - If no relevant supporting sentence is found or the statement is not supported/contradicted, set **supportingSentence** to null.
            - **Harvard Citation**: Only return a citation if you are **certain** about the year, otherwise use (n.d.) for the year.
    
          **Important**:
          - You must only return content that exists within the provided **webpageContent**.
          - Do not fabricate, reword, or paraphrase content. If the content doesn't exist to support or disprove the statement, return null appropriately.
          - If the **supportingSentence** is null, ensure you return the full response with null values for the non-applicable fields, not just empty fields.
    
          Statement: "${statement}"
          Content URL: ${source}
          Webpage Content: ${webpageContent.slice(0, 2000)}
    
          Please process this request carefully and return the response in the exact JSON format required.
        `
      }],
      model: process.env.LLM_MODEL || 'llama3-70b-8192',
    });
    
    

    console.log(`\nCompletion for supporting sentence: ${JSON.stringify(chatCompletion)}`);

    const response = chatCompletion.choices[0]?.message?.content;

    if (!response) {
      throw new Error('No supporting sentence found');
    }

    const jsonResponse = extractJson(response) as TextAndCitation;

    if (!jsonResponse.supportingSentence && !jsonResponse.correctFact) {
      throw new Error('No supporting sentence or correct fact found');
    }

    console.log("\nHarvard citation: ", jsonResponse.harvardCitation);
    return jsonResponse;
  } catch (error: unknown) {
    throw new Error(`Error in findSupportingSentence: ${(error as Error).message}`);
  }
};

const scrapeWebpage = async (url: string): Promise<string> => {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // Extract text from multiple content elements
    const content = $('article, main, div, section, p')
      .map((_, el) => $(el).text().trim())
      .get()
      .join(' ');

    const cleanedContent = content.replace(/\s+/g, ' ').trim();
    return cleanedContent.length > 10000 ? cleanedContent.substring(0, 10000) : cleanedContent; // Increased limit
  } catch (error: unknown) {
    throw new Error(`Error scraping web page: ${(error as Error).message}`);
  }
};
