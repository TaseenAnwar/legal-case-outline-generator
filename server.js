const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const { PDFLoader } = require('langchain/document_loaders/fs/pdf');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });

// Configure OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// PDF text extraction and case outline generation route
app.post('/generate-outline', upload.single('pdf'), async (req, res) => {
    try {
        // Validate file upload
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        // Load PDF text
        const loader = new PDFLoader(req.file.path);
        const docs = await loader.load();
        const pdfText = docs.map(doc => doc.pageContent).join('\n');

        // Validate PDF text
        if (pdfText.trim().length === 0) {
            await fs.unlink(req.file.path);
            return res.status(400).json({ error: 'Unable to extract text from PDF' });
        }

        // Generate case outline using OpenAI
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are a legal research assistant specialized in creating detailed case outlines. Always respond in a structured JSON format.'
                },
                {
                    role: 'user',
                    content: `Analyze the following legal case PDF text and create a comprehensive JSON-formatted case outline with the following sections:

1. caseName (string): Full name of the case
2. bluebookCitation (string): Proper Bluebook citation format
3. caseFacts (string[]): Bullet points summarizing key facts
4. legalIssues (string[]): List of legal issues addressed
5. proceduralPosture (string): Current stage of the lawsuit
6. plaintiffArguments (string[]): Key arguments made by the plaintiff
7. defendantArguments (string[]): Key arguments made by the defendant
8. courtHolding (string): The court's decision
9. legalReasoning (string): Explanation of the court's legal reasoning
10. ruleOfLaw (string): Fundamental legal principle applied
11. relevantQuotes (string[]): 3 most important quotes from the case

Ensure the outline is detailed and based solely on the contents of the provided PDF text. If the document does not appear to be a legal case, return an error message.

PDF Text:
${pdfText}`
                },
            ],
            response_format: { type: 'json_object' },
            max_tokens: 1500
        });

        // Parse the response
        const caseOutline = JSON.parse(response.choices[0].message.content);

        // Clean up uploaded file
        await fs.unlink(req.file.path);

        // Send response
        res.json(caseOutline);
    } catch (error) {
        console.error('Error generating case outline:', error);
        
        // Clean up file if it exists
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (cleanupError) {
                console.error('Error cleaning up file:', cleanupError);
            }
        }

        // Determine appropriate error response
        if (error.response) {
            // OpenAI API specific error
            res.status(error.response.status).json({
                error: 'OpenAI API Error',
                details: error.response.data
            });
        } else {
            // Generic server error
            res.status(500).json({ 
                error: 'Failed to generate case outline',
                details: error.message 
            });
        }
    }
});

// Catch-all route to serve the main HTML file
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: err.message
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Gracefully shutting down');
    process.exit(0);
});
