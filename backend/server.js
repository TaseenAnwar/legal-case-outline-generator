const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const bodyParser = require('body-parser');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.post('/generate-outline', async (req, res) => {
  try {
    const { pdfText } = req.body;
    
    if (!pdfText || pdfText.trim() === '') {
      return res.status(400).json({ error: 'PDF text is required' });
    }

    // Check if the content resembles a legal case
    const isLegalCase = checkIfLegalCase(pdfText);
    if (!isLegalCase) {
      return res.status(400).json({ 
        error: 'The uploaded document does not appear to be a legal case.'
      });
    }

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a legal assistant that creates structured outlines of legal cases. Your task is to analyze the legal case document provided and create a comprehensive, well-structured outline."
        },
        {
          role: "user",
          content: `Create a legal case outline that includes the name of the case, the bluebook citation of the case, the facts of the case (which are in bullet points and provide a concise summary of the relevant events that led to the legal dispute), the legal issue(s) of the case (the legal issue that the court is ruling on here) if there is more than one legal issue list all of them, the procedural posture of the case (meaning what stage the case is at in a lawsuit, what courts it has gone through, what those lower courts ruled, what the cause of action is (on appeal if applicable), etc. is), the arguments made by both sides in the case, the holding of the court, the legal reasoning of the court in coming to that holding, the Rule of Law (which is the legal principle or doctrine that the court applied to resolve the issue(s)), and 3 quotes from the case that are relevant to the legal issue that was determined by the court. Restrict your analysis to the contents of this document: ${pdfText}. The outline should be at least 300 words and formatted in JSON with the following structure:
          {
            "caseName": "Name of the case",
            "bluebookCitation": "Legal citation",
            "caseFacts": ["Fact 1", "Fact 2", ...],
            "legalIssues": ["Issue 1", "Issue 2", ...],
            "proceduralPosture": "Description of procedural history",
            "plaintiffArguments": ["Argument 1", "Argument 2", ...],
            "defendantArguments": ["Argument 1", "Argument 2", ...],
            "courtHolding": "The court's decision",
            "legalReasoning": "Explanation of the court's reasoning",
            "ruleOfLaw": "The legal principle established",
            "relevantQuotes": ["Quote 1", "Quote 2", "Quote 3"]
          }`
        }
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    });

    // Parse and send the response
    const caseOutline = JSON.parse(response.choices[0].message.content);
    res.json(caseOutline);
    
  } catch (error) {
    console.error('Error generating case outline:', error);
    res.status(500).json({ error: 'Failed to generate case outline' });
  }
});

// Simple heuristic to check if document appears to be a legal case
function checkIfLegalCase(text) {
  const legalTerms = [
    'court', 'plaintiff', 'defendant', 'appellant', 'appellee', 'petitioner', 'respondent',
    'judge', 'justice', 'opinion', 'ruling', 'verdict', 'judgment', 'appeal', 'statute',
    'v.', 'vs.', 'versus', 'cited', 'jurisdiction', 'affirmed', 'reversed', 'remanded'
  ];
  
  // Convert to lowercase for case-insensitive matching
  const lowerText = text.toLowerCase();
  
  // Count how many legal terms appear in the text
  const termCount = legalTerms.filter(term => 
    lowerText.includes(term.toLowerCase())
  ).length;
  
  // If at least 5 legal terms are found, consider it a legal case
  return termCount >= 5;
}

// For direct HTML requests, serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
